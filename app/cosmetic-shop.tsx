'use client';
import {useState} from 'react';
import {ArrowRight,Eye,Sparkles,RotateCcw} from 'lucide-react';
import {catalog,cosmeticFinish,cosmeticSlot,type Cosmetic} from '@/lib/catalog';
import {weapons,weaponIds,type WeaponId} from '@/lib/fps/simulation';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {WeaponPreview} from './arena-menu';
import {euro} from './account-context';
import './cosmetic-shop.css';

type Props={inventory:boolean;owned:Set<string>;equipped:Set<string>;busy:boolean;signedIn:boolean;act:(body:Record<string,unknown>,message:string)=>Promise<void>};
export default function CosmeticShop({inventory,owned,equipped,busy,signedIn,act}:Props){
 const [filter,setFilter]=useState('all'),[inspected,setInspected]=useState<Cosmetic|null>(null),[weapon,setWeapon]=useState<WeaponId>('rifle'),[angle,setAngle]=useState(0);
 const isKnife=(item:Cosmetic)=>cosmeticSlot(item)==='knife';
 const unlocked=(item:Cosmetic)=>!isKnife(item)||owned.has(item.sku);
 const items=catalog.filter(item=>(!inventory||unlocked(item))&&(filter==='all'||filter==='knives'&&isKnife(item)||filter==='animated'&&'effect' in item||filter==='standard'&&!isKnife(item)&&!('effect' in item)));
 function action(item:Cosmetic){
  const selected=equipped.has(item.sku),knife=isKnife(item);
  if(!unlocked(item))return <button className="primary compact" disabled={busy||!signedIn} onClick={()=>void act({action:'shop_buy',sku:item.sku},item.name+' purchased. Equip it to use it in your next match.')}>{busy?'Please wait…':'Buy knife'}<ArrowRight size={15}/></button>;
  return <button className="secondary compact" disabled={busy||!signedIn} onClick={()=>void act({action:'inventory_equip',sku:selected?'':item.sku,slot:cosmeticSlot(item)},selected?(knife?'Combat knife equipped.':'Black standard finish equipped.'):item.name+' equipped for your next match.')}>{selected?(knife?'Use combat knife':'Unequip'):(knife?'Equip knife':'Equip finish')}</button>;
 }
 return <>
  <div className="armory-toolbar"><div role="group" aria-label="Shop category">{[['all','All items'],['knives','Knives'],['animated','Animated'],['standard','Standard']].map(([id,label])=><button key={id} aria-pressed={filter===id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{id==='animated'&&<Sparkles size={15}/>} {label}</button>)}</div><a className="secondary compact" href={inventory?'/shop':'/inventory'}>{inventory?'Browse shop':'Your inventory'}<ArrowRight size={15}/></a></div>
  <p className="armory-caption">Gun finishes are unlocked. Buy knives with demo credits and equip them separately.</p>
  <div className="cosmetic-grid">{items.map(item=><article className={'account-panel cosmetic-card'+('effect' in item?' animated-cosmetic':'')+(isKnife(item)?' knife-cosmetic':'')} key={item.sku} style={{'--wrap':item.color} as React.CSSProperties}>
   <button className="weapon-preview cosmetic-inspect" aria-label={'Inspect '+item.name} onClick={()=>{setInspected(item);setAngle(0);}}><WeaponPreview id={isKnife(item)?'knife':'rifle'} skin={cosmeticFinish(item)} knifeStyle={isKnife(item)?'karambit':'standard'}/><span><Eye size={14}/>Inspect</span></button>
   <span className="eyebrow">{'effect' in item&&<Sparkles size={13}/>} {item.kind}{equipped.has(item.sku)?' · EQUIPPED':''}</span><h2>{item.name}</h2><p>{item.description}</p>
   <div className="cosmetic-footer"><div><strong>{equipped.has(item.sku)?'EQUIPPED':unlocked(item)?'UNLOCKED':euro(item.price)}</strong>{!unlocked(item)&&<small>DEMO CREDITS</small>}</div>{action(item)}</div>
  </article>)}</div>
  {!items.length&&<div className="account-panel platform-empty"><h2>{inventory?'No items in this collection yet':'No items in this category'}</h2><p>{inventory?'Find your next knife in the shop.':'Choose another category.'}</p>{inventory&&<a className="secondary compact" href="/shop">Browse shop<ArrowRight size={15}/></a>}</div>}
  <Dialog open={!!inspected} onOpenChange={open=>{if(!open)setInspected(null)}}><DialogContent className="sc-dialog finish-inspector">{inspected&&<>
   <span className="eyebrow">{inspected.kind}</span><DialogTitle>{inspected.name}</DialogTitle><DialogDescription>{inspected.description}</DialogDescription>
   <div className="inspect-stage" style={{'--wrap':inspected.color} as React.CSSProperties}><WeaponPreview id={isKnife(inspected)?'knife':weapon} skin={cosmeticFinish(inspected)} knifeStyle={isKnife(inspected)?'karambit':'standard'} angle={angle}/></div>
   {!isKnife(inspected)&&<div className="inspect-weapons" role="group" aria-label="Preview weapon">{weaponIds.map(id=><button key={id} aria-pressed={weapon===id} onClick={()=>setWeapon(id)}>{weapons[id].name}</button>)}</div>}
   <div className="inspect-angle"><label>Rotate {isKnife(inspected)?'knife':'weapon'}<input type="range" min={-1.6} max={1.6} step={.02} value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label><button className="secondary compact" aria-label="Reset weapon angle" onClick={()=>setAngle(0)}><RotateCcw size={16}/></button></div>
   <div className="inspect-footer"><div><strong>{unlocked(inspected)?'UNLOCKED':euro(inspected.price)}</strong><small>{unlocked(inspected)?isKnife(inspected)?'KNIFE SLOT · PRESS 2 IN MATCH':'GUN FINISH':'DEMO CREDITS'}</small></div>{action(inspected)}</div>
  </>}</DialogContent></Dialog>
 </>;
}
