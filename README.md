# SkillClash

A browser FPS demo with shared player accounts, friends, profiles, wallet records and bot-match rankings.

## Available pages

- `/`: playable practice, FFA and duel bot arena.
- `/wallet`: persistent demo balance, transaction filters, idempotent demo top-ups and unfinished-match recovery.
- `/friends`: player search, incoming/outgoing requests, acceptance, decline, cancellation, removal and profile viewing.
- `/leaderboard`: recorded bot-match rankings, game mode, seven-day and friends filters, pagination.
- `/history`: recent matches, results, filters and round details.
- `/profile`: unique player handle, display name, bio, avatar color and saved stats.

## Identity and data

Sites supplies authenticated user identity through trusted dispatcher headers. All account API operations require identity. Private-site access still controls who can visit. Friends must have access to this Site and open it to create an account before they can be found. No emails are exposed through player search or rankings.

D1 stores players, friendships, match sessions and ledger entries. Prepared statements and transactional batches guard ownership and avoid duplicate settlement. The initial saved account starts with €100 in demo credits; device-local prototype balances are not imported as authoritative records.

## Prototype boundaries

Matches still run against local bots. Credits have no cash value. Payments, withdrawals, real-player matchmaking and anti-cheat are not implemented. The leaderboard explicitly labels bot results as client-reported and unverified. Do not use these client results for real-money settlement or verified competitive rankings.

## Development

- Install: `npm install`
- Generate migrations after changing `db/schema.ts`: `npx drizzle-kit generate`
- Apply a new migration locally: `npx wrangler d1 execute DB --local --config wrangler.local.json --file drizzle/<migration>.sql`
- Run: `npm run dev`
- Build: `npm run build`
- Type check: `npx tsc --noEmit`
- Tests: `node --experimental-strip-types --test tests/accounts.test.mjs tests/game-rules.test.mjs`

The tests use isolated SQLite databases and synthetic users; no test fixtures are published. They cover account initialization, wallet isolation and idempotency, friendship authorization, unique handles, search privacy, match ownership, FFA scoring, duel settlement/refunds/forfeits, and leaderboard filters.

WebMCP match configuration remains feature-detected. No supported WebMCP test context was available. Browser interaction testing was not requested.
