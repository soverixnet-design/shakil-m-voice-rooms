import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readExistingAccount} from '../src/lib/existingAccount.ts';
const args={url:'https://firestore.googleapis.com/v1/projects/test/databases/test/documents/users/verified-user',token:'test-token',isOwner:false};
test('direct profile reads confirmed balance and never trusts stored admin role',async()=>{
 let observed;
 const profile=await readExistingAccount({...args,request:async(url,options)=>{observed={url,options};return new Response(JSON.stringify({fields:{id:{integerValue:'123456789'},name:{stringValue:'Existing User'},coins:{integerValue:'34567'},role:{stringValue:'admin'}}}))}});
 assert.equal(profile.coins,34567);assert.equal(profile.id,'123456789');assert.equal(profile.role,'user');assert.equal(observed.url,args.url);assert.equal(observed.options.headers.Authorization,'Bearer test-token');
});
test('direct profile never admits banned accounts, missing profiles or denied reads',async()=>{
 const make=body=>async()=>new Response(JSON.stringify(body));
 await assert.rejects(readExistingAccount({...args,request:make({fields:{status:{stringValue:'banned'},id:{stringValue:'123'}}})}),/inactive-user/);
 assert.equal(await readExistingAccount({...args,request:async()=>new Response('{}',{status:404})}),null);
 await assert.rejects(readExistingAccount({...args,request:async()=>new Response(JSON.stringify({error:{status:'PERMISSION_DENIED'}}),{status:403})}),{code:'login/firebase-profile-unavailable'});
});
