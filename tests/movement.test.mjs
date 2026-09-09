import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,idleInput,weaponIds} from '../lib/fps/simulation.ts';
import {ViewMotion} from '../lib/fps/view-motion.ts';
const dt=1/60,run={...idleInput(),forward:1,sprint:true};
function isolated(){const s=new Simulation({mode:'practice',rate:2,team:'1v1',balance:100},()=>.5);s.actors=[s.player];s.boxes=[];s.pickups=[];Object.assign(s.player,{x:0,z:0,y:0,shield:0});s.yaw=0;s.start();return s;}
function advance(s,time,input=idleInput()){for(let n=0;n<Math.round(time/dt);n++)s.step(dt,input);}
function sliding(){const s=isolated();s.step(dt,{...idleInput(),slide:true});assert.ok(s.sliding);return s;}
test('slide starts standing, walking, aiming or exhausted without sprint',()=>{
 for(const input of [idleInput(),{...idleInput(),forward:1},{...idleInput(),aim:true}]){const s=isolated();s.stamina=0;s.step(dt,{...input,slide:true});assert.ok(s.sliding);assert.ok(s.player.moving>7);}
});
test('an airborne slide press survives release and triggers on landing',()=>{
 const s=isolated();s.step(dt,{...idleInput(),jump:true});s.step(dt,{...idleInput(),slide:true});assert.ok(s.slideQueued&&!s.sliding);
 advance(s,.55);assert.ok(s.sliding&&!s.slideQueued);
});
test('slide keeps direction, decays and holding the key does not auto repeat',()=>{
 const s=sliding(),z=s.player.z;s.yaw=Math.PI;advance(s,.35,{...run,slide:true});assert.ok(s.player.z<z-1.5);assert.ok(s.eye(s.player).y<1.1);
 advance(s,1.5,{...idleInput(),slide:true});assert.equal(s.sliding,false);assert.equal(s.slideQueued,false);
 s.step(dt,idleInput());s.step(dt,{...idleInput(),slide:true});assert.ok(s.sliding,'a new press can immediately slide again');
});
test('slide respects thin-wall collision and stops when blocked',()=>{
 const s=sliding(),face=s.player.z-.6;s.boxes=[{x:0,z:face-.1,w:10,d:.2,h:4,material:'concrete'}];advance(s,.5);assert.ok(s.player.z>=face+.39);assert.equal(s.sliding,false);
});
test('slide jump cancels the slide and permits another slide on landing',()=>{
 const s=sliding();s.step(dt,{...run,jump:true});assert.ok(!s.sliding&&s.player.vy>0);s.step(dt,{...run,slide:true});advance(s,.55);assert.ok(s.sliding);
});
test('death and respawn clear pending and current slides',()=>{
 const s=sliding();s.slideQueued=true;s.damage(s.player,{id:1,team:1,x:0,z:2,kills:0},100);assert.ok(!s.sliding&&!s.slideQueued);s.respawn(s.player);assert.equal(s.player.crouch,false);assert.equal(s.eye(s.player).y,1.62);assert.equal(s.vx,0);
});
test('Ctrl crouch does not slide and shares smooth eye height with shot origin',()=>{
 const s=isolated();s.step(dt,{...idleInput(),crouch:true});assert.equal(s.sliding,false);assert.ok(s.eye(s.player).y>1.45&&s.eye(s.player).y<1.62);s.fire();assert.equal(s.shots[0].from.y,s.eye(s.player).y);advance(s,.5,{...idleInput(),crouch:true});assert.ok(Math.abs(s.eye(s.player).y-1.05)<.002);
});
test('six playable weapons exclude both pistols even in a legacy pistol match',()=>{
 assert.equal(weaponIds.length,6);for(const rule of ['standard','pistol']){const s=new Simulation({mode:'practice',rate:2,team:'1v1',balance:100,weaponRule:rule});assert.equal(s.weapon,'rifle');s.switchWeapon('pistol');assert.equal(s.weapon,'rifle');assert.ok(!s.allowedWeapons.includes('handcannon'));}
});
test('kill confirmation is only emitted for a confirmed elimination and expires',()=>{
 const s=isolated(),victim={...s.player,id:1,team:1,name:'Target',hp:100,shield:0};s.damage(victim,s.player,20);assert.equal(s.killConfirm,null);s.damage(victim,s.player,100,true);assert.equal(s.killConfirm.victim,'Target');assert.equal(s.killConfirm.head,true);const id=s.killConfirm.id;s.damage(victim,s.player,100);assert.equal(s.killConfirm.id,id);advance(s,1.2);assert.equal(s.killConfirm,null);
});
const base={speed:0,grounded:true,vy:0,crouch:false,sprinting:false,sliding:false,aim:0,reload:0,switching:false,kick:0,sightHeight:.15};
test('weapon stance transitions are bounded and smooth through sprint, jump, landing and slide',()=>{
  const motion=new ViewMotion();let previous=motion.step(dt,base);
  for(let n=0;n<720;n++){
    const phase=n%180,s={...base,speed:phase<100?7.5:0,sprinting:phase<40,grounded:phase<40||phase>=80,vy:phase<60?4:-4,sliding:phase>=100&&phase<140,crouch:phase>=100&&phase<140};
    const pose=motion.step(dt,s);
    for(const v of Object.values(pose))assert.ok(Number.isFinite(v));
    for(const key of ['x','y','z','rx','ry','rz'])assert.ok(Math.abs(pose[key]-previous[key])<.025,`${key} snaps`);
    assert.ok(pose.z<-.59);assert.ok(Math.abs(pose.ry)<.13&&Math.abs(pose.rz)<.15);previous=pose;
  }
  const frozen=motion.step(0,base);assert.deepEqual(motion.step(0,base),frozen,'paused frames must not advance motion');
});
test('movement damping is independent of render refresh rate',()=>{
  const slow=new ViewMotion(),fast=new ViewMotion(),sample={...base,speed:7.5,sprinting:true};let a,b;
  for(let n=0;n<30;n++)a=slow.step(1/30,sample);for(let n=0;n<144;n++)b=fast.step(1/144,sample);
  assert.ok(Math.abs(a.sprintBlend-b.sprintBlend)<1e-8);assert.ok(Math.abs(a.ry-b.ry)<1e-8);
});
