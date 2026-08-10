import type {CameraPipelineModule} from './engineTypes';

interface VideoSize {
  height: number;
  width: number;
}

/**
 * Keeps the XR8 drawing buffer synchronized with the mobile viewport.
 *
 * API used: CameraPipelineModule canvas/video/orientation lifecycle callbacks.
 * Official source: https://8thwall.org/docs/api/engine/xr8/addcamerapipelinemodule
 * Reference implementation: 8th Wall XR Extras FullWindowCanvas.
 * Consulted: 2026-08-10.
 */
export function createFullWindowCanvasModule(): CameraPipelineModule {
  let canvas: HTMLCanvasElement | undefined;
  let resizeFrame: number | undefined;
  let videoSize: VideoSize = {height: 0, width: 0};

  const resizeCanvas = (): void => {
    resizeFrame = undefined;

    if (!canvas) {
      return;
    }

    const {height, width} = calculateCanvasSize(videoSize);

    if (canvas.width !== width) {
      canvas.width = width;
    }

    if (canvas.height !== height) {
      canvas.height = height;
    }
  };

  const scheduleResize = (): void => {
    if (resizeFrame !== undefined) {
      cancelAnimationFrame(resizeFrame);
    }

    resizeFrame = requestAnimationFrame(resizeCanvas);
  };

  return {
    name: 'webar-full-window-canvas',

    onAttach: (args) => {
      canvas = args.canvas;
      videoSize = {height: args.videoHeight, width: args.videoWidth};

      window.addEventListener('resize', scheduleResize);
      window.visualViewport?.addEventListener('resize', scheduleResize);
      scheduleResize();
    },

    onCameraStatusChange: ({status, video}) => {
      if (status === 'hasVideo' && video) {
        videoSize = {height: video.videoHeight, width: video.videoWidth};
        scheduleResize();
      }
    },

    onCanvasSizeChange: scheduleResize,

    onDetach: () => {
      window.removeEventListener('resize', scheduleResize);
      window.visualViewport?.removeEventListener('resize', scheduleResize);

      if (resizeFrame !== undefined) {
        cancelAnimationFrame(resizeFrame);
      }

      canvas = undefined;
      resizeFrame = undefined;
      videoSize = {height: 0, width: 0};
    },

    onDeviceOrientationChange: scheduleResize,

    onVideoSizeChange: ({videoHeight, videoWidth}) => {
      videoSize = {height: videoHeight, width: videoWidth};
      scheduleResize();
    },
  };

  function calculateCanvasSize(size: VideoSize): VideoSize {
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const viewportWidth = Math.max(1, Math.round(window.innerWidth * pixelRatio));
    const viewportHeight = Math.max(1, Math.round(window.innerHeight * pixelRatio));

    if (size.width <= 0 || size.height <= 0) {
      return {height: viewportHeight, width: viewportWidth};
    }

    const portraitHeight = Math.max(viewportWidth, viewportHeight);
    const portraitWidth = Math.min(viewportWidth, viewportHeight);
    const portraitAspect = portraitHeight / portraitWidth;
    const videoPortraitHeight = Math.max(size.width, size.height);
    const videoPortraitWidth = Math.min(size.width, size.height);

    let height = videoPortraitHeight;
    let width = Math.round(videoPortraitHeight / portraitAspect);

    if (width > videoPortraitWidth) {
      width = videoPortraitWidth;
      height = Math.round(videoPortraitWidth * portraitAspect);
    }

    if (width > portraitWidth || height > portraitHeight) {
      width = portraitWidth;
      height = portraitHeight;
    }

    const isLandscape = viewportWidth > viewportHeight;
    return isLandscape ? {height: width, width: height} : {height, width};
  }
}
