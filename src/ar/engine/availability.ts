import {XR8Promise} from '@8thwall/engine-binary';

import type {XR8} from './engineTypes';

const ENGINE_AVAILABILITY_TIMEOUT_MS = 15_000;

export type ARUnavailableReason =
  | 'engine-error'
  | 'insecure-context'
  | 'mobile-required'
  | 'unsupported-browser';

export type ARAvailability =
  | {status: 'checking'}
  | {status: 'available'}
  | {reason: ARUnavailableReason; status: 'unavailable'};

let availabilityPromise: Promise<ARAvailability> | undefined;

export function checkARAvailability(): Promise<ARAvailability> {
  availabilityPromise ??= resolveARAvailability();
  return availabilityPromise;
}

async function resolveARAvailability(): Promise<ARAvailability> {
  if (!window.isSecureContext) {
    return {reason: 'insecure-context', status: 'unavailable'};
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.WebAssembly) {
    return {reason: 'unsupported-browser', status: 'unavailable'};
  }

  try {
    const xr8 = await waitForEngine();
    const allowedDevices = xr8.XrConfig.device().MOBILE;
    const compatible = xr8.XrDevice.isDeviceBrowserCompatible({allowedDevices});

    if (compatible) {
      return {status: 'available'};
    }

    const looksLikeMobile =
      navigator.maxTouchPoints > 0 &&
      window.matchMedia('(pointer: coarse)').matches;

    return {
      reason: looksLikeMobile ? 'unsupported-browser' : 'mobile-required',
      status: 'unavailable',
    };
  } catch (error: unknown) {
    console.warn('[WebAR] Could not determine AR availability.', error);
    return {reason: 'engine-error', status: 'unavailable'};
  }
}

async function waitForEngine(): Promise<XR8> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('8th Wall Engine availability check timed out.'));
    }, ENGINE_AVAILABILITY_TIMEOUT_MS);
  });

  try {
    return await Promise.race([XR8Promise, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
