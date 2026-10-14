import {createStaffService} from './staff-service.js';
import {createEventService} from './event-service.js';
import {createReferralService} from './referral-service.js';
import {createRoutedVoiceConfig,voiceProviders} from './voice-routing.js';
import {createSupabaseDatabase} from './supabase-database.js';
import {migrateSocialData,migrateGameData} from './social-migration.js';
import {createSocialService} from './social-service.js';
import {createSocialWalletStore} from './social-wallet-store.js';
import {createAccountService} from './account-service.js';
import {readFileSync} from 'node:fs';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {createWalletService} from './wallet-service.js';
import {createGameService} from './service.js';
import {createGameHttpServer} from './http-server.js';
const PROJECT='gen-lang-client-0043151803',DATABASE='ai-studio-22dd0b7a-14da-47df-9bc8-d4b58ab5ab0b';
let service,verifyToken,database,serverApp,socialDatabase,ready=false;
try{
 const source=process.env.FIREBASE_SERVICE_ACCOUNT_JSON||readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS||'/etc/secrets/firebase-service-account.json','utf8');
 const account=JSON.parse(source);
 if(account.project_id!==PROJECT||!account.private_key||!account.client_email)throw Error('invalid-credentials');
 const app=initializeApp({credential:cert(account),projectId:PROJECT});serverApp=app;
 const db=getFirestore(app,DATABASE);database=db;service={...createGameService(db),...createWalletService(db),...createAccountService(db)};verifyToken=token=>getAuth(app).verifyIdToken(token);ready=true;if(voiceProviders().length){service.voiceConfig=createRoutedVoiceConfig(db);service.voiceProvider='managed';}
}catch{console.error('Firebase server credentials missing or invalid. Add the secret file for the configured Firebase project in Render Environment.');}
const origins=(process.env.ALLOWED_ORIGINS||'https://earnbd.work,https://www.earnbd.work,https://soverixnet-design.github.io').split(',').map(v=>v.trim()).filter(Boolean);
let lastWriteCheck=0,writeError;
async function checkDatabase(){
 if(socialDatabase){await socialDatabase.pool.query('select 1');return;}
 await database.doc('system/gameServer').get();
 if(Date.now()-lastWriteCheck>(writeError?30000:900000)){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
  try{const access=await serverApp.options.credential.getAccessToken();const response=await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents:commit`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${access.access_token}`},body:JSON.stringify({writes:[{update:{name:`projects/${PROJECT}/databases/${DATABASE}/documents/system/serverWriteCheck`,fields:{}},updateTransforms:[{fieldPath:'checkedAt',setToServerValue:'REQUEST_TIME'}]}]}),signal:controller.signal});if(!response.ok){const body=await response.json();throw Object.assign(Error('Database write unavailable'),{code:body.error?.status==='RESOURCE_EXHAUSTED'?'resource-exhausted':body.error?.status==='PERMISSION_DENIED'?'permission-denied':'unavailable'})}writeError=null}catch(error){writeError=error}finally{clearTimeout(timer);lastWriteCheck=Date.now()}
 }
 if(writeError)throw writeError;
}
const server=createGameHttpServer({service,verifyToken,origins,ready,voiceRelayConfigured:Boolean(process.env.TURN_SHARED_SECRET&&process.env.TURN_URLS),checkReady:checkDatabase});
if(process.env.SUPABASE_DATABASE_URL){
 let probe;
 try{probe=createSupabaseDatabase();await probe.check();
  if(ready){const migration=await migrateSocialData(database,probe);Object.assign(service,createWalletService(createSocialWalletStore(probe,database)),createSocialService(probe));socialDatabase=probe;
  const store=createSocialWalletStore(probe,database);
  Object.assign(service,createReferralService(store),createEventService(probe),createStaffService(probe,getAuth(serverApp)));
  const disabledGame=async()=>{throw Object.assign(Error('game-ledger-not-migrated'),{code:'unavailable'});};
  service.bet=disabledGame;service.sync=disabledGame;service.sweep=async()=>{};
  const games=await migrateGameData(database,probe);
  Object.assign(service,createGameService(store),{gamesDatabase:'supabase'});
  if(voiceProviders().length){service.voiceConfig=createRoutedVoiceConfig(store);service.voiceProvider='managed';console.log('Authenticated voice routing configured.');}
  console.log('Supabase game migration:',JSON.stringify(games));
  console.log('Supabase social migration:',JSON.stringify(migration));}
  console.log('Supabase connection verified; profiles and voice rooms use Supabase when migration is complete.');}
 catch(error){const reasons={'28P01':'authentication-failed','3D000':'database-not-found','ENOTFOUND':'host-not-found','ETIMEDOUT':'connection-timeout','supabase-schema-incomplete':'schema-incomplete','wrong-supabase-project':'wrong-project','invalid-supabase-connection':'invalid-connection'};console.error('Supabase startup check failed:',reasons[error.code]||reasons[error.message]||(/^[A-Z0-9_]{2,64}$/.test(String(error.code))?error.code:'connection-failed'));}
 finally{if(probe&&probe!==socialDatabase)await probe.close();}
}
const port=Number(process.env.PORT||10000);server.listen(port,'0.0.0.0',()=>console.log(`EarnBD game server listening on port ${port}; ${ready?'configured':'setup required'}`));
let sweeping=false;
async function sweep(){if(!ready||sweeping)return;sweeping=true;try{if(writeError)await checkDatabase();const jobs=await Promise.allSettled([service.sweep(),service.sweepEvents?service.sweepEvents():Promise.resolve()]);for(const result of jobs)if(result.status==='rejected')console.error('Settlement retry pending:',result.reason?.code||'internal')}catch(e){console.error('Settlement retry pending:',e.code||'internal')}finally{sweeping=false}}
if(ready){void sweep();const timer=setInterval(sweep,10000);timer.unref();}
function shutdown(){server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),10000).unref()}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
