import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {type ArenaMap,type Box,collisionBoxes,overheadBoxes} from './maps.ts';

type Surface='ground'|'concrete'|'metal'|'paint'|'glass'|'light';
type Batch={material:THREE.Material;geometries:THREE.BufferGeometry[];shadow:boolean};
export const materialAssets={ground:'/materials/arena-concrete-paving.webp',concrete:'/materials/arena-concrete-wall.webp',metal:'/materials/arena-painted-steel.webp'};
export const worldThemes={
 foundry:{wall:'#b0ada2',metal:'#66818b',dark:'#35434a',container:'#b96e42',ground:'#a3a39a',fog:'#b6c3cb',sun:'#ffddb6',elevation:.42,accent:'#ffac54'},
 relay:{wall:'#d6ddd8',metal:'#577d92',dark:'#344d60',container:'#639b9e',ground:'#bcc7c5',fog:'#b9d5e1',sun:'#f4f5ed',elevation:.85,accent:'#73e1ed'},
 drydock:{wall:'#b0b6ae',metal:'#618d98',dark:'#344c59',container:'#b96340',ground:'#aeb3ac',fog:'#b8ccd5',sun:'#ffe0ad',elevation:.35,accent:'#ffc66b'}
};

/** Static world geometry is merged by surface and spatial tile to keep draw calls bounded. */
export class ArenaWorld{
 scene:THREE.Scene;renderer:THREE.WebGLRenderer;map:ArenaMap;theme:typeof worldThemes.foundry;root=new THREE.Group();batches=new Map<string,Batch>();materials=new Map<string,THREE.MeshStandardMaterial>();textures:THREE.Texture[]=[];environment:THREE.WebGLRenderTarget|null=null;sky:Sky;sun:THREE.DirectionalLight;particles:THREE.Points|null=null;water:THREE.Mesh|null=null;ready:Promise<void>;disposed=false;staticMeshCount=0;
 constructor(scene:THREE.Scene,renderer:THREE.WebGLRenderer,map:ArenaMap){
  this.scene=scene;this.renderer=renderer;this.map=map;this.theme=worldThemes[map.id];this.scene.add(this.root);
  scene.background=new THREE.Color(this.theme.fog);scene.fog=new THREE.Fog(this.theme.fog,65,240);
  this.sky=new Sky();this.sky.userData.sky=true;this.sky.scale.setScalar(450);const sunDirection=new THREE.Vector3(-.6,this.theme.elevation,-.45).normalize();
  const uniforms=this.sky.material.uniforms;uniforms.turbidity.value=map.id==='foundry'?3.8:2.2;uniforms.rayleigh.value=1.3;uniforms.mieCoefficient.value=.004;uniforms.mieDirectionalG.value=.8;uniforms.sunPosition.value.copy(sunDirection);this.sky.material.depthTest=false;this.sky.renderOrder=-10;scene.add(this.sky);
  const skyScene=new THREE.Scene();const environmentSky=this.sky.clone();skyScene.add(environmentSky);const generator=new THREE.PMREMGenerator(renderer);this.environment=generator.fromScene(skyScene,.06,.1,500);scene.environment=this.environment.texture;scene.environmentIntensity=.45;generator.dispose();
  scene.add(new THREE.HemisphereLight('#d4eafa','#5b554d',1.05));
  this.sun=new THREE.DirectionalLight(this.theme.sun,3.4);this.sun.position.copy(sunDirection.multiplyScalar(90));this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-55,right:55,top:48,bottom:-48,near:1,far:190});this.sun.shadow.bias=-.00012;this.sun.shadow.normalBias=.025;this.sun.shadow.radius=2;scene.add(this.sun);
  this.sun.shadow.autoUpdate=false;
  this.buildGround();this.buildCover();this.buildInfrastructure();this.buildSurroundings();this.buildWayfinding();this.merge();this.addAtmosphere();this.ready=this.loadTextures();
 }
 material(surface:Surface,color:string){const key=surface+color;if(!this.materials.has(key)){
  const m=new THREE.MeshStandardMaterial({color,roughness:surface==='glass'?.16:surface==='metal'?.63:.88,metalness:surface==='metal'?.45:surface==='glass'?.65:.04});
  if(surface==='light'){m.emissive.set(color);m.emissiveIntensity=2.4;m.roughness=.3;}m.userData.surface=surface;this.materials.set(key,m);
 }return this.materials.get(key)!;}
 add(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,shadow=true,rotation?:THREE.Euler){
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(rotation??new THREE.Euler()),new THREE.Vector3(1,1,1));geometry.applyMatrix4(matrix);
  const key=material.uuid+':'+Math.floor(x/20)+':'+Math.floor(z/20)+':'+Number(shadow);let batch=this.batches.get(key);if(!batch){batch={material,geometries:[],shadow};this.batches.set(key,batch);}batch.geometries.push(geometry);
 }
 box(x:number,y:number,z:number,w:number,h:number,d:number,color:string,surface:Surface='metal',shadow=true){
  const geometry=new THREE.BoxGeometry(w,h,d),pos=geometry.attributes.position,norm=geometry.attributes.normal,uv=geometry.attributes.uv;
  for(let i=0;i<pos.count;i++){const px=pos.getX(i)+x,py=pos.getY(i)+y,pz=pos.getZ(i)+z;uv.setXY(i,Math.abs(norm.getX(i))>.5?pz/4:px/4,Math.abs(norm.getY(i))>.5?pz/4:py/4);}
  this.add(geometry,this.material(surface,color),x,y,z,shadow);
 }
 cylinder(x:number,y:number,z:number,r:number,h:number,color:string,rotation?:THREE.Euler){this.add(new THREE.CylinderGeometry(r,r,h,18),this.material('metal',color),x,y,z,true,rotation);}
 sign(text:string,x:number,y:number,z:number,width:number,rotation=new THREE.Euler(),color='#eef5ee',background='#152d39'){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d')!;ctx.fillStyle=background;ctx.fillRect(0,0,1024,256);ctx.fillStyle=color;ctx.fillRect(0,0,12,256);ctx.font='700 88px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,132,950);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;this.textures.push(texture);
  const material=new THREE.MeshStandardMaterial({map:texture,roughness:.75,metalness:.05,side:THREE.DoubleSide});this.add(new THREE.PlaneGeometry(width,width/4),material,x,y,z,false,rotation);
 }
 buildGround(){
  const m=this.map,t=this.theme;
  this.box(0,-.2,0,m.width+4,.4,m.depth+4,t.ground,'ground');
  for(let x=-m.width/2;x<=m.width/2;x+=8)this.box(x,.002,0,.018,.003,m.depth,'#737a77','paint',false);
  for(let z=-m.depth/2;z<=m.depth/2;z+=8)this.box(0,.003,z,m.width,.004,.018,'#737a77','paint',false);
  // Painted edge lanes stay outside cover and never change collision geometry.
  for(const side of [-1,1]){this.box(side*(m.width/2-1),.007,0,.1,.008,m.depth-3,'#d6c290','paint',false);this.box(0,.007,side*(m.depth/2-1),m.width-3,.008,.1,'#d6c290','paint',false);}
  for(const p of m.landmarks){for(let x=-2;x<=2;x+=.6)this.box(p.x+x,.009,p.z+2.2,.3,.009,.9,t.accent,'paint',false);}
  // Recessed service grates and restrained wet patches add surface variation.
  for(const p of m.spawns.filter((_,i)=>i%3===0)){this.box(p.x,.008,p.z,1.25,.008,.7,'#34464c','metal',false);for(let i=-5;i<=5;i++)this.box(p.x+i*.1,.012,p.z,.025,.012,.63,'#838c88','metal',false);}
  if(m.id!=='relay')for(let i=0;i<m.landmarks.length;i+=2){const p=m.landmarks[i],mat=this.material('glass',m.id==='foundry'?'#687b83':'#71949c');const geometry=new THREE.CircleGeometry(1,32);geometry.scale(1.5,.65,1);this.add(geometry,mat,p.x-1.5,.016,p.z-1,false,new THREE.Euler(-Math.PI/2,0,i));}
 }
 buildCover(){
  for(const [i,b]of collisionBoxes(this.map).entries())if(b.material!=='prop'&&b.material!=='overhead')this.cover(b,i);
  for(const d of this.map.decorations){const base=this.map.walls.find(b=>Math.abs(b.x-d.x)<b.w/2&&Math.abs(b.z-d.z)<b.d/2)?.h??0;
   if(d.kind==='tower'){this.cylinder(d.x,base+2,d.z,.14,4,'#8a9496');this.box(d.x,base+4,d.z,.8,.25,.65,this.theme.dark);this.box(d.x,base+3.86,d.z,.64,.03,.52,'#ffefd1','light',false);}
   else if(d.kind==='pipe'){this.cylinder(d.x,base+.4,d.z,.28,2.2,'#acaba0',new THREE.Euler(0,0,Math.PI/2));for(const dx of [-.8,.8])this.cylinder(d.x+dx,base+.4,d.z,.31,.08,this.theme.dark,new THREE.Euler(0,0,Math.PI/2));}
   else if(d.kind==='barrel'){this.cylinder(d.x,base+.5,d.z,.35,1,'#988b5b');for(const dy of [.15,.85])this.cylinder(d.x,base+dy,d.z,.36,.06,'#4f5a59');}
   else{this.box(d.x,base+.15,d.z,.7,.3,.7,this.theme.dark);if(d.kind==='light')this.box(d.x,base+.32,d.z,.5,.05,.5,this.theme.accent,'light');}
  }
 }
 cover(b:Box,index:number){
  const t=this.theme,color=b.material==='crate'?'#8f9b8d':b.material==='container'?(index%3===0?t.container:index%3===1?t.metal:'#8a9b9c'):b.material==='metal'?t.metal:t.wall;
  this.box(b.x,b.h/2,b.z,b.w,b.h,b.d,color,b.material==='concrete'?'concrete':'metal');
  this.box(b.x,b.h+.04,b.z,b.w+.08,.08,b.d+.08,t.dark,'metal');
  this.box(b.x,.13,b.z,b.w+.035,.26,b.d+.035,b.material==='concrete'?'#717a76':'#455a62',b.material==='concrete'?'concrete':'metal');
  if(b.material==='crate'){
   for(const x of [-1,1])this.box(b.x+x*b.w*.36,b.h/2,b.z,.095,b.h+.06,b.d+.07,'#3f5150');
   for(const side of [-1,1]){this.box(b.x,b.h*.68,b.z+side*(b.d/2+.015),Math.min(b.w*.6,1),.11,.025,t.accent,'paint');this.box(b.x,b.h*.37,b.z+side*(b.d/2+.027),Math.min(b.w*.3,.4),.13,.03,'#343e41');}return;
  }
  if(b.material==='container'){
   const longX=b.w>b.d,length=longX?b.w:b.d;
   for(let along=-length/2+.35;along<length/2-.2;along+=.36)for(const side of [-1,1]){if(longX)this.box(b.x+along,b.h/2,b.z+side*(b.d/2+.025),.075,b.h-.2,.055,color);else this.box(b.x+side*(b.w/2+.025),b.h/2,b.z+along,.055,b.h-.2,.075,color);}
   for(const x of [-1,1])for(const z of [-1,1])this.box(b.x+x*(b.w/2-.08),b.h/2,b.z+z*(b.d/2-.02),.16,b.h,.16,t.dark);
   for(const dx of [-.25,.25])this.box(b.x+dx,b.h/2,b.z+b.d/2+.07,.035,b.h-.4,.035,'#b3b6a8');
   this.sign('SC  '+String(index+100),b.x,b.h*.7,b.z+b.d/2+.1,Math.min(b.w*.65,2.2),new THREE.Euler(),'#dbe2cf',color);return;
  }
  const faces=[{x:b.x,z:b.z+b.d/2+.018,length:b.w,rotation:0},{x:b.x,z:b.z-b.d/2-.018,length:b.w,rotation:Math.PI},{x:b.x+b.w/2+.018,z:b.z,length:b.d,rotation:Math.PI/2},{x:b.x-b.w/2-.018,z:b.z,length:b.d,rotation:-Math.PI/2}];
  for(const face of faces){const alongX=Math.abs(face.rotation)%Math.PI<.01;
   for(let a=-face.length/2+.6;a<face.length/2-.3;a+=2.6){const x=face.x+(alongX?a:0),z=face.z+(alongX?0:a);
    this.box(x,b.h/2,z,alongX?.055:.06,b.h-.18,alongX?.06:.055,b.material==='concrete'?'#7c8a89':t.dark);
    if(b.h>3.5&&face.length>3){this.box(x,Math.min(b.h-1,3.7),z,alongX?1.45:.035,.78,alongX?.035:1.45,'#75939c','glass',false);this.box(x,Math.min(b.h-1,3.7)-.4,z,alongX?1.6:.07,.08,alongX?.07:1.6,t.dark);}
   }
   if(b.h>3.5){const length=Math.max(.2,face.length-.2);this.box(face.x,b.h-.42,face.z,alongX?length:.05,.15,alongX?.05:length,t.accent,'paint',false);}
  }
  if(b.w>=4&&b.d>=3&&b.h>3){
   // Closed service doors and rooftop machinery make cover read as buildings.
   this.box(b.x,1.25,b.z+b.d/2+.035,1.65,2.5,.055,'#3c5763');this.box(b.x+.48,1.2,b.z+b.d/2+.072,.09,.28,.04,'#d2c8a6');
   this.box(b.x,2.7,b.z+b.d/2+.07,1.25,.08,.11,'#ffedc8','light',false);
   this.sign((this.map.id==='relay'?'LAB ':this.map.id==='foundry'?'SECTOR ':'BAY ')+String(index+1).padStart(2,'0'),b.x,Math.min(b.h-.8,3.25),b.z+b.d/2+.1,2.15,new THREE.Euler(),this.theme.accent);
  }
 }
 buildInfrastructure(){
  for(const b of overheadBoxes(this.map)){this.box(b.x,(b.y??0)+b.h/2,b.z,b.w,b.h,b.d,b.color??this.theme.dark,'metal');if(b.w>10){for(let x=-b.w/2+2;x<b.w/2;x+=4)this.box(b.x+x,(b.y??0)+b.h/2,b.z,.1,b.h+1,.12,'#9b9380');}}
  const half=this.map.width/2;
  if(this.map.id==='foundry')for(const z of [-20,20])for(const x of [-half-1,half+1])this.box(x,4.2,z,.6,8.4,.6,'#716956');
  if(this.map.id==='drydock')for(const x of [-half-2,half+2]){this.box(x,9,-22,1.2,18,1.2,'#c8944b');this.box(x,17.2,-12,1.5,1.5,32,'#c8944b');for(let z=-25;z<0;z+=6)this.box(x,13,z,.12,7,.12,'#4f615f');}
 }
 buildSurroundings(){
  const m=this.map,t=this.theme,half=m.width/2,depth=m.depth/2;
  for(let i=0;i<9;i++){const x=-half-12+i*(m.width+24)/8,h=9+(i*7%14),z=-depth-12-(i%2)*7;
   this.box(x,h/2,z,8,h,10,i%2?t.dark:t.metal,'metal');this.box(x,h+.1,z,8.4,.2,10.4,'#536672');
   for(let y=4;y<h;y+=3.6){this.box(x,y,z+5.025,6,.85,.04,'#8da4a8','glass',false);for(let dx=-3;dx<=3;dx+=1.5)this.box(x+dx,y,z+5.055,.045,1,.04,t.dark);}
   if(i%2===0)this.cylinder(x,h+2.1,z,.65,4.2,'#849390');
  }
  if(m.id==='foundry'){
   for(const x of [-half-7,half+8])for(let i=0;i<3;i++){const z=-12+i*12;this.cylinder(x,9,z,2.7,18,'#9b9c8c');this.cylinder(x,18.5,z,1.9,1,'#777f76');for(let y=2;y<18;y+=4)this.cylinder(x,y,z,2.74,.12,'#4d5d60');this.cylinder(x,24,z,.9,12,'#666a65');this.cylinder(x,28,z,.92,1.4,'#c28350');}
   for(const side of [-1,1]){const x=side*(half+4);this.box(x,11,0,5,2,m.depth+12,'#5d6e75');for(let z=-depth;z<depth;z+=10)this.box(x,5.5,z,.6,11,.6,t.dark);}
  }else if(m.id==='relay'){
   for(const [x,z]of [[-half-9,0],[half+10,-8]]){this.cylinder(x,13,z,1.3,26,'#c1d0cb');const dish=new THREE.SphereGeometry(5,24,12,0,Math.PI*2,0,Math.PI/2);this.add(dish,this.material('metal','#c9d9d5'),x,23,z,true,new THREE.Euler(.2,0,-.6));this.cylinder(x,26,z,.08,6,'#728e98');}
   for(let i=0;i<12;i++){const geometry=new THREE.ConeGeometry(15+i%3*8,25+i%4*10,8);this.add(geometry,this.material('concrete',i%2?'#778f99':'#8ea7b0'),-120+i*23,5,-110-(i%3)*15,true);}
  }else{
   const waterGeometry=new THREE.PlaneGeometry(380,220,48,32),waterMaterial=new THREE.MeshStandardMaterial({color:'#437d8c',metalness:.42,roughness:.22,transparent:true,opacity:.95});this.water=new THREE.Mesh(waterGeometry,waterMaterial);this.water.rotation.x=-Math.PI/2;this.water.position.set(0,-.45,depth+113);this.root.add(this.water);
   for(let i=0;i<4;i++){const x=-60+i*37,z=depth+28+(i%2)*24;this.box(x,.3,z,9,4,24,'#315a6a');this.box(x,2.8,z,8,1,22,'#b0b5a6');for(let j=0;j<4;j++)this.box(x-2+j%2*4,4.8,z-6+Math.floor(j/2)*7,3.6,3,6,j%2?'#aa6f47':'#618889');this.box(x,6,z+7,7,6,6,'#becac3');this.box(x,8,z+10.03,5,.6,.04,'#628892','glass');}
   for(let i=0;i<4;i++){const x=-75+i*50,z=depth+70;this.box(x,18,z,1.5,36,1.5,'#89938b');this.box(x,34,z-8,2,2,55,'#b28e5a');this.box(x,22,z-30,.08,24,.08,'#4c656a');}
  }
 }
 buildWayfinding(){
  const m=this.map,t=this.theme;
  for(const [i,p]of m.landmarks.entries()){
   this.sign(String(i+1).padStart(2,'0')+' / '+p.label.toUpperCase(),p.x,.018,p.z,4,new THREE.Euler(-Math.PI/2,0,0),t.accent,'#34474c');
   const geometry=new THREE.RingGeometry(1.6,1.65,48);this.add(geometry,this.material('paint',t.accent),p.x,.014,p.z,false,new THREE.Euler(-Math.PI/2,0,0));
  }
  this.sign('SKILLCLASH  /  '+m.name.toUpperCase(),0,3,-m.depth/2+.035,14);
 }
 merge(){
  for(const batch of this.batches.values()){const merged=mergeGeometries(batch.geometries,false);if(merged){merged.computeBoundingSphere();const mesh=new THREE.Mesh(merged,batch.material);mesh.castShadow=batch.shadow;mesh.receiveShadow=true;this.root.add(mesh);this.staticMeshCount++;}for(const geometry of batch.geometries)geometry.dispose();}this.batches.clear();
 }
 addAtmosphere(){
  const positions=new Float32Array(240*3);for(let i=0;i<240;i++){positions[i*3]=Math.sin(i*127.1)*this.map.width*.65;positions[i*3+1]=2+(i*13%23);positions[i*3+2]=Math.cos(i*311.7)*this.map.depth*.65;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));this.particles=new THREE.Points(geometry,new THREE.PointsMaterial({color:this.map.id==='foundry'?'#ffd6a0':'#e1f1fa',size:.045,transparent:true,opacity:.38,depthWrite:false}));this.root.add(this.particles);
 }
 async loadTextures(){await Promise.all(Object.entries(materialAssets).map(async([surface,url])=>{
  try{const texture=await new THREE.TextureLoader().loadAsync(url);if(this.disposed){texture.dispose();return;}texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures.push(texture);
   for(const material of this.materials.values())if(material.userData.surface===surface){material.map=texture;material.bumpMap=texture;material.bumpScale=surface==='metal'?.018:.05;material.needsUpdate=true;}
   if(surface==='ground'&&this.water){const waterTexture=texture.clone();waterTexture.colorSpace=THREE.NoColorSpace;waterTexture.repeat.set(25,15);waterTexture.needsUpdate=true;this.textures.push(waterTexture);const material=this.water.material as THREE.MeshStandardMaterial;material.bumpMap=waterTexture;material.bumpScale=.16;material.needsUpdate=true;}
  }catch{/* Local material colors remain a playable fallback if a texture request fails. */}
 }));}
 update(time:number,quality:string){if(this.particles){this.particles.visible=quality==='high';this.particles.position.y=Math.sin(time*.15)*.5;this.particles.rotation.y=time*.003;}if(this.water){const material=this.water.material as THREE.MeshStandardMaterial;if(material.bumpMap)material.bumpMap.offset.set(time*.008,time*.003);}}
 dispose(){if(this.disposed)return;this.disposed=true;this.sun.shadow.dispose();this.textures.forEach(t=>t.dispose());this.environment?.dispose();this.sky.geometry.dispose();this.sky.material.dispose();this.scene.remove(this.sky);}
}
