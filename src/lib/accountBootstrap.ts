import config from '../../game-server-config.json';
import {auth, db} from '../firebase';
import {doc, getDoc, setDoc, serverTimestamp} from 'firebase/firestore';
import {loadAccountProfile} from './accountBootstrapFlow';

export async function accountBootstrap(onStage?:(stage:string)=>void){
  const user = auth.currentUser;
  if (!user) throw Object.assign(Error('Sign in again.'), {code: 'login/no-session'});
  
  onStage?.('অ্যাকাউন্ট প্রোফাইল যাচাই হচ্ছে…');
  
  // 1. First check Firestore document - completes in milliseconds
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      if (['banned', 'archived'].includes(data?.status)) {
        throw Object.assign(Error('Account is inactive'), {code: 'inactive-user'});
      }
      if (data?.id) {
        return {
          id: String(data.id),
          name: data.name || user.displayName || 'User',
          photoURL: data.photoURL || user.photoURL || '',
          coins: Number(data.coins ?? 10000),
          role: data.role || 'user',
        };
      }
    }
  } catch (e: any) {
    if (e?.code === 'inactive-user') throw e;
  }

  // 2. Try Render server with a fast 4s timeout (never hang the user)
  try {
    const remotePromise = loadAccountProfile({
      getToken: () => user.getIdToken(),
      request: fetch,
      url: config.url,
      onStage,
    });
    const profile = await Promise.race([
      remotePromise,
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
    ]);
    if (profile) return profile;
  } catch {}

  // 3. Fallback: initialize user profile in Firestore
  const publicId = String(100000000 + Math.floor(Math.random() * 900000000));
  const fallbackProfile = {
    id: publicId,
    name: user.displayName || user.email?.split('@')[0] || 'User',
    photoURL: user.photoURL || '',
    coins: 10000,
    role: 'user',
    status: 'active',
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', user.uid), fallbackProfile, {merge: true});
  } catch {}

  return {
    id: fallbackProfile.id,
    name: fallbackProfile.name,
    photoURL: fallbackProfile.photoURL,
    coins: fallbackProfile.coins,
    role: fallbackProfile.role,
  };
}
