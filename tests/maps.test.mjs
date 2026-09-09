import test from 'node:test';
import assert from 'node:assert/strict';
import {maps,getMap,getMapLayout,citadelFloor,citadelDoors,citadelEdges,citadelRooms,citadelWalkable,collisionBoxes} from '../lib/fps/maps.ts';
import {ArenaWorld} from '../lib/fps/world.ts';
import {Simulation,Navigation,clearAt} from '../lib/fps/simulation.ts';

test('three authored maps select distinct footprints; legacy names retain Citadel',()=>{
 assert.deepEqual(maps.map(m=>m.id),['citadel','depot','underpass']);
 for(const id of ['foundry','relay','drydock','missing',undefined])assert.equal(getMap(id),maps[0]);
 for(const map of maps){assert.equal(getMap(map.id),map);assert.equal(getMapLayout(map),getMapLayout(map.id));}
 assert.equal(citadelFloor,getMapLayout('citadel').floor);assert.equal(citadelDoors,getMapLayout('citadel').doors);assert.equal(citadelEdges,getMapLayout('citadel').edges);assert.equal(citadelRooms,getMapLayout('citadel').rooms);assert.equal(citadelWalkable,getMapLayout('citadel').walkable);
 assert.equal(new Set(maps.map(m=>m.width+':'+m.depth)).size,3);
 assert.equal(new Set(maps.map(m=>JSON.stringify(getMapLayout(m).rooms.map(({x1,x2,z1,z2})=>({x1,x2,z1,z2}))))).size,3);
});

for(const map of maps){const layout=getMapLayout(map);
 test(map.name+': every navigable cell, spawn and pickup belongs to one connected play space',()=>{
  const nav=new Navigation(map),start=nav.nearest(map.spawns[0].x,map.spawns[0].z),seen=new Set([start]),queue=[start];
  for(let i=0;i<queue.length;i++){const n=queue[i],x=n%nav.cols;for(const next of [x>0?n-1:-1,x<nav.cols-1?n+1:-1,n-nav.cols,n+nav.cols])if(next>=0&&next<nav.walk.length&&nav.walk[next]&&!seen.has(next)){seen.add(next);queue.push(next);}}
  assert.equal(seen.size,nav.walk.reduce((n,w)=>n+w,0),'there must be no disconnected walkable pockets');
  const sim=new Simulation({mapId:map.id,mode:'duel',rate:2,team:'2v2',balance:90});
  for(const p of [...map.spawns,...map.landmarks,...sim.pickups]){assert.ok(clearAt(collisionBoxes(map),p.x,p.z,.55),JSON.stringify(p));assert.ok(nav.route(map.spawns[0],p).length);}
  for(const b of map.walls.filter(b=>b.material!=='concrete'&&b.material!=='frame'))for(const sx of [-1,1])for(const sz of [-1,1])assert.ok(layout.walkable(b.x+sx*(b.w/2-.01),b.z+sz*(b.d/2-.01)),'room equipment stays inside its floor footprint');
 });
 test(map.name+': all portal jambs and room-name plaques have continuous solid backing',()=>{
  assert.ok(layout.doors.length>=16);assert.equal(layout.roomSigns.length,layout.rooms.length);
  for(const door of layout.doors){
   const point=(along,normal)=>({x:door.x+(door.axis==='x'?along:normal),z:door.z+(door.axis==='z'?along:normal)});
   for(const side of [-1,1])for(const depth of [.03,.13]){const p=point(side*(door.width/2+.03),-door.roomNormal*depth);assert.equal(layout.walkable(p.x,p.z),false);}
   for(const side of [-1,1])for(let along=-door.width/2+.5;along<door.width/2;along+=1){const p=point(along,side*.3);assert.equal(layout.walkable(p.x,p.z),true);}
   assert.ok(clearAt(collisionBoxes(map),door.x,door.z,.55));assert.notEqual(door.room,door.destination);
  }
  for(const p of layout.roomSigns)for(let along=-2.1;along<=2.1;along+=.1){const ax=p.axis==='x',x=p.x+(ax?along:-p.normal*.05),z=p.z+(ax?-p.normal*.05:along);assert.equal(layout.walkable(x,z),false);assert.equal(layout.walkable(x+(ax?0:p.normal*.2),z+(ax?p.normal*.2:0)),true);}
 });
 test(map.name+': the renderer uses only selected-room labels with correct portal destinations',()=>{
  const signs=[],world=Object.create(ArenaWorld.prototype);world.map=map;world.sign=(...args)=>signs.push(args);world.buildWayfinding();
  assert.equal(signs.length,layout.rooms.length*2+layout.doors.length*2);
  for(const door of layout.doors){const ax=door.axis==='x',labels=signs.filter(s=>s[2]===3.83&&Math.abs(s[1]-door.x)<.2&&Math.abs(s[3]-door.z)<.2);assert.equal(labels.length,2);for(const [text,x,,z,,rotation]of labels){const normal=ax?Math.cos(rotation.y):Math.sin(rotation.y),side=Math.sign(ax?z-door.z:x-door.x);assert.equal(Math.round(normal),side);assert.equal(text,side===door.roomNormal?'TO '+door.label:door.room.code+'  /  '+door.room.name.toUpperCase());}}
 });
}
