# FragStake Firebase setup

This project is now prepared for Firebase Hosting, Firestore and Storage.

## What Firebase should own

- Auth: player sign-in, anonymous display mode, profile ownership.
- Firestore: players, social graph, messages, open duel lobbies, match summaries, inventory and read-only wallet views.
- Storage: profile pictures, public shop art and private match evidence uploads.
- Hosting: public entry point and CDN, rewriting app requests to a server service.

The current app is not a plain static `index.html` build. Firebase Hosting should front a server service such as Cloud Run for the web app. The real-time FPS server should remain a separate WebSocket service. Firebase Hosting is not the right place for a permanent 30 Hz game loop. Use Cloud Run, a VM, or another always-on game host, then set `LIVE_SERVER_URL` in the web service environment.

## First Firebase project

Create or use the Firebase project `fragstake-b8eee`. The local `.firebaserc` already points at that project.

Enable these products in the Firebase console:

- Authentication
- Cloud Firestore
- Cloud Storage
- Hosting

For crypto deposits and withdrawals, keep wallet settlement server-side. Never let the browser write balances, inventory purchases, match payouts or withdrawal status directly.

## Local commands

Install the Firebase CLI if it is not installed:

```sh
npm install -g firebase-tools
```

Log in and select the project:

```sh
firebase login
firebase use --add
```

Build the app:

```sh
npm run build
```

Deploy rules, indexes, storage rules and hosting config:

```sh
firebase deploy
```

The default Hosting site is `https://fragstake-b8eee.web.app`. The current `firebase.json` expects a Cloud Run service named `fragstake-web` in `europe-west1`. Change the service name or region before deploying if you choose different names.

## Environment values

Add the public web app config from Firebase project settings to your deployed environment:

```sh
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Production live-game settings still need to be configured separately:

```sh
LIVE_SERVER_URL=
LIVE_TICKET_SECRET=
LIVE_ALLOWED_ORIGINS=
LIVE_SITE_URL=
LIVE_REGION=
```

The shared config helper is [lib/firebase-config.ts](../lib/firebase-config.ts). It only validates environment values right now, so the current build does not need the Firebase SDK until the API routes are migrated.

## Firestore collections

| Collection | Purpose | Browser writes |
| --- | --- | --- |
| `players/{uid}` | Profile, handle, avatar path, visibility preference and safe public stats | Own profile only |
| `wallets/{uid}` | Current available/locked wallet state | No |
| `ledgerEntries/{id}` | Deposit, withdrawal, entry, payout and refund records | No |
| `inventory/{id}` | Purchased and equipped cosmetics | No |
| `matches/{id}` | Completed match summaries and leaderboard source | No |
| `duelLobbies/{id}` | Player-created duel lobbies | Owner can create/close |
| `friends/{id}` | Friend requests and accepted friendships | Participants only |
| `messages/{id}` | Friend messages | Sender can create |
| `reports/{id}` | Player reports | Reporter can create |

## Production checklist

- Add Firebase web config environment values.
- Deploy Firestore and Storage rules before opening signups.
- Move account, wallet, inventory and social API routes from SQLite/D1 to server-side Firebase Admin code.
- Host the WebSocket game server outside Hosting and point `LIVE_SERVER_URL` to it.
- Keep crypto private keys, webhook secrets and withdrawal signing keys out of browser code.
- Add a real ledger with escrow and reconciliation before paid matches go live.
