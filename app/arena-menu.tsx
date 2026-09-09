'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,ChevronDown,Keyboard,Settings2,Crosshair} from 'lucide-react';
import {Slider} from '@/components/ui/slider';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {weapons,type Simulation,type WeaponId} from '@/lib/fps/simulation';
import type {LoadoutRenderer} from '@/lib/fps/loadout-renderer';
import type {MatchConfig} from '@/lib/game-rules';
import type {ArenaMap} from '@/lib/fps/maps';
import './arena-menu.css';
import PausedSession from './paused-session';

type Preferences={sensitivity:number;fov:number;quality:string;muted:boolean};
type Props={game:Simulation|undefined;config:MatchConfig;map:ArenaMap;ready:boolean;error:string;settings:boolean;prefs:Preferences;setSettings:(value:boolean)=>void;preference:(value:Partial<Preferences>)=>void;select:(id:WeaponId)=>void;resume:()=>void;leave:()=>void;cashOut:()=>void;};

function WeaponPreview({id,skin}:{id:WeaponId;skin?:string}){
  const canvas=useRef<HTMLCanvasElement>(null),view=useRef<LoadoutRenderer|null>(null),selection=useRef({id,skin});
  const [failed,setFailed]=useState(false);
  selection.current={id,skin};
  useEffect(()=>{
    let cancelled=false,observer:ResizeObserver|undefined;
    void import('@/lib/fps/loadout-renderer').then(({LoadoutRenderer})=>{
      if(cancelled||!canvas.current)return;
      const element=canvas.current,renderer=new LoadoutRenderer(element);view.current=renderer;
      renderer.select(selection.current.id,selection.current.skin);
      const resize=()=>{const rect=element.getBoundingClientRect();renderer.resize(Math.max(1,rect.width),Math.max(1,rect.height));};
      observer=new ResizeObserver(resize);observer.observe(element);resize();
    }).catch(()=>{if(!cancelled)setFailed(true);});
    return()=>{cancelled=true;observer?.disconnect();view.current?.dispose();view.current=null;};
  },[]);
  useEffect(()=>{try{view.current?.select(id,skin);}catch{setFailed(true);}},[id,skin]);
  return <div className="loadout-model"><canvas ref={canvas} aria-label={`${weapons[id].name} weapon preview`} role="img"/>{failed&&<p className="loadout-preview-error">Weapon preview unavailable. You can still choose your loadout.</p>}</div>;
}

