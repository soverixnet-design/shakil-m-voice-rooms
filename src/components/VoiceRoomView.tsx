import type {VoiceEffect} from '../lib/voiceEffects';
import {activeRankingAward} from '../lib/rankingAwards';
import {ensureVoiceMembership} from '../lib/voiceMembership';
import {EventCenter} from './EventCenter';
import {addDoc,orderBy,limit,updateDoc,onSnapshot,query,where,setDoc,deleteDoc,runTransaction,getDocs,getDoc} from '../lib/reliableFirestore';
import {LanguagePicker} from '../i18n/LanguagePicker';
import {RoomWelcome} from './RoomWelcome';
import {liveGames,roomThemes,roomThemeDetails} from '../design/catalog';
import {ProfilePhotoEditor} from './ProfilePhotoEditor';
import {useRoomAudio} from '../lib/useRoomAudio';
import {useMediaAssets,MediaAvatar,EntryMedia} from './MediaAssets';
import {RoomGiftFlights} from './RoomGiftFlights';
import {sendDirectGift} from '../lib/gifts';
import {walletApi} from '../lib/walletApi';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Mic, 
  MicOff, 
  Heart, 
  X, 
  Gamepad2, 
  Gift, 
  Coins, 
  Smile, 
  Send, 
  Copy,
  Check,
  ChevronDown,
  LogOut,
  Maximize2
} from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { VoiceRoom, UserProfile } from '../types';

interface Props {
  room: VoiceRoom;
  user: UserProfile;
  customGifts?: any[];
  onUpdateCoins: (newCoins: number, note: string) => void;
  onOpenGame: (gameId: string) => void;
  onOpenWallet: () => void;
  onMinimize: () => void;
  onLeaveRoom: () => void;
  onClose?: () => void;
  onOpenUsers: (uid?:string) => void;
  onOpenMessages?:()=>void;
  onUpdateRoom?: (updatedRoom: any) => void;
}

const GIFTS = [
  { emoji: '❤️', name: 'Heart', cost: 1 },
  { emoji: '🌹', name: 'Rose', cost: 10 },
  { emoji: '⭐', name: 'Star', cost: 250 },
  { emoji: '💍', name: 'Love Ring', cost: 750 },
  { emoji: '💎', name: 'Diamond', cost: 1100 },
  { emoji: '🚗', name: 'VIP Car', cost: 2000 },
  { emoji: '🚀', name: 'Rocket', cost: 5000 },
  { emoji: '👑', name: 'Crown', cost: 15000 },
];

const REACTIONS = ['❤️', '👏', '😂', '🔥', '😍', '🎉'];

const ROOM_GAMES=liveGames.map(g=>({...g,desc:'Shared server and wallet',bg:'from-purple-800 to-slate-950'}));

