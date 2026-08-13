export function calculateFinalizationDuration(
  finalizationStartedAt?: number,
  mediaReadyAt?: number,
): number | undefined {
  if (
    finalizationStartedAt === undefined ||
    mediaReadyAt === undefined ||
    !Number.isFinite(finalizationStartedAt) ||
    !Number.isFinite(mediaReadyAt)
  ) {
    return undefined;
  }

  return Math.max(0, mediaReadyAt - finalizationStartedAt);
}
