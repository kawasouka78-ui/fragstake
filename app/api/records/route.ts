import {database} from '@/db';
import {accountIdentity} from '@/lib/identity';
import {launchRecords} from '@/db/launch';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return Response.json(await launchRecords(database(),await accountIdentity(request.headers)),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Match records are temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}})}}
