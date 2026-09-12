import { accountIdentity, firebasePlayerName } from '@/lib/identity';
import { issueTicket, type LiveMode } from '@/lib/live/security';
import { InputError } from '@/lib/account-rules';
import { validRoomId, type OpenRoom } from '@/lib/live/matchmaking';
import { currentFfaMapId, nextFfaRotationAt } from '@/lib/live/rotation';
import { assertEntryEnabled, paidPlay } from '@/lib/live/entry-policy';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const firebaseTickets = new Map<string, { count: number; resetAt: number }>();
export async function GET() {
  const liveServerUrl = process.env.LIVE_SERVER_URL;
  const liveTicketSecret = process.env.LIVE_TICKET_SECRET;
  const enabled = !!liveServerUrl && !!liveTicketSecret;
  let online = false,
    players = 0,
    region = 'unavailable';
  let rooms: OpenRoom[] = [];
  const rotationMapId = currentFfaMapId(),
    rotationNextAt = nextFfaRotationAt();
  if (enabled)
    try {
      const health = new URL(liveServerUrl!);
      health.protocol = health.protocol === 'wss:' ? 'https:' : 'http:';
      health.pathname = '/health';
      const r = await fetch(health, { signal: AbortSignal.timeout(1500) });
      if (r.ok) {
        const data = (await r.json()) as {
          players: number;
          region: string;
          openRooms?: OpenRoom[];
          currentFfaMapId?: string;
          nextFfaRotationAt?: number;
        };
        online = true;
        players = data.players;
        region = data.region;
        rooms = (data.openRooms ?? []).filter(
          (room) => (room.mode === 'practice' || paidPlay.enabled) &&
            (!['ffa', 'practice'].includes(room.mode) || room.mapId === rotationMapId),
        );
      }
    } catch {}
  return Response.json(
    {
      enabled,
      online,
      players,
      region,
      rooms,
      paidMatches: paidPlay.enabled,
      paidUnavailableReason: paidPlay.reason,
      currentFfaMapId: rotationMapId,
      nextFfaRotationAt: rotationNextAt,
    },
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
    const liveServerUrl = process.env.LIVE_SERVER_URL;
    const liveTicketSecret = process.env.LIVE_TICKET_SECRET;
    if (!liveServerUrl || !liveTicketSecret)
      throw new InputError('Multiplayer servers are not connected yet.', 503);
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new InputError('Use JSON.');
    const raw = await request.text();
    if (raw.length > 1024) throw new InputError('Request too large.', 413);
    const b = JSON.parse(raw);
    const mode = b.mode as LiveMode,
      actualMapId = (mode === 'ffa' || mode === 'practice') ? currentFfaMapId() : b.mapId;
    if (
      !['practice', 'ffa', '1v1', '2v2'].includes(b.mode) ||
      !['citadel', 'depot', 'underpass'].includes(actualMapId)
    )
      throw new InputError('Choose a valid format and map.');
    if (b.roomId !== undefined && !validRoomId(b.roomId))
      throw new InputError('Choose a valid match.');
    assertEntryEnabled(mode);
    const id = await accountIdentity(request.headers);
    if (!id) throw new InputError('Sign in to enter a FragStake match.', 401);
    let playerName: string;
    if (id.startsWith('firebase:')) {
      const now = Date.now(), prior = firebaseTickets.get(id);
      const usage = !prior || prior.resetAt <= now ? { count: 0, resetAt: now + 60000 } : prior;
      if (++usage.count > 12) throw new InputError('Too many match requests. Wait a moment.', 429);
      firebaseTickets.set(id, usage);
      const firebaseName = await firebasePlayerName(id);
      if (!firebaseName) throw new InputError('Finish your player setup before entering a match.', 403);
      playerName = firebaseName;
    } else {
      // D1 is only available in the Cloudflare deployment. Keep it out of the
      // Node/Cloud Run route unless a legacy dispatch identity actually uses it.
      const [{ database }, { ensureLaunchPlayer }, { checkSanction, rateLimit }] = await Promise.all([
        import('@/db'),
        import('@/db/launch'),
        import('@/db/live'),
      ]);
      const db = database();
      await rateLimit(db, 'ticket:' + id, 12);
      const player = await ensureLaunchPlayer(db, id);
      await checkSanction(db, id);
      playerName = player.name;
    }
    const ticket = await issueTicket(liveTicketSecret, {
      sub: id,
      name: playerName,
      guest: false,
      mode,
      mapId: actualMapId,
      ...(b.roomId ? { roomId: b.roomId } : {}),
    });
    return Response.json(
      { ticket, url: liveServerUrl, guest: false, mapId: actualMapId },
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
