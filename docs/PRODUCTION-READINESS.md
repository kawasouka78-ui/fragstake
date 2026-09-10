# FragStake production readiness

Checked 10 September 2026. Release decision: **not ready for public paid competition**.

## Player-only launch experience

The root is now a public landing page. `/play` only creates real-player connections; there is no bot or demo entry UI. Wallet top-ups, client-reported demo settlement, legacy stake lobbies/challenges and cosmetic purchases are rejected by the account API. Mock fallback accounts and local mock transactions have been removed. Existing legacy data is preserved but not displayed as money or live results. New launch accounts receive no welcome credits.

History and public rankings now read only server-recorded live match results. Anonymous account pages show sign-in prompts. Gun finishes remain free to equip for authenticated users; new knife purchases are unavailable. The wallet issues no crypto address, balance or transaction until a real funding integration exists.

Added game rules and a transparent data-handling page. These are not complete legal launch documents: operator identity, contact information and final policies remain required. The selected funding design is native USDC on Polygon, with CryptoProcessing by CoinsPaid as the preferred provider for merchant onboarding. Approval, custody terms and business details remain outstanding. See [the crypto launch decision](CRYPTO-LAUNCH.md).

Validation: 176 tests, type checks and build pass. Two browser guests joined the same duel, spawned into the shared round and exercised Escape/forfeit; the opponent received a correct win and server score. Nine routes passed mobile overflow checks. Eleven information/account routes showed no demo-money/mock-player text. Signed-in end-to-end account testing and actual payments remain unverified.

## Fixes in this pass

- Updated React, React DOM and RSC to 19.2.8, Vinext to beta.9, Vite to 8.3.0 and its RSC plugin to 0.5.34. Patched transitive Undici and the Vite/Wrangler esbuild dependencies. The runtime dependency audit reports zero known vulnerabilities; this is not a security certification.
- Production game-service startup now requires explicit HTTPS origins, a region, valid port, signing secret and a separate operator secret. Set `NODE_ENV=production` to activate these checks. TLS termination and persistent infrastructure still need deployment configuration.
- Result delivery uses persisted retry attempts and exponential backoff, capped at five minutes. A failed result no longer stops the rest of a batch or permanently occupies the first ten queue positions. Acknowledged results are not resent. Existing outbox tables are migrated additively on startup.
- Connection tracking removes inactive IP entries to avoid growth across disconnected clients.
- Leaving a waiting duel is cancellation. Incomplete live results no longer fabricate a defeat or a final score. Pre-join text no longer claims an opponent has been found or that a whole party has been queued.

## Evidence and limits

All 176 automated tests pass, covering simulation, legacy account logic, launch account separation, maps, weapons, matchmaking, real WebSocket joins/reconnects/forfeits/rematches, production configuration and result retries. Type checking and the production build pass.

Browser checks confirmed live guest joining, the waiting roster, loadout menu and leaving. Social, leaderboard, history, wallet, shop, inventory, settings, support and profile rendered without error overlays or horizontal overflow at the desktop viewport. These checks do not establish that every possible interaction works. Mock account flows are now removed.

Play, Social, leaderboard, history, wallet, shop, settings and support also passed the horizontal-overflow check at 390 × 844. The shop inspection and equip flow worked; the previous Plasma Flow finish was restored after testing.

## Remaining release blockers

- Production game hosting, HTTPS/WSS, routing, persistent storage and matching hosted environment settings are not connected or verified.
- Real deposits, withdrawals and paid matches remain disabled. Provider integration, verified eligibility, real ledger/escrow, settlement, refunds and reconciliation are incomplete.
- Active rooms do not recover after a server crash. Monitoring, off-host backups, restore drills, failover and realistic capacity tests remain outstanding.
- Automatic party seat reservations and advanced anti-cheat/latency fairness remain incomplete.
- The full lint check fails on existing application and bundled component issues; no rules were disabled to conceal them.
- The full dependency audit still reports development-tool findings in the Drizzle tooling and Cloudflare image-processing toolchain. The runtime-only audit is clear.
- Large client bundle warnings remain. Device performance and accessibility need a broader release test.
- Signed-in multi-account social flows and real hosted identity have not been end-to-end verified in this pass.

Do not treat local mock data, a successful build, or this audit as authorization to enable paid entry. No production deployment was performed.
