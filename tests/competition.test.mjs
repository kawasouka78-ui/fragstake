import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,weapons,weaponIds} from '../lib/fps/simulation.ts';
const config={mode:'duel',rate:2,team:'1v1',balance:75,stake:25,target:10};
function eliminate(g){const victim=g.actors[1];victim.hp=100;victim.shield=0;g.damage(victim,g.player,200,true);}
test('best of three requires two round wins and pays one pot',()=>{const g=new Simulation({...config,bestOf:3});g.start();for(let i=0;i<10;i++)eliminate(g);assert.equal(g.score,1);assert.equal(g.roundScore,0);assert.equal(g.ended,false);for(let i=0;i<10;i++)eliminate(g);assert.equal(g.score,2);assert.equal(g.result.balance,125);assert.equal(g.result.kills,20)});
test('six weapons have ammunition and rifle rules restrict selection',()=>{assert.equal(weaponIds.length,6);const g=new Simulation({...config,weaponRule:'rifle'});for(const id of weaponIds){assert.ok(weapons[id].damage>0);assert.ok(g.ammo[id]>0)}assert.deepEqual(g.allowedWeapons,['rifle','carbine']);g.switchWeapon('marksman');assert.equal(g.weapon,'rifle');g.switchWeapon('carbine');assert.equal(g.weapon,'carbine')});
test('headshots only rejects body hits',()=>{const g=new Simulation({...config,weaponRule:'headshots'});g.start();const v=g.actors[1];v.shield=0;g.damage(v,g.player,200,false);assert.equal(v.hp,100);g.damage(v,g.player,200,true);assert.equal(g.score,1)});
test('funded Arena cash-out waits eight seconds after combat',()=>{const g=new Simulation({...config,mode:'ffa',entry:20,balance:80});g.start();assert.equal(g.balance,20);g.combatAt=0;g.elapsed=7;g.cashOut();assert.equal(g.ended,false);g.elapsed=8;g.cashOut();assert.equal(g.result.reason,'Arena cash-out');assert.equal(g.result.balance,20);g.cashOut();assert.equal(g.result.balance,20)});
