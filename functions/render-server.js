import {readFileSync} from 'node:fs';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {createWalletService} from './wallet-service.js';
import {createGameService} from './service.js';
import {createGameHttpServer} from './http-server.js';
const PROJECT='gen-lang-client-0043151803',DATABASE='ai-studio-22dd0b7a-14da-47df-9bc8-d4b58ab5ab0b';
let service,verifyToken,ready=false;
try{
 const source=process.env.FIREBASE_SERVICE_ACCOUNT_JSON||readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS||'/etc/secrets/firebase-service-account.json','utf8');
 const account=JSON.parse(source);
 if(account.project_id!==PROJECT||!account.private_key||!account.client_email)throw Error('invalid-credentials');
 const app=initializeApp({credential:cert(account),projectId:PROJECT});
 const db=getFirestore(app,DATABASE);service={...createGameService(db),...createWalletService(db)};verifyToken=token=>getAuth(app).verifyIdToken(token);ready=true;
}catch{console.error('Firebase server credentials missing or invalid. Add the secret file for the configured Firebase project in Render Environment.');}
const origins=(process.env.ALLOWED_ORIGINS||'https://earnbd.work,https://www.earnbd.work,https://soverixnet-design.github.io').split(',').map(v=>v.trim()).filter(Boolean);
const server=createGameHttpServer({service,verifyToken,origins,ready});
const port=Number(process.env.PORT||10000);server.listen(port,'0.0.0.0',()=>console.log(`EarnBD game server listening on port ${port}; ${ready?'configured':'setup required'}`));
let sweeping=false;
async function sweep(){if(!ready||sweeping)return;sweeping=true;try{await service.sweep()}catch(e){console.error('Settlement retry pending:',e.code||'internal')}finally{sweeping=false}}
if(ready){void sweep();const timer=setInterval(sweep,10000);timer.unref();}
function shutdown(){server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),10000).unref()}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
