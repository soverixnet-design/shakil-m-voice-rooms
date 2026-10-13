import {auth,db} from '../firebase';
import config from '../../firebase-applet-config.json';
import {createReliableFirestore} from './reliableFirestoreCore';
import serverConfig from '../../game-server-config.json';
import {createSocialTransport,socialPath} from './socialTransport';
const root=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/${encodeURIComponent(config.firestoreDatabaseId)}/documents`;
const nameRoot=`projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents`;
export const {getDoc,getDocs,updateDoc,setDoc,deleteDoc,addDoc,runTransaction,onSnapshot,query,where,orderBy,limit,writeBatch}=createReliableFirestore({db,root,nameRoot,remotePath:socialPath,override:createSocialTransport(serverConfig.url,nameRoot),onQuota:()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('earnbd-database-quota'));},getToken:()=>{const user=auth.currentUser;if(!user)throw Object.assign(Error('Sign in required'),{code:'unauthenticated'});return user.getIdToken()}});
