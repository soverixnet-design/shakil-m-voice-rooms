import test from 'node:test';import assert from 'node:assert/strict';
import {migrateGameData,decodeFields} from '../functions/social-migration.js';
test('game migration copies descendants of absent ancestors and never overwrites existing balances or results',async()=>{
 const copied=new Map([['sharedGames/slots/rounds/10',{state:'settled'}],['users/alice',{coins:987}]]);
 const leaf=(path,data,subs=[])=>({path,get:async()=>({exists:data!==null,data:()=>data}),listCollections:async()=>subs});
 const collection=refs=>({listDocuments:async()=>refs});
 const players=collection([leaf('sharedGames/slots/rounds/10/players/alice',{total:1000,settled:true})]);
 const rounds=collection([leaf('sharedGames/slots/rounds/10',{state:'closed'},[players])]);
 const missing=leaf('sharedGames/slots',null,[rounds]);
 const source={collection:root=>root==='sharedGames'?collection([missing]):collection([])};
 const client={query:async(sql,args=[])=>{
  if(sql.includes('pg_try_advisory_lock'))return {rows:[{locked:true}]};
  if(sql.startsWith('select path'))return {rowCount:copied.has('migration/games-v1')?1:0};
  if(sql.startsWith('insert')){const path=sql.includes("values('migration/games-v1'")?'migration/games-v1':args[0];const value=JSON.parse(path==='migration/games-v1'?args[0]:args[3]);const exists=copied.has(path);if(!exists)copied.set(path,decodeFields(value));return {rowCount:exists?0:1};}
  return {rows:[]};
 },release:()=>{}};
 const db={pool:{connect:async()=>client}};
 assert.equal((await migrateGameData(source,db)).status,'complete');
 assert(copied.has('sharedGames/slots/rounds/10/players/alice'));
 assert.equal(copied.get('sharedGames/slots/rounds/10').state,'settled');
 assert.equal(copied.get('users/alice').coins,987);
 assert.equal((await migrateGameData(source,db)).status,'already-complete');
});
