import {test} from 'node:test';import assert from 'node:assert/strict';import {MouseLook} from '../lib/fps/mouse-look.ts';
const rect={left:10,top:20,width:1000,height:600};
test('fallback mouse look uses cursor positions without a held button or movementX',()=>{const m=new MouseLook();assert.deepEqual(m.move(300,300,rect),{x:0,y:0});assert.deepEqual(m.move(420,250,rect),{x:120,y:-50});assert.equal(m.edge,0)});
test('edge turning supports a full rotation and stops outside the canvas',()=>{const m=new MouseLook();m.move(1009,300,rect);assert.ok(m.edge>.9);m.move(11,300,rect);assert.ok(m.edge<-.9);m.move(5,300,rect);assert.equal(m.edge,0);assert.deepEqual(m.move(500,300,rect),{x:0,y:0})});
test('resuming and capture changes discard stale cursor coordinates',()=>{const m=new MouseLook();m.move(300,300,rect);m.reset();assert.deepEqual(m.move(800,200,rect),{x:0,y:0})});
