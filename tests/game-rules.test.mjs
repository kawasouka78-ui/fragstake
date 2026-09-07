import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canEnter, killBalance, deathBalance, duelPayout } from '../lib/game-rules.ts';
test('practice never changes the demo wallet',()=>{assert.equal(killBalance(100,'practice',2),100);assert.equal(deathBalance(100,'practice',2),100);assert.equal(canEnter({mode:'practice',rate:2,team:'1v1',balance:0}),true)});
test('FFA transfers equal amounts for kills and deaths at every tier',()=>{for(const rate of [2,5,10]){assert.equal(killBalance(100,'ffa',rate),100+rate);assert.equal(deathBalance(100,'ffa',rate),100-rate);assert.equal(deathBalance(killBalance(100,'ffa',rate),'ffa',rate),100);assert.equal(canEnter({mode:'ffa',rate,team:'1v1',balance:rate-1}),false)}});
test('FFA balance stays non-negative and checks another death is affordable',()=>{assert.equal(deathBalance(2,'ffa',2),0);assert.equal(deathBalance(1,'ffa',2),0);assert.equal(canEnter({mode:'ffa',rate:2,team:'1v1',balance:0}),false)});
test('each duel winner receives twenty, including each winning teammate',()=>{assert.equal(100-10+duelPayout(true,false),110);assert.equal(100-10+duelPayout(false,false),90);assert.equal(100-10+duelPayout(false,true),100);assert.equal(duelPayout(true,false)*2,40);assert.equal(canEnter({mode:'duel',rate:2,team:'2v2',balance:9}),false)});
