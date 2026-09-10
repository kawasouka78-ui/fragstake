import * as THREE from 'three';

// The armory and match renderer use the same finish patterns.
const patterns:Record<string,string>={
  plasma: `
    float wave = sin(p.z * 29.0 + sin(p.y * 45.0 + t) * 2.6 - t * 1.6);
    float ribbon = pow(0.5 + 0.5 * wave, 2.0);
    vec3 tint = mix(vec3(0.36,0.055,0.9), vec3(0.015,0.8,0.94), 0.5 + 0.5 * sin(p.z * 13.0 + t));
    finishColor = mix(vec3(0.018,0.013,0.038), tint, ribbon * 0.85);
    finishGlow = tint * ribbon * 0.38;`,
  circuit: `
    vec2 grid = abs(fract(vec2(p.z * 35.0, (p.y + p.x * 0.4) * 65.0)) - 0.5);
    float traces = 1.0 - smoothstep(0.025,0.075,min(grid.x,grid.y));
    float scan = pow(0.5 + 0.5 * sin(p.z * 13.0 - t * 2.7), 8.0);
    vec3 tint = vec3(0.025,0.88,0.48);
    finishColor = vec3(0.012,0.035,0.03) + tint * traces * (0.16 + scan * 0.8);
    finishGlow = tint * traces * (0.08 + scan * 0.7);`,
  molten: `
    float rock = sin(p.z * 63.0 + sin(p.y * 56.0 + t * 0.4) * 2.0) + sin(p.y * 82.0 + p.x * 40.0 - t * 0.6);
    float cracks = 1.0 - smoothstep(0.06,0.24,abs(rock));
    vec3 heat = mix(vec3(1.0,0.08,0.006),vec3(1.0,0.55,0.04),0.5 + 0.5 * sin(p.z * 22.0 - t));
    finishColor = mix(vec3(0.025,0.017,0.014),heat,cracks);
    finishGlow = heat * cracks * 0.85;`,

 vortex:`
    vec2 uv = vec2(p.z, p.y + p.x * 0.45) * 13.0;
    float radius = length(uv);
    float angle = atan(uv.y, uv.x + 0.0001);
    float spiral = pow(0.5 + 0.5 * sin(radius * 8.0 - angle * 3.0 - t * 1.25), 5.0);
    float halo = exp(-abs(radius - 0.55) * 7.0);
    float core = smoothstep(0.2, 0.65, radius);
    vec2 stars = uv * 7.0;
    float seed = finishHash(floor(stars));
    float star = (1.0 - smoothstep(0.025, 0.11, length(fract(stars) - 0.5))) * step(0.87, seed);
    star *= 0.65 + 0.35 * sin(t * 1.4 + seed * 30.0);
    vec3 nebula = mix(vec3(0.19,0.025,0.65), vec3(0.68,0.26,0.95), 0.5 + 0.5 * sin(radius * 3.0 - t * 0.35));
    finishColor = vec3(0.012,0.009,0.035) + nebula * (0.15 + spiral * 0.7) * core + halo * vec3(0.58,0.35,0.95);
    finishGlow = nebula * spiral * core * 0.32 + halo * vec3(0.35,0.19,0.7) + star * vec3(0.7,0.8,1.0);`,
 neon:`
    vec2 uv = vec2(p.z, p.y + p.x * 0.4) * vec2(8.0, 36.0);
    float lane = floor(uv.y);
    float seed = finishHash(vec2(lane, 7.0));
    float speed = 0.35 + seed * 0.65;
    float runner = fract(uv.x * (0.8 + seed) - t * speed + seed * 9.0);
    float trail = pow(runner, 5.0) * (1.0 - smoothstep(0.93, 1.0, runner));
    float line = 1.0 - smoothstep(0.08, 0.20, abs(fract(uv.y) - 0.5));
    vec3 neon = mix(vec3(0.015,0.75,0.95), vec3(1.0,0.025,0.42), step(0.45, seed));
    finishColor = vec3(0.016,0.018,0.036) + neon * line * (0.12 + trail * 1.5);
    finishGlow = neon * line * trail * 1.2;`,
 storm:`
    vec2 uv = vec2(p.z, p.y + p.x * 0.45) * 15.0;
    float drift = t * 0.8;
    float bolt = sin(uv.x * 4.0 + drift) * 0.24 + sin(uv.x * 11.0 - drift * 1.4) * 0.12 + sin(uv.x * 27.0 + drift) * 0.045;
    float distanceToBolt = abs(uv.y - bolt);
    float branch = abs(uv.y - bolt - abs(sin(uv.x * 2.0 + 1.0)) * 0.7);
    float arc = exp(-distanceToBolt * 34.0) + exp(-branch * 48.0) * 0.6;
    float glow = exp(-distanceToBolt * 4.0);
    float charge = 0.65 + 0.35 * pow(0.5 + 0.5 * sin(t * 2.0 + uv.x * 0.7), 3.0);
    float cloud = 0.5 + 0.5 * sin(uv.x * 2.0 + sin(uv.y * 3.0 - t * 0.25));
    finishColor = mix(vec3(0.012,0.026,0.07), vec3(0.028,0.075,0.18), cloud) + vec3(0.32,0.59,0.95) * glow * 0.25;
    finishGlow = vec3(0.48,0.72,1.0) * arc * charge * 0.95 + vec3(0.04,0.17,0.5) * glow * 0.25;`,
 solar:`
    vec2 uv = vec2(p.z, p.y + p.x * 0.45) * 44.0;
    vec2 spacing = vec2(1.73205, 3.0);
    vec2 a = mod(uv, spacing) - spacing * 0.5;
    vec2 b = mod(uv - spacing * 0.5, spacing) - spacing * 0.5;
    vec2 hex = dot(a,a) < dot(b,b) ? a : b;
    float edge = max(abs(hex.x), abs(hex.x) * 0.5 + abs(hex.y) * 0.866025);
    float seam = smoothstep(0.78, 0.86, edge);
    float wave = pow(0.5 + 0.5 * sin(length(uv * 0.45) * 1.4 - t * 1.2), 3.0);
    vec3 gold = mix(vec3(0.75,0.20,0.01), vec3(1.0,0.72,0.12), wave);
    finishColor = mix(vec3(0.055,0.025,0.008), gold * 0.48, wave * 0.75) + gold * seam * 0.7;
    finishGlow = gold * (seam * (0.18 + wave * 0.6) + wave * 0.09);`,
 prism:`
    vec2 uv = vec2(p.z, p.y + p.x * 0.45) * 24.0;
    uv.x += uv.y * 0.5;
    vec2 tile = floor(uv), cell = fract(uv);
    float triangle = step(cell.x, cell.y);
    float facet = finishHash(tile + vec2(triangle * 19.0));
    float phase = facet * 6.283185 + t * 0.48 + p.z * 5.0;
    vec3 spectrum = 0.5 + 0.5 * cos(phase + vec3(0.0,2.094,4.188));
    float bevel = min(min(cell.x,1.0-cell.x), min(min(cell.y,1.0-cell.y), abs(cell.x-cell.y) * 0.707));
    float rim = 1.0 - smoothstep(0.012,0.045,bevel);
    float sheen = pow(0.5 + 0.5 * sin(p.z * 16.0 + p.y * 9.0 - t * 0.9), 8.0);
    finishColor = spectrum * (0.28 + facet * 0.28) + vec3(0.055,0.07,0.08) + rim * spectrum * 0.12;
    finishGlow = spectrum * (0.10 + sheen * 0.23) + rim * sheen * 0.12;`,
 frost:`
    vec2 uv = vec2(p.z, p.y + p.x * 0.45) * 20.0;
    vec2 tile = floor(uv / 2.0), crystal = mod(uv,2.0) - 1.0;
    float seed = finishHash(tile);
    float angle = atan(crystal.y,crystal.x + 0.0001) + seed * 3.0;
    float radius = length(crystal);
    float sector = mod(angle + 0.523599,1.047198) - 0.523599;
    vec2 branch = vec2(cos(sector),sin(sector)) * radius;
    float stem = abs(branch.y);
    float teeth = abs(abs(branch.y) - (0.13 - abs(mod(branch.x,0.28)-0.14)) * 0.8);
    float growth = 0.48 + 0.36 * (0.5 + 0.5 * sin(t * 0.75 + seed * 6.283185));
    float mask = 1.0 - smoothstep(growth - 0.09, growth, radius);
    float ice = (exp(-stem * 70.0) + exp(-teeth * 80.0) * 0.7) * mask;
    float shimmer = 0.5 + 0.5 * sin(radius * 16.0 - t * 1.3 + seed * 5.0);
    finishColor = vec3(0.018,0.065,0.10) + vec3(0.30,0.68,0.85) * ice * 0.65;
    finishGlow = vec3(0.40,0.82,1.0) * ice * (0.15 + shimmer * 0.3);`,
};

export function createWeaponFinish(skin?:string){
 const effect=skin?.startsWith('fx:')?skin.slice(3):undefined;
 const pattern=effect&&Object.hasOwn(patterns,effect)?patterns[effect]:undefined;
 const animated=pattern!==undefined;
 const material=new THREE.MeshStandardMaterial({color:animated?'#ffffff':skin?.startsWith('#')?skin:'#141619',metalness:animated?.28:.42,roughness:animated?.42:.48});
 const time={value:0};
 if(animated){
  material.customProgramCacheKey=()=>`fragstake-finish-${effect}-2`;
  material.onBeforeCompile=shader=>{
   shader.uniforms.uFinishTime=time;
   shader.vertexShader='varying vec3 vFinishPosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFinishPosition = position;');
   shader.fragmentShader=`uniform float uFinishTime;
    varying vec3 vFinishPosition;
    float finishHash(vec2 point){return fract(sin(dot(point,vec2(127.1,311.7))) * 43758.5453);}
    `+shader.fragmentShader;
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
