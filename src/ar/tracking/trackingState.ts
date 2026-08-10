import type {ARError} from '../engine/arError';

export type ARPhase =
  | 'idle'
  | 'loading-engine'
  | 'loading-slam'
  | 'requesting-camera'
  | 'tracking-initializing'
  | 'tracking-ready'
  | 'tracking-limited'
  | 'tracking-recovering'
  | 'error';

export type PlacementStatus = 'not-placed' | 'placed';

export interface ARSnapshot {
  error?: ARError;
  phase: ARPhase;
  placement: PlacementStatus;
}

type Subscriber = (snapshot: ARSnapshot) => void;

export class TrackingState {
  private snapshot: ARSnapshot = {phase: 'idle', placement: 'not-placed'};
  private readonly subscribers = new Set<Subscriber>();

  get current(): ARSnapshot {
    return this.snapshot;
  }

  setPhase(phase: Exclude<ARPhase, 'error'>): void {
    if (this.snapshot.phase === phase && this.snapshot.error === undefined) {
      return;
    }

    this.publish({phase, placement: this.snapshot.placement});
  }

  markObjectPlaced(): void {
    if (this.snapshot.placement === 'placed') {
      return;
    }

    this.publish({...this.snapshot, placement: 'placed'});
  }

  beginRecentering(): void {
    this.publish({phase: 'tracking-recovering', placement: 'not-placed'});
  }

  reset(): void {
    this.publish({phase: 'idle', placement: 'not-placed'});
  }

  fail(error: ARError): void {
    if (this.snapshot.phase === 'error' && this.snapshot.error?.code === error.code) {
      return;
    }

    this.publish({error, phase: 'error', placement: this.snapshot.placement});
  }

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.snapshot);

    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  private publish(snapshot: ARSnapshot): void {
    this.snapshot = snapshot;
    this.subscribers.forEach((subscriber) => subscriber(snapshot));
  }
}
