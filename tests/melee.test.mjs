import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,idleInput,weapons} from '../lib/fps/simulation.ts';
import {LiveRoom} from '../lib/live/world.ts';
import {NetworkSimulation} from '../lib/live/client.ts';

class StationaryTargets extends Simulation { botStep() {} }
const config={mode:'practice',mapId:'citadel',rate:2,balance:100,team:'1v1'};
const advance=(g,seconds,input=idleInput())=>{for(let t=0;t<seconds;t+=1/60)g.step(1/60,input);};
function arena(style='karambit'){
  const g=new StationaryTargets({...config,knifeStyle:style},()=>.5);
  g.actors=g.actors.slice(0,3);g.boxes=[];g.pickups=[];
  Object.assign(g.player,{x:0,y:0,z:0,shield:0});g.yaw=g.pitch=0;
  Object.assign(g.actors[1],{x:.45,y:0,z:-1.35,shield:0});
  Object.assign(g.actors[2],{x:0,y:0,z:-8,shield:0});
  g.start();g.switchWeapon('knife');advance(g,.3);return g;
}
for(const style of ['standard','karambit'])test(`${style}: short clicks slash off-centre targets, holding repeats, and kills are counted once`,()=>{
  const g=arena(style),target=g.actors[1];
  g.step(1/60,{...idleInput(),firePressed:true});
  assert.equal(target.hp,25);assert.equal(g.shots.length,0);assert.equal(g.recoil,0);
  assert.ok(g.events.some(e=>e.kind==='shot'&&e.weapon==='knife'));assert.ok(g.hitMarker>0);
  advance(g,.3,{...idleInput(),fire:true});assert.equal(target.hp,25,'cannot skip cooldown');
  advance(g,.4,{...idleInput(),fire:true});assert.equal(target.hp,0);assert.equal(g.player.kills,1);
  assert.equal(g.killConfirm.victim,target.name);assert.equal(g.ammo.knife,1);assert.equal(g.actors[2].hp,100);
});
test('knife clicks during draw and near the end of cooldown are buffered only briefly',()=>{
  const g=arena(),target=g.actors[1];g.switchWeapon('rifle');advance(g,.3);g.switchWeapon('knife');
  g.step(1/60,{...idleInput(),firePressed:true});assert.equal(target.hp,100);
  advance(g,.26);assert.equal(target.hp,25);
  advance(g,.32);g.step(1/60,{...idleInput(),firePressed:true});advance(g,.23);assert.equal(target.hp,0);
  const early=arena();early.fire();early.step(1/60,{...idleInput(),firePressed:true});advance(early,.6);
  assert.equal(early.actors[1].hp,25,'an old click must not cause a delayed surprise swing');
});
test('melee respects walls, range, the forward arc, shields and teams',()=>{
  const cases=[
    g=>g.boxes=[{x:0,z:-.65,w:3,d:.12,h:3,material:'concrete'}],
    g=>g.actors[1].z=-2.3,
    g=>Object.assign(g.actors[1],{x:1.5,z:0}),
    g=>g.actors[1].shield=2,
    g=>g.actors[1].team=g.player.team,
  ];
  for(const setup of cases){const g=arena();setup(g);g.fire();assert.equal(g.actors[1].hp,100);}
  const g=arena();Object.assign(g.actors[2],{x:.45,z:-1.8});g.fire();
  assert.equal(g.actors[1].hp,25);assert.equal(g.actors[2].hp,100,'one target per swing');
});
test('melee remains usable while sliding and jumping, with no aim slowdown or firing after pause',()=>{
  for(const movement of [{slide:true},{jump:true},{sprint:true,forward:1}]){
    const g=arena();g.step(1/60,{...idleInput(),...movement,firePressed:true});assert.equal(g.actors[1].hp,25);
  }
  const g=arena();advance(g,.1,{...idleInput(),aim:true});assert.equal(g.aim,0);
  g.switchWeapon('rifle');g.switchWeapon('knife');g.step(1/60,{...idleInput(),firePressed:true});
  g.pause();advance(g,.5,{...idleInput(),fire:true});assert.equal(g.actors[1].hp,100);
  g.start();advance(g,.5);assert.equal(g.actors[1].hp,100);
  g.player.hp=0;g.step(1/60,{...idleInput(),firePressed:true});assert.equal(g.actors[1].hp,100);
});

const claims=id=>({sub:id,name:id,guest:true,mode:'ffa',mapId:'citadel',aud:'skillclash-game',nonce:id,exp:Date.now()+60000});
test('live melee uses the same sweep, preserves quick taps between packets, and returns to the chosen gun',()=>{
  const room=new LiveRoom('ffa','citadel'),a=room.add(claims('a')),b=room.add(claims('b'));
  a.game.switchWeapon('marksman');room.ready('a');room.ready('b');room.step();
  for(const p of [a,b]){p.game.boxes=[];p.game.player.shield=0;p.game.player.y=0;}
  Object.assign(a.game.player,{x:0,z:0});Object.assign(b.game.player,{x:.45,z:-1.35});
  let seq=0;const input=c=>room.input('a',{type:'input',seq:++seq,yaw:0,pitch:0,controls:{...idleInput(),...c}});
  input({weapon:'knife'});for(let i=0;i<10;i++)room.step();
  input({firePressed:true});input({fire:false});room.step();
  assert.equal(b.game.player.hp,25);assert.equal(a.game.shots.length,0);assert.equal(b.game.shots.length,0);
  for(let i=0;i<17;i++)room.step();input({firePressed:true});room.step();
  assert.equal(b.game.player.hp,0);assert.equal(room.snapshot('a').actors[0].kills,1);
  input({weapon:'marksman'});room.step();assert.equal(room.snapshot('a').state.weapon,'marksman');
  assert.equal(room.snapshot('a').state.matchWeapon,'marksman');
});
test('live client retains press events and sends the selected gun before ready',()=>{
  const g=new NetworkSimulation(config),sent=[];g.send=v=>sent.push(structuredClone(v));
  g.switchWeapon('smg');g.start();
  assert.equal(sent[0].type,'input');assert.equal(sent[0].controls.weapon,'smg');assert.equal(sent[1].type,'ready');
  g.step(1/60,{...idleInput(),firePressed:true});g.step(1/60,idleInput());g.flushInput();
  assert.equal(sent.at(-1).controls.firePressed,true);g.flushInput();assert.equal(sent.at(-1).controls.firePressed,false);
  assert.equal(weapons.knife.damage,75);
});
