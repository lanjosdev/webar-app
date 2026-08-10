import type * as Three from 'three';

declare global {
  interface Window {
    THREE: typeof Three;
  }
}

export {};
