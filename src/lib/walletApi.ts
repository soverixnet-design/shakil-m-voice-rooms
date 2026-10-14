import {doc} from 'firebase/firestore';
import {getDoc} from './reliableFirestore';
import {withTimeout} from './authTimeout';
import {db} from '../firebase';
import config from '../../game-server-config.json';
import {callSharedGame} from './gameTransport';
export async function walletApi(action:'sync'|'gift'|'exchange'|'voice-config'|'referral'|'events'|'staff'|'sellers',data:any){let url=config.url;try{const settings=await withTimeout(getDoc(doc(db,'system','gameServer')),2000);url=settings.data()?.url||url}catch{}return (await callSharedGame<any>(url,action,data)).data;}
