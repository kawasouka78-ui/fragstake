import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { ensurePlayer, mutate, state } from '../db/service.ts';
import {
  recordLiveResult,
  progression,
  socialData,
  socialMutation,
  rateLimit,
  checkSanction,
} from '../db/live.ts';
let sql, db;
function statement(query, values = []) {
  return {
    bind(...args) {
      return statement(query, args);
    },
    async first() {
      return sql.prepare(query).get(...values) ?? null;
    },
    async all() {
      return { results: sql.prepare(query).all(...values) };
    },
    async run() {
      const r = sql.prepare(query).run(...values);
      return { meta: { changes: Number(r.changes) } };
    },
  };
}
beforeEach(async () => {
  sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
    .filter((f) => f.endsWith('.sql'))
    .sort())
    sql.exec(
      readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
    );
  db = {
    prepare: statement,
    async batch(items) {
      sql.exec('BEGIN');
      try {
        const r = [];
        for (const s of items) r.push(await s.run());
        sql.exec('COMMIT');
        return r;
      } catch (e) {
        sql.exec('ROLLBACK');
        throw e;
      }
    },
  };
  for (const id of ['alice', 'bob', 'charlie']) await ensurePlayer(db, id);
});
afterEach(() => sql.close());
function result() {
  return {
    id: crypto.randomUUID(),
    mode: 'ffa',
    mapId: 'citadel',
    startedAt: Date.now() - 180000,
    finishedAt: Date.now(),
    duration: 180,
    players: [
      {
        id: 'alice',
        kills: 8,
        deaths: 2,
        headshots: 3,
        maxStreak: 5,
        seconds: 180,
        won: true,
        completed: true,
      },
    ],
  };
}
test('verified results save XP once and never touch demo money or client-reported history', async () => {
  const r = result();
  await recordLiveResult(db, r);
  await recordLiveResult(db, r);
  const p = await progression(db, 'alice');
  assert.equal(p.total.xp, 230);
  assert.equal(p.total.matches, 1);
  assert.equal(p.today.kills, 8);
  assert.equal((await state(db, 'alice')).player.balance, 10000);
  assert.equal((await state(db, 'alice')).matches.length, 0);
  await assert.rejects(
    recordLiveResult(db, { ...r, players: [{ ...r.players[0], kills: 9 }] }),
    /Conflicting/,
  );
});
test('short and abandoned live rounds award no XP; invalid participants roll back the whole match', async () => {
  const r = result();
  r.players[0].seconds = 10;
  await recordLiveResult(db, r);
  assert.equal((await progression(db, 'alice')).total.xp, 0);
  const invalid = result();
  invalid.players.push({ ...invalid.players[0], id: 'missing' });
  await assert.rejects(recordLiveResult(db, invalid));
  assert.equal(
    sql
      .prepare('SELECT COUNT(*) n FROM live_matches WHERE id=?')
      .get(invalid.id).n,
    0,
  );
  await assert.rejects(
    recordLiveResult(db, {
      ...result(),
      players: [{ ...result().players[0], kills: -1 }],
    }),
    /Invalid/,
  );
});
async function friends() {
  await mutate(db, 'alice', { action: 'friend_send', target: 'bob' });
  const id = sql.prepare('SELECT id FROM friendships').get().id;
  await mutate(db, 'bob', { action: 'friend_accept', id });
}
test('friend messages require acceptance, cannot be read by outsiders, and deduplicate retries', async () => {
  const message = {
    action: 'message_send',
    target: 'bob',
    message: 'Ready for a match?',
    key: 'message-key-01',
  };
  await assert.rejects(
    socialMutation(db, 'alice', message),
    /unblocked friends/,
  );
  await friends();
  await socialMutation(db, 'alice', message);
  await socialMutation(db, 'alice', message);
  assert.equal((await socialData(db, 'bob', 'alice')).messages.length, 1);
  await assert.rejects(socialData(db, 'charlie', 'alice'), /unblocked friends/);
  assert.equal((await socialData(db, 'charlie', '')).messages.length, 0);
});
test('blocks prevent sending in both directions and unblocking restores accepted-friend chat', async () => {
  await friends();
  await socialMutation(db, 'bob', { action: 'player_block', target: 'alice' });
  await assert.rejects(
    socialMutation(db, 'alice', {
      action: 'message_send',
      target: 'bob',
      message: 'hello',
      key: 'blocked-msg',
    }),
    /unblocked/,
  );
  await socialMutation(db, 'bob', {
    action: 'player_unblock',
    target: 'alice',
  });
  await socialMutation(db, 'alice', {
    action: 'message_send',
    target: 'bob',
    message: 'hello',
    key: 'allowed-msg',
  });
  assert.equal((await socialData(db, 'alice', 'bob')).messages.length, 1);
});
test('presence is scoped to friends, and rate limits and sanctions are server enforced', async () => {
  await friends();
  await socialMutation(db, 'alice', { action: 'presence', activity: 'lobby' });
  assert.equal((await socialData(db, 'bob', '')).friends[0].activity, 'lobby');
  await rateLimit(db, 'test', 1);
  await assert.rejects(rateLimit(db, 'test', 1), /slow down/);
  sql
    .prepare('INSERT INTO player_sanctions VALUES(?,?,?)')
    .run('alice', Date.now() + 60000, 'Test restriction');
  await assert.rejects(checkSanction(db, 'alice'), /restricted/);
  await checkSanction(db, 'bob');
});