export default function ArenaMenu({game,config,map,ready,error,settings,prefs,setSettings,preference,select,resume,leave,cashOut}:Props){
  const selected=game?.weapon??(config.weaponRule==='sniper'?'marksman':'rifle');
  const gun=weapons[selected],mode=config.mode==='duel'?`${config.team} Duel`:config.mode==='ffa'?'Cash FFA':'Practice';
  const round=config.mode==='duel'?(config.bestOf===3?`Best of 3 · First to ${config.target??5}`:`First to ${config.target??5}`):'3 minutes';
  const helpKeys=game?.allowedWeapons.length??6;
  return <div className="fps-menu-scrim deployment-scrim"><section className={"deployment-menu"+(game?.started?" is-paused":"")} aria-label="Arena menu">
    <header className="deployment-heading"><div><span className="deployment-eyebrow">{game?.started?'MATCH PAUSED':'MATCH SETUP'}<i/>{mode}</span><h1>{error?'LET’S TRY AGAIN':settings?'MAKE IT YOURS':'CHOOSE YOUR LOADOUT'}<span>.</span></h1></div><div className="deployment-location"><Crosshair size={18}/><div><b>{map.name}</b><span>{round} · Bot match</span></div></div></header>
    {error?<div className="deployment-error" role="alert"><p>{error}</p><button className="secondary" onClick={leave}><ArrowLeft size={17}/> Back to Play</button></div>:<>
      <div className="deployment-body">
        <section className="loadout-spotlight" aria-label="Selected weapon">
          <div className="loadout-spotlight-top"><span><i/> SELECTED WEAPON</span><span>{gun.auto?'FULL AUTO':'SEMI AUTO'}</span></div>
          <WeaponPreview id={selected} skin={config.skin}/>
          <div className="loadout-name"><span>{gun.type}</span><h2>{gun.name}</h2></div>
          <dl className="loadout-stats"><div><dt>Magazine</dt><dd>{gun.mag}<small> rounds</small></dd></div><div><dt>Reload</dt><dd>{gun.reload.toFixed(2)}<small> s</small></dd></div><div><dt>Max. range</dt><dd>{gun.range}<small> m</small></dd></div></dl>
        </section>
        <section className="loadout-selection" aria-label={settings?'Game settings':'Choose a weapon'}>
          <div className="loadout-section-heading"><h2>{settings?'GAME SETTINGS':'YOUR ARSENAL'}</h2><span>{settings?'Saved on this device':`${game?.allowedWeapons.length??'—'} weapons available`}</span></div>
          {settings?<div className="deployment-settings">
            <label>Mouse sensitivity <b>{prefs.sensitivity.toFixed(1)}</b><Slider aria-label="Mouse sensitivity" min={.3} max={2.5} step={.1} value={[prefs.sensitivity]} onValueChange={v=>preference({sensitivity:Array.isArray(v)?v[0]:v})}/></label>
            <label>Field of view <b>{prefs.fov}°</b><Slider aria-label="Field of view" min={65} max={100} step={1} value={[prefs.fov]} onValueChange={v=>preference({fov:Array.isArray(v)?v[0]:v})}/></label>
            <div><span>Graphics</span><Tabs value={prefs.quality} onValueChange={v=>preference({quality:String(v)})}><TabsList><TabsTrigger value="high">High</TabsTrigger><TabsTrigger value="low">Performance</TabsTrigger></TabsList></Tabs></div>
            <p>Changes apply immediately. Choose Performance for smoother play on slower devices.</p>
          </div>:<><div className="loadout-grid">{game?.allowedWeapons.map((id,i)=><button type="button" key={id} disabled={!ready} aria-pressed={selected===id} aria-label={`Select ${weapons[id].name}`} className={'loadout-card '+(selected===id?'selected':'')} onClick={()=>select(id)}><span className="loadout-card-number">{String(i+1).padStart(2,'0')}</span><span><b>{weapons[id].name}</b><small>{weapons[id].type}</small></span>{selected===id&&<Check size={16} aria-hidden="true"/>}</button>)}</div>{!ready&&<p role="status" className="loadout-rule">Preparing your loadout…</p>}<p className="loadout-rule">{config.weaponRule==='headshots'?'Headshots only. Body shots deal no damage.':game&&game.allowedWeapons.length<6?'This match uses a restricted weapon pool.':'Switch weapons at any time during the match.'}</p></>}
        </section>
      </div>
      {game?.started&&<PausedSession game={game} config={config}/>}
      <details className="deployment-controls"><summary><Keyboard size={17}/><span>Controls & tips</span><span className="deployment-key-hint">WASD to move · Mouse to aim</span><ChevronDown size={15}/></summary><div className="deployment-controls-body"><div className="deployment-key-grid">{[['Move','W A S D'],['Look / aim','Mouse / Arrow keys'],['Fire / aim down sights','LMB / RMB'],['Sprint / crouch','Shift / Ctrl'],['Slide','C'],['Jump / reload','Space / R'],['Switch weapons',helpKeys===1?'1':`1 – ${helpKeys}`],['Scoreboard','Tab'],['Pause / loadout / cash-out','Esc / P']].map(([label,keys])=><div key={label}><span>{label}</span><kbd>{keys}</kbd></div>)}</div><p>Press C to slide in your movement direction. No sprint or stamina required. Press C in the air to slide on landing. Press Space to jump out of a slide. Health regenerates after 7 seconds without damage. Pick up health and ammo at marked stations. Touch controls appear on touch devices. Press F for keyboard firing.</p></div></details>
      <footer className="deployment-actions"><button className={game?.started&&config.mode==='ffa'?'secondary deployment-cashout':'deployment-back'} disabled={!ready} onClick={game?.started&&config.mode==='ffa'?cashOut:leave}><ArrowLeft size={16}/>{!game?.started?'Back to Play':config.mode==='ffa'?'Cash out & leave':config.mode==='duel'?`Forfeit €${(config.stake??10).toFixed(2)} & leave`:'Leave match'}</button><div><button className="secondary" onClick={()=>setSettings(!settings)}>{settings?<Crosshair size={17}/>:<Settings2 size={17}/>} {settings?'Loadout':'Settings'}</button><button className="primary deployment-start" disabled={!ready} onClick={resume}>{ready?(game?.started?'RESUME MATCH':'ENTER MATCH'):'LOADING ARENA…'}<ArrowRight size={19}/></button></div></footer>
    </>}
  </section></div>;
}
