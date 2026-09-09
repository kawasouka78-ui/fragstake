import { env } from 'cloudflare:workers';
import { database } from '@/db';
import { ensurePlayer } from '@/db/service';
import { checkSanction, rateLimit } from '@/db/live';
import { accountIdentity } from '@/lib/identity';
import { issueTicket, type LiveMode } from '@/lib/live/security';
import { InputError } from '@/lib/account-rules';
import { validRoomId, type OpenRoom } from '@/lib/live/matchmaking';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
export async function GET() {
  const enabled = !!env.LIVE_SERVER_URL && !!env.LIVE_TICKET_SECRET;
  let online = false,
    players = 0,
    region = 'unavailable';
  let rooms: OpenRoom[] = [];
  if (enabled)
    try {
      const health = new URL(env.LIVE_SERVER_URL!);
      health.protocol = health.protocol === 'wss:' ? 'https:' : 'http:';
      health.pathname = '/health';
      const r = await fetch(health, { signal: AbortSignal.timeout(1500) });
      if (r.ok) {
        const data = (await r.json()) as {
          players: number;
          region: string;
          openRooms?: OpenRoom[];
        };
        online = true;
        players = data.players;
        region = data.region;
        rooms = data.openRooms ?? [];
      }
    } catch {}
  return Response.json(
    { enabled, online, players, region, rooms, paidMatches: false },
    { headers },
  );
}
export async function POST(request: Request) {
  try {
    if (
      request.headers.get('origin') !== new URL(request.url).origin ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      throw new InputError('Request origin rejected.', 403);
    if (!env.LIVE_SERVER_URL || !env.LIVE_TICKET_SECRET)
      throw new InputError('Multiplayer servers are not connected yet.', 503);
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new InputError('Use JSON.');
    const raw = await request.text();
    if (raw.length > 1024) throw new InputError('Request too large.', 413);
    const b = JSON.parse(raw);
    if (
      !['ffa', '1v1', '2v2'].includes(b.mode) ||
      !['citadel', 'depot', 'underpass'].includes(b.mapId)
    )
      throw new InputError('Choose a valid format and map.');
    if (b.roomId !== undefined && !validRoomId(b.roomId))
      throw new InputError('Choose a valid match.');
    const db = database(),
      id = await accountIdentity(request.headers);
    await rateLimit(
      db,
      'ticket:' +
        (id || request.headers.get('cf-connecting-ip') || 'anonymous'),
      12,
    );
    const p = id ? await ensurePlayer(db, id) : null;
    if (id) await checkSanction(db, id);
    const ticket = await issueTicket(env.LIVE_TICKET_SECRET, {
      sub: id || 'guest:' + crypto.randomUUID(),
      name: p?.name || 'Guest ' + Math.floor(1000 + Math.random() * 9000),
      guest: !id,
      mode: b.mode as LiveMode,
      mapId: b.mapId,
      ...(b.roomId ? { roomId: b.roomId } : {}),
    });
    return Response.json(
      { ticket, url: env.LIVE_SERVER_URL, guest: !id },
      { headers },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof InputError
            ? e.message
            : 'Could not join. Please try again.',
      },
      { status: e instanceof InputError ? e.status : 400, headers },
    );
  }
}
