# FragStake

A browser FPS platform with a public landing page, free human FFA and duels, saved player accounts, cosmetic finishes and friend messaging. Bot entry, mock account fallbacks and demo money are disabled.

## Run locally

Use Node 22.13 or later.

```sh
npm install
npm run live:setup
npm run dev -- --host 127.0.0.1
# In a second terminal:
npm run live
```

Open http://localhost:3000. The game service runs on port 3010. For a live match, open /play in two browser tabs and select the same format and map, join, and ready up in both matches. FFA allows 2–10 humans; duels require 2 or 4. Live matches have no entry fee or cash prizes. Guests can play; sign in to save XP.

The existing SQLite database must have migrations from `drizzle/` applied. See the architecture document for fresh databases versus this local database’s existing schema.

## Verify

```sh
npm test
npx tsc --noEmit
npm run build
npm run ops:backup
```

[Platform architecture, deployment instructions and remaining work](docs/PLATFORM-FOUNDATION.md) describe the server boundary, signing keys, persistence, moderation, backup scope and worldwide paid-play prerequisites.

See the [current production readiness report](docs/PRODUCTION-READINESS.md) for verified fixes and outstanding release blockers.

This release is local. Regional production hosting, advanced anti-cheat and real deposits/withdrawals are not active. Legacy demo balances are not exposed or converted into real money. Crypto funding remains unavailable until the provider, network, eligibility and withdrawal integrations are configured.

## Firebase

Firebase config files are included for Hosting, Firestore indexes/rules and Storage rules. Read [Firebase setup](docs/FIREBASE.md) before deploying: the web shell can go to Firebase, but the live FPS WebSocket server still needs separate always-on hosting and real wallet settlement must stay server-side.
