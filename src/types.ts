export interface UserProfile {
  id: string; // e.g. "108392"
  uid?: string; // firebase UID
  name: string;
  email?: string;
  av: string; // emoji avatar or character
  img?: string; // photo data/URL
  coins: number;
  xp: number;
  svip: number; // 0: none, 1: SVIP 1, 2: SVIP 2, 3: SVIP 3
  lastCheckin?: string;
  streak: number;
  country: string;
  age: number;
  dob?: string;
  bio?: string;
  spent: number;
  follow: string[];
  ownF: number[]; // owned frames
  fr: number; // current frame index
  ownE: number[]; // owned entry animations
  en: number; // current entry index (-1 = none)
  ownT: number[]; // owned themes
  gifts: {
    sent: number;
    recv: string[];
  };
  inv: {
    n: number;
    earn: number;
    list: { n: string; c: number; r: number }[];
  };
  ref?: string;
  isRegistered?: boolean;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  type: 'recharge' | 'transfer_sent' | 'transfer_received' | 'game_win' | 'game_bet' | 'gift_sent' | 'gift_received' | 'checkin' | 'task';
  amount: number; // positive or negative
  description: string;
  timestamp: string;
  senderId?: string;
  senderName?: string;
  receiverId?: string;
  receiverName?: string;
}

export interface VoiceRoom {
  id: string;
  name: string;
  host: string;
  hostId?: string;
  photoURL?: string;
  cv: string; // emoji icon
  c: string; // category
  th: number; // theme index
  d?: number; // 1 if demo
  n: number; // active listeners count
  flag: string;
  tag: string;
  ann: string;
  own?: number;
  tot?: number; // total room gift coins
  sc?: number; // seat count (8, 12, 20)
  oc?: { s: number; n: string; av: string; sc: number }[];
}

export interface GameMetadata {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  category: string;
  bannerBg: string;
  shadowColor: string;
}

export interface RechargePackage {
  usd: number;
  coins: number;
  badge?: string;
}
