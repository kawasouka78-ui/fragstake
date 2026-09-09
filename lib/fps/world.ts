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
  if(this.map.id==='citadel'){for(const [i,r]of this.layout.rooms.entries())if(i%2===0){const light=new THREE.PointLight(i%4===0?this.theme.fixtureAlt:this.theme.fixture,24,17,2);light.position.set((r.x1+r.x2)/2,this.layout.height-.85,(r.z1+r.z2)/2);this.lights.push(light);this.root.add(light);}}else{const lightPoints=this.map.id==='depot'?[[-24,4.8,0],[-6,4.8,0],[12,4.8,0],[30,4,-4],[-12,3,27]]:this.map.id==='underpass'?[[0,5.2,-24],[0,5.2,-8],[0,5.2,8],[0,5.2,24],[-24,3,0],[26,3,-2]]:this.layout.rooms.filter((_,i)=>i%2===0).map(r=>[(r.x1+r.x2)/2,this.layout.height-.85,(r.z1+r.z2)/2]);
  for(const [i,p]of lightPoints.entries()){const light=new THREE.PointLight(i%2?this.theme.fixture:this.theme.fixtureAlt,34,25,2);light.position.set(p[0],p[1],p[2]);this.lights.push(light);this.root.add(light);}}
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
  if(this.map.id==='depot')return this.buildDepotFloor();
  if(this.map.id==='underpass')return this.buildStationFloor();
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
  if(this.map.id==='depot'){this.buildDepotWalls();return;}
  if(this.map.id==='underpass'){this.buildStationWalls();return;}
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
  if(this.map.id!=='citadel'&&this.nativeCover(b))return;
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
  for(const b of overheadBoxes(this.map))this.box(b.x,(b.y??0)+b.h/2,b.z,b.w,b.h,b.d,b.material==='ceiling'?this.theme.ceiling:b.color??this.theme.dark,['ceiling','warehouse-roof','service-ceiling','vault-shell','utility-ceiling'].includes(b.material)?'concrete':'metal');
  if(this.map.id==='depot'){this.buildDepotInfrastructure();return;}
  if(this.map.id==='underpass'){this.buildStationInfrastructure();return;}
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
   this.sign(label,d.x+(ax?0:offset),(d.clearance??3.2)+.63,d.z+(ax?offset:0),Math.min(3.8,d.width-.8),rotation,d.color);
  }
  }
 }
 // Depot and Underpass use authored industrial/transit forms. Their structural
 // members are rendered from the exact boxes used by collisionBoxes().
 nativeCover(b:Box):boolean{
  const native=['container','container-stack','pallet-stack','freight-press','press-upright','steel-column','loading-shutter','track-bed','track-curb','track-guard','rail','sleeper','metro-column','bench-seat','bench-back','bench-leg','pump-unit','ticket-machine','signal-cabinet'];
  if(!native.includes(b.material))return false;
  const y=b.y??0,color=b.color??this.theme.metal;
  this.box(b.x,y+b.h/2,b.z,b.w,b.h,b.d,color,['track-bed','metro-column'].includes(b.material)?'concrete':b.material==='sleeper'?'paint':'metal');
  if(b.material==='container'||b.material==='container-stack'){
   const tiers=b.material==='container-stack'?2:1,tier=b.h/tiers;
   for(let t=0;t<tiers;t++){const base=y+t*tier;
    for(const side of [-1,1]){
     const z=b.z+side*(b.d/2+.015);
     for(let n=-b.w/2+.3;n<b.w/2;n+=.55)this.box(b.x+n,base+tier/2,z,.065,tier-.22,.035,'#718078','metal',false);
     for(const level of [.09,tier-.09])this.box(b.x,base+level,z,b.w+.035,.12,.05,'#43554f','metal',false);
     const x=b.x+side*(b.w/2+.016);
     this.box(x,base+tier/2,b.z,.035,tier-.14,.05,'#3c504a','metal',false);
     for(const offset of [-.24,.24])this.box(x+side*.017,base+tier/2,b.z+offset*b.d,.035,tier-.35,.065,'#b9c0a8','metal',false);
     for(const edge of [-1,1])this.box(x,base+tier/2,b.z+edge*(b.d/2-.09),.05,tier,.15,'#4c6059','metal',false);
    }
   }
  }else if(b.material==='pallet-stack'){
   for(let level=.13;level<b.h;level+=.25)for(const side of [-1,1]){
    this.box(b.x,y+level,b.z+side*(b.d/2+.008),b.w,.055,.022,'#665d45','paint',false);
    this.box(b.x+side*(b.w/2+.008),y+level,b.z,.022,.055,b.d,'#665d45','paint',false);
   }
   for(let x=-b.w/2+.25;x<b.w/2;x+=.45)this.box(b.x+x,y+b.h+.005,b.z,.055,.01,b.d-.12,'#d1b887','paint',false);
  }else if(b.material==='freight-press'){
   for(const side of [-1,1]){const z=b.z+side*(b.d/2+.014);this.box(b.x,y+.23,z,b.w,.4,.03,'#586961');this.box(b.x,y+b.h-.35,z,b.w-.2,.2,.03,'#e6c371');
    for(let x=-2;x<=2;x+=2){this.cylinder(b.x+x,y+1.28,z-side*.075,.43,.15,'#9ba69a',new THREE.Euler(Math.PI/2,0,0));this.box(b.x+x,y+1.28,z+side*.012,.11,.11,.016,'#435650');}
   }
  }else if(b.material==='press-upright'||b.material==='steel-column'){
   for(const side of [-1,1])this.box(b.x+side*(b.w/2-.025),y+b.h/2,b.z,.05,b.h,b.d+.025,'#aab6a3','metal',false);
   this.box(b.x,y+.4,b.z,b.w+.024,.12,b.d+.024,'#e0b963','paint',false);
  }else if(b.material==='loading-shutter'){
   const face=b.x-b.w/2-.014;
   for(let level=.1;level<b.h;level+=.17)this.box(face,y+level,b.z,.028,.026,b.d-.16,'#b3b6a1','metal',false);
   for(const side of [-1,1])this.box(face,y+b.h/2,b.z+side*(b.d/2-.08),.045,b.h,.16,'#475952','metal',false);
   this.box(face-.02,y+.8,b.z,.035,.06,.65,'#d2ceb1','metal',false);
  }else if(b.material==='metro-column'){
   this.box(b.x,y+.73,b.z,b.w+.022,1.46,b.d+.022,'#426476','paint',false);
   this.box(b.x,y+1.49,b.z,b.w+.025,.075,b.d+.025,'#d8d4b6','paint',false);
   this.box(b.x,y+b.h-.16,b.z,b.w+.028,.3,b.d+.028,'#879f9e','metal',false);
  }else if(b.material==='bench-seat'||b.material==='bench-back'){
   for(let x=-b.w/2+.18;x<b.w/2;x+=.28)this.box(b.x+x,y+b.h+.004,b.z,.025,.008,b.d,'#3f5b61','paint',false);
  }else if(b.material==='pump-unit'){
   for(const side of [-1,1]){const z=b.z+side*(b.d/2+.012);this.box(b.x,y+b.h*.6,z,b.w-.3,.7,.025,'#466575','metal',false);this.cylinder(b.x,y+b.h*.6,z-side*.09,.3,.18,'#afc1b4',new THREE.Euler(Math.PI/2,0,0));}
  }else if(b.material==='ticket-machine'||b.material==='signal-cabinet'){
   const face=b.z-b.d/2-.015;this.box(b.x,y+b.h*.68,face,b.w-.32,b.h*.36,.03,'#2d4c59','metal',false);
   if(b.material==='ticket-machine'){this.box(b.x,y+b.h*.72,face-.017,b.w-.65,.38,.015,'#add3c5','light',false);this.box(b.x,y+b.h*.38,face-.015,.45,.09,.02,'#dfd6ac','paint',false);}
   else for(let level=.25;level<b.h-.3;level+=.35)this.box(b.x,y+level,face-.02,b.w-.45,.05,.022,'#9bb3b1','metal',false);
  }
  return true;
 }
 buildDepotFloor(){
  this.box(0,-.16,0,this.map.width,.32,this.map.depth,'#858a7d','ground');
  this.box(-6,.008,0,52,.016,36,'#9a9d89','ground',false);
  for(let x=-30;x<20;x+=6)this.box(x,.019,0,.024,.009,36,'#707b70','paint',false);
  for(let z=-16;z<18;z+=6)this.box(-6,.02,z,52,.009,.024,'#707b70','paint',false);
  // Parallel forklift aisles flank offset full-size container rows.
  for(const z of [-14,14])for(let x=-30;x<19;x+=3)this.box(x,.03,z,1.7,.012,.12,'#e6d294','paint',false);
  for(const side of [-1,1]){this.box(-6+side*4.1,.03,0,.13,.012,6.8,'#dfbd68','paint',false);this.box(-6,.03,side*3.4,8.3,.012,.13,'#dfbd68','paint',false);}
  for(const r of this.layout.rooms.slice(2)){const x=(r.x1+r.x2)/2,z=(r.z1+r.z2)/2,w=r.x2-r.x1;this.box(x,.014,z,w,.022,r.z2-r.z1,'#7e8980','ground',false);for(const side of [-1,1])this.box(x,.03,z+side*.9,w-.3,.012,.065,'#c4c6a2','paint',false);}
  for(const b of this.map.walls.filter(b=>b.material==='loading-shutter')){
   for(const side of [-1,1])this.box(31,.032,b.z+side*(b.d/2+.3),9.5,.014,.12,'#e6bf6b','paint',false);
   for(let z=b.z-b.d/2;z<b.z+b.d/2;z+=.65)this.box(35,.034,z,1.1,.014,.16,'#dcb964','paint',false);
  }
  this.buildNativeThresholds();
 }
 buildStationFloor(){
  this.box(0,-.16,0,this.map.width,.32,this.map.depth,'#6c858b','ground');
  this.box(0,.009,0,32,.016,64,'#a0aaa0','ground',false);
  this.box(0,.02,0,16,.016,64,'#b5b9a8','ground',false);
  for(let z=-30;z<32;z+=2)this.box(0,.033,z,16,.008,.022,'#8a9790','paint',false);
  for(const x of [-4,0,4])this.box(x,.033,0,.022,.008,64,'#8a9790','paint',false);
  for(const x of [-7.55,7.55])for(const z of [-16,16]){
   this.box(x,.04,z,.45,.012,24,'#dac98c','paint',false);
   for(let p=z-11.7;p<z+12;p+=.48)this.box(x,.048,p,.28,.007,.065,'#879b92','paint',false);
  }
  // All rail crossings are at platform level; no jump or invisible step is needed.
  for(const z of [-30,0,30]){const depth=z===0?8:4;this.box(0,.021,z,32,.019,depth,'#879d9c','ground',false);for(let x=-15;x<=15;x+=1.2)this.box(x,.04,z,.5,.012,depth-.9,'#c6caba','paint',false);}
  this.buildNativeThresholds();
 }
 buildNativeThresholds(){
  for(const d of this.layout.doors){const ax=d.axis==='x';this.box(d.x,.027,d.z,ax?d.width-.2:.28,.014,ax?.28:d.width-.2,'#4c6061','metal',false);}
 }
 buildDepotWalls(){
  for(const e of this.layout.edges){const ax=e.axis==='x',off=e.normal*.025,x=e.x+(ax?0:off),z=e.z+(ax?off:0);
   this.box(x,2.4,z,ax?e.length:.035,4.8,ax?.035:e.length,'#969d8c','metal',false);
   this.box(x,.42,z,ax?e.length:.065,.82,ax?.065:e.length,'#5d6d64','paint',false);
   this.box(x,.9,z,ax?e.length:.07,.075,ax?.07:e.length,'#d0af68','paint',false);
   for(let n=-e.length/2+.22;n<e.length/2;n+=.9)this.box(x+(ax?n:0),4.1,z+(ax?0:n),ax?.055:.07,7.9,ax?.07:.055,'#b0b8a2','metal',false);
  }
 }
 buildStationWalls(){
  for(const e of this.layout.edges){const ax=e.axis==='x',off=e.normal*.024,x=e.x+(ax?0:off),z=e.z+(ax?off:0);
   // Ceramic lower walls and a transit-blue band replace office-style panels.
   this.box(x,1.17,z,ax?e.length:.035,2.34,ax?.035:e.length,'#c6cec0','paint',false);
   this.box(x,1.45,z,ax?e.length:.05,.52,ax?.05:e.length,'#496f81','paint',false);
   this.box(x,.12,z,ax?e.length:.06,.23,ax?.06:e.length,'#4d6b73','metal',false);
   for(let level=.4;level<2.35;level+=.4)this.box(x,level,z,ax?e.length:.05,.017,ax?.05:e.length,'#9daea6','paint',false);
   for(let n=-e.length/2+.6;n<e.length/2;n+=.6)this.box(x+(ax?n:0),1.17,z+(ax?0:n),ax?.016:.053,2.34,ax?.053:.016,'#9daea6','paint',false);
  }
 }
 buildDepotInfrastructure(){
  for(const z of [-12,0,12])for(const x of [-24,-6,12])this.box(x,5.997,z,7.2,.014,.18,'#ffe5a7','light',false);
  for(const r of this.layout.rooms.slice(2)){const x=(r.x1+r.x2)/2,z=(r.z1+r.z2)/2,y=r.code==='D3'?3.744:4.244;for(const side of [-1,1])this.box(x+side*8,y,z,4,.014,.25,'#e3eccd','light',false);}
  this.sign('TRANSFER 04',-6,5.8,.565,2.7,new THREE.Euler(),'#fff0b7','#4a6058');
  let n=1;for(const b of this.map.walls.filter(b=>b.material==='loading-shutter'))this.sign('DOCK 0'+n++,35.978,5.4,b.z,3.6,new THREE.Euler(0,-Math.PI/2,0),'#e8d49c','#4c6058');
  this.buildNativePortalTrim();
 }
 buildStationInfrastructure(){
  // Linear platform lighting is fixed to the physical longitudinal beams.
  for(const x of [-5,5])for(const z of [-24,-8,8,24])this.box(x,7.395,z,.45,.014,11,'#d8f0df','light',false);
  for(const z of [-16,16])for(const side of [-1,1])this.sign(z<0?'01  NORTHBOUND':'02  SOUTHBOUND',0,4.2,z+side*.107,5.2,new THREE.Euler(0,side===1?0:Math.PI,0),'#e1ecdc','#344f60');
  for(const r of this.layout.rooms.slice(1)){const x=(r.x1+r.x2)/2,z=(r.z1+r.z2)/2;this.box(x,3.844,z,Math.min(r.x2-r.x1-1,5),.014,.42,'#d5e9df','light',false);}
  this.buildNativePortalTrim();
 }
 buildNativePortalTrim(){
  for(const d of this.layout.doors){const ax=d.axis==='x';for(const side of [-1,1])this.box(d.x+(ax?side*(d.width/2-.1):0),.45,d.z+(ax?0:side*(d.width/2-.1)),ax?.025:.285,.24,ax?.285:.025,this.map.id==='depot'?'#dbc27c':'#a5c7c5','paint',false);}
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
