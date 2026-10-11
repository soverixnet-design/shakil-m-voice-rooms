import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, HelpCircle, Zap, Play, Pause, Minus, Plus } from 'lucide-react';

interface Props {
  userCoins: number;
  userName: string;
  userAvatar: string;
  onUpdateCoins: (newCoins: number, note: string) => void;
  onClose: () => void;
}

const BETS = [100, 500, 1000, 5000, 10000, 50000, 100000];
const SYMBOLS = ['7', 'B3', 'B2', 'B1', 'BL', 'GR', 'OR', 'CH'];
const WEIGHTS: Record<string, number> = {
  '7': 2, 'B3': 3, 'B2': 4, 'B1': 6, 'BL': 10, 'GR': 22, 'OR': 34, 'CH': 50
};
const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

const PAY3: Record<string, number> = {
  '7': 70, 'B3': 20, 'B2': 15, 'B1': 12, 'BL': 10, 'GR': 7, 'OR': 6, 'CH': 5
};
const PAY2: Record<string, number> = {
  '7': 6, 'B3': 5, 'B2': 4, 'B1': 3.5, 'BL': 3, 'GR': 3, 'OR': 3, 'CH': 2.5
};
const MIX_BAR = 4.5;

export const SlotsGame: React.FC<Props> = ({
  userCoins,
  userName,
  userAvatar,
  onUpdateCoins,
  onClose,
}) => {
  const [betIndex, setBetIndex] = useState(2); // 1000
  const [isSpinning, setIsSpinning] = useState(false);
  const [fastMode, setFastMode] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [todayWin, setTodayWin] = useState(0);
  const [reels, setReels] = useState<string[][]>([
    ['CH', '7', 'BL'],
    ['OR', 'CH', 'GR'],
    ['B1', 'B2', 'CH'],
  ]);
  const [hitPositions, setHitPositions] = useState<number[]>([]);
  const [winBanner, setWinBanner] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [msg, setMsg] = useState('');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const autoSpinRef = useRef(autoSpin);
  autoSpinRef.current = autoSpin;

  const playBeep = (freq: number, dur: number, vol = 0.08) => {
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
      gain.gain.value = vol;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch (_) {}
  };

  const pickSymbol = () => {
    let r = Math.random() * TOTAL_WEIGHT;
    for (const s of SYMBOLS) {
      r -= WEIGHTS[s];
      if (r < 0) return s;
    }
    return 'CH';
  };

  const currentBet = BETS[betIndex];

  const renderSymbolIcon = (key: string) => {
    switch (key) {
      case '7':
        return <span className="text-3xl font-black text-rose-500 italic drop-shadow-[0_2px_4px_#f59e0b]">7</span>;
      case 'B3':
        return (
          <span className="flex flex-col text-[10px] font-black bg-cyan-600 px-1.5 py-0.5 rounded text-white tracking-widest border border-cyan-300">
            BAR<span className="-mt-1">BAR</span><span className="-mt-1">BAR</span>
          </span>
        );
      case 'B2':
        return (
          <span className="flex flex-col text-[10px] font-black bg-emerald-600 px-1.5 py-0.5 rounded text-white tracking-widest border border-emerald-300">
            BAR<span className="-mt-1">BAR</span>
          </span>
        );
      case 'B1':
        return (
          <span className="text-xs font-black bg-pink-600 px-2 py-0.5 rounded text-white tracking-widest border border-pink-300">
            BAR
          </span>
        );
      case 'BL':
        return <span className="text-3xl">🔔</span>;
      case 'GR':
        return <span className="text-3xl">🍇</span>;
      case 'OR':
        return <span className="text-3xl">🍊</span>;
      case 'CH':
        return <span className="text-3xl">🍒</span>;
      default:
        return <span>{key}</span>;
    }
  };

  const spin = () => {
    if (isSpinning) return;
    if (userCoins < currentBet) {
      setMsg('কয়েন যথেষ্ট নয়!');
      setAutoSpin(false);
      setTimeout(() => setMsg(''), 2000);
      return;
    }

    setIsSpinning(true);
    setHitPositions([]);
    onUpdateCoins(userCoins - currentBet, `স্লটস স্পিন (${currentBet} কয়েন)`);
    playBeep(450, 0.08);

    const result = [pickSymbol(), pickSymbol(), pickSymbol()];
    const spinDuration = fastMode ? 600 : 1200;

    // Simulate animated reel rolling
    let rolls = 0;
    const rollInterval = setInterval(() => {
      setReels([
        [pickSymbol(), pickSymbol(), pickSymbol()],
        [pickSymbol(), pickSymbol(), pickSymbol()],
        [pickSymbol(), pickSymbol(), pickSymbol()],
      ]);
      playBeep(260 + (rolls % 3) * 50, 0.02, 0.04);
      rolls++;
      if (rolls >= (fastMode ? 8 : 16)) {
        clearInterval(rollInterval);
        // Set final reel with middle row as the winning line
        setReels([
          [pickSymbol(), result[0], pickSymbol()],
          [pickSymbol(), result[1], pickSymbol()],
          [pickSymbol(), result[2], pickSymbol()],
        ]);
        evaluateWin(result);
      }
    }, spinDuration / (fastMode ? 8 : 16));
  };

  const evaluateWin = (centerLine: string[]) => {
    const [c1, c2, c3] = centerLine;
    let mult = 0;
    let matchCount = 0;

    const isAllBars = ['B1', 'B2', 'B3'].includes(c1) &&
                      ['B1', 'B2', 'B3'].includes(c2) &&
                      ['B1', 'B2', 'B3'].includes(c3);

    if (c1 === c2 && c2 === c3) {
      mult = PAY3[c1] || 0;
      matchCount = 3;
    } else if (isAllBars) {
      mult = MIX_BAR;
      matchCount = 3;
    } else if (c1 === c2) {
      mult = PAY2[c1] || 0;
      matchCount = 2;
    }

    const won = Math.floor(currentBet * mult);
    setIsSpinning(false);

    if (won > 0) {
      setHitPositions(matchCount === 3 ? [0, 1, 2] : [0, 1]);
      playBeep(880, 0.35, 0.15);
      setWinBanner(won);
      setTodayWin(tw => tw + won);
      onUpdateCoins(userCoins + won, `স্লটস জয় (+${won.toLocaleString()})`);
      setTimeout(() => setWinBanner(null), 3000);
    }

    if (autoSpinRef.current) {
      setTimeout(() => {
        if (autoSpinRef.current) spin();
      }, won > 0 ? 1800 : 700);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-gradient-to-b from-[#241154] via-[#150a36] to-[#0a041c] text-white select-none overflow-y-auto pb-8 pt-safe">
      <div className="w-full max-w-[440px] px-3 py-2 flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-indigo-500/20">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-bold active:scale-95">
              ✕
            </button>
            <button onClick={() => setSoundOn(!soundOn)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center active:scale-95">
              {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>

          <div className="bg-black/50 px-3 py-1 rounded-full border border-amber-400/40">
            <span className="text-amber-400 font-bold">🪙 {userCoins.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowRules(true)} className="w-9 h-9 rounded-xl bg-white/10 text-amber-300 flex items-center justify-center active:scale-95">
              <HelpCircle size={18} />
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="text-center my-2">
          <h1 className="text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-400 to-amber-600 drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]">
            SLOTS
          </h1>
          <p className="text-xs font-bold text-cyan-300 italic tracking-wider -mt-1">
            Bonus Pile Up!
          </p>
        </div>

        {/* Quick Payout Info Table */}
        <div className="grid grid-cols-3 gap-1 bg-amber-500/20 p-2 rounded-xl border border-amber-400/40 text-[10px] font-bold text-center mb-3">
          <div className="bg-indigo-950/80 p-1 rounded flex justify-between px-2"><span>777</span><span className="text-amber-300 font-black">x70</span></div>
          <div className="bg-indigo-950/80 p-1 rounded flex justify-between px-2"><span>BAR³</span><span className="text-amber-300 font-black">x20</span></div>
          <div className="bg-indigo-950/80 p-1 rounded flex justify-between px-2"><span>BAR²</span><span className="text-amber-300 font-black">x15</span></div>
          <div className="bg-indigo-950/80 p-1 rounded flex justify-between px-2"><span>BAR</span><span className="text-amber-300 font-black">x12</span></div>
          <div className="bg-indigo-950/80 p-1 rounded flex justify-between px-2"><span>🔔🔔🔔</span><span className="text-amber-300 font-black">x10</span></div>
          <div className="bg-indigo-950/80 p-1 rounded flex justify-between px-2"><span>মিনিমাম BAR</span><span className="text-amber-300 font-black">x4.5</span></div>
        </div>

        {/* Slot Machine Frame */}
        <div className="relative bg-gradient-to-b from-amber-600 via-amber-500 to-amber-700 p-3 rounded-3xl border-4 border-yellow-300 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
          {/* Reel Window */}
          <div className="relative bg-gradient-to-b from-slate-200 to-slate-300 rounded-2xl overflow-hidden border-4 border-indigo-950 p-2 shadow-inner">
            {/* Payline indicator */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-16 border-y-2 border-amber-500 bg-amber-400/10 pointer-events-none z-10 shadow-[0_0_12px_#f59e0b]"></div>

            {/* 3 Reels */}
            <div className="grid grid-cols-3 gap-2">
              {reels.map((col, colIdx) => (
                <div key={colIdx} className="bg-white rounded-xl shadow-md py-1 flex flex-col gap-2 items-center justify-around h-48 border border-slate-300">
                  {col.map((item, rowIdx) => {
                    const isWinningMiddle = rowIdx === 1 && hitPositions.includes(colIdx);
                    return (
                      <div
                        key={rowIdx}
                        className={`w-full flex items-center justify-center h-14 rounded-lg transition-all ${
                          isWinningMiddle ? 'bg-amber-300/60 scale-110 shadow-md animate-pulse' : ''
                        }`}
                      >
                        {renderSymbolIcon(item)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status Message */}
        <div className="h-6 text-center text-sm font-bold text-amber-300 mt-2">
          {msg}
        </div>

        {/* Win Banner */}
        {winBanner !== null && (
          <div className="my-1 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 p-2 rounded-2xl text-center text-slate-950 font-black text-xl shadow-[0_0_20px_#f59e0b] animate-bounce">
            🎉 জয়: +🪙 {winBanner.toLocaleString()}
          </div>
        )}

        {/* Control Panel: Bet Adjust, Fast, Spin Button */}
        <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-purple-950 p-3 rounded-2xl border-2 border-indigo-600/50 mt-2 flex items-center justify-between gap-2 shadow-xl">
          {/* Bet controls */}
          <div className="flex flex-col flex-1">
            <span className="text-[10px] text-cyan-200 font-bold mb-1">বেট নির্বাচন</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setBetIndex(Math.max(0, betIndex - 1))}
                className="w-8 h-8 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white flex items-center justify-center font-bold active:scale-95"
              >
                <Minus size={16} />
              </button>
              <div className="flex-1 bg-black/60 rounded-lg py-1 px-2 text-center font-black text-amber-400 font-mono text-sm border border-indigo-500/40">
                {currentBet.toLocaleString()}
              </div>
              <button
                onClick={() => setBetIndex(Math.min(BETS.length - 1, betIndex + 1))}
                className="w-8 h-8 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white flex items-center justify-center font-bold active:scale-95"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Fast mode */}
          <button
            onClick={() => setFastMode(!fastMode)}
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-[10px] border-2 transition-all active:scale-95 ${
              fastMode
                ? 'bg-amber-400 text-black border-white shadow-[0_0_12px_#f59e0b]'
                : 'bg-black/40 text-gray-300 border-white/20'
            }`}
          >
            <Zap size={16} />
            দ্রুত
          </button>

          {/* Auto toggle */}
          <button
            onClick={() => {
              const next = !autoSpin;
              setAutoSpin(next);
              if (next && !isSpinning) spin();
            }}
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-[10px] border-2 transition-all active:scale-95 ${
              autoSpin
                ? 'bg-emerald-500 text-white border-white shadow-[0_0_12px_#22c55e]'
                : 'bg-black/40 text-gray-300 border-white/20'
            }`}
          >
            {autoSpin ? <Pause size={16} /> : <Play size={16} />}
            অটো
          </button>

          {/* Main Spin Button */}
          <button
            disabled={isSpinning}
            onClick={spin}
            className={`w-20 h-20 rounded-full bg-gradient-to-b from-green-400 to-emerald-700 border-4 border-yellow-300 text-white font-black text-base shadow-[0_6px_0_#065f46,0_10px_20px_rgba(0,0,0,0.6)] active:translate-y-1 active:shadow-[0_2px_0_#065f46] flex flex-col items-center justify-center transition-all ${
              isSpinning ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110'
            }`}
          >
            <span>SPIN</span>
            <span className="text-[9px] font-bold text-amber-200">🪙 {currentBet}</span>
          </button>
        </div>

        {/* Today win stats */}
        <div className="flex justify-between items-center bg-black/40 px-3 py-1.5 rounded-xl border border-white/10 mt-2 text-xs">
          <span className="text-purple-300">আজকের মোট জয়:</span>
          <span className="font-black text-emerald-400">🪙 {todayWin.toLocaleString()}</span>
        </div>
      </div>

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-indigo-950 border-2 border-amber-400 rounded-2xl p-4 max-h-[80vh] overflow-y-auto text-xs leading-relaxed space-y-2">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-amber-400 font-black text-base">🎰 স্লটস পে-টেবিল</h3>
              <button onClick={() => setShowRules(false)} className="text-white text-lg">✕</button>
            </div>
            <p>১. মাঝের সোনালি লাইনে বামদিক থেকে ২টি বা ৩টি মিলে গেলে জয় হয়।</p>
            <p>২. <b>৩টি মিলে গেলে:</b> 7️⃣ x70, BAR³ x20, BAR² x15, BAR x12, 🔔 x10, 🍇 x7, 🍊 x6, 🍒 x5।</p>
            <p>৩. <b>যেকোনো ৩টি BAR:</b> x4.5 গুণক।</p>
            <p>৪. <b>প্রথম ২টি মিলে গেলে:</b> 7️⃣ x6, BAR³ x5, BAR² x4, BAR x3.5, 🔔 🍇 🍊 x3, 🍒 x2.5।</p>
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
