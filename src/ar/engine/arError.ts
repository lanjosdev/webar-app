export type ARErrorCode =
  | 'ENGINE_LOAD_ERROR'
  | 'SLAM_LOAD_ERROR'
  | 'MODEL_LOAD_ERROR'
  | 'MOTION_PERMISSION_DENIED'
  | 'CAMERA_PERMISSION_DENIED'
  | 'CAMERA_UNAVAILABLE'
  | 'UNSUPPORTED_BROWSER'
  | 'UNSUPPORTED_DEVICE'
  | 'TRACKING_INITIALIZATION_ERROR'
  | 'TRACKING_RECENTER_ERROR'
  | 'SESSION_LIFECYCLE_ERROR'
  | 'UNKNOWN_AR_ERROR';

const DEFAULT_MESSAGES: Record<ARErrorCode, string> = {
  ENGINE_LOAD_ERROR: 'Não foi possível carregar o 8th Wall Engine.',
  SLAM_LOAD_ERROR: 'Não foi possível preparar o World Tracking.',
  MODEL_LOAD_ERROR: 'Não foi possível carregar o modelo 3D.',
  MOTION_PERMISSION_DENIED: 'O acesso aos sensores de movimento foi negado.',
  CAMERA_PERMISSION_DENIED: 'O acesso à câmera foi negado.',
  CAMERA_UNAVAILABLE: 'Nenhuma câmera compatível está disponível.',
  UNSUPPORTED_BROWSER: 'Este navegador ou dispositivo não é compatível com a experiência.',
  UNSUPPORTED_DEVICE: 'O World Tracking deve ser aberto em um celular compatível.',
  TRACKING_INITIALIZATION_ERROR: 'Não foi possível iniciar o tracking neste dispositivo.',
  TRACKING_RECENTER_ERROR: 'Não foi possível recentralizar o ambiente.',
  SESSION_LIFECYCLE_ERROR: 'Não foi possível pausar ou retomar a experiência.',
  UNKNOWN_AR_ERROR: 'Ocorreu um erro inesperado ao iniciar a experiência.',
};

export class ARError extends Error {
  readonly code: ARErrorCode;

  constructor(code: ARErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ARError';
    this.code = code;
  }
}

export function toARError(
  error: unknown,
  fallbackCode: ARErrorCode = 'UNKNOWN_AR_ERROR',
): ARError {
  if (error instanceof ARError) {
    return error;
  }

  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return new ARError(
        'CAMERA_PERMISSION_DENIED',
        'O acesso à câmera foi negado. Libere a permissão no navegador e tente novamente.',
        {cause: error},
      );
    }

    if (
      error.name === 'NotFoundError' ||
      error.name === 'NotReadableError' ||
      error.name === 'OverconstrainedError'
    ) {
      return new ARError(
        'CAMERA_UNAVAILABLE',
        'Não foi possível acessar uma câmera traseira disponível.',
        {cause: error},
      );
    }
  }

  return new ARError(fallbackCode, DEFAULT_MESSAGES[fallbackCode], {cause: error});
}
