import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {createGameService} from './service.js';
initializeApp();
const db=getFirestore('ai-studio-22dd0b7a-14da-47df-9bc8-d4b58ab5ab0b'),service=createGameService(db);
const options={region:'asia-southeast1',timeoutSeconds:120,maxInstances:10};
async function invoke(request,fn){if(!request.auth)throw new HttpsError('unauthenticated','Google লগইন করুন।');try{return await fn(request.data||{},request.auth.uid);}catch(e){const code=e.message||'server-error';if(['invalid-game','invalid-bet','invalid-request','request-conflict'].includes(code))throw new HttpsError('invalid-argument',code);if(['bet-closed','insufficient-coins','inactive-user','bet-limit'].includes(code))throw new HttpsError('failed-precondition',code);console.error(e);throw new HttpsError('internal','server-error');}}
export const syncSharedGame=onCall(options,r=>invoke(r,(d,uid)=>service.sync(d.game,uid)));
export const placeSharedBet=onCall(options,r=>invoke(r,(d,uid)=>service.bet(d,uid)));
export const settleSharedGames=onSchedule({...options,schedule:'every 1 minutes'},()=>service.sweep());
