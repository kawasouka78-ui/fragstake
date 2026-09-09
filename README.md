# SkillClash

A browser FPS demo with shared player accounts, friends, profiles, wallet records and bot-match rankings.

## Arena gameplay

Three.js renders Citadel, a single 64 × 56 m enclosed facility with nine connected rooms, 4 m hallways, two turning service routes, framed doorways, ceilings and differentiated cover. Navigation and shot collision share the rendered layout. Legacy map IDs resolve to Citadel when reopening saved matches.

The rendering pipeline uses original concrete/steel material textures, world-scale UVs, interior lighting, contact occlusion, restrained bloom, and antialiasing. Static scenery is merged by material and spatial tile. Performance mode skips occlusion/bloom and lowers resolution while preserving map geometry and collision. Map collision and visible solid structures share data; geometry/raycast tests run without a browser.

Three original material images were generated with the built-in image generator and encoded as full-size WebP assets under `public/materials/`: `arena-concrete-paving.webp` (worn aggregate paving), `arena-concrete-wall.webp` (fine-pore concrete), and `arena-painted-steel.webp` (scuffed neutral painted steel). Each brief required a flat, evenly lit, full-bleed neutral material without text, objects, baked shadows or large seams, suitable for color tinting and repeating at four-metre scale. Generated edge continuity is approximate.

The fixed-step simulation supports mouse pitch/yaw, aiming down sights, acceleration, normalized movement, sprint stamina, jumping, crouching, eight weapons, magazine/reserve ammo, reloads, recoil, headshots, regeneration, temporary spawn protection and pathfinding bots. Pausing stops simulation and preserves whether the match has started. The first winning duel kill ends simulation immediately.

Controls: WASD move, mouse look, left click fire, right click aim, Shift sprint, Space jump, C crouch, R reload, 1–8 weapons, Tab scoreboard, P/Escape pause. Arrow keys aim and F fires as a keyboard fallback. Touch devices have move/look pads and action buttons. Mouse sensitivity, field of view, sound and graphics settings are device-local preferences. WebGL 2 is required; an unplayed match can be cancelled with a stake refund when graphics are unavailable.

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
- Tests: `node --experimental-strip-types --test tests/*.test.mjs`

The tests use isolated SQLite databases and synthetic users; no test fixtures are published. They cover account initialization, wallet isolation and idempotency, friendship authorization, unique handles, search privacy, match ownership, FFA scoring, duel settlement/refunds/forfeits, and leaderboard filters.

WebMCP match configuration remains feature-detected. No supported WebMCP test context was available. Browser interaction testing is authorized and is being used to verify navigation and saved flows.

## Platform expansion

Native document links replace the failing client navigation. Added Duel configuration (custom 5–100 demo stakes, first to 5/10, best of three, restricted weapons, maps), funded Arena presets with eight-second combat cash-out, eight playable weapons, and owned cosmetic finishes. Saved account features include party invitations, challenge invitations, shop purchases, equipped inventory, private reports, separate demo ratings, and leaderboard metric/time filters. Device settings apply to gameplay. Unfinished demo matches can be reopened without another reservation.

These are functional demo flows, with persisted data and ownership checks. Accepted challenges do not start a shared game or hold funds. Public queues, authoritative human multiplayer, spectating, 3v3, replay recording, anti-cheat enforcement, real deposits/withdrawals, crypto and provider approval are still external production work. The UI states these boundaries. Demo ratings and client-reported results must never settle real funds.

## Citadel and consolidated platform

Play now contains match setup and real-account-created open Duel lobbies; duplicate Duel/Arena pages redirect there. Party management is embedded in Friends. History & Stats includes all-time win rate, headshot kills and best streak plus recent-match activity and mode breakdowns. Removed both lobby announcement banners and all map picker UI.

Citadel is the only playable map. It replaces the three old outdoor layouts with nine connected indoor rooms, turning 4 m passages, collidable ceilings/lintels, doorframes, visible wayfinding and cover. Historical map IDs resolve to the current map for reopening old sessions. Eight first-person weapon models have distinct silhouettes, sight heights, muzzle positions and moving magazine/slide/pump parts.

Open lobbies support create/join/leave/ready/close with capacity and ownership checks, automatic one-hour expiration, and no fabricated listings. Membership is persistent; shared human gameplay and cash settlement are not connected. Bot warm-up launches a separate match with the selected rules. Joining a lobby does not reserve demo funds.
