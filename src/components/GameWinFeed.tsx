import {advanceWinAnnouncement,WIN_DISPLAY_MS} from '../lib/winAnnouncement';
import {visibleBigWin} from '../lib/walletState';
import React,{useEffect,useRef,useState} from 'react';
import {collection} from 'firebase/firestore';import {limit,onSnapshot,orderBy,query} from '../lib/reliableFirestore';import {auth,db} from '../firebase';
const labels:Record<string,string>={greedy_lion:'Greedy Lion',lion_wheel:'Lion Wheel',night_wheel:'Night Wheel',jackpot_fruit:'Jackpot',slots:'Slots'};
export function GameWinFeed({roomId}:{roomId?:string}){
 const [current,setCurrent]=useState<any>(null),[now,setNow]=useState(Date.now()),queue=useRef<any[]>([]),seen=useRef(new Set<string>()),active=useRef<any>(null);
 useEffect(()=>{const timer=setInterval(()=>{const time=Date.now();setNow(time);const next=advanceWinAnnouncement(active.current,queue.current,time);if(next!==active.current){active.current=next;setCurrent(next);}},100);return()=>clearInterval(timer);},[]);
 useEffect(()=>{queue.current=[];seen.current.clear();active.current=null;setCurrent(null);if(!auth.currentUser)return;
 return onSnapshot(query(roomId?collection(db,'rooms',roomId,'gameWins'):collection(db,'gameWins'),orderBy('createdAt','desc'),limit(30)),snapshot=>{for(const d of [...snapshot.docs].reverse()){const w=d.data();if(seen.current.has(d.id))continue;seen.current.add(d.id);if(visibleBigWin([w],Date.now()))queue.current.push({...w,id:d.id});}if(queue.current.length>50)queue.current.splice(0,queue.current.length-50);},()=>{});
 },[roomId]);
 if(!current)return null;const remaining=Math.max(0,1-(now-current.shownAt)/WIN_DISPLAY_MS);
 return <aside className="game-win-banner" role="status" aria-live="polite"><span className="game-win-medal">🏆</span><div className="game-win-copy"><strong>{current.name} <small>· ID {current.publicId}</small></strong><span>{labels[current.game]||current.game} থেকে জিতেছেন</span></div><b className="game-win-amount">🪙 {Number(current.amount).toLocaleString()}</b><i className="game-win-progress" style={{transform:`scaleX(${remaining})`}}/></aside>;
}
