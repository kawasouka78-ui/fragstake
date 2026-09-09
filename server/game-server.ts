import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { WebSocketServer, WebSocket } from 'ws';
import { LiveRoom } from '../lib/live/world.ts';
import { readTicket, signature } from '../lib/live/security.ts';
import { RECONNECT_MS } from '../lib/live/protocol.ts';
import { openRooms, findRoom } from '../lib/live/matchmaking.ts';

const secret = process.env.LIVE_TICKET_SECRET || '';
if (secret.length < 32)
  throw new Error('Run npm run live:setup, then npm run live.');
const port = Number(process.env.LIVE_PORT || 3010),
  host = process.env.LIVE_HOST || '127.0.0.1';
const origins = new Set(
  (
    process.env.LIVE_ALLOWED_ORIGINS ||
    'http://localhost:3000,http://127.0.0.1:3000'
  ).split(','),
);
const site = process.env.LIVE_SITE_URL || 'http://localhost:3000';
mkdirSync('.wrangler/game', { recursive: true });
const storage = new DatabaseSync('.wrangler/game/service.sqlite');
storage.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,body TEXT NOT NULL,delivered INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS replay(room TEXT,tick INTEGER,body TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(room,tick));`);
const rooms = new Map<string, LiveRoom>(),
  used = new Map<string, number>();
type Session = {
  room: LiveRoom;
  subject: string;
  resume: string;
  socket: WebSocket | null;
  disconnectedAt: number;
};
const sessions = new Map<string, Session>();
let invalidInputs = 0,
  connections = 0,
  deliveryErrors = 0,
  ticks = 0,
  maxTickMs = 0;
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(
      JSON.stringify({
        status: 'ok',
        region: process.env.LIVE_REGION || 'local',
        rooms: rooms.size,
        players: [...sessions.values()].filter((s) => s.socket).length,
        tickRate: 30,
        payments: false,
        openRooms: openRooms(rooms.values()),
      }),
    );
    return;
  }
  // Operational details and replay data are never public or browser-authenticated.
  if (
    !process.env.LIVE_ADMIN_SECRET ||
    process.env.LIVE_ADMIN_SECRET.length < 32 ||
    req.headers.authorization !== 'Bearer ' + process.env.LIVE_ADMIN_SECRET
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        invalidInputs,
        connections,
        deliveryErrors,
        ticks,
        maxTickMs,
        outbox: storage
          .prepare('SELECT COUNT(*) AS n FROM outbox WHERE delivered=0')
          .get(),
      }),
    );
    return;
  }
  if (req.url?.startsWith('/replay/')) {
    const id = req.url.slice(8);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(
      JSON.stringify(
        storage
          .prepare('SELECT tick,body FROM replay WHERE room=? ORDER BY tick')
          .all(id),
      ),
    );
    return;
  }
  res.writeHead(404);
  res.end();
});
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 4096,
  perMessageDeflate: false,
});
const peers = new Map<string, number>();
server.on('upgrade', (req, socket, head) => {
  const ip = req.socket.remoteAddress || '';
  if (
    req.url !== '/play' ||
    !origins.has(req.headers.origin || '') ||
    (peers.get(ip) || 0) >= 20 ||
    wss.clients.size >= 200
  ) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    peers.set(ip, (peers.get(ip) || 0) + 1);
    ws.once('close', () =>
      peers.set(ip, Math.max(0, (peers.get(ip) || 1) - 1)),
    );
    wss.emit('connection', ws);
  });
});
const send = (ws: WebSocket, data: unknown) => {
  if (ws.readyState === WebSocket.OPEN) {
    if (ws.bufferedAmount > 512000) {
      ws.close(1013, 'Connection too slow');
      return;
    }
    ws.send(JSON.stringify(data));
  }
};
wss.on('connection', (ws: WebSocket) => {
  connections++;
  let session: Session | undefined,
    authenticating = false,
    count = 0,
    windowAt = Date.now(),
    alive = true;
  const timeout = setTimeout(() => {
    if (!session) ws.close(4001, 'Join ticket required');
  }, 5000);
  const ping = setInterval(() => {
    if (!alive) {
      ws.terminate();
      return;
    }
    alive = false;
    ws.ping();
  }, 10000);
  ws.on('pong', () => (alive = true));
  ws.on('message', async (raw) => {
    if (Date.now() - windowAt > 1000) {
      count = 0;
      windowAt = Date.now();
    }
    if (++count > 90) {
      invalidInputs++;
      ws.close(4008, 'Input rate exceeded');
      return;
    }
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.close(4002, 'Invalid message');
      return;
    }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
      ws.close(4002, 'Invalid message');
      return;
    }
    if (!session) {
      if (authenticating) return;
      authenticating = true;
      try {
        if (msg.type === 'resume' && typeof msg.token === 'string') {
          const old = sessions.get(msg.token);
          if (
            !old ||
            old.socket ||
            Date.now() - old.disconnectedAt > RECONNECT_MS ||
            old.room.status === 'finished' ||
            old.room.players.get(old.subject)?.left
          )
            throw new Error('Reconnect window expired.');
          session = old;
        } else {
          const claims = await readTicket(secret, msg.ticket);
          if (!claims || used.has(claims.nonce))
            throw new Error('Join ticket expired. Try joining again.');
          if (
            [...sessions.values()].some(
              (s) =>
                s.subject === claims.sub &&
                s.room.status !== 'finished' &&
                !s.room.players.get(s.subject)?.left,
            )
          )
            throw new Error('You already have a live match.');
          used.set(claims.nonce, claims.exp);
          let room = findRoom(rooms.values(), claims);
          if (!room) {
            if (rooms.size >= 24)
              throw new Error('All servers are busy. Try again soon.');
            room = new LiveRoom(claims.mode, claims.mapId);
            rooms.set(room.id, room);
          }
          room.add(claims);
          session = {
            room,
            subject: claims.sub,
            resume: crypto.randomUUID(),
            socket: null,
            disconnectedAt: 0,
          };
          sessions.set(session.resume, session);
        }
        if (ws.readyState !== WebSocket.OPEN) {
          session.disconnectedAt = Date.now();
          session.room.players.get(session.subject)!.connected = false;
          return;
        }
        session.socket = ws;
        session.room.players.get(session.subject)!.connected = true;
        clearTimeout(timeout);
        send(ws, {
          type: 'welcome',
          resume: session.resume,
          room: session.room.id,
        });
        send(ws, session.room.snapshot(session.subject));
      } catch (e) {
        send(ws, { type: 'error', message: (e as Error).message });
        ws.close(4001, 'Unable to join');
      }
      return;
    }
    if (msg.type === 'input') {
      if (!session.room.input(session.subject, msg)) invalidInputs++;
    } else if (msg.type === 'ready') session.room.ready(session.subject);
    else if (msg.type === 'leave') {
      session.room.leave(session.subject);
      send(ws, { type: 'left' });
      ws.close(1000, 'Left match');
    } else if (msg.type === 'ping') send(ws, { type: 'pong', sent: msg.sent });
  });
  ws.on('error', () => {});
  ws.on('close', () => {
    clearTimeout(timeout);
    clearInterval(ping);
    if (session && session.socket === ws) {
      session.socket = null;
      session.disconnectedAt = Date.now();
      const p = session.room.players.get(session.subject)!;
      p.connected = false;
      p.disconnectedAt = Date.now();
    }
  });
});
const timer = setInterval(() => {
  const start = performance.now();
  ticks++;
  for (const [nonce, expires] of used)
    if (expires < Date.now()) used.delete(nonce);
  for (const [key, s] of sessions) {
    if (!s.socket && Date.now() - s.disconnectedAt > RECONNECT_MS) {
      s.room.leave(s.subject);
      sessions.delete(key);
    }
  }
  for (const [id, room] of rooms) {
    if (room.status === 'waiting' && Date.now() - room.created > 300000)
      room.finish();
    room.step();
    for (const s of sessions.values())
      if (s.room === room && s.socket) send(s.socket, room.snapshot(s.subject));
    if (room.tick % 6 === 0 && room.status === 'playing')
      storage
        .prepare(
          'INSERT OR IGNORE INTO replay(room,tick,body,created) VALUES(?,?,?,?)',
        )
        .run(
          id,
          room.tick,
          JSON.stringify({
            players: [...room.players.values()].map((p) => ({
              id: p.claims.sub,
              actor: p.game.player,
            })),
            events: room.events.splice(0),
          }),
          Date.now(),
        );
    if (room.status === 'finished') {
      const result = room.result();
      storage
        .prepare('INSERT OR IGNORE INTO outbox(id,body) VALUES(?,?)')
        .run(id, JSON.stringify(result));
      for (const [key, s] of sessions)
        if (s.room === room) {
          s.socket?.close(1000, 'Match complete');
          sessions.delete(key);
        }
      rooms.delete(id);
    }
  }
  maxTickMs = Math.max(maxTickMs, performance.now() - start);
}, 1000 / 30);
let delivering = false;
const delivery = setInterval(async () => {
  if (delivering) return;
  delivering = true;
  try {
    for (const row of storage
      .prepare('SELECT id,body FROM outbox WHERE delivered=0 LIMIT 10')
      .all() as { id: string; body: string }[]) {
      const stamp = String(Date.now()),
        sig = await signature(secret, 'result', stamp + '\n' + row.body);
      const response = await fetch(site + '/api/live/results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Game-Timestamp': stamp,
          'X-Game-Signature': sig,
        },
        body: row.body,
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        deliveryErrors++;
        continue;
      }
      storage.prepare('UPDATE outbox SET delivered=1 WHERE id=?').run(row.id);
    }
    storage
      .prepare('DELETE FROM replay WHERE created<?')
      .run(Date.now() - 7 * 86400000);
  } catch {
    deliveryErrors++;
  } finally {
    delivering = false;
  }
}, 5000);
server.listen(port, host, () =>
  console.log(
    `SkillClash game service listening on ${host}:${(server.address() as { port: number }).port}. Free human matches; 30 ticks/s.`,
  ),
);
function shutdown() {
  clearInterval(timer);
  clearInterval(delivery);
  for (const ws of wss.clients) ws.close(1012, 'Server restarting');
  server.close();
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
