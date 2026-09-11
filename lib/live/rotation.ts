import type { MapId } from '../fps/maps.ts';

export const FFA_ROTATION_MS = 10 * 60 * 1000;
export const ffaRotationMaps = ['citadel', 'depot', 'underpass'] as const;

export function currentFfaMapId(now = Date.now()): MapId {
  const index =
    Math.floor(Math.max(0, now) / FFA_ROTATION_MS) % ffaRotationMaps.length;
  return ffaRotationMaps[index];
}

export function nextFfaRotationAt(now = Date.now()) {
  return (Math.floor(Math.max(0, now) / FFA_ROTATION_MS) + 1) * FFA_ROTATION_MS;
}

export function ffaRotationRemainingSeconds(now = Date.now()) {
  return Math.max(0, Math.ceil((nextFfaRotationAt(now) - now) / 1000));
}
