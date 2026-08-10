import type {RealityResult} from '../engine/engineTypes';
import type {TrackingState} from './trackingState';

const NORMAL_STABLE_MS = 500;
const LIMITED_VISIBLE_MS = 750;
const RECENTER_TIMEOUT_MS = 8_000;

type TrackingCandidate = 'normal' | 'unsafe';

export interface TrackingRecoveryController {
  beginRecentering(now?: number): boolean;
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
  let recenterStartedAt = 0;
  let recentring = false;

  const setCandidate = (nextCandidate: TrackingCandidate, now: number): void => {
    if (candidate === nextCandidate) {
      return;
    }

    candidate = nextCandidate;
    candidateSince = now;
  };

  return {
    beginRecentering(now = performance.now()): boolean {
      if (!hasReachedNormal || recentring) {
        return false;
      }

      recentring = true;
      recenterStartedAt = now;
      candidate = undefined;
      candidateSince = now;
      trackingState.beginRecentering();
      return true;
    },

    canRecenter(): boolean {
      return hasReachedNormal && !recentring;
    },

    update(reality, now = performance.now()): boolean {
      const isNormal = reality?.trackingStatus === 'NORMAL';

      if (recentring && now - recenterStartedAt >= RECENTER_TIMEOUT_MS) {
        recentring = false;
        trackingState.setPhase('tracking-limited');
      }

      if (isNormal) {
        setCandidate('normal', now);

        if (now - candidateSince < NORMAL_STABLE_MS) {
          return false;
        }

        hasReachedNormal = true;
        recentring = false;
        trackingState.setPhase('tracking-ready');
        return true;
      }

      setCandidate('unsafe', now);

      if (!hasReachedNormal) {
        trackingState.setPhase('tracking-initializing');
        return false;
      }

      if (recentring) {
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
