import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';

export class ArenaPipeline{
 composer:EffectComposer;ao:GTAOPass;bloom:UnrealBloomPass;fxaa:ShaderPass;renderer:THREE.WebGLRenderer;width=1;height=1;quality='high';
 constructor(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,weaponScene:THREE.Scene,weaponCamera:THREE.Camera){
  this.renderer=renderer;this.composer=new EffectComposer(renderer);this.composer.addPass(new RenderPass(scene,camera));
  this.ao=new GTAOPass(scene,camera,256,256);this.ao.blendIntensity=.55;this.ao.updateGtaoMaterial({radius:1.4,thickness:.6,distanceFallOff:1,samples:8,scale:1});this.ao.updatePdMaterial({radius:3,samples:8});
  // Transparent FX and the sky are visible in the beauty pass, but cannot occlude surfaces.
  const render=this.ao.render.bind(this.ao);
  this.ao.render=(...args:Parameters<GTAOPass['render']>)=>{const hidden:THREE.Object3D[]=[];scene.traverse(object=>{if(object instanceof THREE.Mesh&&object.visible){const materials=Array.isArray(object.material)?object.material:[object.material];if(object.type==='Sky'||object.userData.sky||materials.some(m=>m.transparent)){hidden.push(object);object.visible=false;}}});try{render(...args);}finally{hidden.forEach(o=>o.visible=true);}};
  this.composer.addPass(this.ao);this.bloom=new UnrealBloomPass(new THREE.Vector2(256,256),.17,.4,1.35);this.composer.addPass(this.bloom);
  const weaponPass=new RenderPass(weaponScene,weaponCamera);weaponPass.clear=false;weaponPass.clearDepth=true;this.composer.addPass(weaponPass);this.composer.addPass(new OutputPass());this.fxaa=new ShaderPass(FXAAShader);this.composer.addPass(this.fxaa);
 }
 resize(width:number,height:number){this.width=width;this.height=height;const ratio=this.renderer.getPixelRatio();this.composer.setPixelRatio(ratio);this.composer.setSize(width,height);this.ao.setSize(Math.max(1,Math.floor(width*ratio*.6)),Math.max(1,Math.floor(height*ratio*.6)));this.fxaa.uniforms.resolution.value.set(1/(width*ratio),1/(height*ratio));}
 setQuality(quality:string){if(this.quality===quality)return;this.quality=quality;this.ao.enabled=quality==='high';this.bloom.enabled=quality==='high';this.resize(this.width,this.height);}
 render(dt:number){this.composer.render(dt);}
 dispose(){for(const pass of this.composer.passes)pass.dispose();this.ao.gtaoMaterial.dispose();this.ao.blendMaterial.dispose();this.composer.dispose();}
}
