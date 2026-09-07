# SkillClash

A browser FPS prototype with a playable raycast arena, local bots, and device-local demo credits.

## Included

- Free practice against nine bots.
- Beginner (€2), Contender (€5), and Pro (€10) free-for-all scoring.
- 1v1 and 2v2 bot duels, €10 per player, first side to five eliminations.
- Equal payout to each winning teammate, draw refunds, early-leave forfeits.
- Demo wallet, recent results, keyboard/mouse and touch controls.

## Development

Install with npm install. Start with npm run dev. Build with npm run build.
Run scoring checks with node --experimental-strip-types --test tests/game-rules.test.mjs.

## Prototype scope

All matches run locally against bots. Credits have no monetary value. There is no real-player matchmaking, authentication, cash payment processing, withdrawal system, authoritative game server, or anti-cheat service. Do not use the client-side scoring or local storage as a real-money ledger.

Real multiplayer and cash settlement require a separate server-authoritative implementation and payment integration. The 2v2 interpretation is €10 per player, a €40 pot, and €20 returned to each player on the winning team, with no platform fee.

## Validation

Scoring and payout tests are automated. Browser interaction testing was not requested. WebMCP configure_match is optional and feature-detected; no supported WebMCP validation context was available during authoring.

