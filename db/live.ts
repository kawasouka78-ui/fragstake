import { InputError, textValue } from '../lib/account-rules.ts';
import { signature } from '../lib/live/security.ts';
export async function rateLimit(
  db: D1Database,
  id: string,
  max: number,
  period = 60000,
) {
  const now = Date.now(),
    key = id + ':' + Math.floor(now / period);
  const row = await db
    .prepare(
      'INSERT INTO api_limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count',
    )
    .bind(key, now + period)
    .first<{ count: number }>();
  if ((row?.count || 0) > max)
    throw new InputError('Please slow down and try again shortly.', 429);
  if (Math.random() < 0.02)
    await db.prepare('DELETE FROM api_limits WHERE expires<?').bind(now).run();
}
export async function checkSanction(db: D1Database, id: string) {
  if (
    await db
      .prepare(
        'SELECT player_id FROM player_sanctions WHERE player_id=? AND until_at>?',
      )
      .bind(id, Date.now())
      .first()
  )
    throw new InputError(
      'This account is temporarily restricted. Contact support to appeal.',
      403,
    );
}
export async function recordLiveResult(db: D1Database, value: unknown) {
  if (!value || typeof value !== 'object')
    throw new InputError('Invalid result');
  const v = value as Record<string, any>;
  const int = (n: unknown, max: number) =>
    Number.isInteger(n) && Number(n) >= 0 && Number(n) <= max;
  if (
    typeof v.id !== 'string' ||
    !/^[0-9a-f-]{36}$/.test(v.id) ||
    !['ffa', '1v1', '2v2'].includes(v.mode) ||
    !['citadel', 'depot', 'underpass'].includes(v.mapId) ||
    !int(v.startedAt, Date.now()) ||
    !int(v.finishedAt, Date.now() + 60000) ||
    v.finishedAt < v.startedAt ||
    !int(v.duration, 181) ||
    !Array.isArray(v.players) ||
    v.players.length > 10
  )
    throw new InputError('Invalid result');
  const ids = new Set<string>();
  for (const p of v.players) {
    if (
      !p ||
      typeof p.id !== 'string' ||
      ids.has(p.id) ||
      !int(p.kills, 2000) ||
      !int(p.deaths, 2000) ||
      !int(p.headshots, p.kills) ||
      !int(p.maxStreak, p.kills) ||
      !int(p.seconds, 181) ||
      typeof p.completed !== 'boolean' ||
      typeof p.won !== 'boolean'
    )
      throw new InputError('Invalid participant result');
    ids.add(p.id);
  }
  // A content digest makes conflicting retries visible; duplicate delivery cannot grant XP twice.
  const digest = await signature(
    'skillclash-result-digest-not-a-secret',
    'digest',
    JSON.stringify(v),
  );
  const previous = await db
    .prepare('SELECT digest FROM live_matches WHERE id=?')
    .bind(v.id)
    .first<{ digest: string }>();
  if (previous) {
    if (previous.digest !== digest)
      throw new InputError('Conflicting result already recorded.', 409);
    return { ok: true, duplicate: true };
  }
  await db.batch([
    db
      .prepare(
        'INSERT INTO live_matches(id,mode,map_id,started_at,finished_at,duration,digest) VALUES(?,?,?,?,?,?,?)',
      )
      .bind(
        v.id,
        v.mode,
        v.mapId,
        v.startedAt,
        v.finishedAt,
        v.duration,
        digest,
      ),
    ...v.players.map((p) =>
      db
        .prepare(
          'INSERT INTO live_results(id,match_id,player_id,kills,deaths,headshots,max_streak,seconds,won,completed,xp,finished_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .bind(
          v.id + ':' + p.id,
          v.id,
          p.id,
          p.kills,
          p.deaths,
          p.headshots,
          p.maxStreak,
          p.seconds,
          Number(p.won),
          Number(p.completed),
          p.completed && p.seconds >= 30
            ? 100 + Math.min(50, p.kills) * 10 + (p.won ? 50 : 0)
            : 0,
          v.finishedAt,
        ),
    ),
  ]);
  return { ok: true };
}
export async function progression(db: D1Database, id: string) {
  const [total, today, recent, leaders] = await Promise.all([
    db
      .prepare(
        'SELECT COALESCE(SUM(xp),0) AS xp,COALESCE(SUM(kills),0) AS kills,COALESCE(SUM(headshots),0) AS headshots,COALESCE(SUM(won),0) AS wins,COALESCE(MAX(max_streak),0) AS streak,COUNT(*) AS matches FROM live_results WHERE player_id=? AND completed=1',
      )
      .bind(id)
      .first<Record<string, number>>(),
    db
      .prepare(
        'SELECT COUNT(*) AS matches,COALESCE(SUM(kills),0) AS kills,COALESCE(SUM(won),0) AS wins FROM live_results WHERE player_id=? AND completed=1 AND seconds>=30 AND finished_at>=?',
      )
      .bind(id, Math.floor(Date.now() / 86400000) * 86400000)
      .first<Record<string, number>>(),
    db
      .prepare(
        'SELECT r.*,m.mode,m.map_id FROM live_results r JOIN live_matches m ON m.id=r.match_id WHERE r.player_id=? ORDER BY r.finished_at DESC LIMIT 20',
      )
      .bind(id)
      .all(),
    db
      .prepare(
        'SELECT p.name,p.handle,SUM(r.xp) AS xp,SUM(r.kills) AS kills,SUM(r.won) AS wins FROM live_results r JOIN players p ON p.id=r.player_id WHERE r.completed=1 GROUP BY p.id ORDER BY xp DESC,kills DESC,p.handle LIMIT 20',
      )
      .all(),
  ]);
  const s = total!;
  return {
    total: s,
    level: 1 + Math.floor(s.xp / 1000),
    nextLevel: 1000 - (s.xp % 1000),
    today: today!,
    recent: recent.results,
    leaders: leaders.results,
    achievements: [
      { name: 'First deployment', goal: 1, value: s.matches },
      { name: 'Sharpshooter', goal: 25, value: s.headshots },
      { name: 'Centurion', goal: 100, value: s.kills },
      { name: 'On a roll', goal: 5, value: s.streak },
      { name: 'Winner’s circle', goal: 10, value: s.wins },
    ],
  };
}
async function allowedConversation(db: D1Database, id: string, target: string) {
  const friend = await db
    .prepare(
      "SELECT id FROM friendships WHERE status='accepted' AND ((sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?))",
    )
    .bind(id, target, target, id)
    .first();
  const block = await db
    .prepare(
      'SELECT id FROM player_blocks WHERE (player_id=? AND target_id=?) OR (player_id=? AND target_id=?)',
    )
    .bind(id, target, target, id)
    .first();
  if (!friend || block)
    throw new InputError(
      'Messaging is available between unblocked friends.',
      403,
    );
}
export async function socialData(db: D1Database, id: string, target: string) {
  const friends = await db
    .prepare(
      "SELECT p.id,p.name,p.handle,COALESCE(s.updated_at,0) AS updated_at,COALESCE(s.activity,'offline') AS activity,EXISTS(SELECT 1 FROM player_blocks b WHERE b.player_id=? AND b.target_id=p.id) AS blocked FROM friendships f JOIN players p ON p.id=CASE WHEN f.sender_id=? THEN f.receiver_id ELSE f.sender_id END LEFT JOIN presence s ON s.player_id=p.id WHERE f.status='accepted' AND (f.sender_id=? OR f.receiver_id=?)",
    )
    .bind(id, id, id, id)
    .all();
  if (!target) return { friends: friends.results, messages: [] };
  await allowedConversation(db, id, target);
  const rows = await db
    .prepare(
      'SELECT id,sender_id,receiver_id,body,created_at FROM messages WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?) ORDER BY created_at DESC,id DESC LIMIT 60',
    )
    .bind(id, target, target, id)
    .all();
  return { friends: friends.results, messages: rows.results.reverse() };
}
export async function socialMutation(
  db: D1Database,
  id: string,
  b: Record<string, unknown>,
) {
  if (b.action === 'presence') {
    await rateLimit(db, 'presence:' + id, 6);
    const activity = ['lobby', 'playing', 'away'].includes(String(b.activity))
      ? String(b.activity)
      : 'lobby';
    await db
      .prepare(
        'INSERT INTO presence(player_id,activity,updated_at) VALUES(?,?,?) ON CONFLICT(player_id) DO UPDATE SET activity=excluded.activity,updated_at=excluded.updated_at',
      )
      .bind(id, activity, Date.now())
      .run();
    return true;
  }
  if (
    !['message_send', 'player_block', 'player_unblock'].includes(
      String(b.action),
    )
  )
    return false;
  await checkSanction(db, id);
  await rateLimit(db, 'social:' + id, 30);
  const target = textValue(b.target, 'Friend', 1, 200);
  if (target === id) throw new InputError('Choose another player.');
  if (b.action === 'message_send') {
    await allowedConversation(db, id, target);
    const body = textValue(b.message, 'Message', 1, 500),
      key = id + ':' + textValue(b.key, 'Message key', 8, 80);
    await db
      .prepare(
        'INSERT OR IGNORE INTO messages(id,sender_id,receiver_id,body,created_at) VALUES(?,?,?,?,?)',
      )
      .bind(key, id, target, body, Date.now())
      .run();
  } else if (b.action === 'player_block')
    await db
      .prepare(
        'INSERT OR IGNORE INTO player_blocks(id,player_id,target_id) VALUES(?,?,?)',
      )
      .bind(JSON.stringify([id, target]), id, target)
      .run();
  else
    await db
      .prepare('DELETE FROM player_blocks WHERE player_id=? AND target_id=?')
      .bind(id, target)
      .run();
  return true;
}
