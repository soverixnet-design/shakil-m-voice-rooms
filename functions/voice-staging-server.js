import {readFileSync} from 'node:fs';
import {initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {liveKitIsConfigured} from './livekit-voice.js';
import {createVoiceStagingHttpServer,createSocialMembershipReader} from './voice-staging-http.js';

const PROJECT='gen-lang-client-0043151803';
const credentialPath=process.env.GOOGLE_APPLICATION_CREDENTIALS;
if(!credentialPath)throw Error('Firebase credential mount is required');
const account=JSON.parse(readFileSync(credentialPath,'utf8'));
if(account.project_id!==PROJECT||!account.private_key||!account.client_email)throw Error('Firebase credential project mismatch');
if(!liveKitIsConfigured(process.env))throw Error('LiveKit staging configuration is missing');
const app=initializeApp({credential:cert(account),projectId:PROJECT},'shakilm-voice-staging');
const verifyIdToken=token=>getAuth(app).verifyIdToken(token,true);
// Render/Supabase is authoritative for membership, seats and room policies.
// Keep this DO staging service read-only and separate from Akira.
const readRoomMembership=createSocialMembershipReader({url:process.env.SHAKILM_SOCIAL_API_URL||'https://shakil-m-voice-rooms.onrender.com/api/social'});
const server=createVoiceStagingHttpServer({readRoomMembership,verifyIdToken});
const port=Number(process.env.PORT||10000);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');
server.listen(port,'0.0.0.0',()=>console.log('Shakil M voice-only staging listening on',port));
function shutdown(){server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),10000).unref();}
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);
