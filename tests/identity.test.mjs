import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountIdentity} from '../lib/identity.ts';

test('stable dispatch subjects preserve existing accounts', async()=>{
  assert.equal(await accountIdentity(new Headers({'oai-authenticated-user-id':'existing-player','oai-authenticated-user-email':'person@example.com'})), 'existing-player');
});
test('legacy dispatch email sessions receive private, deterministic, isolated demo identities', async()=>{
  const a=await accountIdentity(new Headers({'oai-authenticated-user-email':'Person@example.com'}));
  assert.match(a,/^dispatch-email:[a-f0-9]{64}$/);
  assert.equal(a,await accountIdentity(new Headers({'oai-authenticated-user-email':'person@example.com'})));
  assert.notEqual(a,await accountIdentity(new Headers({'oai-authenticated-user-email':'other@example.com'})));
  assert.ok(!a.includes('person'));
});
test('anonymous and ordinary client identity hints are rejected', async()=>{
  for(const input of [{},{'email':'person@example.com'},{'x-user-id':'existing-player'},{'authorization':'Bearer person@example.com'},{'oai-authenticated-user-email':'invalid'}]) assert.equal(await accountIdentity(new Headers(input)),null);
});
