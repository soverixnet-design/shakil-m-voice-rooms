import { db, doc, collection } from '../firebase';
import { onSnapshot, runTransaction, writeBatch } from 'firebase/firestore';
import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Coins,
  Users,
  Radio,
  Settings,
  PlusCircle,
  Trash2,
  Edit3,
  CheckCircle,
  AlertTriangle,
  Gift,
  ShoppingBag,
  Bell,
  Sparkles,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  Zap,
  Crown,
  UserCheck,
  UserX,
  X,
  DollarSign
} from 'lucide-react';

interface AdminPanelProps {
  currentUser: any;
  appState: any;
  onUpdateAppState: (updater: (prev: any) => any) => void;
  onToast: (msg: string) => void;
  onClose: () => void;
  onUpdateCoins: (amount: number, reason: string) => Promise<boolean>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  appState,
  onUpdateAppState,
  onToast,
  onClose,
  onUpdateCoins
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'quick_boost' | 'rooms' | 'gifts' | 'packages' | 'banner' | 'system'>('users');

  // Search & Filters
  const [searchUser, setSearchUser] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'admin' | 'svip' | 'banned'>('all');
  const [reqFilter, setReqFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  // New User Form State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [newUserAv, setNewUserAv] = useState('🧑');
  const [newUserCoins, setNewUserCoins] = useState('50000');
  const [newUserDiamonds, setNewUserDiamonds] = useState('100');
  const [newUserSvip, setNewUserSvip] = useState(1);
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [newUserBadge, setNewUserBadge] = useState('Active Member');

  // Edit User State
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // Quick Coin Give State for Specific User
  const [coinModalUser, setCoinModalUser] = useState<any | null>(null);
  const [rechargeId, setRechargeId] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeResult, setRechargeResult] = useState<any | null>(null);
  const [customCoinAmount, setCustomCoinAmount] = useState('');
  const [customCoinAction, setCustomCoinAction] = useState<'add' | 'deduct' | 'set'>('add');
  const [customCoinReason, setCustomCoinReason] = useState('অ্যাডমিন কয়েন পুরস্কার');

  // Quick Admin Wallet Boost Custom Set
  const [exactAdminCoins, setExactAdminCoins] = useState('');

  // Banner State
  const [bannerText, setBannerText] = useState(appState.bn?.t || 'ভয়েস রুমে আড্ডা দিন, গিফট পাঠান, গেম খেলুন! 🎉');

