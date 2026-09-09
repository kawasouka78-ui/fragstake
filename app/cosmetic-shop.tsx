'use client';
import {useState} from 'react';
import {ArrowRight,Eye,Sparkles,RotateCcw} from 'lucide-react';
import {catalog,cosmeticFinish,type Cosmetic} from '@/lib/catalog';
import {weapons,weaponIds,type WeaponId} from '@/lib/fps/simulation';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {WeaponPreview} from './arena-menu';
import {euro} from './account-context';
import './cosmetic-shop.css';

type Props={inventory:boolean;owned:Set<string>;equipped?:string;busy:boolean;signedIn:boolean;act:(body:Record<string,unknown>,message:string)=>Promise<void>};
export default function CosmeticShop({inventory,owned,equipped,busy,signedIn,act}:Props){
 const [filter,setFilter]=useState('all'),[inspected,setInspected]=useState<Cosmetic|null>(null),[weapon,setWeapon]=useState<WeaponId>('rifle'),[angle,setAngle]=useState(0);
 const items=catalog.filter(item=>(!inventory||owned.has(item.sku))&&(filter==='all'||(filter==='animated')===('effect' in item)));
 const action=(item:Cosmetic)=>owned.has(item.sku)?<button className="secondary compact" disabled={busy} onClick={()=>void act({action:'inventory_equip',sku:equipped===item.sku?'':item.sku},equipped===item.sku?'Black standard finish equipped.':item.name+' equipped for your next match.')}>{equipped===item.sku?'Unequip':'Equip finish'}</button>:signedIn?<button className="primary compact" disabled={busy} onClick={()=>void act({action:'shop_buy',sku:item.sku},item.name+' added to your inventory.')}>Buy · {euro(item.price)}</button>:<a className="secondary compact" href="/signin">Sign in to buy<ArrowRight size={15}/></a>;
 return <>
  <div className="armory-toolbar"><div role="group" aria-label="Finish category">{[['all','All finishes'],['animated','Animated'],['standard','Standard']].map(([id,label])=><button key={id} aria-pressed={filter===id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{id==='animated'&&<Sparkles size={15}/>} {label}</button>)}</div><a className="secondary compact" href={inventory?'/shop':'/inventory'}>{inventory?'Browse shop':'Your inventory'}<ArrowRight size={15}/></a></div>
  <p className="armory-caption">Inspect any finish on all six weapons. Purchases use demo credits.</p>
  <div className="cosmetic-grid">{items.map(item=><article className={'account-panel cosmetic-card'+('effect' in item?' animated-cosmetic':'')} key={item.sku} style={{'--wrap':item.color} as React.CSSProperties}>
   <button className="weapon-preview cosmetic-inspect" aria-label={'Inspect '+item.name} onClick={()=>{setInspected(item);setAngle(0);}}><WeaponPreview id="rifle" skin={cosmeticFinish(item)}/><span><Eye size={14}/>Inspect</span></button>
   <span className="eyebrow">{'effect' in item&&<Sparkles size={13}/>} {item.kind}{equipped===item.sku?' · EQUIPPED':''}</span><h2>{item.name}</h2><p>{item.description}</p>
   <div className="cosmetic-footer"><strong>{owned.has(item.sku)?'OWNED':euro(item.price)}</strong>{action(item)}</div>
  </article>)}</div>
  {!items.length&&<div className="account-panel platform-empty"><h2>{inventory?'No finishes in this collection yet':'No finishes in this category'}</h2><p>{inventory?'Browse the shop and inspect a finish to find your next look.':'Choose another category.'}</p></div>}
  <Dialog open={!!inspected} onOpenChange={open=>{if(!open)setInspected(null)}}><DialogContent className="sc-dialog finish-inspector">{inspected&&<>
   <span className="eyebrow">{inspected.kind}</span><DialogTitle>{inspected.name}</DialogTitle><DialogDescription>{inspected.description}</DialogDescription>
   <div className="inspect-stage" style={{'--wrap':inspected.color} as React.CSSProperties}><WeaponPreview id={weapon} skin={cosmeticFinish(inspected)} angle={angle}/></div>
   <div className="inspect-weapons" role="group" aria-label="Preview weapon">{weaponIds.map(id=><button key={id} aria-pressed={weapon===id} onClick={()=>setWeapon(id)}>{weapons[id].name}</button>)}</div>
   <div className="inspect-angle"><label>Rotate weapon<input type="range" min={-1.6} max={1.6} step={.02} value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label><button className="secondary compact" aria-label="Reset weapon angle" onClick={()=>setAngle(0)}><RotateCcw size={16}/></button></div>
   <div className="inspect-footer"><div><strong>{euro(inspected.price)}</strong><small>DEMO CREDITS</small></div>{action(inspected)}</div>
  </>}</DialogContent></Dialog>
 </>;
}
