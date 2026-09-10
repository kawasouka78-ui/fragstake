# FragStake crypto funding decision

Selected 10 September 2026. This is an integration plan, not an active payment service.

- Brand: FragStake. Registered operator identity and support email have not been supplied.
- Funding asset: native USDC on Polygon. Confirm the exact native asset in the merchant account before accepting funds; do not accept bridged USDC.e as an equivalent.
- Preferred provider for onboarding: CryptoProcessing by CoinsPaid. Its site offers iGaming processing and KYB onboarding; its payment-request documentation lists USDC on Polygon. Merchant acceptance, applicable contracting entity, custody, payout availability, fees and launch territories must be confirmed for FragStake's specific paid FPS competition model.
- NOWPayments is excluded from this plan: its terms dated 31 August 2026, section 15.1, exclude EU residents/citizens among other territories. A worldwide rollout is not an approved launch configuration.
- Preserve EUR match pricing as requested. USDC is not EUR. A future implementation must use a time-limited provider quote and disclose the exact USDC amount, EUR credit, fees and expiry before payment. Never relabel existing demo credits as real funds.

## Implementation contract

1. Authenticated, eligible player requests a quote. The server creates an immutable funding order with its own unique ID, player ID, EUR cents, asset/network, quote and expiry. No client-supplied balance or settlement values are trusted.
2. Provider-hosted checkout is issued only after merchant approval and credential setup. The browser return page is informational and never credits funds.
3. Authenticated provider notifications are persisted and independently reconciled with provider records. Validate order ownership, currency, network and actual amount; duplicate or out-of-order notifications cannot credit twice. Underpayment, overpayment, expiry, refunds and chain reversals require explicit states.
4. A separate double-entry real-money ledger records funding, reservations, match settlement, refunds and withdrawals atomically. Keep integer EUR cents and token base units separate. Do not reuse the legacy demo balance column.
5. Paid entry reserves funds atomically before matchmaking. Only verified server results release reservations and settle matches once. Disconnect, cancellation and server failure policies must be implemented and tested before enabling stakes.
6. Withdrawals reserve funds first, pass eligibility and risk checks, and require confirmed asset/network/address and a disclosed quote. Persist a unique payout intent before submitting; reconcile uncertain responses before retries to prevent duplicate payouts. Never store private keys in browser code.
7. Reconcile the ledger against provider balances and transfers, alert on discrepancies and test backup restoration. Live payments stay disabled until deposit, refund, withdrawal, duplicate-event, timeout and recovery tests pass in the approved integration environment.

## External requirements

Registered operator details, a working support address, accepted merchant account, server-side credentials, approved countries and legal policies, and production HTTPS/WSS hosting are still required. No accounts were registered, terms accepted or funds moved by this task. No provider integration or custody claim is implied by selecting a candidate.

## Sources checked

- [CryptoProcessing services and onboarding](https://cryptoprocessing.com/)
- [Provider payment request documentation](https://coinspaid.mintlify.app/integration-guide/payment-requests/create-a-payment-request)
- [Polygon USDC integration](https://docs.polygon.technology/payment-services/stablecoins/usdc-gateway-integration)
- [NOWPayments current terms](https://nowpayments.io/doc/fd-tos.pdf?v=1.4.2)
