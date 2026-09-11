import {Crosshair,Skull,Target,Flame,Clock3,Activity} from 'lucide-react';
import {matchDuration,signedEuros,type CombatStats} from '@/lib/match-summary';
import './match-receipt.css';

type Props={stats:CombatStats;mode:string;net?:number;caption?:string;returned?:number;rate?:number;lastDeathLoss?:number;hideTotal?:boolean};
export default function MatchReceipt({stats,mode,net=0,caption,returned,rate,lastDeathLoss,hideTotal=false}:Props){
 const tone=net>0?'gain':net<0?'loss':'even';
 return <div className="match-receipt">
  {!hideTotal&&<div className={'receipt-total '+tone}><span>{mode==='practice'?'YOUR PERFORMANCE':net>0?'SESSION PROFIT':net<0?'SESSION LOSS':'SESSION NET'}</span><strong>{mode==='practice'?`${stats.kills} / ${stats.deaths}`:signedEuros(net)}</strong><p>{mode==='practice'?(caption??'Kills / deaths · Free practice'):caption??'Match balance'}</p></div>}
  {!!lastDeathLoss&&<p className="receipt-last-death"><Skull size={16}/> Final elimination <b>{signedEuros(-lastDeathLoss)}</b></p>}
  <dl className="receipt-stats">{[
   {label:'Kills',value:stats.kills,Icon:Crosshair},{label:'Deaths',value:stats.deaths,Icon:Skull},{label:'K/D',value:(stats.kills/Math.max(1,stats.deaths)).toFixed(2),Icon:Activity},
   {label:'Headshots',value:stats.headshots??0,Icon:Target},{label:'Best streak',value:stats.maxStreak??0,Icon:Flame},{label:'Time played',value:matchDuration(stats.elapsed??0),Icon:Clock3},
  ].map(({label,value,Icon})=><div key={label}><dt><Icon size={15}/>{label}</dt><dd>{value}</dd></div>)}</dl>
  {mode==='ffa'&&rate!==undefined&&<div className="receipt-breakdown"><span>Eliminations <b className="gain">{signedEuros(stats.kills*rate)}</b></span><span>Deaths <b className="loss">{signedEuros(-Math.min(stats.deaths*rate,stats.kills*rate-net))}</b></span></div>}
  {returned!==undefined&&mode!=='practice'&&<div className="receipt-return"><span>{returned<0?'Wallet deduction':'Back to wallet'}</span><b>€{Math.abs(returned).toFixed(2)}</b></div>}
 </div>;
}
