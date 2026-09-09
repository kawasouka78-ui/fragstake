import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ArenaWorld,worldThemes} from '../lib/fps/world.ts';
import {maps,collisionBoxes,overheadBoxes} from '../lib/fps/maps.ts';
import {Simulation,Navigation,clearAt,wallDistance} from '../lib/fps/simulation.ts';

// Build actual world geometry without a GPU. The canvas stub supplies text-label
// dimensions only; tests do not render images or inspect a browser.
const labelCanvas=()=>({width:1024,height:256,getContext:()=>({fillRect(){},fillText(){}})});
for(const map of maps){
 test(map.name+': all expanded areas and duel starts are reachable',()=>{
  assert.ok(map.width*map.depth>=5000);assert.ok(map.walls.length>=40);assert.ok(map.spawns.length>=16);
  const nav=new Navigation(map),first=map.spawns[0];
  for(const point of [...map.spawns,...map.landmarks]){assert.ok(clearAt(collisionBoxes(map),point.x,point.z,.4));assert.ok(nav.route(first,point).length);}
  const duel=new Simulation({mapId:map.id,mode:'duel',rate:2,team:'2v2',balance:90});assert.equal(new Set(duel.actors.map(a=>a.x+','+a.z)).size,4);const distance=Math.hypot(duel.player.x-duel.actors[1].x,duel.player.z-duel.actors[1].z);assert.ok(distance>=16&&distance<=32,'duel should start near a fight');
 });
 test(map.name+': detailed world batches contain finite geometry and match solid cover',()=>{
  const original=globalThis.document;globalThis.document={createElement:labelCanvas};
  try{
   const world=Object.create(ArenaWorld.prototype);Object.assign(world,{map,theme:worldThemes[map.id],root:new THREE.Group(),batches:new Map(),materials:new Map(),textures:[],staticMeshCount:0});
   world.buildGround();world.buildCover();world.buildInfrastructure();world.buildSurroundings();world.buildWayfinding();const pieces=[...world.batches.values()].reduce((n,b)=>n+b.geometries.length,0);world.merge();world.root.updateMatrixWorld(true);
   assert.ok(world.staticMeshCount<pieces*.5,'static detail should be batched');assert.ok(world.staticMeshCount<500,'draw batches must stay bounded');
   world.root.traverse(mesh=>{if(mesh instanceof THREE.Mesh){assert.ok(mesh.geometry.attributes.position.count>0);for(const n of mesh.geometry.attributes.position.array)assert.ok(Number.isFinite(n));}});
   const ray=new THREE.Raycaster();for(const b of map.walls.filter(b=>b.h>2).slice(0,12)){const from=new THREE.Vector3(b.x,1.6,b.z+b.d/2+.8);ray.set(from,new THREE.Vector3(0,0,-1));const rendered=ray.intersectObject(world.root,true)[0]?.distance,solid=wallDistance(collisionBoxes(map),from,{x:0,y:0,z:-1});assert.ok(rendered!==undefined);assert.ok(Math.abs(rendered-solid)<.18,'visible cover and shot collision disagree');}
   for(const b of overheadBoxes(map)){assert.ok((b.y??0)>3,'all roofs must clear jumping player heads');const hit=wallDistance([b],{x:b.x,y:1.6,z:b.z},{x:0,y:1,z:0});assert.ok(Math.abs(hit-((b.y??0)-1.6))<.001);}
   world.root.traverse(mesh=>{if(mesh instanceof THREE.Mesh)mesh.geometry.dispose();});world.materials.forEach(m=>m.dispose());world.textures.forEach(t=>t.dispose());
  }finally{globalThis.document=original;}
 });
}
