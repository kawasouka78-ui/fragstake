import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,idleInput} from '../lib/fps/simulation.ts';
import {ViewMotion} from '../lib/fps/view-motion.ts';
const dt=1/60,run={...idleInput(),forward:1,sprint:true};
function isolated(){const s=new Simulation({mode:'practice',rate:2,team:'1v1',balance:100},()=>.5);s.actors=[s.player];s.boxes=[];s.pickups=[];Object.assign(s.player,{x:0,z:0,y:0,shield:0});s.yaw=0;s.start();return s;}
function advance(s,time,input=idleInput()){for(let n=0;n<Math.round(time/dt);n++)s.step(dt,input);}
function sliding(){const s=isolated();advance(s,.4,run);s.step(dt,{...run,crouch:true});assert.ok(s.sliding);return s;}

test('slide needs a fresh press, ground contact, sprint momentum and stamina',()=>{
  const stationary=isolated();stationary.step(dt,{...run,crouch:true});assert.equal(stationary.sliding,false);
  const walking=isolated();advance(walking,.5,{...run,sprint:false});walking.step(dt,{...run,crouch:true});assert.equal(walking.sliding,false);
  const airborne=isolated();advance(airborne,.4,run);airborne.player.y=.3;airborne.step(dt,{...run,crouch:true});assert.equal(airborne.sliding,false);
  const tired=isolated();advance(tired,.4,run);tired.stamina=10;tired.step(dt,{...run,crouch:true});assert.equal(tired.sliding,false);
});
test('slide carries momentum, lowers stance, consumes stamina and expires without repeating',()=>{
  const s=isolated();advance(s,.4,run);const speed=s.player.moving,stamina=s.stamina,startZ=s.player.z;
  s.step(dt,{...run,crouch:true});assert.ok(s.sliding&&s.player.crouch&&!s.sprinting);assert.ok(s.player.moving>speed);assert.ok(stamina-s.stamina>=19.9);
  s.yaw=Math.PI;advance(s,.35,{...run,crouch:true});assert.ok(s.player.z<startZ-2,'looking backward cannot reverse a slide');assert.ok(s.eye(s.player).y<1.1);
  advance(s,1.5,{...run,crouch:true});assert.equal(s.sliding,false);assert.ok(s.player.crouch);assert.ok(s.player.moving<2.5);
});
test('slide respects thin-wall collision and stops when blocked',()=>{
  const s=sliding();const face=s.player.z-.6;s.boxes=[{x:0,z:face-.1,w:10,d:.2,h:4,material:'concrete'}];
  advance(s,.5,{...run,crouch:true});assert.ok(s.player.z>=face+.39);assert.equal(s.sliding,false);
});
test('jump cancels a slide and cooldown blocks a second boost',()=>{
  const s=sliding();s.step(dt,{...run,jump:true});assert.equal(s.sliding,false);assert.ok(s.player.y>0&&s.player.vy>0);
  assert.ok(s.slideCooldown>0);s.player.y=0;s.player.vy=0;s.step(dt,run);s.step(dt,{...run,crouch:true});assert.equal(s.sliding,false);
});
test('touch slide request uses the same momentum rules and death clears slide state',()=>{
  const s=isolated();advance(s,.4,run);s.step(dt,{...run,slide:true});assert.ok(s.sliding);
  s.damage(s.player,{id:1,team:1,x:0,z:2,kills:0},100);assert.equal(s.sliding,false);
  s.respawn(s.player);assert.equal(s.slideCooldown,0);assert.equal(s.player.crouch,false);assert.equal(s.eye(s.player).y,1.62);assert.equal(s.vx,0);assert.equal(s.vz,0);
});
test('crouch eye motion is smooth and shared by camera and shot origin',()=>{
  const s=isolated();s.step(dt,{...idleInput(),crouch:true});assert.ok(s.eye(s.player).y>1.45&&s.eye(s.player).y<1.62);
  s.fire();assert.equal(s.shots[0].from.y,s.eye(s.player).y);advance(s,.5,{...idleInput(),crouch:true});assert.ok(Math.abs(s.eye(s.player).y-1.05)<.002);
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
