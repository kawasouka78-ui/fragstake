import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const file = '.env.local';
let content = existsSync(file) ? readFileSync(file, 'utf8') : '';
for (const [name, value] of Object.entries({
  LIVE_TICKET_SECRET: randomBytes(32).toString('hex'),
  LIVE_ADMIN_SECRET: randomBytes(32).toString('hex'),
  LIVE_SERVER_URL: 'ws://localhost:3010/play',
  LIVE_SITE_URL: 'http://localhost:3000',
  LIVE_ALLOWED_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000',
}))
  if (!new RegExp('^' + name + '=', 'm').test(content))
    content += '\n' + name + '=' + value + '\n';
writeFileSync(file, content, { mode: 0o600 });
console.log(
  'Local multiplayer configured. Restart the site preview, then run npm run live.',
);
