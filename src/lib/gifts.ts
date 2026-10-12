import type {Firestore} from 'firebase/firestore';
import {auth} from '../firebase';
import {walletApi} from './walletApi';
const pending=new Map<string,any>();
export async function sendDirectGift(_db:Firestore,args:{senderId:string;receiverId:string;roomId?:string;item:{name:string;emoji:string;image?:string;cost:number};quantity:number}){
 if(auth.currentUser?.uid!==args.senderId)throw Error('Google দিয়ে লগইন করুন।');
 const key=JSON.stringify([args.senderId,args.receiverId,args.item.name,args.item.cost,args.item.image||'',args.quantity]);
 const data=pending.get(key)||{...args,requestId:crypto.randomUUID()};pending.set(key,data);
 // Retry with the same ID after a lost response: no second debit.
 try{let result;try{result=await walletApi('gift',data)}catch(e:any){if(['functions/unavailable','functions/internal'].includes(e.code)||e.name==='AbortError'||e instanceof TypeError)result=await walletApi('gift',data);else throw e;}pending.delete(key);return result;}catch(e:any){if(['functions/failed-precondition','functions/invalid-argument','functions/unauthenticated','functions/permission-denied'].includes(e.code))pending.delete(key);const messages:any={'insufficient-coins':'কয়েন যথেষ্ট নয়।','inactive-user':'সক্রিয় ইউজার পাওয়া যায়নি।','invalid-gift':'গিফটের দাম বদলেছে। আবার গিফট বেছে নিন।'};if(messages[e.message])e.message=messages[e.message];throw e;}
}
