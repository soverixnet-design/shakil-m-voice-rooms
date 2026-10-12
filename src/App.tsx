import {withTimeout} from './lib/authTimeout';
import {AuthScreen} from './components/AuthScreen';
import {RoomWelcome} from './components/RoomWelcome';
import {galleryPhoto} from './lib/profilePhoto';
import {ProfilePhotoEditor} from './components/ProfilePhotoEditor';
import {confirmedCoins,safeSiteSettings} from './lib/walletState';
import {GlobalGameRanks} from './components/GlobalGameRanks';
import {GameWinFeed} from './components/GameWinFeed';
import {UploadedSharedGame} from './games/UploadedSharedGame';
import {WalletRanks} from './components/WalletRanks';
import {DiamondWallet} from './components/DiamondWallet';
import {SharedRoundGame} from './games/SharedRoundGame';
import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from './firebase';
import {SellerWallet,SupportChat,Notices,useAccess} from './components/AdminExtensions';
import {AssetShop,EntryMedia,useMediaAssets} from './components/MediaAssets';
import { UserDirectory } from './components/UserDirectory';
import {ReferenceLobby,LobbyScreen} from './design/ReferenceLobby';
import {RoomEntryCard} from './design/RoomEntryCard';
import {roomThemes} from './design/catalog';
import { collection, query, where, getDocs, runTransaction, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { VoiceRoomView } from './components/VoiceRoomView';
import { AdminPanel } from './components/AdminPanel';
import { 
  Maximize2, 
  ChevronDown, 
  ShieldCheck, 
  FileText, 
  HelpCircle, 
  PhoneCall, 
  Info, 
  Scale, 
  Lock, 
  Award,
  Sparkles
} from 'lucide-react';

// All 18 Frames from user's file
const FRM: [string, number, string, string, number, string?][] = [
  ['ডিফল্ট', 0, 'linear-gradient(135deg,#19e6c1,#8a5cff)', '', 0],
  ['নীল রিং', 2000, 'linear-gradient(135deg,#4aa8ff,#7affea,#4aa8ff)', '', 1],
  ['বেগুনি রিং', 3000, 'linear-gradient(135deg,#c66cff,#ff7ad9,#c66cff)', '', 1],
  ['সোনালি রিং', 5000, 'linear-gradient(135deg,#ffe38a,#d8920a,#ffe38a)', '👑', 1],
  ['রেইনবো (বিশেষ)', -1, 'linear-gradient(90deg,#ff2a2a,#ffb02a,#ffe14a,#2aff7a,#2ab8ff,#8a2aff,#ff2a2a)', '🌈', 1],
  ['ফায়ার (বিশেষ)', -1, 'linear-gradient(135deg,#ff2a2a,#ff9a00,#ffe14a,#ff2a2a)', '🔥', 1],
  ['আইস ক্রিস্টাল', 8000, 'linear-gradient(135deg,#bff3ff,#4aa8ff,#e8fbff,#bff3ff)', '❄️', 1],
  ['চেরি ব্লসম', 8000, 'linear-gradient(135deg,#ffb7d5,#ff5c9d,#ffe0ee,#ffb7d5)', '🌸', 1],
  ['নিয়ন গ্রিন', 10000, 'linear-gradient(135deg,#19ff8a,#00e5ff,#19ff8a)', '⚡', 1, 'pu'],
  ['ডায়মন্ড', 20000, 'linear-gradient(135deg,#ffffff,#7ae8ff,#d8b7ff,#ffffff)', '💎', 1, 'pu'],
  ['রাজকীয়', 30000, 'linear-gradient(135deg,#7a2aff,#ffd23f,#7a2aff)', '👑', 1, 'pu'],
  ['প্রজাপতি', 15000, 'linear-gradient(135deg,#19e6c1,#ff5c9d,#8a5cff,#19e6c1)', '🦋', 1],
  ['গ্যালাক্সি', 25000, 'linear-gradient(135deg,#1a0a5a,#5a2aff,#19e6c1,#1a0a5a)', '🌌', 1, 'pu'],
  ['লাভা (বিশেষ)', -1, 'linear-gradient(135deg,#2a0a0a,#ff2a00,#ffb000,#2a0a0a)', '🌋', 1, 'pu'],
  ['ড্রাগন গোল্ড (বিশেষ)', -1, 'linear-gradient(135deg,#ffd23f,#ff2a2a,#ffd23f)', '🐉', 1, 'pu'],
  ['সানরাইজ', 12000, 'linear-gradient(135deg,#ff9a2a,#ffe14a,#ff5c7a,#ff9a2a)', '🌅', 1],
  ['মিন্ট', 6000, 'linear-gradient(135deg,#7affc8,#19c6a1,#c8ffe8,#7affc8)', '🍃', 1],
  ['ব্ল্যাক গোল্ড', 40000, 'linear-gradient(135deg,#111,#ffd23f,#111)', '🖤', 1, 'pu'],
];

// All 15 Entries from user's file
const ENT: [string, string, number, string, string, number][] = [
  ['🚗', 'গাড়ি এন্ট্রি', 20000, 'slide', '💨', 0],
  ['✨', 'স্টার এন্ট্রি', 10000, 'burst', '⭐', 0],
  ['🐉', 'ড্রাগন এন্ট্রি', 50000, 'fly', '🔥', 0],
  ['🏰', 'কেল্লা এন্ট্রি', 100000, 'rise', '🎆', 0],
  ['🦄', 'ইউনিকর্ন (বিশেষ)', -1, 'slide', '🌈', 0],
  ['🚀', 'রকেট এন্ট্রি', 30000, 'launch', '🔥', 0],
  ['🛸', 'UFO এন্ট্রি', 25000, 'zig', '⭐', 0],
  ['👑', 'রাজা এন্ট্রি', 40000, 'drop', '🪙', 1],
  ['🦁', 'সিংহ এন্ট্রি', 15000, 'zoom', '🐾', 0],
  ['🏍️', 'বাইক এন্ট্রি', 12000, 'slide', '💨', 0],
  ['🌈', 'রেইনবো এন্ট্রি', 18000, 'fly', '✨', 0],
  ['❄️', 'আইস কিং', 22000, 'burst', '❄️', 1],
  ['💎', 'ডায়মন্ড শাওয়ার', 60000, 'drop', '💎', 1],
  ['🔥', 'ফায়ার (বিশেষ)', -1, 'burst', '🔥', 0],
  ['🎆', 'ফায়ারওয়ার্ক', 35000, 'zoom', '🎇', 0],
];

const SV: [string, number, string][] = [
  ['SVIP 1', 50000, '#8cf'],
  ['SVIP 2', 200000, '#ffd23f'],
  ['SVIP 3', 1000000, '#f9f'],
];

const PERK = [
  'ব্যাজ + চেক-ইনে +৫০% কয়েন',
  'ব্যাজ + চেক-ইনে +১০০% কয়েন',
  'ব্যাজ + চেক-ইনে +২০০% কয়েন',
];

const GR = [
  'linear-gradient(135deg,#ff5c9d,#8a5cff)',
  'linear-gradient(135deg,#19e6c1,#3a7cff)',
  'linear-gradient(135deg,#ffc94d,#ff5c5c)',
  'linear-gradient(135deg,#8a5cff,#19e6c1)',
];

const COUNTRIES = [
  ['🇧🇩', 'বাংলাদেশ'], ['🇮🇳', 'ভারত'], ['🇵🇰', 'পাকিস্তান'],
  ['🇳🇵', 'নেপাল'], ['🇱🇰', 'শ্রীলঙ্কা'], ['🇸🇦', 'সৌদি আরব'],
  ['🇦🇪', 'সংযুক্ত আরব আমিরাত'], ['🇶🇦', 'কাতার'], ['🇰🇼', 'কুয়েত'],
  ['🇴🇲', 'ওমান'], ['🇧🇭', 'বাহরাইন'], ['🇲🇾', 'মালয়েশিয়া'],
  ['🇸🇬', 'সিঙ্গাপুর'], ['🇮🇹', 'ইতালি'], ['🇬🇧', 'যুক্তরাজ্য'],
  ['🇺🇸', 'যুক্তরাষ্ট্র'], ['🇨🇦', 'কানাডা'], ['🇦🇺', 'অস্ট্রেলিয়া'],
  ['🇩🇪', 'জার্মানি'], ['🇫🇷', 'ফ্রান্স'], ['🇪🇸', 'স্পেন'],
  ['🇯🇵', 'জাপান'], ['🇰🇷', 'দক্ষিণ কোরিয়া'], ['🇵🇭', 'ফিলিপাইন'],
  ['🇹🇷', 'তুরস্ক'], ['🇪🇬', 'মিশর'], ['🌍', 'অন্যান্য'],
];

const CT = ['সব', 'চ্যাট', 'গেম', 'নতুন', 'ইভেন্ট', 'পার্টি'];
const FL = [
  ['🇧🇩', 'বাংলাদেশ'], ['🇸🇦', 'সৌদি'], ['🇮🇳', 'ভারত'],
  ['🇵🇰', 'পাকিস্তান'], ['🇺🇸', 'USA'], ['🇵🇭', 'ফিলিপাইন'],
];

// Entry Animation runner
function playEntryAnimation(i: number, userName: string) {
  if (i < 0 || !ENT[i]) return;
  const e = ENT[i];
  const x = document.createElement('div');
  x.textContent = e[0];
  x.style.cssText = 'position:fixed;left:50%;top:38%;margin:-70px 0 0 -70px;font-size:120px;z-index:90;pointer-events:none;filter:drop-shadow(0 10px 10px #0008)';
  document.body.appendChild(x);

  const K: any = {
    slide: [{ transform: 'translateX(-120vw) scale(.7)', opacity: 0 }, { transform: 'translateX(0) scale(1.1)', opacity: 1, offset: 0.45 }, { transform: 'translateX(0)', opacity: 1, offset: 0.75 }, { transform: 'translateX(120vw)', opacity: 0 }],
    rise: [{ transform: 'translateY(60vh) scale(.3)', opacity: 0 }, { transform: 'translateY(0) scale(1.2)', opacity: 1, offset: 0.4 }, { transform: 'scale(1)', opacity: 1, offset: 0.8 }, { transform: 'translateY(-30vh) scale(.6)', opacity: 0 }],
    drop: [{ transform: 'translateY(-80vh) scale(1.4)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translateY(-30px) scale(1.1)', opacity: 1, offset: 0.4 }, { transform: 'translateY(0)', opacity: 1, offset: 0.5 }, { transform: 'translateY(0)', opacity: 1, offset: 0.8 }, { transform: 'scale(.2)', opacity: 0 }],
    fly: [{ transform: 'translate(-110vw,40vh) rotate(-25deg) scale(.6)', opacity: 0 }, { transform: 'translate(-10vw,-8vh) rotate(0) scale(1.1)', opacity: 1, offset: 0.5 }, { transform: 'translate(110vw,-40vh) rotate(25deg) scale(.7)', opacity: 0 }],
    burst: [{ transform: 'scale(0) rotate(-180deg)', opacity: 0 }, { transform: 'scale(1.5) rotate(0)', opacity: 1, offset: 0.35 }, { transform: 'scale(1)', opacity: 1, offset: 0.75 }, { transform: 'scale(2.2)', opacity: 0 }],
    zoom: [{ transform: 'scale(5)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.3 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.45 }, { transform: 'scale(1)', opacity: 1, offset: 0.8 }, { transform: 'scale(.1)', opacity: 0 }],
    launch: [{ transform: 'translateY(70vh) scale(.6)', opacity: 0 }, { transform: 'translateY(10vh) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translateY(-80vh) scale(.8)', opacity: 0 }],
    zig: [{ transform: 'translate(-100vw,-20vh)', opacity: 0 }, { transform: 'translate(-30vw,10vh) rotate(-10deg)', opacity: 1, offset: 0.3 }, { transform: 'translate(30vw,-10vh) rotate(10deg)', opacity: 1, offset: 0.6 }, { transform: 'translate(110vw,-30vh)', opacity: 0 }],
  }[e[3]];

  if (K) {
    x.animate(K, { duration: 2800, easing: 'ease-in-out' }).onfinish = () => x.remove();
  } else {
    setTimeout(() => x.remove(), 2000);
  }

  if (e[4]) {
    const rain = e[5];
    for (let k = 0; k < (rain ? 22 : 16); k++) {
      const p = document.createElement('div');
      p.textContent = e[4];
      p.style.cssText = 'position:fixed;z-index:89;pointer-events:none;font-size:' + (18 + Math.random() * 16) + 'px;left:' + (rain ? Math.random() * 95 : 50) + '%;top:' + (rain ? '-30px' : '42%');
      document.body.appendChild(p);
      const a = Math.random() * 6.28;
      const d = 80 + Math.random() * 160;
      p.animate(
        rain
          ? [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(' + (window.innerHeight + 60) + 'px) rotate(360deg)', opacity: 0.8 }]
          : [{ transform: 'translate(0,0) scale(.3)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * d + 'px,' + Math.sin(a) * d + 'px) scale(1.2)', opacity: 0 }],
        { duration: 1800 + Math.random() * 900, delay: rain ? Math.random() * 900 : 400, fill: 'backwards' }
      ).onfinish = () => p.remove();
    }
  }
}

const DEFAULT_USER_LIST = [
  { id: '10291', name: 'রাফি', av: '🧑', coins: 175800, diamond: 520, svip: 4, role: 'user', badge: 'VIP Master', status: 'active' },
  { id: '10292', name: 'নুসরাত', av: '👩', coins: 152000, diamond: 340, svip: 3, role: 'user', badge: 'Top Singer', status: 'active' },
  { id: '10293', name: 'সাব্বির', av: '🧔', coins: 125900, diamond: 190, svip: 2, role: 'user', badge: 'Gamer Pro', status: 'active' },
  { id: '10294', name: 'মিম', av: '🧕', coins: 89400, diamond: 85, svip: 1, role: 'user', badge: 'Active Talker', status: 'active' },
  { id: '10295', name: 'তানভীর', av: '👨‍🦱', coins: 94000, diamond: 110, svip: 2, role: 'user', badge: 'Party Host', status: 'active' },
  { id: '10296', name: 'সাদিয়া', av: '👧', coins: 110500, diamond: 240, svip: 3, role: 'user', badge: 'Star Voice', status: 'active' }
];

const DEFAULT_CUSTOM_GIFTS = [
  { id: 'g1', name: 'হার্ট', icon: '❤️', price: 1, type: 'love' },
  { id: 'g2', name: 'গোলাপ', icon: '🌹', price: 10, type: 'romantic' },
  { id: 'g3', name: 'স্টার', icon: '⭐', price: 250, type: 'popular' },
  { id: 'g4', name: 'লাভ রিং', icon: '💍', price: 750, type: 'romantic' },
  { id: 'g5', name: 'ডায়মন্ড', icon: '💎', price: 1100, type: 'luxury' },
  { id: 'g6', name: 'VIP কার', icon: '🚗', price: 2000, type: 'luxury' },
  { id: 'g7', name: 'রকেট', icon: '🚀', price: 5000, type: 'epic' },
  { id: 'g8', name: 'ক্রাউন', icon: '👑', price: 15000, type: 'royal' },
];

export const ADMIN_EMAILS = [
  'yfastvpn@gmail.com',
];

export default function App() {
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFade, setSplashFade] = useState(false);

  // App User State (S)
  const [S, setS] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('sv3');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          role: 'user',
          userList: Array.isArray(parsed.userList) && parsed.userList.length > 0 ? parsed.userList : DEFAULT_USER_LIST,
          customGifts: Array.isArray(parsed.customGifts) && parsed.customGifts.length > 0 ? parsed.customGifts : DEFAULT_CUSTOM_GIFTS,
          rechargeRequests: Array.isArray(parsed.rechargeRequests) ? parsed.rechargeRequests : [],
        };
      }
    } catch (_) {}
    return {
      name: 'ইউজার',
      id: String(100000 + Math.floor(Math.random() * 899999)),
      av: '😎',
      img: '',
      coins: 50000,
      xp: 250,
      svip: 1,
      last: '',
      streak: 3,
      bn: { t: 'ভয়েস রুমে আড্ডা দিন, গিফট পাঠান, গেম খেলুন! 🎉', g: 0 },
      rew: [100, 200, 300, 500, 800, 1000, 2000],
      hist: ['+50,000 — ওয়েলকাম কয়েন'],
      cat: 'সব',
      country: '🇧🇩 বাংলাদেশ',
      age: 22,
      dob: '2004-01-01',
      reg: true,
      invPct: 5,
      ref: '',
      inv: { n: 3, earn: 2500, list: [{ n: 'রাফি', c: 20000, r: 1000 }, { n: 'নুসরাত', c: 30000, r: 1500 }] },
      siteUrl: '',
      spent: 8000,
      cnt: { msg: 12, gift: 4, game: 5 },
      tk: { d: '', msg: 2, gift: 1, game: 1, cl: [] },
      posts: [
        { u: 'রাফি', av: '🧑', t: 'আজ রাতে গানের রুমে আসুন! 🎶', l: 12, c: 3, d: '২ ঘণ্টা আগে', demo: 1 }
      ],
      ownT: [0, 1, 2, 3],
      bio: 'গান ও আড্ডা আমার পছন্দ 🎶',
      ownF: [0, 1, 3],
      fr: 3,
      ownE: [0],
      en: 0,
      follow: ['রাফি', 'নুসরাত'],
      gifts: { sent: 4000, recv: ['🌹', '❤️', '💎', '🚗'] },
      userList: DEFAULT_USER_LIST,
      customGifts: DEFAULT_CUSTOM_GIFTS,
      rechargeRequests: [
        {
          id: 'req_1',
          userId: '102938',
          userName: 'রাফি',
          userAv: '🧑',
          coins: 5500,
          price: 5,
          status: 'pending',
          createdAt: '১০ মিনিট আগে',
          date: 'আজ',
        }
      ],
      users: {},
      pk: [
        { u: 1, c: 1000 },
        { u: 5, c: 5500 },
        { u: 10, c: 12000 },
        { u: 20, c: 26000 },
        { u: 50, c: 70000 },
        { u: 100, c: 150000 },
      ],
      rooms: [
        { id: '30101', name: 'বাংলা আড্ডা রুম', host: 'রাফি', cv: '🎤', c: 'চ্যাট', th: 0, d: 1, n: 128, flag: '🇧🇩', tag: 'আড্ডা', ann: 'স্বাগতম! সবাই মিলে আড্ডা দিই 🎉' },
        { id: '30102', name: 'গান ও গজল', host: 'নুসরাত', cv: '🎶', c: 'পার্টি', th: 1, d: 1, n: 76, flag: '🇧🇩', tag: 'Enjoy Music', ann: 'আজকের গান: পুরোনো দিনের গান 🎶' },
        { id: '30103', name: 'গেম জোন', host: 'সাব্বির', cv: '🎮', c: 'গেম', th: 2, d: 1, n: 54, flag: '🇸🇦', tag: 'Games', ann: 'গেম খেলুন, কয়েন জিতুন!' },
        { id: '30104', name: 'নতুনদের আড্ডা', host: 'মিম', cv: '💬', c: 'নতুন', th: 3, d: 1, n: 31, flag: '🇮🇳', tag: 'Newcomers', ann: 'নতুনদের স্বাগতম!' },
        { id: '30105', name: 'ঈদের উৎসব', host: 'তানভীর', cv: '🌙', c: 'ইভেন্ট', th: 4, d: 1, n: 92, flag: '🇧🇩', tag: 'Event', ann: 'উৎসবের আমেজে আসুন 🌙' },
        { id: '30106', name: 'লাভ ফরএভার', host: 'সাদিয়া', cv: '💞', c: 'পার্টি', th: 5, d: 1, n: 106, flag: '🇵🇰', tag: 'Love', ann: 'ভালোবাসার গান ও গল্প 💞' },
      ],
    };
  });

  const [tab, setTab] = useState<'home' | 'explore' | 'wallet' | 'moments' | 'msg'>('home');
  const [giftRecipient,setGiftRecipient]=useState<string|undefined>(undefined);
  const [showUserDirectory, setShowUserDirectory] = useState(false);
  const [incomingGift, setIncomingGift] = useState<any>(null);
  const [activePage, setActivePage] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<any | null>(null);
  const [pendingRoom,setPendingRoom]=useState<any|null>(null);
  const [lobbyScreen,setLobbyScreen]=useState<LobbyScreen>('rooms');
  const lobbyNavigation=useRef(false);
  useEffect(()=>{if(lobbyNavigation.current){lobbyNavigation.current=false;return;}setLobbyScreen(tab==='wallet'?'wallet':tab==='msg'?'messages':tab==='explore'?'games':tab==='moments'?'moments':'rooms')},[tab]);
  const [isRoomMinimized, setIsRoomMinimized] = useState<boolean>(false);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [isGameMinimized, setIsGameMinimized] = useState<boolean>(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const [fbUser, setFbUser] = useState<any>(null);

  // Subpage states
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCountry, setEditCountry] = useState('');
  
  // Mandatory Login Gate: অ্যাপসে লগইন ছাড়া কোনোভাবেই প্রবেশ করা যাবে না
  const [isAuthenticated,setIsAuthenticated]=useState(false);
  const [authChecking,setAuthChecking]=useState(true),[authError,setAuthError]=useState(''),[authRetry,setAuthRetry]=useState(0);
  const [loginTab, setLoginTab] = useState<'google' | 'user'>('google');
  const [loginUserName, setLoginUserName] = useState<string>('');
  const [loginUserPhone, setLoginUserPhone] = useState<string>('');
  const [loginUserAvatar, setLoginUserAvatar] = useState<string>('😎');

  const [adminCoinAmt, setAdminCoinAmt] = useState('');
  const [adminBannerText, setAdminBannerText] = useState('');
  const [sendTargetId, setSendTargetId] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendNote, setSendNote] = useState('');
  const [refInput, setRefInput] = useState('');
  const [postText, setPostText] = useState('');

  // User Room Creation Modal State
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPhoto,setNewRoomPhoto]=useState('');
  const [roomCreating,setRoomCreating]=useState(false);
  const [roomLibrary,setRoomLibrary]=useState<any[]>([]);
  useEffect(()=>{if(!fbUser?.uid){setRoomLibrary([]);return;}return onSnapshot(collection(db,'users',fbUser.uid,'roomLibrary'),snap=>setRoomLibrary(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a:any,b:any)=>(b.visitedAt?.toMillis?.()||0)-(a.visitedAt?.toMillis?.()||0))));},[fbUser?.uid]);
  useEffect(()=>{if(!activeRoom||!fbUser?.uid)return;void setDoc(doc(db,'users',fbUser.uid,'roomLibrary',String(activeRoom.id)),{visitedAt:serverTimestamp()},{merge:true}).catch(()=>toast('রুমের হিস্ট্রি সেভ হয়নি। নতুন Rules প্রকাশ করুন।'));},[activeRoom?.id,fbUser?.uid]);
  const [newRoomCategory, setNewRoomCategory] = useState('চ্যাট');
  const [newRoomTag, setNewRoomTag] = useState('আড্ডা');
  const [newRoomIcon, setNewRoomIcon] = useState('🎤');
  const [newRoomAnn, setNewRoomAnn] = useState('');
  const [newRoomSeatCount, setNewRoomSeatCount] = useState<number>(10);
  const [newRoomTheme,setNewRoomTheme]=useState(0);

  // User Recharge Permission Guard Modal State
  const [selectedRechargePackage, setSelectedRechargePackage] = useState<{ u: number; c: number } | null>(null);

  const lv = Math.floor(1 + Math.sqrt(S.xp / 50));
  const wl = Math.floor(1 + Math.sqrt((S.spent || 0) / 1000));

  // Only the verified Firebase owner account can access administration.
  const delegatedAccess=useAccess(fbUser);
  const mediaAssets=useMediaAssets();
  const customFrame=mediaAssets.find(a=>a.id===S.customFrameId&&a.kind==='frame');
  const customEntry=mediaAssets.find(a=>a.id===S.customEntryId&&a.kind==='entry');
  const isSuperAdmin = Boolean(
    fbUser?.emailVerified && fbUser?.email &&
    ADMIN_EMAILS.includes(fbUser.email.toLowerCase())
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashFade(true);
      setTimeout(() => setSplashVisible(false), 600);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleUrlRoute = () => {
      if (window.location.hash === '#admin' || window.location.search.includes('admin=true')) {
        setActivePage('admin');
      }
    };
    handleUrlRoute();
    window.addEventListener('hashchange', handleUrlRoute);
    return () => window.removeEventListener('hashchange', handleUrlRoute);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('sv3', JSON.stringify(S));
    } catch (_) {}
  }, [S]);

  const makePublicId = async () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const id = String(100000000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000000);
      const matches = await getDocs(query(collection(db, 'users'), where('id', '==', id)));
      if (matches.empty) return id;
    }
    throw new Error('Could not allocate user ID');
  };

  useEffect(()=>{
    let current=true,version=0;
    setAuthChecking(true);setAuthError('');
    const startup=setTimeout(()=>{if(current){setAuthChecking(false);setAuthError('Login connection timed out. Check your internet connection and retry.')}},15000);
    const unsub=onAuthStateChanged(auth,async u=>{
      clearTimeout(startup);
      const attempt=++version;
      const valid=()=>current&&attempt===version&&auth.currentUser?.uid===u?.uid;
      setIsAuthenticated(false);setFbUser(null);setAuthChecking(true);setAuthError('');
      if(!u){localStorage.removeItem('sv_auth_session');setAuthChecking(false);setActiveRoom(null);setActiveGame(null);return;}
      try{
        await withTimeout((async()=>{
          const ref=doc(db,'users',u.uid),snapshot=await getDoc(ref);
          if(!valid())return;
          const data=snapshot.data()||{};
          if(['banned','archived'].includes(data.status)){await signOut(auth);throw Error('blocked-account')}
          const isOwner=Boolean(u.emailVerified&&u.email&&ADMIN_EMAILS.includes(u.email.toLowerCase()));
          const publicId=data.id?String(data.id):await makePublicId();
          if(!valid())return;
          const name=data.name||u.displayName||u.email?.split('@')[0]||'User';
          if(snapshot.exists())await updateDoc(ref,{...(data.id?{}:{id:publicId}),online:true,currentRoomId:null,roomSeat:null,lastSeen:serverTimestamp()});
          else await setDoc(ref,{id:publicId,userId:u.uid,name,email:u.email||'',avatar:'👤',photoURL:u.photoURL||'',coins:50000,role:isOwner?'admin':'user',status:'active',currentRoomId:null,roomSeat:null,online:true,lastSeen:serverTimestamp(),createdAt:serverTimestamp()});
          if(!valid())return;
          setS((prev:any)=>({...prev,id:publicId,uid:u.uid,name,img:data.photoURL||u.photoURL||'',role:isOwner?'admin':'user',coins:0}));
          setFbUser(u);setIsAuthenticated(true);
          localStorage.setItem('sv_auth_session',JSON.stringify({uid:u.uid,role:'user'}));
        })(),20000);
      }catch(e:any){if(current&&attempt===version){
        version++;setAuthChecking(false);
        setAuthError(e.message==='blocked-account'?'This account is blocked.':e.code==='account-timeout'?'Google/email sign-in is complete, but the account database did not respond. Check your connection and retry account setup.':`Account setup failed (${e.code||e.message||'connection-error'}). Check Firebase rules and retry.`);
      }}finally{if(current&&attempt===version)setAuthChecking(false)}
    },e=>{clearTimeout(startup);if(current){setAuthChecking(false);setAuthError(`Login connection failed (${e.message}). Please retry.`)}});
    return()=>{current=false;version++;clearTimeout(startup);unsub()};
  },[authRetry]);

  useEffect(() => {
    if (!fbUser?.uid) return;
    return onSnapshot(doc(db, 'users', fbUser.uid), {includeMetadataChanges:true}, snapshot => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if(['banned','archived'].includes(data.status)){setToastText('আপনার অ্যাকাউন্ট ব্লক করা হয়েছে।');void signOut(auth);localStorage.removeItem('sv_auth_session');setIsAuthenticated(false);setActiveRoom(null);setActiveGame(null);return;}
      if (data.id) setS((prev: any) => ({...prev, id: String(data.id), uid: fbUser.uid }));
      if (data.giftSentCount !== undefined) setS((prev:any)=>({...prev,giftSentCount:data.giftSentCount,giftSentCoins:data.giftSentCoins,gifts:{...prev.gifts,sent:data.giftSentCoins||0}}));
      if(data.photoURL!==undefined)setS((prev:any)=>({...prev,img:data.photoURL}));
      for(const field of ['name','svip','badge','customFrameId','customEntryId']) if(data[field]!==undefined)setS((prev:any)=>({...prev,[field]:data[field]}));
      const coins = confirmedCoins(data,snapshot.metadata);
      if (Number.isSafeInteger(coins) && coins >= 0) setS((prev: any) => ({ ...prev, coins }));
    }, () => setToastText('লাইভ ব্যালেন্স লোড হয়নি। সংযোগ পরীক্ষা করুন।'));
  }, [fbUser?.uid]);

  useEffect(()=>{if(!fbUser?.uid)return;const uid=fbUser.uid;const a=onSnapshot(query(collection(db,'follows'),where('followerId','==',uid)),s=>setS((p:any)=>({...p,follow:s.docs.map(d=>d.data().followingId)})),()=>{});const b=onSnapshot(query(collection(db,'follows'),where('followingId','==',uid)),s=>setS((p:any)=>({...p,followerCount:s.size})),()=>{});const c=onSnapshot(collection(db,'users',uid,'visitors'),s=>setS((p:any)=>({...p,visitorCount:s.size})),()=>{});return()=>{a();b();c()}},[fbUser?.uid]);

  useEffect(() => {
    if (!fbUser?.uid) return;
    const ref = doc(db, 'users', fbUser.uid);
    const room = activeRoom ? {id:activeRoom.id,name:activeRoom.name,host:activeRoom.host||'',hostId:activeRoom.hostId||'',cv:activeRoom.cv||'🎙️',c:activeRoom.c||'চ্যাট',th:activeRoom.th||0,sc:activeRoom.sc||8,d:activeRoom.d||false,ann:activeRoom.ann||''} : null;
    const beat = () => updateDoc(ref, {online:document.visibilityState==='visible',lastSeen:serverTimestamp(),currentRoomId:room?.id||null,activeRoom:room}).catch(()=>{});
    beat(); const timer = setInterval(beat,30000);
    document.addEventListener('visibilitychange',beat);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',beat)};
  }, [fbUser?.uid, activeRoom?.id]);

  useEffect(() => {
    if (!fbUser?.uid) return;
    let initial = true; const seen = new Set<string>();
    return onSnapshot(query(collection(db,'transactions'),where('receiverId','==',fbUser.uid)), snapshot=>{
      const gifts = snapshot.docs.filter(d=>!d.metadata.hasPendingWrites&&d.data().type==='gift_sent');
      const count = gifts.reduce((n,d)=>n+Number(d.data().quantity||0),0);
      const coins = gifts.reduce((n,d)=>n+Number(d.data().cost||0),0);
      setS((prev:any)=>({...prev,giftReceivedCount:count,giftReceivedCoins:coins,gifts:{...prev.gifts,recv:gifts.map(d=>`${d.data().emoji} ${d.data().quantity}টি — ${d.data().senderName}`).slice(-30)}}));
      // Received gift totals are maintained by the server transaction.
      if (!initial) for(const gift of gifts) if(!seen.has(gift.id)){setIncomingGift(gift.data());setTimeout(()=>setIncomingGift(null),4000)}
      gifts.forEach(d=>seen.add(d.id)); initial=false;
    },()=>setToastText('পাওয়া গিফট লোড হয়নি। সংযোগ ও অনুমতি পরীক্ষা করুন।'));
  }, [fbUser?.uid]);

  useEffect(() => {
    if (!fbUser?.uid) return;
    return onSnapshot(collection(db,'rooms'),snapshot=>{
      const remote = snapshot.docs.filter(d=>!d.data().archived).map(d=>({...d.data(),id:d.id,own:d.data().hostId===fbUser.uid}));
      setS((prev:any)=>({...prev,rooms:remote}));
    },()=>setToastText('রুম তালিকা লোড হয়নি। সংযোগ পরীক্ষা করুন।'));
  }, [fbUser?.uid]);

  useEffect(()=>onSnapshot(doc(db,'system','config'),snapshot=>{
    if(snapshot.exists())setS((prev:any)=>({...prev,...safeSiteSettings(snapshot.data())}));
  },()=>setToastText('সাইটের সেটিংস লোড হয়নি। সংযোগ পরীক্ষা করুন।')),[]);

  const toast = (text: string) => {
    setToastText(text);
    setTimeout(() => setToastText(null), 2400);
  };

  const coinsRef = useRef(S.coins);
  coinsRef.current = S.coins;
  const walletQueue = useRef<Promise<unknown>>(Promise.resolve());
  const updateCoins = (amount: number, reason: string): Promise<boolean> => {
    const uid = fbUser?.uid;
    const task = walletQueue.current.then(async () => {
      if (!uid) throw new Error('Google login required');
      if (!Number.isSafeInteger(amount)) throw new Error('Invalid coin amount');
      let balance = coinsRef.current + amount;
      if (uid) {
        balance = await runTransaction(db, async transaction => {
          const ref = doc(db, 'users', uid);
          const snapshot = await transaction.get(ref);
          if (!snapshot.exists()) throw new Error('User profile missing');
          const next = Number(snapshot.data().coins || 0) + amount;
          if (!Number.isSafeInteger(next) || next < 0) throw new Error('Insufficient coins');
          transaction.update(ref, { coins: next });
          return next;
        });
      }
      if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('Insufficient coins');
      coinsRef.current = balance;
      setS((prev: any) => ({ ...prev, coins: balance,
        hist: [`${amount > 0 ? '+' : ''}${amount.toLocaleString()} — ${reason}`, ...prev.hist.slice(0, 30)] }));
      return true;
    }).catch(() => { toast('কয়েন সেভ হয়নি। সংযোগ ও Firebase অনুমতি পরীক্ষা করুন।'); return false; });
    walletQueue.current = task;
    return task;
  };

  // Logout Handler - অ্যাপ থেকে বের হলে পুনরায় লগইন না করে ঢোকা যাবে না
  const handleLogout = () => {
    try {
      signOut(auth).catch(() => {});
    } catch (_) {}
    localStorage.removeItem('sv_auth_session');
    setFbUser(null);
    setS((prev: any) => ({ ...prev, role: 'user' }));
    setIsAuthenticated(false);
    setActivePage(null);
    setActiveRoom(null);
    setActiveGame(null);
    toast('🚪 সফলভাবে লগআউট হয়েছে। অ্যাপে প্রবেশের জন্য লগইন আবশ্যক।');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast('কপি হয়েছে ✓');
  };

  const handleCheckin = () => {
    const today = new Date().toDateString();
    if (S.last === today) return toast('আজকেরটা নেওয়া হয়ে গেছে');
    const reward = Math.round((S.rew[Math.min(6, S.streak - 1)] || 100) * [1, 1.5, 2, 3][S.svip]);
    updateCoins(reward, 'দৈনিক চেক-ইন');
    setS((prev: any) => ({
      ...prev,
      last: today,
      streak: Math.min(7, prev.streak + 1),
    }));
    toast(`🎉 +${reward} কয়েন পেয়েছেন!`);
  };

  const handleSendCoins = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(sendAmount);
    if (!sendTargetId.trim()) return toast('গ্রাহকের আইডি দিন');
    if (isNaN(amt) || amt <= 0) return toast('সঠিক সংখ্যা দিন');
    if (S.coins < amt) return toast('কয়েন যথেষ্ট নয়');

    updateCoins(-amt, `কয়েন পাঠানো হয়েছে (ID ${sendTargetId}) - ${sendNote || 'ট্রান্সফার'}`);
    setSendTargetId('');
    setSendAmount('');
    setSendNote('');
    toast(`✓ ${amt.toLocaleString()} কয়েন পাঠানো হয়েছে!`);
  };

  const handleEditProfileSave = async () => {
    if(!fbUser){toast('Google লগইন করুন।');return;}
    try{await updateDoc(doc(db,'users',fbUser.uid),{name:editName.trim()||S.name,bio:editBio.trim(),country:editCountry||S.country});}catch{toast('প্রোফাইল সেভ হয়নি। সংযোগ পরীক্ষা করুন।');return;}
    setS((prev: any) => ({
      ...prev,
      name: editName.trim() || prev.name,
      bio: editBio.trim(),
      country: editCountry || prev.country,
    }));
    toast('সেভ হয়েছে ✓');
    setActivePage(null);
  };

  const inviteLink = () => `https://shakilm.app/?ref=SM${S.id}`;
  const invText = () => `🎙️ Shakil M Voice Rooms-এ আমার সাথে যোগ দিন! সাইন-আপের সময় আমার ইনভাইট কোড দিন: SM${S.id}\n${inviteLink()}`;

  async function enterRoom(candidate:any){if(!fbUser?.uid)return;try{const snap=await getDoc(doc(db,'rooms',String(candidate.id)));if(!snap.exists()){toast('Room not found.');return;}const room:any={...snap.data(),id:snap.id};if(room.locked===true&&room.hostId!==fbUser.uid){const role=await getDoc(doc(db,'rooms',room.id,'roles',fbUser.uid));if(role.data()?.role!=='admin'){toast('This room is locked.');return;}}await updateDoc(doc(db,'users',fbUser.uid),{currentRoomId:room.id,roomSeat:null,online:true,lastSeen:serverTimestamp()});setActiveRoom(room);setIsRoomMinimized(false);setPendingRoom(null)}catch(e:any){toast(e.code==='permission-denied'?'This room is locked or you do not have permission to enter.':'Room connection failed. Please try again.')}}
  if(!isAuthenticated||!fbUser)return <AuthScreen checking={authChecking} error={authError} onRetry={()=>setAuthRetry(n=>n+1)}/>;

  return (
    <div id="app">
      {fbUser&&(!activeRoom||isRoomMinimized)&&!activeGame&&lobbyScreen!=='rooms'&&<div style={{position:'fixed',top:72,left:8,right:8,zIndex:45,pointerEvents:'none'}}><GameWinFeed/></div>}
      {activePage==='game_rank'&&<GlobalGameRanks onClose={()=>setActivePage(null)}/>}
      {activePage==='seller'&&<SellerWallet user={fbUser} onClose={()=>setActivePage(null)}/>}
      {activePage==='support_chat'&&<SupportChat user={fbUser} onClose={()=>setActivePage(null)}/>}
      {activePage==='notices'&&<Notices onClose={()=>setActivePage(null)}/>}
      {activeRoom&&(customEntry?<EntryMedia key={activeRoom.id+customEntry.id} image={customEntry.image} name={S.name}/>:<RoomWelcome key={activeRoom.id} name={S.name} avatar={S.img||S.av} roomName={activeRoom.name}/>)}
      {showUserDirectory && <UserDirectory initialRecipient={giftRecipient} onGiftSent={event=>{setShowUserDirectory(false);toast(`✅ ID ${event.receiverPublicId}-তে ${event.quantity}টি ${event.giftName} পাঠানো হয়েছে। বাকি ${event.balance} কয়েন।`)}} roomId={activeRoom?.id} onClose={()=>setShowUserDirectory(false)} onJoin={room=>{void enterRoom(room);setShowUserDirectory(false)}} />}
      {incomingGift && (!activeRoom||isRoomMinimized||incomingGift.roomId!==activeRoom.id) && <div role="status" className="fixed top-20 left-1/2 -translate-x-1/2 z-[95] gl p-5 text-center"><div className="text-5xl relative h-24 flex justify-center items-center"><span>{S.av}</span><span className="gift-arrival absolute">{incomingGift.giftImage?<img src={incomingGift.giftImage} alt={incomingGift.giftName} className="w-24 h-24 object-contain"/>:incomingGift.emoji}</span></div><b>{incomingGift.senderName} থেকে {incomingGift.quantity}টি {incomingGift.giftName} পেয়েছেন 🎁</b><p>ID {S.id} · 💎 {incomingGift.cost} ডায়মন্ড যোগ হয়েছে</p></div>}

      {isAuthenticated&&!activePage&&(!activeRoom||isRoomMinimized)&&(!activeGame||isGameMinimized)&&!showCreateRoomModal&&!splashVisible&&<ReferenceLobby state={S} screen={lobbyScreen} roomLibrary={roomLibrary} myRoom={S.rooms.find((r:any)=>r.hostId===fbUser?.uid)} media={mediaAssets} admin={isSuperAdmin} seller={Boolean(delegatedAccess?.active&&delegatedAccess.permissions?.seller)} onScreen={screen=>{const next=screen==='wallet'?'wallet':screen==='messages'?'msg':screen==='games'?'explore':screen==='moments'?'moments':'home';if(tab!==next)lobbyNavigation.current=true;setTab(next);setLobbyScreen(screen)}} onAction={(action,value)=>{
        if(action==='users'){setGiftRecipient(undefined);setShowUserDirectory(true)}
        if(action==='logout')handleLogout();
        if(action==='page'&&value){if(value==='admin'&&!isSuperAdmin)return;setActivePage(value)}
        if(action==='create-room'){const own=S.rooms.find((r:any)=>r.hostId===fbUser?.uid);if(own)void enterRoom(own);else setShowCreateRoomModal(true)}
        if(action==='room'){const room=S.rooms.find((r:any)=>String(r.id)===value);if(room)void enterRoom(room)}
        if(action==='game'&&['greedy_lion','lion_wheel','night_wheel','jackpot_fruit','slots'].includes(value||'')){setActiveGame(value!);setIsGameMinimized(false)}
        if(action==='recharge'){const pkg=S.pk[Number(value)];if(pkg)setSelectedRechargePackage(pkg)}
      }}/>} 
      {pendingRoom&&<RoomEntryCard room={pendingRoom} onClose={()=>setPendingRoom(null)} onEnter={seat=>{setActiveRoom({...pendingRoom,entrySeat:seat});setIsRoomMinimized(false);setPendingRoom(null)}}/>}

      {/* 1. Splash Screen */}
      {splashVisible && (
        <div id="splash" style={{ opacity: splashFade ? 0 : 1 }}>
          <div className="wv">
            <i></i><i></i><i></i><i></i><i></i>
          </div>
          <div className="t3">
            Shakil M<br />Voice Rooms
          </div>
          <div className="lb">
            <i style={{ width: '100%' }}></i>
          </div>
          <small className="sm">লোড হচ্ছে...</small>
        </div>
      )}

      <>
          {/* 2. Top Header (hd) */}
          <div id="hd">
            <div
              className={`av ${FRM[S.fr]?.[4] ? 'fa' : ''} ${FRM[S.fr]?.[5] || ''}`}
              data-d={FRM[S.fr]?.[3]}
              style={{ background: FRM[S.fr]?.[2], cursor: 'pointer' }}
              onClick={() => setActivePage('profile_hub')}
            >
              <div>{S.img ? <img src={S.img} alt="Avatar" /> : S.av}</div>
            </div>

            <div className="sp">
              <div className="sm">স্বাগতম</div>
              <b id="gn">
                {S.name} {S.svip ? '👑' : ''}
              </b>
            </div>

            {/* Admin Super Button - Only visible to Admin (yfastvpn@gmail.com / Admin role) */}
            {isSuperAdmin && (
              <button
                className="ib"
                style={{
                  height: '34px',
                  padding: '0 9px',
                  fontSize: '11px',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 70, 239, 0.25))',
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#fbbf24',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setActivePage('admin');
                }}
                title="সুপার অ্যাডমিন প্যানেল"
              >
                👑 <span>অ্যাডমিন</span>
              </button>
            )}

            {/* Coin Balance Badge */}
            <div className="coin" onClick={() => setTab('wallet')}>
              🪙 {S.coins.toLocaleString()}
            </div>

            {/* Quick Logout Button */}
            <button
              className="ib"
              style={{
                height: '34px',
                width: '34px',
                padding: 0,
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#f87171',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              onClick={handleLogout}
              title="অ্যাপ থেকে লগআউট"
            >
              🚪
            </button>
          </div>

      {/* 3. Main Scrollable Container */}
      <div id="main">
        {/* TAB 1: HOME (রুম) */}
        {tab === 'home' && (
          <>
            {/* Top Hot Banner */}
            <div className="bnr">
              <div
                className="bn"
                style={{ background: 'linear-gradient(135deg,#ff5c9d,#8a5cff)' }}
                onClick={() => setTab('wallet')}
              >
                💰 Recharge Benefit
              </div>
              <div
                className="bn"
                style={{ background: 'linear-gradient(135deg,#ffb02a,#e0402a)' }}
                onClick={() => setActiveGame('greedy_lion')}
              >
                🦁 Happy Food Wheel
              </div>
              <div
                className="bn"
                style={{ background: 'linear-gradient(135deg,#19e6c1,#3a7cff)' }}
                onClick={() => setTab('explore')}
              >
                🎉 Room Festival
              </div>
              <div
                className="bn"
                style={{ background: 'linear-gradient(135deg,#ffc94d,#ff5c5c)' }}
                onClick={() => setActivePage('invite')}
              >
                🎁 Invite & Earn {S.invPct}%
              </div>
            </div>

            <div className="sm" style={{ margin: '-2px 0 8px' }}>
              📢 {S.bn.t}
            </div>

            {/* Quick Game Tiles */}
            <div className="tiles">
              <div
                className="tl"
                style={{ background: 'linear-gradient(#ffb3d9,#ff5c9d)' }}
                onClick={() => setActiveGame('jackpot_fruit')}
              >
                <b>🍒</b>জ্যাকপট ফ্রুট
              </div>
              <div
                className="tl"
                style={{ background: 'linear-gradient(#ffd08a,#ff8a2a)' }}
                onClick={() => setActiveGame('slots')}
              >
                <b>🎰</b>স্লটস
              </div>
              <div
                className="tl"
                style={{ background: 'linear-gradient(#9ad0ff,#4a7aff)' }}
                onClick={() => setActiveGame('greedy_lion')}
              >
                <b>🦁</b>ফুড হুইল
              </div>
            </div>

            {/* Categories */}
            <div className="cc" style={{ marginTop: '12px' }}>
              {CT.map(c => (
                <span
                  key={c}
                  className={S.cat === c ? 'on' : ''}
                  onClick={() => setS((prev: any) => ({ ...prev, cat: c }))}
                >
                  {c}
                </span>
              ))}
            </div>

            {/* User Room Creation Action */}
            <div 
              style={{ 
                margin: '12px 0 6px',
                padding: '12px 14px',
                background: 'linear-gradient(135deg, rgba(25, 230, 193, 0.18), rgba(138, 92, 255, 0.22))',
                border: '1.5px solid rgba(25, 230, 193, 0.45)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                cursor: 'pointer'
              }}
              onClick={() => {
                setNewRoomName(`${S.name}-এর আড্ডা`);
                setNewRoomAnn('স্বাগতম! সবাই মিলে আড্ডা দিই ও গান শুনি 🎶');
                setShowCreateRoomModal(true);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div 
                  style={{ 
                    width: '42px', 
                    height: '42px', 
                    borderRadius: '12px', 
                    background: 'linear-gradient(135deg, #19e6c1, #3a7cff)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '22px',
                    boxShadow: '0 4px 12px rgba(25, 230, 193, 0.35)'
                  }}
                >
                  🎙️
                </div>
                <div>
                  <b style={{ fontSize: '15px', color: '#fff', display: 'block' }}>নিজের ভয়েস রুম তৈরি করুন</b>
                  <div style={{ fontSize: '11px', color: '#cbd5e1' }}>৮ বা ১২ সিটের নিজস্ব রুম খুলে বন্ধুদের ডাকুন</div>
                </div>
              </div>
              <button 
                className="b"
                style={{
                  background: 'linear-gradient(135deg, #19e6c1, #06b6d4)',
                  color: '#022c22',
                  fontWeight: 800,
                  fontSize: '12px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  boxShadow: '0 3px 10px rgba(25, 230, 193, 0.4)'
                }}
              >
                + রুম বানান
              </button>
            </div>

            {/* Top Rooms Header */}
            <div className="tp" onClick={() => setActivePage('rankings')}>
              🏆 Top Rooms <span className="sp"></span>
              <span style={{ fontSize: '18px' }}>🥇🥈🥉</span> ›
            </div>

            {/* Rooms List */}
            <div className="rg">
              {S.rooms
                .filter((r: any) => S.cat === 'সব' || r.c === S.cat)
                .map((r: any) => (
                  <div
                    key={r.id}
                    className="rc"
                    style={{ background: GR[r.th % 4] }}
                    onClick={() => {
                      setActiveRoom(r);
                      setIsRoomMinimized(false);
                      playEntryAnimation(S.en, S.name);
                    }}
                  >
                    <span className="fl">{r.flag || '🇧🇩'}</span>
                    <span className="ls">▮ {r.n || 1}</span>
                    <div className="cvv">{r.cv}</div>
                    <span className="tg2">{r.tag || 'আড্ডা'}</span>
                    <b data-no-translate="true">{r.name}</b>
                    <div className="sm2">{r.ann || 'স্বাগতম!'}</div>
                  </div>
                ))}
            </div>
          </>
        )}

        {/* TAB 2: EXPLORE (এক্সপ্লোর) */}
        {tab === 'explore' && (
          <>
            <div className="row" style={{ padding: '14px 0 8px' }}>
              <b style={{ fontSize: '23px' }}>Explore</b>
              <span className="sp"></span>
              <button
                className="ib"
                style={{ padding: 0 }}
                onClick={() => setActivePage('profile_hub')}
              >
                <div
                  className={`av ${FRM[S.fr]?.[4] ? 'fa' : ''}`}
                  style={{ width: '38px', height: '38px', fontSize: '19px', background: FRM[S.fr]?.[2] }}
                >
                  <div>{S.img ? <img src={S.img} alt="Av" /> : S.av}</div>
                </div>
              </button>
            </div>

            <h3>🏅 Wall of Honor</h3>
            <div
              className="gl row"
              style={{ padding: '14px', background: 'linear-gradient(135deg,#ff5c9d88,#8a5cff88)', cursor: 'pointer' }}
              onClick={() => setActivePage('rankings')}
            >
              <span style={{ fontSize: '34px' }}>👑</span>
              <div className="sp">
                <b>মাসের সেরা র‍্যাঙ্কার</b>
                <div className="sm">র‍্যাঙ্কিং দেখতে চাপুন</div>
              </div>
              ›
            </div>

            <h3>🌍 Countries</h3>
            <div className="chips">
              {FL.map(f => (
                <span
                  key={f[0]}
                  className="chip"
                  onClick={() => toast(`${f[1]} ফিল্টার নির্বাচিত`)}
                >
                  {f[0]} {f[1]}
                </span>
              ))}
            </div>

            <h3>🎉 Events & Games</h3>
            <div className="rg">
              <div className="rc" style={{ background: GR[0] }} onClick={() => setActiveGame('lion_wheel')}>
                <span className="ls">Game</span>
                <div className="cvv">🦁</div>
                <b>সিংহ ফুড হুইল</b>
                <div className="sm2">আসল ফিজিক্স সিংহ ফুড হুইল</div>
              </div>
              <div className="rc" style={{ background: GR[1] }} onClick={() => setActiveGame('chess_3d')}>
                <span className="ls">Game</span>
                <div className="cvv">♟️</div>
                <b>দাবা ৩ডি</b>
                <div className="sm2">থ্রিডি বোর্ড গেম</div>
              </div>
              <div className="rc" style={{ background: GR[2] }} onClick={() => setActiveGame('night_wheel')}>
                <span className="ls">Game</span>
                <div className="cvv">🌙</div>
                <b>নাইট হুইল</b>
                <div className="sm2">রাতের চাকা</div>
              </div>
              <div className="rc" style={{ background: GR[3] }} onClick={() => setActiveGame('slots')}>
                <span className="ls">Game</span>
                <div className="cvv">🎰</div>
                <b>স্লটস</b>
                <div className="sm2">ক্লাসিক স্লট</div>
              </div>
            </div>
          </>
        )}

        {/* TAB 3: WALLET (ওয়ালেট - ব্যালেন্স, রিচার্জ, কয়েন পাঠান ও গ্রহণ) */}
        {tab === 'wallet' && (
          <>
            <DiamondWallet onBack={()=>setTab('home')}/>
            <WalletRanks/>
            <div className="row" style={{ padding: '14px 0 8px' }}>
              <b style={{ fontSize: '23px' }}>Wallet</b>
              <span className="sp"></span>
              <button className="b" onClick={() => setActivePage('hist')}>
                🧾 ইতিহাস
              </button>
            </div>

            <div
              className="gl"
              style={{
                padding: '22px',
                textAlign: 'center',
                background: 'linear-gradient(135deg,#ffb02a55,#ff5c9d55)',
              }}
            >
              <div className="sm">আপনার ব্যালেন্স</div>
              <div style={{ fontSize: '38px', fontWeight: 900, color: 'var(--g)' }}>
                🪙 {S.coins.toLocaleString()}
              </div>
              <div className="sm" style={{ marginTop: '4px' }}>
                আইডি: <b style={{ color: 'var(--t)' }}>SM{S.id}</b>
              </div>
            </div>

            {/* First Recharge Bonus Banner */}
            <div
              className="gl row"
              style={{
                padding: '14px',
                marginTop: '12px',
                background: 'linear-gradient(135deg,#ffd86a,#e0801a)',
                color: '#3a1c00',
                cursor: 'pointer',
              }}
              onClick={() => {
                if (S.pk && S.pk.length > 0) {
                  setSelectedRechargePackage(S.pk[0]);
                } else {
                  toast('🔒 সরাসরি কয়েন যোগ বন্ধ আছে। অ্যাডমিনের সাথে যোগাযোগ করুন।');
                }
              }}
            >
              <span style={{ fontSize: '32px' }}>🎁</span>
              <div className="sp">
                <b>First Recharge Bonus</b>
                <div style={{ fontSize: '12px' }}>প্রথম রিচার্জে বিশেষ উপহার ও +১০% কয়েন (অ্যাডমিন অনুমোদিত)</div>
              </div>
              ›
            </div>

            {/* Send Coins Form */}
            <h3>📤 কয়েন পাঠান (Transfer Coins)</h3>
            <form onSubmit={handleSendCoins} className="gl" style={{ padding: '14px' }}>
              <input
                className="in"
                placeholder="প্রাপকের আইডি (যেমন 102938)"
                value={sendTargetId}
                onChange={e => setSendTargetId(e.target.value)}
                style={{ width: '100%', marginBottom: '8px' }}
                required
              />
              <input
                className="in"
                type="number"
                placeholder="কয়েন সংখ্যা"
                value={sendAmount}
                onChange={e => setSendAmount(e.target.value)}
                style={{ width: '100%', marginBottom: '8px' }}
                required
              />
              <input
                className="in"
                placeholder="নোট বা বার্তা (ঐচ্ছিক)"
                value={sendNote}
                onChange={e => setSendNote(e.target.value)}
                style={{ width: '100%', marginBottom: '10px' }}
              />
              <button className="b g" style={{ width: '100%' }} type="submit">
                কয়েন পাঠান
              </button>
            </form>

            {/* Receive Coins */}
            <h3>📥 কয়েন গ্রহণ (Receive Coins)</h3>
            <div className="gl" style={{ padding: '14px', textAlign: 'center' }}>
              <div className="sm">আপনার Shakil M রিসিভ কোড:</div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: 'var(--g)', margin: '8px 0' }}>
                SM{S.id}
              </div>
              <button className="b t" onClick={() => handleCopy(`SM${S.id}`)}>
                📋 আইডি কপি করুন
              </button>
            </div>

            {/* Recharge Packages - Self addition disabled! Permission off */}
            <div className="row" style={{ marginTop: '16px', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>কয়েন প্যাকেজ</h3>
              <span className="sp"></span>
              <span style={{ 
                fontSize: '11px', 
                padding: '3px 8px', 
                borderRadius: '8px', 
                background: 'rgba(239, 68, 68, 0.15)', 
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontWeight: 700
              }}>
                🔒 নিজে কয়েন নেওয়া বন্ধ
              </span>
            </div>

            {/* Security Alert Banner */}
            <div
              style={{
                marginTop: '8px',
                marginBottom: '12px',
                padding: '12px 14px',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(185, 28, 28, 0.08))',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '26px' }}>🛡️</span>
              <div style={{ flex: 1, fontSize: '12px', lineHeight: '1.45', color: '#fca5a5' }}>
                <b style={{ color: '#fff', fontSize: '13px' }}>নিরাপত্তা নির্দেশিকা (Permission Off):</b>
                <div>সাধারণ ইউজারদের নিজে থেকে কয়েন যোগ করার অনুমতি বন্ধ রয়েছে। প্যাকেজ সিলেক্ট করে অ্যাডমিনকে রিচার্জ রিকোয়েস্ট পাঠান। অ্যাডমিন অনুমোদন করলে কয়েন যোগ হবে।</div>
              </div>
            </div>

            <div className="rg">
              {S.pk.map((p: any, i: number) => (
                <div
                  key={i}
                  className="gl"
                  style={{
                    padding: '14px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    border: '1px solid rgba(255, 176, 42, 0.25)',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => {
                    setSelectedRechargePackage(p);
                  }}
                >
                  <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '12px' }} title="অনুমোদন আবশ্যক">
                    🔒
                  </div>
                  <div style={{ fontSize: '28px' }}>🪙</div>
                  <b style={{ fontSize: '18px', color: 'var(--g)' }}>{p.c.toLocaleString()}</b>
                  <div 
                    className="b g" 
                    style={{ 
                      marginTop: '8px', 
                      padding: '7px 8px', 
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>${p.u}</span>
                    <span style={{ opacity: 0.8, fontSize: '10px' }}>· অনুরোধ</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* TAB 4: MOMENTS (মোমেন্টস) */}
        {tab === 'moments' && (
          <>
            <div className="row" style={{ padding: '14px 0 8px' }}>
              <b style={{ fontSize: '23px' }}>Moments</b>
            </div>
            <div className="gl" style={{ padding: '12px' }}>
              <textarea
                className="in"
                rows={2}
                placeholder="আপনার মনে কী চলছে?"
                value={postText}
                onChange={e => setPostText(e.target.value)}
                style={{ width: '100%', borderRadius: '16px' }}
              />
              <div className="row" style={{ marginTop: '8px' }}>
                <span className="sp"></span>
                <button
                  className="b t"
                  onClick={() => {
                    if (!postText.trim()) return toast('কিছু লিখুন');
                    setS((prev: any) => ({
                      ...prev,
                      posts: [{ u: prev.name, av: prev.av, t: postText.trim(), l: 0, c: 0, d: 'এইমাত্র' }, ...prev.posts],
                    }));
                    setPostText('');
                    toast('পোস্ট হয়েছে ✓');
                  }}
                >
                  পোস্ট
                </button>
              </div>
            </div>

            {S.posts.map((p: any, i: number) => (
              <div key={i} className="gl" style={{ padding: '14px', margin: '12px 0' }}>
                <div className="row">
                  <div className="a" style={{ width: '40px', height: '40px', fontSize: '20px' }}>
                    {p.av || S.av}
                  </div>
                  <div className="sp">
                    <b>{p.u}</b>
                    {p.demo ? <span className="tg">ডেমো</span> : ''}
                    <div className="sm">{p.d}</div>
                  </div>
                </div>
                <p style={{ margin: '10px 0' }}>{p.t}</p>
                <div className="row sm">
                  <span>❤️ {p.l}</span>
                  <span>💬 {p.c}</span>
                </div>
              </div>
            ))}
          </>
        )}

        {/* TAB 5: MSG (মেসেজ) */}
        {tab === 'msg' && (
          <>
            <div className="row" style={{ padding: '14px 0 8px' }}>
              <b style={{ fontSize: '23px' }}>Message</b>
            </div>
            <div className="gl rr" onClick={() => setActivePage('support_chat')}>
              <div className="c" style={{ background: GR[1] }}>
                🎧
              </div>
              <div className="sp">
                <b>কাস্টমার সার্ভিস</b>
                <div className="sm">আপনার সমস্যা জানান, ছবিও পাঠাতে পারবেন</div>
              </div>
            </div>
            <div className="gl rr">
              <div className="c" style={{ background: GR[2] }}>
                📢
              </div>
              <div className="sp">
                <b onClick={()=>setActivePage('notices')} style={{cursor:'pointer'}}>অফিশিয়াল নোটিশ — খুলুন ›</b>
                <div className="sm">{S.bn.t}</div>
              </div>
            </div>
            <h3>➕ ফলোইং</h3>
            {S.follow.map((f: string, i: number) => (
              <div key={i} className="gl rr" style={{ margin: '6px 0' }}>
                <div className="c" style={{ background: GR[0] }}>🙂</div>
                <div className="sp">
                  <b>{f}</b>
                  <div className="sm">বন্ধু</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 4. Bottom Nav Bar */}
      <div id="nav">
        {[
          ['home', '🏠', 'রুম'],
          ['explore', '🧭', 'এক্সপ্লোর'],
          ['wallet', '👛', 'ওয়ালেট'],
          ['moments', '📸', 'মোমেন্টস'],
          ['msg', '✉️', 'মেসেজ'],
        ].map(([t, e, n]) => (
          <button
            key={t}
            className={tab === t ? 'on' : ''}
            onClick={() => {
              setActivePage(null);
              setTab(t as any);
            }}
          >
            <b>{e}</b>
            {n}
          </button>
        ))}
      </div>

      {/* 5. Subpage Views (#pg) */}
      {activePage && (
        <div id="pg" className={activePage==='admin'?'on':'on reference-subpage'}>
          <div className="row" style={{ padding: '12px 14px' }}>
            <button className="ib" onClick={() => setActivePage(null)}>
              ‹
            </button>
            <b className="sp">
              {activePage === 'profile_hub' && '👤 আমার প্রোফাইল'}
              {activePage === 'edit_profile' && '✏️ এডিট প্রোফাইল'}
              {activePage === 'frames' && '🖼️ ফ্রেম'}
              {activePage === 'entries' && '🚪 এন্ট্রি'}
              {activePage === 'svip' && '👑 SVIP'}
              {activePage === 'tasks' && '✅ Tasks'}
              {activePage === 'badges' && '🏅 Badge'}
              {activePage === 'invite' && '🎁 Invite & Earn'}
              {activePage === 'store' && '🏪 Store'}
              {activePage === 'items' && '👕 My Items'}
              {activePage === 'level' && '⭐ Level'}
              {activePage === 'hist' && '🧾 লেনদেন'}
              {activePage === 'admin' && '⚙️ অ্যাডমিন প্যানেল'}
              {activePage === 'rankings' && '🏆 Rankings'}
              {activePage === 'policy_privacy' && '📜 গোপনীয়তা নীতি (Privacy Policy)'}
              {activePage === 'policy_terms' && '📋 ব্যবহারের শর্তাবলী (Terms of Service)'}
              {activePage === 'policy_community' && '🛡️ কমিউনিটি গাইডলাইন (Community Rules)'}
              {activePage === 'policy_user_agreement' && '🤝 ব্যবহারকারী চুক্তি (User Agreement)'}
              {activePage === 'policy_coins_refund' && '🪙 রিচার্জ ও রিফান্ড নীতি (Refund Policy)'}
              {activePage === 'policy_fairplay' && '⚖️ ফেয়ার প্লে ও নিরাপত্তা (Fair Play Policy)'}
              {activePage === 'policy_support' && '📞 কাস্টমার সাপোর্ট ও হেল্প (Customer Support)'}
              {activePage === 'policy_faq' && '❓ সাধারণ জিজ্ঞাসা ও গাইড (FAQ & Guide)'}
              {activePage === 'policy_about' && 'ℹ️ আমাদের সম্পর্কে (About Us)'}
            </b>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 24px' }}>
            {/* SUBPAGE: PROFILE HUB */}
            {activePage === 'profile_hub' && (
              <>
                <div className="row" style={{ marginTop: '-6px' }}>
                  <span className="sp"></span>
                  <button
                    className="b"
                    style={{ padding: '6px 14px' }}
                    onClick={() => {
                      setEditName(S.name);
                      setEditBio(S.bio || '');
                      setEditCountry(S.country);
                      setActivePage('edit_profile');
                    }}
                  >
                    ✏️ Edit
                  </button>
                </div>

                <div className="row" style={{ margin: '10px 0' }}>
                  <div
                    className={`av ${FRM[S.fr]?.[4] ? 'fa' : ''}`}
                    style={{ width: '80px', height: '80px', fontSize: '40px', background: FRM[S.fr]?.[2], cursor: 'pointer' }}
                    onClick={() => setActivePage('frames')}
                  >
                    <div>{S.img ? <img src={S.img} alt="Av" /> : S.av}</div>
                  </div>
                  <div className="sp">
                    <b style={{ fontSize: '20px' }} data-no-translate="true">{S.name}</b>
                    {S.svip ? <span className="bd" style={{ background: SV[S.svip - 1]?.[2] }}>{SV[S.svip - 1]?.[0]}</span> : ''}
                    <div className="sm" onClick={() => handleCopy(S.id)} style={{ cursor: 'pointer' }}>
                      ID {S.id} 📋
                    </div>
                    <div style={{ marginTop: '6px' }}>
                      <span className="tg" style={{ background: '#ff5c9d' }}>LV.{lv}</span>{' '}
                      <span className="tg" style={{ background: '#8a5cff' }}>Wealth {wl}</span>{' '}
                      <span className="tg" style={{ background: '#19a' }}>{S.country || '🌍'}</span>
                    </div>
                  </div>
                </div>

                {/* Google Auth Status */}
                <div className="gl" style={{ padding: '12px', margin: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <b>গুগল ব্যাকআপ:</b>
                    <div className="sm">{fbUser ? fbUser.email : 'সংযুক্ত নয়'}</div>
                  </div>
                  {fbUser ? (
                    <button className="b r" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => signOut(auth).then(() => toast('লগআউট'))}>
                      লগআউট
                    </button>
                  ) : (
                    <button className="b t" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={()=>void signInWithPopup(auth,googleProvider).catch(()=>toast('Sign-in failed.'))}>
                      Google লগইন
                    </button>
                  )}
                </div>

                <div className="row" style={{ textAlign: 'center', margin: '14px 0' }}>
                  <div className="sp"><b>0</b><div className="sm">Visitors</div></div>
                  <div className="sp"><b>{S.follow.length}</b><div className="sm">Following</div></div>
                  <div className="sp"><b>0</b><div className="sm">Followers</div></div>
                </div>

                <div className="row">
                  <div
                    className="sp mb"
                    style={{ background: 'linear-gradient(135deg,#ff9a4a,#ff5c3a)', textAlign: 'left', padding: '14px' }}
                    onClick={() => setActivePage('level')}
                  >
                    <b style={{ fontSize: '16px', margin: 0 }}>Wealth Level</b>
                    <small>Lv.{wl} ›</small>
                  </div>
                  <div
                    className="sp mb"
                    style={{ background: 'linear-gradient(135deg,#ff5c9d,#ffb02a)', textAlign: 'left', padding: '14px' }}
                    onClick={() => setActivePage('svip')}
                  >
                    <b style={{ fontSize: '16px', margin: 0 }}>VIP Club 👑</b>
                    <small>{S.svip ? SV[S.svip - 1]?.[0] : 'Unlock now'} ›</small>
                  </div>
                </div>

                <div className="gl cir" style={{ marginTop: '12px' }}>
                  <div onClick={() => setActivePage('tasks')} style={{ cursor: 'pointer' }}><i style={{ background: '#19c68a' }}>✅</i>Tasks</div>
                  <div onClick={() => setActivePage('store')} style={{ cursor: 'pointer' }}><i style={{ background: '#ff5c9d' }}>🏪</i>Store</div>
                  <div onClick={() => setActivePage('items')} style={{ cursor: 'pointer' }}><i style={{ background: '#4a7aff' }}>👕</i>My Items</div>
                  <div onClick={() => setActivePage('level')} style={{ cursor: 'pointer' }}><i style={{ background: '#ff8a4a' }}>⭐</i>Level</div>
                </div>

                <div
                  className="gl lr"
                  style={{ marginTop: '12px', background: 'linear-gradient(90deg,#ff5c9d88,#ffb02a88)', borderRadius: '18px' }}
                  onClick={() => setActivePage('svip')}
                >
                  <span style={{ fontSize: '28px' }}>💎</span>
                  <b className="sp">VIP</b>
                  <span className="b g" style={{ padding: '6px 14px' }}>Details</span>
                </div>

                {/* Menu List: Personalization & Badges */}
                <h3 style={{ marginTop: '14px', marginBottom: '6px' }}>👑 ভিআইপি ও পার্সোনালাইজেশন</h3>
                <div className="gl" style={{ padding: '0 4px' }}>
                  {[
                    ['👑', 'Premium (SVIP Club)', 'svip'],
                    ['🏅', 'Badge (মেডেল ও ব্যাজ)', 'badges'],
                    ['🎁', `Invite & Earn — রিচার্জে ${S.invPct}% রিওয়ার্ড`, 'invite'],
                    ['🖼️', 'ফ্রেম (Avatar Frames)', 'frames'],
                    ['🚪', 'এন্ট্রি অ্যানিমেশন (Room Entry)', 'entries'],
                    ['🧾', 'লেনদেন খতিয়ান (Transactions)', 'hist'],
                    ...(delegatedAccess?.active&&delegatedAccess.permissions?.seller?[['🪙','সেলার কয়েন ট্রান্সফার','seller']]:[]),
                  ].map(r => (
                    <div key={r[2]} className="lr" onClick={() => setActivePage(r[2])}>
                      <span style={{ fontSize: '22px' }}>{r[0]}</span>
                      <span className="sp">{r[1]}</span>
                      <span>›</span>
                    </div>
                  ))}
                </div>

                {/* Policies & Official Terms */}
                <h3 style={{ marginTop: '16px', marginBottom: '6px' }}>📜 নীতিমালা ও নিয়মাবলী (Policies & Legal)</h3>
                <div className="gl" style={{ padding: '0 4px' }}>
                  {[
                    ['📜', 'গোপনীয়তা নীতি (Privacy Policy)', 'policy_privacy'],
                    ['📋', 'ব্যবহারের শর্তাবলী (Terms of Service)', 'policy_terms'],
                    ['🛡️', 'কমিউনিটি গাইডলাইন (Community Rules)', 'policy_community'],
                    ['🤝', 'ব্যবহারকারী চুক্তি (User Agreement)', 'policy_user_agreement'],
                    ['🪙', 'রিচার্জ ও রিফান্ড নীতি (Coin & Refund Policy)', 'policy_coins_refund'],
                    ['⚖️', 'ফেয়ার প্লে ও অ্যান্টি-চিটিং নীতি (Fair Play)', 'policy_fairplay'],
                  ].map(r => (
                    <div key={r[2]} className="lr" onClick={() => setActivePage(r[2])}>
                      <span style={{ fontSize: '20px' }}>{r[0]}</span>
                      <span className="sp" style={{ fontSize: '13px' }}>{r[1]}</span>
                      <span>›</span>
                    </div>
                  ))}
                </div>

                {/* Support & System */}
                <h3 style={{ marginTop: '16px', marginBottom: '6px' }}>📞 সহায়তা ও প্ল্যাটফর্ম (Support & About)</h3>
                <div className="gl" style={{ padding: '0 4px', marginBottom: '16px' }}>
                  {[
                    ['📞', 'কাস্টমার সাপোর্ট ও হেল্পলাইন (Support)', 'policy_support'],
                    ['❓', 'সাধারণ জিজ্ঞাসা ও গাইড (FAQ)', 'policy_faq'],
                    ['ℹ️', 'আমাদের সম্পর্কে ও লাইসেন্স (About Us)', 'policy_about'],
                    ['⚙️', 'অ্যাডমিন প্যানেল (Shakil Admin)', 'admin'],
                    ['🚪', 'অ্যাপ থেকে লগআউট (Logout)', 'logout'],
                  ].filter(r => r[2] !== 'admin' || isSuperAdmin).map(r => (
                    <div
                      key={r[2]}
                      className="lr"
                      onClick={() => {
                        if (r[2] === 'logout') {
                          handleLogout();
                        } else {
                          setActivePage(r[2]);
                        }
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{r[0]}</span>
                      <span className="sp" style={{ fontSize: '13px' }}>{r[1]}</span>
                      <span>›</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* SUBPAGE: EDIT PROFILE */}
            {activePage === 'edit_profile' && (
              <>
                <ProfilePhotoEditor onSaved={image=>setS((prev:any)=>({...prev,img:image}))}/>
                <div style={{ textAlign: 'center', margin: '10px 0' }}>
                  <div
                    className={`av ${FRM[S.fr]?.[4] ? 'fa' : ''}`}
                    style={{ width: '96px', height: '96px', fontSize: '48px', margin: '0 auto', background: FRM[S.fr]?.[2] }}
                  >
                    <div>{S.img ? <img src={S.img} alt="Av" /> : S.av}</div>
                  </div>
                  <div className="sm" style={{ marginTop: '6px' }}>ইমোজি থেকে অবতার বেছে নিন:</div>
                </div>

                <div className="chips" style={{ justifyContent: 'center' }}>
                  {['😎', '🙂', '🥳', '🤩', '😇', '🦁', '🐯', '👑'].map(e => (
                    <span
                      key={e}
                      className={`chip ${S.av === e ? 'on' : ''}`}
                      style={{ fontSize: '20px' }}
                      onClick={() => setS((prev: any) => ({ ...prev, av: e, img: '' }))}
                    >
                      {e}
                    </span>
                  ))}
                </div>

                <h3>নাম</h3>
                <input
                  className="in"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ width: '100%' }}
                />

                <h3>দেশ</h3>
                <select
                  className="in"
                  value={editCountry}
                  onChange={e => setEditCountry(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {COUNTRIES.map(c => (
                    <option key={c[0]} value={`${c[0]} ${c[1]}`}>{c[0]} {c[1]}</option>
                  ))}
                </select>

                <h3>বায়ো</h3>
                <input
                  className="in"
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  placeholder="নিজের সম্পর্কে লিখুন"
                  style={{ width: '100%' }}
                />

                <button className="b t" style={{ width: '100%', marginTop: '16px' }} onClick={handleEditProfileSave}>
                  সেভ করুন
                </button>
              </>
            )}

            {/* SUBPAGE: FRAMES (All 18 frames) */}
            {activePage === 'frames' && (
              <>
                <AssetShop kind="frame" user={fbUser} items={mediaAssets}/>
                <p className="sm" style={{ margin: '8px 0' }}>
                  প্রোফাইল ছবির ফ্রেম। "বিশেষ" ফ্রেম শুধু অ্যাডমিন থেকে পাওয়া যায়।
                </p>
                <div className="st3">
                  {FRM.map((f, i) => {
                    const owned = S.ownF.includes(i);
                    const equipped = S.fr === i;
                    return (
                      <div key={i} className={`it ${equipped ? 'on' : ''}`}>
                        <div
                          className={`av ${f[4] ? 'fa' : ''} ${f[5] || ''}`}
                          data-d={f[3]}
                          style={{ width: '58px', height: '58px', fontSize: '29px', margin: '0 auto 6px', background: f[2] }}
                        >
                          <div>{S.img ? <img src={S.img} alt="Av" /> : S.av}</div>
                        </div>
                        {f[0]}
                        <button
                          className={`b ${owned ? (equipped ? 't' : '') : f[1] < 0 ? '' : 'g'}`}
                          onClick={() => {
                            if (!owned) {
                              if (f[1] < 0) return toast('এটি অ্যাডমিন থেকে পাওয়া যায়');
                              if (S.coins < f[1]) return toast('কয়েন যথেষ্ট নয়');
                              updateCoins(-f[1], `${f[0]} ফ্রেম ক্রয়`);
                              setS((prev: any) => ({ ...prev, ownF: [...prev.ownF, i], fr: i }));
                            } else {
                              setS((prev: any) => ({ ...prev, fr: i }));
                            }
                            toast(`${f[0]} ফ্রেম পরা হয়েছে`);
                          }}
                        >
                          {equipped ? 'পরা আছে' : owned ? 'পরুন' : f[1] < 0 ? '🔒 অ্যাডমিন' : `🪙 ${f[1].toLocaleString()}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* SUBPAGE: ENTRIES (All 15 entries with Live Preview) */}
            {activePage === 'entries' && (
              <>
                <AssetShop kind="entry" user={fbUser} items={mediaAssets}/>
                <p className="sm" style={{ margin: '8px 0' }}>
                  রুমে ঢোকার সময় আপনার বিশেষ এন্ট্রি অ্যানিমেশন চলবে। "বিশেষ" এন্ট্রি শুধু অ্যাডমিন থেকে পাওয়া যায়।
                </p>
                <div className="st3">
                  {ENT.map((e, i) => {
                    const owned = S.ownE.includes(i);
                    const equipped = S.en === i;
                    return (
                      <div key={i} className={`it ${equipped ? 'on' : ''}`}>
                        <div style={{ fontSize: '42px' }}>{e[0]}</div>
                        {e[1]}
                        <button
                          className={`b ${owned ? (equipped ? 't' : '') : e[2] < 0 ? '' : 'g'}`}
                          onClick={() => {
                            if (!owned) {
                              if (e[2] < 0) return toast('এটি অ্যাডমিন থেকে পাওয়া যায়');
                              if (S.coins < e[2]) return toast('কয়েন যথেষ্ট নয়');
                              updateCoins(-e[2], `${e[1]} এন্ট্রি ক্রয়`);
                              setS((prev: any) => ({ ...prev, ownE: [...prev.ownE, i], en: i }));
                            } else {
                              setS((prev: any) => ({ ...prev, en: i }));
                            }
                            toast(`${e[1]} এন্ট্রি চালু হয়েছে`);
                          }}
                        >
                          {equipped ? 'চালু আছে' : owned ? 'চালু করুন' : e[2] < 0 ? '🔒 অ্যাডমিন' : `🪙 ${e[2].toLocaleString()}`}
                        </button>
                        <button
                          className="b"
                          style={{ marginTop: '6px', background: '#ffffff22', boxShadow: 'none' }}
                          onClick={() => playEntryAnimation(i, S.name)}
                        >
                          প্রিভিউ
                        </button>
                      </div>
                    );
                  })}
                </div>
                {S.en >= 0 && (
                  <button
                    className="b r"
                    style={{ width: '100%', marginTop: '14px' }}
                    onClick={() => {
                      setS((prev: any) => ({ ...prev, en: -1 }));
                      toast('এন্ট্রি বন্ধ করা হয়েছে');
                    }}
                  >
                    এন্ট্রি বন্ধ করুন
                  </button>
                )}
              </>
            )}

            {/* SUBPAGE: SVIP */}
            {activePage === 'svip' && (
              <>
                <div className="gl" style={{ padding: '16px', marginTop: '6px', textAlign: 'center' }}>
                  {S.svip ? (
                    <span>আপনার বর্তমান লেভেল: <b style={{ color: SV[S.svip - 1]?.[2] }}>{SV[S.svip - 1]?.[0]}</b></span>
                  ) : (
                    <span>আপনি এখনও SVIP নন</span>
                  )}
                </div>
                {SV.map((v, i) => (
                  <div key={i} className="gl" style={{ padding: '14px', margin: '12px 0', borderColor: `${v[2]}88` }}>
                    <div className="row">
                      <b style={{ fontSize: '18px', color: v[2] }}>👑 {v[0]}</b>
                      <span className="sp"></span>
                      <b>🪙 {v[1].toLocaleString()}</b>
                    </div>
                    <div className="sm" style={{ margin: '8px 0', lineHeight: 1.6 }}>
                      • {PERK[i]}<br />• নামের পাশে {v[0]} ব্যাজ
                    </div>
                    <button
                      className={`b ${S.svip > i ? 't' : 'g'}`}
                      style={{ width: '100%' }}
                      onClick={() => {
                        if (S.svip > i) return toast('অলরেডি আনলক আছে');
                        if (S.coins < v[1]) return toast('কয়েন যথেষ্ট নয়');
                        updateCoins(-v[1], `${v[0]} ক্রয়`);
                        setS((prev: any) => ({ ...prev, svip: i + 1 }));
                        toast(`🎉 ${v[0]} চালু হয়েছে!`);
                      }}
                    >
                      {S.svip > i ? 'আছে ✓' : 'কিনুন'}
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* SUBPAGE: TASKS */}
            {activePage === 'tasks' && (
              <>
                <div className="chk">
                  <span style={{ fontSize: '28px' }}>📅</span>
                  <div className="sp">
                    <b>দৈনিক চেক-ইন (স্ট্রিক {S.streak}/7)</b>
                    <div className="sm">আজকের পুরস্কার 🪙 {S.rew[Math.min(6, S.streak - 1)]}</div>
                  </div>
                  <button className="b g" onClick={handleCheckin}>
                    চেক-ইন
                  </button>
                </div>
                <div className="chk">
                  <span style={{ fontSize: '28px' }}>💬</span>
                  <div className="sp">
                    <b>৫টি মেসেজ পাঠান</b>
                    <div className="pb"><i style={{ width: `${Math.min(100, (S.cnt?.msg || 0) / 5 * 100)}%` }}></i></div>
                    <div className="sm">{Math.min(S.cnt?.msg || 0, 5)}/5 · 🪙 100</div>
                  </div>
                  <button className="b g" onClick={() => { updateCoins(100, 'টাস্ক বোনাস'); toast('+100 কয়েন'); }}>
                    নিন
                  </button>
                </div>
                <div className="chk">
                  <span style={{ fontSize: '28px' }}>🎁</span>
                  <div className="sp">
                    <b>১টি গিফট পাঠান</b>
                    <div className="pb"><i style={{ width: `${Math.min(100, (S.cnt?.gift || 0) / 1 * 100)}%` }}></i></div>
                    <div className="sm">{Math.min(S.cnt?.gift || 0, 1)}/1 · 🪙 200</div>
                  </div>
                  <button className="b g" onClick={() => { updateCoins(200, 'টাস্ক বোনাস'); toast('+200 কয়েন'); }}>
                    নিন
                  </button>
                </div>
                <div className="chk">
                  <span style={{ fontSize: '28px' }}>🎮</span>
                  <div className="sp">
                    <b>১টি গেম খেলুন</b>
                    <div className="pb"><i style={{ width: `${Math.min(100, (S.cnt?.game || 0) / 1 * 100)}%` }}></i></div>
                    <div className="sm">{Math.min(S.cnt?.game || 0, 1)}/1 · 🪙 100</div>
                  </div>
                  <button className="b g" onClick={() => { updateCoins(100, 'টাস্ক বোনাস'); toast('+100 কয়েন'); }}>
                    নিন
                  </button>
                </div>
              </>
            )}

            {/* SUBPAGE: BADGES */}
            {activePage === 'badges' && (
              <div className="rg" style={{ marginTop: '8px' }}>
                {[
                  ['🎁', 'প্রথম গিফট', (S.cnt?.gift || 0) > 0],
                  ['💬', 'চ্যাটার (১০ মেসেজ)', (S.cnt?.msg || 0) >= 10],
                  ['🎮', 'গেমার', (S.cnt?.game || 0) > 0],
                  ['💰', 'ধনী (১০K খরচ)', (S.spent || 0) >= 10000],
                  ['👑', 'SVIP সদস্য', (S.svip || 0) > 0],
                  ['🖼️', 'ফ্রেম কালেক্টর', (S.ownF?.length || 0) >= 3],
                ].map((b, i) => (
                  <div key={i} className="gl" style={{ padding: '16px', textAlign: 'center', opacity: b[2] ? 1 : 0.4 }}>
                    <div style={{ fontSize: '42px' }}>{b[0]}</div>
                    <b style={{ fontSize: '13px' }}>{b[1]}</b>
                    <div className="sm">{b[2] ? 'পেয়েছেন ✓' : '🔒 লকড'}</div>
                  </div>
                ))}
              </div>
            )}

            {/* SUBPAGE: INVITE & EARN (WITH ALL POLICIES AND RULES) */}
            {activePage === 'invite' && (
              <>
                <div
                  className="gl"
                  style={{
                    padding: '20px',
                    marginTop: '8px',
                    textAlign: 'center',
                    background: 'linear-gradient(135deg,#ffb02a66,#ff5c9d66)',
                  }}
                >
                  <div style={{ fontSize: '46px' }}>🎁</div>
                  <div className="bigp">{S.invPct}%</div>
                  <b style={{ fontSize: '17px' }}>বন্ধুকে ইনভাইট করুন, তার রিচার্জের {S.invPct}% রিওয়ার্ড আপনার!</b>
                  <div className="sm" style={{ marginTop: '6px' }}>
                    বন্ধু যতবার রিচার্জ করবে, প্রতিবার {S.invPct}% কয়েন আপনি পাবেন
                  </div>
                </div>

                <h3>🔑 আপনার ইনভাইট কোড</h3>
                <div className="gl" style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '3px', color: 'var(--g)' }}>
                    SM{S.id}
                  </div>
                  <div className="row" style={{ marginTop: '12px' }}>
                    <button className="b t sp" onClick={() => handleCopy(`SM${S.id}`)}>
                      📋 কোড কপি
                    </button>
                    <button className="b sp" onClick={() => handleCopy(inviteLink())}>
                      🔗 লিংক কপি
                    </button>
                  </div>
                </div>

                <h3>📤 শেয়ার করুন</h3>
                <div className="gl" style={{ padding: '14px' }}>
                  <div className="shg">
                    {[
                      ['WhatsApp', '💬', '#25d366', `https://wa.me/?text=${encodeURIComponent(invText())}`],
                      ['Facebook', '📘', '#1877f2', `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink())}`],
                      ['Telegram', '✈️', '#2aa3e0', `https://t.me/share/url?url=${encodeURIComponent(inviteLink())}&text=${encodeURIComponent(invText())}`],
                      ['SMS', '📩', '#19b88a', `sms:?&body=${encodeURIComponent(invText())}`],
                    ].map(s => (
                      <a key={s[0]} href={s[3]} target="_blank" rel="noopener noreferrer">
                        <i style={{ background: s[2] }}>{s[1]}</i>
                        {s[0]}
                      </a>
                    ))}
                  </div>
                </div>

                <h3>📖 কীভাবে কাজ করে</h3>
                <div className="gl" style={{ padding: '14px', lineHeight: 1.9, fontSize: '13px' }}>
                  <b>১.</b> আপনার কোড বা লিংক ফেসবুক, হোয়াটসঅ্যাপ বা যেকোনো জায়গায় শেয়ার করুন।<br />
                  <b>২.</b> বন্ধু সাইন-আপের সময় আপনার ইনভাইট কোড দেবে।<br />
                  <b>৩.</b> বন্ধু কয়েন রিচার্জ করলেই আপনি পাবেন তার <b style={{ color: 'var(--g)' }}>{S.invPct}%</b> কয়েন, প্রতিবার, স্বয়ংক্রিয়ভাবে।<br />
                  <b>৪.</b> রিওয়ার্ড আপনার ওয়ালেটে জমা হবে। বন্ধুর কয়েন কমবে না।
                </div>

                <h3>📊 আপনার ইনভাইট খতিয়ান</h3>
                <div className="gl row" style={{ padding: '14px', textAlign: 'center' }}>
                  <div className="sp">
                    <b style={{ fontSize: '22px' }}>{S.inv.n}</b>
                    <div className="sm">ইনভাইট করা বন্ধু</div>
                  </div>
                  <div className="sp">
                    <b style={{ fontSize: '22px', color: 'var(--g)' }}>🪙 {S.inv.earn.toLocaleString()}</b>
                    <div className="sm">মোট রিওয়ার্ড</div>
                  </div>
                </div>

                {S.inv.list?.map((x: any, idx: number) => (
                  <div key={idx} className="gl row" style={{ padding: '8px 12px', margin: '6px 0', fontSize: '13px' }}>
                    <span className="sp">{x.n} · 🪙 {x.c.toLocaleString()} রিচার্জ</span>
                    <b style={{ color: 'var(--g)' }}>+{x.r.toLocaleString()}</b>
                  </div>
                ))}

                <h3>🙋 কারো কোড আছে?</h3>
                <div className="gl" style={{ padding: '14px' }}>
                  {S.ref ? (
                    <div>আপনাকে ইনভাইট করেছেন: <b style={{ color: 'var(--g)' }}>{S.ref}</b></div>
                  ) : (
                    <div className="row">
                      <input
                        className="in"
                        placeholder="যেমন: SM123456"
                        value={refInput}
                        onChange={e => setRefInput(e.target.value.toUpperCase())}
                        style={{ textTransform: 'uppercase' }}
                      />
                      <button
                        className="b t"
                        onClick={() => {
                          if (!/^SM\d{6}$/.test(refInput)) return toast('কোড সঠিক নয়');
                          if (refInput === `SM${S.id}`) return toast('নিজের কোড ব্যবহার করা যায় না');
                          setS((prev: any) => ({ ...prev, ref: refInput }));
                          toast('কোড যোগ হয়েছে ✓');
                        }}
                      >
                        দিন
                      </button>
                    </div>
                  )}
                </div>

                {/* Policies & Rules */}
                <h3>📜 নিয়ম ও নীতিমালা (Rules & Policies)</h3>
                <div className="gl" style={{ padding: '14px', lineHeight: 1.8, fontSize: '12px', color: '#cbd5e1' }}>
                  • শুধু আসল রিচার্জের কয়েনের ওপর রিওয়ার্ড দেওয়া হয়।<br />
                  • নিজের কোড নিজে ব্যবহার করা যাবে না।<br />
                  • ভুয়া অ্যাকাউন্ট বা কোনো প্রকার প্রতারণা ধরা পড়লে রিওয়ার্ড বাতিল ও অ্যাকাউন্ট স্থায়ীভাবে বন্ধ হতে পারে।<br />
                  • রিওয়ার্ডের হার ও ক্যাম্পেইনের নিয়মাবলী কর্তৃপক্ষ পরিবর্তনের অধিকার সংরক্ষণ করে।
                </div>
              </>
            )}

            {/* SUBPAGE: STORE & ITEMS */}
            {activePage === 'store' && (
              <div className="rg" style={{ marginTop: '8px' }}>
                <div className="mb" style={{ background: GR[0] }} onClick={() => setActivePage('frames')}>
                  <b>🖼️</b>ফ্রেম
                </div>
                <div className="mb" style={{ background: GR[2] }} onClick={() => setActivePage('entries')}>
                  <b>🚪</b>এন্ট্রি
                </div>
                <div className="mb" style={{ background: GR[1] }} onClick={() => setActivePage('svip')}>
                  <b>👑</b>SVIP
                </div>
              </div>
            )}

            {activePage === 'items' && (
              <>
                <h3>আমার ফ্রেম</h3>
                <div className="st3">
                  {S.ownF.map((i: number) => (
                    <div key={i} className={`it ${S.fr === i ? 'on' : ''}`}>
                      <div className="av fa" style={{ width: '50px', height: '50px', fontSize: '25px', margin: '0 auto 6px', background: FRM[i]?.[2] }}>
                        <div>{S.img ? <img src={S.img} alt="Av" /> : S.av}</div>
                      </div>
                      {FRM[i]?.[0]}
                      <button
                        className={`b ${S.fr === i ? 't' : ''}`}
                        onClick={() => {
                          setS((prev: any) => ({ ...prev, fr: i }));
                          toast('ফ্রেম পরা হয়েছে');
                        }}
                      >
                        {S.fr === i ? 'পরা আছে' : 'পরুন'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* SUBPAGE: LEVEL & WEALTH */}
            {activePage === 'level' && (
              <>
                <div className="gl" style={{ padding: '16px', marginTop: '6px', textAlign: 'center' }}>
                  <b style={{ fontSize: '20px' }}>Wealth Lv.{wl}</b>
                  <div className="sm">গিফটে খরচ করলে বাড়ে</div>
                </div>
                <div className="chk">
                  <div className="sp">
                    <b>Wealth (মোট খরচ)</b>
                    <div className="pb"><i style={{ width: `${Math.min(100, (S.spent || 0) / (1000 * wl * wl) * 100)}%` }}></i></div>
                  </div>
                  <b>{(S.spent || 0).toLocaleString()} / {(1000 * wl * wl).toLocaleString()}</b>
                </div>
                <div className="chk">
                  <div className="sp">
                    <b>Level (XP)</b>
                    <div className="pb"><i style={{ width: `${Math.min(100, S.xp / (50 * lv * lv) * 100)}%` }}></i></div>
                  </div>
                  <b>{S.xp.toLocaleString()} / {(50 * lv * lv).toLocaleString()}</b>
                </div>
                <div className="chk">
                  <b className="sp">VIP Level</b>
                  <b>{S.svip ? SV[S.svip - 1]?.[0] : 'নেই'}</b>
                </div>
              </>
            )}

            {/* SUBPAGE: TRANSACTIONS HIST */}
            {activePage === 'hist' && (
              <>
                {S.hist.map((h: string, idx: number) => (
                  <div key={idx} className="gl" style={{ padding: '10px 12px', margin: '6px 0', fontSize: '13px' }}>
                    {h}
                  </div>
                ))}
              </>
            )}

            {/* SUBPAGE: ADMIN PANEL */}
            {activePage === 'admin' && (
              isSuperAdmin ? (
                <AdminPanel
                  currentUser={fbUser}
                  appState={S}
                  onUpdateAppState={setS}
                  onToast={toast}
                  onClose={() => setActivePage(null)}
                  onUpdateCoins={updateCoins}
                />
              ) : (
                <div className="gl" style={{ padding: '28px 20px', textAlign: 'center' }}>
                  <p>এই পেজে প্রবেশের অনুমতি নেই।</p>
                  <button className="b" onClick={() => setActivePage(null)}>ফিরে যান</button>
                </div>
              )
            )}

            {/* SUBPAGE: RANKINGS */}
            {activePage === 'rankings' && (
              <div className="gl" style={{ padding: '14px' }}>
                <div className="rwx">
                  <b className="n">১</b>
                  <b className="sp">রাফি</b>
                  <b style={{ color: 'var(--g)' }}>175,800 🪙</b>
                </div>
                <div className="rwx">
                  <b className="n">২</b>
                  <b className="sp">নুসরাত</b>
                  <b style={{ color: 'var(--g)' }}>152,000 🪙</b>
                </div>
                <div className="rwx">
                  <b className="n">৩</b>
                  <b className="sp">সাব্বির</b>
                  <b style={{ color: 'var(--g)' }}>125,900 🪙</b>
                </div>
              </div>
            )}

            {/* SUBPAGE: PRIVACY POLICY */}
            {activePage === 'policy_privacy' && (
              <div className="space-y-3 text-xs leading-relaxed text-gray-200" style={{ paddingBottom: '30px' }}>
                <div className="gl" style={{ padding: '16px', background: 'linear-gradient(135deg,#19e6c122,#8a5cff22)' }}>
                  <b style={{ fontSize: '16px', color: 'var(--t)', display: 'block', marginBottom: '4px' }}>
                    📜 গোপনীয়তা নীতি (Privacy Policy)
                  </b>
                  <p className="sm" style={{ color: '#94a3b8' }}>সর্বশেষ সংস্করণ: অক্টোবর ২০২৬ · Shakil M Voice Rooms</p>
                  <p style={{ marginTop: '8px' }}>
                    Shakil M Voice Rooms আপনার ব্যক্তিগত তথ্যের সুরক্ষা ও গোপনীয়তা বজায় রাখতে দৃঢ়প্রতিজ্ঞ। আপনি যখন আমাদের সেবা ব্যবহার করেন, তখন আপনার তথ্য কীভাবে সংগ্রহ, প্রক্রিয়া এবং সুরক্ষিত করা হয় তা নিচে বিস্তারিত বর্ণিত হলো।
                  </p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>১. সংগৃহীত তথ্য</b>
                  <p>• <b>প্রোফাইল তথ্য:</b> আপনার দেওয়া নাম, অবতার ইমোজি, ছবি, ইউজার আইডি, বায়ো ও দেশ।</p>
                  <p>• <b>লগইন ডেটা:</b> গুগল সাইন-ইন ও ফায়ারবেস অথেনটিকেশন শনাক্তকারী তথ্য।</p>
                  <p>• <b>লেনদেন ও ওয়ালেট ডেটা:</b> আপনার কয়েন ব্যালেন্স, রিচার্জ হিস্ট্রি, ট্রান্সফার নোট ও গিফটিং রেকর্ড।</p>
                  <p>• <b>ভয়েস ও রুম ইন্টারঅ্যাকশন:</b> রুমে উপস্থিতি, সিট নম্বর, চ্যাট মেসেজ এবং অডিও স্পিকিং স্ট্যাটাস।</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>২. তথ্যের ব্যবহার</b>
                  <p>• নিরবচ্ছিন্ন ভয়েস রুম সংযোগ এবং গেমসের বাজি ও উইন হিসাবরক্ষণ করা।</p>
                  <p>• বন্ধুদের ইনভাইট রিওয়ার্ড বোনাস স্বয়ংক্রিয়ভাবে ওয়ালেটে জমা দেওয়া।</p>
                  <p>• প্রতারণা প্রতিরোধ, অবৈধ কয়েন ফার্মিং ঠেকানো ও অ্যাকাউন্ট সুরক্ষা নিশ্চিত করা।</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>৩. তৃতীয় পক্ষের সাথে তথ্য শেয়ারিং</b>
                  <p>
                    আমরা আপনার ব্যক্তিগত তথ্য কোনো তৃতীয় পক্ষের কাছে বাণিজ্যিক বা বিজ্ঞাপনী উদ্দেশ্যে বিক্রি বা বিনিময় করি না। সকল ডেটা Google Firebase সুরক্ষিত ক্লাউড অবকাঠামোতে সংরক্ষিত হয়।
                  </p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>৪. ডেটা মুছে ফেলা ও নিয়ন্ত্রণ</b>
                  <p>
                    যেকোনো সময় আপনার অ্যাকাউন্টের হিস্ট্রি মুছে ফেলা বা ডেটা ডিলিট করার অনুরোধ জানাতে পারেন আমাদের সাপোর্ট সেন্টারে: <b>support@shakilm.app</b>
                  </p>
                </div>
              </div>
            )}

            {/* SUBPAGE: TERMS OF SERVICE */}
            {activePage === 'policy_terms' && (
              <div className="space-y-3 text-xs leading-relaxed text-gray-200" style={{ paddingBottom: '30px' }}>
                <div className="gl" style={{ padding: '16px', background: 'linear-gradient(135deg,#ff5c9d22,#ffb02a22)' }}>
                  <b style={{ fontSize: '16px', color: '#ffb02a', display: 'block', marginBottom: '4px' }}>
                    📋 ব্যবহারের সাধারণ শর্তাবলী (Terms of Service)
                  </b>
                  <p className="sm" style={{ color: '#94a3b8' }}>আইনি ব্যবহার নির্দেশিকা ও শর্তাবলী</p>
                  <p style={{ marginTop: '8px' }}>
                    Shakil M Voice Rooms প্ল্যাটফর্মে অ্যাকাউন্ট খোলার মাধ্যমে বা কোনো রুমে যোগদানের মাধ্যমে আপনি এই শর্তাবলী সম্পূর্ণরূপে মেনে নিতে বাধ্য।
                  </p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>১. ব্যবহারের যোগ্যতা</b>
                  <p>এই অ্যাপ্লিকেশন ব্যবহারের জন্য আপনার বয়স কমপক্ষে ১৮ বছর বা সংশ্লিষ্ট দেশের প্রাপ্তবয়স্ক মানদণ্ড পূরণ করতে হবে।</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>২. ইন-অ্যাপ ভার্চুয়াল মুদ্রা (কয়েন)</b>
                  <p>• প্ল্যাটফর্মের কয়েন কেবল অ্যাপের অভ্যন্তরে বিনোদন, উপহার প্রদান ও অনুমোদিত গেমসের জন্য ব্যবহৃত হবে।</p>
                  <p>• কয়েন দিয়ে কোনো প্রকার বেআইনি আর্থিক জুয়া বা তৃতীয় পক্ষীয় অর্থ লেনদেন আইনত নিষিদ্ধ।</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>৩. নিষিদ্ধ কার্যক্রম</b>
                  <p>• কোনো ধর্ম, জাতি, বর্ণ বা লিঙ্গভিত্তিক বিদ্বেষমূলক বা অশ্লীল বক্তব্য প্রচার করা যাবে না।</p>
                  <p>• বট, স্ক্রিপ্ট, রিভার্স ইঞ্জিনিয়ারিং বা অ্যাপ্লিকেশনের বাগ অপব্যবহার করা যাবে না।</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>৪. অ্যাকাউন্ট স্থগিতকরণ ও ব্যান</b>
                  <p>
                    শর্তাবলী লঙ্ঘিত হলে কোনো পূর্ব নোটিশ ছাড়াই অ্যাকাউন্ট স্থায়ীভাবে নিষ্ক্রিয় ও ভার্চুয়াল কয়েন বাজেয়াপ্ত করার পূর্ণ অধিকার প্ল্যাটফর্ম সংরক্ষণ করে।
                  </p>
                </div>
              </div>
            )}

            {/* SUBPAGE: COMMUNITY GUIDELINES */}
            {activePage === 'policy_community' && (
              <div className="space-y-3 text-xs leading-relaxed text-gray-200" style={{ paddingBottom: '30px' }}>
                <div className="gl" style={{ padding: '16px', background: 'linear-gradient(135deg,#8a5cff22,#19e6c122)' }}>
                  <b style={{ fontSize: '16px', color: 'var(--t)', display: 'block', marginBottom: '4px' }}>
                    🛡️ কমিউনিটি গাইডলাইন ও নিরাপত্তা (Community Rules)
                  </b>
                  <p className="sm" style={{ color: '#94a3b8' }}>একটি আনন্দময়, শ্রদ্ধাশীল ও নিরাপদ পরিবেশ বিনির্মাণে</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>১. পারস্পরিক সম্মান প্রদর্শন</b>
                  <p>ভয়েস রুমে আড্ডা ও গানের আসরে অন্যান্য সদস্যদের মতামতকে সম্মান জানান। শালীন ভাষা ও সুন্দর আচরণ বজায় রাখুন।</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>২. সাইবার বুলিং ও হয়রানি রোধ</b>
                  <p>কাউকে উদ্দেশ্য করে কটূক্তি, ব্লাকমেইলিং বা মানহানিকর কোনো প্রচারণা চালানো হলে তাৎক্ষণিক রিপোর্ট করুন। আমাদের মডারেশন টিম দ্রুত ব্যবস্থা নেবে।</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>৩. রুম হোস্টের দায়িত্ব</b>
                  <p>রুমের শৃঙ্খলা ও পরিবেশ রক্ষা করার প্রাথমিক দায়িত্ব রুম হোস্টের। হোস্ট যেকোনো নিয়ম ভঙ্গকারীকে সিট থেকে নামাতে পারবেন।</p>
                </div>
              </div>
            )}

            {/* SUBPAGE: USER AGREEMENT */}
            {activePage === 'policy_user_agreement' && (
              <div className="space-y-3 text-xs leading-relaxed text-gray-200" style={{ paddingBottom: '30px' }}>
                <div className="gl" style={{ padding: '16px' }}>
                  <b style={{ fontSize: '16px', color: 'var(--t)', display: 'block', marginBottom: '4px' }}>
                    🤝 ব্যবহারকারী চুক্তি (User Agreement)
                  </b>
                  <p style={{ marginTop: '8px' }}>
                    এই চুক্তি Shakil M Voice Rooms প্ল্যাটফর্মের সেবাসমূহ উপভোগের ক্ষেত্রে ব্যবহারকারী ও কর্তৃপক্ষের পারস্পরিক অধিকার ও বাধ্যবাধকতা নির্ধারণ করে।
                  </p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>১. ভার্চুয়াল আইটেম ও লাইসেন্স</b>
                  <p>অ্যাপের ফ্রেম, এন্ট্রি অ্যানিমেশন, ব্যাজ ও পদকসমূহ ব্যক্তিগত ব্যবহারের সীমিত ও পরিবর্তনযোগ্য লাইসেন্স হিসেবে গণ্য।</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>২. প্ল্যাটফর্মের পরিবর্তন</b>
                  <p>গ্রাহকের অভিজ্ঞতা বৃদ্ধি ও নিরাপত্তা জোরদার করতে সময়ে সময়ে প্ল্যাটফর্মের ফিচার আপগ্রেড বা সংশোধন করা হতে পারে।</p>
                </div>
              </div>
            )}

            {/* SUBPAGE: COINS & REFUND POLICY */}
            {activePage === 'policy_coins_refund' && (
              <div className="space-y-3 text-xs leading-relaxed text-gray-200" style={{ paddingBottom: '30px' }}>
                <div className="gl" style={{ padding: '16px', background: 'linear-gradient(135deg,#ffb02a22,#ff5c5c22)' }}>
                  <b style={{ fontSize: '16px', color: 'var(--g)', display: 'block', marginBottom: '4px' }}>
                    🪙 কয়েন রিচার্জ, ওয়ালেট ও রিফান্ড নীতি (Coin & Refund Policy)
                  </b>
                  <p className="sm" style={{ color: '#94a3b8' }}>স্বচ্ছ লেনদেন ও ব্যালেন্স সুরক্ষা নীতি</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>১. কয়েন রিচার্জ প্যাকেজসমূহ</b>
                  <p>• ব্যবহারকারী $১ থেকে শুরু করে $১০০ মূল্যের বিভিন্ন প্যাকেজে কয়েন রিচার্জ করতে পারেন।</p>
                  <p>• প্রতিটি প্যাকেজের কয়েন সফল ট্রানজেকশনের সাথে সাথেই ওয়ালেটে সরাসরি জমা হয়।</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>২. রিফান্ড সংক্রান্ত বিধিনিষেধ</b>
                  <p>• ডিজিটাল কারেন্সি ব্যবহারযোগ্য হওয়ার পর কোনো সরাসরি ক্যাশ রিফান্ড প্রদান করা হয় না।</p>
                  <p>• যদি অর্থ কেটে নেওয়া হয় কিন্তু অ্যাকাউন্টে কয়েন না পৌঁছায়, তবে লেনদেন আইডি সহ সাপোর্ট সেন্টারে যোগাযোগ করলে সর্বোচ্চ ২ ঘণ্টার মধ্যে কয়েন যোগ করে দেওয়া হয়।</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>৩. কয়েন স্থানান্তর ও গিফট</b>
                  <p>অন্য ব্যবহারকারীকে কয়েন পাঠানো বা রুমে কাউকে উপহার পাঠানোর সিদ্ধান্ত চূড়ান্ত এবং এটি বাতিলযোগ্য নয়।</p>
                </div>
              </div>
            )}

            {/* SUBPAGE: FAIR PLAY */}
            {activePage === 'policy_fairplay' && (
              <div className="space-y-3 text-xs leading-relaxed text-gray-200" style={{ paddingBottom: '30px' }}>
                <div className="gl" style={{ padding: '16px' }}>
                  <b style={{ fontSize: '16px', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
                    ⚖️ ফেয়ার প্লে ও অ্যান্টি-চিটিং নীতি (Fair Play & Security)
                  </b>
                  <p style={{ marginTop: '8px' }}>
                    আমাদের সকল গেমে সৎ ও নিরপেক্ষ প্রতিযোগিতা বজায় রাখতে কঠোর নিরাপত্তামূলক ব্যবস্থা কার্যকর রয়েছে।
                  </p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>১. র‍্যান্ডম নাম্বার জেনারেটর (RNG)</b>
                  <p>জ্যাকপট ফ্রুট, সিংহ ফুড হুইল, নাইট হুইল, ৩-রিল স্লট, সিংহ ফুড হুইল ও দাবা—সব খেলাই ক্রিপ্টোগ্রাফিক অ্যালগরিদমে স্বচ্ছভাবে চলে। কোনো অভ্যন্তরীণ পক্ষপাত নেই।</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>২. জালিয়াতি ও অসদুপায় দমন</b>
                  <p>অটোমেশন বট, মোড প্যাকেজ বা কয়েন ডুপ্লিকেশন চেষ্টার বিরুদ্ধে নিয়মিত রিয়েল-টাইম স্ক্রিনিং চালু থাকে। অসদুপায় অবলম্বনকারীদের সাথে সাথে ব্যান করা হয়।</p>
                </div>
              </div>
            )}

            {/* SUBPAGE: CUSTOMER SUPPORT */}
            {activePage === 'policy_support' && (
              <div className="space-y-3 text-xs leading-relaxed text-gray-200" style={{ paddingBottom: '30px' }}>
                <div className="gl" style={{ padding: '16px', background: 'linear-gradient(135deg,#19e6c122,#3a7cff22)' }}>
                  <b style={{ fontSize: '16px', color: 'var(--t)', display: 'block', marginBottom: '4px' }}>
                    📞 কাস্টমার সাপোর্ট ও হেল্পলাইন (Customer Support)
                  </b>
                  <p className="sm" style={{ color: '#94a3b8' }}>যেকোনো সমস্যায় আমরা আছি আপনার পাশে</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>💬 সরাসরি ইন-অ্যাপ চ্যাট</b>
                  <p>নিচের <b>Message</b> ট্যাবে গিয়ে "কাস্টমার সার্ভিস" বাটনে চাপ দিয়ে ২৪/৭ সাপোর্ট এজেন্টের সাথে কথা বলতে পারবেন।</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>📧 ইমেইল যোগাযোগ</b>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--t)' }}>support@shakilm.app</p>
                  <p className="sm" style={{ color: '#94a3b8', marginTop: '4px' }}>রিচার্জের স্ক্রিনশট ও আইডি উল্লেখ করে ইমেইল করুন।</p>
                </div>

                <div className="gl" style={{ padding: '14px' }}>
                  <b style={{ color: 'var(--g)', display: 'block', marginBottom: '6px' }}>⏰ অনলাইন সার্ভিস সময়</b>
                  <p>প্রতিদিন সকাল ৯:০০টা থেকে রাত ১২:০০টা পর্যন্ত নিরবচ্ছিন্ন লাইভ সহায়তা প্রদান করা হয়।</p>
                </div>
              </div>
            )}

            {/* SUBPAGE: FAQ */}
            {activePage === 'policy_faq' && (
              <div className="space-y-3 text-xs leading-relaxed text-gray-200" style={{ paddingBottom: '30px' }}>
                <div className="gl" style={{ padding: '14px', background: 'linear-gradient(135deg,#8a5cff22,#ff5c9d22)' }}>
                  <b style={{ fontSize: '16px', color: '#ffb02a', display: 'block' }}>❓ সাধারণ জিজ্ঞাসা ও নির্দেশিকা</b>
                </div>

                {[
                  ['ভয়েস রুমে কথা বলব কীভাবে?', 'যেকোনো রুমে ঢুকুন। নিচের ৮ বা ১২টি সিটের ফাঁকা একটিতে চাপ দিন। এরপর নিচের মাইক্রোফোন আইকনে চাপ দিলে মাইক চালু হবে।'],
                  ['রুমের ভিতর গেম খেললে কি রুম থেকে বের হয়ে যাব?', 'না! রুমের Game আইকনে চাপ দিলে গেম চালু হবে এবং আপনি রুমের ভেতরেই থাকবেন। গেমের ওপরে "মিনিমাইজ" চাপলে গেম ছোট হয়ে থাকবে এবং আপনি রুম দেখতে পারবেন।'],
                  ['রুম মিনিমাইজ কীভাবে করব?', 'রুমের ওপরে থাকা ‹ বাটন বা 🔽 বাটনে চাপ দিন। "মিনিমাইজ করুন" নির্বাচন করলে রুম ব্যাকগ্রাউন্ডে চলতে থাকবে এবং নিচে মিনি প্লেয়ার বার থাকবে।'],
                  ['অন্যজনকে কয়েন পাঠাব কীভাবে?', 'Wallet ট্যাবে যান। প্রাপকের আইডি (যেমন 108392) ও কয়েন সংখ্যা দিয়ে "কয়েন পাঠান" চাপুন।'],
                  ['রেফারেল ইনভাইট থেকে কয়েন কীভাবে পাব?', 'Profile > Invite & Earn-এ যান। আপনার কোড শেয়ার করুন। বন্ধু যতবার কয়েন রিচার্জ করবে, প্রতিবার তার ৫% কয়েন আপনার ব্যালেন্সে যোগ হবে।'],
                  ['গুগল লগইন কীভাবে ব্যাকআপ রাখব?', 'Profile-এ গিয়ে "Google লগইন" বাটনে চাপ দিন। আপনার জিমেইল অ্যাকাউন্ট দিয়ে সাইন ইন করলে কয়েন ও ডেটা ফায়ারবেস ক্লাউডে সুরক্ষিত থাকবে।'],
                ].map(([q, a], idx) => (
                  <div key={idx} className="gl" style={{ padding: '12px' }}>
                    <b style={{ color: 'var(--t)', display: 'block', marginBottom: '4px' }}>Q: {q}</b>
                    <p style={{ color: '#e2e8f0' }}>A: {a}</p>
                  </div>
                ))}
              </div>
            )}

            {/* SUBPAGE: ABOUT US */}
            {activePage === 'policy_about' && (
              <div className="space-y-4 text-xs leading-relaxed text-gray-200 text-center" style={{ paddingBottom: '30px' }}>
                <div className="gl" style={{ padding: '24px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎙️</div>
                  <b style={{ fontSize: '20px', color: 'var(--t)', display: 'block' }}>
                    Shakil M Voice Rooms
                  </b>
                  <p style={{ color: 'var(--g)', fontWeight: 'bold', marginTop: '4px' }}>ভার্সন ৩.৫ (Version 3.5.0)</p>
                  <p style={{ marginTop: '14px', lineHeight: 1.8, color: '#cbd5e1' }}>
                    Shakil M Voice Rooms হলো একটি আধুনিক সোশ্যাল ভয়েস রুম ও রিয়েল-টাইম পার্টি প্ল্যাটফর্ম। এখানে ব্যবহারকারীরা ভয়েস রুমে আড্ডা দিতে পারেন, বন্ধুদের গিফট পাঠাতে পারেন এবং ৬টি জনপ্রিয় গেমস খেলে কয়েন উপার্জন করতে পারেন।
                  </p>
                  <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '11px' }}>
                    © ২০২৬ Shakil M Inc. সর্বস্বত্ব সংরক্ষিত।<br />
                    Powered by Firebase & WebRTC Audio.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Active Voice Room View */}
      {activeRoom && (
        <div style={{display:isRoomMinimized?'none':undefined}}><VoiceRoomView key={activeRoom.id}
          onOpenMessages={()=>{setTab('msg');setIsRoomMinimized(true)}}
          onOpenUsers={uid=>{setGiftRecipient(uid);setShowUserDirectory(true)}}
          room={activeRoom}
          user={S}
          customGifts={S.customGifts}
          onUpdateCoins={(newCoins: number, reason: string) => {
            const diff = newCoins - S.coins;
            updateCoins(diff, reason);
          }}
          onOpenGame={(gameId: string) => {
            // Keep room active in background while playing game!
            setActiveGame(gameId);
          }}
          onOpenWallet={() => {setTab('wallet');setIsRoomMinimized(true)}}
          onMinimize={() => {
            setIsRoomMinimized(true);
            toast('রুম মিনিমাইজ করা হয়েছে');
          }}
          onLeaveRoom={() => {
            setActiveRoom(null);
            setIsRoomMinimized(false);
            toast('রুম ত্যাগ করেছেন');
          }}
          onClose={() => {
            setActiveRoom(null);
            setIsRoomMinimized(false);
          }}
        /></div>
      )}

      {/* 6b. Minimized Floating Room Bar */}
      {activeRoom && isRoomMinimized && (
        <div 
          className="reference-mini-room fixed bottom-[84px] left-3 right-3 max-w-[456px] mx-auto z-[70] bg-[#12082e]/95 border-2 border-cyan-400 rounded-2xl p-2.5 flex items-center justify-between shadow-[0_8px_25px_rgba(0,0,0,0.85)] backdrop-blur-md"
        >
          <div 
            onClick={() => setIsRoomMinimized(false)}
            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-600 p-0.5 flex items-center justify-center text-lg shadow relative">
              <span className="w-full h-full bg-slate-900 rounded-xl flex items-center justify-center">
                {activeRoom.cv}
              </span>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
            </div>
            <div className="flex-1 min-w-0">
              <b className="text-xs text-white truncate block">{activeRoom.name}</b>
              <span className="text-[10px] text-cyan-300 font-bold block truncate">
                হোস্ট: {activeRoom.host} · মিনিমাইজড (ট্যাপ করে খুলুন)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={() => setIsRoomMinimized(false)}
              className="px-2.5 py-1.5 bg-gradient-to-r from-cyan-400 to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow active:scale-95 flex items-center gap-1"
              title="রুম বড় করুন"
            >
              <Maximize2 size={12} />
              <span>বড় করুন</span>
            </button>
            <button
              onClick={() => {
                setActiveRoom(null);
                setIsRoomMinimized(false);
                toast('রুম ত্যাগ করেছেন');
              }}
              className="w-8 h-8 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white flex items-center justify-center text-xs font-bold active:scale-95"
              title="লিভ নিন"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 6c. Floating Minimized Game Widget (when game is minimized while in room or app) */}
      {activeGame && isGameMinimized && (
        <div
          onClick={() => {
            setIsGameMinimized(false);
            toast('গেম বড় করা হয়েছে');
          }}
          className="fixed top-20 right-3 z-50 bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 border-2 border-yellow-300 text-white rounded-2xl p-2.5 shadow-[0_8px_25px_rgba(0,0,0,0.85)] flex items-center gap-2 cursor-pointer active:scale-95 animate-pulse"
          title="মিনিমাইজড গেম বড় করুন"
        >
          <span className="text-2xl drop-shadow">
            {activeGame === 'greedy_lion' ? '🦁' : activeGame === 'jackpot_fruit' ? '🍒' :
             activeGame === 'lion_wheel' ? '🦁' :
             activeGame === 'night_wheel' ? '🌙' :
             activeGame === 'slots' ? '🎰' :
             activeGame === 'carrom' ? '🔴' : '♟️'}
          </span>
          <div className="text-left pr-1">
            <b className="text-[11px] block font-black leading-tight text-white drop-shadow">
              {activeGame === 'greedy_lion' ? 'Greedy Lion' : activeGame === 'jackpot_fruit' ? 'জ্যাকপট ফ্রুট' :
               activeGame === 'lion_wheel' ? 'ফুড হুইল' :
               activeGame === 'night_wheel' ? 'নাইট হুইল' :
               activeGame === 'slots' ? 'স্লটস' :
               activeGame === 'carrom' ? 'সিংহ ফুড হুইল' : 'দাবা ৩ডি'}
            </b>
            <span className="text-[9px] text-yellow-200 block font-bold">▶ খেলুন (ট্যাপ করুন)</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              
              setActiveGame(null);
              setIsGameMinimized(false);
              toast('গেম বন্ধ করা হয়েছে');
            }}
            className="w-5 h-5 rounded-full bg-black/50 text-gray-300 hover:text-white flex items-center justify-center text-[10px]"
            title="গেম বন্ধ করুন"
          >
            ✕
          </button>
        </div>
      )}

      {/* 7. Native Embedded Games (User Requested Games) with In-Room Header */}
      {activeGame && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0c0824]" style={{display:isGameMinimized?'none':undefined}}>
          {/* In-Room Status Bar: Keeps user in voice room while playing! */}
          {activeRoom && (
            <div className="bg-[#0c0824]/95 border-b-2 border-cyan-400 px-3 py-2 flex items-center justify-between text-white backdrop-blur-md shadow-2xl z-[60] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-900 border border-cyan-400 flex items-center justify-center text-sm relative shrink-0">
                  <span>{activeRoom.cv}</span>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
                </div>
                <div className="min-w-0">
                  <b className="text-xs text-white truncate block">🎙️ {activeRoom.name}</b>
                  <span className="text-[10px] text-cyan-300 font-bold block truncate">
                    হোস্ট: {activeRoom.host} · রুমে আছেন
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    setIsGameMinimized(true);
                    toast('গেম মিনিমাইজ করা হয়েছে (রুম দেখুন)');
                  }}
                  className="px-2.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/50 rounded-xl text-xs font-black flex items-center gap-1 active:scale-95 shadow"
                  title="গেম মিনিমাইজ করুন ও রুম দেখুন"
                >
                  <ChevronDown size={14} />
                  <span>মিনিমাইজ</span>
                </button>
                <button
                  onClick={() => {
                    
                    setActiveGame(null);
                    setIsGameMinimized(false);
                    toast('রুমে ফিরে এসেছেন');
                  }}
                  className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-400/40 rounded-xl text-xs font-bold active:scale-95"
                  title="গেম বন্ধ করে রুমে থাকুন"
                >
                  <span>✕ বন্ধ</span>
                </button>
              </div>
            </div>
          )}

          {activeRoom&&<GameWinFeed roomId={activeRoom.id}/>}
          <div className="flex-1 relative overflow-hidden">
            {['greedy_lion','lion_wheel','night_wheel','jackpot_fruit'].includes(activeGame) && <UploadedSharedGame key={activeGame} game={activeGame} userName={S.name} onClose={()=>setActiveGame(null)} onWallet={()=>{setActiveGame(null);setTab('wallet');setIsRoomMinimized(Boolean(activeRoom))}}/>}
            {activeGame==='slots'&&<SharedRoundGame game="slots" onClose={()=>setActiveGame(null)}/>}

            {activeGame==='chess_3d'&&<div className="p-8 text-white"><h2>দাবা ৩ডি</h2><p>আপলোড করা ফাইলে গেমের HTML নেই। নতুন দাবার HTML ফাইল যোগ করা প্রয়োজন।</p><button className="b t" onClick={()=>setActiveGame(null)}>ফিরে যান</button></div>}
          </div>
        </div>
      )}

      {/* User Create Room Modal */}
      {showCreateRoomModal && (
        <div 
          className="ref-create-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => !roomCreating&&setShowCreateRoomModal(false)}
        >
          <div 
            className="ref-create-card w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-[#12092b] border border-cyan-400/40 rounded-3xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] relative text-white"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-600 flex items-center justify-center text-lg shadow">
                  🎙️
                </div>
                <div>
                  <b className="text-base block font-bold text-white">নতুন ভয়েস রুম তৈরি</b>
                  <span className="text-[11px] text-gray-400">আপনার নিজস্ব আড্ডার আসর খুলুন</span>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateRoomModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-gray-300 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <label className="block rounded-2xl border border-cyan-400/30 bg-indigo-500/10 p-4 text-center cursor-pointer">{newRoomPhoto?<img src={newRoomPhoto} alt="রুমের ছবি" className="w-20 h-20 rounded-2xl object-cover mx-auto mb-2"/>:<span className="block text-4xl mb-2">📷</span>}গ্যালারি থেকে রুমের ছবি দিন<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(file)try{setNewRoomPhoto(await galleryPhoto(file))}catch(err){toast(err instanceof Error?err.message:'ছবি যোগ হয়নি')}}}/></label>
              <div>
                <label className="block text-gray-300 font-semibold mb-1">রুমের নাম *</label>
                <input 
                  type="text"
                  maxLength={80}
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  placeholder="যেমন: বাংলা গান ও আড্ডা"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">ক্যাটাগরি</label>
                  <select 
                    value={newRoomCategory}
                    onChange={e => setNewRoomCategory(e.target.value)}
                    className="w-full bg-[#1e133e] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  >
                    {['চ্যাট', 'পার্টি', 'গেম', 'নতুন', 'ইভেন্ট'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">সিট সংখ্যা</label>
                  <select 
                    value={newRoomSeatCount}
                    onChange={e => setNewRoomSeatCount(Number(e.target.value))}
                    className="w-full bg-[#1e133e] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value={8}>৮ সিট (8 Seats)</option><option value={10}>১০ সিট (10 Seats)</option>
                    <option value={12}>১২ সিট (12 Seats)</option>
                    <option value={20}>২০ সিট (20 Seats)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">রুমের থিম</label><div className="ref-theme-picker">{roomThemes.map((theme,i)=><button type="button" key={theme} aria-label={`থিম ${i+1}`} aria-pressed={newRoomTheme===i} className={newRoomTheme===i?'selected':''} style={{background:theme}} onClick={()=>setNewRoomTheme(i)}/>)}</div><label className="block text-gray-300 font-semibold mb-1 mt-4">রুমের আইকন / কভার</label>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {['🎤', '🎶', '🎮', '💬', '🌙', '💞', '🔥', '🎉', '🎸', '☕'].map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewRoomIcon(icon)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 transition-all ${
                        newRoomIcon === icon 
                          ? 'bg-cyan-400/30 border-2 border-cyan-400 scale-105' 
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">রুমের ট্যাগ</label>
                <input 
                  type="text"
                  value={newRoomTag}
                  onChange={e => setNewRoomTag(e.target.value)}
                  placeholder="যেমন: আড্ডা, গান, ফ্রেন্ডস"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">স্বাগতম নোটিশ (Announcement)</label>
                <textarea 
                  rows={2}
                  value={newRoomAnn}
                  onChange={e => setNewRoomAnn(e.target.value)}
                  placeholder="রুমে আসা মেম্বারদের জন্য বার্তা..."
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setShowCreateRoomModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-gray-300 font-semibold hover:bg-white/15 active:scale-95"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newRoomName.trim()) {
                    toast('অনুগ্রহ করে রুমের নাম লিখুন');
                    return;
                  }
                  const createdRoom: any = {
                    id: `user-${fbUser?.uid}`,
                    photoURL:newRoomPhoto,
                    publicId:String(S.id),
                    name: newRoomName.trim(),
                    host: S.name,
                    hostId: S.id,
                    cv: newRoomIcon,
                    c: newRoomCategory,
                    th: newRoomTheme,
                    d: 0,
                    n: 1,
                    flag: S.country === 'সৌদি' ? '🇸🇦' : S.country === 'ভারত' ? '🇮🇳' : '🇧🇩',
                    tag: newRoomTag.trim() || 'আড্ডা',
                    ann: newRoomAnn.trim() || 'স্বাগতম! সবাই মিলে আড্ডা দিই 🎉',
                    sc: newRoomSeatCount,
                    oc: [{ s: 0, n: S.name, av: S.img ? '👤' : (S.av || '🎤'), sc: 0 }]
                  };

                  if (!fbUser?.uid) { toast('রুম তৈরি করতে Google দিয়ে লগইন করুন।'); return; }
                  createdRoom.hostId = fbUser.uid;
                  if(roomCreating)return;
                  setRoomCreating(true);
                  try {
                    const existing=await getDocs(query(collection(db,'rooms'),where('hostId','==',fbUser.uid)));
                    if(!existing.empty){setActiveRoom({id:existing.docs[0].id,...existing.docs[0].data()});setShowCreateRoomModal(false);setIsRoomMinimized(false);return;}
                    await runTransaction(db,async tx=>{const ref=doc(db,'roomOwners',fbUser.uid);const own=await tx.get(ref);const roomRef=doc(db,'rooms',createdRoom.id);const roomSnap=await tx.get(roomRef);if(own.exists()||roomSnap.exists())throw new Error('আপনার রুম ইতিমধ্যে তৈরি হয়েছে।');tx.set(ref,{roomId:createdRoom.id});tx.set(roomRef,createdRoom);});
                  } catch(err) { toast(err instanceof Error?err.message:'রুম সেভ হয়নি। নতুন Rules ও সংযোগ পরীক্ষা করুন।'); return; }
                  finally{setRoomCreating(false);}

                  // Prepend newly created room to list
                  setS((prev: any) => ({
                    ...prev,
                    rooms: [createdRoom, ...prev.rooms.filter((r: any) => r.id !== createdRoom.id)]
                  }));

                  setShowCreateRoomModal(false);
                  toast(`🎉 "${createdRoom.name}" রুম সফলভাবে তৈরি হয়েছে!`);

                  // Automatically open the user's new room as host!
                  setActiveRoom(createdRoom);
                  setIsRoomMinimized(false);
                  playEntryAnimation(S.en, S.name);
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 font-bold hover:brightness-110 active:scale-95 shadow-lg shadow-cyan-500/25"
              >
                {roomCreating?'সেভ হচ্ছে…':'🚀 লাইভ রুম চালু করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Recharge Package Permission / Request Modal */}
      {selectedRechargePackage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedRechargePackage(null)}
        >
          <div 
            className="w-full max-w-sm bg-[#12092b] border border-amber-400/40 rounded-3xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] relative text-white"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-rose-600 flex items-center justify-center text-xl shadow">
                  🔒
                </div>
                <div>
                  <b className="text-sm block font-bold text-white">
                    {isSuperAdmin ? '👑 সুপার অ্যাডমিন রিচার্জ' : '🔒 কয়েন রিচার্জ অনুমতি সংরক্ষিত'}
                  </b>
                  <span className="text-[11px] text-gray-300">
                    {isSuperAdmin ? 'অ্যাডমিন অ্যাকাউন্ট প্রিভিলেজ' : 'নিজে থেকে কয়েন নেওয়ার পারমিশন বন্ধ আছে'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedRechargePackage(null)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-gray-300 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Package Summary Box */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-black/40 to-purple-900/30 border border-amber-400/30 text-center mb-4">
              <div className="text-[11px] text-gray-300 mb-1">নির্বাচিত প্যাকেজ:</div>
              <div className="text-2xl font-black text-amber-300 flex items-center justify-center gap-1.5">
                <span>🪙</span>
                <span>{selectedRechargePackage.c.toLocaleString()} কয়েন</span>
              </div>
              <div className="text-xs text-emerald-400 font-bold mt-1">
                মূল্য: ${selectedRechargePackage.u} USD (~৳{selectedRechargePackage.u * 120} BDT)
              </div>
              <div className="mt-2 text-[11px] text-gray-300 border-t border-white/10 pt-2 flex items-center justify-between">
                <span>ব্যবহারকারী আইডি:</span>
                <span className="font-mono font-bold text-amber-300">SM{S.id} ({S.name})</span>
              </div>
            </div>

            {/* Security Notice / Policy */}
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-[11px] text-red-200 leading-relaxed mb-4">
              {isSuperAdmin ? (
                <div className="text-emerald-300">
                  👑 আপনি সিস্টেমের সুপার অ্যাডমিন হিসেবে লগইন আছেন। আপনি চাইলে সরাসরি নিজের অ্যাকাউন্টে কয়েন যুক্ত করতে পারেন অথবা অ্যাডমিন প্যানেলে পরিচালনা করতে পারেন।
                </div>
              ) : (
                <div>
                  🛡️ <b>নিরাপত্তা নিয়ম:</b> সিস্টেমের সুরক্ষার স্বার্থে কোনো সাধারণ ইউজার সরাসরি ওয়ালেটে কয়েন যোগ করতে পারবেন না। অ্যাডমিন অনুমোদন ছাড়া কয়েন ব্যালেন্সে যোগ হবে না।
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {isSuperAdmin ? (
                <>
                  <button
                    onClick={() => {
                      updateCoins(selectedRechargePackage.c, `অ্যাডমিন সেলফ রিচার্জ (${selectedRechargePackage.u}$)`);
                      toast(`🎉 +${selectedRechargePackage.c.toLocaleString()} কয়েন ব্যালেন্সে যোগ করা হয়েছে!`);
                      setSelectedRechargePackage(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xs hover:brightness-110 active:scale-95 shadow-md flex items-center justify-center gap-2"
                  >
                    <span>🪙 অ্যাডমিন রিচার্জ সম্পন্ন করুন (+{selectedRechargePackage.c.toLocaleString()})</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRechargePackage(null);
                      setActivePage('admin');
                    }}
                    className="w-full py-2.5 rounded-xl bg-purple-600/50 hover:bg-purple-600 text-white font-bold text-xs active:scale-95 border border-purple-400/30 flex items-center justify-center gap-1.5"
                  >
                    <span>⚙️ অ্যাডমিন প্যানেলে যান</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      const newReq = {
                        id: 'req_' + Date.now(),
                        userId: S.id,
                        userName: S.name,
                        userAv: S.img ? '👤' : (S.av || '🧑'),
                        coins: selectedRechargePackage.c,
                        price: selectedRechargePackage.u,
                        status: 'pending',
                        createdAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
                        date: new Date().toLocaleDateString('bn-BD'),
                      };
                      setS((prev: any) => ({
                        ...prev,
                        rechargeRequests: [newReq, ...(prev.rechargeRequests || [])]
                      }));
                      setSelectedRechargePackage(null);
                      toast('📩 রিচার্জের অনুরোধ অ্যাডমিন প্যানেলে সফলভাবে পাঠানো হয়েছে! অ্যাডমিন যাচাই করে অনুমোদন করবেন।');
                    }}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 font-black text-xs hover:brightness-110 active:scale-95 shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
                  >
                    <span>📩 অ্যাডমিনকে রিচার্জ অনুরোধ পাঠান</span>
                  </button>
                  <div className="text-center pt-1">
                    <span className="text-[10px] text-gray-400 block">
                      অ্যাডমিন হেল্পলাইন / ইমেইল: <b className="text-amber-300">yfastvpn@gmail.com</b>
                    </span>
                  </div>
                </>
              )}

              <button
                onClick={() => setSelectedRechargePackage(null)}
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 text-xs font-semibold"
              >
                বাতিল করুন
              </button>
            </div>
          </div>
        </div>
      )}
        </>

      {/* Toast Notification */}
      {toastText && (
        <div id="toast" style={{ display: 'block' }}>
          {toastText}
        </div>
      )}
    </div>
  );
}
