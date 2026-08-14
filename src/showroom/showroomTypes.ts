export type ShowroomPhase = 'loading' | 'ready' | 'error';

export interface ShowroomSession {
  dispose(): void;
  pause(): void;
  resetView(): void;
  resume(): void;
}
