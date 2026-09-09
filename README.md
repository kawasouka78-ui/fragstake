# SkillClash

A browser FPS platform with free bot practice, free human FFA and duels, demo accounts, animated cosmetics, friend messaging and progression.

## Run locally

Use Node 22.13 or later.

```sh
npm install
npm run live:setup
npm run dev -- --host 127.0.0.1
# In a second terminal:
npm run live
```

Open http://localhost:3000. The game service runs on port 3010. For a live match, use Human Multiplayer in two browser tabs and enter both matches. FFA allows 2–10 humans; duels require 2 or 4. Live matches have no entry fee or cash prizes. Guests can play; sign in to save XP.

The existing SQLite database must have migrations from `drizzle/` applied. See the architecture document for fresh databases versus this local database’s existing schema.

## Verify

```sh
npm test
npx tsc --noEmit
npm run build
npm run ops:backup
```

[Platform architecture, deployment instructions and remaining work](docs/PLATFORM-FOUNDATION.md) describe the server boundary, signing keys, persistence, moderation, backup scope and worldwide paid-play prerequisites.

This release is local. Regional production hosting, advanced anti-cheat and real deposits/withdrawals are not active. Demo balances never become real money.
