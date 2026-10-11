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
import { collection, doc, updateDoc, onSnapshot, query, where } from 'firebase/firestore';
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

const ROOM_GAMES = [
  { id: 'lion_wheel', name: 'সিংহ ফুড হুইল', icon: '🦁', desc: 'সালাদ, পিজা ও ৩ডি হুইল', bg: 'from-amber-700 to-orange-900' },
  { id: 'night_wheel', name: 'নাইট ফুড হুইল', icon: '🌙', desc: 'রাতের চাকা ঘুরিয়ে কয়েন', bg: 'from-indigo-900 to-purple-950' },
  { id: 'jackpot_fruit', name: 'জ্যাকপট ফ্রুট', icon: '🍒', desc: 'ফল মিলিয়ে ৪০ গুণ পর্যন্ত', bg: 'from-pink-700 to-rose-900' },
  { id: 'slots', name: 'স্লটস (Slots)', icon: '🎰', desc: '৩-রিল ক্লাসিক স্লট', bg: 'from-red-800 to-rose-950' },
  { id: 'carrom', name: 'ক্যারাম (Carrom)', icon: '🔴', desc: 'আসল ফিজিক্স ক্যারাম বোর্ড', bg: 'from-teal-800 to-emerald-950' },
  { id: 'chess_3d', name: 'দাবা ৩ডি (Chess 3D)', icon: '♟️', desc: 'থ্রিডি দাবা ও কম্পিউটারের চাল', bg: 'from-stone-800 to-zinc-950' },
];

