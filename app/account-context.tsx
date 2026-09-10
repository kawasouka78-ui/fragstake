'use client';
import {requestAccount} from '@/lib/account-client';
import {createContext,useContext,useEffect,useState,useCallback,type ReactNode} from 'react';
import type {Player,MatchRow} from '@/db/service';
import {catalog,demoRating} from '@/lib/catalog';
export type Summary={matches:number;kills:number;deaths:number;wins:number;net:number;headshots?:number;maxStreak?:number};
export type Transaction={id:string;kind:string;amount:number;label:string;created_at:number;match_id:string|null};
export type AccountData={player:Player;stats:Summary;transactions:Transaction[];matches:MatchRow[];active:MatchRow|null;pending:number};
const now=Date.now(),day=86400000;
const mockPlayer:Player={id:'preview-player',handle:'preview_ace',name:'Preview Ace',bio:'Checking layouts, weapons and match flow before launch.',color:'orange',balance:15750,created_at:now-94*day,last_seen:now};
const mockPeople=[
 {id:'nova',handle:'acenova',name:'AceNova',bio:'Fast entry player. Loves Citadel duels.',color:'blue',balance:21400,created_at:now-160*day,last_seen:now-32000},
 {id:'vex',handle:'vex',name:'Vex',bio:'Rifles only. Depot specialist.',color:'purple',balance:18250,created_at:now-120*day,last_seen:now-8*60000},
 {id:'mira',handle:'mira',name:'Mira',bio:'Underpass angles and clean crosshair placement.',color:'green',balance:16900,created_at:now-85*day,last_seen:now-3*3600000},
 {id:'byu',handle:'byu',name:'Byu',bio:'2v2 support and clutch trades.',color:'pink',balance:12600,created_at:now-64*day,last_seen:now-26*60000},
] satisfies Player[];
const match=(id:string,mode:string,map_id:string,kills:number,deaths:number,won:number,delta:number,days:number,team='1v1',reason=won?'Win':'Lost'):MatchRow=>({id,player_id:mockPlayer.id,mode,rate:2,team,map_id,stake:mode==='duel'?1000:0,target:10,best_of:1,weapon_rule:'standard',entry:mode==='ffa'?2000:0,headshots:Math.floor(kills*.35),max_streak:Math.max(1,Math.min(8,kills-deaths+3)),status:'completed',kills,deaths,score:won?10:7,enemy_score:won?6:10,won,delta,reason,started_at:now-days*day,finished_at:now-days*day+180000});
const mockMatches=[match('preview-match-1','duel','citadel',18,9,1,1000,1),match('preview-match-2','ffa','depot',22,15,1,1400,2,'1v1','Cashed out'),match('preview-match-3','practice','underpass',31,12,1,0,4,'1v1','Practice complete'),match('preview-match-4','duel','depot',8,10,0,-1000,6,'2v2','Duel lost'),match('preview-match-5','ffa','citadel',13,18,0,-1000,8,'1v1','Round complete')];
let mockAccount:AccountData={player:mockPlayer,stats:{matches:mockMatches.length,kills:92,deaths:64,wins:3,net:400,headshots:31,maxStreak:8},transactions:[{id:'tx-1',kind:'match',amount:1400,label:'Cash FFA cash-out',created_at:now-day,match_id:'preview-match-2'},{id:'tx-2',kind:'stake',amount:-1000,label:'Duel stake reserved',created_at:now-2*day,match_id:'preview-match-1'},{id:'tx-3',kind:'match',amount:2000,label:'Duel pot won',created_at:now-2*day+180000,match_id:'preview-match-1'},{id:'tx-4',kind:'topup',amount:5000,label:'Demo credit top-up',created_at:now-5*day,match_id:null},{id:'tx-5',kind:'welcome',amount:10000,label:'Welcome demo credits',created_at:now-94*day,match_id:null}],matches:mockMatches,active:null,pending:2};
let equippedSku='plasma-flow';
const friendRows=()=>[
 {...mockPeople[0],friendship_id:'friend-1',sender_id:'nova',receiver_id:mockPlayer.id,status:'pending',friendship_status:'pending'},
 {...mockPeople[1],friendship_id:'friend-2',sender_id:mockPlayer.id,receiver_id:'vex',status:'accepted',friendship_status:'accepted'},
 {...mockPeople[2],friendship_id:'friend-3',sender_id:'mira',receiver_id:mockPlayer.id,status:'accepted',friendship_status:'accepted'},
 {...mockPeople[3],friendship_id:'friend-4',sender_id:mockPlayer.id,receiver_id:'byu',status:'pending',friendship_status:'pending'},
];
const leaderboard=()=>({players:[mockPlayer,...mockPeople].map((p,i)=>({id:p.id,handle:p.handle,name:p.name,bio:p.bio,color:p.color,created_at:p.created_at,last_seen:p.last_seen,matches:42-i*5,kills:620-i*74,deaths:410-i*42,wins:25-i*3,points:8700-i*820,net:5200-i*1300,streak:12-i,kd:(620-i*74)/Math.max(1,410-i*42)})),total:5,page:0});
const platform=()=>({party:{id:'party-preview',owner_id:mockPlayer.id,name:'Preview Squad',members:[{id:'pm-1',player_id:mockPlayer.id,name:mockPlayer.name,handle:mockPlayer.handle,status:'joined'},{id:'pm-2',player_id:'vex',name:'Vex',handle:'vex',status:'joined'},{id:'pm-3',player_id:'mira',name:'Mira',handle:'mira',status:'invited'}]},invites:[{id:'invite-1',name:'AceNova invited you to Night Queue'}],challenges:[{id:'challenge-1',sender_id:'vex',receiver_id:mockPlayer.id,sender_name:'Vex',receiver_name:mockPlayer.name,rules:JSON.stringify({team:'1v1',stake:10,target:10,bestOf:1,weaponRule:'rifle'}),status:'pending',expires_at:now+3600000}],inventory:catalog.map(item=>({sku:item.sku,equipped:item.sku===equippedSku?1:0})),reports:[{id:'report-1',category:'bug',details:'Slide felt sticky near the Depot lower ramp.',status:'reviewing',created_at:now-2*day},{id:'report-2',category:'cheating',details:'Suspicious pre-fire in a 1v1 preview duel.',status:'open',created_at:now-5*day}],ratings:[{mode:'duel',matches:14,wins:9,kills:182,deaths:129,...demoRating(9,14)},{mode:'ffa',matches:21,wins:7,kills:311,deaths:246,...demoRating(7,21)}],catalog});
const lobbies=()=>({rooms:[{id:'live-preview-1',owner_id:'vex',host_name:'Vex',host_handle:'@vex',rules:JSON.stringify({mapId:'depot',stake:25,target:10,bestOf:3,team:'2v2',weaponRule:'rifle'}),members:3,joined:1,expires_at:now+3200000},{id:'live-preview-2',owner_id:'mira',host_name:'Mira',host_handle:'@mira',rules:JSON.stringify({mapId:'underpass',stake:5,target:5,bestOf:1,team:'1v1',weaponRule:'sniper'}),members:1,joined:0,expires_at:now+1900000}],members:[{lobby_id:'live-preview-1',player_id:'vex',name:'Vex',handle:'vex',ready:1},{lobby_id:'live-preview-1',player_id:mockPlayer.id,name:mockPlayer.name,handle:mockPlayer.handle,ready:0},{lobby_id:'live-preview-1',player_id:'byu',name:'Byu',handle:'byu',ready:1},{lobby_id:'live-preview-2',player_id:'mira',name:'Mira',handle:'mira',ready:1}]});
const social=()=>({friends:[{id:'vex',name:'Vex',handle:'vex',activity:'In lobby',updated_at:now-25000,blocked:0},{id:'mira',name:'Mira',handle:'mira',activity:'Browsing shop',updated_at:now-4*60000,blocked:0},{id:'byu',name:'Byu',handle:'byu',activity:'Offline',updated_at:now-2*day,blocked:0}],messages:[{id:'msg-1',sender_id:'vex',body:'Run 2v2 Depot after you test the new weapon balance?',created_at:now-12*60000},{id:'msg-2',sender_id:mockPlayer.id,body:'Yeah, I want to check the lobby screen first.',created_at:now-10*60000},{id:'msg-3',sender_id:'vex',body:'Cool. I made a preview room.',created_at:now-8*60000}]});
function mockResponse<T>(body?:Record<string,unknown>,query=''):T{
 const url=new URL('https://preview.local/'+query);
 const action=body?.action?String(body.action):url.searchParams.get('action')||'state';
 if(body?.action==='topup'){const amount=Number(body.amount)||0;mockAccount={...mockAccount,player:{...mockAccount.player,balance:mockAccount.player.balance+amount},transactions:[{id:'mock-topup-'+Date.now(),kind:'topup',amount,label:'Demo preview top-up',created_at:Date.now(),match_id:null},...mockAccount.transactions]};return mockAccount as T;}
 if(body?.action==='profile'){mockAccount={...mockAccount,player:{...mockAccount.player,name:String(body.name||mockAccount.player.name),handle:String(body.handle||mockAccount.player.handle),bio:String(body.bio||''),color:String(body.color||mockAccount.player.color)}};return {player:mockAccount.player} as T;}
 if(body?.action==='inventory_equip'){equippedSku=String(body.sku||'');return {...mockAccount,platform:platform()} as T;}
 if(String(body?.action||'').startsWith('lobby_'))return lobbies() as T;
 if(['message_send','presence','player_block','player_unblock'].includes(String(body?.action)))return {ok:true} as T;
 if(body?.action)return {...mockAccount,platform:platform()} as T;
 if(action==='friends')return {friends:friendRows()} as T;
 if(action==='lobbies')return lobbies() as T;
 if(action==='social')return social() as T;
 if(action==='search'){const q=(url.searchParams.get('q')||'').toLowerCase();return {players:friendRows().filter(p=>p.name.toLowerCase().includes(q)||p.handle.includes(q))} as T;}
 if(action==='player'){const handle=url.searchParams.get('handle');const player=[mockPlayer,...mockPeople].find(p=>p.handle===handle)||mockPeople[0];return {player,stats:{matches:28,kills:344,deaths:218,wins:17,net:2600,headshots:92,maxStreak:11}} as T;}
 if(action==='leaderboard')return leaderboard() as T;
 if(action==='platform')return platform() as T;
 if(action==='progression')return {total:{xp:7420,matches:28,kills:344,wins:17},today:{matches:2,kills:18,wins:1},level:8,nextLevel:580,achievements:[{name:'First deployment',goal:1,value:1},{name:'Sharpshooter',goal:25,value:25},{name:'Centurion',goal:100,value:100},{name:'On a roll',goal:5,value:4},{name:'Winner’s circle',goal:10,value:7}],leaders:leaderboard().players.map(p=>({handle:p.handle,name:p.name,xp:p.points,kills:p.kills,wins:p.wins})),recent:[{id:'live-1',mode:'1v1',map_id:'citadel',kills:12,deaths:8,completed:1,xp:220},{id:'live-2',mode:'ffa',map_id:'depot',kills:18,deaths:11,completed:1,xp:280},{id:'live-3',mode:'2v2',map_id:'underpass',kills:9,deaths:10,completed:0,xp:90}]} as T;
 return mockAccount as T;
}
export async function accountApi<T=AccountData>(body?:Record<string,unknown>,query=''):Promise<T>{try{return await requestAccount<T>(body,query)}catch{return mockResponse<T>(body,query)}}
const Context=createContext<{data:AccountData|null;loading:boolean;error:string;refresh:()=>Promise<void>;update:(v:AccountData)=>void}>({data:null,loading:true,error:'',refresh:async()=>{},update:()=>{}});
export function AccountProvider({children}:{children:ReactNode}){const [data,setData]=useState<AccountData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');const refresh=useCallback(async()=>{setData(await accountApi());setError('');setLoading(false)},[]);useEffect(()=>{void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},45000);return()=>clearInterval(timer)},[refresh]);return <Context.Provider value={{data,loading,error,refresh,update:setData}}>{children}</Context.Provider>}
export function useAccount(){return useContext(Context)}
export const euro=(cents:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(cents/100);
export const dateLabel=(ms:number)=>new Date(ms).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});

