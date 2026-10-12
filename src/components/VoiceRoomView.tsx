import {LanguagePicker} from '../i18n/LanguagePicker';
import {RoomWelcome} from './RoomWelcome';
import {liveGames,roomThemes} from '../design/catalog';
import {ProfilePhotoEditor} from './ProfilePhotoEditor';
import {useRoomAudio} from '../lib/useRoomAudio';
import {GameWinFeed} from './GameWinFeed';
import {useMediaAssets,MediaAvatar,EntryMedia} from './MediaAssets';
import {RoomGiftFlights} from './RoomGiftFlights';
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
import { collection, addDoc, orderBy, limit, doc, updateDoc, onSnapshot, query, where, setDoc, deleteDoc, runTransaction, getDocs, getDoc, serverTimestamp } from 'firebase/firestore';
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
}

const GIFTS = [
  { emoji: '❤️', name: 'হার্ট', cost: 1 },
  { emoji: '🌹', name: 'গোলাপ', cost: 10 },
  { emoji: '⭐', name: 'স্টার', cost: 250 },
  { emoji: '💍', name: 'লাভ রিং', cost: 750 },
  { emoji: '💎', name: 'ডায়মন্ড', cost: 1100 },
  { emoji: '🚗', name: 'VIP কার', cost: 2000 },
  { emoji: '🚀', name: 'রকেট', cost: 5000 },
  { emoji: '👑', name: 'ক্রাউন', cost: 15000 },
];

const REACTIONS = ['❤️', '👏', '😂', '🔥', '😍', '🎉'];

