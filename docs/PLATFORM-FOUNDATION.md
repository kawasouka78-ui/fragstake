# SkillClash platform foundation

Updated 10 September 2026. This release runs locally. Public hosting and real payments have not been activated.

## What is implemented

| Area          | Working foundation                                                                                                                                          | Remaining production work                                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Human matches | Separate Node/WebSocket server, free FFA with 2–10 humans, 1v1 and 2v2, map-specific automatic room selection, ready state, common timer, first-to-10 duels | Regional routing, skill-based matchmaking, party/team queue reservations, spectator mode, custom live lobby rules                                                                               |
| Authority     | Server reuses collision, movement, slide, ammo, recoil and weapon rules; only validated inputs are accepted                                                 | Client prediction/reconciliation, lag compensation, tick fairness/load validation                                                                                                               |
| Reconnection  | Private reconnect token restores a slot for 15 seconds; stale input stops; duel abandonment forfeits                                                        | Durable recovery of active rooms across server crashes, regional failover                                                                                                                       |
| Integrity     | 60-second signed single-use join tickets, origin allowlist, input sequence validation, packet/rate/connection limits, server-owned damage/results           | Aim-assistance detection, collusion detection, sanction revocation of existing sessions, independent security review                                                                            |
| Results       | Signed game-service delivery to D1, durable local outbox retries, conflicting-result detection, duplicate-safe XP, separate human record                    | Season ratings, tournaments, settlement/refund dispute rules                                                                                                                                    |
| Progression   | Levels, XP, daily goals, five achievement milestones, human leaderboard and recent human matches                                                            | Seasonal rewards, unlock inventory, anti-farming checks. Goals currently track milestones, without bonus currency                                                                               |
| Social        | Accepted-friend private messages, retry deduplication, polling updates, blocking/unblocking, friend presence                                                | Party/group chat, party queues, notifications, moderation of chat content, retention policy. Presence currently updates on Friends                                                              |
| Moderation    | Role-protected report review, status transitions and audit trail; sanction table checked on ticket creation and messaging                                   | Moderator assignment, live report/replay interface, restriction/appeal UI, staffed support and operating procedures                                                                             |
| Operations    | Public health, protected metrics/replay endpoints, 5 Hz pose/combat recording, 7-day replay retention, verified local SQLite backup command                 | Off-host encrypted backups, D1 backup policy, restore drills, monitoring/alerts, realistic regional load tests                                                                                  |
| Payments      | Disabled payment endpoints, market/age/identity/exclusion eligibility contract, balanced integer-cent journal validation                                    | Approved markets/provider, actual double-entry storage and escrow, KYC/age/geo verification, deposits, withdrawals, webhook verification, reconciliation, limits and self-exclusion enforcement |

## Boundaries

The Sites application remains a Vinext/React Worker with D1 account persistence. A separate long-running game service owns room state and simulation. Sites is not assumed to support custom Durable Object bindings or a long-lived game loop.

1. The site derives identity from dispatch-owned sign-in headers. Anonymous guests receive random temporary subjects.
2. `/api/live` issues an HMAC-signed ticket binding identity, guest status, mode and map. Its one-minute expiry and nonce are checked by the game server. Tickets travel in the first socket message, not a URL.
3. The game service validates origins, authenticates each connection, chooses a room and accepts movement/aim/button inputs. Browser coordinates, hit claims, kills and money are ignored.
4. A 30 Hz server loop steps each human simulation and broadcasts snapshots. Client rendering interpolates positions; it does not decide damage. FFA starts with two ready players. Duels require all seats ready. No bots fill live rooms.
5. Live Escape menus stop that client’s inputs; the shared arena continues, including damage and respawning. Existing solo bot practice retains its full pause behavior.
6. The service stores completed results in a local SQLite outbox before delivering a timestamped signature to `/api/live/results`. D1 records one immutable result per participant and match. Retries cannot duplicate XP. Guest results never create account progression.
7. Existing demo match settlement remains isolated. Live human entry is free; verified results never change demo balances. No payment endpoint accepts deposits, withdrawals or paid entry.

The first release has interpolation but no local movement prediction or latency compensation. Replays are operational evidence snapshots, not a complete deterministic replay viewer. Active matches are held in memory and do not survive a process crash. These limitations must be resolved or explicitly accepted for a limited free alpha; this is not ready for paid competition.

