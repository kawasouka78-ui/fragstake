import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestAccount} from '../lib/account-client.ts';

test('account failures finish with actionable messages instead of endless loading', async(t)=>{
  const fetchMock=t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({error:'Sign in to access your FragStake account.'}),{status:401,headers:{'content-type':'application/json'}}));
  await assert.rejects(requestAccount(),/Sign in/);
  fetchMock.mock.mockImplementation(async()=>new Response('<html>Sign in</html>',{headers:{'content-type':'text/html'}}));
  await assert.rejects(requestAccount(),/Sign in with ChatGPT/);
  fetchMock.mock.mockImplementation((_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))));
  await assert.rejects(requestAccount(undefined,'',5),/too long/);
});
test('successful account requests preserve results and idempotency keys', async(t)=>{
  const payload={action:'topup',key:'same-request-01',amount:2000};
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,'/api/community');assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),payload);
    return Response.json({player:{balance:12000}});
  });
  assert.deepEqual(await requestAccount(payload),{player:{balance:12000}});
});
