/** Only call behind Sites dispatch (or its local plugin), which owns these headers.
 * Some existing private dispatch sessions forward a verified email without the
 * newer per-site subject ID. Keep those legacy accounts isolated in a namespace;
 * never accept identity from request bodies, query strings or ordinary headers.
 * A later subject ID remains authoritative; email accounts are not auto-merged.
 */
export async function accountIdentity(headers: Pick<Headers, 'get'>): Promise<string | null> {
  const subject = headers.get('oai-authenticated-user-id')?.trim();
  if (subject) return subject;
  const email = headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('skillclash:legacy-dispatch-email:' + email));
  return 'dispatch-email:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
