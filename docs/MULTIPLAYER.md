# Shared matches

Practice, FFA, 1v1 and 2v2 enter the WebSocket service through `/api/live`.
Practice fills vacant places with server-controlled opponents, replacing them when
people join. FFA and duels use real participants. Neither entry path silently
starts a browser-only match. Practice remains open while humans participate;
empty practice rooms release their resources. Public counts exclude AI players.

## Local

Run `npm run live:setup` once if `.env.local` is missing, then run `npm run dev`
and `npm run live` in separate terminals. Open `/play` in two separate browser
profiles/accounts. Select Practice on each to share the current practice arena.
For duels select the same format and map, then ready both players. The room list
also allows joining a specific existing match.

## Hosted service

The website's `Dockerfile` does not run the game service. `Dockerfile.game` is a
separate container entrypoint for it, listening on the platform's `PORT` and
`0.0.0.0`. Configure:

- `LIVE_TICKET_SECRET`: the same secret of at least 32 characters on the game and web services.
- `LIVE_ADMIN_SECRET`: a different secret of at least 32 characters, game service only.
- `LIVE_SITE_URL`: the HTTPS website origin.
- `LIVE_ALLOWED_ORIGINS`: comma-separated exact HTTPS origins that may connect, including every web domain in use.
- `LIVE_REGION`: the deployed region name.
- `LIVE_SERVER_URL`: on the website, `wss://<game-service-host>/play`.

Verify the game service `/health`, then the website `/api/live`; the latter must
report `online: true`. Keep these secrets out of the client and Git.

Rooms are held in one process. This implementation needs a single game-service
instance; running independent replicas splits matchmaking. A room directory and
explicit room routing are required before scaling to multiple instances. A
restart disconnects active rooms. The SQLite result outbox requires durable
storage before depending on it for match history; an ephemeral container disk
is insufficient. Practice does not submit ranked results or payment settlement.
Real-money settlement is not enabled by this multiplayer change.

## Verification

`tests/live-server.test.mjs` connects actual WebSocket clients to a fresh server
and verifies shared duels, reconnects, rematches, and shared practice with bots.
`tests/live-practice.test.mjs` verifies slot replacement, shared human/bot damage,
replicated movement, and endless practice. Bot tests enforce reaction delays,
line of sight, reload/fire-rate limits, movement, and stronger Pro tracking.
