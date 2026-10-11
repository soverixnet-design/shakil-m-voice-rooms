import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, HelpCircle, Trophy, History, Play, Pause, X } from 'lucide-react';

interface Props {
  userCoins: number;
  userName: string;
  userAvatar: string;
  onUpdateCoins: (newCoins: number, note: string) => void;
  onClose: () => void;
}

const F: [string, number][] = [
  ['🍋', 5], ['🍇', 5], ['🥝', 5], ['🍒', 40],
  ['⏱️', 0], // Center placeholder
  ['🍑', 5], ['🍉', 20], ['🍌', 10], ['🍓', 10]
];
const RING = [0, 1, 2, 5, 8, 7, 6, 3];
const CHIPS = [1000, 10000, 50000, 100000];

export const JackpotFruitGame: React.FC<Props> = ({
  userCoins,
  userName,
  userAvatar,
  onUpdateCoins,
  onClose
}) => {
  const [chip, setChip] = useState(CHIPS[0]);
  const [bets, setBets] = useState<number[]>(Array(9).fill(0));
  const [t, setT] = useState(20);
  const [phase, setPhase] = useState<'bet' | 'spin' | 'result'>('bet');
  const [round, setRound] = useState(1500);
  const [todayWin, setTodayWin] = useState(0);
  const [jackpot, setJackpot] = useState(21817399);
  const [soundOn, setSoundOn] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<number | null>(null);
  const [bonusReels, setBonusReels] = useState<string[]>(['+1', '+2', 'x2']);
  const [highlightBonusIdx, setHighlightBonusIdx] = useState<number | null>(null);
  const [resultModal, setResultModal] = useState<{
    show: boolean;
    results: number[];
    bonus: string;
    win: number;
    cost: number;
  } | null>(null);
  const [historyList, setHistoryList] = useState<{ round: number; fruits: string; cost: number; win: number }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [msg, setMsg] = useState('');

  const lastBetsRef = useRef<number[]>(Array(9).fill(0));
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = (freq: number, duration: number) => {
    if (!soundOn) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  };

  const showToast = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 2200);
  };

  const handleBet = (index: number) => {
    if (index === 4) return; // center
    if (phase !== 'bet') {
      showToast('বেট বন্ধ, অপেক্ষা করুন');
      return;
    }
    if (userCoins < chip) {
      showToast('কয়েন যথেষ্ট নয়!');
      return;
    }

    const nextCoins = userCoins - chip;
    onUpdateCoins(nextCoins, `জ্যাকপট ফ্রুট বেট (${F[index][0]})`);
    setBets(prev => {
      const copy = [...prev];
      copy[index] += chip;
      lastBetsRef.current = copy;
      return copy;
    });
    setJackpot(j => j + chip * 0.05);
    playBeep(520, 0.06);
  };

  const pickWinningFruit = () => {
    const weights = RING.map(i => 1 / F[i][1]);
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let k = 0; k < RING.length; k++) {
      r -= weights[k];
      if (r < 0) return RING[k];
    }
    return RING[0];
  };

  const getBonus = () => {
    const r = Math.random();
    if (r < 0.90) return '';
    if (r < 0.94) return '+1';
    if (r < 0.96) return '+2';
    if (r < 0.985) return 'x2';
    if (r < 0.995) return 'x3';
    return 'JP';
  };

  const startSpin = () => {
    setPhase('spin');
    const cost = bets.reduce((a, b) => a + b, 0);
    const primaryWin = pickWinningFruit();
    const bonus = getBonus();

    let pos = Math.floor(Math.random() * 8);
    const targetSteps = 24 + ((RING.indexOf(primaryWin) - pos + 8) % 8);
    let stepsLeft = targetSteps;

    const interval = setInterval(() => {
      setActiveHighlight(RING[pos % 8]);
      playBeep(320, 0.03);
      pos++;
      stepsLeft--;
      if (stepsLeft <= 0) {
        clearInterval(interval);
        // reel animation
        let reelCount = 0;
        const reelInterval = setInterval(() => {
          setHighlightBonusIdx(reelCount % 3);
          reelCount++;
          if (reelCount > 10) {
            clearInterval(reelInterval);
            let bIdx = null;
            if (bonus === '+1') bIdx = 0;
            else if (bonus === '+2') bIdx = 1;
            else if (bonus === 'x2' || bonus === 'x3') {
              bIdx = 2;
              setBonusReels(['+1', '+2', bonus]);
            } else if (bonus === 'JP') bIdx = 99; // all

            setHighlightBonusIdx(bIdx);
            finalizeResult(primaryWin, bonus, cost);
          }
        }, 110);
      }
    }, 90);
  };

  const finalizeResult = (res: number, bonus: string, cost: number) => {
    setPhase('result');
    const winners = [res];
    if (bonus === '+1') winners.push(pickWinningFruit());
    if (bonus === '+2') winners.push(pickWinningFruit(), pickWinningFruit());

    const multiplier = bonus === 'x2' ? 2 : bonus === 'x3' ? 3 : 1;
    let earned = 0;
    winners.forEach(r => {
      earned += (bets[r] || 0) * F[r][1];
    });
    earned = Math.floor(earned * multiplier);

    if (bonus === 'JP' && cost >= 1000) {
      const jpShare = cost >= 1000000 ? 0.7 : cost >= 100000 ? 0.5 : cost >= 10000 ? 0.3 : 0.1;
      const jpWon = Math.floor(jackpot * jpShare);
      earned += jpWon;
      setJackpot(j => Math.max(1000000, j - jpWon));
    }

    if (earned > 0) {
      playBeep(880, 0.3);
      onUpdateCoins(userCoins + earned, `জ্যাকপট ফ্রুট জয় (+${earned.toLocaleString()})`);
      setTodayWin(tw => tw + earned);
    }

    setResultModal({
      show: true,
      results: winners,
      bonus,
      win: earned,
      cost
    });

    setHistoryList(prev => [
      {
        round,
        fruits: winners.map(i => F[i][0]).join(' '),
        cost,
        win: earned
      },
      ...prev.slice(0, 30)
    ]);

    setRound(r => r + 1);

    setTimeout(() => {
      setResultModal(null);
      setActiveHighlight(null);
      setHighlightBonusIdx(null);
      setBonusReels(['+1', '+2', 'x2']);
      setPhase('bet');
      setT(20);

      if (autoPlay && lastBetsRef.current.some(x => x > 0)) {
        // rebet automatically
        let needed = 0;
        lastBetsRef.current.forEach(v => needed += v);
        if (userCoins >= needed) {
          onUpdateCoins(userCoins - needed, 'জ্যাকপট ফ্রুট অটো বেট');
          setBets([...lastBetsRef.current]);
        } else {
          setAutoPlay(false);
          setBets(Array(9).fill(0));
        }
      } else {
        setBets(Array(9).fill(0));
      }
    }, 4000);
  };

  // Timer loop
  useEffect(() => {
    const timer = setInterval(() => {
      setJackpot(j => j + Math.floor(Math.random() * 20));
      if (phase === 'bet') {
        setT(curr => {
          if (curr <= 1) {
            startSpin();
            return 0;
          }
          if (curr <= 5) playBeep(660, 0.05);
          return curr - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, bets, userCoins]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-[#18092e] text-white select-none overflow-y-auto pb-8 pt-safe">
      <div className="w-full max-w-[440px] px-3 py-2 flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold text-lg active:scale-95">
              ✕
            </button>
            <button onClick={() => setSoundOn(!soundOn)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center active:scale-95">
              {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <span className="text-xs text-emerald-400 font-mono bg-black/40 px-2 py-1 rounded-md">📶 85ms</span>
          </div>

          <div className="text-center">
            <span className="text-xs text-purple-200">রাউন্ড: <b className="text-amber-400">{round}</b></span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowRules(true)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-300 active:scale-95">
              <HelpCircle size={18} />
            </button>
            <button onClick={() => setShowRanking(true)} className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center active:scale-95">
              <Trophy size={18} />
            </button>
          </div>
        </div>

        {/* Jackpot Header */}
        <div className="text-center mt-2">
          <h1 className="text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-amber-300 to-amber-600 drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]">
            JACKPOT
          </h1>
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-950 via-purple-900 to-purple-950 px-5 py-1 rounded-xl border-2 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] mt-1">
            <span className="text-amber-400 text-lg">🪙</span>
            <span className="text-2xl font-black text-amber-300 tracking-wider">
              {Math.floor(jackpot).toLocaleString()}
            </span>
            <span className="text-amber-400 text-lg">🪙</span>
          </div>
        </div>

        {/* 3 Bonus Slots indicator */}
        <div className="flex justify-center gap-2 my-3">
          <div className={`flex-1 py-1 px-3 text-center rounded-lg font-black text-sm border-2 transition-all ${
            highlightBonusIdx === 0 || highlightBonusIdx === 99
              ? 'bg-amber-400 text-black border-yellow-200 shadow-[0_0_15px_#f59e0b] scale-105'
              : 'bg-indigo-950/80 text-amber-300 border-indigo-700/60'
          }`}>
            {bonusReels[0]}
          </div>
          <div className={`flex-1 py-1 px-3 text-center rounded-lg font-black text-sm border-2 transition-all ${
            highlightBonusIdx === 1 || highlightBonusIdx === 99
              ? 'bg-amber-400 text-black border-yellow-200 shadow-[0_0_15px_#f59e0b] scale-105'
              : 'bg-indigo-950/80 text-amber-300 border-indigo-700/60'
          }`}>
            {bonusReels[1]}
          </div>
          <div className={`flex-1 py-1 px-3 text-center rounded-lg font-black text-sm border-2 transition-all ${
            highlightBonusIdx === 2 || highlightBonusIdx === 99
              ? 'bg-amber-400 text-black border-yellow-200 shadow-[0_0_15px_#f59e0b] scale-105'
              : 'bg-indigo-950/80 text-amber-300 border-indigo-700/60'
          }`}>
            {bonusReels[2]}
          </div>
        </div>

        {/* 3x3 Game Grid */}
        <div className="bg-gradient-to-b from-[#6b47c7] to-[#3a207c] p-3 rounded-2xl border-4 border-indigo-500/40 shadow-2xl">
          <div className="grid grid-cols-3 gap-2">
            {F.map((item, idx) => {
              if (idx === 4) {
                // Center countdown
                return (
                  <div
                    key={idx}
                    className="aspect-[1.1] rounded-xl bg-gradient-to-b from-rose-950 to-red-950 border-2 border-red-500/60 flex flex-col items-center justify-center shadow-inner"
                  >
                    <span className="text-3xl font-mono font-black text-amber-400 drop-shadow">
                      {phase === 'bet' ? String(t).padStart(2, '0') : '🎰'}
                    </span>
                    <span className="text-[10px] font-bold text-red-200 uppercase tracking-wider">
                      {phase === 'bet' ? 'বেট করুন' : phase === 'spin' ? 'ঘুরছে...' : 'ফলাফল'}
                    </span>
                  </div>
                );
              }

              const isHighlighted = activeHighlight === idx;
              const currentBet = bets[idx] || 0;

              return (
                <button
                  key={idx}
                  onClick={() => handleBet(idx)}
                  className={`relative aspect-[1.1] rounded-xl flex flex-col items-center justify-center transition-transform active:scale-95 border-2 ${
                    isHighlighted
                      ? 'bg-gradient-to-b from-blue-500 to-indigo-700 border-white shadow-[0_0_25px_#60a5fa] scale-105 z-10'
                      : idx === 3 || idx >= 6
                      ? 'bg-gradient-to-b from-[#5c2bb8] to-[#371675] border-purple-400/40 shadow-md'
                      : 'bg-gradient-to-b from-[#1b6a65] to-[#0e3b3e] border-teal-400/40 shadow-md'
                  }`}
                >
                  <span className="text-4xl drop-shadow-md select-none">{item[0]}</span>
                  <span className="text-xs font-black text-amber-300 drop-shadow">x{item[1]}</span>
                  {currentBet > 0 && (
                    <span className="absolute -top-2 -right-1 bg-red-600 text-white font-extrabold text-[10px] px-1.5 py-0.5 rounded-full border border-white shadow">
                      {currentBet >= 1000 ? `${(currentBet / 1000).toFixed(0)}K` : currentBet}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Message toast */}
        <div className="h-6 text-center text-sm font-bold text-amber-300 mt-2">
          {msg}
        </div>

        {/* Chip Selection */}
        <div className="flex gap-2 my-2">
          {CHIPS.map((c, i) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              className={`flex-1 py-2 rounded-xl font-black text-xs transition-all active:scale-95 border-2 ${
                chip === c
                  ? 'bg-gradient-to-b from-red-500 to-rose-700 border-yellow-300 shadow-[0_0_12px_rgba(244,63,94,0.6)] scale-105'
                  : 'bg-gradient-to-b from-blue-900 to-indigo-950 border-blue-600/50 text-blue-200'
              }`}
            >
              {['🔵', '🟡', '🟠', '🟣'][i]} {c >= 1000 ? `${c / 1000}K` : c}
            </button>
          ))}
        </div>

        {/* Bottom bar: Balance, Today Win, Auto, History */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="bg-indigo-950/80 border border-indigo-700/50 rounded-xl p-2 text-center">
            <span className="text-[10px] text-purple-300 font-semibold block">আপনার ব্যালেন্স</span>
            <span className="text-sm font-black text-amber-400">🪙 {userCoins.toLocaleString()}</span>
          </div>
          <div className="bg-indigo-950/80 border border-indigo-700/50 rounded-xl p-2 text-center">
            <span className="text-[10px] text-purple-300 font-semibold block">আজকের জয়</span>
            <span className="text-sm font-black text-emerald-400">🪙 {todayWin.toLocaleString()}</span>
          </div>
          <button
            onClick={() => setAutoPlay(!autoPlay)}
            className={`rounded-xl font-black text-sm flex items-center justify-center gap-1 border-2 transition-all active:scale-95 ${
              autoPlay
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 border-white text-white shadow-[0_0_15px_#22c55e]'
                : 'bg-gradient-to-r from-purple-800 to-indigo-900 border-purple-500/50 text-purple-200'
            }`}
          >
            {autoPlay ? <Pause size={16} /> : <Play size={16} />}
            {autoPlay ? 'অটো চালু' : 'অটো প্লে'}
          </button>
        </div>

        {/* Quick History Button */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="flex-1 py-2 bg-white/10 hover:bg-white/15 rounded-xl font-bold text-xs flex items-center justify-center gap-1 active:scale-95"
          >
            <History size={15} /> 📜 হিস্ট্রি
          </button>
        </div>
      </div>

      {/* Result Modal */}
      {resultModal?.show && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-gradient-to-b from-indigo-900 to-purple-950 border-3 border-amber-400 rounded-3xl p-5 text-center shadow-[0_0_40px_rgba(245,158,11,0.5)]">
            <h3 className="text-amber-400 font-black text-lg mb-2">রাউন্ড {round - 1} এর ফলাফল</h3>
            <div className="text-5xl my-3 flex justify-center gap-2">
              {resultModal.results.map((r, i) => (
                <span key={i} className="animate-bounce">{F[r][0]}</span>
              ))}
            </div>
            {resultModal.bonus && (
              <div className="text-sm font-extrabold text-amber-300 mb-2">
                🎁 বোনাস: {resultModal.bonus === 'JP' ? 'JACKPOT 🎉' : resultModal.bonus}
              </div>
            )}
            <div className="bg-black/40 rounded-xl p-3 my-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-purple-200">এই রাউন্ডের খরচ:</span>
                <span className="font-bold text-white">🪙 {resultModal.cost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-200">এই রাউন্ডের জয়:</span>
                <span className="font-extrabold text-emerald-400">🪙 {resultModal.win.toLocaleString()}</span>
              </div>
            </div>
            <p className="text-xs text-purple-300">পরের রাউন্ড শুরু হচ্ছে...</p>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-indigo-950 border-2 border-indigo-500 rounded-2xl p-4 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-black text-amber-400 text-lg">📜 আমার হিস্ট্রি</h3>
              <button onClick={() => setShowHistory(false)} className="text-white text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 text-xs">
              {historyList.length === 0 ? (
                <p className="text-center text-purple-300 py-8">এখনও কোনো রাউন্ড খেলা হয়নি</p>
              ) : (
                historyList.map((h, i) => (
                  <div key={i} className="flex justify-between items-center bg-black/30 p-2 rounded-lg">
                    <span>রাউন্ড {h.round}</span>
                    <span className="text-base">{h.fruits}</span>
                    <span>খরচ: {h.cost.toLocaleString()}</span>
                    <span className={`font-bold ${h.win > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {h.win > 0 ? `+${h.win.toLocaleString()}` : '0'}
                    </span>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="mt-3 w-full py-2 bg-amber-500 text-black font-extrabold rounded-xl"
            >
              ঠিক আছে
            </button>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-indigo-950 border-2 border-indigo-500 rounded-2xl p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-black text-amber-400 text-lg">📖 খেলার নিয়ম</h3>
              <button onClick={() => setShowRules(false)} className="text-white text-xl">✕</button>
            </div>
            <div className="text-xs space-y-2 text-purple-100 leading-relaxed">
              <p>১. চিপ বেছে নিয়ে ফলের ঘরে ট্যাপ করে বেট ধরুন। ২০ সেকেন্ড পর ফল ঠিক হবে।</p>
              <p>২. যে ফল আসবে তাতে বেট ধরা থাকলে <b>বেট × গুণক</b> কয়েন পাবেন।</p>
              <p>৩. স্লট বোনাস: <b>+1 / +2</b> (অতিরিক্ত ফল), <b>x2 / x3</b> (জয় দ্বিগুণ বা তিনগুণ), অথবা <b>JACKPOT</b>।</p>
              <p>৪. জ্যাকপট পুল প্রতি বেটে ৫% করে বাড়ে। JACKPOT ড্রপ হলে পুলের একাংশ আপনার ওয়ালেটে যোগ হয়।</p>
              <p className="text-amber-300 font-bold">গুণক তালিকা: 🍒 x40, 🍉 x20, 🍌 x10, 🍓 x10, 🍋 🍇 🥝 🍑 x5।</p>
            </div>
            <button
              onClick={() => setShowRules(false)}
              className="mt-4 w-full py-2 bg-amber-500 text-black font-extrabold rounded-xl"
            >
              বুঝেছি
            </button>
          </div>
        </div>
      )}

      {/* Ranking Modal */}
      {showRanking && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-indigo-950 border-2 border-indigo-500 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-black text-amber-400 text-lg">🏆 আজকের র‍্যাঙ্কিং</h3>
              <button onClick={() => setShowRanking(false)} className="text-white text-xl">✕</button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-3 bg-amber-500/20 p-2 rounded-xl border border-amber-500/40">
                <span className="text-xl">🥇</span>
                <span className="font-extrabold flex-1">{userName} (আপনি)</span>
                <span className="font-mono font-black text-amber-300">🪙 {todayWin.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-3 bg-black/30 p-2 rounded-xl">
                <span className="text-xl">🥈</span>
                <span className="font-bold flex-1">রাফি</span>
                <span className="font-mono font-bold text-gray-300">🪙 850,000</span>
              </div>
              <div className="flex items-center gap-3 bg-black/30 p-2 rounded-xl">
                <span className="text-xl">🥉</span>
                <span className="font-bold flex-1">নুসরাত</span>
                <span className="font-mono font-bold text-gray-300">🪙 620,000</span>
              </div>
            </div>
            <button
              onClick={() => setShowRanking(false)}
              className="mt-4 w-full py-2 bg-amber-500 text-black font-extrabold rounded-xl"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