## Local operation

```sh
npm install
npm run live:setup
npm run dev -- --host 127.0.0.1
# In a second terminal:
npm run live
```

Setup adds only absent multiplayer settings to ignored `.env.local`, with a newly generated secret. Never commit or print that secret. The development Worker receives only the explicit multiplayer bindings; build configuration excludes their local values.

The site runs on port 3000 and the game service on 3010. Open Play → Human Multiplayer in two browser tabs, join the same mode/map and enter both matches. Sign in through the existing site flow for saved XP. `npm test` includes both pure simulation tests and an isolated real WebSocket server test; `npx tsc --noEmit` and `npm run build` validate the site.

New D1 schema is migration `0004_gifted_the_fury.sql`. Fresh databases apply all Drizzle migrations in order. This existing local database had earlier tables without Wrangler migration bookkeeping, so only the new migration was executed directly after inspecting it. Do not replay old CREATE TABLE statements against it. Production migration application remains a separate publishing step.

`npm run ops:backup` creates a consistent, integrity-checked game-service SQLite snapshot under ignored `.wrangler/backups`. It does not back up D1, schedule itself, or move backups off this machine.

## Production configuration and rollout

Deploy the game service separately on persistent infrastructure with WSS/TLS and a durable volume for `.wrangler/game`. Set `LIVE_HOST`, `LIVE_PORT`, `LIVE_REGION`, `LIVE_ALLOWED_ORIGINS`, `LIVE_SITE_URL` and `LIVE_TICKET_SECRET` in its secret/configuration store. Run `node --experimental-strip-types server/game-server.ts` with Node 22.13+ and installed dependencies. The site needs matching secret `LIVE_TICKET_SECRET` and public `LIVE_SERVER_URL`. `MODERATOR_IDS` is an explicit comma-separated allowlist of dispatch user IDs; unset means no moderator access.

`LIVE_ADMIN_SECRET` is a separate operator credential, generated by local setup. If it is absent, operational endpoints are disabled. The public service `/health` reports reachability, room/player counts and region. `/metrics` and `/replay/<room-id>` require the separate `LIVE_ADMIN_SECRET` bearer credential; keep them on an internal management network in production. Never place it in browser code. Monitor tick duration, result delivery failures, outbox backlog, rejected inputs, connection churn and resource use. Load tests must include real render/input traffic at the planned concurrency, rather than treating the small integration test as a capacity guarantee.

Start with a restricted free alpha on one region, then add geographic matchmaking and operational recovery. Public deployment still requires hosting configuration and approval; no default-branch push or publish was performed for this release.

## Worldwide paid-play plan

“Worldwide” is the desired reach, not an eligibility setting. The approved-country list deliberately starts empty. A paid launch requires a country-by-country assessment of this exact entry/kill/death/prize model, business/entity and age requirements, and a provider that explicitly supports the business. Some providers exclude skill games with cash prizes: [Stripe’s restricted-business FAQ](https://support.stripe.com/questions/prohibited-and-restricted-businesses-list-faqs) and [restricted-business policy](https://stripe.com/legal/restricted-businesses). This source does not establish whether SkillClash is lawful in any particular country.

Before activating a market: obtain qualified local advice and any required approvals, provider acceptance, identity/age/location verification, a real ledger and escrow system, withdrawal controls, loss/deposit limits, self-exclusion, chargeback/refund handling, fraud review and reconciled settlement. Keep payment secrets/webhooks separate from the game-service signing key. The current code does not simulate successful real-money transactions or promise cash withdrawals.

## Validation for this release

- 130 tests passed, including isolated D1 persistence tests and a real WebSocket connection/reconnection/forfeit integration test.
- Type checking and the production build passed. Local signing/operator secrets and temporary QA files were absent from the build artifacts.
- Two browser tabs joined the same free FFA round; the common clock, live connection, and Escape/loadout behavior were checked.
- Phone/tablet layout checks found no horizontal page overflow in the new Play/Progression layouts.
- An anonymous browser received the expected moderator-access rejection. Signed-in friend chat and XP persistence were checked with isolated database tests; a multi-account browser chat session was not tested.
- The game-service SQLite backup passed its integrity check. This is not a restore drill or a production load test.
- The ws runtime and its transitive copies were updated to patched 8.21.0. Other framework dependency advisories remain part of the production hardening backlog.
