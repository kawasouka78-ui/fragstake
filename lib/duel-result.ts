import type {MatchConfig,Result} from './game-rules.ts';

export function duelOutcome(result:Result){
 if(/cancelled/i.test(result.reason))return {tone:'neutral',title:'MATCH CANCELLED',label:'STAKE RETURNED'} as const;
 if(result.won)return {tone:'win',title:'YOU WON',label:'YOUR PROFIT'} as const;
 if(!/forfeit|left|lost|defeat/i.test(result.reason)&&result.score===result.enemyScore)return {tone:'neutral',title:'MATCH DRAWN',label:'NO GAIN OR LOSS'} as const;
 return {tone:'loss',title:'YOU LOST',label:'YOUR LOSS'} as const;
}

/** Preserve the completed match settings; wallet balance and identity are refreshed on entry. */
export function rematchRules(config:MatchConfig){
 return {mode:config.mode,rate:config.rate,team:config.team,mapId:config.mapId,stake:config.stake??10,target:config.target??10,bestOf:config.bestOf??1,weaponRule:config.weaponRule??'standard',entry:config.entry??0};
}

export function nextDuel<T extends string>(mapIds:readonly T[],previous:T,partySize:number,random:()=>number=Math.random){
 const choices=mapIds.filter(id=>id!==previous),available=choices.length?choices:mapIds;
 return {mapId:available[Math.min(available.length-1,Math.floor(random()*available.length))],team:partySize>1?'2v2':random()<0.5?'1v1':'2v2'} as {mapId:T;team:'1v1'|'2v2'};
}
