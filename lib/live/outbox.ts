import type { DatabaseSync } from 'node:sqlite';
import { signature } from './security.ts';

export function initializeOutbox(storage: DatabaseSync) {
  const columns = storage.prepare('PRAGMA table_info(outbox)').all();
  if (!columns.some(column => column.name === 'attempts'))
    storage.exec('ALTER TABLE outbox ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0');
  if (!columns.some(column => column.name === 'next_attempt'))
    storage.exec('ALTER TABLE outbox ADD COLUMN next_attempt INTEGER NOT NULL DEFAULT 0');
  storage.exec('CREATE INDEX IF NOT EXISTS outbox_due ON outbox(delivered,next_attempt)');
}

export async function deliverResults(storage: DatabaseSync, site: string, secret: string, request: typeof fetch = fetch, now = Date.now()) {
  let errors = 0;
  const rows = storage.prepare('SELECT id,body,attempts FROM outbox WHERE delivered=0 AND next_attempt<=? ORDER BY next_attempt,rowid LIMIT 10').all(now) as {id:string;body:string;attempts:number}[];
  for (const row of rows) {
    try {
      const stamp = String(Date.now());
      const sig = await signature(secret, 'result', stamp + '\n' + row.body);
      const response = await request(new URL('/api/live/results', site), {
        method: 'POST',
        headers: {'Content-Type':'application/json','X-Game-Timestamp':stamp,'X-Game-Signature':sig},
        body: row.body,
        signal: AbortSignal.timeout(5000),
      });
      // Release the response connection even when the endpoint rejects a result.
      await response.body?.cancel();
      if (!response.ok) throw new Error('Result delivery rejected');
      storage.prepare('UPDATE outbox SET delivered=1 WHERE id=?').run(row.id);
    } catch {
      errors++;
      const delay = Math.min(300000, 5000 * 2 ** Math.min(row.attempts, 6));
      storage.prepare('UPDATE outbox SET attempts=attempts+1,next_attempt=? WHERE id=?').run(now + delay, row.id);
    }
  }
  return errors;
}
