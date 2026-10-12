import {auth,db} from '../firebase';
import config from '../../firebase-applet-config.json';
import {createReliableFirestore} from './reliableFirestoreCore';
const root=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/${encodeURIComponent(config.firestoreDatabaseId)}/documents`;
const nameRoot=`projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents`;
export const {getDoc,getDocs,updateDoc,setDoc,deleteDoc,addDoc,runTransaction,onSnapshot,query,where,orderBy,limit}=createReliableFirestore({db,root,nameRoot,getToken:()=>{const user=auth.currentUser;if(!user)throw Object.assign(Error('Sign in required'),{code:'unauthenticated'});return user.getIdToken()}});
