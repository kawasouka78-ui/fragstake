import * as THREE from 'three';
import {buildWeapon,updateWeaponFinish,type WeaponModel} from './weapon-models';
import type {WeaponId} from './simulation';

/** Shared match geometry; animated finishes render only while visible. */
export class LoadoutRenderer {
  renderer:THREE.WebGLRenderer;
  scene=new THREE.Scene();
  camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,30);
  aspect=1;
  model:WeaponModel|null=null;
  frame=0;active=true;angle=0;
  motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  visibility=()=>this.schedule();
  tick=(time:number)=>{this.frame=0;if(!this.model)return;updateWeaponFinish(this.model,time/1000);this.renderer.render(this.scene,this.camera);this.schedule();};
  constructor(canvas:HTMLCanvasElement){
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.45;
    this.scene.add(new THREE.HemisphereLight('#e3f2ff','#72818d',2.6));
    const key=new THREE.DirectionalLight('#fff3dd',4);key.position.set(2,4,1);this.scene.add(key);
    const rim=new THREE.DirectionalLight('#ff9164',2.2);rim.position.set(-2,1,-3);this.scene.add(rim);
    const fill=new THREE.DirectionalLight('#a9d5ff',2);fill.position.set(0,1,3);this.scene.add(fill);
    document.addEventListener('visibilitychange',this.visibility);this.motion.addEventListener('change',this.visibility);
  }
  select(id:WeaponId,skin?:string,knifeStyle:'standard'|'karambit'='standard'){
    this.clearModel();
    this.model=buildWeapon(id,skin,false,knifeStyle);
    this.model.rotation.set(0,this.angle,-.10);
    const box=new THREE.Box3().setFromObject(this.model);
    this.model.position.sub(box.getCenter(new THREE.Vector3()));
    this.scene.add(this.model);this.draw();this.schedule();
  }
  schedule(){cancelAnimationFrame(this.frame);this.frame=0;if(this.active&&!document.hidden&&!this.motion.matches&&this.model?.userData.finish.animated)this.frame=requestAnimationFrame(this.tick);}
  setActive(active:boolean){this.active=active;this.schedule();}
  setAngle(angle:number){if(this.angle===angle)return;this.angle=angle;if(this.model){this.model.rotation.y=angle;this.draw();}}
  resize(width:number,height:number){
    this.renderer.setSize(width,height,false);this.aspect=width/height;this.draw();
  }
  draw(){
    if(!this.model)return;
    this.camera.position.set(1,.3,-.38).normalize().multiplyScalar(3);
    this.camera.lookAt(0,0,0);this.camera.updateMatrixWorld();
    // Fit the visible model itself, avoiding empty space from its world box.
    this.model.updateMatrixWorld(true);
    const bounds=new THREE.Box3(),point=new THREE.Vector3(),matrix=new THREE.Matrix4();
    this.model.traverse(node=>{if(node instanceof THREE.Mesh){
      matrix.multiplyMatrices(this.camera.matrixWorldInverse,node.matrixWorld);
      const positions=node.geometry.attributes.position;
      for(let i=0;i<positions.count;i++)bounds.expandByPoint(point.fromBufferAttribute(positions,i).applyMatrix4(matrix));
    }});
    const centre=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    const frame=Math.max(size.y/2,size.x/2/this.aspect)*1.18;
    this.camera.left=centre.x-frame*this.aspect;this.camera.right=centre.x+frame*this.aspect;
    this.camera.top=centre.y+frame;this.camera.bottom=centre.y-frame;this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene,this.camera);
  }
  clearModel(){
    cancelAnimationFrame(this.frame);this.frame=0;
    if(!this.model)return;
    const materials=new Set<THREE.Material>();
    this.model.traverse(node=>{if(node instanceof THREE.Mesh){node.geometry.dispose();for(const material of Array.isArray(node.material)?node.material:[node.material])materials.add(material);}});
    materials.forEach(material=>material.dispose());this.scene.remove(this.model);this.model=null;
  }
  dispose(){document.removeEventListener('visibilitychange',this.visibility);this.motion.removeEventListener('change',this.visibility);this.clearModel();this.renderer.dispose();this.renderer.forceContextLoss();}
}
