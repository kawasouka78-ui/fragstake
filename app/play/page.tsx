'use client';
import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';
import {ArrowRight,RefreshCw} from 'lucide-react';
import SiteHeader from '../site-header';
import {useLiveStatus} from '../use-live-status';
import LiveRoomList from '../live-room-list';
import {requestLiveMatch} from '@/lib/live/launch';
import {maps,getMap} from '@/lib/fps/maps';
import type {LiveMode} from '@/lib/live/security';
import type {MatchConfig,Result} from '@/lib/game-rules';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import LiveMatchResult from '../live-match-result';
import {duelOutcome} from '@/lib/duel-result';
import {accountApi,useAccount} from '../account-context';
import {equippedCosmetics} from '@/lib/catalog';
const Arena=dynamic(()=>import('../arena'),{ssr:false,loading:()=> <main className="real-article" role="status">Loading arena…</main>});
export default function Play(){
 const [mode,setMode]=useState<LiveMode>('ffa'),[mapId,setMapId]=useState('citadel'),[game,setGame]=useState<MatchConfig|null>(null),[result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const {status,checking,refresh}=useLiveStatus(!game),{data}=useAccount();
 useEffect(()=>{const requested=new URLSearchParams(location.search).get('mode');if(requested==='ffa'||requested==='1v1'||requested==='2v2')setMode(requested)},[]);
 async function join(nextMode=mode,nextMap=mapId,roomId?:string){if(busy)return;setBusy(true);setError('');try{const config=await requestLiveMatch(nextMode,nextMap,fetch,roomId);let cosmetics:ReturnType<typeof equippedCosmetics>={skin:undefined,knifeStyle:'standard'};if(data){try{const p=await accountApi<{inventory:{sku:string;equipped:number}[]}>(undefined,'?action=platform');cosmetics=equippedCosmetics(p.inventory)}catch{}}setMode(nextMode);setMapId(nextMap);setResult(null);setGame({...config,...cosmetics})}catch(e){setError(e instanceof Error?e.message:'Could not join. Please retry.')}finally{setBusy(false)}}
 if(game)return <Arena config={game} onFinish={r=>{setResult(r);setGame(null);void refresh()}}/>;
 return <div className="site-shell"><SiteHeader/><main className="main play-main"><div className="page-heading"><div><span className="eyebrow">FRAGSTAKE / PLAY</span><h1>FIND YOUR MATCH<span>.</span></h1></div></div>
 <div className="real-play-grid"><section className="real-map" style={{backgroundImage:`linear-gradient(0deg,#090e16,transparent),url('/maps/${mapId}-arena.webp')`}} aria-label="Selected arena"><div><span className="eyebrow">{mode==='ffa'?'FREE-FOR-ALL':mode+' DUEL'}</span><h2>{getMap(mapId).name.toUpperCase()}</h2></div></section><section className="real-play-form" aria-label="Match setup"><div className="real-formats" role="group" aria-label="Match format">{(['ffa','1v1','2v2'] as const).map(value=><button key={value} aria-pressed={mode===value} onClick={()=>setMode(value)}>{value.toUpperCase()}</button>)}</div><label>Arena<select value={mapId} onChange={e=>setMapId(e.target.value)}>{maps.map(map=><option key={map.id} value={map.id}>{map.name}</option>)}</select></label><p className="real-status">{mode==='ffa'?'Everyone plays solo. Starts with 2 ready players; up to 10 can join.':'First to 10. All '+(mode==='1v1'?'2':'4')+' players must join and ready up.'}<br/>Free entry · Player opponents only</p><button className="primary" disabled={busy||!status?.online} onClick={()=>void join()}>{busy?'Connecting…':checking&&!status?'Checking servers…':'Find match'}<ArrowRight size={18}/></button><span className="real-status">{status?.online?`${status.players} players online · ${status.region}`:'Match server unavailable. Please retry shortly.'}</span>{!data&&<a href="/signin">Sign in to save your match record →</a>}{error&&<p role="alert" className="error-text">{error}</p>}</section></div>
 <section aria-label="Open matches"><div className="section-heading"><h2>OPEN MATCHES</h2><button className="secondary compact" disabled={checking||busy} onClick={()=>void refresh()}><RefreshCw size={15}/>Refresh</button></div><LiveRoomList status={status} checking={checking} filter="all" onJoin={room=>void join(room.mode,room.mapId,room.id)}/></section>
 <Dialog open={!!result} onOpenChange={open=>{if(!open)setResult(null)}}><DialogContent className="sc-dialog"><DialogTitle>{result?(result.liveMode==='ffa'?result.reason:duelOutcome(result).title):'Match report'}</DialogTitle><DialogDescription>Free player match · {result?.kills??0} kills · {result?.deaths??0} deaths</DialogDescription>{result&&<LiveMatchResult result={result}/>}<button className="primary" onClick={()=>void join()} disabled={busy}>Find another match</button>{result?.rematch&&<button className="secondary" onClick={()=>{if(result.rematch&&result.rematch.expiresAt>Date.now()){setGame({mode:'practice',balance:0,rate:0,team:mode==='2v2'?'2v2':'1v1',mapId,live:result.rematch});setResult(null)}else{setError('The rematch invitation expired. Find another match.');setResult(null)}}}>Rematch</button>}<button className="secondary" onClick={()=>setResult(null)}>Return to lobby</button></DialogContent></Dialog>
 </main></div>
}