export const VoiceRoomView: React.FC<Props> = ({
  room:roomInput,
  user,
  customGifts,
  onUpdateCoins,
  onOpenGame,
  onOpenWallet,
  onMinimize,
  onLeaveRoom,
  onClose,
  onOpenUsers,
  onOpenMessages,
  onUpdateRoom,
}) => {
  const [roomData,setRoomData]=useState<Partial<VoiceRoom>>({});
  const room={...roomInput,...roomData};
  useEffect(()=>{setRoomData({});return onSnapshot(doc(db,'rooms',roomInput.id),s=>{if(s.exists())setRoomData(s.data())},()=>{})},[roomInput.id]);
  const seatCount = Number(room.sc) || (room.d ? 12 : 8);
  const isCurrentUserHost=Boolean(auth.currentUser&&room.hostId===auth.currentUser.uid);
  const [seatedIndex, setSeatedIndex] = useState<number | null>(() => {
    return null;
  });
  const [isMicOn, setIsMicOn] = useState<boolean>(false);
  const [isRoomSoundOn, setIsRoomSoundOn] = useState<boolean>(true);
  const [isFollowed, setIsFollowed] = useState<boolean>(false);
  useEffect(()=>{if(!auth.currentUser)return;return onSnapshot(doc(db,'users',auth.currentUser.uid,'roomLibrary',String(room.id)),snap=>setIsFollowed(snap.data()?.followed===true));},[room.id]);
  async function followRoom(){if(!auth.currentUser)return;try{await setDoc(doc(db,'users',auth.currentUser.uid,'roomLibrary',String(room.id)),{followed:!isFollowed},{merge:true})}catch{setSeatError('Could not follow room. Check Firebase rules.')}}
  const [chatMessages, setChatMessages] = useState<{ id: string; type: 'chat' | 'gift' | 'notice'; text: string; sender: string }[]>([
    { id: '1', type: 'notice', text: `📢 ${room.ann || 'Welcome to the room! Let’s chat 🎉'}`, sender: 'System' },
    { id: '2', type: 'notice', text: `🎉 ${user.name} joined the room`, sender: 'System' },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [activeChatTab, setActiveChatTab] = useState<'All' | 'Chat' | 'Gift' | 'Notice'>('All');
  const [showGiftModal, setShowGiftModal] = useState<boolean>(false);
  const [showReactionModal, setShowReactionModal] = useState<boolean>(false);
  const [eventsOpen,setEventsOpen]=useState(false),[toolsOpen,setToolsOpen]=useState(false);
  const [moreOpen,setMoreOpen]=useState(false),[roomProfileOpen,setRoomProfileOpen]=useState(false);
  const [roomBackgroundDraft,setRoomBackgroundDraft]=useState('');
  const [roomNameDraft,setRoomNameDraft]=useState(''),[roomAnnDraft,setRoomAnnDraft]=useState(''),[roomSaveBusy,setRoomSaveBusy]=useState(false),[roomThemeDraft,setRoomThemeDraft]=useState(0),[roomSeatCountDraft,setRoomSeatCountDraft]=useState<number>(room.sc || (room.d ? 12 : 8)),[roomLockedDraft,setRoomLockedDraft]=useState(false);
  const [selectedSeatUser, setSelectedSeatUser] = useState<any | null>(null);
  const [giftRecipients, setGiftRecipients] = useState<string[]>([]);
  const [selectedGiftIndex, setSelectedGiftIndex] = useState<number>(0);
  const [giftQuantity, setGiftQuantity] = useState<number>(1);
  const [giftBusy, setGiftBusy] = useState<boolean>(false);
  const [giftStatus, setGiftStatus] = useState<string>('');
  const [giftMode,setGiftMode]=useState<'classic'|'lucky'>('classic');
  const [luckyCatalog,setLuckyCatalog]=useState<any[]>([]);
  const [luckyEnabled,setLuckyEnabled]=useState(false);
  const [luckyMultipliers,setLuckyMultipliers]=useState<number[]>([5,10,50,100]);
  const [luckyLoading,setLuckyLoading]=useState(false);
  const [luckyBalance,setLuckyBalance]=useState<number|null>(null);
  const luckyPending=useRef(new Map<string,string>());
  useEffect(()=>{if(!showGiftModal||giftMode!=='lucky')return;
   let live=true;setLuckyLoading(true);setGiftStatus('🍀 Loading Lucky Gifts…');
   void walletApi('lucky-gift',{action:'catalog'}).then((catalog:any)=>{
    if(!live)return;setLuckyCatalog(Array.isArray(catalog.items)?catalog.items:[]);
    setLuckyEnabled(catalog.enabled===true);
    setLuckyMultipliers(Array.isArray(catalog.multipliers)?catalog.multipliers:[5,10,50,100]);
    setGiftStatus(catalog.enabled===true?'':'Lucky Gifts have not been enabled by the admin.');
   },()=>{if(live){setLuckyEnabled(false);setGiftStatus('The Lucky Gift server is unavailable.')}})
   .finally(()=>{if(live)setLuckyLoading(false)});
   return()=>{live=false};
  },[showGiftModal,giftMode]);

  useEffect(()=>{
    if(roomProfileOpen){
      setSeatError('');
      setRoomNameDraft(room.name);
      setRoomAnnDraft(room.ann||'');
      setRoomThemeDraft(Number(room.th||0) % roomThemes.length);
      setRoomSeatCountDraft(room.sc || (room.d ? 12 : 8));
      setRoomLockedDraft((room as any).locked===true);
      setRoomBackgroundDraft(String((room as any).customBackgroundId||''));
    }
  },[roomProfileOpen,room.id,room.th,room.sc]);

  async function saveRoomProfile(){
    if(!isCurrentUserHost||roomSaveBusy||!roomNameDraft.trim())return;
    setRoomSaveBusy(true);
    const payload = {
      name: roomNameDraft.trim(),
      ann: roomAnnDraft.trim(),
      th: roomThemeDraft,
      customBackgroundId:roomBackgroundDraft,
      sc: roomSeatCountDraft,
      locked: roomLockedDraft,
      hostId: room.hostId || auth.currentUser?.uid || ''
    };
    try{
      await setDoc(doc(db,'rooms',room.id), payload, { merge: true });
      setRoomData(p => ({ ...p, ...payload }));
      onUpdateRoom?.({ ...room, ...payload });
      setSeatError('✅ Room theme and seat count saved.');
      setRoomProfileOpen(false);
    }catch(err){
      setSeatError('Could not save settings. Move members from the lower seats to upper seats, then retry.');
    }finally{
      setRoomSaveBusy(false);
    }
  }
  const [showGameDrawer, setShowGameDrawer] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [seatAction,setSeatAction]=useState<number|null>(null),[chatOpen,setChatOpen]=useState(false);
  const enteredAt=useRef(Date.now());
  const [roomReady,setRoomReady]=useState(false);
  const [floatingParticles, setFloatingParticles] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [giftOverlay, setGiftOverlay] = useState<{ emoji: string; text: string } | null>(null);
  const [roomCoinTotal, setRoomCoinTotal] = useState<number>(room.tot || 0);
  const [copied, setCopied] = useState<boolean>(false);

  const [seats, setSeats] = useState<{ name: string; avatar: string; isSpeaking: boolean }[]>(() => {
    const arr = Array(seatCount).fill(null);
    if (room.oc) {
      room.oc.forEach(o => {
        if (o.s < seatCount) {
          arr[o.s] = { name: o.n, avatar: o.av, isSpeaking: false };
        }
      });
    }
    // If the room was created by this user or user is the host, ensure they sit on Seat 1 (index 0)
    if (isCurrentUserHost) {
      arr[0] = { name: user.name, avatar: user.img ? '👤' : (user.av || '🎤'), isSpeaking: false };
    }
    return arr;
  });

  const mediaAssets=useMediaAssets();
  const [roomEntry,setRoomEntry]=useState<any>(null);
  const [liveMembers,setLiveMembers] = useState<any[]>([]);
  useEffect(()=>{
    if(!auth.currentUser)return;
    let initial=true;let seen=new Set<string>();setRoomEntry(null);
    return onSnapshot(query(collection(db,'users'),where('currentRoomId','==',room.id)),snapshot=>{const members=snapshot.docs.map(d=>({...d.data(),uid:d.id})).filter((u:any)=>u.online&&!['banned','archived'].includes(u.status)&&(u.uid===auth.currentUser?.uid||Date.now()-(u.lastSeen?.toMillis?.()||0)<90000));if(!initial)for(const member of members)if(!seen.has(member.uid)&&member.uid!==auth.currentUser?.uid)setRoomEntry({...member,at:Date.now()});seen=new Set(members.map(m=>m.uid));initial=false;setLiveMembers(members)},()=>{});
  },[room.id]);

  const [roomRoles,setRoomRoles]=useState<Record<string,any>>({}),[roomControls,setRoomControls]=useState<Record<string,any>>({}),[policyOpen,setPolicyOpen]=useState(false),[policyTarget,setPolicyTarget]=useState(''),[policyStatus,setPolicyStatus]=useState('');
  const myUid=auth.currentUser?.uid||'';
  const [seatPolicyReady,setSeatPolicyReady]=useState(false);
  // Room popups have priority over the underlying room and lobby on Android Back.
  useEffect(() => {
    const back = (event: Event) => {
      if (showExitConfirm) { event.preventDefault(); setShowExitConfirm(false); }
      else if (showGiftModal) { event.preventDefault(); if (!giftBusy) setShowGiftModal(false); }
      else if (policyOpen) { event.preventDefault(); setPolicyOpen(false); }
      else if (roomProfileOpen) { event.preventDefault(); setRoomProfileOpen(false); }
      else if (selectedSeatUser) { event.preventDefault(); setSelectedSeatUser(null); }
      else if (seatAction !== null) { event.preventDefault(); setSeatAction(null); }
      else if (showGameDrawer) { event.preventDefault(); setShowGameDrawer(false); }
      else if (eventsOpen) { event.preventDefault(); setEventsOpen(false); }
      else if (toolsOpen) { event.preventDefault(); setToolsOpen(false); }
      else if (moreOpen) { event.preventDefault(); setMoreOpen(false); }
      else if (chatOpen) { event.preventDefault(); setChatOpen(false); }
      else if (showReactionModal) { event.preventDefault(); setShowReactionModal(false); }
    };
    window.addEventListener('earnbd-native-back', back, true);
    return () => window.removeEventListener('earnbd-native-back', back, true);
  }, [showExitConfirm, showGiftModal, giftBusy, policyOpen, roomProfileOpen, selectedSeatUser, seatAction, showGameDrawer, eventsOpen, toolsOpen, moreOpen, chatOpen, showReactionModal]);
  const [lockedSeats,setLockedSeats]=useState<number[]>([]),[policyBusy,setPolicyBusy]=useState(false),[adminId,setAdminId]=useState('');
  useEffect(()=>{setSeatPolicyReady(false);return onSnapshot(doc(db,'rooms',room.id,'seatPolicy','config'),{includeMetadataChanges:true},s=>{if(!s.metadata.fromCache){setLockedSeats(s.data()?.locked||[]);setSeatPolicyReady(true)}},()=>{setSeatPolicyReady(false);setSeatError('Seat permissions could not load. Publish the latest Firebase rules.')})},[room.id]);
  const [policyUsers,setPolicyUsers]=useState<Record<string,any>>({});
  const policyIds=Array.from(new Set([...Object.keys(roomRoles),...Object.keys(roomControls)])).sort().join('|');
  useEffect(()=>{if(!policyOpen)return;let stopped=false;void Promise.all(policyIds.split('|').filter(Boolean).map(async uid=>{const snap=await getDoc(doc(db,'users',uid));return [uid,snap.data()||{}]})).then(rows=>{if(!stopped)setPolicyUsers(Object.fromEntries(rows))}).catch(()=>{});return()=>{stopped=true}},[policyOpen,policyIds]);
  const canLockSeats=isCurrentUserHost||(roomRoles[myUid]?.role==='admin'&&roomRoles[myUid]?.canLockSeats===true);
  const canModerate=isCurrentUserHost||roomRoles[myUid]?.role==='admin';
  useEffect(()=>{if(!auth.currentUser)return;const a=onSnapshot(collection(db,'rooms',room.id,'roles'),v=>setRoomRoles(Object.fromEntries(v.docs.map(d=>[d.id,d.data()]))),()=>{});const b=onSnapshot(collection(db,'rooms',room.id,'controls'),v=>setRoomControls(Object.fromEntries(v.docs.map(d=>[d.id,d.data()]))),()=>{});return()=>{a();b()}},[room.id]);
  useEffect(()=>{const c=roomControls[myUid];if(c?.muted)setIsMicOn(false);if(c?.blocked){onLeaveRoom()}},[roomControls,myUid]);
  const [voiceEffect,setVoiceEffect]=useState<VoiceEffect>('normal');
  const voice=useRoomAudio(room.id,isMicOn,isRoomSoundOn,seatedIndex!==null&&!roomControls[myUid]?.muted&&!roomControls[myUid]?.blocked,roomControls,roomReady,voiceEffect);
  async function policyAction(action:string){if(!policyTarget)return;setPolicyStatus('Saving…');try{if(action==='admin')await setDoc(doc(db,'rooms',room.id,'roles',policyTarget),{role:'admin',canLockSeats:false});else if(action==='lock-permission'||action==='no-lock-permission')await updateDoc(doc(db,'rooms',room.id,'roles',policyTarget),{canLockSeats:action==='lock-permission'});else if(action==='user')await deleteDoc(doc(db,'rooms',room.id,'roles',policyTarget));else await runTransaction(db,async t=>{const ref=doc(db,'rooms',room.id,'controls',policyTarget),old=await t.get(ref);t.set(ref,{muted:action==='clear'?false:action==='mute'?true:old.data()?.muted===true,blocked:action==='clear'?false:action==='block'?true:old.data()?.blocked===true})});setPolicyStatus('✅ Saved')}catch{setPolicyStatus('Could not save changes. Check your permissions and room rules.')}}

  async function toggleSeatLock(index:number){if(!canLockSeats||policyBusy)return;setPolicyBusy(true);setPolicyStatus('Saving…');try{await runTransaction(db,async t=>{const ref=doc(db,'rooms',room.id,'seatPolicy','config'),snap=await t.get(ref);const previous:number[]=snap.data()?.locked||[];t.set(ref,{locked:previous.includes(index)?previous.filter(i=>i!==index):[...previous,index].sort((a,b)=>a-b),updatedBy:myUid,updatedAt:serverTimestamp()})});setPolicyStatus('✅ Seat lock saved')}catch{setPolicyStatus('Could not save seat lock. Check permissions and rules.')}finally{setPolicyBusy(false)}}
  async function lockAllSeats(){if(!canLockSeats||policyBusy)return;setPolicyBusy(true);try{await runTransaction(db,async tx=>{const ref=doc(db,'rooms',room.id,'seatPolicy','config'),snap=await tx.get(ref),old=snap.data()?.locked||[];tx.set(ref,{locked:old.length===seatCount?[]:Array.from({length:seatCount},(_,i)=>i),updatedBy:myUid,updatedAt:serverTimestamp()})});setSeatAction(null);setPolicyStatus('✅ Seat permissions saved')}catch{setSeatError('Could not save seat permissions.')}finally{setPolicyBusy(false)}}
  async function findAdmin(){if(!isCurrentUserHost||!adminId.trim()||policyBusy)return;setPolicyBusy(true);try{const result=await getDocs(query(collection(db,'users'),where('id','==',adminId.trim())));const user=result.docs[0];if(!user||['banned','archived'].includes(user.data().status)){setPolicyStatus('No active user found.');return}if(user.id===room.hostId){setPolicyStatus('The room owner already has every permission.');return}setPolicyTarget(user.id);await setDoc(doc(db,'rooms',room.id,'roles',user.id),{role:'admin',canLockSeats:false});setPolicyStatus(`✅ ID ${adminId.trim()} is now a room admin. You can grant seat-lock permission.`)}catch{setPolicyStatus('Could not save the admin. Check your connection and permissions.')}finally{setPolicyBusy(false)}}

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeChatTab]);

  const [seatBusy,setSeatBusy]=useState(false),[seatError,setSeatError]=useState('');
  const seatLock=useRef(false);
  const liveSeats=Array.from({length:seatCount},(_,index)=>liveMembers.filter(m=>m.roomSeat===index).sort((a,b)=>a.uid.localeCompare(b.uid))[0]||null);
  useEffect(()=>{let stopped=false;setRoomReady(false);setSeatedIndex(null);setIsMicOn(false);enteredAt.current=Date.now();const uid=auth.currentUser?.uid;if(!uid)return;
    const ref=doc(db,'users',uid);
    const stop=onSnapshot(ref,snap=>{const profile=snap.data();if(stopped||profile?.currentRoomId!==room.id)return;setRoomReady(true);setSeatedIndex(Number.isInteger(profile.roomSeat)?profile.roomSeat:null)},()=>setSeatError('Could not load seat information. Check your connection.'));
    void runTransaction(db,tx=>ensureVoiceMembership(tx,ref,room.id,(room as any).entrySeat??null,serverTimestamp())).then(seat=>{if(!stopped){setRoomReady(true);setSeatedIndex(seat)}}).catch(()=>{if(!stopped)setSeatError('Could not save room connection. Rejoin the room.')});
    return()=>{stopped=true;stop()};
  },[room.id]);
  const handleSeatClick = async (index:number) => {
    if(seatLock.current)return;
    if(!roomReady){setSeatError('Connecting to the room…');return;}
    if(!seatPolicyReady){setSeatError('Seat permissions are loading. Please wait.');return;}
    if(!auth.currentUser){setSeatError('Sign in with Google to take a seat.');return;}
    const occupant=liveSeats[index];
    if(occupant&&occupant.uid!==auth.currentUser.uid){onOpenUsers(occupant.uid);return;}
    if(seatedIndex!==index&&lockedSeats.includes(index)){setSeatError('🔒 This seat is locked.');return;}
    seatLock.current=true;setSeatBusy(true);setSeatError('');voice.unlock();
    const next=seatedIndex===index?null:index;
    try{await updateDoc(doc(db,'users',auth.currentUser.uid),{currentRoomId:room.id,roomSeat:next,online:true,lastSeen:serverTimestamp()});setRoomReady(true);setSeatedIndex(next);setIsMicOn(next!==null&&!roomControls[myUid]?.muted&&!roomControls[myUid]?.blocked)}catch{setSeatError('Could not save seat. Check your connection.')}finally{seatLock.current=false;setSeatBusy(false)}
  };

  const [micBusy,setMicBusy]=useState(false);const micLock=useRef(false);
  const handleMicToggle = async () => {
    if(micLock.current)return;
    if (seatedIndex === null) {
      alert('Take a seat before enabling your microphone!');
      return;
    }
    if(roomControls[myUid]?.muted){setSeatError('The room admin has muted your microphone.');return;}
    if(isMicOn&&voice.speaking){setIsMicOn(false);return;}
    micLock.current=true;setMicBusy(true);setSeatError('');try{if(await voice.permission())setIsMicOn(true);else setSeatError(voice.failureReason());}finally{micLock.current=false;setMicBusy(false);}
  };

  const [chatBusy,setChatBusy]=useState(false);
  useEffect(()=>{if(!auth.currentUser)return;return onSnapshot(query(collection(db,'rooms',room.id,'chat'),orderBy('createdAt','desc'),limit(100)),snapshot=>{const messages=snapshot.docs.map(d=>({id:d.id,type:'chat' as const,text:String(d.data().text||''),sender:String(d.data().senderName||'User')})).reverse();setChatMessages(previous=>[...previous.filter(m=>m.type!=='chat'),...messages])},()=>setSeatError('Chat connection is unavailable. Please retry.'))},[room.id]);
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if(chatBusy||!auth.currentUser||!inputText.trim()||roomControls[myUid]?.blocked)return;
    setChatBusy(true);try{await addDoc(collection(db,'rooms',room.id,'chat'),{senderId:myUid,senderName:user.name,text:inputText.trim(),createdAt:serverTimestamp()});setInputText('')}catch{setSeatError('Could not save your message. Check your connection and rules.')}finally{setChatBusy(false)}
  };

  const triggerReaction = (emoji: string) => {
    const id = Date.now();
    const x = Math.floor(20 + Math.random() * 60);
    setFloatingParticles(prev => [...prev, { id, emoji, x }]);
    setShowReactionModal(false);
    setTimeout(() => {
      setFloatingParticles(prev => prev.filter(p => p.id !== id));
    }, 2000);
  };

  const allAvailableGifts = (customGifts && customGifts.length > 0
    ? customGifts.map((g: any) => ({ emoji: g.icon || g.emoji || '🎁', name: g.name, cost: g.price || g.cost || 10, image: g.image }))
    : GIFTS
  );

  const shownGiftItems=giftMode==='lucky'?luckyCatalog:allAvailableGifts;

  async function handleLuckyGift(){
   if(giftBusy||luckyLoading||!luckyEnabled)return;
   const item=luckyCatalog[selectedGiftIndex];
   if(!item||!Number.isSafeInteger(item.cost)||item.cost<1)return;
   const targets=[...new Set(giftRecipients)].filter(uid=>liveMembers.some(m=>m.uid===uid)||liveSeats.some(s=>s?.uid===uid));
   if(!targets.length){setGiftStatus('Select at least one room member to receive a Lucky Gift.');return;}
   const price=item.cost*giftQuantity*targets.length;
   if(!Number.isSafeInteger(price)||price<=0||price>100000000){setGiftStatus('Reduce the number of gifts.');return;}
   if(price>(luckyBalance??user.coins)){setGiftStatus('Insufficient coins in your wallet.');return;}
   setGiftBusy(true);setGiftStatus('🍀 Sending Lucky Gifts…');
   let delivered=0,won=0,lastBalance=luckyBalance??user.coins;
   try{
    for(const uid of targets){
     const key=JSON.stringify([room.id,item.id,uid,giftQuantity]);
     const requestId=luckyPending.current.get(key)||crypto.randomUUID();
     luckyPending.current.set(key,requestId);
     const result:any=await walletApi('lucky-gift',{
      action:'send',receiverId:uid,roomId:room.id,itemId:item.id,quotedCost:item.cost,quantity:giftQuantity,requestId
     });
     if(!Number.isSafeInteger(result.balance))throw Error('Could not read your wallet balance from the server.');
     luckyPending.current.delete(key);
     lastBalance=result.balance;delivered++;won+=Number(result.luckyReward||0);
     setLuckyBalance(lastBalance);
     if(Number(result.luckyReward)>0){
      setGiftOverlay({emoji:'🍀',text:`WIN ×${result.luckyMultiplier} · 🪙 ${Number(result.luckyReward).toLocaleString()}`});
      setTimeout(()=>setGiftOverlay(null),10000);
     }
    }
    setGiftStatus(`✅ Sent ${giftQuantity} Lucky Gifts to each of ${delivered} recipients.${won>0?' Total WIN 🪙 '+won.toLocaleString():''}`);
   }catch(e){setGiftStatus(`⚠️ Gifts delivered to ${delivered} recipients. Remaining sends stopped: ${(e as Error)?.message||'Server unavailable'}`)}
   finally{setGiftBusy(false)}
  }

  async function handleRealTimeGift() {
    if (giftBusy) return;
    const item = allAvailableGifts[selectedGiftIndex];
    if (!item) return;

    let targetUids = [...giftRecipients];
    if (targetUids.length === 0) {
      // If none selected, default to all live members except self, or all seated occupants, or self
      const others = liveMembers.filter(m => m.uid !== myUid).map(m => m.uid);
      const seatedOthers = liveSeats.filter(s => s && s.uid && s.uid !== myUid).map(s => s.uid);
      targetUids = seatedOthers.length > 0 ? seatedOthers : others.length > 0 ? others : [myUid || 'self'];
    }

    const totalCost = item.cost * giftQuantity * targetUids.length;
    if (user.coins < totalCost) {
      alert(`Insufficient coins in your wallet! Required: 🪙 ${totalCost.toLocaleString()}`);
      onOpenWallet();
      return;
    }

    setGiftBusy(true);
    setGiftStatus('🎁 Sending gifts…');

    try {
      let sentCount = 0;
      for (const targetUid of targetUids) {
        const targetMember = liveMembers.find(m => m.uid === targetUid) || liveSeats.find(s => s?.uid === targetUid) || {
          uid: targetUid,
          id: targetUid,
          name: targetUid === myUid ? user.name : 'Room member',
          avatar: '👤'
        };

        await sendDirectGift(db, {
          senderId: myUid || auth.currentUser?.uid || '',
          receiverId: targetUid,
          roomId: room.id,
          item,
          quantity: giftQuantity
        });
        sentCount++;
      }

      onUpdateCoins(user.coins - totalCost, `Sent ${item.name} gifts in the room (${sentCount} recipients)`);
      setRoomCoinTotal(tot => tot + totalCost);

      setChatMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          type: 'gift',
          text: `🎁 ${user.name} sent ${giftQuantity} ${item.emoji} ${item.name} gifts`,
          sender: user.name,
        },
      ]);

      setGiftOverlay({
        emoji: item.emoji,
        text: `🎁 ${user.name} sent ${giftQuantity} ${item.emoji} ${item.name} gifts`,
      });
      setTimeout(() => setGiftOverlay(null), 3000);

      setGiftStatus(`✅ Success! Sent ${giftQuantity} ${item.name} gifts to ${sentCount} recipients.`);
      setTimeout(() => {
        setShowGiftModal(false);
        setGiftStatus('');
      }, 1200);
    } catch (e: any) {
      console.error('Gift error:', e);
      setGiftStatus(e instanceof Error ? `❌ ${e.message}` : '❌ Could not send gifts.');
    } finally {
      setGiftBusy(false);
    }
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(room.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const backgroundAsset=mediaAssets.find(a=>a.kind==='room_background'&&a.id===(roomProfileOpen?roomBackgroundDraft:(room as any).customBackgroundId));
  const currentThemeBg = backgroundAsset?`linear-gradient(#0003,#0006),url("${backgroundAsset.image}") center/cover`: roomThemes[Number(roomThemeDraft !== undefined && roomProfileOpen ? roomThemeDraft : (room.th || 0)) % roomThemes.length];

  const roomAdvancedTools=<>
        <label className="room-action-status">🎛️ Voice effects <select aria-label="Voice effects" value={voiceEffect} disabled={voice.effectsAvailable===false} onChange={e=>setVoiceEffect(e.target.value as VoiceEffect)} style={{marginLeft:8,padding:10,borderRadius:10,background:'#201534',color:'#fff'}}><option value="normal">Normal</option><option value="radio">Radio</option><option value="warm">Warm</option><option value="echo">Echo</option></select><small style={{display:'block',marginTop:6}}>{voice.effectsAvailable===false?'Voice effects are unavailable on this device. Normal voice will be used.':'When your microphone is on, others will hear the selected voice effect.'}</small></label>
        {voice.audioBlocked&&<button className="b mx-3" onClick={()=>{voice.unlock();setIsRoomSoundOn(true)}}>🔊 Tap to enable audio</button>}
        <div className="room-utility-row"><LanguagePicker/><details className="room-voice-status" open={Boolean(voice.diagnostic)}><summary>🎙️ Voice connection and support</summary><p className="text-xs text-cyan-300" role="status">{roomReady?voice.status:'Connecting to the room…'}</p><p className="text-xs" data-no-translate>Mic: {Math.round(voice.micLevel*100)}% · Remote audio: {voice.remoteAudioCount} · {voice.connectionState}{voice.diagnostic?` · Code: ${voice.diagnostic}`:''}</p><button className="b" onClick={()=>{voice.unlock();setIsRoomSoundOn(true)}}>🔊 Enable audio to listen</button>{voice.diagnostic==='STALE_APP'&&<button className="b" onClick={()=>window.location.reload()}>↻ Load update</button>}<button className="b" onClick={()=>void voice.reconnect()}>↻ Reconnect voice</button></details><button className="back-card" onClick={()=>void followRoom()}>{isFollowed?"♥ Following room":"♡ Follow room"}</button>{seatedIndex!==null&&<button className="b" disabled={seatBusy} onClick={()=>void handleSeatClick(seatedIndex)}>Leave seat</button>}</div>
  </>;
  return (
    <div className="rv reference-room fixed inset-0 z-40 flex flex-col justify-between overflow-hidden select-none pt-safe pb-safe" style={{background: currentThemeBg}}>
      <header className="room-reference-header relative z-10">
        <div className="room-header-line"><button className="room-title-pill" onClick={()=>setRoomProfileOpen(true)}><MediaAvatar avatar={room.photoURL||room.cv} size={42}/><span><b>{room.name}</b><small>View room details ›</small></span></button><div className="room-header-actions"><button title="Room settings" aria-label="Room settings" onClick={()=>setRoomProfileOpen(true)}>⚙️</button><button title="Toggle audio" onClick={()=>{voice.unlock();setIsRoomSoundOn(!isRoomSoundOn)}}>{isRoomSoundOn?'🔊':'🔇'}</button><button title="Minimize room" onClick={onMinimize}>⌄</button><button title="Leave room" onClick={onLeaveRoom}>✕</button></div></div>
        <div className="room-header-line"><button className="room-value-pill" onClick={()=>setRoomProfileOpen(true)}>🏆 {roomCoinTotal.toLocaleString()} ›</button><div className="room-header-members">{liveMembers.slice(0,2).map(m=><button key={m.uid} onClick={()=>onOpenUsers(m.uid)}><MediaAvatar avatar={m.avatar} size={30}/></button>)}<button onClick={()=>setRoomProfileOpen(true)}>{liveMembers.length} members</button><button title="More room options" onClick={()=>setMoreOpen(true)}>⋯</button></div></div>
      </header>

      {/* Center Seats Grid (.sg3, .s3w, .s3, .nm3, .sc3) */}
      <div className="room-stage relative z-10 flex-1 overflow-hidden px-3 py-2 flex flex-col">
        <RoomGiftFlights roomId={room.id} onGift={event=>{setRoomCoinTotal(p=>p+event.cost);setChatMessages(p=>[...p,{id:event.id,type:'gift',sender:event.senderName,text:`${event.senderName} → ${event.receiverName} (ID ${event.receiverPublicId}): ${event.quantity} ${event.giftName} gifts · ${event.cost} coins`}])}}/>
        
        {seatBusy&&<p className="room-action-status" role="status">Saving seat…</p>}{seatError&&<p role="status">{seatError}</p>}

        {roomEntry&&(mediaAssets.find(a=>a.id===roomEntry.customEntryId)?<EntryMedia key={roomEntry.uid+roomEntry.at} image={mediaAssets.find(a=>a.id===roomEntry.customEntryId)!.image} name={roomEntry.name}/>:<RoomWelcome key={roomEntry.uid+roomEntry.at} name={roomEntry.name} avatar={roomEntry.avatar}/>) }
        <div className={`sg3 ${seatCount===5?'seats-5':seatCount===10?'seats-10':seatCount===20?'seats-20':seatCount%4===2?'center-first':''}`} style={{gridTemplateColumns:seatCount===5?'repeat(4,minmax(0,1fr))':seatCount===10||seatCount===15||seatCount===20?'repeat(5,minmax(0,1fr))':'repeat(4,minmax(0,1fr))'}}>
          {liveSeats.map((seat, idx) => {
            const isUserSeatedHere = seatedIndex === idx;
            return (
              <div key={idx} className="s3w" onClick={() => {
                if (seat?.uid && seat.uid !== myUid) {
                  setSelectedSeatUser({ ...seat, seatIndex: idx });
                } else {
                  void handleSeatClick(idx);
                }
              }}>
                <button className="sr-only" aria-label={`Seat ${idx+1}`} onClick={e=>{e.stopPropagation();if(seat?.uid&&seat.uid!==myUid)setSelectedSeatUser({...seat,seatIndex:idx});else void handleSeatClick(idx)}}>Seat {idx+1}</button>{canLockSeats&&<button className="seat-edit-trigger" aria-label={`Manage seat ${idx+1}`} onClick={e=>{e.stopPropagation();setSeatAction(idx)}}>⚙</button>}<div data-gift-uid={seat?.uid} data-gift-seat={seat?.uid?'true':undefined} className={`s3 ${lockedSeats.includes(idx)?'seat-is-locked':''} ${seat ? 'on' : ''} ${(isUserSeatedHere && isMicOn || voice.speakers.includes(seat?.uid)&&!roomControls[seat?.uid]?.muted) ? 'talk' : ''}`}>
                  {lockedSeats.includes(idx)&&seat&&<small className="seat-lock-badge">🔒</small>}{seat ? (
                    <MediaAvatar avatar={seat.avatar} frame={mediaAssets.find(a=>a.id===(activeRankingAward(seat)?.frameId||seat.customFrameId))?.image} size={48}/>
                  ) : (
                    <span className="neon-mic-icon">{lockedSeats.includes(idx)?'🔒':'🎙️'}</span>
                  )}
                </div>
                <div className="nm3" style={{ color: isUserSeatedHere ? 'var(--t)' : '#fff' }}>
                  {seat ? `${seat.name}${seat.uid===room.hostId?' · Owner':roomRoles[seat.uid]?.role==='admin'?' · Admin':''}` : `${lockedSeats.includes(idx)?'🔒':'Mic'} ${idx + 1}`} 
                </div>
                <small hidden={seatPolicyReady&&!lockedSeats.includes(idx)} className={"seat-availability "+(seatPolicyReady?lockedSeats.includes(idx)?'locked':'unlocked':'checking')}>{!seatPolicyReady?'Checking…':lockedSeats.includes(idx)?'🔒 Locked':'🔓 Unlocked'}</small><span className="sc3">🪙 {isUserSeatedHere ? Number((user as any).giftReceivedCoins || 0).toLocaleString() : Number(seat?.giftReceivedCoins||0).toLocaleString()}</span>
              </div>
            );
          })}
        </div>

        {/* Live Chat Container (.ct3, .ctb, #ch3) */}
        <div className="ct3" style={{ maxHeight: '170px', background: 'rgba(0,0,0,0.5)', borderRadius: '20px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)' }}>
          {/* Tabs */}
          <div className="ctb">
            {(['All', 'Chat', 'Gift', 'Notice'] as const).map(tab => (
              <span
                key={tab}
                className={activeChatTab === tab ? 'on' : ''}
                onClick={() => setActiveChatTab(tab)}
              >
                {tab}
              </span>
            ))}
          </div>

          {/* Messages */}
          <div id="ch3" ref={chatScrollRef}>
            {chatMessages
              .filter(m => activeChatTab === 'All' || activeChatTab.toLowerCase() === m.type)
              .map(m => (
                <p key={m.id} className={m.type}>
                  <span className="lb3">{m.type === 'gift' ? 'GIFT' : m.type === 'notice' ? 'NOTICE' : 'LV.5'}</span>
                  <b style={{ color: 'var(--g)', marginRight: '4px' }}>{m.sender}:</b>
                  <span data-no-translate="true">{m.text}</span>
                </p>
              ))}
          </div>
        </div>
      </div>

      {chatOpen&&<form className="ref-chat-form relative z-20 mx-3" onSubmit={handleSendMessage}><input autoFocus maxLength={1000} placeholder="Say something in the room…" value={inputText} onChange={e=>setInputText(e.target.value)}/><button type="submit" disabled={chatBusy}>{chatBusy?'Saving…':'Send'}</button><button type="button" aria-label="Close chat" onClick={()=>setChatOpen(false)}>✕</button></form>}
      <button className="room-event-shortcut" aria-label="Events and rewards" onClick={()=>setEventsOpen(true)}>{mediaAssets.find(a=>a.kind==='room_event_banner')?<img src={mediaAssets.find(a=>a.kind==='room_event_banner')!.image} alt="Event"/>:<span>🏆</span>}<small>Events</small></button>
      {eventsOpen&&<div className="room-sheet-overlay"><section className="room-more-card"><header><h3>🏆 Events and rewards</h3><button className="back-card" onClick={()=>setEventsOpen(false)}>✕ Close</button></header><EventCenter/></section></div>}
      {toolsOpen&&<div className="room-sheet-overlay"><section className="room-more-card"><header><h3>Voice and room tools</h3><button className="back-card" onClick={()=>setToolsOpen(false)}>✕ Close</button></header>{roomAdvancedTools}</section></div>}
      <button className="room-wallet-orb" aria-label="Open wallet from room" onClick={onOpenWallet}>🪙<small>Wallet</small></button>
      <nav className="room-bottom-controls" aria-label="Room actions">
        <button onClick={()=>setChatOpen(x=>!x)}><span>💬</span><small>Chat</small></button>
        <button disabled={micBusy} className={voice.speaking?'mic-on':''} onClick={()=>void handleMicToggle()}><span>{voice.speaking?'🎙️':'🔇'}</span><small>{micBusy?'Starting…':'Mic'}</small></button>
        <button onClick={()=>setShowReactionModal(x=>!x)}><span>😊</span><small>Emoji</small></button>
        <button onClick={()=>onOpenMessages?onOpenMessages():setMoreOpen(true)}><span>✉️</span><small>Mail</small></button>
        <button onClick={()=>setShowGameDrawer(true)}><span>🎮</span><small>Games</small></button>
        <button className="gift" onClick={()=>{setGiftRecipients([]);setSelectedGiftIndex(0);setGiftQuantity(1);setGiftStatus('');setShowGiftModal(true)}}><span>🎁</span><small>Gifts</small></button>
      </nav>

      {/* Seat Occupant Action Dialog */}
      {selectedSeatUser && (
        <div className="ref-overlay" style={{ zIndex: 110 }}>
          <section className="ref-seat-dialog">
            <div className="flex justify-center mb-1">
              <MediaAvatar avatar={selectedSeatUser.avatar} size={54} />
            </div>
            <h3>{selectedSeatUser.name}</h3>
            <p>ID: {selectedSeatUser.id || selectedSeatUser.uid} · Seat {selectedSeatUser.seatIndex + 1}</p>
            <button onClick={() => {
              setGiftRecipients([selectedSeatUser.uid]);
              setSelectedSeatUser(null);
              setShowGiftModal(true);
            }}>
              🎁 Send this user a gift
            </button>
            <button onClick={() => {
              const uid = selectedSeatUser.uid;
              setSelectedSeatUser(null);
              onOpenUsers(uid);
            }}>
              👤 View profile
            </button>
            <button className="secondary" onClick={() => setSelectedSeatUser(null)}>
              Cancel
            </button>
          </section>
        </div>
      )}

      {seatAction!==null&&<div className="ref-overlay"><section className="ref-seat-dialog"><h3>Choose an action</h3><p>Mic {seatAction+1} · {lockedSeats.includes(seatAction)?'Locked':'Unlocked'}</p><button disabled={!seatPolicyReady||seatBusy||lockedSeats.includes(seatAction)&&seatedIndex!==seatAction||!!liveSeats[seatAction]&&liveSeats[seatAction].uid!==myUid} onClick={()=>{void handleSeatClick(seatAction);setSeatAction(null)}}>{seatedIndex===seatAction?'Leave seat':'Take seat'}</button>{canLockSeats&&<><button disabled={policyBusy} onClick={()=>{void toggleSeatLock(seatAction);setSeatAction(null)}}>{lockedSeats.includes(seatAction)?'Unlock':'Lock'}</button><button disabled={policyBusy} onClick={()=>void lockAllSeats()}>{lockedSeats.length===seatCount?'Unlock all':'Lock all'}</button></>}<button onClick={()=>setSeatAction(null)}>Cancel</button></section></div>}

      {/* Floating Reaction Animation Overlay */}
      {floatingParticles.map(p => (
        <div
          key={p.id}
          style={{ left: `${p.x}%` }}
          className="absolute bottom-24 text-4xl pointer-events-none animate-bounce z-50 transition-all"
        >
          {p.emoji}
        </div>
      ))}

      {/* Large Gift Notification Banner */}
      {giftOverlay && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-purple-900 via-pink-700 to-amber-600 px-6 py-2.5 rounded-full border-2 border-yellow-300 shadow-2xl flex items-center gap-3 animate-bounce">
          <span className="text-4xl">{giftOverlay.emoji}</span>
          <span className="font-black text-white text-sm drop-shadow">{giftOverlay.text}</span>
        </div>
      )}

      {policyOpen&&<div className="room-sheet-overlay"><section className="seat-policy-sheet"><header className="flex justify-between items-center"><h3>⚙️ Room management</h3><button className="back-card" onClick={()=>setPolicyOpen(false)}>‹ Back</button></header><p className="text-xs text-violet-200 my-3">Users cannot join locked empty seats. Current occupants remain until removed through member controls.</p><article className="seat-policy-card"><h3>🎙️ Seat lock / unlock</h3><div className="seat-lock-grid">{Array.from({length:seatCount},(_,i)=><button key={i} disabled={!canLockSeats||policyBusy} className={lockedSeats.includes(i)?'locked':''} onClick={()=>void toggleSeatLock(i)}><span>{lockedSeats.includes(i)?'🔒':'🎙️'}</span><b>Seat {i+1}</b><small>{lockedSeats.includes(i)?'Locked':'Unlocked'}</small></button>)}</div>{!canLockSeats&&<p className="text-xs mt-3">Only the owner and authorized admins can manage seat locks.</p>}</article>{isCurrentUserHost&&<article className="seat-policy-card"><h3>👑 Assign an admin by user ID</h3><div className="flex gap-2"><input className="in min-w-0 flex-1" inputMode="numeric" placeholder="User ID" value={adminId} onChange={e=>setAdminId(e.target.value)}/><button disabled={policyBusy} className="b t" onClick={()=>void findAdmin()}>Assign admin</button></div><p className="text-xs mt-2">You can appoint an admin by registered user ID, even if that user is outside the room.</p></article>}{canModerate&&<article className="seat-policy-card"><h3>🛡️ User and admin permissions</h3><select className="in w-full" value={policyTarget} onChange={e=>setPolicyTarget(e.target.value)}><option value="">Select user</option>{Array.from(new Set([...liveMembers.map(m=>m.uid),...Object.keys(roomRoles),...Object.keys(roomControls)])).filter(uid=>uid!==room.hostId&&(isCurrentUserHost||roomRoles[uid]?.role!=='admin')).map(uid=><option key={uid} value={uid}>{liveMembers.find(m=>m.uid===uid)?.name||policyUsers[uid]?.name||'User'} · {liveMembers.find(m=>m.uid===uid)?.id||policyUsers[uid]?.id||'Loading ID'}{roomRoles[uid]?.role==='admin'?' · Admin':''}</option>)}</select>{policyTarget&&<div className="policy-action-grid">{isCurrentUserHost&&<><button className="back-card" onClick={()=>void policyAction('admin')}>👑 Assign admin</button><button className="back-card" onClick={()=>void policyAction('user')}>Remove admin</button>{roomRoles[policyTarget]?.role==='admin'&&<button className="back-card" onClick={()=>void policyAction(roomRoles[policyTarget]?.canLockSeats?'no-lock-permission':'lock-permission')}>{roomRoles[policyTarget]?.canLockSeats?'Revoke seat-lock permission':'🔑 Grant seat-lock permission'}</button>}</>}<button className="back-card" onClick={()=>void policyAction('mute')}>🔇 Mute microphone</button><button className="back-card" onClick={()=>void policyAction('block')}>🚫 Remove from room</button><button className="back-card" onClick={()=>void policyAction('clear')}>Allow microphone / entry</button></div>}</article>}<p className="text-sm text-cyan-200 mt-3" role="status">{policyStatus}</p></section></div>}

      {roomProfileOpen&&<div className="room-sheet-overlay"><section className="room-profile-card"><button className="back-card" onClick={()=>setRoomProfileOpen(false)}>‹ Back</button><h2 data-no-translate="true">🏠 {room.name}</h2><button className="back-card" onClick={()=>void followRoom()}>{isFollowed?'♥ Following room':'♡ Follow room'}</button><p>ID: {(room as any).publicId||room.id}</p>{isCurrentUserHost&&<><ProfilePhotoEditor roomId={room.id}/><div className="room-settings-section"><h3>Change seat count</h3><div className="flex flex-wrap gap-2 my-2.5">{[5,8,10,12,15,16,20].map(cnt=><button key={cnt} type="button" className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${roomSeatCountDraft===cnt?'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/40 scale-105':'bg-white/10 text-white hover:bg-white/20'}`} onClick={()=>setRoomSeatCountDraft(cnt)}>{cnt} seats ({cnt} Seats)</button>)}</div><p className="text-xs text-violet-200">Choose a seat count. Saving immediately updates the room seat layout.</p></div><div className="room-settings-section"><h3>Room theme</h3><div className="grid grid-cols-4 gap-2 my-2.5">{roomThemeDetails.map((theme,i)=><button key={theme.id} type="button" className={`h-16 rounded-xl border-2 flex flex-col items-center justify-center p-1 relative transition-all ${roomThemeDraft===i?'border-amber-400 scale-105 shadow-lg shadow-amber-400/30 ring-2 ring-amber-300':'border-white/20 opacity-80 hover:opacity-100'}`} style={{background:theme.bg}} onClick={()=>{setRoomThemeDraft(i);setRoomBackgroundDraft('')}}>{roomThemeDraft===i&&<span className="absolute top-1 right-1 text-xs text-amber-300 font-black">✓</span>}<small className="text-[10px] text-white font-bold drop-shadow leading-tight text-center">{theme.name}</small></button>)}</div><p className="text-xs text-violet-200">Select a theme to preview it, then save your room profile.</p></div><div className="room-settings-section"><h3>Room backgrounds from gallery</h3><div className="room-background-options"><button type="button" aria-pressed={!roomBackgroundDraft} onClick={()=>setRoomBackgroundDraft('')}>Default theme</button>{mediaAssets.filter(a=>a.kind==='room_background').map(a=><button key={a.id} type="button" aria-pressed={roomBackgroundDraft===a.id} onClick={()=>setRoomBackgroundDraft(a.id)}><img src={a.image} alt={a.name}/><small>{a.name}</small></button>)}</div></div><label className="room-lock-toggle"><input type="checkbox" checked={roomLockedDraft} onChange={e=>setRoomLockedDraft(e.target.checked)}/><span>{roomLockedDraft?'🔒 Room locked':'🔓 Room unlocked'}</span></label><p>Save to apply. Locked rooms allow the owner, room admins and existing members.</p><label className="block text-sm my-3">Room name<input maxLength={80} className="in w-full" value={roomNameDraft} onChange={e=>setRoomNameDraft(e.target.value)}/></label><label className="block text-sm my-3">Description / announcement<textarea maxLength={500} className="in w-full" value={roomAnnDraft} onChange={e=>setRoomAnnDraft(e.target.value)}/></label><p role="status" className="room-settings-feedback">{seatError}</p><button disabled={roomSaveBusy||!roomNameDraft.trim()} className="back-card" onClick={()=>void saveRoomProfile()}>{roomSaveBusy?'Saving…':'Save profile'}</button></>}<div className="room-info-grid"><div>Room Value<b>{roomCoinTotal.toLocaleString()}</b></div><div>Members<b>{liveMembers.length}</b></div></div><h3>📢 Announcement</h3><p>{room.ann||'Welcome everyone!'}</p><h3>Room members</h3>{liveMembers.map(m=><button className="back-card" key={m.uid} onClick={()=>{setRoomProfileOpen(false);onOpenUsers(m.uid)}}>{m.name} · ID {m.id}</button>)}</section></div>}
      {moreOpen&&<div className="room-sheet-overlay"><section className="room-more-card"><header className="flex justify-between"><h3>✨ More</h3><button className="back-card" onClick={()=>setMoreOpen(false)}>‹ Back</button></header><div className="room-info-grid">{[['🎛️','Voice and room tools',()=>setToolsOpen(true)],['🎮','Games',()=>setShowGameDrawer(true)],['🏠','Room Profile',()=>setRoomProfileOpen(true)],['🎁','Gift',()=>setShowGiftModal(true)],['🔊','Audio',()=>{voice.unlock();setIsRoomSoundOn(true)}],['🪙','Wallet',onOpenWallet],['⚙️','Settings',()=>setPolicyOpen(true)]].map(([icon,label,action])=><button className="room-tool" key={String(label)} onClick={()=>{setMoreOpen(false);(action as ()=>void)()}}><span>{String(icon)}</span>{String(label)}</button>)}</div></section></div>}
      {/* In-Room Game Drawer Modal */}
      {showGameDrawer && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-0">
          <div className="w-full max-w-md bg-gradient-to-b from-indigo-950 via-slate-950 to-black border-t-2 border-purple-500/50 rounded-t-3xl p-4 text-white max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center pb-2 border-b border-white/10 mb-3">
              <h3 className="font-black text-base text-amber-300 flex items-center gap-1.5">
                <Gamepad2 size={18} /> Play games inside the room
              </h3>
              <button onClick={() => setShowGameDrawer(false)} className="back-card">‹ Back</button>
            </div>
            <p className="text-xs text-purple-200 mb-3">
              Play games while staying in the room and place coin bets whenever a round is open.
            </p>

            <div className="room-game-grid grid grid-cols-3 gap-2.5 overflow-y-auto flex-1 pb-4">
              {ROOM_GAMES.map(g => (
                <button
                  key={g.id}
                  onClick={() => {
                    setShowGameDrawer(false);
                    onOpenGame(g.id);
                  }}
                  className={`bg-gradient-to-br ${g.bg} p-3 rounded-2xl border border-white/15 flex flex-col items-center justify-between aspect-square active:scale-95 transition-all shadow-lg text-center`}
                >
                  <span className="text-4xl drop-shadow mb-1">{g.icon}</span>
                  <div>
                    <h4 className="font-black text-xs text-white">{g.name}</h4>
                    <p className="text-[10px] text-gray-300 mt-0.5 leading-tight">{g.desc}</p>
                  </div>
                  <span className="text-[10px] font-bold text-amber-300 bg-black/40 px-2 py-0.5 rounded-full mt-1">
                    ▶ Play
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Real-time In-Room Gift Modal Drawer */}
      {showGiftModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-0" data-gift-dialog="true">
          <div className="w-full max-w-md bg-gradient-to-b from-[#21163e] to-[#0f0920] border-t-2 border-pink-500/50 rounded-t-3xl p-4 text-white max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-2 border-b border-white/10 mb-2">
              <h3 className="font-black text-base text-pink-300 flex items-center gap-1.5">
                <Gift size={18} /> Send live gifts
              </h3>
              <button onClick={() => setShowGiftModal(false)} className="back-card">‹ Back</button>
            </div>

            <div className="mb-2 flex gap-2" role="tablist" aria-label="Gift categories">
              {(['classic','lucky'] as const).map(mode=><button key={mode} role="tab" aria-selected={giftMode===mode}
                disabled={giftBusy} type="button" onClick={()=>{setGiftMode(mode);setSelectedGiftIndex(0);setGiftStatus('')}}
                className={`flex-1 rounded-xl py-2 font-black text-sm ${giftMode===mode?'bg-gradient-to-r from-fuchsia-700 to-amber-500 text-white':'bg-white/10 text-purple-200'}`}>
                {mode==='classic'?'🎁 Classic':'🍀 Lucky'}
              </button>)}
            </div>
            {giftMode==='lucky'&&<p className="text-center text-xs text-amber-200 mb-2 p-1 rounded-lg bg-purple-950/80">
              Chance to get {luckyMultipliers.join(' / ')} times coins back · {luckyLoading?'Loading…':luckyEnabled?'Server-determined rewards':'Send is available after the admin enables Lucky Gifts'}
            </p>}

            {/* Recipient Selection */}
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-purple-200 font-bold">Select recipients:</span>
                <button 
                  type="button"
                  className="text-xs text-cyan-300 font-bold underline"
                  onClick={() => {
                    const allUids = liveSeats.filter(s => s?.uid && s.uid !== myUid).map(s => s.uid);
                    if (allUids.length === giftRecipients.length) setGiftRecipients([]);
                    else setGiftRecipients(allUids);
                  }}
                >
                  {giftRecipients.length === 0 ? 'All seated members' : 'Clear'}
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto py-1">
                {liveSeats.map((seat, idx) => {
                  if (!seat?.uid) return null;
                  const isSelected = giftRecipients.includes(seat.uid);
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all ${
                        isSelected 
                          ? 'bg-pink-600 text-white border border-pink-300 shadow-md shadow-pink-600/40' 
                          : 'bg-white/10 text-gray-300 border border-white/10'
                      }`}
                      onClick={() => {
                        setGiftRecipients(prev => 
                          prev.includes(seat.uid) ? prev.filter(u => u !== seat.uid) : [...prev, seat.uid]
                        );
                      }}
                    >
                      <MediaAvatar avatar={seat.avatar} size={20} />
                      <span className="max-w-[70px] truncate">{seat.name}</span>
                      <small className="opacity-75">#{idx + 1}</small>
                    </button>
                  );
                })}
                {liveMembers.filter(m => m.uid !== myUid && !liveSeats.some(s => s?.uid === m.uid)).map(m => {
                  const isSelected = giftRecipients.includes(m.uid);
                  return (
                    <button
                      key={m.uid}
                      type="button"
                      className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all ${
                        isSelected 
                          ? 'bg-pink-600 text-white border border-pink-300 shadow-md shadow-pink-600/40' 
                          : 'bg-white/10 text-gray-300 border border-white/10'
                      }`}
                      onClick={() => {
                        setGiftRecipients(prev => 
                          prev.includes(m.uid) ? prev.filter(u => u !== m.uid) : [...prev, m.uid]
                        );
                      }}
                    >
                      <MediaAvatar avatar={m.avatar} size={20} />
                      <span className="max-w-[70px] truncate">{m.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gifts Grid */}
            <div className="grid grid-cols-4 gap-2 mb-3 overflow-y-auto max-h-[30vh]">
              {shownGiftItems.map((g, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedGiftIndex(i)}
                  className={`border rounded-2xl p-2 flex flex-col items-center justify-center transition-all ${
                    selectedGiftIndex === i
                      ? 'bg-gradient-to-b from-pink-600 to-purple-700 border-amber-300 shadow-lg shadow-pink-600/30 scale-105'
                      : 'bg-white/5 hover:bg-white/10 border-white/10'
                  }`}
                >
                  <span className="text-3xl mb-0.5">{g.image?<img src={g.image} alt={g.name} className="w-14 h-14 object-contain"/>:g.emoji}</span>
                  <span className="font-bold text-xs truncate max-w-full">{g.name}</span>
                  <span className="text-[10px] text-amber-300 font-bold mt-0.5">🪙 {g.cost.toLocaleString()}</span>
                </button>
              ))}
            </div>

            {/* Quantity Selector & Cost Summary */}
            <div className="space-y-2 border-t border-white/10 pt-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-purple-200">Choose quantity:</span>
                <div className="flex gap-1.5">
                  {(giftMode==='lucky'?[1,7,17,77,111,777]:[1,7,77,177,777]).map(num => (
                    <button
                      key={num}
                      type="button"
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                        giftQuantity === num ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                      onClick={() => setGiftQuantity(num)}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {giftStatus && (
                <p className="text-xs text-center font-bold text-cyan-300 bg-cyan-950/60 p-1.5 rounded-lg border border-cyan-800">
                  {giftStatus}
                </p>
              )}

              <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-xl border border-white/10">
                <div>
                  <small className="text-gray-400 block text-[10px]">Total cost:</small>
                  <b className="text-amber-300 text-sm">
                    🪙 {((shownGiftItems[selectedGiftIndex]?.cost || 0) * giftQuantity * Math.max(1, giftRecipients.length)).toLocaleString()} coins
                  </b>
                </div>
                <button
                  type="button"
                  disabled={giftBusy||giftMode==='lucky'&&(!luckyEnabled||luckyLoading)}
                  onClick={() => void (giftMode==='lucky'?handleLuckyGift():handleRealTimeGift())}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white font-black text-sm hover:brightness-110 active:scale-95 shadow-lg shadow-pink-500/30 disabled:opacity-50"
                >
                  {giftBusy ? 'Sending…' : giftMode==='lucky' ? '🍀 Send Lucky' : '🚀 Send Gift'}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                <span>Wallet balance: <b className="text-amber-400">🪙 {(luckyBalance??user.coins).toLocaleString()}</b></span>
                <button type="button" onClick={onOpenWallet} className="text-cyan-300 underline font-bold">Recharge ›</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExitConfirm&&<div className="ref-leave-overlay"><section className="ref-leave-sheet"><h3>Leave this room?</h3><div className="ref-leave-stats"><div><b>{Math.floor((Date.now()-enteredAt.current)/60000)} minutes</b><small>Time in this room</small></div><div><b>{liveMembers.length} members</b><small>Room members</small></div></div><button className="ref-button" onClick={()=>{setShowExitConfirm(false);onMinimize()}}>Minimize room</button><button className="ref-button blue" onClick={()=>{setShowExitConfirm(false);onLeaveRoom()}}>Leave room</button><button className="ref-button secondary" onClick={()=>setShowExitConfirm(false)}>Cancel</button></section></div>}

      {/* Reaction Picker Popup */}
      {showReactionModal && (
        <div className="absolute right-4 bottom-20 z-50 bg-slate-900 border border-white/20 p-2 rounded-2xl flex gap-2 shadow-xl">
          {REACTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => triggerReaction(emoji)}
              className="text-2xl hover:scale-125 transition-transform active:scale-95 p-1"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
