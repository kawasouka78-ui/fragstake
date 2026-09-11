import {accountIdentity} from '@/lib/identity';
import {firebaseRecords} from '@/lib/firebase-records';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return Response.json(await firebaseRecords(await accountIdentity(request.headers)),{headers:{'Cache-Control':'no-store'}})}catch(error){console.error('Record request failed',String(error));return Response.json({error:'Match records are temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}})}}
