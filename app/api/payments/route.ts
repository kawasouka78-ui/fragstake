export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json(
    {
      enabled: false,
      currency: 'USDC',
      fundingMethod: 'crypto',
      network: 'polygon',
      provider: null,
      plannedProvider: 'CryptoProcessing by CoinsPaid',
      integrationStatus: 'awaiting_merchant_onboarding',
      approvedCountries: [],
      reason:
        'Crypto funding is not connected. Deposits, withdrawals and paid matches are unavailable.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
export function POST() {
  return Response.json(
    { error: 'Deposits, withdrawals and paid entry are not enabled.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