  // Room Creation / Edit State
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomHost, setNewRoomHost] = useState(appState.name || 'অ্যাডমিন');
  const [newRoomCategory, setNewRoomCategory] = useState('আড্ডা');
  const [newRoomCover, setNewRoomCover] = useState('🎤');
  const [newRoomTag, setNewRoomTag] = useState('Official');
  const [newRoomAnn, setNewRoomAnn] = useState('অফিসিয়াল স্পেশাল ভয়েস রুম!');
  const [editingRoom, setEditingRoom] = useState<any | null>(null);

  // New Gift Creation State
  const [showAddGiftModal, setShowAddGiftModal] = useState(false);
  const [newGiftName, setNewGiftName] = useState('');
  const [newGiftIcon, setNewGiftIcon] = useState('🌹');
  const [newGiftPrice, setNewGiftPrice] = useState('100');
  const [newGiftType, setNewGiftType] = useState('romantic');

  // Store Package State
  const [newPkgCoins, setNewPkgCoins] = useState('');
  const [newPkgBdt, setNewPkgBdt] = useState('');

  // Business Parameters State
  const [inviteRewardPct, setInviteRewardPct] = useState(String(appState.invPct || 5));
  const [welcomeCoins, setWelcomeCoins] = useState(String(appState.welcomeCoins || 50000));
  const [supportPhone, setSupportPhone] = useState(appState.supportPhone || '+880 1700-000000');

  // Normalized User List & Requests from State
  const [userList, setUserList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [savingCoins, setSavingCoins] = useState(false);
  const coinLock = useRef(false);
  useEffect(() => {
    if (!currentUser?.uid) return;
    return onSnapshot(collection(db, 'users'), snapshot => {
      setUserList(snapshot.docs.map(item => ({ ...item.data(), uid: item.id,
        id: item.data().id || item.data().userId || item.id,
        name: item.data().name || item.data().email || 'ইউজার',
        av: item.data().avatar || '🧑' })));
      setUsersLoading(false); setUsersError('');
    }, () => { setUsersLoading(false); setUsersError('ইউজার তালিকা লোড হয়নি। Firebase অনুমতি ও সংযোগ পরীক্ষা করুন।'); });
  }, [currentUser?.uid]);
  const roomsList: any[] = appState.rooms || [];
  const giftsList: any[] = appState.customGifts || [];
  const packagesList: any[] = appState.pk || [];
  const rechargeRequests: any[] = appState.rechargeRequests || [];
  const pendingRequestsCount = rechargeRequests.filter((r: any) => r.status === 'pending').length;

  const applyAdminState = async (updater: (prev:any)=>any): Promise<boolean> => {
    if (!currentUser?.emailVerified || currentUser.email?.toLowerCase() !== 'yfastvpn@gmail.com') { onToast('অনুমোদিত অ্যাডমিন লগইন প্রয়োজন।'); return false; }
    const base = {...appState,userList};
    const next = updater(base);
    const batch = writeBatch(db);
    try {
      for (const old of userList) {
        const changed = (next.userList || userList).find((u:any)=>u.uid===old.uid);
        if ((!changed || ['banned','archived'].includes(changed.status)) && old.uid === currentUser.uid) throw Error('owner-status');
        if (!changed) { batch.update(doc(db,'users',old.uid), {status:'archived'}); continue; }
        const patch:any = {};
        for(const field of ['name','coins','svip','badge','status','avatar']) if(changed[field]!==old[field] && changed[field]!==undefined) patch[field]=changed[field];
        if(patch.coins!==undefined && (!Number.isSafeInteger(patch.coins)||patch.coins<0)) throw Error('invalid-coins');
        if(Object.keys(patch).length) batch.update(doc(db,'users',old.uid),patch);
      }
      if (next.rooms !== base.rooms) {
        for(const room of next.rooms||[]) {
          const old=(base.rooms||[]).find((r:any)=>r.id===room.id);
          if(!old||JSON.stringify(old)!==JSON.stringify(room)) batch.set(doc(db,'rooms',String(room.id)),{...room,hostId:room.hostId||currentUser.uid},{merge:true});
        }
        for(const room of base.rooms||[]) if(!(next.rooms||[]).some((r:any)=>r.id===room.id)) batch.set(doc(db,'rooms',String(room.id)),{archived:true},{merge:true});
      }
      const config:any = {};
      for(const field of ['bn','pk','customGifts','invPct','welcomeCoins','supportPhone']) if(next[field]!==base[field]) config[field]=next[field];
      if(Object.keys(config).length) batch.set(doc(db,'system','config'),config,{merge:true});
      await batch.commit();
      onUpdateAppState(()=>next);
      return true;
    } catch { onToast('সেভ হয়নি। Firebase অনুমতি ও সংযোগ পরীক্ষা করুন।'); return false; }
  };

  // RECHARGE REQUEST HANDLERS
  const handleApproveRequest = async (req: any) => {
    const matches = userList.filter(u => u.uid === req.userId || String(u.id) === String(req.userId));
    if (matches.length !== 1) { onToast('এই রিকোয়েস্টের সঠিক ইউজার ID পাওয়া যায়নি। ইউজার তালিকা থেকে রিচার্জ দিন।'); return; }
    const ok = await handleGiveCoinsToUser(matches[0], Number(req.coins), 'add', 'অনুমোদিত রিচার্জ', String(req.id));
    if (ok) if (!await applyAdminState((prev: any) => ({ ...prev, rechargeRequests: (prev.rechargeRequests || []).map((r: any) => r.id === req.id ? { ...r, status: 'approved' } : r) }))) return;
  };

  const handleRejectRequest = async (req: any) => {
    if (!await applyAdminState((prev: any) => ({
      ...prev,
      rechargeRequests: (prev.rechargeRequests || []).map((r: any) =>
        r.id === req.id ? {
          ...r,
          status: 'rejected',
          rejectedAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
        } : r
      )
    }))) return;
    onToast(`❌ [${req.userName}] এর রিচার্জ অনুরোধ বাতিল করা হয়েছে!`);
  };

  const handleDeleteRequest = async (reqId: string) => {
    if (!await applyAdminState((prev: any) => ({
      ...prev,
      rechargeRequests: (prev.rechargeRequests || []).filter((r: any) => r.id !== reqId)
    }))) return;
    onToast('অনুরোধ তালিকা থেকে তালিকা থেকে আর্কাইভ করা হয়েছে!');
  };

  // 1. ADD NEW USER
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault(); onToast('আসল ইউজারকে Google দিয়ে লগইন করতে বলুন। তখন তার অ্যাকাউন্ট তালিকায় আসবে।');
  };

  // 2. QUICK COIN INJECTION TO A USER
  const handleGiveCoinsToUser = async (target: any, amount: number, action: 'add' | 'deduct' | 'set' = 'add', reason = 'অ্যাডমিন রিচার্জ', requestId?: string): Promise<boolean> => {
    if (coinLock.current) return false;
    if (!target.uid || !Number.isSafeInteger(amount) || amount < 0 || (action !== 'set' && amount === 0)) {
      setRechargeResult({error:'সঠিক ইউজার ও পূর্ণ কয়েন সংখ্যা দিন!'}); onToast('সঠিক ইউজার ও পূর্ণ কয়েন সংখ্যা দিন!'); return false;
    }
    if (!currentUser?.emailVerified || currentUser.email?.toLowerCase() !== 'yfastvpn@gmail.com') {
      onToast('অনুমোদিত অ্যাডমিন অ্যাকাউন্ট দিয়ে লগইন করুন।'); return false;
    }
    coinLock.current = true; setSavingCoins(true); setRechargeResult(null);
    try {
      const ledger = requestId ? doc(db, 'transactions', `recharge_${encodeURIComponent(requestId)}`) : doc(collection(db, 'transactions'));
      const balance = await runTransaction(db, async transaction => {
        const ref = doc(db, 'users', target.uid);
        const user = await transaction.get(ref);
        const previous = await transaction.get(ledger);
        if (previous.exists()) throw new Error('already-approved');
        if (!user.exists()) throw new Error('missing-user');
        const old = Number(user.data().coins || 0);
        const next = action === 'set' ? amount : old + (action === 'deduct' ? -amount : amount);
        if (!Number.isSafeInteger(next) || next < 0) throw new Error('insufficient-coins');
        transaction.update(ref, { coins: next });
        transaction.set(ledger, { userId: target.uid, adminId: currentUser.uid, type: 'admin-recharge', amount: next - old, balance: next, reason, createdAt: new Date().toISOString() });
        return { before: old, after: next, amount: next - old };
      });
      setRechargeResult({ ...balance, id: String(target.id), name: target.name, transactionId: ledger.id, time: new Date().toLocaleString('bn-BD') });
      onToast(`${target.name}: ${balance.after.toLocaleString()} কয়েন — সেভ হয়েছে ✓`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setRechargeResult({error: message === 'already-approved' ? 'এই রিচার্জ আগে অনুমোদিত হয়েছে। নতুন করে কয়েন যোগ হয়নি।' : message === 'insufficient-coins' ? 'ব্যালেন্সের বেশি কয়েন কাটা যাবে না।' : 'রিচার্জ ব্যর্থ — কয়েন সেভ হয়নি। Firebase অনুমতি ও সংযোগ পরীক্ষা করুন।'});
      onToast(message === 'already-approved' ? 'এই রিচার্জ আগে অনুমোদিত হয়েছে।' : message === 'insufficient-coins' ? 'ব্যালেন্সের বেশি কয়েন কাটা যাবে না।' : 'রিচার্জ সেভ হয়নি। Firebase অনুমতি ও সংযোগ পরীক্ষা করুন।');
      return false;
    } finally { coinLock.current = false; setSavingCoins(false); }
  };

  // 3. EDIT USER DETAILS
  const handleSaveEditUser = async () => {
    if (!editingUser) return;
    if (!await applyAdminState((prev: any) => {
      const list = (prev.userList || []).map((u: any) => {
        if (u.id === editingUser.id) return editingUser;
        return u;
      });
      return { ...prev, userList: list };
    })) return;
    onToast(`ইউজার [${editingUser.name}] এর তথ্য সংরক্ষিত হয়েছে! ✓`);
    setEditingUser(null);
  };

  // 4. TOGGLE BAN / UNBAN USER
  const handleToggleUserBan = async (target: any) => {
    const newStatus = target.status === 'banned' ? 'active' : 'banned';
    if (!await applyAdminState((prev: any) => {
      const list = (prev.userList || []).map((u: any) => {
        if (u.id === target.id) return { ...u, status: newStatus };
        return u;
      });
      return { ...prev, userList: list };
    })) return;
    onToast(`ইউজার [${target.name}] ${newStatus === 'banned' ? 'সাসপেন্ড / ব্যান করা হয়েছে 🚫' : 'আনব্যান করা হয়েছে 🟢'}`);
  };

  // 5. TOGGLE ADMIN ROLE
  const handleToggleUserRole = () => { onToast('অ্যাডমিন অনুমতি শুধুই অনুমোদিত মালিকের জন্য।'); };

  // 6. CYCLE SVIP LEVEL
  const handleCycleSvip = async (target: any) => {
    const nextSvip = ((target.svip || 0) + 1) % 4;
    if (!await applyAdminState((prev: any) => {
      const list = (prev.userList || []).map((u: any) => {
        if (u.id === target.id) return { ...u, svip: nextSvip };
        return u;
      });
      return { ...prev, userList: list };
    })) return;
    onToast(`ইউজার [${target.name}] এর SVIP লেভেল ${nextSvip} এ সেট করা হয়েছে! 👑`);
  };

  // 7. DELETE USER
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে ইউজার [${userName}] কে তালিকা থেকে আর্কাইভ করতে চান?`)) return;
    if (!await applyAdminState((prev: any) => ({
      ...prev,
      userList: (prev.userList || []).filter((u: any) => u.id !== userId)
    }))) return;
    onToast(`ইউজার [${userName}] তালিকা থেকে আর্কাইভ করা হয়েছে!`);
  };

  // 8. CREATE VOICE ROOM
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !newRoomHost.trim()) {
      onToast('রুমের নাম ও হোস্টের নাম পূরণ করুন!');
      return;
    }
    const newRoom = {
      id: String(Math.floor(30000 + Math.random() * 69999)),
      name: newRoomName.trim(),
      host: newRoomHost.trim(),
      cv: newRoomCover,
      c: newRoomCategory,
      th: Math.floor(Math.random() * 6),
      d: 1,
      n: 1,
      flag: '🇧🇩',
      tag: newRoomTag,
      ann: newRoomAnn.trim()
    };

    if (!await applyAdminState((prev: any) => ({
      ...prev,
      rooms: [newRoom, ...(prev.rooms || [])]
    }))) return;

    setNewRoomName('');
    onToast(`নতুন ভয়েস রুম "${newRoom.name}" সফলভাবে লাইভ করা হয়েছে! 🎉`);
  };

  // 9. DELETE ROOM
  const handleDeleteRoom = async (roomId: string) => {
    if (!window.confirm('এই রুমটি কি মুছে ফেলতে চান?')) return;
    if (!await applyAdminState((prev: any) => ({
      ...prev,
      rooms: (prev.rooms || []).filter((r: any) => r.id !== roomId)
    }))) return;
    onToast('রুম সফলভাবে মুছে ফেলা হয়েছে!');
  };

  // 10. SAVE EDITED ROOM
  const handleSaveEditRoom = async () => {
    if (!editingRoom) return;
    if (!await applyAdminState((prev: any) => ({
      ...prev,
      rooms: (prev.rooms || []).map((r: any) => r.id === editingRoom.id ? editingRoom : r)
    }))) return;
    onToast(`রুম "${editingRoom.name}" এর তথ্য আপডেট হয়েছে! ✓`);
    setEditingRoom(null);
  };

  // 11. ADD NEW GIFT
  const handleAddGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGiftName.trim()) {
      onToast('গিফটের নাম পূরণ করুন!');
      return;
    }
    const p = parseInt(newGiftPrice, 10);
    if (!p || p <= 0) {
      onToast('সঠিক কয়েন মূল্য লিখুন!');
      return;
    }
    const giftObj = {
      id: `g_${Date.now()}`,
      name: newGiftName.trim(),
      icon: newGiftIcon,
      price: p,
      type: newGiftType
    };

    if (!await applyAdminState((prev: any) => ({
      ...prev,
      customGifts: [...(prev.customGifts || []), giftObj]
    }))) return;

    setNewGiftName('');
    setShowAddGiftModal(false);
    onToast(`নতুন গিফট [${giftObj.name} ${giftObj.icon}] (${p.toLocaleString()} 🪙) সফলভাবে যোগ হয়েছে! 🎁`);
  };

  // 12. DELETE GIFT
  const handleDeleteGift = async (giftId: string) => {
    if (!await applyAdminState((prev: any) => ({
      ...prev,
      customGifts: (prev.customGifts || []).filter((g: any) => g.id !== giftId)
    }))) return;
    onToast('গিফট মুছে ফেলা হয়েছে!');
  };

  // 13. EDIT GIFT PRICE
  const handleUpdateGiftPrice = async (giftId: string, newPrice: number) => {
    if (isNaN(newPrice) || newPrice <= 0) return;
    if (!await applyAdminState((prev: any) => ({
      ...prev,
      customGifts: (prev.customGifts || []).map((g: any) => g.id === giftId ? { ...g, price: newPrice } : g)
    }))) return;
    onToast('গিফটের মূল্য আপডেট করা হয়েছে ✓');
  };

  // 14. ADD RECHARGE PACKAGE
  const handleAddPackage = async () => {
    const c = parseInt(newPkgCoins, 10);
    const b = parseInt(newPkgBdt, 10);
    if (!c || !b) {
      onToast('সঠিক কয়েন এবং টাকার পরিমাণ লিখুন!');
      return;
    }
    if (!await applyAdminState((prev: any) => ({
      ...prev,
      pk: [...(prev.pk || []), { u: b, c: c }]
    }))) return;
    setNewPkgCoins('');
    setNewPkgBdt('');
    onToast(`নতুন কয়েন প্যাকেজ (${c.toLocaleString()} 🪙 = ৳${b}) যোগ হয়েছে!`);
  };

  // 15. DELETE PACKAGE
  const handleDeletePackage = async (idx: number) => {
    if (!await applyAdminState((prev: any) => ({
      ...prev,
      pk: (prev.pk || []).filter((_: any, i: number) => i !== idx)
    }))) return;
    onToast('কয়েন প্যাকেজ মুছে ফেলা হয়েছে!');
  };

  // 16. SAVE BANNER
  const handleSaveBanner = async () => {
    if (!bannerText.trim()) {
      onToast('ব্যানার টেক্সট খালি রাখা যাবে না!');
      return;
    }
    if (!await applyAdminState((prev: any) => ({
      ...prev,
      bn: {
        ...(prev.bn || {}),
        t: bannerText.trim()
      }
    }))) return;
    onToast('অ্যানাউন্সমেন্ট ব্যানার সফলভাবে সংরক্ষিত হয়েছে ✓');
  };

  // 17. SAVE BUSINESS SETTINGS
  const handleSaveBusinessSettings = async () => {
    const pct = parseInt(inviteRewardPct, 10) || 5;
    const wel = parseInt(welcomeCoins, 10) || 50000;
    if (!await applyAdminState((prev: any) => ({
      ...prev,
      invPct: pct,
      welcomeCoins: wel,
      supportPhone: supportPhone.trim()
    }))) return;
    onToast('ব্যবসা ও সিস্টেম সেটিংস সফলভাবে সংরক্ষিত হয়েছে ✓');
  };

  // Filtered Users List
  const filteredUsers = userList.filter(u => {
    const matchesSearch = !searchUser ||
      String(u.name || '').toLowerCase().includes(searchUser.toLowerCase()) || String(u.email || '').toLowerCase().includes(searchUser.toLowerCase()) || String(u.uid || '').includes(searchUser) ||
      String(u.id).includes(searchUser);

    if (!matchesSearch || u.status === 'archived') return false;
    if (userFilter === 'admin') return u.role === 'admin';
    if (userFilter === 'svip') return (u.svip || 0) > 0;
    if (userFilter === 'banned') return u.status === 'banned';
    return true;
  });

  const rechargeMatches = userList.filter(u => String(u.id) === rechargeId.trim());
  const rechargeUser = rechargeMatches.length === 1 ? rechargeMatches[0] : null;
  const previewAmount = Number(rechargeAmount);
  const validPreview = Number.isSafeInteger(previewAmount) && previewAmount > 0;

  return (
    <div className="space-y-3.5 text-xs pb-10">
      {/* 1. Header Banner & Live Status Bar */}
      <div className="p-4 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border-2 border-amber-400/50 rounded-2xl shadow-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-2xl shadow-lg border border-amber-300">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-black text-amber-300">Shakil Admin — সুপার অ্যাডমিন প্যানেল</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/40">
                  👑 যাচাইকৃত ওনার
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/40 animate-pulse">
                  লাইভ সিস্টেম
                </span>
              </div>
              <p className="text-[11px] text-gray-300">
                শাকিল অ্যাডমিন কন্ট্রোল — ইউজার, কয়েন, লাইভ রুম ও ব্যবসা নিয়ন্ত্রণ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 font-bold active:scale-95 text-xs flex items-center gap-1"
          >
            <span>ড্যাশবোর্ড বন্ধ</span>
            <X size={14} />
          </button>
        </div>

        {/* Live Metrics Quick Bar */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/10 text-center">
          <div className="bg-white/5 p-2 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-400 block">মোট ইউজার</span>
            <b className="text-cyan-300 text-xs">{userList.length} জন</b>
          </div>
          <div className="bg-white/5 p-2 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-400 block">একটিভ রুম</span>
            <b className="text-purple-300 text-xs">{roomsList.length} টি</b>
          </div>
          <div className="bg-white/5 p-2 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-400 block">আপনার ব্যালেন্স</span>
            <b className="text-amber-400 text-xs">🪙 {appState.coins?.toLocaleString()}</b>
          </div>
          <div className="bg-white/5 p-2 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-400 block">গিফট আইটেম</span>
            <b className="text-pink-300 text-xs">{giftsList.length} টি</b>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'users', label: '👥 ইউজার ও কয়েন', icon: Users },
          {
            id: 'requests',
            label: `📥 রিচার্জ অনুরোধ${pendingRequestsCount > 0 ? ` (${pendingRequestsCount})` : ''}`,
            icon: Coins,
            hasBadge: pendingRequestsCount > 0
          },
          { id: 'quick_boost', label: '👑 অ্যাডমিন ওয়ালেট বুস্ট', icon: Zap },
          { id: 'rooms', label: '🎙️ ভয়েস রুম', icon: Radio },
          { id: 'gifts', label: '🎁 গিফট শপ', icon: Gift },
          { id: 'packages', label: '🛍️ রিচার্জ প্যাকেজ', icon: ShoppingBag },
          { id: 'banner', label: '📢 নোটিশ ও ব্যানার', icon: Bell },
          { id: 'system', label: '⚙️ ব্যবসা ও সেটিংস', icon: Settings }
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all active:scale-95 text-[11px] relative ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-pink-600 text-white shadow-md border border-amber-300/40'
                  : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5'
              }`}
            >
              <Icon size={14} />
              {t.label}
              {t.hasBadge && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute top-1 right-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: USERS & COIN DISTRIBUTION (ইউজার ও কয়েন বিতরণ) */}
      {/* ======================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          <form className="gl p-4 space-y-3" onSubmit={async e => {
            e.preventDefault();
            const id = rechargeId.trim();
            setRechargeResult(null);
            if (!/^\d+$/.test(id)) { setRechargeResult({error:'ইউজারের সংখ্যার ID লিখুন।'}); return; }
            const matches = userList.filter(u => String(u.id) === id);
            if (matches.length !== 1) { setRechargeResult({error: matches.length ? 'এই ID একাধিক অ্যাকাউন্টে আছে। রিচার্জ বন্ধ রাখা হয়েছে।' : 'এই ID-তে নিবন্ধিত ইউজার পাওয়া যায়নি।'}); onToast(matches.length ? 'এই ID একাধিক অ্যাকাউন্টে আছে। রিচার্জ বন্ধ রাখা হয়েছে।' : 'এই ID-তে নিবন্ধিত ইউজার পাওয়া যায়নি।'); return; }
            const amount = Number(rechargeAmount);
            if (!Number.isSafeInteger(amount) || amount <= 0) { setRechargeResult({error:'সঠিক পূর্ণ কয়েন সংখ্যা লিখুন।'}); return; }
            const ok = await handleGiveCoinsToUser(matches[0], amount, 'add', 'ID দিয়ে অ্যাডমিন রিচার্জ');
            if (ok) setRechargeAmount('');
          }}>
            <h3 className="font-bold text-amber-300">⚡ শুধু ID দিয়ে কয়েন রিচার্জ</h3>
            <p className="text-gray-400">ইউজারের প্রোফাইলে দেখানো ID লিখুন। নাম লাগবে না।</p>
            <label className="block">ইউজার ID<input className="in w-full mt-1" inputMode="numeric" value={rechargeId} onChange={e => setRechargeId(e.target.value)} placeholder="ইউজারের ID নম্বর" required /></label>
            <label className="block">কয়েনের পরিমাণ<input className="in w-full mt-1" inputMode="numeric" value={rechargeAmount} onChange={e => setRechargeAmount(e.target.value)} placeholder="যেমন 100000" required /></label>
            {rechargeUser && <div className="rounded-xl border border-cyan-400/30 bg-cyan-950/30 p-3 space-y-2" aria-live="polite">
              <b className="block">{rechargeUser.name} · ID {rechargeUser.id}</b>
              <div className="flex justify-between"><span>এখন আছে</span><b>🪙 {Number(rechargeUser.coins || 0).toLocaleString()}</b></div>
              <div className="flex justify-between"><span>আপনি দিচ্ছেন</span><b className="text-amber-300">+ {validPreview ? previewAmount.toLocaleString() : '0'}</b></div>
              <div className="flex justify-between border-t border-white/10 pt-2"><span>রিচার্জের পর হবে</span><b className="text-green-300">🪙 {(Number(rechargeUser.coins || 0) + (validPreview ? previewAmount : 0)).toLocaleString()}</b></div>
            </div>}
            {rechargeId && !usersLoading && !rechargeUser && <p role="status" className="text-rose-300">{usersError || (rechargeMatches.length > 1 ? 'একই ID একাধিক অ্যাকাউন্টে আছে।' : 'এই ID-তে ইউজার পাওয়া যায়নি।')}</p>}
            <button type="submit" disabled={savingCoins || usersLoading || Boolean(usersError) || !rechargeUser || !validPreview} className="b g w-full disabled:opacity-50">{savingCoins ? 'সেভ হচ্ছে…' : '🪙 রিচার্জ দিন'}</button>
            {savingCoins && <p role="status" className="text-amber-300">রিচার্জ সেভ হচ্ছে… সফল বার্তা আসা পর্যন্ত অপেক্ষা করুন।</p>}
            {rechargeResult && <div role={rechargeResult.error ? 'alert' : 'status'} className={`rounded-xl border p-3 space-y-2 ${rechargeResult.error ? 'border-rose-400/40 bg-rose-950/40 text-rose-200' : 'border-green-400/40 bg-green-950/40 text-green-100'}`}>
              {rechargeResult.error ? <b>{rechargeResult.error}</b> : <>
                <b className="block text-green-300 text-sm">✅ সফল — ইউজারের অ্যাকাউন্টে কয়েন সেভ হয়েছে</b>
                <p>{rechargeResult.name} · ID {rechargeResult.id}</p>
                <p>আগে ছিল: 🪙 {rechargeResult.before.toLocaleString()}</p>
                <p>আপডেট: {rechargeResult.amount >= 0 ? '+' : ''}{rechargeResult.amount.toLocaleString()} কয়েন</p>
                <p className="font-bold">সেভ হওয়ার পর মোট: 🪙 {rechargeResult.after.toLocaleString()}</p>
                <p className="text-[10px] break-all opacity-75">লেনদেন ID: {rechargeResult.transactionId} · {rechargeResult.time}</p>
              </>}
            </div>}
          </form>
          {/* Top User Actions & Search Bar */}
          <div className="gl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-cyan-300 flex items-center gap-1.5">
                  <Users size={16} /> সকল ইউজার ম্যানেজমেন্ট ও কয়েন বিতরণ
                </h3>
                <p className="text-[11px] text-gray-300">
                  যেকোনো ইউজারকে কয়েন দিন, রোল পরিবর্তন, SVIP আপগ্রেড বা নতুন ইউজার যোগ করুন
                </p>
              </div>
              <button
                onClick={() => setShowAddUserModal(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-white text-[11px] shadow active:scale-95 flex items-center gap-1"
              >
                <PlusCircle size={14} />
                <span>নতুন ইউজার</span>
              </button>
            </div>

            {/* Search and Filters */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="নাম, ইমেইল অথবা ID দিয়ে খুঁজুন..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="in w-full pl-8 text-xs py-2"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              </div>
              <div className="flex gap-1">
                {(['all', 'admin', 'svip', 'banned'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setUserFilter(f)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                      userFilter === f
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                        : 'bg-white/5 text-gray-400 border-white/5'
                    }`}
                  >
                    {f === 'all' ? 'সকল' : f === 'admin' ? 'অ্যাডমিন' : f === 'svip' ? 'SVIP' : 'ব্যান'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Current Admin Account Card */}
          <div className="p-3 bg-gradient-to-r from-amber-950/40 via-purple-950/40 to-slate-900 border-2 border-amber-400/40 rounded-2xl flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-2xl">
                {appState.av}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <b className="text-white text-xs">{appState.name} (আপনার নিজস্ব অ্যাকাউন্ট)</b>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 text-[9px] font-black border border-amber-400/30">
                    👑 Root Admin
                  </span>
                </div>
                <p className="text-[10px] text-gray-400">ID: {appState.id} · দেশ: {appState.country}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="font-black text-amber-300 text-xs block">🪙 {appState.coins?.toLocaleString()}</span>
                <span className="text-[9px] text-purple-300">SVIP {appState.svip}</span>
              </div>
              <button
                onClick={() => {
                  void onUpdateCoins(50000, 'অ্যাডমিন কুইক বুস্ট').then(ok => { if(ok) onToast('আপনার অ্যাকাউন্টে ৫০,০০০ কয়েন সেভ হয়েছে! 🪙'); });
                }}
                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-[10px] active:scale-95 shadow"
              >
                +50K
              </button>
            </div>
          </div>

          {/* User List Directory */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                নিবন্ধিত ইউজার তালিকা ({filteredUsers.length} জন)
              </span>
              <span className="text-[10px] text-gray-400">যেকোনো ইউজারে ট্যাপ করে কয়েন প্রদান করুন</span>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="gl p-6 text-center text-gray-400">
                {usersLoading ? 'ইউজার তালিকা লোড হচ্ছে…' : usersError || 'কোনো নিবন্ধিত ইউজার পাওয়া যায়নি। ইউজারকে Google দিয়ে লগইন করতে বলুন।'}
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isBanned = u.status === 'banned';
                const isAdmin = u.role === 'admin';
                return (
                  <div
                    key={u.id}
                    className={`p-3 bg-black/40 border rounded-2xl space-y-2 transition-all ${
                      isBanned
                        ? 'border-rose-500/30 bg-rose-950/20'
                        : isAdmin
                        ? 'border-amber-400/40 bg-purple-950/20'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* User Info Line */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl p-1 bg-white/5 rounded-xl">{u.av}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <b className="text-white text-xs">{u.name}</b>
                            {isAdmin && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-400/30">
                                অ্যাডমিন
                              </span>
                            )}
                            {(u.svip || 0) > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold">
                                SVIP {u.svip}
                              </span>
                            )}
                            {isBanned && (
                              <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold">
                                🚫 সাসপেন্ডেড
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400">
                            ID: {u.id} {u.badge ? `· ${u.badge}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Balances */}
                      <div className="text-right">
                        <span className="font-black text-amber-300 text-xs block">
                          🪙 {(u.coins || 0).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-cyan-300 font-bold">
                          💎 {(u.diamond || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Action Bar for this user */}
                    <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-1.5">
                      {/* Quick Coin Buttons */}
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 font-bold mr-0.5">কয়েন:</span>
                        {[10000, 50000, 100000].map(amt => (
                          <button
                            key={amt}
                            onClick={() => handleGiveCoinsToUser(u, amt, 'add', 'অ্যাডমিন কুইক রিওয়ার্ড')}
                            className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 font-bold text-[10px] border border-amber-500/30 active:scale-95"
                          >
                            +{(amt / 1000)}K
                          </button>
                        ))}
                        <button
                          onClick={() => handleGiveCoinsToUser(u, 10000, 'deduct', 'অ্যাডমিন কর্তন')}
                          className="px-2 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 font-bold text-[10px] border border-rose-500/30 active:scale-95"
                        >
                          -10K
                        </button>
                        <button
                          onClick={() => {
                            setCoinModalUser(u);
                            setCustomCoinAmount('50000');
                          }}
                          className="px-2 py-0.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 font-bold text-[10px] border border-purple-500/30 active:scale-95"
                        >
                          কাস্টম
                        </button>
                      </div>

                      {/* Management Controls */}
                      <div className="flex items-center gap-1">
                        {/* SVIP Toggle */}
                        <button
                          onClick={() => handleCycleSvip(u)}
                          className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-purple-300 text-[10px] font-bold border border-white/5 active:scale-95"
                          title="SVIP লেভেল পরিবর্তন করুন"
                        >
                          👑 SVIP {u.svip || 0}
                        </button>

                        {/* Admin Toggle */}
                        <button
                          onClick={handleToggleUserRole}
                          className={`p-1 rounded-lg text-[10px] font-bold border active:scale-95 ${
                            isAdmin
                              ? 'bg-amber-500/30 text-amber-300 border-amber-400/40'
                              : 'bg-white/5 text-gray-400 border-white/5'
                          }`}
                          title="অ্যাডমিন ভূমিকা টগল করুন"
                        >
                          🛡️
                        </button>

                        {/* Ban / Unban */}
                        <button
                          onClick={() => handleToggleUserBan(u)}
                          className={`p-1 rounded-lg text-[10px] font-bold border active:scale-95 ${
                            isBanned
                              ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}
                          title={isBanned ? 'আনব্যান করুন' : 'ব্যান করুন'}
                        >
                          {isBanned ? <UserCheck size={12} /> : <UserX size={12} />}
                        </button>

                        {/* Edit details */}
                        <button
                          onClick={() => setEditingUser({ ...u })}
                          className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-300 border border-white/5 active:scale-95"
                          title="তথ্য এডিট করুন"
                        >
                          <Edit3 size={12} />
                        </button>

                        {/* Delete user */}
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="p-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 active:scale-95"
                          title="ইউজার মুছুন"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB: RECHARGE REQUESTS & PERMISSION CONTROL (রিচার্জ অনুরোধ ও অনুমোদন) */}
      {/* ======================================================== */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          {/* Header & Policy Notice */}
          <div className="gl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-rose-600 flex items-center justify-center text-xl shadow">
                  📥
                </div>
                <div>
                  <h3 className="font-bold text-sm text-amber-300">ইউজার রিচার্জ অনুরোধ ও অনুমোদন সেন্টার</h3>
                  <p className="text-[11px] text-gray-300">
                    সাধারণ ইউজারদের সেলফ-কয়েন নেওয়ার পারমিশন বন্ধ আছে। শুধুমাত্র আপনার অনুমোদনেই কয়েন যোগ হবে।
                  </p>
                </div>
              </div>
            </div>

            {/* Security Explanation Card */}
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-[11px] text-emerald-200">
              <span className="text-xl">🛡️</span>
              <div className="leading-relaxed">
                <b>সিকিউরিটি প্রোটেকশন চালু আছে:</b> ওয়ালেটে ব্যবহারকারীরা সরাসরি কোনো কয়েন যোগ করতে পারবে না। তারা প্যাকেজে ক্লিক করে আবেদন করলে এখানে জমা হবে। আপনি [অনুমোদন করুন] চাপলে স্বয়ংক্রিয়ভাবে ব্যবহারকারীর অ্যাকাউন্টে কয়েন পৌঁছে যাবে।
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1.5 pt-1 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'all', label: `সকল (${rechargeRequests.length})` },
                { id: 'pending', label: `পেন্ডিং (${pendingRequestsCount})`, isAlert: pendingRequestsCount > 0 },
                { id: 'approved', label: `অনুমোদিত (${rechargeRequests.filter((r: any) => r.status === 'approved').length})` },
                { id: 'rejected', label: `বাতিল (${rechargeRequests.filter((r: any) => r.status === 'rejected').length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setReqFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all active:scale-95 ${
                    reqFilter === f.id
                      ? 'bg-amber-400 text-slate-950 shadow-md'
                      : f.isAlert
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Request List */}
          <div className="space-y-2.5">
            {rechargeRequests
              .filter((r: any) => {
                if (reqFilter === 'all') return true;
                return r.status === reqFilter;
              })
              .length === 0 ? (
              <div className="gl p-8 text-center text-gray-400">
                <span className="text-3xl block mb-2">✨</span>
                <b className="text-xs text-gray-300">কোনো রিচার্জ অনুরোধ পাওয়া যায়নি!</b>
                <p className="text-[11px] text-gray-400 mt-1">
                  ইউজাররা ওয়ালেটে রিকোয়েস্ট সাবমিট করলে এই তালিকায় প্রদর্শিত হবে।
                </p>
              </div>
            ) : (
              rechargeRequests
                .filter((r: any) => {
                  if (reqFilter === 'all') return true;
                  return r.status === reqFilter;
                })
                .map((req: any) => {
                  const isPending = req.status === 'pending';
                  const isApproved = req.status === 'approved';
                  const isRejected = req.status === 'rejected';

                  return (
                    <div
                      key={req.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isPending
                          ? 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-950/20'
                          : isApproved
                          ? 'bg-emerald-950/15 border-emerald-500/30'
                          : 'bg-rose-950/15 border-rose-500/25 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{req.userAv || '🧑'}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <b className="text-xs text-white">{req.userName}</b>
                              <span className="px-1.5 py-0.5 rounded bg-white/10 text-amber-300 font-mono text-[10px] font-bold">
                                ID: SM{req.userId}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400">
                              সময়: {req.createdAt || 'অজানা'} {req.date ? `· ${req.date}` : ''}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isPending && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/40 animate-pulse">
                              ⏳ পেন্ডিং
                            </span>
                          )}
                          {isApproved && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/40">
                              ✓ অনুমোদিত ({req.approvedAt || 'অনুমোদিত'})
                            </span>
                          )}
                          {isRejected && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold text-[10px] border border-rose-500/40">
                              ✕ বাতিল
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Package Info */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🪙</span>
                          <div>
                            <span className="text-[10px] text-gray-400 block">অনুরোধকৃত কয়েন:</span>
                            <b className="text-sm font-black text-amber-300">
                              {Number(req.coins).toLocaleString()} কয়েন
                            </b>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 block">প্যাকেজ মূল্য:</span>
                          <b className="text-xs font-bold text-emerald-400">
                            ${req.price} USD (~৳{req.price * 120} BDT)
                          </b>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        {isPending ? (
                          <>
                            <button
                              onClick={() => handleApproveRequest(req)}
                              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 font-bold text-slate-950 text-xs active:scale-95 shadow-md flex items-center justify-center gap-1.5"
                            >
                              <CheckCircle size={14} />
                              <span>অনুমোদন করুন ও কয়েন দিন</span>
                            </button>
                            <button
                              onClick={() => handleRejectRequest(req)}
                              className="px-3.5 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white font-bold text-xs active:scale-95 border border-rose-500/30"
                            >
                              বাতিল
                            </button>
                          </>
                        ) : (
                          <div className="text-[11px] text-gray-400 flex items-center gap-1">
                            <span>এই অনুরোধটি সম্পন্ন হয়েছে।</span>
                          </div>
                        )}

                        <button
                          onClick={() => handleDeleteRequest(req.id)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-rose-300"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: ADMIN WALLET BOOST (অ্যাডমিন ওয়ালেট বুস্ট) */}
      {/* ======================================================== */}
      {activeTab === 'quick_boost' && (
        <div className="gl p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-3xl shadow-xl border border-amber-300">
              ⚡
            </div>
            <div>
              <h3 className="font-bold text-sm text-amber-300">অ্যাডমিন ইনস্ট্যান্ট ওয়ালেট বুস্ট</h3>
              <p className="text-[11px] text-gray-300">
                এক ক্লিকে আপনার নিজস্ব অ্যাকাউন্টে কয়েন, ডায়মন্ড ও সর্বোচ্চ প্রিভিলেজ যুক্ত করুন
              </p>
            </div>
          </div>

          {/* Current Admin Card */}
          <div className="p-3 bg-black/40 border border-amber-400/30 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-3xl">{appState.av}</span>
              <div>
                <b className="text-white text-xs block">{appState.name} (আপনি)</b>
                <span className="text-[10px] text-amber-300 font-bold">আইডি: {appState.id} · SVIP {appState.svip}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 block">বর্তমান ব্যালেন্স</span>
              <b className="text-sm font-black text-amber-400">🪙 {appState.coins?.toLocaleString()}</b>
            </div>
          </div>

          {/* 1-Click Coin Boost Buttons */}
          <div className="space-y-2">
            <b className="text-xs text-gray-200 block">কুইক কয়েন ইনজেক্টর বাটন (এক ক্লিকে যোগ করুন):</b>
            <div className="grid grid-cols-3 gap-2">
              {[
                { amt: 10000, label: '+10,000' },
                { amt: 50000, label: '+50,000' },
                { amt: 100000, label: '+1,00,000' },
                { amt: 500000, label: '+5,00,000' },
                { amt: 1000000, label: '+১০ লাখ (1M)' },
                { amt: 10000000, label: '+১ কোটি (10M)' },
              ].map(item => (
                <button
                  key={item.amt}
                  onClick={() => {
                    void onUpdateCoins(item.amt, 'অ্যাডমিন ইনস্ট্যান্ট বুস্ট').then(ok => { if(ok) onToast(`${item.label} কয়েন সেভ হয়েছে! 🪙`); });
                  }}
                  className="p-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500 hover:to-orange-500 hover:text-slate-950 border border-amber-400/40 rounded-xl font-black text-amber-300 text-xs shadow transition-all active:scale-95 text-center"
                >
                  🪙 {item.label}
                </button>
              ))}
            </div>

            {/* Unlimited Coins Button */}
            <button
              onClick={() => {
                void onUpdateCoins(99999999 - appState.coins, 'অ্যাডমিন ব্যালেন্স সেট').then(ok => { if (ok) onToast('ব্যালেন্স সেভ হয়েছে ✓'); });
              }}
              className="w-full py-2.5 bg-gradient-to-r from-amber-400 via-orange-500 to-pink-600 rounded-xl font-black text-slate-950 text-xs shadow-lg active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Crown size={15} /> আনলিমিটেড কয়েন মোড সেট করুন (৯৯,৯৯৯,৯৯৯ 🪙)
            </button>
          </div>

          {/* Set Exact Balance Form */}
          <div className="p-3 bg-black/30 border border-white/10 rounded-xl space-y-2">
            <b className="text-xs text-gray-200 block">সরাসরি নির্দিষ্ট কয়েন সংখ্যা সেট করুন:</b>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="যেমন: 250000"
                value={exactAdminCoins}
                onChange={(e) => setExactAdminCoins(e.target.value)}
                className="in flex-1 text-xs"
              />
              <button
                onClick={() => {
                  const val = parseInt(exactAdminCoins, 10);
                  if (isNaN(val) || val < 0) {
                    onToast('সঠিক সংখ্যা লিখুন!');
                    return;
                  }
                  void onUpdateCoins(val - appState.coins, 'অ্যাডমিন ব্যালেন্স সেট').then(ok => { if (ok) { onToast('ব্যালেন্স সেভ হয়েছে ✓'); setExactAdminCoins(''); } });
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs active:scale-95"
              >
                সেট করুন
              </button>
            </div>
          </div>

          {/* Admin Royal Perks Unlock */}
          <div className="p-3 bg-black/30 border border-white/10 rounded-xl space-y-2">
            <b className="text-xs text-purple-300 block">রাজকীয় প্রিভিলেজ ও ব্যাজ আনলক:</b>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onUpdateAppState((prev: any) => ({ ...prev, svip: 5 }));
                  onToast('সর্বোচ্চ SVIP 5 এক্টিভ করা হয়েছে! 👑');
                }}
                className="p-2 rounded-xl bg-purple-500/20 border border-purple-400/40 text-purple-200 font-bold text-[11px] active:scale-95"
              >
                👑 SVIP 5 সক্রিয় করুন
              </button>
              <button
                onClick={() => {
                  onUpdateAppState((prev: any) => ({
                    ...prev,
                    ownF: Array.from({ length: 18 }, (_, i) => i),
                    ownE: Array.from({ length: 15 }, (_, i) => i),
                  }));
                  onToast('সমস্ত ১৮টি ফ্রেম এবং ১৫টি এন্ট্রি আনলক হয়েছে! 🚪');
                }}
                className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-bold text-[11px] active:scale-95"
              >
                🖼️ সকল ফ্রেম ও এন্ট্রি আনলক
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: VOICE ROOM MANAGEMENT (ভয়েস রুম কন্ট্রোল) */}
      {/* ======================================================== */}
      {activeTab === 'rooms' && (
        <div className="space-y-3">
          {/* Create Room Form */}
          <div className="gl p-4 space-y-3">
            <h3 className="font-bold text-sm text-purple-300 flex items-center gap-1.5">
              <PlusCircle size={16} /> নতুন ভয়েস রুম তৈরি ও লাইভ পাবলিশ
            </h3>
            <p className="text-[11px] text-gray-300">
              নতুন রুম যোগ করলে তা তাৎক্ষণিকভাবে হোম এবং এক্সপ্লোর ট্যাবে লাইভ দেখা যাবে
            </p>

            <form onSubmit={handleCreateRoom} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">রুমের নাম:</label>
                  <input
                    type="text"
                    placeholder="যেমন: পদ্মা মেঘনা আড্ডা"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="in w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">হোস্টের নাম:</label>
                  <input
                    type="text"
                    placeholder="যেমন: শাকিল (অ্যাডমিন)"
                    value={newRoomHost}
                    onChange={(e) => setNewRoomHost(e.target.value)}
                    className="in w-full text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">ক্যাটাগরি:</label>
                  <select
                    value={newRoomCategory}
                    onChange={(e) => setNewRoomCategory(e.target.value)}
                    className="in w-full bg-slate-900 text-xs"
                  >
                    <option value="আড্ডা">আড্ডা</option>
                    <option value="পার্টি">পার্টি</option>
                    <option value="গেম">গেম</option>
                    <option value="নতুন">নতুন</option>
                    <option value="ইভেন্ট">ইভেন্ট</option>
                    <option value="গান">গান ও গজল</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">কভার ইমোজি:</label>
                  <select
                    value={newRoomCover}
                    onChange={(e) => setNewRoomCover(e.target.value)}
                    className="in w-full bg-slate-900 text-sm"
                  >
                    {['🎤', '🎶', '🎮', '💬', '🌙', '💞', '🔥', '👑', '🌟', '🎧', '🦁', '🌹'].map(em => (
                      <option key={em} value={em}>{em}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 font-bold mb-1">ট্যাগ:</label>
                  <input
                    type="text"
                    placeholder="Official / VIP"
                    value={newRoomTag}
                    onChange={(e) => setNewRoomTag(e.target.value)}
                    className="in w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-bold mb-1">অ্যানাউন্সমেন্ট / নোটিশ:</label>
                <input
                  type="text"
                  placeholder="রুমে সবাইকে স্বাগতম! নিয়ম মেনে আড্ডা দিন..."
                  value={newRoomAnn}
                  onChange={(e) => setNewRoomAnn(e.target.value)}
                  className="in w-full text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 font-black text-white text-xs shadow active:scale-95 flex items-center justify-center gap-1.5"
              >
                <PlusCircle size={15} /> রুম লাইভ পাবলিশ করুন
              </button>
            </form>
          </div>

          {/* Current Rooms List */}
          <div className="gl p-4 space-y-2">
            <h4 className="font-bold text-xs text-white">চলতি সমস্ত ভয়েস রুম ({roomsList.length} টি)</h4>
            <div className="space-y-2">
              {roomsList.map((r: any) => (
                <div key={r.id} className="p-2.5 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl p-1 bg-white/5 rounded-lg">{r.cv}</span>
                    <div>
                      <b className="text-white text-xs block">{r.name}</b>
                      <p className="text-[10px] text-gray-400">
                        হোস্ট: {r.host} · {r.c} · ID: {r.id} · ট্যাগ: {r.tag}
                      </p>
                      {r.ann && <p className="text-[9px] text-cyan-300 truncate max-w-[200px]">📢 {r.ann}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditingRoom({ ...r })}
                      className="p-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 active:scale-95"
                      title="রুম এডিট করুন"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteRoom(r.id)}
                      className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 active:scale-95"
                      title="রুম ডিলিট করুন"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: GIFTS MANAGEMENT (গিফট শপ কন্ট্রোল) */}
      {/* ======================================================== */}
      {activeTab === 'gifts' && (
        <div className="gl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-pink-300 flex items-center gap-1.5">
                <Gift size={16} /> রুম গিফট শপ ও অ্যানিমেশন কন্ট্রোল
              </h3>
              <p className="text-[11px] text-gray-300">
                ভয়েস রুমের ভেতরে ইউজাররা যে গিফটগুলো পাঠাতে পারে তা এখান থেকে তৈরি ও মূল্য নির্ধারণ করুন
              </p>
            </div>
            <button
              onClick={() => setShowAddGiftModal(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 font-bold text-white text-[11px] shadow active:scale-95 flex items-center gap-1"
            >
              <PlusCircle size={14} /> নতুন গিফট
            </button>
          </div>

          {/* Existing Gifts Grid */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            {giftsList.map((g: any) => (
              <div key={g.id} className="p-2.5 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{g.icon}</span>
                  <div>
                    <b className="text-white text-xs block">{g.name}</b>
                    <span className="text-[10px] text-amber-300 font-black">🪙 {g.price?.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const p = prompt(`"${g.name}" এর নতুন কয়েন মূল্য দিন:`, String(g.price));
                      if (p) handleUpdateGiftPrice(g.id, parseInt(p, 10));
                    }}
                    className="p-1 rounded bg-white/10 text-cyan-300 hover:text-white"
                    title="মূল্য পরিবর্তন"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button
                    onClick={() => handleDeleteGift(g.id)}
                    className="p-1 rounded bg-rose-600/30 text-rose-300 hover:text-white"
                    title="গিফট মুছুন"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: STORE RECHARGE PACKAGES (শপ ও রিচার্জ প্যাকেজ) */}
      {/* ======================================================== */}
      {activeTab === 'packages' && (
        <div className="gl p-4 space-y-3">
          <h3 className="font-bold text-sm text-amber-300 flex items-center gap-1.5">
            <ShoppingBag size={16} /> শপ ও কয়েন রিচার্জ প্যাকেজ
          </h3>
          <p className="text-[11px] text-gray-300">
            ওয়ালেট পেজে প্রদর্শিত কয়েন প্যাকেজসমূহ যোগ ও সম্পাদনা করুন
          </p>

          {/* Add Package */}
          <div className="bg-black/30 p-3 rounded-xl border border-white/10 space-y-2.5">
            <b className="text-white text-xs block">নতুন রিচার্জ প্যাকেজ যুক্ত করুন:</b>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-300 font-bold mb-1">কয়েন সংখ্যা:</label>
                <input
                  type="number"
                  placeholder="যেমন: 500000"
                  value={newPkgCoins}
                  onChange={(e) => setNewPkgCoins(e.target.value)}
                  className="in w-full text-xs"
                />
              </div>
              <div>
                <label className="block text-gray-300 font-bold mb-1">মূল্য (টাকা / BDT):</label>
                <input
                  type="number"
                  placeholder="যেমন: 350"
                  value={newPkgBdt}
                  onChange={(e) => setNewPkgBdt(e.target.value)}
                  className="in w-full text-xs"
                />
              </div>
            </div>
            <button
              onClick={handleAddPackage}
              className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl font-bold text-slate-950 text-xs active:scale-95"
            >
              ➕ প্যাকেজ যোগ করুন
            </button>
          </div>

          {/* Existing Packages */}
          <div className="space-y-2 pt-2">
            <b className="text-gray-300 text-[11px] block">বর্তমান অ্যাক্টিভ প্যাকেজ তালিকা ({packagesList.length} টি):</b>
            <div className="grid grid-cols-2 gap-2">
              {packagesList.map((pkg: any, idx: number) => (
                <div key={idx} className="p-2.5 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-black text-amber-300 text-xs block">🪙 {pkg.c?.toLocaleString()}</span>
                    <span className="text-[11px] text-emerald-400 font-bold">৳ {pkg.u} BDT</span>
                  </div>
                  <button
                    onClick={() => handleDeletePackage(idx)}
                    className="p-1.5 rounded-lg bg-rose-600/30 text-rose-300 hover:text-white"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: NOTICE & BANNER (নোটিশ ও ব্যানার) */}
      {/* ======================================================== */}
      {activeTab === 'banner' && (
        <div className="gl p-4 space-y-3">
          <h3 className="font-bold text-sm text-cyan-300 flex items-center gap-1.5">
            <Bell size={16} /> নোটিশ, ব্যানার ও অ্যানাউন্সমেন্ট
          </h3>
          <p className="text-[11px] text-gray-300">
            হোম পেজের শীর্ষে স্ক্রল হওয়া প্রধান নোটিশটি সরাসরি লাইভ পরিবর্তন করুন
          </p>

          <textarea
            value={bannerText}
            onChange={(e) => setBannerText(e.target.value)}
            rows={3}
            className="in w-full text-xs"
            placeholder="ব্যানার টেক্সট লিখুন..."
          />

          <button
            onClick={handleSaveBanner}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 font-black text-slate-950 text-xs active:scale-95"
          >
            ✓ ব্যানার আপডেট করুন
          </button>

          {/* Quick Announcement Broadcast */}
          <div className="p-3 bg-black/30 border border-white/10 rounded-xl space-y-2 mt-3">
            <b className="text-xs text-amber-300 block">ইন-অ্যাপ পপআপ ব্রডকাস্ট বার্তা:</b>
            <button
              onClick={() => {
                const msg = prompt('সকল ইউজারের জন্য ব্রডকাস্ট নোটিশ লিখুন:');
                if (msg) {
                  onToast(`📢 ব্রডকাস্ট প্রেরিত: ${msg}`);
                }
              }}
              className="w-full py-2 rounded-xl bg-purple-600/30 border border-purple-400/40 text-purple-200 font-bold text-xs active:scale-95"
            >
              📣 গ্লোবাল নোটিফিকেশন সেন্ড করুন
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 7: SYSTEM & BUSINESS SETTINGS (ব্যবসা ও সেটিংস) */}
      {/* ======================================================== */}
      {activeTab === 'system' && (
        <div className="gl p-4 space-y-3">
          <h3 className="font-bold text-sm text-amber-300 flex items-center gap-1.5">
            <Settings size={16} /> প্ল্যাটফর্ম ব্যবসা ও সিস্টেম সেটিংস
          </h3>
          <p className="text-[11px] text-gray-300">
            রেফারেল কমিশন, ওয়েলকাম রিওয়ার্ড ও হেল্পলাইন
          </p>

          <div className="space-y-3 bg-black/30 p-3 rounded-xl border border-white/10">
            <div>
              <label className="block text-gray-300 font-bold mb-1">
                ইনভাইট ফ্রেন্ডস কমিশন পার্সেন্টেজ (%):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={inviteRewardPct}
                  onChange={(e) => setInviteRewardPct(e.target.value)}
                  className="in w-28 text-xs"
                />
                <span className="text-gray-400 text-xs">% রিচার্জ বোনাস রিওয়ার্ড</span>
              </div>
            </div>

            <div>
              <label className="block text-gray-300 font-bold mb-1">
                নতুন ইউজারদের ওয়েলকাম উপহার কয়েন:
              </label>
              <input
                type="number"
                value={welcomeCoins}
                onChange={(e) => setWelcomeCoins(e.target.value)}
                className="in w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-bold mb-1">
                কাস্টমার সাপোর্ট যোগাযোগ (WhatsApp / Phone):
              </label>
              <input
                type="text"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                className="in w-full text-xs"
              />
            </div>


            <button
              onClick={handleSaveBusinessSettings}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 font-black text-slate-950 text-xs active:scale-95 shadow"
            >
              ✓ সেটিংস সংরক্ষণ করুন
            </button>
          </div>

          {/* Reset App Data */}
          <div className="pt-2 border-t border-white/10">
            <h4 className="font-bold text-xs text-rose-400 mb-1">ডেটা ফ্যাক্টরি রিসেট:</h4>
            <p className="text-[10px] text-gray-400 mb-2">
              অ্যাপের সমস্ত কাস্টম ডেটা রিসেট করে মূল অবস্থায় ফিরিয়ে আনে
            </p>
            <button
              onClick={() => {
                if (window.confirm('আপনি কি নিশ্চিত যে সমস্ত লোকাল ডেটা রিসেট করতে চান?')) {
                  localStorage.removeItem('sv3');
                  window.location.reload();
                }
              }}
              className="w-full py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 text-xs font-bold active:scale-95"
            >
              ⚠️ সম্পূর্ণ ডেটা রিসেট করুন
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD NEW USER MODAL */}
      {/* ======================================================== */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-gradient-to-b from-indigo-950 to-slate-950 border-2 border-cyan-400/50 rounded-3xl p-5 text-white shadow-2xl space-y-3">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="font-black text-sm text-cyan-300 flex items-center gap-1.5">
                <PlusCircle size={16} /> নতুন ইউজার প্রোফাইল তৈরি করুন
              </h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-gray-400 hover:text-white text-base">✕</button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">ইউজার নাম:</label>
                <input
                  type="text"
                  placeholder="যেমন: তানিয়া আহমেদ"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="in w-full text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1">কাস্টম আইডি (ঐচ্ছিক):</label>
                  <input
                    type="text"
                    placeholder="অটো জেনারেট হবে"
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    className="in w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1">অবতার ইমোজি:</label>
                  <select
                    value={newUserAv}
                    onChange={(e) => setNewUserAv(e.target.value)}
                    className="in w-full bg-slate-900 text-sm"
                  >
                    {['🧑', '👩', '🧔', '🧕', '👨‍🦱', '👧', '🦁', '👑', '😎', '😇'].map(em => (
                      <option key={em} value={em}>{em}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1">শুরুর কয়েন:</label>
                  <input
                    type="number"
                    value={newUserCoins}
                    onChange={(e) => setNewUserCoins(e.target.value)}
                    className="in w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1">শুরুর ডায়মন্ড:</label>
                  <input
                    type="number"
                    value={newUserDiamonds}
                    onChange={(e) => setNewUserDiamonds(e.target.value)}
                    className="in w-full text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1">SVIP লেভেল:</label>
                  <select
                    value={newUserSvip}
                    onChange={(e) => setNewUserSvip(parseInt(e.target.value, 10))}
                    className="in w-full bg-slate-900 text-xs"
                  >
                    {[0, 1, 2, 3].map(lv => (
                      <option key={lv} value={lv}>SVIP {lv}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1">ভূমিকা / রোল:</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className="in w-full bg-slate-900 text-xs"
                  >
                    <option value="user">সাধারণ ইউজার</option>
                    <option value="admin">অ্যাডমিন</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-white text-xs shadow active:scale-95"
              >
                ✓ ইউজার যুক্ত করুন
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CUSTOM COIN INJECTION MODAL */}
      {/* ======================================================== */}
      {coinModalUser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-gradient-to-b from-indigo-950 to-slate-950 border-2 border-amber-400/50 rounded-3xl p-5 text-white shadow-2xl space-y-3">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="font-black text-sm text-amber-300 flex items-center gap-1.5">
                <Coins size={16} /> [{coinModalUser.name}] কে কয়েন প্রদান
              </h3>
              <button onClick={() => setCoinModalUser(null)} className="text-gray-400 hover:text-white text-base">✕</button>
            </div>

            <div className="p-2.5 bg-black/40 rounded-xl border border-white/10 flex items-center justify-between">
              <span className="text-gray-300">বর্তমান ব্যালেন্স:</span>
              <b className="text-amber-400 text-xs">🪙 {(coinModalUser.coins || 0).toLocaleString()}</b>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">কয়েন সংখ্যা:</label>
                <input
                  type="number"
                  placeholder="যেমন: 50000"
                  value={customCoinAmount}
                  onChange={(e) => setCustomCoinAmount(e.target.value)}
                  className="in w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">অ্যাকশন টাইপ:</label>
                <select
                  value={customCoinAction}
                  onChange={(e) => setCustomCoinAction(e.target.value as any)}
                  className="in w-full bg-slate-900 text-xs"
                >
                  <option value="add">➕ ব্যালেন্সে যোগ করুন (+)</option>
                  <option value="deduct">➖ ব্যালেন্স থেকে কর্তন (-)</option>
                  <option value="set">🎯 সরাসরি ব্যালেন্স সেট করুন (=)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">নোট / কারণ:</label>
                <input
                  type="text"
                  value={customCoinReason}
                  onChange={(e) => setCustomCoinReason(e.target.value)}
                  className="in w-full text-xs"
                />
              </div>

              <button
                onClick={() => {
                  const amt = Number(customCoinAmount);
                  if (!Number.isSafeInteger(amt) || amt < 0 || (customCoinAction !== 'set' && amt === 0)) {
                    onToast('সঠিক কয়েন সংখ্যা দিন!');
                    return;
                  }
                  void handleGiveCoinsToUser(coinModalUser, amt, customCoinAction, customCoinReason).then(ok => { if (ok) setCoinModalUser(null); });
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 font-black text-slate-950 text-xs active:scale-95 shadow"
              >
                {savingCoins ? 'সেভ হচ্ছে…' : '✓ কয়েন রিচার্জ / আপডেট করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: ADD NEW GIFT MODAL */}
      {/* ======================================================== */}
      {showAddGiftModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-gradient-to-b from-indigo-950 to-slate-950 border-2 border-pink-400/50 rounded-3xl p-5 text-white shadow-2xl space-y-3">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="font-black text-sm text-pink-300 flex items-center gap-1.5">
                <Gift size={16} /> নতুন গিফট যুক্ত করুন
              </h3>
              <button onClick={() => setShowAddGiftModal(false)} className="text-gray-400 hover:text-white text-base">✕</button>
            </div>

            <form onSubmit={handleAddGift} className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">গিফটের নাম:</label>
                <input
                  type="text"
                  placeholder="যেমন: সোনার গোলাপ"
                  value={newGiftName}
                  onChange={(e) => setNewGiftName(e.target.value)}
                  className="in w-full text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1">গিফট ইমোজি:</label>
                  <select
                    value={newGiftIcon}
                    onChange={(e) => setNewGiftIcon(e.target.value)}
                    className="in w-full bg-slate-900 text-sm"
                  >
                    {['🌹', '❤️', '💎', '🚗', '👑', '🚀', '🦁', '🏰', '🏎️', '💍', '🎂', '⭐', '🕊️', '💐'].map(em => (
                      <option key={em} value={em}>{em}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1">কয়েন মূল্য:</label>
                  <input
                    type="number"
                    placeholder="যেমন: 500"
                    value={newGiftPrice}
                    onChange={(e) => setNewGiftPrice(e.target.value)}
                    className="in w-full text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">ক্যাটাগরি:</label>
                <select
                  value={newGiftType}
                  onChange={(e) => setNewGiftType(e.target.value)}
                  className="in w-full bg-slate-900 text-xs"
                >
                  <option value="romantic">রোমান্টিক ও ভালোবাসা</option>
                  <option value="luxury">লাক্সারি ও গাড়ি</option>
                  <option value="royal">রাজকীয় মুকুট</option>
                  <option value="epic">সুপার এপিক ও রকেট</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 font-bold text-white text-xs shadow active:scale-95"
              >
                ✓ গিফট যোগ করুন
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: EDIT USER MODAL */}
      {/* ======================================================== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-gradient-to-b from-indigo-950 to-slate-950 border-2 border-cyan-400/50 rounded-3xl p-5 text-white shadow-2xl space-y-3">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="font-black text-sm text-cyan-300">
                ইউজার [{editingUser.name}] এর তথ্য সম্পাদনা
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white text-base">✕</button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">নাম:</label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="in w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1">কয়েন ব্যালেন্স:</label>
                  <input
                    type="number"
                    value={editingUser.coins}
                    onChange={(e) => setEditingUser({ ...editingUser, coins: parseInt(e.target.value, 10) || 0 })}
                    className="in w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1">ডায়মন্ড:</label>
                  <input
                    type="number"
                    disabled title="ডায়মন্ড সার্ভার এখনো সক্রিয় নয়" value={editingUser.diamond || 0}
                    onChange={(e) => setEditingUser({ ...editingUser, diamond: parseInt(e.target.value, 10) || 0 })}
                    className="in w-full text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1">SVIP লেভেল:</label>
                  <select
                    value={editingUser.svip || 0}
                    onChange={(e) => setEditingUser({ ...editingUser, svip: parseInt(e.target.value, 10) })}
                    className="in w-full bg-slate-900 text-xs"
                  >
                    {[0, 1, 2, 3].map(lv => (
                      <option key={lv} value={lv}>SVIP {lv}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1">ভূমিকা / রোল:</label>
                  <select
                    disabled title="অ্যাডমিন অনুমতি মালিকের জন্য নির্দিষ্ট" value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="in w-full bg-slate-900 text-xs"
                  >
                    <option value="user">সাধারণ ইউজার</option>
                    <option value="admin">অ্যাডমিন</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleSaveEditUser}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-white text-xs shadow active:scale-95"
              >
                ✓ পরিবর্তন সংরক্ষণ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: EDIT ROOM MODAL */}
      {/* ======================================================== */}
      {editingRoom && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-gradient-to-b from-indigo-950 to-slate-950 border-2 border-purple-400/50 rounded-3xl p-5 text-white shadow-2xl space-y-3">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="font-black text-sm text-purple-300">
                ভয়েস রুম [{editingRoom.name}] সম্পাদনা
              </h3>
              <button onClick={() => setEditingRoom(null)} className="text-gray-400 hover:text-white text-base">✕</button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">রুমের নাম:</label>
                <input
                  type="text"
                  value={editingRoom.name}
                  onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                  className="in w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">হোস্টের নাম:</label>
                <input
                  type="text"
                  value={editingRoom.host}
                  onChange={(e) => setEditingRoom({ ...editingRoom, host: e.target.value })}
                  className="in w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">ট্যাগ:</label>
                <input
                  type="text"
                  value={editingRoom.tag || ''}
                  onChange={(e) => setEditingRoom({ ...editingRoom, tag: e.target.value })}
                  className="in w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-300 mb-1">অ্যানাউন্সমেন্ট / নোটিশ:</label>
                <input
                  type="text"
                  value={editingRoom.ann || ''}
                  onChange={(e) => setEditingRoom({ ...editingRoom, ann: e.target.value })}
                  className="in w-full text-xs"
                />
              </div>

              <button
                onClick={handleSaveEditRoom}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 font-bold text-white text-xs shadow active:scale-95"
              >
                ✓ রুম সংরক্ষণ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
