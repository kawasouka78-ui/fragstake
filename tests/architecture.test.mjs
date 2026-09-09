import test from 'node:test';
import assert from 'node:assert/strict';
import {citadelDoors,citadelRooms,citadelWalkable,citadelRoomSigns,collisionBoxes,maps} from '../lib/fps/maps.ts';
import {clearAt,Navigation} from '../lib/fps/simulation.ts';

test('every portal crosses a complete opening and has solid backing at both jambs',()=>{
 assert.ok(citadelDoors.length>=24);
 for(const door of citadelDoors){
  const point=(along,normal)=>({x:door.x+(door.axis==='x'?along:normal),z:door.z+(door.axis==='z'?along:normal)});
  for(const side of [-1,1]){
   for(const depth of [.03,.13]){const p=point(side*(door.width/2+.03),-door.roomNormal*depth);assert.equal(citadelWalkable(p.x,p.z),false);}
   for(const along of [-1.5,0,1.5]){const p=point(along,side*.3);assert.equal(citadelWalkable(p.x,p.z),true);}
  }
  assert.ok(clearAt(collisionBoxes(maps[0]),door.x,door.z,.55));
  assert.notEqual(door.room,door.destination);
  assert.equal(door.label,door.destination.name.toUpperCase());
 }
});

test('every room plaque is backed by a continuous wall across its full width',()=>{
 assert.equal(citadelRoomSigns.length,citadelRooms.length);
 for(const p of citadelRoomSigns)for(let along=-2.1;along<=2.1;along+=.1){
  const ax=p.axis==='x',x=p.x+(ax?along:-p.normal*.05),z=p.z+(ax?-p.normal*.05:along);
  assert.equal(citadelWalkable(x,z),false,p.room.name);
  assert.equal(citadelWalkable(x+(ax?0:p.normal*.2),z+(ax?p.normal*.2:0)),true,p.room.name);
 }
});

test('all starts and room landmarks remain reachable after removing junction frames',()=>{
 const map=maps[0],nav=new Navigation(map),boxes=collisionBoxes(map);
 for(const point of [...map.spawns,...map.landmarks]){assert.ok(clearAt(boxes,point.x,point.z,.4));assert.ok(nav.route(map.spawns[0],point).length);}
});
