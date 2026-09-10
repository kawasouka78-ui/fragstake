'use client';
import {requestAccount,AccountRequestError} from '@/lib/account-client';
import {createContext,useContext,useEffect,useState,useCallback,type ReactNode} from 'react';
import type {Player,MatchRow} from '@/db/service';
export type Summary={matches:number;kills:number;deaths:number;wins:number;net:number;headshots?:number;maxStreak?:number};
export type Transaction={id:string;kind:string;amount:number;label:string;created_at:number;match_id:string|null};
export type AccountData={player:Player;stats:Summary;transactions:Transaction[];matches:MatchRow[];active:MatchRow|null;pending:number};
export function accountApi<T=AccountData>(body?:Record<string,unknown>,query=''):Promise<T>{return requestAccount<T>(body,query)}
const Context=createContext<{data:AccountData|null;loading:boolean;error:string;refresh:()=>Promise<void>;update:(v:AccountData)=>void}>({data:null,loading:true,error:'',refresh:async()=>{},update:()=>{}});
export function AccountProvider({children}:{children:ReactNode}){
 const [data,setData]=useState<AccountData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const refresh=useCallback(async()=>{try{setData(await accountApi());setError('')}catch(e){setData(null);setError(e instanceof AccountRequestError&&e.status===401?'':e instanceof Error?e.message:'Account unavailable. Please retry.')}finally{setLoading(false)}},[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},45000);return()=>clearInterval(timer)},[refresh]);
 return <Context.Provider value={{data,loading,error,refresh,update:setData}}>{children}</Context.Provider>;
}
export function useAccount(){return useContext(Context)}
export const euro=(cents:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(cents/100);
export const dateLabel=(ms:number)=>new Date(ms).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
