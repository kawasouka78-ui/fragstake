import {getChatGPTUser,chatGPTSignInPath} from '../chatgpt-auth';
import {redirect} from 'next/navigation';
import {Crosshair,ArrowRight,ShieldCheck} from 'lucide-react';
export const dynamic='force-dynamic';
export const metadata={title:'Sign in | FragStake'};
export default async function Page(){if(await getChatGPTUser())redirect('/play');return <main className="signin-page"><div className="signin-card"><Crosshair size={48}/><span className="eyebrow">YOUR PLAYER ACCOUNT</span><h1>ENTER FRAGSTAKE.</h1><p>Sign in to save your profile, find friends, and keep your match record across devices.</p><a className="primary" href={chatGPTSignInPath('/play')} target="_top">Sign in with ChatGPT<ArrowRight size={18}/></a><small><ShieldCheck size={15}/>Free player matches. Your progress stays with your account.</small></div></main>}