export const VoiceRoomView: React.FC<Props> = ({
  room,
  user,
  customGifts,
  onUpdateCoins,
  onOpenGame,
  onOpenWallet,
  onMinimize,
  onLeaveRoom,
  onClose,
  onOpenUsers,
}) => {
  const seatCount = room.sc || (room.d ? 12 : 8);
  const isCurrentUserHost = Boolean(room.host === user.name || (room.hostId && (room.hostId === user.id || room.hostId === user.uid)));
  
  const [seatedIndex, setSeatedIndex] = useState<number | null>(() => {
    return isCurrentUserHost ? 0 : null;
  });
  const [isMicOn, setIsMicOn] = useState<boolean>(() => isCurrentUserHost);
  const [isRoomSoundOn, setIsRoomSoundOn] = useState<boolean>(true);
  const [isFollowed, setIsFollowed] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; type: 'chat' | 'gift' | 'notice'; text: string; sender: string }[]>([
    { id: '1', type: 'notice', text: `📢 ${room.ann || 'রুমে স্বাগতম! সবাই মিলে আড্ডা দিই 🎉'}`, sender: 'System' },
    { id: '2', type: 'notice', text: `🎉 ${user.name} রুমে প্রবেশ করেছেন`, sender: 'System' },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [activeChatTab, setActiveChatTab] = useState<'All' | 'Chat' | 'Gift' | 'Notice'>('All');
  const [showGiftModal, setShowGiftModal] = useState<boolean>(false);
  const [showReactionModal, setShowReactionModal] = useState<boolean>(false);
  const [showGameDrawer, setShowGameDrawer] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
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

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeChatTab]);

  const [seatBusy,setSeatBusy]=useState(false),[seatError,setSeatError]=useState('');
  const seatLock=useRef(false);
  const liveSeats=Array.from({length:seatCount},(_,index)=>liveMembers.filter(m=>m.roomSeat===index).sort((a,b)=>a.uid.localeCompare(b.uid))[0]||null);
  useEffect(()=>{if(auth.currentUser)void updateDoc(doc(db,'users',auth.currentUser.uid),{roomSeat:isCurrentUserHost?0:null}).catch(()=>setSeatError('সিট সেভ হয়নি। Google লগইন পরীক্ষা করুন।'))},[room.id]);
  const handleSeatClick = async (index:number) => {
    if(seatLock.current)return;
    if(!auth.currentUser){setSeatError('রুমে বসতে Google দিয়ে লগইন করুন।');return;}
    const occupant=liveSeats[index];
    if(occupant&&occupant.uid!==auth.currentUser.uid){onOpenUsers(occupant.uid);return;}
    seatLock.current=true;setSeatBusy(true);setSeatError('');
    const next=seatedIndex===index?null:index;
    try{await updateDoc(doc(db,'users',auth.currentUser.uid),{roomSeat:next});setSeatedIndex(next);if(next===null)setIsMicOn(false)}catch{setSeatError('সিট সেভ হয়নি। সংযোগ পরীক্ষা করুন।')}finally{seatLock.current=false;setSeatBusy(false)}
  };

  const handleMicToggle = () => {
    if (seatedIndex === null) {
      alert('মাইক চালু করতে আগে যেকোনো একটি সিটে বসুন!');
      return;
    }
    setIsMicOn(prev => !prev);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setChatMessages(prev => [
      ...prev,
      {
        id: String(Date.now()),
        type: 'chat',
        text: inputText.trim(),
        sender: user.name,
      },
    ]);
    setInputText('');
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
    <div className="rv fixed inset-0 z-40 flex flex-col justify-between overflow-hidden select-none pt-safe pb-safe" style={{ background: 'radial-gradient(circle at 50% 20%, #301860, #0a071b 80%)' }}>
      {/* Top Room Header with Host Pill and Actions */}
      <div className="relative z-10 p-2.5 flex items-center justify-between border-b border-white/10 bg-black/60 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {/* Back Button (Triggers Exit Options Dialog) */}
          <button
            onClick={() => setShowExitConfirm(true)}
            className="ib"
            style={{ width: '34px', height: '34px', fontSize: '18px', padding: 0 }}
            title="ব্যাকে যান / প্রস্থান"
          >
            ‹
          </button>

          {/* Direct Quick Minimize Button */}
          <button
            onClick={onMinimize}
            className="ib"
            style={{ width: '34px', height: '34px', fontSize: '16px', background: 'rgba(25, 230, 193, 0.2)', borderColor: 'rgba(25, 230, 193, 0.5)', color: 'var(--t)', padding: 0 }}
            title="রুম মিনিমাইজ করুন (Minimize)"
          >
            <ChevronDown size={18} />
          </button>

          {/* Host Pill from Original Design (.hp) */}
          <div className="hp">
            <div className="av fa" style={{ width: '34px', height: '34px', fontSize: '18px', background: 'linear-gradient(135deg,#ffe38a,#d8920a)' }}>
              <div>{room.cv}</div>
            </div>
            <div>
              <b style={{ fontSize: '13px', display: 'block', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {room.name}
              </b>
              <small>ID: {room.id} · {room.host}</small>
            </div>
            <button
              onClick={() => setIsFollowed(!isFollowed)}
              style={{ background: 'none', color: isFollowed ? '#ff5c9d' : '#ffffff88', padding: '0 2px', fontSize: '14px' }}
            >
              {isFollowed ? '❤️' : '🤍'}
            </button>
          </div>
        </div>

        {/* Room Header Actions */}
        <div className="flex items-center gap-1.5">
          {/* Room Total Coins (.gi) */}
          <div className="gi" style={{ width: 'auto', padding: '0 10px', height: '34px', gap: '4px', fontSize: '11px', fontWeight: 900 }}>
            <span>🏆</span>
            <span style={{ color: '#3a1c00' }}>{roomCoinTotal.toLocaleString()}</span>
          </div>

          <button
            onClick={() => setIsRoomSoundOn(!isRoomSoundOn)}
            className="ib"
            style={{ width: '34px', height: '34px', fontSize: '14px', padding: 0 }}
            title={isRoomSoundOn ? 'সাউন্ড বন্ধ' : 'সাউন্ড চালু'}
          >
            {isRoomSoundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Leave Button */}
          <button
            onClick={() => setShowExitConfirm(true)}
            className="ib"
            style={{ width: '34px', height: '34px', fontSize: '14px', background: 'rgba(239, 68, 68, 0.25)', borderColor: 'rgba(239, 68, 68, 0.5)', color: '#fca5a5', padding: 0 }}
            title="রুম থেকে বের হবেন (Leave)"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Center Seats Grid (.sg3, .s3w, .s3, .nm3, .sc3) */}
      <div className="relative z-10 flex-1 overflow-y-auto px-2 py-2 flex flex-col justify-between">
        <RoomGiftFlights roomId={room.id} onGift={event=>{setRoomCoinTotal(p=>p+event.cost);setChatMessages(p=>[...p,{id:event.id,type:'gift',sender:event.senderName,text:`${event.senderName} → ${event.receiverName} (ID ${event.receiverPublicId}): ${event.quantity}টি ${event.giftName} · ${event.cost} কয়েন`}])}}/>
        <p className="text-xs text-cyan-200">ইউজারের ছবি বা সিটে চাপ দিয়ে তাকে গিফট দিন।</p>
        {seatError&&<p role="status">{seatError}</p>}
        {seatedIndex!==null&&<button className="b" disabled={seatBusy} onClick={()=>void handleSeatClick(seatedIndex)}>সিট ছেড়ে উঠুন</button>}
        {roomEntry&&mediaAssets.find(a=>a.id===roomEntry.customEntryId)&&<EntryMedia key={roomEntry.uid+roomEntry.at} image={mediaAssets.find(a=>a.id===roomEntry.customEntryId)!.image} name={roomEntry.name}/>}
        <div className="flex gap-2 overflow-x-auto pb-3">{liveMembers.map(member=><button key={member.uid} className="gl p-2 shrink-0 text-center" onClick={()=>onOpenUsers(member.uid)}><span data-gift-uid={member.uid}><MediaAvatar avatar={member.avatar} frame={mediaAssets.find(a=>a.id===member.customFrameId)?.image}/></span><b className="block">{member.name}</b><small className="block">ID {member.id} · 🟢 অনলাইন</small><small>🎁 {member.giftReceivedCount||0}টি · 🪙 {Number(member.giftReceivedCoins||0).toLocaleString()}</small></button>)}</div>
        <div className="sg3" style={{ gridTemplateColumns: `repeat(${seatCount <= 8 ? 4 : 4}, 1fr)`, margin: 'auto 0' }}>
          {liveSeats.map((seat, idx) => {
            const isUserSeatedHere = seatedIndex === idx;
            return (
              <div key={idx} className="s3w" onClick={() => seat?.uid?onOpenUsers(seat.uid):void handleSeatClick(idx)}>
                <div data-gift-uid={seat?.uid} data-gift-seat={seat?.uid?'true':undefined} className={`s3 ${seat ? 'on' : ''} ${isUserSeatedHere && isMicOn ? 'talk' : ''}`}>
                  {seat ? (
                    <MediaAvatar avatar={seat.avatar} frame={mediaAssets.find(a=>a.id===seat.customFrameId)?.image} size={48}/>
                  ) : (
                    <span style={{ fontSize: '15px', fontWeight: 900, opacity: 0.7 }}>{idx + 1}</span>
                  )}
                </div>
                <div className="nm3" style={{ color: isUserSeatedHere ? 'var(--t)' : '#fff' }}>
                  {seat ? seat.name : `সিট ${idx + 1}`}
                </div>
                <span className="sc3">🪙 {isUserSeatedHere ? Number((user as any).giftReceivedCoins || 0).toLocaleString() : Number(seat?.giftReceivedCoins||0).toLocaleString()}</span>
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
                  <span>{m.text}</span>
                </p>
              ))}
          </div>
        </div>
      </div>

      {/* Floating Action Buttons on Right (.fb) */}
      <div className="fb">
        <button onClick={() => setShowGameDrawer(true)} title="রুমের ভেতর গেমস">🎮</button>
        <button onClick={onOpenWallet} title="ওয়ালেট">👛</button>
        <button onClick={()=>onOpenUsers()} title="গিফট" style={{ animation: 'bounce 1.5s infinite' }}>🎁</button>
        <button onClick={() => setShowReactionModal(!showReactionModal)} title="রিঅ্যাকশন">😊</button>
      </div>

      {/* Bottom Bar: Chat input, Mic button (.bb, .go) */}
      <div className="bb">
        {/* Golden / Green Mic Toggle Button (.go) */}
        <button
          onClick={handleMicToggle}
          className={`go ${isMicOn ? 'on' : ''}`}
          title={isMicOn ? 'মাইক বন্ধ করুন' : 'মাইক চালু করুন'}
        >
          {isMicOn ? '🎙️' : '🔇'}
        </button>

        {/* Chat input form */}
        <form onSubmit={handleSendMessage} style={{ display: 'flex', flex: 1, gap: '6px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="কিছু বলুন... রুমে আড্ডা দিন"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
          />
          <button type="submit" className="b t" style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '13px' }}>
            পাঠান
          </button>
        </form>
        {/* Reaction Picker Button */}
        <button
          onClick={() => setShowReactionModal(!showReactionModal)}
          className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-amber-300 active:scale-95"
        >
          <Smile size={20} />
        </button>
      </div>

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

      {/* In-Room Game Drawer Modal */}
      {showGameDrawer && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-0">
          <div className="w-full max-w-md bg-gradient-to-b from-indigo-950 via-slate-950 to-black border-t-2 border-purple-500/50 rounded-t-3xl p-4 text-white max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center pb-2 border-b border-white/10 mb-3">
              <h3 className="font-black text-base text-amber-300 flex items-center gap-1.5">
                <Gamepad2 size={18} /> রুমের ভিতর গেম খেলুন (Play in Room)
              </h3>
              <button onClick={() => setShowGameDrawer(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <p className="text-xs text-purple-200 mb-3">
              গেম চলাকালীন আপনি রুমের ভেতরেই থাকবেন এবং যেকোনো সময় গেমে বাজি ধরে কয়েন জিততে পারবেন!
            </p>

            <div className="grid grid-cols-2 gap-2.5 overflow-y-auto flex-1 pb-4">
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
              <button onClick={() => setShowGiftModal(false)} className="text-gray-400 hover:text-white">✕</button>
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

      {/* Exit / Leave Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-gradient-to-b from-indigo-950 to-slate-950 border-2 border-amber-400/50 rounded-3xl p-5 text-center text-white shadow-2xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center text-2xl">
              🚪
            </div>
            <h3 className="font-black text-base text-white">রুম থেকে বের হবেন?</h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              আপনি কি রুম মিনিমাইজ করে রাখতে চান নাকি সম্পূর্ণ লিভ নিয়ে বের হতে চান?
            </p>

            <div className="space-y-2 pt-1">
              {/* Option 1: Minimize */}
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  onMinimize();
                }}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-teal-600 rounded-xl font-black text-xs text-slate-950 shadow flex items-center justify-center gap-1.5 active:scale-95"
              >
                <ChevronDown size={16} /> মিনিমাইজ করুন (পরে আবার ফিরুন)
              </button>

              {/* Option 2: Leave */}
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  onLeaveRoom();
                }}
                className="w-full py-2.5 bg-rose-600/80 hover:bg-rose-600 rounded-xl font-bold text-xs text-white border border-rose-400/40 flex items-center justify-center gap-1.5 active:scale-95"
              >
                <LogOut size={16} /> রুম ত্যাগ করুন (Leave Room)
              </button>

              <button
                onClick={() => setShowExitConfirm(false)}
                className="w-full py-1.5 text-xs text-gray-400 hover:text-white"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

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
