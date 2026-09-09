import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { WebSocket } from 'ws';
import { issueTicket } from '../lib/live/security.ts';
import { idleInput } from '../lib/fps/simulation.ts';
test(
  'real WebSocket clients share rooms, reject reused tickets and reconnect without losing their slot',
  { timeout: 20000 },
  async () => {
    mkdirSync('.wrangler/integration', { recursive: true });
    const cwd = mkdtempSync(resolve('.wrangler/integration/server-')),
      secret = crypto.randomUUID() + crypto.randomUUID();
    const child = spawn(
      process.execPath,
      ['--experimental-strip-types', resolve('server/game-server.ts')],
      {
        cwd,
        env: {
          ...process.env,
          LIVE_PORT: '0',
          LIVE_HOST: '127.0.0.1',
          LIVE_TICKET_SECRET: secret,
          LIVE_ALLOWED_ORIGINS: 'http://test.local',
          LIVE_SITE_URL: 'http://127.0.0.1:1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const sockets = [];
    try {
      const port = await new Promise((ok, bad) => {
        const timeout = setTimeout(
          () => bad(new Error('Server did not start')),
          5000,
        );
        child.stdout.on('data', (data) => {
          const m = data.toString().match(/127\.0\.0\.1:(\d+)/);
          if (m) {
            clearTimeout(timeout);
            ok(Number(m[1]));
          }
        });
        child.on('error', bad);
        child.on('exit', (code) => {
          clearTimeout(timeout);
          bad(new Error('Server exited ' + code));
        });
      });
      const url = `ws://127.0.0.1:${port}/play`;
      function connect(message) {
        const ws = new WebSocket(url, { origin: 'http://test.local' }),
          received = [],
          waiters = [];
        sockets.push(ws);
        ws.on('open', () => ws.send(JSON.stringify(message)));
        ws.on('message', (raw) => {
          const m = JSON.parse(raw);
          received.push(m);
          for (const fn of [...waiters]) fn(m);
        });
        ws.on('error', () => {});
        return {
          ws,
          received,
          wait(predicate) {
            const existing = received.find(predicate);
            if (existing) return Promise.resolve(existing);
            return new Promise((ok, bad) => {
              const timer = setTimeout(
                () => bad(new Error('Expected server message missing')),
                4000,
              );
              const fn = (m) => {
                if (predicate(m)) {
                  clearTimeout(timer);
                  waiters.splice(waiters.indexOf(fn), 1);
                  ok(m);
                }
              };
              waiters.push(fn);
            });
          },
        };
      }
      const tickets = await Promise.all(
        ['alice', 'bob'].map((sub) =>
          issueTicket(secret, {
            sub,
            name: sub,
            guest: true,
            mode: '1v1',
            mapId: 'citadel',
          }),
        ),
      );
      const a = connect({ type: 'join', ticket: tickets[0] });
      const aw = await a.wait((m) => m.type === 'welcome');
      const listed = await (
        await fetch(`http://127.0.0.1:${port}/health`)
      ).json();
      assert.equal(listed.openRooms.length, 1);
      assert.equal(listed.openRooms[0].id, aw.room);
      assert.equal(listed.openRooms[0].players, 1);
      const targetTicket = await issueTicket(secret, {
        sub: 'bob',
        name: 'bob',
        guest: true,
        mode: '1v1',
        mapId: 'citadel',
        roomId: aw.room,
      });
      const b = connect({ type: 'join', ticket: targetTicket });
      const bw = await b.wait((m) => m.type === 'welcome');
      assert.equal(aw.room, bw.room);
      const full = await (
        await fetch(`http://127.0.0.1:${port}/health`)
      ).json();
      assert.equal(full.openRooms.length, 0);
      const lateTicket = await issueTicket(secret, {
        sub: 'late',
        name: 'late',
        guest: true,
        mode: '1v1',
        mapId: 'citadel',
        roomId: aw.room,
      });
      const late = connect({ type: 'join', ticket: lateTicket });
      assert.match(
        (await late.wait((m) => m.type === 'error')).message,
        /no longer available/,
      );
      const bad = connect({ type: 'join', ticket: tickets[0] });
      assert.match(
        (await bad.wait((m) => m.type === 'error')).message,
        /ticket/,
      );
      a.ws.send(JSON.stringify({ type: 'ready' }));
      b.ws.send(JSON.stringify({ type: 'ready' }));
      await a.wait((m) => m.type === 'snapshot' && m.status === 'playing');
      a.ws.send(
        JSON.stringify({
          type: 'input',
          seq: 100,
          yaw: 0,
          pitch: 0,
          controls: { ...idleInput(), forward: 1 },
          x: 99999,
          kills: 50,
        }),
      );
      const state = await a.wait((m) => m.type === 'snapshot' && m.ack === 100);
      assert.ok(Math.abs(state.actors[0].x) < 50);
      assert.equal(state.actors[0].kills, 0);
      await new Promise((ok) => {
        a.ws.once('close', ok);
        a.ws.close();
      });
      const resumed = connect({ type: 'resume', token: aw.resume });
      assert.equal(
        (await resumed.wait((m) => m.type === 'welcome')).room,
        aw.room,
      );
      const snapshot = await resumed.wait((m) => m.type === 'snapshot');
      assert.equal(snapshot.count, 2);
      assert.equal(snapshot.ack, 100);
      resumed.ws.send(JSON.stringify({ type: 'leave' }));
      const ended = await b.wait(
        (m) => m.type === 'snapshot' && m.status === 'finished',
      );
      assert.equal(ended.won, true);
      const health = await (
        await fetch(`http://127.0.0.1:${port}/health`)
      ).json();
      assert.equal(health.payments, false);
      assert.equal(
        (await fetch(`http://127.0.0.1:${port}/metrics`)).status,
        404,
      );
    } finally {
      for (const ws of sockets) ws.terminate();
      child.kill();
    }
  },
);
