import {getChatGPTUser,chatGPTSignInPath} from '../chatgpt-auth';
import {redirect} from 'next/navigation';
import {Crosshair,ArrowRight,ShieldCheck} from 'lucide-react';
export const dynamic='force-dynamic';
export const metadata={title:'Sign in | SkillClash'};
export default async function Page(){if(await getChatGPTUser())redirect('/');return <main className="signin-page"><div className="signin-card"><Crosshair size={48}/><span className="eyebrow">YOUR PLAYER ACCOUNT</span><h1>ENTER SKILLCLASH.</h1><p>Sign in to save your profile, find friends, and keep your demo wallet and match record across devices.</p><a className="primary" href={chatGPTSignInPath('/')} target="_top">Sign in with ChatGPT<ArrowRight size={18}/></a><small><ShieldCheck size={15}/>Bot matches. Demo credits. No real payments.</small></div></main>}
