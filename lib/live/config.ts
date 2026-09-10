export function liveConfig(env: Record<string, string | undefined>) {
  const production = env.NODE_ENV === 'production';
  const secret = env.LIVE_TICKET_SECRET || '';
  if (secret.length < 32) throw new Error('LIVE_TICKET_SECRET must contain at least 32 characters. For local setup, run npm run live:setup.');
  const port = Number(env.LIVE_PORT ?? 3010);
  if (!Number.isInteger(port) || port < 0 || port > 65535 || (production && port === 0))
    throw new Error('LIVE_PORT must be a valid listening port.');
  const site = new URL(env.LIVE_SITE_URL || 'http://localhost:3000');
  const origins = new Set((env.LIVE_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(value => value.trim()).filter(Boolean));
  const validOrigin = (value: string) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
  };
  if (!validOrigin(site.origin) || site.username || site.password || site.search || site.hash || site.pathname !== '/')
    throw new Error('LIVE_SITE_URL must be a site origin without credentials or a path.');
  if (!origins.size || [...origins].some(value => !validOrigin(value)))
    throw new Error('LIVE_ALLOWED_ORIGINS must contain explicit HTTP(S) origins.');
  if (production) {
    if (!env.LIVE_SITE_URL || !env.LIVE_ALLOWED_ORIGINS || !env.LIVE_REGION || env.LIVE_REGION === 'local')
      throw new Error('Production requires explicit LIVE_SITE_URL, LIVE_ALLOWED_ORIGINS and LIVE_REGION.');
    if (site.protocol !== 'https:' || [...origins].some(value => !value.startsWith('https://')))
      throw new Error('Production site and allowed origins must use HTTPS.');
    if (!env.LIVE_ADMIN_SECRET || env.LIVE_ADMIN_SECRET.length < 32 || env.LIVE_ADMIN_SECRET === secret)
      throw new Error('Production requires a separate LIVE_ADMIN_SECRET of at least 32 characters.');
  }
  return {secret, port, host: env.LIVE_HOST || '127.0.0.1', origins, site: site.origin};
}
