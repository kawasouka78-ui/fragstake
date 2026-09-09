import { env } from 'cloudflare:workers';
import { database } from '@/db';
import { accountIdentity } from '@/lib/identity';
import { InputError, textValue } from '@/lib/account-rules';
export const dynamic = 'force-dynamic';
async function handle(request: Request, write: boolean) {
  try {
    const id = await accountIdentity(request.headers);
    if (!id || !(env.MODERATOR_IDS || '').split(',').includes(id))
      return Response.json(
        { error: 'Moderator access required.' },
        { status: 403 },
      );
    const db = database();
    if (write) {
      if (request.headers.get('origin') !== new URL(request.url).origin)
        throw new InputError('Request origin rejected.', 403);
      const raw = await request.text();
      if (raw.length > 3000) throw new InputError('Request too large.', 413);
      const b = JSON.parse(raw);
      if (!['reviewing', 'resolved', 'dismissed'].includes(b.status))
        throw new InputError('Invalid report status.');
      const note = textValue(b.note, 'Review note', 5, 1000),
        report = await db
          .prepare('SELECT id FROM reports WHERE id=?')
          .bind(String(b.id))
          .first();
      if (!report) throw new InputError('Report not found.', 404);
      await db.batch([
        db
          .prepare('UPDATE reports SET status=? WHERE id=?')
          .bind(b.status, b.id),
        db
          .prepare(
            'INSERT INTO moderation_events(id,actor_id,report_id,decision,note,created_at) VALUES(?,?,?,?,?,?)',
          )
          .bind(crypto.randomUUID(), id, b.id, b.status, note, Date.now()),
      ]);
    }
    const [reports, audit] = await Promise.all([
      db
        .prepare(
          'SELECT r.*,p.handle FROM reports r JOIN players p ON p.id=r.player_id ORDER BY r.created_at DESC LIMIT 100',
        )
        .all(),
      db
        .prepare(
          'SELECT * FROM moderation_events ORDER BY created_at DESC LIMIT 100',
        )
        .all(),
    ]);
    return Response.json(
      { reports: reports.results, audit: audit.results },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof InputError ? e.message : 'Review failed.' },
      { status: e instanceof InputError ? e.status : 500 },
    );
  }
}
export function GET(r: Request) {
  return handle(r, false);
}
export function POST(r: Request) {
  return handle(r, true);
}
