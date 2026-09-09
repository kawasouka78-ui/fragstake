import { validRoomId } from './matchmaking.ts';
const encoder = new TextEncoder();
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
const decode = (value: string) =>
  Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
    c.charCodeAt(0),
  );
async function key(secret: string) {
  if (secret.length < 32)
    throw new Error(
      'A game service secret of at least 32 characters is required.',
    );
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}
export async function signature(secret: string, purpose: string, body: string) {
  return encode(
    new Uint8Array(
      await crypto.subtle.sign(
        'HMAC',
        await key(secret),
        encoder.encode(purpose + '\n' + body),
      ),
    ),
  );
}
export async function verifySignature(
  secret: string,
  purpose: string,
  body: string,
  sig: string,
) {
  try {
    return await crypto.subtle.verify(
      'HMAC',
      await key(secret),
      decode(sig),
      encoder.encode(purpose + '\n' + body),
    );
  } catch {
    return false;
  }
}
export type LiveMode = 'ffa' | '1v1' | '2v2';
export type Ticket = {
  sub: string;
  name: string;
  guest: boolean;
  mode: LiveMode;
  mapId: string;
  roomId?: string;
  nonce: string;
  exp: number;
  aud: 'skillclash-game';
};
export async function issueTicket(
  secret: string,
  claims: Omit<Ticket, 'aud' | 'exp' | 'nonce'>,
  now = Date.now(),
) {
  const payload = encode(
    encoder.encode(
      JSON.stringify({
        ...claims,
        aud: 'skillclash-game',
        exp: now + 60000,
        nonce: crypto.randomUUID(),
      }),
    ),
  );
  return payload + '.' + (await signature(secret, 'join', payload));
}
export async function readTicket(
  secret: string,
  token: string,
  now = Date.now(),
): Promise<Ticket | null> {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const [body, sig, extra] = token.split('.');
  if (
    extra ||
    !body ||
    !sig ||
    !(await verifySignature(secret, 'join', body, sig))
  )
    return null;
  try {
    const c = JSON.parse(new TextDecoder().decode(decode(body))) as Ticket;
    return c.aud === 'skillclash-game' &&
      Number.isFinite(c.exp) &&
      c.exp > now &&
      c.exp <= now + 60000 &&
      typeof c.sub === 'string' &&
      c.sub.length <= 200 &&
      typeof c.name === 'string' &&
      c.name.length <= 32 &&
      typeof c.guest === 'boolean' &&
      typeof c.nonce === 'string' &&
      ['ffa', '1v1', '2v2'].includes(c.mode) &&
      ['citadel', 'depot', 'underpass'].includes(c.mapId) &&
      (c.roomId === undefined || validRoomId(c.roomId))
      ? c
      : null;
  } catch {
    return null;
  }
}
