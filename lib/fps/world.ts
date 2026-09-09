import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {type ArenaMap,type Box,getMapLayout,overheadBoxes} from './maps.ts';

type Surface='ground'|'concrete'|'metal'|'paint'|'glass'|'light';
type Batch={material:THREE.Material;geometries:THREE.BufferGeometry[];shadow:boolean};
export const materialAssets={ground:'/materials/arena-concrete-paving.webp',concrete:'/materials/arena-concrete-wall.webp',metal:'/materials/arena-painted-steel.webp'};
const citadelTheme={wall:'#c4c0ad',metal:'#718b8d',dark:'#32494e',container:'#ad7854',ground:'#87908b',fog:'#34434a',sun:'#ffefda',elevation:.5,accent:'#efa775',ceiling:'#708580',impact:'#82958e',trim:'#cab38c',fixture:'#ffe7be',fixtureAlt:'#d2ede4',line:'#c6e2da',roomFloor:'#8c9389',hemisphere:'#e4f4f0',bounce:'#697977',fill:'#90b7be'};
const depotTheme={wall:'#c9b69b',metal:'#8c8069',dark:'#50493c',container:'#ad7846',ground:'#928773',fog:'#5a5042',sun:'#ffdfae',elevation:.5,accent:'#edb461',ceiling:'#a59881',impact:'#9a8c6e',trim:'#e2b667',fixture:'#ffdb9d',fixtureAlt:'#fff1cf',line:'#f1d898',roomFloor:'#aa9b81',hemisphere:'#fff0d9',bounce:'#75664f',fill:'#cfb387'};
const underpassTheme={wall:'#a3b4bf',metal:'#5c7d8d',dark:'#304e61',container:'#718b90',ground:'#78929d',fog:'#355263',sun:'#d4edff',elevation:.5,accent:'#84d3e0',ceiling:'#637f92',impact:'#527589',trim:'#82c7da',fixture:'#b5e1f5',fixtureAlt:'#def5fd',line:'#afe7f4',roomFloor:'#8298a4',hemisphere:'#d6f2ff',bounce:'#475f78',fill:'#86bdd6'};
export const worldThemes={citadel:citadelTheme,depot:depotTheme,underpass:underpassTheme,foundry:citadelTheme,relay:citadelTheme,drydock:citadelTheme};

