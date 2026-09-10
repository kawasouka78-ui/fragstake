import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {liveConfig} from '../lib/live/config.ts';
import {initializeOutbox, deliverResults} from '../lib/live/outbox.ts';

const secret = 'test-ticket-secret-'.repeat(4);
void test('production refuses local defaults, insecure transport and reused operator secrets', () => {
  const env = {NODE_ENV:'production', LIVE_TICKET_SECRET:secret};
  assert.throws(() => liveConfig(env), /explicit/);
  Object.assign(env, {LIVE_SITE_URL:'https://arena.example', LIVE_ALLOWED_ORIGINS:'https://arena.example', LIVE_REGION:'eu', LIVE_ADMIN_SECRET:'admin-secret-'.repeat(4)});
  assert.equal(liveConfig(env).site, 'https://arena.example');
  assert.throws(() => liveConfig({...env, LIVE_SITE_URL:'http://arena.example'}), /HTTPS/);
  assert.throws(() => liveConfig({...env, LIVE_ADMIN_SECRET:secret}), /separate/);
  assert.throws(() => liveConfig({...env, LIVE_ALLOWED_ORIGINS:'*'}));
  assert.throws(() => liveConfig({...env, LIVE_PORT:'NaN'}), /port/);
  assert.throws(() => liveConfig({...env, LIVE_SITE_URL:'https://user:password@arena.example'}), /credentials/);
  assert.equal(liveConfig({LIVE_TICKET_SECRET:secret, LIVE_PORT:'0'}).port, 0);
});

void test('failed result batches back off without starving newer results, and migration preserves retries', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE outbox(id TEXT PRIMARY KEY,body TEXT NOT NULL,delivered INTEGER NOT NULL DEFAULT 0)');
    initializeOutbox(db);
    initializeOutbox(db);
    for (let i=0;i<11;i++) db.prepare('INSERT INTO outbox(id,body) VALUES(?,?)').run(String(i),JSON.stringify({id:i}));
    const calls=[];
    const failing = async (_url, options) => {calls.push(JSON.parse(options.body).id); throw new Error('offline');};
    assert.equal(await deliverResults(db,'https://arena.example',secret,failing,10000),10);
    assert.deepEqual(calls,[0,1,2,3,4,5,6,7,8,9]);
    const succeeding=async (_url, options) => {calls.push(JSON.parse(options.body).id);return new Response(null,{status:204});};
    await deliverResults(db,'https://arena.example',secret,succeeding,10001);
    assert.equal(calls.at(-1),10);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM outbox WHERE delivered=1').get().n,1);
    initializeOutbox(db);
    assert.equal(db.prepare('SELECT attempts FROM outbox WHERE id=?').get('0').attempts,1);
    await deliverResults(db,'https://arena.example',secret,succeeding,15000);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM outbox WHERE delivered=0').get().n,0);
    const count=calls.length;
    await deliverResults(db,'https://arena.example',secret,succeeding,20000);
    assert.equal(calls.length,count,'acknowledged results must not be delivered again');
  } finally {db.close();}
});
