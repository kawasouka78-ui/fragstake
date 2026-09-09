import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const source = resolve('.wrangler/game/service.sqlite');
if (!existsSync(source))
  throw new Error('Start the game service before backing it up.');
mkdirSync('.wrangler/backups', { recursive: true });
const target = resolve(
  '.wrangler/backups/game-' +
    new Date().toISOString().replaceAll(':', '-') +
    '.sqlite',
);
const db = new DatabaseSync(source);
db.prepare('VACUUM INTO ?').run(target);
db.close();
const check = new DatabaseSync(target, { readOnly: true });
const result = check.prepare('PRAGMA integrity_check').get();
check.close();
if (result.integrity_check !== 'ok')
  throw new Error('Backup verification failed.');
console.log('Verified game-service backup: ' + target);
