import type {RealityResult} from '../engine/engineTypes';
import type {TrackingState} from './trackingState';

const NORMAL_STABLE_MS = 500;
const LIMITED_VISIBLE_MS = 750;
const RECOVERY_TIMEOUT_MS = 8_000;

type TrackingCandidate = 'normal' | 'unsafe';
type RecoveryMode = 'recenter' | 'resume';

export interface TrackingRecoveryController {
  beginPaused(now?: number): void;
  beginRecentering(now?: number): boolean;
  beginResuming(now?: number): void;
  canRecenter(): boolean;
  update(reality?: RealityResult, now?: number): boolean;
}

/**
 * Converts frame-level XR8 tracking results into stable application states.
 *
 * Raw unsafe results disable placement immediately. High-level UI transitions
 * use short confirmation windows so a single frame does not make the status
 * panel flicker or prematurely restore interaction.
 */
export function createTrackingRecoveryController(
  trackingState: TrackingState,
): TrackingRecoveryController {
  let candidate: TrackingCandidate | undefined;
  let candidateSince = 0;
  let hasReachedNormal = false;
  let recoveryMode: RecoveryMode | undefined;
  let recoveryStartedAt = 0;

  const setCandidate = (nextCandidate: TrackingCandidate, now: number): void => {
    if (candidate === nextCandidate) {
      return;
    }

    candidate = nextCandidate;
    candidateSince = now;
  };

  return {
    beginPaused(now = performance.now()): void {
      candidate = undefined;
      candidateSince = now;
      recoveryMode = undefined;
      trackingState.setPhase('paused');
    },

    beginRecentering(now = performance.now()): boolean {
      if (!hasReachedNormal || recoveryMode !== undefined) {
        return false;
      }

      recoveryMode = 'recenter';
      recoveryStartedAt = now;
      candidate = undefined;
      candidateSince = now;
      trackingState.beginRecentering();
      return true;
    },

    beginResuming(now = performance.now()): void {
      candidate = undefined;
      candidateSince = now;

      if (!hasReachedNormal) {
        recoveryMode = undefined;
        trackingState.setPhase('tracking-initializing');
        return;
      }

      recoveryMode = 'resume';
      recoveryStartedAt = now;
      trackingState.setPhase('tracking-recovering');
    },

    canRecenter(): boolean {
      return hasReachedNormal && recoveryMode === undefined;
    },

    update(reality, now = performance.now()): boolean {
      const isNormal = reality?.trackingStatus === 'NORMAL';

      if (recoveryMode !== undefined && now - recoveryStartedAt >= RECOVERY_TIMEOUT_MS) {
        recoveryMode = undefined;
        trackingState.setPhase('tracking-limited');
      }

      if (isNormal) {
        setCandidate('normal', now);

        if (now - candidateSince < NORMAL_STABLE_MS) {
          return false;
        }

        hasReachedNormal = true;
        recoveryMode = undefined;
        trackingState.setPhase('tracking-ready');
        return true;
      }

      setCandidate('unsafe', now);

      if (!hasReachedNormal) {
        trackingState.setPhase('tracking-initializing');
        return false;
      }

      if (recoveryMode !== undefined) {
        trackingState.setPhase('tracking-recovering');
        return false;
      }

      if (now - candidateSince >= LIMITED_VISIBLE_MS) {
        trackingState.setPhase('tracking-limited');
      }

      return false;
    },
  };
}
