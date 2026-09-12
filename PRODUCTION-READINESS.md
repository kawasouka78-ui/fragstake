# FragStake launch status

Reviewed 12 September 2026. **Not ready for public real-money play.**

## Completed in this pass

- Cash FFA and duels cannot silently start free local matches when the game server is offline.
- Paid tickets are rejected by the API and client until reservations and payouts exist. Merely connecting a game server cannot turn on money matches.
- Only practice uses the free fallback. No invented starting wallet balance.
- Open matches exclude unavailable cash formats. Cosmetic purchases are unavailable while funding is disconnected; inspection remains available.
- Practice's zero target no longer triggers the duel winner validator when exiting.
- Mode panels use a shared minimum height with room for errors and funding status, instead of hiding overflowing controls.
- Shared forms, dialogs, account panels, shop cards and mobile controls use consistent spacing.
- Sign-in fills its right column; its desktop and phone views were checked. Protected-page visual checks still require a signed-in session.

## Required before accepting funds

1. **Production game service:** connect the independently running authoritative service with `LIVE_SERVER_URL` and the matching `LIVE_TICKET_SECRET`; verify two separate accounts can join, fight, reconnect and leave the same room. The web container does not itself start the game server.
2. **Merchant integration:** the payments endpoint currently declares USDC on Polygon but has no connected provider. Complete provider onboarding for this business, configure credentials in Secret Manager, implement signed and replay-safe deposit notifications, and reconcile transactions against the provider.
3. **Wallet and settlement:** implement durable integer-unit ledger entries, atomic reservation before ticket issuance, insufficient-funds rejection, signed match-result settlement, and exactly-once refunds and payouts. Stakes currently do not reach the match server. Do not enable `paidPlay` by changing a boolean alone.
4. **Revenue and currency rules:** choose the platform fee and specify how USDC balances relate to euro-denominated entry prices before promising pots. Existing pots are gross examples and include no platform commission.
5. **Account eligibility:** connect the already-defined eligibility checks to actual account verification, supported launch markets and account exclusions. A cosmetic onboarding form is not verification.
6. **Withdrawals and operations:** implement withdrawal requests, provider confirmation, reconciliation, alerts, backup recovery, and support handling. Verify the full deposit → reservation → game → settlement → withdrawal cycle in the provider's sandbox before real funds.

## Product work still required

- `lib/firebase-community.ts` returns empty friends, chat, parties, invites and inventory; most writes return 503. Implement these against Firestore with ownership checks and concurrent-write tests. Do not describe these as working multiplayer social features.
- Firebase account balances and transactions currently return zeros/empty arrays, rather than a monetary ledger. Wallet UI must use the ledger once implemented.
- Verify match-history delivery to Firestore, duplicate-result handling, ranking consistency and anonymous-player visibility using two authenticated accounts against the deployed game service.
- Finish authenticated desktop/mobile checks of play, shop, settings, profile, social, leaderboard and history. Verify keyboard operation, failure states and long content without clipping.

## Validation

Automated suite: `npm test`. Static checks: `npx tsc --noEmit`. Production build: `npm run build`.

`npm run release:check` probes the deployed public service. It exits unsuccessfully when game hosting or payments are not connected. A passing probe is necessary but does not substitute for the end-to-end money and multiplayer checks above.

Deployment remains the user's existing GitHub → Cloud Run pipeline. No Sites hosting migration is part of this work.
