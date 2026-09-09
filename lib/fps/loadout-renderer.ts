import * as THREE from 'three';
import {buildWeapon,type WeaponModel} from './weapon-models';
import type {WeaponId} from './simulation';

/** A still studio view of the same model used in the match. Renders only on changes. */
export class LoadoutRenderer {
  renderer:THREE.WebGLRenderer;
  scene=new THREE.Scene();
  camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,30);
  aspect=1;
  model:WeaponModel|null=null;
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
  }
  select(id:WeaponId,skin?:string){
    this.clearModel();
    this.model=buildWeapon(id,skin,false);
    this.model.rotation.set(0,0,-.10);
    const box=new THREE.Box3().setFromObject(this.model);
    this.model.position.sub(box.getCenter(new THREE.Vector3()));
    this.scene.add(this.model);this.draw();
  }
  resize(width:number,height:number){
    this.renderer.setSize(width,height,false);this.aspect=width/height;this.draw();
  }
  draw(){
    if(!this.model)return;
    this.camera.position.set(1,.3,-.38).normalize().multiplyScalar(3);
    this.camera.lookAt(0,0,0);this.camera.updateMatrixWorld();
    const size=new THREE.Box3().setFromObject(this.model).getSize(new THREE.Vector3());
    const right=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0);
    const up=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1);
    const halfWidth=(Math.abs(right.x)*size.x+Math.abs(right.y)*size.y+Math.abs(right.z)*size.z)/2;
    const halfHeight=(Math.abs(up.x)*size.x+Math.abs(up.y)*size.y+Math.abs(up.z)*size.z)/2;
    const frame=Math.max(halfHeight,halfWidth/this.aspect)*1.15;
    this.camera.left=-frame*this.aspect;this.camera.right=frame*this.aspect;
    this.camera.top=frame;this.camera.bottom=-frame;this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene,this.camera);
  }
  clearModel(){
    if(!this.model)return;
    const materials=new Set<THREE.Material>();
    this.model.traverse(node=>{if(node instanceof THREE.Mesh){node.geometry.dispose();for(const material of Array.isArray(node.material)?node.material:[node.material])materials.add(material);}});
    materials.forEach(material=>material.dispose());this.scene.remove(this.model);this.model=null;
  }
  dispose(){this.clearModel();this.renderer.dispose();}
}
