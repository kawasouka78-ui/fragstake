# SkillClash

A browser FPS demo with shared player accounts, friends, profiles, wallet records and bot-match rankings.

## Arena gameplay

Three.js renders three selectable 3D arenas: Foundry, Relay and Drydock. Each has connected flanking routes, low and tall cover, marked health/ammo stations and safe-spawn selection. Map choice is stored with each match; existing matches default to Foundry.

Each arena now occupies 80 × 64 metres (5,120 m², versus the original 1,920 m²). Expanded layouts contain 42–55 solid cover volumes and nine pickup stations. Maps include sector buildings, loading courts, side alleys, covered service bays and overhead industrial structures. Foundry has furnace silos, Relay a communications campus and mountains, and Drydock reflective water, cargo ships and gantry cranes.

The rendering pipeline uses original concrete/steel material textures, world-scale UVs, physically lit sky/environment reflections, contact occlusion, restrained bloom, and antialiasing. Static scenery is merged by material and spatial tile. Performance mode skips occlusion/bloom and lowers resolution while preserving map geometry and collision. Map collision and visible solid structures share data; geometry/raycast tests run without a browser.

Three original material images were generated with the built-in image generator and encoded as full-size WebP assets under `public/materials/`: `arena-concrete-paving.webp` (worn aggregate paving), `arena-concrete-wall.webp` (fine-pore concrete), and `arena-painted-steel.webp` (scuffed neutral painted steel). Each brief required a flat, evenly lit, full-bleed neutral material without text, objects, baked shadows or large seams, suitable for color tinting and repeating at four-metre scale. Generated edge continuity is approximate.

The fixed-step simulation supports mouse pitch/yaw, aiming down sights, acceleration, normalized movement, sprint stamina, jumping, crouching, three weapons, magazine/reserve ammo, reloads, recoil, headshots, regeneration, temporary spawn protection and pathfinding bots. Pausing stops simulation and preserves whether the match has started. The first winning duel kill ends simulation immediately.

Controls: WASD move, mouse look, left click fire, right click aim, Shift sprint, Space jump, C crouch, R reload, 1/2/3 weapons, Tab scoreboard, P/Escape pause. Arrow keys aim and F fires as a keyboard fallback. Touch devices have move/look pads and action buttons. Mouse sensitivity, field of view, sound and graphics settings are device-local preferences. WebGL 2 is required; an unplayed match can be cancelled with a stake refund when graphics are unavailable.

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

WebMCP match configuration remains feature-detected. No supported WebMCP test context was available. Browser interaction testing was not requested.