/** Every selected arena supplies its own architecture, wayfinding and light palette. */
export class ArenaWorld{
 get layout(){return getMapLayout(this.map);}
 scene:THREE.Scene;renderer:THREE.WebGLRenderer;map:ArenaMap;theme=citadelTheme;root=new THREE.Group();batches=new Map<string,Batch>();materials=new Map<string,THREE.MeshStandardMaterial>();textures:THREE.Texture[]=[];sun:THREE.DirectionalLight;lights:THREE.PointLight[]=[];ready:Promise<void>;disposed=false;staticMeshCount=0;
 constructor(scene:THREE.Scene,renderer:THREE.WebGLRenderer,map:ArenaMap){
  this.scene=scene;this.renderer=renderer;this.map=map;this.theme=worldThemes[map.id]??citadelTheme;scene.add(this.root);
  scene.background=new THREE.Color(map.sky);scene.fog=new THREE.Fog(this.theme.fog,35,92);
  scene.add(new THREE.HemisphereLight(this.theme.hemisphere,this.theme.bounce,2.15));
  // Broad fill keeps rooms legible on integrated GPUs; local fixtures supply colour.
  this.sun=new THREE.DirectionalLight(this.theme.sun,1.35);this.sun.position.set(-8,15,7);this.sun.castShadow=false;scene.add(this.sun);
  const fill=new THREE.DirectionalLight(this.theme.fill,.7);fill.position.set(8,5,-12);scene.add(fill);
  this.buildGround();this.buildCover();this.buildInfrastructure();this.buildSurroundings();this.buildWayfinding();this.merge();
  for(const [i,r]of this.layout.rooms.entries())if(i%2===0){const light=new THREE.PointLight(i%4===0?this.theme.fixtureAlt:this.theme.fixture,24,17,2);light.position.set((r.x1+r.x2)/2,this.layout.height-.85,(r.z1+r.z2)/2);this.lights.push(light);this.root.add(light);}
  this.ready=this.loadTextures();
 }
 material(surface:Surface,color:string){const key=surface+color;if(!this.materials.has(key)){
  const material=new THREE.MeshStandardMaterial({color,roughness:surface==='metal'?.57:surface==='glass'?.24:.9,metalness:surface==='metal'?.32:surface==='glass'?.15:.02});
  if(surface==='light'){material.emissive.set(color);material.emissiveIntensity=2;material.roughness=.3;}
  material.userData.surface=surface;this.materials.set(key,material);
 }return this.materials.get(key)!;}
 add(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,shadow=true,rotation?:THREE.Euler){
  geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(rotation??new THREE.Euler()),new THREE.Vector3(1,1,1)));
  const key=material.uuid+':'+Math.floor((x+this.map.width/2)/24)+':'+Math.floor((z+this.map.depth/2)/24)+':'+Number(shadow);let batch=this.batches.get(key);if(!batch){batch={material,geometries:[],shadow};this.batches.set(key,batch);}batch.geometries.push(geometry);
 }
 box(x:number,y:number,z:number,w:number,h:number,d:number,color:string,surface:Surface='metal',shadow=true){
  const geometry=new THREE.BoxGeometry(w,h,d),position=geometry.attributes.position,normal=geometry.attributes.normal,uv=geometry.attributes.uv;
  for(let i=0;i<position.count;i++){const px=position.getX(i)+x,py=position.getY(i)+y,pz=position.getZ(i)+z;uv.setXY(i,Math.abs(normal.getX(i))>.5?pz/3:px/3,Math.abs(normal.getY(i))>.5?pz/3:py/3);}
  this.add(geometry,this.material(surface,color),x,y,z,shadow);
 }
 cylinder(x:number,y:number,z:number,r:number,h:number,color:string,rotation?:THREE.Euler){this.add(new THREE.CylinderGeometry(r,r,h,12),this.material('metal',color),x,y,z,true,rotation);}
 sign(text:string,x:number,y:number,z:number,width:number,rotation=new THREE.Euler(),color='#e9e5d4',background='#253c42'){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d')!;ctx.fillStyle=background;ctx.fillRect(0,0,1024,256);ctx.fillStyle=color;ctx.fillRect(0,0,10,256);ctx.font='700 78px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,132,940);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;this.textures.push(texture);
  const material=new THREE.MeshStandardMaterial({map:texture,roughness:.75,metalness:.02,side:THREE.FrontSide});this.add(new THREE.PlaneGeometry(width,width/4),material,x,y,z,false,rotation);
 }
 buildGround(){
  this.box(0,-.16,0,this.map.width,.32,this.map.depth,this.theme.ground,'ground');
  for(const r of this.layout.rooms){const x=(r.x1+r.x2)/2,z=(r.z1+r.z2)/2,w=r.x2-r.x1,d=r.z2-r.z1;
   this.box(x,.007,z,w,.012,d,r.code==='05'?'#a1a59a':r.code==='06'?'#718a88':this.theme.roomFloor,'ground',false);
   // Inlaid border and tile joints establish real room scale at eye level.
   for(const side of [-1,1]){this.box(x+side*(w/2-.38),.018,z,.07,.009,d-.75,r.color,'paint',false);this.box(x,.018,z+side*(d/2-.38),w-.75,.009,.07,r.color,'paint',false);}
   for(let tx=r.x1+2;tx<r.x2;tx+=2)this.box(tx,.016,z,.018,.007,d,'#687875','paint',false);
   for(let tz=r.z1+2;tz<r.z2;tz+=2)this.box(x,.017,tz,w,.007,.018,'#687875','paint',false);
  }
  for(const p of this.layout.passages){const x=(p.x1+p.x2)/2,z=(p.z1+p.z2)/2,w=p.x2-p.x1,d=p.z2-p.z1;
   if(w>d){this.box(x,.019,z-.95,w-.4,.006,.045,'#abbbac','paint',false);this.box(x,.019,z+.95,w-.4,.006,.045,'#abbbac','paint',false);}
   else{this.box(x-.95,.019,z,.045,.006,d-.4,'#abbbac','paint',false);this.box(x+.95,.019,z,.045,.006,d-.4,'#abbbac','paint',false);}
  }
  for(const d of this.layout.doors){const alongX=d.axis==='x';this.box(d.x,.025,d.z,alongX?d.width-.2:.34,.016,alongX?.34:d.width-.2,'#374f54','metal',false);
   const stripes=Math.floor((d.width-.4)/.48);for(let i=0;i<stripes;i++){const offset=(i-(stripes-1)/2)*.48;this.box(d.x+(alongX?offset:0),.036,d.z+(alongX?0:offset),alongX?.22:.3,.008,alongX?.3:.22,d.color,'paint',false);}
  }
 }
 buildCover(){
  for(const b of this.map.walls){if(b.material==='concrete')this.box(b.x,b.h/2,b.z,b.w,b.h,b.d,this.theme.wall,'concrete');else if(b.material==='frame')this.box(b.x,b.h/2,b.z,b.w,b.h,b.d,b.color??this.theme.dark);else this.cover(b);}
  for(const e of this.layout.edges){const alongX=e.axis==='x',offset=e.normal*.018,x=e.x+(alongX?0:offset),z=e.z+(alongX?offset:0);
   // Warm plaster above teal impact panels with restrained brass reveal strips.
   this.box(x,.57,z,alongX?e.length:.028,1.14,alongX?.028:e.length,this.theme.impact,'paint',false);
   this.box(x,1.2,z,alongX?e.length:.05,.055,alongX?.05:e.length,this.theme.trim,'metal',false);
   this.box(x,.11,z,alongX?e.length:.06,.2,alongX?.06:e.length,'#445d5d','metal',false);
   this.box(x,this.layout.height-.25,z,alongX?e.length:.08,.22,alongX?.08:e.length,'#557071','metal',false);
   for(let n=-e.length/2+.12;n<e.length/2;n+=4){this.box(x+(alongX?n:0),(this.layout.height-.3)/2+.115,z+(alongX?0:n),alongX?.09:.08,this.layout.height-.3,alongX?.08:.09,'#a0aaa0','metal',false);}
   // Narrow luminescent wayfinding segments run above shoulder height.
   if(e.length>=6){this.box(x,3.72,z,alongX?Math.min(e.length-1,5):.065,.038,alongX?.065:Math.min(e.length-1,5),this.theme.line,'light',false);}
  }
 }
 cover(b:Box){
  const color=b.color??this.theme.metal;this.box(b.x,b.h/2,b.z,b.w,b.h,b.d,color,b.material==='pillar'?'concrete':'metal');
  this.box(b.x,.08,b.z,b.w+.025,.16,b.d+.025,'#34494e');this.box(b.x,b.h-.05,b.z,b.w+.025,.1,b.d+.025,'#40555a');
  if(b.material==='pillar'){this.box(b.x,1.05,b.z,b.w+.03,.16,b.d+.03,'#d2ad78');return;}
  if(b.material==='cargo'){
   for(const sx of [-1,1])for(const sz of [-1,1])this.box(b.x+sx*(b.w/2-.09),b.h/2,b.z+sz*(b.d/2-.06),.16,b.h,.12,'#475756');
   for(const sx of [-1,1])this.box(b.x+sx*b.w*.26,b.h/2,b.z,.055,b.h+.03,b.d+.035,'#c6b58e');
   for(const side of [-1,1]){const z=b.z+side*(b.d/2+.018);this.box(b.x,b.h*.53,z,b.w-.3,.13,.03,'#704f3e');this.box(b.x,b.h*.37,z,.55,.23,.025,'#dbc8a2','paint');this.box(b.x,b.h*.37,z+side*.018,.4,.06,.01,'#75614d','paint');}
  }else if(b.material==='server'||b.material==='locker'){
   const face=b.x-b.w/2-.025;for(let i=-b.d/2+.4;i<b.d/2;i+=.8){
    this.box(face,b.h/2,b.z+i,.04,b.h-.25,.71,'#263f49');
    for(let y=.42;y<b.h-.2;y+=.35)this.box(face-.026,y,b.z+i,.012,.075,.51,b.material==='server'?'#698787':'#8ca4a0');
    this.box(face-.036,b.h-.35,b.z+i-.2,.025,.055,.07,'#80e4c4','light');this.box(face-.036,b.h-.35,b.z+i-.06,.025,.055,.07,'#e6b96e','light');
   }
  }else if(b.material==='machine'){
   this.box(b.x,b.h*.52,b.z,b.w+.04,.6,b.d-.45,'#566c6a');
   for(const sx of [-1,1]){const x=b.x+sx*(b.w/2+.03);this.box(x,b.h*.65,b.z,.045,.65,1.15,'#344e55');this.box(x+sx*.03,b.h*.65,b.z,.015,.43,.85,'#8fd0c8','light');}
   for(let i=-1;i<=1;i++)this.cylinder(b.x+i*.5,b.h+.015,b.z,.13,.03,'#405759');
  }else{
   for(const side of [-1,1]){const z=b.z+side*(b.d/2+.023);this.box(b.x,b.h*.65,z,b.w-.28,b.h*.38,.04,'#2b444d');
    const count=Math.max(1,Math.floor(b.w/1.15));for(let i=0;i<count;i++){const x=b.x+(i-(count-1)/2)*1.12;this.box(x,b.h*.68,z+side*.022,.83,b.h*.23,.015,'#76bdb8','glass');for(let j=0;j<3;j++)this.box(x-.22+j*.2,b.h*.49,z+side*.025,.07,.035,.012,j===0?'#e7bb77':'#a2d7c5','light');}
   }
  }
 }
 buildInfrastructure(){
  for(const b of overheadBoxes(this.map))this.box(b.x,(b.y??0)+b.h/2,b.z,b.w,b.h,b.d,b.material==='ceiling'?this.theme.ceiling:b.color??this.theme.dark,b.material==='ceiling'?'concrete':'metal');
  for(const [i,r]of this.layout.rooms.entries()){const x=(r.x1+r.x2)/2,z=(r.z1+r.z2)/2,w=r.x2-r.x1;
   for(const side of [-1,1]){this.box(x,this.layout.height-.06,z+side*1.6,Math.min(w-2,7),.1,.76,'#344e52');this.box(x,this.layout.height-.13,z+side*1.6,Math.min(w-2.2,6.8),.025,.54,i%2?this.theme.fixtureAlt:this.theme.fixture,'light',false);}
   for(let n=-w/2+.7;n<w/2;n+=.65)this.box(x+n,this.layout.height-.09,z,.065,.12,1.7,'#435e60');
   this.box(x,this.layout.height-.1,z,Math.min(w-1,9),.12,1.9,'#566f70');
  }
  for(const [i,p]of this.layout.passages.entries()){const x=(p.x1+p.x2)/2,z=(p.z1+p.z2)/2,w=p.x2-p.x1,d=p.z2-p.z1,longX=w>d;
   this.box(x,this.layout.height-.2,z,longX?w:.5,.25,longX?.5:d,'#82948a');
   if(i<12){this.box(x,this.layout.height-.35,z,longX?1.8:.5,.08,longX?.5:1.8,'#2b464c');this.box(x,this.layout.height-.4,z,longX?1.6:.32,.025,longX?.32:1.6,this.theme.fixtureAlt,'light',false);}
  }
  // Jamb lights are fixed to validated, wall-supported portal frames.
  for(const d of this.layout.doors){const ax=d.axis==='x';for(const side of [-1,1]){this.box(d.x+(ax?side*(d.width/2-.105):0),2.15,d.z+(ax?0:side*(d.width/2-.105)),ax?.025:.285,1.55,ax?.285:.025,d.color,'light',false);}
   this.box(d.x,3.23,d.z,ax?d.width-.18:.3,.055,ax?.3:d.width-.18,'#b7c6b5','metal');
  }
 }
 buildSurroundings(){
  // Room identity plaques attach to continuous wall faces. There are no
  // decorative window panes pretending to be openings in the solid shell.
  for(const p of this.layout.roomSigns){const ax=p.axis==='x',offset=p.normal*.035;
   this.box(p.x+(ax?0:offset),3.1,p.z+(ax?offset:0),ax?4.16:.08,1.12,ax?.08:4.16,this.theme.dark,'metal',false);
  }
 }
 buildWayfinding(){
  for(const p of this.layout.roomSigns){const ax=p.axis==='x',offset=p.normal*.081,rotation=new THREE.Euler(0,ax?(p.normal===1?0:Math.PI):p.normal*Math.PI/2,0);
   this.sign(p.room.code+'  /  '+p.room.name.toUpperCase(),p.x+(ax?0:offset),3.1,p.z+(ax?offset:0),3.96,rotation,p.room.color);
  }
  for(const r of this.layout.rooms){const x=(r.x1+r.x2)/2,z=(r.z1+r.z2)/2;
   this.sign(r.code,x-Math.min(2.5,(r.x2-r.x1)/2-1),.026,z+Math.min(3.5,(r.z2-r.z1)/2-1),1.45,new THREE.Euler(-Math.PI/2,0,0),'#ddd7bd','#6a7c78');
  }
  for(const d of this.layout.doors){const ax=d.axis==='x';for(const side of [-1,1]){
   const offset=side*.151,rotation=new THREE.Euler(0,ax?(side===1?0:Math.PI):side*Math.PI/2,0);
   // The room-facing side directs you down the hallway; the hallway-facing
   // side identifies the room you are entering. Each face has its own text.
   const label=side===d.roomNormal?'TO '+d.label:d.room.code+'  /  '+d.room.name.toUpperCase();
   this.sign(label,d.x+(ax?0:offset),3.83,d.z+(ax?offset:0),Math.min(3.8,d.width-.8),rotation,d.color);
  }
  }
 }
 merge(){
  for(const batch of this.batches.values()){const merged=mergeGeometries(batch.geometries,false);if(merged){merged.computeBoundingSphere();const mesh=new THREE.Mesh(merged,batch.material);mesh.castShadow=batch.shadow;mesh.receiveShadow=true;this.root.add(mesh);this.staticMeshCount++;}for(const geometry of batch.geometries)geometry.dispose();}this.batches.clear();
 }
 async loadTextures(){await Promise.all(Object.entries(materialAssets).map(async([surface,url])=>{
  try{const texture=await new THREE.TextureLoader().loadAsync(url);if(this.disposed){texture.dispose();return;}texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures.push(texture);
   for(const material of this.materials.values())if(material.userData.surface===surface){material.map=texture;material.bumpMap=texture;material.bumpScale=surface==='metal'?.012:.035;material.needsUpdate=true;}
  }catch{/* Room geometry and coloured surfaces remain visible without textures. */}
 }));}
 update(_time:number,_quality:string){}
 dispose(){if(this.disposed)return;this.disposed=true;this.sun.shadow.dispose();this.textures.forEach(texture=>texture.dispose());}
}
