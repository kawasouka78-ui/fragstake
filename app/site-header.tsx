'use client';
import './platform.css';
import './lobby-refresh.css';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {Crosshair,Gamepad2,Wallet,Users,Trophy,History,UserRound,ShoppingBag,Settings2,ArrowUpRight,LifeBuoy,ChevronRight,Plus,Menu} from 'lucide-react';
import {useAccount,euro,accountApi} from './account-context';
export function PlayerAvatar({name,color='orange',large=false}:{name:string;color?:string;large?:boolean}){return <span className={'player-avatar color-'+color+(large?' large':'')}>{name.slice(0,2).toUpperCase()}</span>}
const destinations=[{path:'/',name:'Play',icon:Gamepad2},{path:'/friends',name:'Friends & Party',icon:Users},{path:'/leaderboard',name:'Leaderboard',icon:Trophy},{path:'/history',name:'History & Stats',icon:History},{path:'/wallet',name:'Wallet',icon:Wallet},{path:'/shop',name:'Shop',icon:ShoppingBag},{path:'/progression',name:'Progression',icon:Crosshair}];
type PartySummary={id:string;name:string;members:{status:string}[]}|null;
export default function SiteHeader(){
 const {data}=useAccount(),path=usePathname(),current=destinations.find(n=>n.path===path)?.name??({profile:'Player profile',settings:'Settings',inventory:'Inventory',ranked:'Rankings',support:'Support'} as Record<string,string>)[path.split('/')[1]]??'Arena';
 const [party,setParty]=useState<PartySummary>(null);
 useEffect(()=>{let alive=true;if(!data){setParty(null);return}void accountApi<{party:PartySummary}>(undefined,'?action=platform').then(p=>{if(alive)setParty(p.party??null)}).catch(()=>{if(alive)setParty(null)});return()=>{alive=false}},[data?.player.id]);
 const partyCount=party?.members.filter(m=>m.status==='joined').length??0;
 return <>
  <aside className="arena-sidebar">
   <a className="brand" href="/" aria-label="SkillClash lobby"><span className="brand-symbol"><Crosshair/></span><span>SKILL<span>CLASH</span><small>COMPETITIVE ARENA</small></span></a>
   <span className="sidebar-caption">YOUR ARENA</span>
   <nav className="arena-navigation" aria-label="Main navigation">{destinations.map(n=><a key={n.path} className={path===n.path?'nav-active':''} href={n.path} aria-current={path===n.path?'page':undefined}><n.icon size={19}/><span>{n.name}</span>{n.path==='/friends'&&!!data?.pending?<b className="request-count">{data.pending}</b>:path===n.path?<ChevronRight size={15}/>:null}</a>)}</nav>
   <div className="sidebar-bottom"><div className="sidebar-preview"><span><i/> {partyCount>1?'PARTY ACTIVE':'ARENA PREVIEW'}</span><p>{partyCount>1?party?.name+' · '+partyCount+' players · Duels only':'Free live matches. Demo credits.'}</p></div><nav aria-label="Account navigation"><a href="/settings" aria-current={path==='/settings'?'page':undefined}><Settings2 size={18}/>Settings</a><a href="/support" aria-current={path==='/support'?'page':undefined}><LifeBuoy size={18}/>Help & support<ArrowUpRight size={14}/></a></nav><a className="sidebar-player" href="/profile" aria-label="Your profile">{data?<PlayerAvatar name={data.player.name} color={data.player.color}/>:<UserRound size={22}/>}<span><b>{data?.player.name??'Your profile'}</b><small>{data?'@'+data.player.handle:'Player account'}</small></span><ChevronRight size={15}/></a></div>
  </aside>
  <header className="arena-topbar"><div className="topbar-context"><Crosshair size={16}/><span>SKILLCLASH</span><ChevronRight size={13}/><b>{current}</b></div><div className="topbar-actions">{partyCount>1&&<a className="topbar-party" href="/friends#party" aria-label={'Party active: '+party?.name}><Users size={17}/><span><small>PARTY</small><b>{partyCount} players</b></span><em>DUELS</em></a>}<details className="mobile-utility-menu"><summary className="mobile-settings icon-button" aria-label="More pages"><Menu size={18}/></summary><nav aria-label="More pages"><a href="/profile">Your profile</a><a href="/inventory">Your inventory</a><a href="/ranked">Rankings</a><a href="/progression">Progression</a><a href="/settings">Settings</a><a href="/support">Help & support</a></nav></details><a className="topbar-balance" href="/wallet"><Wallet size={17}/><span><small>DEMO BALANCE</small><b>{data?euro(data.player.balance):'—'}</b></span><i aria-hidden="true"><Plus size={16}/></i></a></div></header>
 </>;
}
