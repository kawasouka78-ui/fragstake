import {collisionBoxes,getMap,type ArenaMap,type Box} from './maps.ts';
import {matchOutcome} from '../match-summary.ts';
import {duelPayout,type MatchConfig,type Result} from '../game-rules.ts';

export type Vec={x:number;y:number;z:number};
export type WeaponId='rifle'|'carbine'|'smg'|'vector'|'marksman'|'pistol'|'handcannon'|'shotgun';
export const weapons={
 rifle:{name:'VANGUARD',type:'ASSAULT RIFLE',mag:30,damage:28,head:2.5,interval:.105,reload:1.65,spread:.012,recoil:.018,auto:true,range:75},
 smg:{name:'PHANTOM',type:'SUBMACHINE GUN',mag:36,damage:19,head:2,interval:.067,reload:1.35,spread:.023,recoil:.013,auto:true,range:45},
 marksman:{name:'LONGSHOT',type:'MARKSMAN RIFLE',mag:10,damage:65,head:1.7,interval:.48,reload:2.05,spread:.003,recoil:.055,auto:false,range:100}
,carbine:{name:'SENTINEL',type:'ASSAULT RIFLE',mag:30,damage:24,head:2.4,interval:.09,reload:1.7,spread:.009,recoil:.013,auto:true,range:70},
 vector:{name:'VECTOR',type:'SUBMACHINE GUN',mag:24,damage:16,head:2,interval:.055,reload:1.25,spread:.021,recoil:.012,auto:true,range:35},
 pistol:{name:'SIDEWINDER',type:'PISTOL',mag:15,damage:30,head:2,interval:.23,reload:1.1,spread:.012,recoil:.021,auto:false,range:40},
 handcannon:{name:'JUDGEMENT',type:'HEAVY PISTOL',mag:7,damage:55,head:2,interval:.4,reload:1.6,spread:.008,recoil:.05,auto:false,range:55},
 shotgun:{name:'BREACHER',type:'SHOTGUN',mag:6,damage:14,head:1.2,interval:.8,reload:2.4,spread:.085,recoil:.07,auto:false,range:20}
} as const;
export const weaponIds:WeaponId[]=['rifle','smg','marksman','carbine','vector','shotgun'];
const ammoFor=()=>Object.fromEntries(weaponIds.map(id=>[id,weapons[id].mag])) as Record<WeaponId,number>;
const reserveFor=()=>Object.fromEntries(weaponIds.map(id=>[id,weapons[id].mag*4])) as Record<WeaponId,number>;
export type Actor={id:number;name:string;team:number;x:number;z:number;y:number;vy:number;yaw:number;hp:number;kills:number;deaths:number;respawn:number;shield:number;cooldown:number;crouch:boolean;moving:number;path:{x:number;z:number}[];repath:number;target:number;reaction:number;lastDamage:number};
export type Controls={forward:number;right:number;fire:boolean;aim:boolean;sprint:boolean;crouch:boolean;jump:boolean;reload:boolean;slide?:boolean;weapon?:WeaponId};
export const idleInput=():Controls=>({forward:0,right:0,fire:false,aim:false,sprint:false,crouch:false,jump:false,reload:false,slide:false});
export type Shot={from:Vec;to:Vec;friendly:boolean;age:number};
export type GameEvent={kind:'shot'|'enemyShot'|'footstep'|'hit'|'kill'|'hurt'|'reload'|'pickup'|'spawn';head?:boolean;weapon?:WeaponId;angle?:number;distance?:number};
export type Feed={id:number;killer:string;victim:string;head:boolean;you:boolean;age:number};
export type Pickup={x:number;z:number;kind:'health'|'ammo';ready:number};
export const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function direction(yaw:number,pitch=0):Vec{return {x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};}
export function rayBox(origin:Vec,dir:Vec,min:Vec,max:Vec):number{
 let near=0,far=Infinity;
 for(const k of ['x','y','z'] as const){if(Math.abs(dir[k])<1e-8){if(origin[k]<min[k]||origin[k]>max[k])return Infinity;continue;}
  let a=(min[k]-origin[k])/dir[k],b=(max[k]-origin[k])/dir[k];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;}
 return far<0?Infinity:near;
}
export function wallDistance(boxes:Box[],from:Vec,dir:Vec){let hit=Infinity;for(const b of boxes)hit=Math.min(hit,rayBox(from,dir,{x:b.x-b.w/2,y:b.y??0,z:b.z-b.d/2},{x:b.x+b.w/2,y:(b.y??0)+b.h,z:b.z+b.d/2}));return hit;}
export function clearAt(boxes:Box[],x:number,z:number,radius=.4){return !boxes.some(b=>(b.y??0)<1.84&&Math.hypot(x-clamp(x,b.x-b.w/2,b.x+b.w/2),z-clamp(z,b.z-b.d/2,b.z+b.d/2))<radius);}
export function moveActor(actor:Actor,dx:number,dz:number,boxes:Box[]){
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.16));
 for(let i=0;i<steps;i++){if(clearAt(boxes,actor.x+dx/steps,actor.z))actor.x+=dx/steps;if(clearAt(boxes,actor.x,actor.z+dz/steps))actor.z+=dz/steps;}
}
export function visible(boxes:Box[],a:Vec,b:Vec){const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},len=Math.hypot(d.x,d.y,d.z);return len<.01||wallDistance(boxes,a,{x:d.x/len,y:d.y/len,z:d.z/len})>len-.05;}
export class Navigation{
 map:ArenaMap;boxes:Box[];cols:number;rows:number;walk:Uint8Array;
 constructor(map:ArenaMap){this.map=map;this.boxes=collisionBoxes(map);this.cols=map.width;this.rows=map.depth;this.walk=new Uint8Array(this.cols*this.rows);for(let n=0;n<this.walk.length;n++){const p=this.point(n);this.walk[n]=clearAt(this.boxes,p.x,p.z,.55)?1:0;}}
 point(n:number){return {x:n%this.cols-this.cols/2+.5,z:Math.floor(n/this.cols)-this.rows/2+.5};}
 index(x:number,z:number){return clamp(Math.floor(z+this.rows/2),0,this.rows-1)*this.cols+clamp(Math.floor(x+this.cols/2),0,this.cols-1);}
 nearest(x:number,z:number){const cell=this.index(x,z);if(this.walk[cell])return cell;let best=-1,distance=Infinity;for(let i=0;i<this.walk.length;i++)if(this.walk[i]){const p=this.point(i),d=(x-p.x)**2+(z-p.z)**2;if(d<distance){distance=d;best=i;}}return best;}
 route(a:{x:number;z:number},b:{x:number;z:number}){
  const start=this.nearest(a.x,a.z),end=this.nearest(b.x,b.z);if(start<0||end<0)return [];
  const prev=new Int32Array(this.walk.length).fill(-1),queue=[start];prev[start]=start;
  for(let q=0;q<queue.length&&prev[end]===-1;q++){const n=queue[q],x=n%this.cols;for(const next of [x>0?n-1:-1,x<this.cols-1?n+1:-1,n-this.cols,n+this.cols]){if(next>=0&&next<this.walk.length&&this.walk[next]&&prev[next]===-1){prev[next]=n;queue.push(next);}}}
  if(prev[end]===-1)return [];const path=[];for(let n=end;n!==start;n=prev[n])path.push(this.point(n));path.push(this.point(start));return path.reverse();
 }
}
const names=['Viper','Ghost','Nova','Rook','Echo','Blaze','Atlas','Jinx','Cipher'];
export class Simulation{
 config:MatchConfig;map:ArenaMap;boxes:Box[];nav:Navigation;rng:()=>number;actors:Actor[]=[];time=180;elapsed=0;balance:number;score=0;enemyScore=0;ended=false;result:Result|null=null;started=false;
 yaw=0;pitch=0;vx=0;vz=0;weapon:WeaponId='rifle';ammo=ammoFor();reserve=reserveFor();roundScore=0;roundEnemyScore=0;headshots=0;maxStreak=0;combatAt=-99;reloadLeft=0;shotCooldown=0;switchLeft=0;aim=0;recoil=0;bloom=0;stamina=100;sprinting=false;fireHeld=false;jumpHeld=false;combo=0;hitMarker=0;headMarker=false;hurt=0;hurtAngle=0;events:GameEvent[]=[];shots:Shot[]=[];feed:Feed[]=[];pickups:Pickup[]=[];feedId=0;
 constructor(config:MatchConfig,rng:()=>number=Math.random){
  this.config=config;this.rng=rng;this.map=getMap(config.mapId);this.boxes=collisionBoxes(this.map);this.nav=new Navigation(this.map);this.balance=config.entry||config.balance;this.weapon=config.weaponRule==='sniper'?'marksman':'rifle';
  const count=config.mode==='duel'?(config.team==='2v2'?4:2):10;
  let starts=this.map.spawns.filter((_,i)=>Array.from({length:count},(_,id)=>Math.floor(id*this.map.spawns.length/count)).includes(i));
  if(config.mode==='duel'){
   const options=[...this.map.spawns].sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)),home=options[0];
   const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
   const rival=options.filter(s=>s!==home).sort((a,b)=>Math.abs(distance(a,home)-25)-Math.abs(distance(b,home)-25))[0];
   const buddies=options.filter(s=>s!==home&&s!==rival),ally=[...buddies].sort((a,b)=>distance(a,home)-distance(b,home))[0],enemyBuddy=buddies.filter(s=>s!==ally).sort((a,b)=>distance(a,rival)-distance(b,rival))[0];
   starts=[home,rival,enemyBuddy,ally];
  }
  for(let id=0;id<count;id++){const spawn=starts[id];this.actors.push({id,name:id===0?'You':names[id-1],team:config.mode==='duel'?(id===0||id===3?0:1):id,x:spawn.x,z:spawn.z,y:0,vy:0,yaw:spawn.yaw,hp:100,kills:0,deaths:0,respawn:0,shield:2,cooldown:1+this.rng(),crouch:false,moving:0,path:[],repath:0,target:-1,reaction:.5,lastDamage:-99});}
  this.yaw=this.player.yaw;this.pickups=this.map.landmarks.map((p,i)=>({x:p.x,z:p.z,kind:i%2?'ammo':'health',ready:0}));
 }
 lastDeathLoss=0;
 killConfirm:{id:number;victim:string;head:boolean;age:number}|null=null;
 stepSound=0;slideQueued=false;slideLeft=0;slideCooldown=0;slideSpeed=0;slideX=0;slideZ=0;crouchHeld=false;slideHeld=false;playerEyeHeight=1.62;
 get sliding(){return this.slideLeft>0;}
 get player(){return this.actors[0];}
 get gun(){return weapons[this.weapon];}
 get allowedWeapons(){return weaponIds.filter(id=>this.config.weaponRule==='sniper'?id==='marksman':this.config.weaponRule==='rifle'?['rifle','carbine'].includes(id):true);}
 get cashOutWait(){return Math.max(0,8-(this.elapsed-this.combatAt));}
 paused=false;
 pause(){if(!this.ended)this.paused=true;}
 cashOut(){if(this.started&&!this.ended&&this.config.mode==='ffa'&&(this.paused||(this.player.hp>0&&this.cashOutWait===0)))this.finish('Arena cash-out');}
 completeRound(){if(this.roundScore===this.roundEnemyScore){this.finish();return;}if(this.roundScore>this.roundEnemyScore)this.score++;else this.enemyScore++;if(this.score>=2||this.enemyScore>=2){this.finish();return;}this.roundScore=0;this.roundEnemyScore=0;this.time=180;for(const actor of this.actors)this.respawn(actor);}
 eye(a:Actor):Vec{return {x:a.x,y:a.y+(a.id===0?this.playerEyeHeight:a.crouch?1.05:1.62),z:a.z};}
 look(dx:number,dy:number){this.yaw-=dx;this.pitch=clamp(this.pitch-dy,-1.35,1.35);}
 start(){if(this.ended)return;this.started=true;this.paused=false;}
 finish(reason?:string){if(this.ended)return;this.ended=true;const won=this.config.mode==='duel'?this.score>this.enemyScore:this.player.kills>this.player.deaths;const draw=this.score===this.enemyScore;const cancel=reason==='Match cancelled';const forfeit=reason==='Duel forfeited';if(this.config.mode==='duel')this.balance+=cancel?(this.config.stake??10):forfeit?0:(won?2*(this.config.stake??10):draw?(this.config.stake??10):0);this.result={kills:this.player.kills,deaths:this.player.deaths,balance:this.balance,reason:reason??(this.config.mode==='duel'?(won?'Duel won':draw?'Draw — stake returned':'Duel lost'):'Round complete'),won:!cancel&&!forfeit&&reason!=='Left the arena'&&won,score:this.score,enemyScore:this.enemyScore,headshots:this.headshots,maxStreak:this.maxStreak,elapsed:this.elapsed,mode:this.config.mode,mapId:this.map.id,rate:this.config.rate,entry:this.config.entry,lastDeathLoss:this.lastDeathLoss};Object.assign(this.result,matchOutcome(this.config,this.result,cancel?'cancel':forfeit||reason==='Left the arena'?'leave':reason==='Arena cash-out'?'cashout':'complete'));}
 leave(){this.finish(!this.started?'Match cancelled':this.config.mode==='duel'?'Duel forfeited':'Left the arena');}
 switchWeapon(id:WeaponId){if(this.weapon===id||!this.allowedWeapons.includes(id))return;this.weapon=id;this.reloadLeft=0;this.switchLeft=.25;this.fireHeld=true;this.bloom=0;}
 reload(){if(this.reloadLeft||this.ammo[this.weapon]>=this.gun.mag||this.reserve[this.weapon]<=0||this.player.hp<=0)return;this.reloadLeft=this.gun.reload;this.events.push({kind:'reload'});}
 respawn(a:Actor){
  const enemies=this.actors.filter(b=>b.id!==a.id&&b.team!==a.team&&b.hp>0);
  const ranked=this.map.spawns.map(s=>{const distance=Math.min(80,...enemies.map(e=>Math.hypot(e.x-s.x,e.z-s.z))),exposure=enemies.some(e=>Math.hypot(e.x-s.x,e.z-s.z)<28&&visible(this.boxes,{x:s.x,y:1.6,z:s.z},this.eye(e)))?9:0;return {s,value:Math.min(25,distance)-Math.max(0,distance-32)*.7-exposure-this.actors.filter(b=>b.id!==a.id&&b.hp>0&&Math.hypot(b.x-s.x,b.z-s.z)<2).length*20+this.rng()*2};}).sort((a,b)=>b.value-a.value);
  const s=ranked[0].s;Object.assign(a,{x:s.x,z:s.z,y:0,vy:0,yaw:s.yaw,hp:100,shield:1.8,respawn:0,path:[],repath:0,cooldown:.8,reaction:.6});
  if(a.id===0){this.lastDeathLoss=0;this.yaw=s.yaw;this.pitch=0;this.vx=this.vz=0;this.slideLeft=this.slideCooldown=this.slideSpeed=0;this.slideQueued=false;this.sprinting=false;this.playerEyeHeight=1.62;a.crouch=false;a.moving=0;this.reloadLeft=0;this.ammo=ammoFor();this.reserve=reserveFor();this.stamina=100;this.events.push({kind:'spawn'});}
 }
 damage(victim:Actor,attacker:Actor,amount:number,head=false){
  if(this.ended||this.paused||victim.hp<=0||victim.shield>0||victim.team===attacker.team||(this.config.weaponRule==='headshots'&&!head))return;if(victim.id===0||attacker.id===0)this.combatAt=this.elapsed;
  victim.hp=Math.max(0,victim.hp-amount);victim.lastDamage=this.elapsed;
  if(attacker.id===0){this.hitMarker=.17;this.headMarker=head;this.events.push({kind:'hit',head});}
  if(victim.id===0){this.hurt=.6;this.hurtAngle=Math.atan2(attacker.x-victim.x,attacker.z-victim.z)+this.yaw;this.events.push({kind:'hurt',angle:this.hurtAngle});}
  if(victim.hp>0)return;
  victim.deaths++;attacker.kills++;victim.respawn=2.4;victim.path=[];
  this.feed.unshift({id:++this.feedId,killer:attacker.name,victim:victim.name,head,you:attacker.id===0||victim.id===0,age:0});this.feed=this.feed.slice(0,5);
  if(attacker.id===0){this.combo++;this.maxStreak=Math.max(this.maxStreak,this.combo);if(head)this.headshots++;this.killConfirm={id:this.feedId,victim:victim.name,head,age:0};this.events.push({kind:'kill',head});if(this.config.mode==='ffa')this.balance+=this.config.rate;}
  if(victim.id===0){this.combo=0;this.slideQueued=false;this.slideLeft=this.slideSpeed=0;this.sprinting=false;if(this.config.mode==='ffa'){this.lastDeathLoss=Math.min(this.balance,this.config.rate);this.balance=Math.max(0,this.balance-this.config.rate);}}
  if(this.config.mode==='duel'){const target=this.config.target??5;if(this.config.bestOf===3){if(attacker.team===0)this.roundScore++;else this.roundEnemyScore++;if(this.roundScore>=target||this.roundEnemyScore>=target)this.completeRound();}else{if(attacker.team===0)this.score++;else this.enemyScore++;if(this.score>=target||this.enemyScore>=target){this.finish();return;}}}
  if(this.config.mode==='ffa'&&this.balance<this.config.rate)this.finish('Round complete');
 }
 cast(attacker:Actor,dir:Vec,damage:number,headMultiplier:number,range:number){
  const from=this.eye(attacker);let distance=Math.min(range,wallDistance(this.boxes,from,dir)),target:Actor|undefined,head=false;
  for(const a of this.actors){if(a.id===attacker.id||a.hp<=0)continue;const scale=a.crouch?.67:1;
   const torso=rayBox(from,dir,{x:a.x-.32,y:a.y+.35,z:a.z-.26},{x:a.x+.32,y:a.y+1.4*scale,z:a.z+.26});
   const skull=rayBox(from,dir,{x:a.x-.22,y:a.y+1.4*scale,z:a.z-.22},{x:a.x+.22,y:a.y+1.84*scale,z:a.z+.22});
   const hit=Math.min(torso,skull);if(hit<distance){distance=hit;target=a;head=skull<torso;}
  }
  this.shots.push({from,to:{x:from.x+dir.x*distance,y:from.y+dir.y*distance,z:from.z+dir.z*distance},friendly:attacker.team===this.player.team,age:0});
  if(target)this.damage(target,attacker,Math.round(damage*(head?headMultiplier:1)),head);
 }
 fire(){
  if(this.ended||this.paused||this.player.hp<=0||this.reloadLeft>0||this.shotCooldown>0||this.switchLeft>0||this.sprinting)return false;
  if(this.ammo[this.weapon]===0){this.reload();return false;}
  this.combatAt=this.elapsed;this.ammo[this.weapon]--;this.shotCooldown=this.gun.interval;this.player.shield=0;
  const spread=this.gun.spread*(1-this.aim*.82)*(this.player.crouch?.7:1)*(this.player.y>0?3:1)+(Math.hypot(this.vx,this.vz)>.5?.009*(1-this.aim*.5):0)+this.bloom*.08;
  const dir=direction(this.yaw+(this.rng()-.5)*spread*2,this.pitch+this.recoil+(this.rng()-.5)*spread*2);
  if(this.weapon==='shotgun'){for(let pellet=0;pellet<8;pellet++)this.cast(this.player,direction(this.yaw+(this.rng()-.5)*spread*2,this.pitch+this.recoil+(this.rng()-.5)*spread*2),this.gun.damage,this.gun.head,this.gun.range);}else this.cast(this.player,dir,this.gun.damage,this.gun.head,this.gun.range);this.recoil=Math.min(.12,this.recoil+this.gun.recoil*(this.aim>.5?.75:1));this.bloom=Math.min(.12,this.bloom+.018);this.events.push({kind:'shot',weapon:this.weapon});return true;
 }
 step(dt:number,input:Controls){
  if(this.ended||this.paused||!this.started)return;
  // The caller supplies fixed simulation steps. Clamp protects collision and AI from a stalled frame.
  dt=clamp(dt,0,1/30);this.elapsed+=dt;this.time=Math.max(0,this.time-dt);
  if(this.time===0){if(this.config.mode==='duel'&&this.config.bestOf===3)this.completeRound();else this.finish();return;}
  this.hitMarker=Math.max(0,this.hitMarker-dt);this.hurt=Math.max(0,this.hurt-dt);this.recoil*=Math.exp(-dt*9);this.bloom*=Math.exp(-dt*4);this.shotCooldown=Math.max(0,this.shotCooldown-dt);this.switchLeft=Math.max(0,this.switchLeft-dt);
  if(this.killConfirm&&(this.killConfirm.age+=dt)>1.1)this.killConfirm=null;
  this.shots=this.shots.filter(s=>(s.age+=dt)<.08);this.feed=this.feed.filter(f=>(f.age+=dt)<5);
  for(const p of this.pickups)p.ready=Math.max(0,p.ready-dt);
  for(const a of this.actors){a.shield=Math.max(0,a.shield-dt);if(a.hp<=0){a.respawn-=dt;if(a.respawn<=0)this.respawn(a);}else if(a.hp<100&&this.elapsed-a.lastDamage>7)a.hp=Math.min(100,a.hp+dt*7);}
  this.slideCooldown=Math.max(0,this.slideCooldown-dt);
  const p=this.player;
  if(p.hp>0){
   if(input.weapon)this.switchWeapon(input.weapon);if(input.reload)this.reload();
   if(this.reloadLeft>0){this.reloadLeft=Math.max(0,this.reloadLeft-dt);if(this.reloadLeft===0){const n=Math.min(this.gun.mag-this.ammo[this.weapon],this.reserve[this.weapon]);this.ammo[this.weapon]+=n;this.reserve[this.weapon]-=n;}}
   const momentum=Math.hypot(this.vx,this.vz),slidePressed=!!input.slide&&!this.slideHeld;
   if(slidePressed)this.slideQueued=true;
   if(this.slideQueued&&p.y===0){
    const f=input.forward,r=input.right,length=Math.hypot(f,r);
    this.slideLeft=.8;this.slideCooldown=0;this.slideSpeed=Math.min(14,Math.max(11,momentum+3.5));
    this.slideX=length?(-Math.sin(this.yaw)*f+Math.cos(this.yaw)*r)/length:momentum>.5?this.vx/momentum:-Math.sin(this.yaw);
    this.slideZ=length?(-Math.cos(this.yaw)*f-Math.sin(this.yaw)*r)/length:momentum>.5?this.vz/momentum:-Math.cos(this.yaw);
    this.slideQueued=false;
   }
   const slideJump=this.sliding&&input.jump&&!this.jumpHeld;
   if(slideJump){this.slideLeft=0;p.vy=5.4;}
   p.crouch=!slideJump&&(input.crouch||this.sliding);this.sprinting=!this.sliding&&input.sprint&&input.forward>0&&!input.aim&&!input.fire&&!p.crouch&&this.stamina>2;
   this.playerEyeHeight+=((p.crouch?1.05:1.62)-this.playerEyeHeight)*(1-Math.exp(-dt*14));
   this.stamina=clamp(this.stamina+(this.sliding?0:this.sprinting?-24:18)*dt,0,100);this.aim+=(Number(input.aim&&!this.sprinting&&!this.sliding)-this.aim)*Math.min(1,dt*14);
   const speed=p.crouch?2.35:this.sprinting?7.5:input.aim?3.15:4.7;
   const length=Math.max(1,Math.hypot(input.forward,input.right)),f=input.forward/length,r=input.right/length;
   const tx=(-Math.sin(this.yaw)*f+Math.cos(this.yaw)*r)*speed,tz=(-Math.cos(this.yaw)*f-Math.sin(this.yaw)*r)*speed;
   if(this.sliding){this.slideSpeed=Math.max(0,this.slideSpeed-7.2*dt);this.vx=this.slideX*this.slideSpeed;this.vz=this.slideZ*this.slideSpeed;}
   else{const response=1-Math.exp(-dt*(p.y>0||slideJump?5:18));this.vx+=(tx-this.vx)*response;this.vz+=(tz-this.vz)*response;}
   const oldX=p.x,oldZ=p.z;moveActor(p,this.vx*dt,this.vz*dt,this.boxes);p.moving=dt>0?Math.hypot(p.x-oldX,p.z-oldZ)/dt:0;p.yaw=this.yaw;
   if(this.sliding){this.slideLeft=Math.max(0,this.slideLeft-dt);if(p.moving<this.slideSpeed*.35||p.y>0)this.slideLeft=0;}
   this.stepSound-=dt;if(p.y===0&&p.moving>1&&!p.crouch&&this.stepSound<=0){this.events.push({kind:'footstep'});this.stepSound=this.sprinting?.28:.4;}
   if(input.jump&&!this.jumpHeld&&p.y===0&&!p.crouch){p.vy=5.4;}p.vy-=20*dt;p.y=Math.max(0,p.y+p.vy*dt);if(p.y===0)p.vy=0;
   if(input.fire&&(this.gun.auto||!this.fireHeld))this.fire();
   for(const pickup of this.pickups)if(pickup.ready===0&&Math.hypot(p.x-pickup.x,p.z-pickup.z)<1.1){
    if(pickup.kind==='health'&&p.hp<100){p.hp=Math.min(100,p.hp+45);pickup.ready=18;this.events.push({kind:'pickup'});}
    else if(pickup.kind==='ammo'&&weaponIds.some(id=>this.reserve[id]<(id==='marksman'?40:180))){for(const id of weaponIds)this.reserve[id]=Math.min(id==='marksman'?40:180,this.reserve[id]+weapons[id].mag*2);pickup.ready=15;this.events.push({kind:'pickup'});}
   }
  }else{this.sprinting=false;this.slideQueued=false;this.slideLeft=this.slideSpeed=0;this.vx=this.vz=0;this.reloadLeft=0;}
  this.fireHeld=input.fire;this.jumpHeld=input.jump;this.crouchHeld=input.crouch;this.slideHeld=!!input.slide;
  if(this.ended)return;
  for(const bot of this.actors.slice(1)){if(bot.hp>0)this.botStep(bot,dt);if(this.ended)return;}
 }
 botStep(bot:Actor,dt:number){
  bot.cooldown-=dt;bot.repath-=dt;
  const enemies=this.actors.filter(a=>a.team!==bot.team&&a.hp>0);
  const seen=enemies.filter(a=>Math.hypot(a.x-bot.x,a.z-bot.z)<38&&visible(this.boxes,this.eye(bot),this.eye(a))).sort((a,b)=>Math.hypot(a.x-bot.x,a.z-bot.z)-Math.hypot(b.x-bot.x,b.z-bot.z));
  const target=seen[0]??enemies.sort((a,b)=>Math.hypot(a.x-bot.x,a.z-bot.z)-Math.hypot(b.x-bot.x,b.z-bot.z))[0];
  if(!target)return;
  const dx=target.x-bot.x,dz=target.z-bot.z,distance=Math.max(.001,Math.hypot(dx,dz)),canSee=seen.includes(target);
  if(bot.target!==target.id){bot.target=target.id;bot.reaction=.35+this.rng()*.4;bot.repath=0;}bot.reaction-=dt;
  bot.yaw=Math.atan2(-dx,-dz);
  let mx=0,mz=0;
  if(canSee&&distance<19){const side=Math.sin(this.elapsed*.85+bot.id*2)>0?1:-1;const approach=distance>12?.65:distance<5?-.6:0;mx=(dx/distance*approach+dz/distance*side*.65)*2.7;mz=(dz/distance*approach-dx/distance*side*.65)*2.7;bot.path=[];}
  else{
   if(bot.repath<=0||!bot.path.length){bot.path=this.nav.route(bot,target);bot.repath=.8+this.rng()*.65;}
   while(bot.path.length&&Math.hypot(bot.path[0].x-bot.x,bot.path[0].z-bot.z)<.22)bot.path.shift();
   if(bot.path.length){const next=bot.path[0],length=Math.hypot(next.x-bot.x,next.z-bot.z);mx=(next.x-bot.x)/length*3.2;mz=(next.z-bot.z)/length*3.2;}
  }
  moveActor(bot,mx*dt,mz*dt,this.boxes);bot.moving=Math.hypot(mx,mz);
  if(canSee&&bot.reaction<=0&&bot.cooldown<=0&&bot.shield<=.8){
   const restricted=this.config.weaponRule==='sniper'?weapons.marksman:null;bot.shield=0;bot.cooldown=restricted?restricted.interval+.15+this.rng()*.2:.27+this.rng()*.32;
   const from=this.eye(bot),aimY=target.y+(this.config.weaponRule==='headshots'?(target.crouch?1.04:1.52):(target.crouch?.82:1.18)),pitch=Math.atan2(aimY-from.y,Math.max(.1,distance));
   const error=(this.config.mode==='practice'?.055:.038)*(distance<5?.65:1);
   this.cast(bot,direction(bot.yaw+(this.rng()-.5)*error*2,pitch+(this.rng()-.5)*error*2),restricted?restricted.damage:(this.config.mode==='practice'?13:17),1.5,50);
   const listenerDistance=Math.hypot(bot.x-this.player.x,bot.z-this.player.z);if(listenerDistance<28)this.events.push({kind:'enemyShot',distance:listenerDistance});
  }
 }
}
