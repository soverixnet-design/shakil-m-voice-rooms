import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, HelpCircle, Trophy, History, Play, Pause } from 'lucide-react';

interface Props {
  userCoins: number;
  userName: string;
  userAvatar: string;
  onUpdateCoins: (newCoins: number, note: string) => void;
  onClose: () => void;
}

const ITEMS: [string, number][] = [
  ['🍗', 45],
  ['🐙', 25],
  ['🐟', 15],
  ['🥩', 10],
  ['🍇', 5],
  ['🥬', 5],
  ['🌽', 5],
  ['🍓', 5],
];

const CHIPS = [1000, 10000, 100000, 1000000];

export const LionFoodWheelGame: React.FC<Props> = ({
  userCoins,
  userName,
  userAvatar,
  onUpdateCoins,
  onClose,
}) => {
  const [chip, setChip] = useState(CHIPS[0]);
  const [bets, setBets] = useState<number[]>(Array(10).fill(0)); // 0-7: foods, 8: salad, 9: pizza
  const [t, setT] = useState(20);
  const [phase, setPhase] = useState<'bet' | 'spin' | 'result'>('bet');
  const [round, setRound] = useState(1280);
  const [todayWin, setTodayWin] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const [historyList, setHistoryList] = useState<number[]>([]);
  const [showWinModal, setShowWinModal] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [msg, setMsg] = useState('');

  const lastBetsRef = useRef<number[]>(Array(10).fill(0));
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = (freq: number, dur: number) => {
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
      osc.stop(ctx.currentTime + dur);
    } catch (_) {}
  };

  const showToast = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 2200);
  };

  const handleBet = (idx: number) => {
    if (phase !== 'bet') {
      showToast('বেট বন্ধ, অপেক্ষা করুন');
      return;
    }
    if (userCoins < chip) {
      showToast('কয়েন যথেষ্ট নয়!');
      return;
    }

    const next = userCoins - chip;
    const label = idx === 8 ? 'সালাদ' : idx === 9 ? 'পিজা' : ITEMS[idx][0];
    onUpdateCoins(next, `সিংহ ফুড হুইল বেট (${label})`);
    setBets(prev => {
      const copy = [...prev];
      copy[idx] += chip;
      lastBetsRef.current = copy;
      return copy;
    });
    playBeep(520, 0.06);
  };

  const pickWinner = () => {
    const weights = ITEMS.map(x => 1 / x[1]);
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < 8; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return 7;
  };

  const startSpin = () => {
    setPhase('spin');
    const winningIndex = pickWinner();
    let pos = Math.floor(Math.random() * 8);
    let stepsLeft = 24 + ((winningIndex - pos + 8) % 8);

    const interval = setInterval(() => {
      setHighlightIdx(pos % 8);
      playBeep(300, 0.03);
      pos++;
      stepsLeft--;
      if (stepsLeft <= 0) {
        clearInterval(interval);
        finalizeResult(winningIndex);
      }
    }, 90);
  };

  const finalizeResult = (winningIdx: number) => {
    setPhase('result');
    setHighlightIdx(winningIdx);

    const foodMult = ITEMS[winningIdx][1];
    let earned = (bets[winningIdx] || 0) * foodMult;

    // Salad win check: food multiplier is 5
    if (foodMult === 5 && bets[8] > 0) {
      earned += Math.floor(bets[8] * 1.2);
    }
    // Pizza win check: food multiplier >= 10
    if (foodMult >= 10 && bets[9] > 0) {
      earned += Math.floor(bets[9] * 4);
    }

    setHistoryList(prev => [winningIdx, ...prev.slice(0, 10)]);

    if (earned > 0) {
      playBeep(880, 0.4);
      setShowWinModal(earned);
      onUpdateCoins(userCoins + earned, `সিংহ ফুড হুইল জয় (+${earned.toLocaleString()})`);
      setTodayWin(tw => tw + earned);
    } else {
      showToast(bets.some(x => x > 0) ? 'এবার হারলেন 😅' : `ফলাফল: ${ITEMS[winningIdx][0]}`);
    }

    setRound(r => r + 1);

    setTimeout(() => {
      setShowWinModal(null);
      setHighlightIdx(null);
      setPhase('bet');
      setT(20);

      if (autoPlay && lastBetsRef.current.some(x => x > 0)) {
        let needed = lastBetsRef.current.reduce((a, b) => a + b, 0);
        if (userCoins >= needed) {
          onUpdateCoins(userCoins - needed, 'সিংহ ফুড হুইল অটো বেট');
          setBets([...lastBetsRef.current]);
        } else {
          setAutoPlay(false);
          setBets(Array(10).fill(0));
        }
      } else {
        setBets(Array(10).fill(0));
      }
    }, 3200);
  };

  // Timer loop
  useEffect(() => {
    const timer = setInterval(() => {
      if (phase === 'bet') {
        setT(curr => {
          if (curr <= 1) {
            startSpin();
            return 0;
          }
          if (curr <= 5) playBeep(660, 0.08);
          return curr - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, bets, userCoins]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-gradient-to-b from-[#15799e] via-[#0d4f6d] to-[#072435] text-white select-none overflow-y-auto pb-8 pt-safe">
      <div className="w-full max-w-[440px] px-3 py-2 flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/20">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-black/30 hover:bg-black/50 flex items-center justify-center font-bold text-lg active:scale-95">
              ✕
            </button>
            <button onClick={() => setSoundOn(!soundOn)} className="w-9 h-9 rounded-xl bg-black/30 flex items-center justify-center active:scale-95">
              {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>

          <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-amber-400/50">
            <span className="text-amber-400 font-bold">🪙 {userCoins.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-black/40 px-2 py-1 rounded-md font-mono text-cyan-200">
              রাউন্ড {round}
            </span>
            <button onClick={() => setShowRules(true)} className="w-8 h-8 rounded-lg bg-black/30 text-amber-300 flex items-center justify-center active:scale-95">
              <HelpCircle size={16} />
            </button>
          </div>
        </div>

        {/* Game Title */}
        <div className="text-center my-1">
          <h2 className="text-2xl font-black text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
            🦁 সিংহ ফুড হুইল
          </h2>
        </div>

        {/* 3D Wheel Area */}
        <div className="relative w-full aspect-square max-w-[360px] mx-auto my-2 flex items-center justify-center">
          {/* Wheel Background Circle */}
          <div className="absolute inset-4 rounded-full border-4 border-amber-500/40 bg-gradient-to-br from-amber-900/30 via-slate-900/50 to-amber-950/40 shadow-[0_0_30px_rgba(245,158,11,0.2)]"></div>

          {/* Center Hub */}
          <div className="relative z-20 w-28 h-28 rounded-full bg-gradient-to-b from-amber-400 to-amber-700 border-4 border-white shadow-[0_0_20px_#f59e0b] flex flex-col items-center justify-center text-center">
            <span className="text-2xl">🦁</span>
            <span className="text-[10px] font-black uppercase text-amber-950 tracking-wider">
              {phase === 'bet' ? 'সময়' : 'ঘুরছে'}
            </span>
            <span className="text-2xl font-black text-white drop-shadow">
              {phase === 'bet' ? t : '🎡'}
            </span>
          </div>

          {/* 8 Food items on perimeter */}
          {ITEMS.map((item, idx) => {
            const angle = (idx * 45 - 90) * (Math.PI / 180);
            const radius = 40; // % distance from center
            const x = 50 + radius * Math.cos(angle);
            const y = 50 + radius * Math.sin(angle);
            const isHl = highlightIdx === idx;
            const betAmt = bets[idx] || 0;

            return (
              <button
                key={idx}
                onClick={() => handleBet(idx)}
                style={{ left: `${x}%`, top: `${y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-2xl flex flex-col items-center justify-center border-2 transition-all active:scale-95 z-10 ${
                  isHl
                    ? 'bg-amber-300 text-black border-white shadow-[0_0_25px_#fde047] scale-110 z-30'
                    : 'bg-gradient-to-b from-[#fff2d1] to-[#deb076] text-black border-amber-800 shadow-lg'
                }`}
              >
                <span className="text-2xl drop-shadow select-none">{item[0]}</span>
                <span className="text-[11px] font-black text-amber-950">x{item[1]}</span>
                {betAmt > 0 && (
                  <span className="absolute -bottom-2 bg-red-600 text-white font-black text-[9px] px-1 rounded-full border border-white">
                    {betAmt >= 1000 ? `${betAmt / 1000}K` : betAmt}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Side Bets (Salad & Pizza) */}
        <div className="flex gap-2 justify-center my-1">
          <button
            onClick={() => handleBet(8)}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-700 border-2 border-emerald-300 font-black text-xs flex items-center justify-between shadow active:scale-95"
          >
            <span>🥗 সালাদ (x5 ফল)</span>
            <span className="bg-black/40 px-2 py-0.5 rounded text-amber-300">
              x1.2 {bets[8] > 0 ? `(${bets[8] >= 1000 ? bets[8] / 1000 + 'K' : bets[8]})` : ''}
            </span>
          </button>
          <button
            onClick={() => handleBet(9)}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-700 border-2 border-amber-300 font-black text-xs flex items-center justify-between shadow active:scale-95"
          >
            <span>🍕 পিজা (x10+ ফল)</span>
            <span className="bg-black/40 px-2 py-0.5 rounded text-amber-300">
              x4 {bets[9] > 0 ? `(${bets[9] >= 1000 ? bets[9] / 1000 + 'K' : bets[9]})` : ''}
            </span>
          </button>
        </div>

        {/* Message toast */}
        <div className="h-5 text-center text-xs font-bold text-amber-300">
          {msg}
        </div>

        {/* History Row */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-full my-1 justify-center min-h-[38px]">
          <span className="text-xs font-bold text-cyan-200 px-2">হিস্ট্রি:</span>
          {historyList.map((idx, i) => (
            <span key={i} className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-sm shadow">
              {ITEMS[idx][0]}
            </span>
          ))}
        </div>

        {/* Chips */}
        <div className="flex gap-2 my-2">
          {CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              className={`flex-1 py-2 rounded-xl font-black text-xs transition-all active:scale-95 border-2 ${
                chip === c
                  ? 'bg-amber-400 text-black border-white shadow-[0_0_12px_#f59e0b] scale-105'
                  : 'bg-black/30 border-white/20 text-white'
              }`}
            >
              🪙 {c >= 1000 ? `${c / 1000}K` : c}
            </button>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="grid grid-cols-3 gap-2 mt-1">
          <div className="bg-black/40 rounded-xl p-2 text-center border border-white/10">
            <span className="text-[10px] text-cyan-300 block">আজকের জয়</span>
            <span className="text-sm font-black text-amber-400">🪙 {todayWin.toLocaleString()}</span>
          </div>
          <button
            onClick={() => setAutoPlay(!autoPlay)}
            className={`rounded-xl font-black text-xs flex items-center justify-center gap-1 border-2 transition-all active:scale-95 ${
              autoPlay
                ? 'bg-emerald-600 border-white text-white'
                : 'bg-black/40 border-white/20 text-white'
            }`}
          >
            {autoPlay ? <Pause size={14} /> : <Play size={14} />}
            {autoPlay ? 'অটো চালু' : 'অটো প্লে'}
          </button>
          <button
            onClick={() => setShowRules(true)}
            className="bg-black/40 rounded-xl p-2 font-bold text-xs border border-white/10 text-amber-300 active:scale-95 flex items-center justify-center gap-1"
          >
            <HelpCircle size={14} /> নিয়ম
          </button>
        </div>
      </div>

      {/* Win Modal */}
      {showWinModal !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-gradient-to-b from-amber-500 to-amber-700 border-4 border-white rounded-3xl p-5 text-center text-amber-950 shadow-[0_0_40px_#f59e0b]">
            <div className="w-16 h-16 rounded-full bg-white mx-auto flex items-center justify-center text-3xl shadow-inner mb-2">
              🎉
            </div>
            <h3 className="font-black text-lg text-white drop-shadow">অভিনন্দন!</h3>
            <p className="text-sm font-bold text-amber-100">{userName}</p>
            <div className="text-3xl font-black text-white drop-shadow my-2">
              +🪙 {showWinModal.toLocaleString()}
            </div>
            <p className="text-xs text-amber-100">কয়েন আপনার ওয়ালেটে যোগ হয়েছে</p>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-400 rounded-2xl p-4 max-h-[80vh] overflow-y-auto text-xs leading-relaxed space-y-2">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-amber-400 font-black text-base">🦁 খেলার নিয়ম</h3>
              <button onClick={() => setShowRules(false)} className="text-white text-lg">✕</button>
            </div>
            <p>১. চিপ বেছে নিয়ে খাবারের ঘরে ট্যাপ করে বেট ধরুন। একাধিক ঘরেও ধরা যায়।</p>
            <p>২. ২০ সেকেন্ড পর চাকা ঘোরে ও একটি খাবার ঠিক হয়।</p>
            <p>৩. সেই খাবারে বেট থাকলে বেট × গুণক কয়েন পাবেন।</p>
            <p>৪. <b>🥗 সালাদ:</b> যেকোনো x5 খাবার এলে x1.2 গুণক পাবেন।</p>
            <p>৫. <b>🍕 পিজা:</b> x10 বা বেশি গুণকের খাবার এলে x4 গুণক পাবেন।</p>
            <button
              onClick={() => setShowRules(false)}
              className="w-full mt-3 py-2 bg-amber-400 text-black font-extrabold rounded-xl"
            >
              বুঝেছি
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
