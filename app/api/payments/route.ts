export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json(
    {
      enabled: false,
      currency: 'EUR',
      approvedCountries: [],
      reason:
        'Real-money play is awaiting market and payment-provider approval. Your existing balance is demo credits.',
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
