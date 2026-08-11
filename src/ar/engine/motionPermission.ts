import {ARError} from './arError';

type MotionPermissionState = 'denied' | 'granted';

interface PermissionRequestingEventConstructor {
  requestPermission?: () => Promise<MotionPermissionState>;
}

type PermissionRequester = () => Promise<MotionPermissionState>;

let permissionGranted = false;

/**
 * iOS requires motion/orientation permission to be requested directly from a
 * user gesture. Requesting it here, before XR8.run(), prevents the Engine from
 * falling back to its non-localizable English permission explainer.
 *
 * Official source, consulted 2026-08-11:
 * https://8thwall.org/docs/api/engine/xrpermissions
 */
export function needsExplicitMotionPermission(): boolean {
  return !permissionGranted && getPermissionRequesters().length > 0;
}

export async function requestMotionPermission(): Promise<void> {
  const requesters = getPermissionRequesters();

  if (requesters.length === 0) {
    permissionGranted = true;
    return;
  }

  try {
    // Invoke every requester before the first await so Safari still considers
    // both calls part of the user's click/tap gesture.
    const pendingPermissions = requesters.map((requestPermission) => requestPermission());
    const results = await Promise.all(pendingPermissions);

    if (results.some((result) => result !== 'granted')) {
      throw new ARError(
        'MOTION_PERMISSION_DENIED',
        'O acesso aos sensores de movimento foi negado. Libere a permissão no Safari e tente novamente.',
      );
    }

    permissionGranted = true;
  } catch (error: unknown) {
    if (error instanceof ARError) {
      throw error;
    }

    throw new ARError(
      'MOTION_PERMISSION_DENIED',
      'Não foi possível acessar os sensores de movimento. Verifique as permissões do Safari e tente novamente.',
      {cause: error},
    );
  }
}

function getPermissionRequesters(): PermissionRequester[] {
  const requesters: PermissionRequester[] = [];
  const motionEvent = globalThis.DeviceMotionEvent as
    | (typeof DeviceMotionEvent & PermissionRequestingEventConstructor)
    | undefined;
  const orientationEvent = globalThis.DeviceOrientationEvent as
    | (typeof DeviceOrientationEvent & PermissionRequestingEventConstructor)
    | undefined;

  if (typeof motionEvent?.requestPermission === 'function') {
    requesters.push(() => motionEvent.requestPermission!());
  }

  if (typeof orientationEvent?.requestPermission === 'function') {
    requesters.push(() => orientationEvent.requestPermission!());
  }

  return requesters;
}
