export type ShowroomPhase = 'loading' | 'entering' | 'ready' | 'error';

export interface ShowroomSession {
  readonly ready: Promise<void>;
  dispose(): void;
  pause(): void;
  resetView(): void;
  resume(): void;
}
