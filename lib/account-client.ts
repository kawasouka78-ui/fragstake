export class AccountRequestError extends Error {status:number;constructor(message:string,status:number){super(message);this.status=status;}}
export async function requestAccount<T>(body?: Record<string, unknown>, query = '', timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { firebaseIdToken } = await import('./firebase-client');
    const token = await firebaseIdToken();
    const response = await fetch('/api/community' + query, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body ? {'Content-Type': 'application/json'} : {}),
        ...(token ? {Authorization: 'Bearer ' + token} : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Your account connection needs to be refreshed. Sign in with ChatGPT or retry. Free practice is still available.');
    }
    const data = await response.json() as T & {error?: string};
    if (!response.ok) throw new AccountRequestError(data.error || 'Your account could not be loaded. Please retry.',response.status);
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Your account took too long to respond. Retry, or play free practice while it reconnects.');
    throw error;
  } finally { clearTimeout(timer); }
}
