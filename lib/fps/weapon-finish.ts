import * as THREE from 'three';

export function createWeaponFinish(skin?:string){
 const effect=skin?.startsWith('fx:')?skin.slice(3):undefined;
 const animated=['plasma','circuit','molten'].includes(effect??'');
 const material=new THREE.MeshStandardMaterial({color:animated?'#ffffff':skin?.startsWith('#')?skin:'#141619',metalness:animated?.28:.42,roughness:animated?.42:.48});
 const time={value:0};
 if(animated){
  material.customProgramCacheKey=()=>`skillclash-finish-${effect}-1`;
  material.onBeforeCompile=shader=>{
   shader.uniforms.uFinishTime=time;
   shader.vertexShader='varying vec3 vFinishPosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFinishPosition = position;');
   shader.fragmentShader='uniform float uFinishTime;\nvarying vec3 vFinishPosition;\n'+shader.fragmentShader;
   const pattern=effect==='plasma'?`
    float wave = sin(p.z * 29.0 + sin(p.y * 45.0 + t) * 2.6 - t * 1.6);
    float ribbon = pow(0.5 + 0.5 * wave, 2.0);
    vec3 tint = mix(vec3(0.36,0.055,0.9), vec3(0.015,0.8,0.94), 0.5 + 0.5 * sin(p.z * 13.0 + t));
    finishColor = mix(vec3(0.018,0.013,0.038), tint, ribbon * 0.85);
    finishGlow = tint * ribbon * 0.38;` : effect==='circuit'?`
    vec2 grid = abs(fract(vec2(p.z * 35.0, (p.y + p.x * 0.4) * 65.0)) - 0.5);
    float traces = 1.0 - smoothstep(0.025,0.075,min(grid.x,grid.y));
    float scan = pow(0.5 + 0.5 * sin(p.z * 13.0 - t * 2.7), 8.0);
    vec3 tint = vec3(0.025,0.88,0.48);
    finishColor = vec3(0.012,0.035,0.03) + tint * traces * (0.16 + scan * 0.8);
    finishGlow = tint * traces * (0.08 + scan * 0.7);` : `
    float rock = sin(p.z * 63.0 + sin(p.y * 56.0 + t * 0.4) * 2.0) + sin(p.y * 82.0 + p.x * 40.0 - t * 0.6);
    float cracks = 1.0 - smoothstep(0.06,0.24,abs(rock));
    vec3 heat = mix(vec3(1.0,0.08,0.006),vec3(1.0,0.55,0.04),0.5 + 0.5 * sin(p.z * 22.0 - t));
    finishColor = mix(vec3(0.025,0.017,0.014),heat,cracks);
    finishGlow = heat * cracks * 0.85;`;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec3 p = vFinishPosition; float t = uFinishTime;
    vec3 finishColor; vec3 finishGlow;
    ${pattern}
    diffuseColor.rgb *= finishColor;`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += finishGlow;');
  };
 }
 return {material,time,animated};
}
