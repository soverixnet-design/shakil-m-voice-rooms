import {getDoc,doc} from 'firebase/firestore';
import {db} from '../firebase';
import config from '../../game-server-config.json';
import {callSharedGame} from './gameTransport';
export async function walletApi(action:'sync'|'gift'|'exchange'|'voice-config',data:any){let url=config.url;try{const settings=await getDoc(doc(db,'system','gameServer'));url=settings.data()?.url||url}catch{}return (await callSharedGame<any>(url,action,data)).data;}