const ROOM_GAMES=liveGames.map(g=>({...g,desc:'একই সার্ভার ও ওয়ালেট',bg:'from-purple-800 to-slate-950'}));

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
}) => {
  const [roomData,setRoomData]=useState<Partial<VoiceRoom>>({});
  const room={...roomInput,...roomData};
  useEffect(()=>{setRoomData({});return onSnapshot(doc(db,'rooms',roomInput.id),s=>{if(s.exists())setRoomData(s.data())},()=>{})},[roomInput.id]);
  const seatCount = room.sc || (room.d ? 12 : 8);
  const isCurrentUserHost = Boolean(auth.currentUser && room.hostId === auth.currentUser.uid);
  
  const [seatedIndex, setSeatedIndex] = useState<number | null>(() => {
    return null;
  });
  const [isMicOn, setIsMicOn] = useState<boolean>(false);
  const [isRoomSoundOn, setIsRoomSoundOn] = useState<boolean>(true);
  const [isFollowed, setIsFollowed] = useState<boolean>(false);
  useEffect(()=>{if(!auth.currentUser)return;return onSnapshot(doc(db,'users',auth.currentUser.uid,'roomLibrary',String(room.id)),snap=>setIsFollowed(snap.data()?.followed===true));},[room.id]);
  async function followRoom(){if(!auth.currentUser)return;try{await setDoc(doc(db,'users',auth.currentUser.uid,'roomLibrary',String(room.id)),{followed:!isFollowed},{merge:true})}catch{setSeatError('রুম ফলো সেভ হয়নি। নতুন Rules প্রকাশ করুন।')}}
  const [chatMessages, setChatMessages] = useState<{ id: string; type: 'chat' | 'gift' | 'notice'; text: string; sender: string }[]>([
    { id: '1', type: 'notice', text: `📢 ${room.ann || 'রুমে স্বাগতম! সবাই মিলে আড্ডা দিই 🎉'}`, sender: 'System' },
    { id: '2', type: 'notice', text: `🎉 ${user.name} রুমে প্রবেশ করেছেন`, sender: 'System' },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [activeChatTab, setActiveChatTab] = useState<'All' | 'Chat' | 'Gift' | 'Notice'>('All');
  const [showGiftModal, setShowGiftModal] = useState<boolean>(false);
  const [showReactionModal, setShowReactionModal] = useState<boolean>(false);
  const [moreOpen,setMoreOpen]=useState(false),[roomProfileOpen,setRoomProfileOpen]=useState(false);
  const [roomNameDraft,setRoomNameDraft]=useState(''),[roomAnnDraft,setRoomAnnDraft]=useState(''),[roomSaveBusy,setRoomSaveBusy]=useState(false),[roomThemeDraft,setRoomThemeDraft]=useState(0),[roomLockedDraft,setRoomLockedDraft]=useState(false);
  useEffect(()=>{if(roomProfileOpen){setRoomNameDraft(room.name);setRoomAnnDraft(room.ann||'');setRoomThemeDraft(Number(room.th||0)%4);setRoomLockedDraft((room as any).locked===true)}},[roomProfileOpen,room.id]);
  async function saveRoomProfile(){if(!isCurrentUserHost||roomSaveBusy||!roomNameDraft.trim())return;setRoomSaveBusy(true);try{await updateDoc(doc(db,'rooms',room.id),{name:roomNameDraft.trim(),ann:roomAnnDraft.trim(),th:roomThemeDraft,locked:roomLockedDraft});setSeatError('✅ রুমের প্রোফাইল সেভ হয়েছে')}catch{setSeatError('রুমের প্রোফাইল সেভ হয়নি।')}finally{setRoomSaveBusy(false)}}
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
    return onSnapshot(query(collection(db,'users'),where('currentRoomId','==',room.id)),snapshot=>{const members=snapshot.docs.map(d=>({...d.data(),uid:d.id})).filter((u:any)=>u.online&&!['banned','archived'].includes(u.status)&&Date.now()-(u.lastSeen?.toMillis?.()||0)<90000);if(!initial)for(const member of members)if(!seen.has(member.uid)&&member.uid!==auth.currentUser?.uid)setRoomEntry({...member,at:Date.now()});seen=new Set(members.map(m=>m.uid));initial=false;setLiveMembers(members)},()=>{});
  },[room.id]);

  const [roomRoles,setRoomRoles]=useState<Record<string,any>>({}),[roomControls,setRoomControls]=useState<Record<string,any>>({}),[policyOpen,setPolicyOpen]=useState(false),[policyTarget,setPolicyTarget]=useState(''),[policyStatus,setPolicyStatus]=useState('');
  const myUid=auth.currentUser?.uid||'';
  const [seatPolicyReady,setSeatPolicyReady]=useState(false);
  const [lockedSeats,setLockedSeats]=useState<number[]>([]),[policyBusy,setPolicyBusy]=useState(false),[adminId,setAdminId]=useState('');
  useEffect(()=>{setSeatPolicyReady(false);return onSnapshot(doc(db,'rooms',room.id,'seatPolicy','config'),{includeMetadataChanges:true},s=>{if(!s.metadata.fromCache){setLockedSeats(s.data()?.locked||[]);setSeatPolicyReady(true)}},()=>{setSeatPolicyReady(false);setSeatError('Seat permissions could not load. Publish the latest Firebase rules.')})},[room.id]);
  const [policyUsers,setPolicyUsers]=useState<Record<string,any>>({});
  const policyIds=Array.from(new Set([...Object.keys(roomRoles),...Object.keys(roomControls)])).sort().join('|');
  useEffect(()=>{if(!policyOpen)return;let stopped=false;void Promise.all(policyIds.split('|').filter(Boolean).map(async uid=>{const snap=await getDoc(doc(db,'users',uid));return [uid,snap.data()||{}]})).then(rows=>{if(!stopped)setPolicyUsers(Object.fromEntries(rows))}).catch(()=>{});return()=>{stopped=true}},[policyOpen,policyIds]);
  const canLockSeats=isCurrentUserHost||(roomRoles[myUid]?.role==='admin'&&roomRoles[myUid]?.canLockSeats===true);
  const canModerate=isCurrentUserHost||roomRoles[myUid]?.role==='admin';
  useEffect(()=>{if(!auth.currentUser)return;const a=onSnapshot(collection(db,'rooms',room.id,'roles'),v=>setRoomRoles(Object.fromEntries(v.docs.map(d=>[d.id,d.data()]))),()=>{});const b=onSnapshot(collection(db,'rooms',room.id,'controls'),v=>setRoomControls(Object.fromEntries(v.docs.map(d=>[d.id,d.data()]))),()=>{});return()=>{a();b()}},[room.id]);
  useEffect(()=>{const c=roomControls[myUid];if(c?.muted)setIsMicOn(false);if(c?.blocked){onLeaveRoom()}},[roomControls,myUid]);
  const voice=useRoomAudio(room.id,isMicOn,isRoomSoundOn,seatedIndex!==null&&!roomControls[myUid]?.muted&&!roomControls[myUid]?.blocked,roomControls,roomReady);
  async function policyAction(action:string){if(!policyTarget)return;setPolicyStatus('সেভ হচ্ছে…');try{if(action==='admin')await setDoc(doc(db,'rooms',room.id,'roles',policyTarget),{role:'admin',canLockSeats:false});else if(action==='lock-permission'||action==='no-lock-permission')await updateDoc(doc(db,'rooms',room.id,'roles',policyTarget),{canLockSeats:action==='lock-permission'});else if(action==='user')await deleteDoc(doc(db,'rooms',room.id,'roles',policyTarget));else await runTransaction(db,async t=>{const ref=doc(db,'rooms',room.id,'controls',policyTarget),old=await t.get(ref);t.set(ref,{muted:action==='clear'?false:action==='mute'?true:old.data()?.muted===true,blocked:action==='clear'?false:action==='block'?true:old.data()?.blocked===true})});setPolicyStatus('✅ সেভ হয়েছে')}catch{setPolicyStatus('সেভ হয়নি। অনুমতি ও নতুন রুম রুলস পরীক্ষা করুন।')}}

  async function toggleSeatLock(index:number){if(!canLockSeats||policyBusy)return;setPolicyBusy(true);setPolicyStatus('সেভ হচ্ছে…');try{await runTransaction(db,async t=>{const ref=doc(db,'rooms',room.id,'seatPolicy','config'),snap=await t.get(ref);const previous:number[]=snap.data()?.locked||[];t.set(ref,{locked:previous.includes(index)?previous.filter(i=>i!==index):[...previous,index].sort((a,b)=>a-b),updatedBy:myUid,updatedAt:serverTimestamp()})});setPolicyStatus('✅ সিটের লক সেভ হয়েছে')}catch{setPolicyStatus('সিট লক সেভ হয়নি। অনুমতি ও নতুন Rules পরীক্ষা করুন।')}finally{setPolicyBusy(false)}}
  async function lockAllSeats(){if(!canLockSeats||policyBusy)return;setPolicyBusy(true);try{await runTransaction(db,async tx=>{const ref=doc(db,'rooms',room.id,'seatPolicy','config'),snap=await tx.get(ref),old=snap.data()?.locked||[];tx.set(ref,{locked:old.length===seatCount?[]:Array.from({length:seatCount},(_,i)=>i),updatedBy:myUid,updatedAt:serverTimestamp()})});setSeatAction(null);setPolicyStatus('✅ সব সিটের অনুমতি সেভ হয়েছে')}catch{setSeatError('সিটের অনুমতি সেভ হয়নি।')}finally{setPolicyBusy(false)}}
  async function findAdmin(){if(!isCurrentUserHost||!adminId.trim()||policyBusy)return;setPolicyBusy(true);try{const result=await getDocs(query(collection(db,'users'),where('id','==',adminId.trim())));const user=result.docs[0];if(!user||['banned','archived'].includes(user.data().status)){setPolicyStatus('সক্রিয় ইউজার পাওয়া যায়নি।');return}if(user.id===room.hostId){setPolicyStatus('রুম ওনার ইতিমধ্যে সব অনুমতি পান।');return}setPolicyTarget(user.id);await setDoc(doc(db,'rooms',room.id,'roles',user.id),{role:'admin',canLockSeats:false});setPolicyStatus(`✅ ID ${adminId.trim()} রুম অ্যাডমিন হয়েছেন। চাইলে সিট লকের অনুমতি দিন।`)}catch{setPolicyStatus('অ্যাডমিন সেভ হয়নি। সংযোগ ও অনুমতি পরীক্ষা করুন।')}finally{setPolicyBusy(false)}}

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeChatTab]);

  const [seatBusy,setSeatBusy]=useState(false),[seatError,setSeatError]=useState('');
  const seatLock=useRef(false);
  const liveSeats=Array.from({length:seatCount},(_,index)=>liveMembers.filter(m=>m.roomSeat===index).sort((a,b)=>a.uid.localeCompare(b.uid))[0]||null);
  useEffect(()=>{let stopped=false;setRoomReady(false);setSeatedIndex(null);setIsMicOn(false);enteredAt.current=Date.now();const initial=(room as any).entrySeat??null;if(auth.currentUser)void updateDoc(doc(db,'users',auth.currentUser.uid),{currentRoomId:room.id,roomSeat:initial,online:true,lastSeen:serverTimestamp()}).then(()=>{if(!stopped){setSeatedIndex(initial);setRoomReady(true)}}).catch(()=>setSeatError('রুম / সিট সেভ হয়নি। Google লগইন ও Rules পরীক্ষা করুন।'));return()=>{stopped=true}},[room.id]);
  const handleSeatClick = async (index:number) => {
    if(seatLock.current)return;
    if(!seatPolicyReady){setSeatError('Seat permissions are loading. Please wait.');return;}
    if(!auth.currentUser){setSeatError('রুমে বসতে Google দিয়ে লগইন করুন।');return;}
    const occupant=liveSeats[index];
    if(occupant&&occupant.uid!==auth.currentUser.uid){onOpenUsers(occupant.uid);return;}
    if(seatedIndex!==index&&lockedSeats.includes(index)){setSeatError('🔒 এই সিট লক করা আছে।');return;}
    seatLock.current=true;setSeatBusy(true);setSeatError('');
    const next=seatedIndex===index?null:index;
    try{await updateDoc(doc(db,'users',auth.currentUser.uid),{currentRoomId:room.id,roomSeat:next,online:true,lastSeen:serverTimestamp()});setSeatedIndex(next);if(next===null)setIsMicOn(false)}catch{setSeatError('সিট সেভ হয়নি। সংযোগ পরীক্ষা করুন।')}finally{seatLock.current=false;setSeatBusy(false)}
  };

  const handleMicToggle = async () => {
    if (seatedIndex === null) {
      alert('মাইক চালু করতে আগে যেকোনো একটি সিটে বসুন!');
      return;
    }
    if(roomControls[myUid]?.muted){setSeatError('রুম অ্যাডমিন আপনার মাইক বন্ধ রেখেছেন।');return;}
    if(isMicOn){setIsMicOn(false);return;}
    if(await voice.permission())setIsMicOn(true);
  };

  const [chatBusy,setChatBusy]=useState(false);
  useEffect(()=>{if(!auth.currentUser)return;return onSnapshot(query(collection(db,'rooms',room.id,'chat'),orderBy('createdAt','desc'),limit(100)),snapshot=>{const messages=snapshot.docs.map(d=>({id:d.id,type:'chat' as const,text:String(d.data().text||''),sender:String(d.data().senderName||'ইউজার')})).reverse();setChatMessages(previous=>[...previous.filter(m=>m.type!=='chat'),...messages])},()=>setSeatError('চ্যাট লোড হয়নি। নতুন Rules প্রকাশ করুন।'))},[room.id]);
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if(chatBusy||!auth.currentUser||!inputText.trim()||roomControls[myUid]?.blocked)return;
    setChatBusy(true);try{await addDoc(collection(db,'rooms',room.id,'chat'),{senderId:myUid,senderName:user.name,text:inputText.trim(),createdAt:serverTimestamp()});setInputText('')}catch{setSeatError('মেসেজ সেভ হয়নি। সংযোগ ও Rules পরীক্ষা করুন।')}finally{setChatBusy(false)}
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

  const handleSendGift = (gift: typeof GIFTS[0]) => {
    if (user.coins < gift.cost) {
      alert('আপনার ওয়ালেটে পর্যাপ্ত কয়েন নেই!');
      onOpenWallet();
      return;
    }

    onUpdateCoins(user.coins - gift.cost, `রুমে ${gift.name} গিফট পাঠানো`);
    setRoomCoinTotal(tot => tot + gift.cost);

    setChatMessages(prev => [
      ...prev,
      {
        id: String(Date.now()),
        type: 'gift',
        text: `🎁 ${user.name} পাঠালেন ${gift.emoji} ${gift.name}`,
        sender: user.name,
      },
    ]);

    setShowGiftModal(false);
    setGiftOverlay({
      emoji: gift.emoji,
      text: `🎁 ${user.name} পাঠালেন ${gift.emoji} ${gift.name}`,
    });
    setTimeout(() => setGiftOverlay(null), 2500);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(room.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rv reference-room fixed inset-0 z-40 flex flex-col justify-between overflow-hidden select-none pt-safe pb-safe" style={{background:roomThemes[Number(room.th||0)%4]}}>
      <header className="room-reference-header relative z-10">
        <div className="room-header-line"><button className="room-title-pill" onClick={()=>setRoomProfileOpen(true)}><MediaAvatar avatar={room.photoURL||room.cv} size={42}/><span><b>{room.name}</b><small>ID: {(room as any).publicId||room.id}</small></span></button><div className="room-header-actions"><button title="অডিও চালু/বন্ধ" onClick={()=>{voice.unlock();setIsRoomSoundOn(!isRoomSoundOn)}}>{isRoomSoundOn?'🔊':'🔇'}</button><button title="রুম মিনিমাইজ" onClick={onMinimize}>⌄</button><button title="রুম থেকে ফিরুন" onClick={()=>setShowExitConfirm(true)}>✕</button></div></div>
        <div className="room-header-line"><button className="room-value-pill" onClick={()=>setRoomProfileOpen(true)}>🏆 {roomCoinTotal.toLocaleString()} ›</button><div className="room-header-members">{liveMembers.slice(0,2).map(m=><button key={m.uid} onClick={()=>onOpenUsers(m.uid)}><MediaAvatar avatar={m.avatar} size={30}/></button>)}<button onClick={()=>setRoomProfileOpen(true)}>{liveMembers.length} জন</button><button title="রুমের আরও অপশন" onClick={()=>setMoreOpen(true)}>⋯</button></div></div>
      </header>

      {/* Center Seats Grid (.sg3, .s3w, .s3, .nm3, .sc3) */}
      <div className="room-stage relative z-10 flex-1 overflow-y-auto px-3 py-2 flex flex-col">
        <div className="room-live-wins"><GameWinFeed roomId={room.id}/></div><RoomGiftFlights roomId={room.id} onGift={event=>{setRoomCoinTotal(p=>p+event.cost);setChatMessages(p=>[...p,{id:event.id,type:'gift',sender:event.senderName,text:`${event.senderName} → ${event.receiverName} (ID ${event.receiverPublicId}): ${event.quantity}টি ${event.giftName} · ${event.cost} কয়েন`}])}}/>
        
        {seatError&&<p role="status">{seatError}</p>}

        {roomEntry&&(mediaAssets.find(a=>a.id===roomEntry.customEntryId)?<EntryMedia key={roomEntry.uid+roomEntry.at} image={mediaAssets.find(a=>a.id===roomEntry.customEntryId)!.image} name={roomEntry.name}/>:<RoomWelcome key={roomEntry.uid+roomEntry.at} name={roomEntry.name} avatar={roomEntry.avatar}/>) }
        <div className="flex gap-2 overflow-x-auto pb-2">{liveMembers.filter(member=>!Number.isInteger(member.roomSeat)).map(member=><button key={member.uid} className="shrink-0 text-center" title={member.name} onClick={()=>onOpenUsers(member.uid)}><span data-gift-uid={member.uid}><MediaAvatar avatar={member.avatar} frame={mediaAssets.find(a=>a.id===member.customFrameId)?.image}/></span><small className="block" data-no-translate="true">{member.name}</small></button>)}</div>
        <div className={`sg3 ${seatCount%4===2?'center-first':''}`} style={{gridTemplateColumns:'repeat(4,minmax(0,1fr))'}}>
          {liveSeats.map((seat, idx) => {
            const isUserSeatedHere = seatedIndex === idx;
            return (
              <div key={idx} className="s3w" onClick={() => seat?.uid?onOpenUsers(seat.uid):setSeatAction(idx)}>
                <button className="sr-only" aria-label={`সিট ${idx+1}`} onClick={e=>{e.stopPropagation();seat?.uid?onOpenUsers(seat.uid):setSeatAction(idx)}}>সিট {idx+1}</button>{canLockSeats&&<button className="seat-edit-trigger" aria-label={`সিট ${idx+1} পরিচালনা`} onClick={e=>{e.stopPropagation();setSeatAction(idx)}}>⚙</button>}<div data-gift-uid={seat?.uid} data-gift-seat={seat?.uid?'true':undefined} className={`s3 ${lockedSeats.includes(idx)?'seat-is-locked':''} ${seat ? 'on' : ''} ${(isUserSeatedHere && isMicOn || voice.speakers.includes(seat?.uid)&&!roomControls[seat?.uid]?.muted) ? 'talk' : ''}`}>
                  {lockedSeats.includes(idx)&&seat&&<small className="seat-lock-badge">🔒</small>}{seat ? (
                    <MediaAvatar avatar={seat.avatar} frame={mediaAssets.find(a=>a.id===seat.customFrameId)?.image} size={48}/>
                  ) : (
                    <span className="neon-mic-icon">{lockedSeats.includes(idx)?'🔒':'🎙️'}</span>
                  )}
                </div>
                <div className="nm3" style={{ color: isUserSeatedHere ? 'var(--t)' : '#fff' }}>
                  {seat ? `${seat.name}${seat.uid===room.hostId?' · মালিক':roomRoles[seat.uid]?.role==='admin'?' · অ্যাডমিন':''}` : `${lockedSeats.includes(idx)?'🔒':'মাইক'} ${idx + 1}`} 
                </div>
                <small className={"seat-availability "+(seatPolicyReady?lockedSeats.includes(idx)?'locked':'unlocked':'checking')}>{!seatPolicyReady?'Checking…':lockedSeats.includes(idx)?'🔒 Locked':'🔓 Unlocked'}</small><span className="sc3">🪙 {isUserSeatedHere ? Number((user as any).giftReceivedCoins || 0).toLocaleString() : Number(seat?.giftReceivedCoins||0).toLocaleString()}</span>
              </div>
            );
          })}
        </div>

        <div className="room-utility-row"><LanguagePicker/><details className="room-voice-status"><summary>🎙️ ভয়েস সংযোগ</summary><p className="text-xs text-cyan-300" role="status">{roomReady?voice.status:'রুমের সংযোগ তৈরি হচ্ছে…'}</p><button className="b" onClick={()=>{voice.unlock();setIsRoomSoundOn(true)}}>🔊 কথা শুনতে অডিও চালু করুন</button></details><button className="back-card" onClick={()=>void followRoom()}>{isFollowed?"♥ রুম ফলো করা আছে":"♡ রুম ফলো করুন"}</button>{seatedIndex!==null&&<button className="b" disabled={seatBusy} onClick={()=>void handleSeatClick(seatedIndex)}>সিট ছেড়ে উঠুন</button>}</div>
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

      {chatOpen&&<form className="ref-chat-form relative z-20 mx-3" onSubmit={handleSendMessage}><input autoFocus maxLength={1000} placeholder="রুমে কিছু বলুন…" value={inputText} onChange={e=>setInputText(e.target.value)}/><button type="submit" disabled={chatBusy}>{chatBusy?'সেভ হচ্ছে…':'পাঠান'}</button><button type="button" aria-label="চ্যাট বন্ধ" onClick={()=>setChatOpen(false)}>✕</button></form>}
      <button className="room-wallet-orb" aria-label="রুম থেকে ওয়ালেট খুলুন" onClick={onOpenWallet}>🪙<small>ওয়ালেট</small></button>
      <nav className="room-bottom-controls" aria-label="রুমের অ্যাকশন">
        <button onClick={()=>setChatOpen(x=>!x)}><span>💬</span><small>চ্যাট</small></button>
        <button className={isMicOn?'mic-on':''} onClick={()=>void handleMicToggle()}><span>{isMicOn?'🎙️':'🔇'}</span><small>মাইক</small></button>
        <button onClick={()=>setShowReactionModal(x=>!x)}><span>😊</span><small>ইমো</small></button>
        <button onClick={()=>onOpenMessages?onOpenMessages():setMoreOpen(true)}><span>✉️</span><small>মেইল</small></button>
        <button onClick={()=>setShowGameDrawer(true)}><span>🎮</span><small>গেম</small></button>
        <button className="gift" onClick={()=>onOpenUsers('')}><span>🎁</span><small>গিফট</small></button>
      </nav>
      {seatAction!==null&&<div className="ref-overlay"><section className="ref-seat-dialog"><h3>একটি অ্যাকশন বেছে নিন</h3><p>মাইক {seatAction+1} · {lockedSeats.includes(seatAction)?'লক করা':'খোলা'}</p><button disabled={!seatPolicyReady||seatBusy||lockedSeats.includes(seatAction)&&seatedIndex!==seatAction||!!liveSeats[seatAction]&&liveSeats[seatAction].uid!==myUid} onClick={()=>{void handleSeatClick(seatAction);setSeatAction(null)}}>{seatedIndex===seatAction?'সিট ছেড়ে উঠুন':'মাইকে বসুন'}</button>{canLockSeats&&<><button disabled={policyBusy} onClick={()=>{void toggleSeatLock(seatAction);setSeatAction(null)}}>{lockedSeats.includes(seatAction)?'আনলক করুন':'লক করুন'}</button><button disabled={policyBusy} onClick={()=>void lockAllSeats()}>{lockedSeats.length===seatCount?'সব আনলক করুন':'সব লক করুন'}</button></>}<button onClick={()=>setSeatAction(null)}>বাতিল</button></section></div>}

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

      {policyOpen&&<div className="room-sheet-overlay"><section className="seat-policy-sheet"><header className="flex justify-between items-center"><h3>⚙️ রুম পরিচালনা</h3><button className="back-card" onClick={()=>setPolicyOpen(false)}>‹ ফিরে যান</button></header><p className="text-xs text-violet-200 my-3">লক করা খালি সিটে কেউ বসতে পারবেন না। আগে বসে থাকা ইউজার থাকবেন; তাঁকে সরাতে আলাদা কন্ট্রোল ব্যবহার করুন।</p><article className="seat-policy-card"><h3>🎙️ সিট লক / আনলক</h3><div className="seat-lock-grid">{Array.from({length:seatCount},(_,i)=><button key={i} disabled={!canLockSeats||policyBusy} className={lockedSeats.includes(i)?'locked':''} onClick={()=>void toggleSeatLock(i)}><span>{lockedSeats.includes(i)?'🔒':'🎙️'}</span><b>সিট {i+1}</b><small>{lockedSeats.includes(i)?'লক':'খোলা'}</small></button>)}</div>{!canLockSeats&&<p className="text-xs mt-3">সিট লকের অনুমতি কেবল ওনার বা অনুমতিপ্রাপ্ত অ্যাডমিনের।</p>}</article>{isCurrentUserHost&&<article className="seat-policy-card"><h3>👑 ইউজার ID দিয়ে অ্যাডমিন দিন</h3><div className="flex gap-2"><input className="in min-w-0 flex-1" inputMode="numeric" placeholder="ইউজার ID" value={adminId} onChange={e=>setAdminId(e.target.value)}/><button disabled={policyBusy} className="b t" onClick={()=>void findAdmin()}>অ্যাডমিন দিন</button></div><p className="text-xs mt-2">ইউজার রুমের বাইরে থাকলেও নিবন্ধিত ID দিয়ে অ্যাডমিন দিতে পারবেন।</p></article>}{canModerate&&<article className="seat-policy-card"><h3>🛡️ ইউজার ও অ্যাডমিনের অনুমতি</h3><select className="in w-full" value={policyTarget} onChange={e=>setPolicyTarget(e.target.value)}><option value="">ইউজার বেছে নিন</option>{Array.from(new Set([...liveMembers.map(m=>m.uid),...Object.keys(roomRoles),...Object.keys(roomControls)])).filter(uid=>uid!==room.hostId&&(isCurrentUserHost||roomRoles[uid]?.role!=='admin')).map(uid=><option key={uid} value={uid}>{liveMembers.find(m=>m.uid===uid)?.name||policyUsers[uid]?.name||'ইউজার'} · {liveMembers.find(m=>m.uid===uid)?.id||policyUsers[uid]?.id||'আইডি লোড হচ্ছে'}{roomRoles[uid]?.role==='admin'?' · অ্যাডমিন':''}</option>)}</select>{policyTarget&&<div className="policy-action-grid">{isCurrentUserHost&&<><button className="back-card" onClick={()=>void policyAction('admin')}>👑 অ্যাডমিন দিন</button><button className="back-card" onClick={()=>void policyAction('user')}>অ্যাডমিন সরান</button>{roomRoles[policyTarget]?.role==='admin'&&<button className="back-card" onClick={()=>void policyAction(roomRoles[policyTarget]?.canLockSeats?'no-lock-permission':'lock-permission')}>{roomRoles[policyTarget]?.canLockSeats?'সিট লকের অনুমতি বন্ধ':'🔑 সিট লকের অনুমতি দিন'}</button>}</>}<button className="back-card" onClick={()=>void policyAction('mute')}>🔇 মাইক বন্ধ</button><button className="back-card" onClick={()=>void policyAction('block')}>🚫 রুম থেকে সরান</button><button className="back-card" onClick={()=>void policyAction('clear')}>মাইক / প্রবেশ চালু</button></div>}</article>}<p className="text-sm text-cyan-200 mt-3" role="status">{policyStatus}</p></section></div>}

      {roomProfileOpen&&<div className="room-sheet-overlay"><section className="room-profile-card"><button className="back-card" onClick={()=>setRoomProfileOpen(false)}>‹ ফিরে যান</button><h2 data-no-translate="true">🏠 {room.name}</h2><button className="back-card" onClick={()=>void followRoom()}>{isFollowed?'♥ Following room':'♡ Follow room'}</button><p>ID: {(room as any).publicId||room.id}</p>{isCurrentUserHost&&<><ProfilePhotoEditor roomId={room.id}/><div className="room-settings-section"><h3>Room theme</h3><div className="ref-theme-picker">{roomThemes.map((theme,i)=><button key={theme} aria-label={`Theme ${i+1}`} aria-pressed={roomThemeDraft===i} className={roomThemeDraft===i?'selected':''} style={{background:theme}} onClick={()=>setRoomThemeDraft(i)}/>)}</div><label className="room-lock-toggle"><input type="checkbox" checked={roomLockedDraft} onChange={e=>setRoomLockedDraft(e.target.checked)}/><span>{roomLockedDraft?'🔒 Room locked':'🔓 Room unlocked'}</span></label><p>Save to apply. Locked rooms allow the owner, room admins and existing members.</p></div><label className="block text-sm my-3">রুমের নাম<input maxLength={80} className="in w-full" value={roomNameDraft} onChange={e=>setRoomNameDraft(e.target.value)}/></label><label className="block text-sm my-3">পরিচিতি / ঘোষণা<textarea maxLength={500} className="in w-full" value={roomAnnDraft} onChange={e=>setRoomAnnDraft(e.target.value)}/></label><button disabled={roomSaveBusy||!roomNameDraft.trim()} className="back-card" onClick={()=>void saveRoomProfile()}>{roomSaveBusy?'সেভ হচ্ছে…':'প্রোফাইল সেভ করুন'}</button></>}<div className="room-info-grid"><div>Room Value<b>{roomCoinTotal.toLocaleString()}</b></div><div>Members<b>{liveMembers.length}</b></div></div><h3>📢 Announcement</h3><p>{room.ann||'সবাইকে স্বাগতম!'}</p><h3>রুমের সদস্য</h3>{liveMembers.map(m=><button className="back-card" key={m.uid} onClick={()=>{setRoomProfileOpen(false);onOpenUsers(m.uid)}}>{m.name} · ID {m.id}</button>)}</section></div>}
      {moreOpen&&<div className="room-sheet-overlay"><section className="room-more-card"><header className="flex justify-between"><h3>✨ More</h3><button className="back-card" onClick={()=>setMoreOpen(false)}>‹ ফিরে যান</button></header><div className="room-info-grid">{[['🎮','Games',()=>setShowGameDrawer(true)],['🏠','Room Profile',()=>setRoomProfileOpen(true)],['🎁','Gift',()=>onOpenUsers('')],['🔊','Audio',()=>{voice.unlock();setIsRoomSoundOn(true)}],['🪙','Wallet',onOpenWallet],['⚙️','Settings',()=>setPolicyOpen(true)]].map(([icon,label,action])=><button className="room-tool" key={String(label)} onClick={()=>{setMoreOpen(false);(action as ()=>void)()}}><span>{String(icon)}</span>{String(label)}</button>)}</div></section></div>}
      {/* In-Room Game Drawer Modal */}
      {showGameDrawer && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-0">
          <div className="w-full max-w-md bg-gradient-to-b from-indigo-950 via-slate-950 to-black border-t-2 border-purple-500/50 rounded-t-3xl p-4 text-white max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center pb-2 border-b border-white/10 mb-3">
              <h3 className="font-black text-base text-amber-300 flex items-center gap-1.5">
                <Gamepad2 size={18} /> রুমের ভিতর গেম খেলুন (Play in Room)
              </h3>
              <button onClick={() => setShowGameDrawer(false)} className="back-card">‹ ফিরে যান</button>
            </div>
            <p className="text-xs text-purple-200 mb-3">
              গেম চলাকালীন আপনি রুমের ভেতরেই থাকবেন এবং যেকোনো সময় গেমে বাজি ধরে কয়েন জিততে পারবেন!
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
                    ▶ খেলুন
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Gift Modal Drawer */}
      {showGiftModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-0">
          <div className="w-full max-w-md bg-gradient-to-b from-indigo-950 to-slate-950 border-t-2 border-pink-500/50 rounded-t-3xl p-4 text-white">
            <div className="flex justify-between items-center pb-2 border-b border-white/10 mb-3">
              <h3 className="font-black text-base text-pink-300 flex items-center gap-1.5">
                <Gift size={18} /> গিফট পাঠান (Send Gifts)
              </h3>
              <button onClick={() => setShowGiftModal(false)} className="back-card">‹ ফিরে যান</button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {(customGifts && customGifts.length > 0
                ? customGifts.map((g: any) => ({ emoji: g.icon || g.emoji, name: g.name, cost: g.price || g.cost || 10 }))
                : GIFTS
              ).map((g, i) => (
                <button
                  key={i}
                  onClick={() => handleSendGift(g)}
                  className="bg-white/10 hover:bg-white/20 border border-white/15 rounded-2xl p-2.5 flex flex-col items-center justify-center transition-all active:scale-95"
                >
                  <span className="text-3xl mb-1">{g.emoji}</span>
                  <span className="font-bold text-xs">{g.name}</span>
                  <span className="text-[10px] text-amber-300 font-bold mt-0.5">🪙 {g.cost.toLocaleString()}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs bg-black/40 p-3 rounded-xl border border-white/10">
              <span className="text-gray-300">আপনার ওয়ালেট ব্যালেন্স:</span>
              <span className="font-black text-amber-400">🪙 {user.coins.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {showExitConfirm&&<div className="ref-leave-overlay"><section className="ref-leave-sheet"><h3>রুম থেকে বের হবেন?</h3><div className="ref-leave-stats"><div><b>{Math.floor((Date.now()-enteredAt.current)/60000)} মিনিট</b><small>এই রুমে সময়</small></div><div><b>{liveMembers.length} জন</b><small>রুমের সদস্য</small></div></div><button className="ref-button" onClick={()=>{setShowExitConfirm(false);onMinimize()}}>রুম ছোট করে রাখুন</button><button className="ref-button blue" onClick={()=>{setShowExitConfirm(false);onLeaveRoom()}}>রুম ছেড়ে চলে যান</button><button className="ref-button secondary" onClick={()=>setShowExitConfirm(false)}>বাতিল</button></section></div>}

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
