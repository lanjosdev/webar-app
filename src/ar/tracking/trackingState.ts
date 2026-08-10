import type {ARError} from '../engine/arError';

export type ARPhase =
  | 'idle'
  | 'loading-engine'
  | 'loading-slam'
  | 'requesting-camera'
  | 'tracking-initializing'
  | 'tracking-ready'
  | 'tracking-limited'
  | 'error';

export interface ARSnapshot {
  error?: ARError;
  phase: ARPhase;
}

type Subscriber = (snapshot: ARSnapshot) => void;

export class TrackingState {
  private snapshot: ARSnapshot = {phase: 'idle'};
  private readonly subscribers = new Set<Subscriber>();

  get current(): ARSnapshot {
    return this.snapshot;
  }

  setPhase(phase: Exclude<ARPhase, 'error'>): void {
    if (this.snapshot.phase === phase && this.snapshot.error === undefined) {
      return;
    }

    this.publish({phase});
  }

  fail(error: ARError): void {
    if (this.snapshot.phase === 'error' && this.snapshot.error?.code === error.code) {
      return;
    }

    this.publish({error, phase: 'error'});
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
