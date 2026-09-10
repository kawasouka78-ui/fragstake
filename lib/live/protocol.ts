import { idleInput, matchWeaponIds, type Controls } from '../fps/simulation.ts';
export type InputFrame = {
  type: 'input';
  seq: number;
  yaw: number;
  pitch: number;
  controls: Controls;
};
export function parseInput(
  value: unknown,
  previous: number,
): InputFrame | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>,
    c = v.controls as Record<string, unknown>;
  if (
    v.type !== 'input' ||
    !Number.isSafeInteger(v.seq) ||
    Number(v.seq) <= previous ||
    !Number.isFinite(v.yaw) ||
    !Number.isFinite(v.pitch) ||
    Math.abs(Number(v.yaw)) > Math.PI ||
    Math.abs(Number(v.pitch)) > 1.35 ||
    !c ||
    typeof c !== 'object'
  )
    return null;
  if (
    ![c.forward, c.right].every(
      (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1,
    )
  )
    return null;
  const controls = idleInput();
  controls.forward = Number(c.forward);
  controls.right = Number(c.right);
  for (const field of [
    'fire',
    'aim',
    'sprint',
    'crouch',
    'jump',
    'reload',
    'slide',
  ] as const) {
    if (c[field] !== undefined && typeof c[field] !== 'boolean') return null;
    controls[field] = c[field] === true;
  }
  if (c.weapon !== undefined) {
    if (!matchWeaponIds.includes(c.weapon as never)) return null;
    controls.weapon = c.weapon as Controls['weapon'];
  }
  return {
    type: 'input',
    seq: Number(v.seq),
    yaw: Number(v.yaw),
    pitch: Number(v.pitch),
    controls,
  };
}
export const LIVE_TICK = 1 / 30;
export const RECONNECT_MS = 15000;
