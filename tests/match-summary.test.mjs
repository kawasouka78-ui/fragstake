import test from 'node:test';
import assert from 'node:assert/strict';
import {matchOutcome,signedEuros} from '../lib/match-summary.ts';
import {Simulation,idleInput} from '../lib/fps/simulation.ts';

const ffa={mode:'ffa',rate:2,team:'1v1',balance:80,entry:20};
const stats={kills:5,deaths:2,score:0,enemyScore:0,headshots:2,maxStreak:3};
test('exit preview distinguishes cashout earnings from forfeited session credits',()=>{
 assert.deepEqual(matchOutcome(ffa,stats,'cashout'),{net:6,returned:26});
 assert.deepEqual(matchOutcome(ffa,stats,'leave'),{net:-20,returned:0});
 assert.deepEqual(matchOutcome(ffa,{...stats,kills:0,deaths:0,headshots:0,maxStreak:0},'cancel'),{net:0,returned:20});
 assert.equal(signedEuros(6),'+€6.00');assert.equal(signedEuros(-2),'−€2.00');
});
test('legacy FFA preview settles its net change without inventing a reserved entry',()=>{
 assert.deepEqual(matchOutcome({...ffa,entry:0,balance:100},stats,'leave'),{net:6,returned:6});
 assert.deepEqual(matchOutcome({...ffa,entry:0,balance:5},{...stats,kills:0,deaths:2,headshots:0,maxStreak:0},'complete'),{net:-4,returned:-4});
});
test('duel forfeit, victory and draw reports show actual stake outcomes',()=>{
 const config={mode:'duel',rate:2,team:'1v1',balance:90,stake:10,target:5};
 assert.deepEqual(matchOutcome(config,{...stats,score:4,enemyScore:1},'leave'),{net:-10,returned:0});
 assert.deepEqual(matchOutcome(config,{...stats,score:5,enemyScore:2},'complete'),{net:10,returned:20});
 assert.deepEqual(matchOutcome(config,{...stats,score:2,enemyScore:2},'complete'),{net:0,returned:10});
});
test('every death exposes its actual deduction once, including the terminal death report',()=>{
 const g=new Simulation(ffa,()=>.5);g.start();g.player.shield=0;const bot=g.actors[1];
 g.damage(g.player,bot,25);assert.equal(g.lastDeathLoss,0);
 g.damage(g.player,bot,100);assert.equal(g.lastDeathLoss,2);assert.equal(g.balance,18);
 g.damage(g.player,bot,100);assert.equal(g.balance,18);assert.equal(g.player.deaths,1);
 for(let i=1;i<10;i++){g.respawn(g.player);assert.equal(g.lastDeathLoss,0);g.player.shield=0;g.damage(g.player,bot,100);}
 assert.ok(g.ended);assert.equal(g.result.lastDeathLoss,2);assert.equal(g.result.net,-20);assert.equal(g.result.returned,0);assert.equal(g.result.deaths,10);
});
test('safe cashout freezes the result and preserves elapsed time and combat stats',()=>{
 const g=new Simulation(ffa,()=>.5);g.cashOut();assert.equal(g.ended,false);g.start();Object.assign(g.player,{kills:5,deaths:2});Object.assign(g,{headshots:2,maxStreak:3,balance:26,elapsed:50,combatAt:44});g.cashOut();assert.equal(g.ended,false);
 g.elapsed=52;g.cashOut();assert.ok(g.ended);assert.equal(g.result.net,6);assert.equal(g.result.returned,26);assert.equal(g.result.elapsed,52);assert.equal(g.result.headshots,2);assert.equal(g.result.maxStreak,3);
 const result={...g.result};g.cashOut();g.step(1/60,idleInput());assert.deepEqual(g.result,result);
});
test('faster slides cover over six metres without exceeding the speed cap',()=>{
 const g=new Simulation({mode:'practice',rate:2,team:'1v1',balance:0},()=>.5);g.actors=[g.player];g.boxes=[];g.pickups=[];Object.assign(g.player,{x:0,z:0});g.yaw=0;g.start();g.step(1/60,{...idleInput(),slide:true});assert.ok(g.player.moving>10.8);
 for(let n=1;n<48;n++)g.step(1/60,idleInput());assert.ok(-g.player.z>6.3);assert.ok(g.player.moving<14);
});
