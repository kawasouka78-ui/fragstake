/** Static surface patterns. No clock, glow or animation loop is needed. */
export const weaponWraps:Record<string,{metalness:number;roughness:number;fragment:string}>={
 carbon:{metalness:0.48,roughness:0.4,fragment:`
    vec2 uv = mat2(0.707,-0.707,0.707,0.707) * vec2(p.z,p.y+p.x*0.4) * 100.0;
    vec2 cell = fract(uv);
    float over = mod(floor(uv.x)+floor(uv.y),2.0);
    float crossThread = mix(cell.x,cell.y,over);
    float strand = pow(max(0.0,sin(crossThread*3.141593)),0.65);
    float fibres = 0.8 + 0.2 * cos(crossThread*25.13274);
    finishColor = vec3(0.009,0.012,0.016) + vec3(0.046,0.051,0.056) * strand * fibres;
 `},
 digital:{metalness:0.16,roughness:0.76,fragment:`
    vec2 uv = vec2(p.z,p.y+p.x*0.4) * 70.0;
    float large = finishHash(floor(uv/3.0));
    float small = finishHash(floor(uv));
    float mask = large * 0.75 + small * 0.25;
    vec3 paint = mix(vec3(0.028,0.039,0.043),vec3(0.105,0.15,0.13),step(0.35,mask));
    paint = mix(paint,vec3(0.27,0.31,0.29),step(0.62,mask));
    finishColor = mix(paint,vec3(0.48,0.49,0.44),step(0.83,mask));
 `},
 desert:{metalness:0.12,roughness:0.82,fragment:`
    vec2 uv = vec2(p.z,p.y+p.x*0.4) * 22.0;
    float field = finishNoise(uv*0.75) * 0.7 + finishNoise(uv*2.6) * 0.3;
    vec3 sand = mix(vec3(0.39,0.29,0.16),vec3(0.20,0.115,0.052),smoothstep(0.37,0.40,field));
    sand = mix(sand,vec3(0.075,0.05,0.029),smoothstep(0.58,0.61,field));
    finishColor = sand * (0.94 + 0.06 * finishHash(floor(uv*34.0)));
 `},
 tiger:{metalness:0.3,roughness:0.32,fragment:`
    vec2 uv = vec2(p.z,p.y+p.x*0.4) * 24.0;
    float bend = sin(uv.y*5.4+uv.x)*1.8 + sin(uv.y*11.0-uv.x*0.6)*0.35;
    float stripe = sin(uv.x*4.4+bend+uv.y*1.2);
    float width = 0.20 + sin(uv.y*5.4+uv.x*1.2)*0.42;
    float ink = smoothstep(width-0.04,width+0.04,stripe);
    vec3 red = mix(vec3(0.18,0.005,0.012),vec3(0.48,0.018,0.025),0.5+0.5*sin(uv.y*0.8));
    finishColor = mix(red,vec3(0.008,0.011,0.014),ink);
 `},
 porcelain:{metalness:0.08,roughness:0.28,fragment:`
    vec2 uv = vec2(p.z,p.y+p.x*0.4) * 16.0;
    uv.x += floor(uv.y)*0.5;
    vec2 cell = vec2(fract(uv.x)-0.5,fract(uv.y));
    float radius = length(cell)*2.0;
    float wave = 1.0-smoothstep(0.26,0.44,abs(sin(radius*6.283185)));
    float ink = wave * (1.0-smoothstep(1.12,1.2,radius));
    finishColor = mix(vec3(0.62,0.65,0.62),vec3(0.012,0.045,0.18),ink);
 `},
 damascus:{metalness:0.72,roughness:0.34,fragment:`
    vec2 uv = vec2(p.z,p.y+p.x*0.4) * 15.0;
    float fold = uv.y*14.0 + sin(uv.x*2.4)*2.8 + finishNoise(uv*1.8)*5.0;
    float layers = 0.5+0.5*sin(fold);
    float etch = pow(0.5+0.5*sin(fold*3.0),6.0);
    finishColor = mix(vec3(0.075,0.025,0.015),vec3(0.48,0.22,0.105),layers) + vec3(0.075,0.032,0.015)*etch;
 `},
 contour:{metalness:0.2,roughness:0.58,fragment:`
    vec2 uv = vec2(p.z,p.y+p.x*0.4) * 11.0;
    float elevation = finishNoise(uv)*0.7 + finishNoise(uv*2.0)*0.23 + finishNoise(uv*4.0)*0.07;
    float distanceToLine = abs(fract(elevation*18.0)-0.5);
    float line = 1.0-smoothstep(0.025,0.065,distanceToLine);
    float major = (1.0-smoothstep(0.045,0.10,distanceToLine))*step(3.5,mod(floor(elevation*18.0),5.0));
    vec3 paper = mix(vec3(0.32,0.42,0.37),vec3(0.57,0.62,0.53),elevation);
    finishColor = mix(paper,vec3(0.034,0.091,0.069),max(line,major)*0.9);
 `},
 hazard:{metalness:0.26,roughness:0.64,fragment:`
    vec2 uv = vec2(p.z,p.y+p.x*0.4);
    float stripe = step(0.5,fract((uv.x+uv.y)*19.0));
    vec3 paint = mix(vec3(0.62,0.38,0.016),vec3(0.014,0.018,0.02),stripe);
    vec2 chipGrid = uv*220.0;
    float chip = step(0.965,finishHash(floor(chipGrid))) * (1.0-smoothstep(0.1,0.45,length(fract(chipGrid)-0.5)));
    finishColor = mix(paint,vec3(0.11,0.125,0.13),chip);
 `},
};
