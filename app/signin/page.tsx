import { getChatGPTUser, chatGPTSignInPath } from '../chatgpt-auth';
import { redirect } from 'next/navigation';
import { Crosshair, ArrowRight, ShieldCheck } from 'lucide-react';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in | FragStake' };
export default async function Page() {
  if (await getChatGPTUser()) redirect('/play');
  return (
    <main className="signin-page">
      <div className="signin-card">
        <Crosshair size={48} />
        <h1>Sign in to FragStake</h1>
        <p>
          Sign in to save your profile, find friends, and keep your match record
          across devices.
        </p>
        <a className="primary" href={chatGPTSignInPath('/play')} target="_top">
          Sign in with ChatGPT
          <ArrowRight size={18} />
        </a>
        <small>
          <ShieldCheck size={15} />
          You can play free matches without an account.
        </small>
        <a className="signin-back" href="/play">
          Continue without signing in
        </a>
      </div>
    </main>
  );
}
