import {getDoc,doc} from 'firebase/firestore';
import {db} from '../firebase';
import config from '../../game-server-config.json';
import {callSharedGame} from './gameTransport';
export async function walletApi(action:'sync'|'gift'|'exchange'|'voice-config',data:any){const settings=await getDoc(doc(db,'system','gameServer'));return (await callSharedGame<any>(settings.data()?.url||config.url,action,data)).data;}
