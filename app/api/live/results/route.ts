import { env } from 'cloudflare:workers';
import { database } from '@/db';
import { recordLiveResult } from '@/db/live';
import { verifySignature } from '@/lib/live/security';
import { InputError } from '@/lib/account-rules';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const stamp = request.headers.get('X-Game-Timestamp') || '',
      sig = request.headers.get('X-Game-Signature') || '';
    if (
      !env.LIVE_TICKET_SECRET ||
      !/^\d{13}$/.test(stamp) ||
      Math.abs(Date.now() - Number(stamp)) > 60000
    )
      return new Response('Unauthorized', { status: 401 });
    const raw = await request.text();
    if (raw.length > 16000) return new Response('Too large', { status: 413 });
    if (
      !(await verifySignature(
        env.LIVE_TICKET_SECRET,
        'result',
        stamp + '\n' + raw,
        sig,
      ))
    )
      return new Response('Unauthorized', { status: 401 });
    return Response.json(await recordLiveResult(database(), JSON.parse(raw)), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof InputError
            ? e.message
            : 'Result not recorded. Retry delivery.',
      },
      { status: e instanceof InputError ? e.status : 503 },
    );
  }
}
