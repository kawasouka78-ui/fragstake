import {Trophy,Swords,RotateCcw,ArrowRight,LogOut,LoaderCircle} from 'lucide-react';
import {DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {duelOutcome} from '@/lib/duel-result';
import {signedEuros} from '@/lib/match-summary';
import {getMap} from '@/lib/fps/maps';
import type {MatchConfig,Result} from '@/lib/game-rules';
import MatchReceipt from './match-receipt';
import './duel-result.css';

type Props={result:Result;config:MatchConfig|null;pending:boolean;busy:boolean;error:string;retry:()=>void;rematch:()=>void;findNext:()=>void;leave:()=>void};
export default function DuelResult({result,config,pending,busy,error,retry,rematch,findNext,leave}:Props){
 const outcome=duelOutcome(result),live=!!result.live,disabled=pending||busy;
 const canRematch=!!config&&(!live||!!result.rematch);
 return <div className={'duel-result '+outcome.tone}>
  <div className="duel-result-meta"><span>{getMap(result.mapId).name}</span><i/><span>{result.liveMode??config?.team??'1v1'} DUEL</span><span>{live?'FREE MATCH':'DEMO CREDITS'}</span></div>
  <div className="duel-result-hero">
   <div className="duel-result-emblem">{outcome.tone==='win'?<Trophy size={30}/>:<Swords size={30}/>}</div>
   <DialogTitle>{outcome.title}<span>.</span></DialogTitle>
   <DialogDescription>{/forfeit/i.test(result.reason)?'You left before the duel ended. Your stake was forfeited.':live?'Final score · Free player duel':outcome.tone==='win'?'Duel secured. Your result is below.':outcome.tone==='loss'?'The next duel is a fresh start.':'The duel is closed. Your stake is safe.'}</DialogDescription>
  </div>
  <div className="duel-result-headline">
   <div><span>{live?'MATCH EARNINGS':outcome.label}</span><strong>{signedEuros(result.net??0)}</strong><small>{live?'Free entry · No cash prizes':pending?'Settling demo credits…':'Net change to your demo balance'}</small></div>
   <div className="duel-result-score"><span>FINAL SCORE</span><strong>{result.score}<em>:</em>{result.enemyScore}</strong><small>Your team · Opponents</small></div>
  </div>
  {!live&&<dl className="duel-result-wallet"><div><dt>Your stake</dt><dd>€{(config?.stake??10).toFixed(2)}</dd></div><div><dt>Returned to wallet</dt><dd>{pending?'Settling…':'€'+(result.returned??0).toFixed(2)}</dd></div><div><dt>Wallet balance</dt><dd>{pending?'Updating…':result.walletBalance!==undefined?'€'+result.walletBalance.toFixed(2):'—'}</dd></div></dl>}
  <MatchReceipt stats={result} mode="duel" hideTotal/>
  {error&&<div className="duel-result-error" role="alert"><p>{error}</p>{pending&&<button className="secondary compact" disabled={busy} onClick={retry}>Retry saving</button>}</div>}
  <div className="duel-result-actions"><button className="primary" disabled={disabled||!canRematch} onClick={rematch}>{busy?<LoaderCircle size={17} className="duel-result-spinner"/>:<RotateCcw size={17}/>} {busy?'Please wait…':'Rematch'}</button><button className="secondary" disabled={disabled} onClick={findNext}>Find another game <ArrowRight size={17}/></button><button className="duel-result-leave" disabled={disabled} onClick={leave}><LogOut size={15}/> Leave</button></div>
  <p className="duel-result-hint">{pending?'Saving your result before the next match.':live?canRematch?'Rematch invites the same players. Everyone must join and ready up.':'Find another game to enter a new player match.':`Rematch keeps this map and rules · €${config?.stake??10} demo entry`}</p>
 </div>;
}
