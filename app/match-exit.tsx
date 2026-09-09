'use client';
import {ArrowRight,LogOut,X} from 'lucide-react';
import {Dialog,DialogPortal,DialogOverlay,DialogClose,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {matchOutcome,signedEuros} from '@/lib/match-summary';
import type {Simulation} from '@/lib/fps/simulation';
import type {MatchConfig} from '@/lib/game-rules';
import MatchReceipt from './match-receipt';
import {Dialog as DialogPrimitive} from '@base-ui/react/dialog';

type Props={open:boolean;onOpenChange:(open:boolean)=>void;game:Simulation;config:MatchConfig;resume:()=>void;leave:()=>void;cashOut:()=>void};
export default function MatchExit({open,onOpenChange,game,config,resume,leave,cashOut}:Props){
 const stats={kills:game.player.kills,deaths:game.player.deaths,headshots:game.headshots,maxStreak:game.maxStreak,elapsed:game.elapsed,score:game.score,enemyScore:game.enemyScore};
 const ffa=config.mode==='ffa',forfeit=matchOutcome(config,stats,'leave'),outcome=ffa?matchOutcome(config,stats,'cashout'):forfeit;
 const canCashOut=game.player.hp>0&&game.cashOutWait===0;
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogPortal container={typeof document!=='undefined'?(document.fullscreenElement as HTMLElement|null)??undefined:undefined}><DialogOverlay className="exit-overlay"/><DialogPrimitive.Popup className="sc-dialog exit-dialog"><DialogClose className="exit-close" aria-label="Close match summary"><X size={19}/></DialogClose>
  <span className="exit-review-meta">{game.map.name} · {ffa?'Cash FFA':config.mode==='duel'?`${config.team} Duel`:'Practice'}</span>
  <DialogTitle>{ffa?'CASH OUT & LEAVE?':'LEAVE THIS MATCH?'}</DialogTitle>
  <DialogDescription>{ffa?'Your session so far. Cash out to keep the remaining credits.':'Review your performance before heading back to Play.'}</DialogDescription>
  <MatchReceipt stats={stats} mode={config.mode} net={outcome.net} returned={outcome.returned} rate={config.rate} caption={ffa?'Net change if you cash out now':'Net change if you leave now'}/>
  {ffa&&!canCashOut&&<p className="exit-wait">{game.player.hp<=0?'Resume to respawn before cashing out.':`Resume and stay out of combat for ${Math.ceil(game.cashOutWait)} more seconds to cash out.`} The timer is paused while this menu is open.</p>}
  {config.mode==='duel'&&<p className="exit-consequence">Leaving ends your duel and forfeits your <b>€{(config.stake??10).toFixed(2)}</b> demo stake, even if you are ahead.</p>}
  <div className="exit-actions"><button className="secondary" onClick={resume}>Keep playing</button>{ffa?<button className="primary" disabled={!canCashOut} onClick={cashOut}>{config.entry?`Cash out €${Math.max(0,outcome.returned).toFixed(2)}`:'Cash out & leave'}<ArrowRight size={17}/></button>:<button className="primary" onClick={leave}><LogOut size={16}/>{config.mode==='duel'?'Forfeit & leave':'Leave match'}</button>}</div>
  {ffa&&<><button className="exit-forfeit" onClick={leave}>{config.entry?`Forfeit €${game.balance.toFixed(2)} & leave`:'Leave & settle session'}</button>{!!config.entry&&<p className="exit-consequence">Forfeiting returns €0.00 to your wallet. Your total session loss will be <b>{signedEuros(forfeit.net)}</b>.</p>}</>}
 </DialogPrimitive.Popup></DialogPortal></Dialog>;
}
