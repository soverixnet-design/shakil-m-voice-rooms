import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, HelpCircle, Trophy, RotateCcw, Home } from 'lucide-react';

interface Props {
  userCoins: number;
  userName: string;
  userAvatar: string;
  onUpdateCoins: (newCoins: number, note: string) => void;
  onClose: () => void;
}

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: 'q' | 'w' | 'b'; // queen, white, black
  r: number;
  m: number;
  in: boolean;
  k?: number; // striker indicator
  u?: number;
}

const W = 600;
const F = 28;
const LO = 110;
const HI = 490;
const R = 13;
const SR = 17;
const PR = 30;
const PC = [
  [F + 10, F + 10],
  [W - F - 10, F + 10],
  [F + 10, W - F - 10],
  [W - F - 10, W - F - 10]
];
const SIDE_NAMES = ['নিচের', 'ডানের', 'উপরের', 'বাঁয়ের'];
const NRM = [[0, -1], [-1, 0], [0, 1], [1, 0]];

export const CarromGame: React.FC<Props> = ({
  userCoins,
  userName,
  userAvatar,
  onUpdateCoins,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<'bot' | 'two' | 'four'>('bot');
  const [diff, setDiff] = useState<number>(1); // 0: easy, 1: med, 2: hard
  const [target, setTarget] = useState<number>(25);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [turn, setTurn] = useState<number>(0);
  const [board, setBoard] = useState<number>(1);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [msg, setMsg] = useState<string>('আপনার পালা (সাদা গুটি)');
  const [gameState, setGameState] = useState<'menu' | 'play' | 'over'>('menu');
  const [wager, setWager] = useState<number>(500);
  const [pot, setPot] = useState<number>(1000);
  const [powerPercent, setPowerPercent] = useState<number>(0);

  // Mutable Game Loop State
  const gameRef = useRef<{
    coins: Piece[];
    st: Piece;
    sides: number[];
    state: 'aim' | 'move' | 'botaim' | 'wait' | 'over';
    drag: { x: number; y: number } | null;
    slide: boolean;
    events: Piece[];
    cap: [Piece[], Piece[]];
    pend: { team: number } | null;
    ba: { u0: number; u: number; a: number; sp: number; t0: number } | null;
    fc: number;
    audioCtx: AudioContext | null;
    botName: string;
    animId: number;
  }>({
    coins: [],
    st: { x: 300, y: W - 90, vx: 0, vy: 0, r: SR, m: 1.6, in: true, k: 1, u: 300, t: 'w' },
    sides: [0, 2],
    state: 'aim',
    drag: null,
    slide: false,
    events: [],
    cap: [[], []],
    pend: null,
    ba: null,
    fc: 0,
    audioCtx: null,
    botName: 'রাহাত',
    animId: 0,
  });

  const playBeep = (freq: number, duration: number, vol = 0.1) => {
    if (!soundOn) return;
    try {
      if (!gameRef.current.audioCtx) {
        gameRef.current.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = gameRef.current.audioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  };

  const getPosition = (s: number, u: number): [number, number] => {
    return s === 0 ? [u, W - 90] : s === 1 ? [W - 90, u] : s === 2 ? [u, 90] : [90, u];
  };

  const setStrikerU = (u: number) => {
    const g = gameRef.current;
    g.st.u = Math.max(LO, Math.min(HI, u));
    const [x, y] = getPosition(g.sides[turn], g.st.u);
    g.st.x = x;
    g.st.y = y;
  };

  const initGame = (m: 'bot' | 'two' | 'four') => {
    if (userCoins < wager) {
      alert('কয়েন যথেষ্ট নয়!');
      return;
    }
    onUpdateCoins(userCoins - wager, `ক্যারাম ম্যাচ এন্ট্রি (${wager} কয়েন)`);
    setPot(wager * 2);

    setMode(m);
    setScore([0, 0]);
    setTurn(0);
    setBoard(1);
    const g = gameRef.current;
    g.sides = m === 'four' ? [0, 1, 2, 3] : [0, 2];
    g.botName = 'রাহাত';
    setupBoard();
    setGameState('play');
  };

  const setupBoard = () => {
    const g = gameRef.current;
    const c = W / 2;
    const list: Piece[] = [{ x: c, y: c, vx: 0, vy: 0, t: 'q', r: R, m: 1, in: true }];

    // Inner ring of 6
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      list.push({
        x: c + Math.cos(a) * 2.1 * R,
        y: c + Math.sin(a) * 2.1 * R,
        vx: 0,
        vy: 0,
        t: i % 2 ? 'b' : 'w',
        r: R,
        m: 1,
        in: true,
      });
    }

    // Outer ring of 12
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6 + Math.PI / 12;
      list.push({
        x: c + Math.cos(a) * 4.05 * R,
        y: c + Math.sin(a) * 4.05 * R,
        vx: 0,
        vy: 0,
        t: i % 2 ? 'b' : 'w',
        r: R,
        m: 1,
        in: true,
      });
    }

    g.coins = list;
    g.st = {
      x: c,
      y: W - 90,
      vx: 0,
      vy: 0,
      r: SR,
      m: 1.6,
      in: true,
      k: 1,
      u: 300,
      t: 'w',
    };
    g.cap = [[], []];
    g.pend = null;
    g.drag = null;
    g.slide = false;
    g.events = [];
    g.ba = null;
    readyTurn();
  };

  const readyTurn = () => {
    const g = gameRef.current;
    g.state = 'aim';
    g.st.vx = 0;
    g.st.vy = 0;
    g.st.in = true;
    setStrikerU(300);

    const isBot = mode === 'bot' && turn === 1;
    if (isBot) {
      setMsg(`${g.botName} (বট) চিন্তা করছে...`);
      setTimeout(planBotShot, 400);
    } else {
      setMsg(turn === 0 ? 'আপনার পালা (সাদা)' : mode === 'two' ? 'খেলোয়াড় ২ (কালো)' : `দল ${turn + 1}`);
    }
  };

  const shoot = (vx: number, vy: number) => {
    const g = gameRef.current;
    const sp = Math.hypot(vx, vy);
    playBeep(220 + sp * 20, 0.1, Math.min(0.5, 0.05 + sp * 0.03));
    g.st.vx = vx;
    g.st.vy = vy;
    g.state = 'move';
    g.fc = 0;
    g.events = [];
    g.drag = null;
    g.slide = false;
    setPowerPercent(0);
  };

  const collide = (a: Piece, b: Piece) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    const md = a.r + b.r;
    if (d >= md || d === 0) return;
    const nx = dx / d;
    const ny = dy / d;
    const ov = md - d;
    const t = a.m + b.m;
    a.x -= (nx * ov * b.m) / t;
    a.y -= (ny * ov * b.m) / t;
    b.x += (nx * ov * a.m) / t;
    b.y += (ny * ov * a.m) / t;

    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv >= 0) return;
    const j = (-1.85 * rv) / (1 / a.m + 1 / b.m);
    a.vx -= (j * nx) / a.m;
    a.vy -= (j * ny) / a.m;
    b.vx += (j * nx) / b.m;
    b.vy += (j * ny) / b.m;

    if (rv < -0.8) {
      playBeep(240 + Math.abs(rv) * 20, 0.05, 0.06);
    }
  };

  const physicsStep = () => {
    const g = gameRef.current;
    const all = [...g.coins, g.st];

    for (let s = 0; s < 4; s++) {
      for (const o of all) {
        if (!o.in) continue;
        o.x += o.vx / 4;
        o.y += o.vy / 4;
        const lo = F + o.r;
        const hi = W - F - o.r;
        if (o.x < lo || o.x > hi) {
          o.x = o.x < lo ? lo : hi;
          o.vx = -o.vx * 0.8;
        }
        if (o.y < lo || o.y > hi) {
          o.y = o.y < lo ? lo : hi;
          o.vy = -o.vy * 0.8;
        }
      }

      for (let i = 0; i < all.length; i++) {
        if (!all[i].in) continue;
        for (let j = i + 1; j < all.length; j++) {
          if (all[j].in) collide(all[i], all[j]);
        }
      }
    }

    let moving = false;
    for (const o of all) {
      if (!o.in) continue;
      const f = o.vx * o.vx + o.vy * o.vy < 1.5 ? 0.94 : 0.982;
      o.vx *= f;
      o.vy *= f;
      if (o.vx * o.vx + o.vy * o.vy < 0.04) {
        o.vx = 0;
        o.vy = 0;
      } else {
        moving = true;
      }

      for (const p of PC) {
        if (Math.hypot(o.x - p[0], o.y - p[1]) < PR - 3) {
          o.in = false;
          o.vx = 0;
          o.vy = 0;
          g.events.push(o);
          playBeep(170, 0.15, 0.2);
          break;
        }
      }
    }

    return moving;
  };

  const endShot = () => {
    const g = gameRef.current;
    const T = turn % 2;
    const O = 1 - T;
    const own = T ? 'b' : 'w';
    const qc = g.coins[0];

    let ownCount = 0;
    let queenPocketed = false;
    let foul = false;

    for (const o of g.events) {
      if (o.k) foul = true;
      else if (o.t === 'q') queenPocketed = true;
      else if (o.t === own) {
        ownCount++;
        score[T]++;
        g.cap[T].push(o);
      } else {
        score[O]++;
        g.cap[O].push(o);
      }
    }

    if (g.pend && g.pend.team === T) {
      if (ownCount > 0 && !foul) {
        score[T] += 3;
        setMsg('কুইন কভার হয়েছে! (+৩ পয়েন্ট)');
      } else {
        returnToCenter(qc);
        setMsg('কুইন ফেরত এসেছে (কভার হয়নি)');
      }
      g.pend = null;
    }

    if (queenPocketed) {
      if (foul) {
        returnToCenter(qc);
      } else if (ownCount > 0) {
        score[T] += 3;
        setMsg('কুইন ও গুটি এক শটে কভার! (+৩)');
      } else {
        g.pend = { team: T };
        setMsg('কুইন পকেটে পড়েছে! কভার করুন');
      }
    }

    if (foul) {
      if (g.cap[T].length) {
        returnToCenter(g.cap[T].pop()!);
        score[T] = Math.max(0, score[T] - 1);
      }
      setMsg('ফাউল! স্ট্রাইকার পকেটে পড়েছে');
    }

    setScore([...score]);

    if (score[0] >= target || score[1] >= target) {
      const winner = score[0] > score[1] ? 0 : 1;
      setGameState('over');
      if (winner === 0) {
        playBeep(523, 0.4, 0.3);
        onUpdateCoins(userCoins + pot, `ক্যারাম ম্যাচ জয় (+${pot} কয়েন)`);
        setMsg(`🎉 অভিনন্দন! আপনি জিতেছেন এবং 🪙 ${pot} কয়েন পেয়েছেন!`);
      } else {
        setMsg(`${g.botName} ম্যাচ জিতে নিয়েছে!`);
      }
      return;
    }

    const extraTurn = !foul && (ownCount > 0 || (queenPocketed && !!g.pend));
    if (!extraTurn) {
      setTurn(t => (t + 1) % g.sides.length);
    }
    readyTurn();
  };

  const returnToCenter = (c: Piece) => {
    c.x = W / 2;
    c.y = W / 2;
    c.vx = 0;
    c.vy = 0;
    c.in = true;
  };

  // Bot aiming
  const planBotShot = () => {
    const g = gameRef.current;
    const myCoins = g.coins.filter(c => c.in && (c.t === 'b' || c.t === 'q'));
    if (!myCoins.length) return;

    let bestPocket = PC[0];
    let bestCoin = myCoins[0];
    let minD = 9999;

    myCoins.forEach(c => {
      PC.forEach(p => {
        const d = Math.hypot(p[0] - c.x, p[1] - c.y);
        if (d < minD) {
          minD = d;
          bestPocket = p;
          bestCoin = c;
        }
      });
    });

    const angleToPocket = Math.atan2(bestPocket[1] - bestCoin.y, bestPocket[0] - bestCoin.x);
    const hitX = bestCoin.x - Math.cos(angleToPocket) * (R + SR);
    const hitY = bestCoin.y - Math.sin(angleToPocket) * (R + SR);

    setStrikerU(Math.max(LO, Math.min(HI, hitX)));
    const finalAngle = Math.atan2(hitY - g.st.y, hitX - g.st.x);
    const speed = Math.min(18, Math.max(8, minD / 25 + 7));

    g.ba = {
      u0: g.st.u || 300,
      u: Math.max(LO, Math.min(HI, hitX)),
      a: finalAngle,
      sp: speed,
      t0: performance.now(),
    };
    g.state = 'botaim';
  };

  // Render Carrom Canvas
  const renderCanvas = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const g = gameRef.current;

    ctx.clearRect(0, 0, W, W);

    // Outer Wooden Rim
    const rimGrad = ctx.createLinearGradient(0, 0, W, W);
    rimGrad.addColorStop(0, '#78350f');
    rimGrad.addColorStop(0.5, '#451a03');
    rimGrad.addColorStop(1, '#270e02');
    ctx.fillStyle = rimGrad;
    ctx.fillRect(0, 0, W, W);

    // Inner playing surface (maple / birch plywood)
    const boardGrad = ctx.createLinearGradient(0, 0, W, W);
    boardGrad.addColorStop(0, '#fef3c7');
    boardGrad.addColorStop(1, '#fde68a');
    ctx.fillStyle = boardGrad;
    ctx.fillRect(F, F, W - 2 * F, W - 2 * F);

    // Border line
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 3;
    ctx.strokeRect(F + 2, F + 2, W - 2 * F - 4, W - 2 * F - 4);

    // Center Circles
    ctx.save();
    ctx.translate(W / 2, W / 2);
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(185, 28, 28, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    // Baseline circles and lines for 4 sides
    for (let s = 0; s < 4; s++) {
      ctx.save();
      ctx.rotate((-s * Math.PI) / 2);
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-190, 201);
      ctx.lineTo(190, 201);
      ctx.moveTo(-190, 219);
      ctx.lineTo(190, 219);
      ctx.stroke();

      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(-190, 210, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(190, 210, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 4 Corner Pockets
    PC.forEach(p => {
      ctx.beginPath();
      ctx.arc(p[0], p[1], PR + 2, 0, Math.PI * 2);
      ctx.fillStyle = '#1c1917';
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });

    // Draw Coins
    g.coins.forEach(c => {
      if (!c.in) return;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;

      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      if (c.t === 'q') ctx.fillStyle = '#dc2626'; // Queen red
      else if (c.t === 'w') ctx.fillStyle = '#fafaf9'; // White
      else ctx.fillStyle = '#292524'; // Black
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = c.t === 'w' ? '#d6d3d1' : '#78716c';
      ctx.stroke();

      // Inner details
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 0.6, 0, Math.PI * 2);
      ctx.strokeStyle = c.t === 'q' ? '#fef08a' : 'rgba(255,255,255,0.4)';
      ctx.stroke();
      ctx.restore();
    });

    // Draw Striker
    if (g.st.in) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.beginPath();
      ctx.arc(g.st.x, g.st.y, g.st.r, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8'; // striking cyan
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(g.st.x, g.st.y, g.st.r * 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#bae6fd';
      ctx.stroke();
      ctx.restore();
    }

    // Drag Aiming Line
    if (g.drag && g.state === 'aim') {
      const dx = g.st.x - g.drag.x;
      const dy = g.st.y - g.drag.y;
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        const ux = dx / d;
        const uy = dy / d;
        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(g.st.x, g.st.y);
        ctx.lineTo(g.st.x + ux * 300, g.st.y + uy * 300);
        ctx.stroke();

        // Power pull line
        ctx.setLineDash([]);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(g.st.x, g.st.y);
        ctx.lineTo(g.st.x - ux * Math.min(d, 160), g.st.y - uy * Math.min(d, 160));
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  // Main Animation Loop
  useEffect(() => {
    if (gameState !== 'play') return;
    const loop = () => {
      const g = gameRef.current;
      if (g.state === 'botaim' && g.ba) {
        const elapsed = performance.now() - g.ba.t0;
        if (elapsed < 350) {
          setStrikerU(g.ba.u0 + (g.ba.u - g.ba.u0) * (elapsed / 350));
        } else {
          shoot(Math.cos(g.ba.a) * g.ba.sp, Math.sin(g.ba.a) * g.ba.sp);
          g.ba = null;
        }
      } else if (g.state === 'move') {
        g.fc++;
        if (g.fc > 240) {
          [...g.coins, g.st].forEach(o => {
            o.vx = 0;
            o.vy = 0;
          });
        }
        if (!physicsStep()) {
          endShot();
        }
      }

      renderCanvas();
      g.animId = requestAnimationFrame(loop);
    };

    gameRef.current.animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameRef.current.animId);
  }, [gameState, turn, score]);

  // Pointer interactions
  const handlePointerDown = (e: React.PointerEvent) => {
    const cv = canvasRef.current;
    if (!cv || gameRef.current.state !== 'aim') return;
    const rect = cv.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * W) / rect.width;
    const y = ((e.clientY - rect.top) * W) / rect.height;

    const g = gameRef.current;
    if (Math.hypot(x - g.st.x, y - g.st.y) < 48) {
      g.slide = true;
    } else {
      g.drag = { x, y };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const cv = canvasRef.current;
    if (!cv || gameRef.current.state !== 'aim') return;
    const rect = cv.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * W) / rect.width;
    const y = ((e.clientY - rect.top) * W) / rect.height;

    const g = gameRef.current;
    if (g.slide) {
      setStrikerU(g.sides[turn] % 2 ? y : x);
    } else if (g.drag) {
      g.drag = { x, y };
      const d = Math.hypot(g.st.x - x, g.st.y - y);
      setPowerPercent(Math.min(100, Math.round((d / 160) * 100)));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const g = gameRef.current;
    if (g.slide) {
      g.slide = false;
      return;
    }
    if (!g.drag || g.state !== 'aim') {
      g.drag = null;
      return;
    }

    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * W) / rect.width;
    const y = ((e.clientY - rect.top) * W) / rect.height;

    const dx = g.st.x - x;
    const dy = g.st.y - y;
    const d = Math.hypot(dx, dy);
    g.drag = null;
    if (d < 14) return;

    const sp = Math.min(d, 160) * 0.135;
    shoot((dx / d) * sp, (dy / d) * sp);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-gradient-to-b from-[#1b1464] via-[#4a1d7a] to-[#8a1f5c] text-white select-none overflow-y-auto pb-8 pt-safe">
      <div className="w-full max-w-[480px] px-3 py-2 flex flex-col items-center">
        {/* Top bar */}
        <div className="w-full flex items-center justify-between pb-2 border-b border-white/20">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-black/40 flex items-center justify-center font-bold active:scale-95">
              ✕
            </button>
            <button onClick={() => setSoundOn(!soundOn)} className="w-9 h-9 rounded-xl bg-black/40 flex items-center justify-center active:scale-95">
              {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>

          <div className="bg-black/50 px-3 py-1 rounded-full border border-amber-400/50">
            <span className="text-amber-400 font-bold">🪙 {userCoins.toLocaleString()}</span>
          </div>

          <button
            onClick={() => setGameState('menu')}
            className="w-9 h-9 rounded-xl bg-black/40 text-amber-300 flex items-center justify-center active:scale-95"
          >
            <Home size={18} />
          </button>
        </div>

        {gameState === 'menu' ? (
          /* Carrom Lobby / Mode Select */
          <div className="w-full bg-white/10 backdrop-blur-md rounded-3xl p-5 border border-white/20 shadow-2xl mt-4 flex flex-col gap-4">
            <div className="text-center">
              <h1 className="text-4xl font-black text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                ক্যারাম
              </h1>
              <p className="text-xs text-purple-200 mt-1">আসল ফিজিক্স ও ৩ডি অনুভূতি</p>
            </div>

            {/* Entry Wager Selection */}
            <div className="bg-black/40 p-3 rounded-2xl border border-amber-400/30">
              <span className="text-xs text-amber-300 font-bold block mb-2">ম্যাচ এন্ট্রি কয়েন (জয়ী পুরো পট পাবে):</span>
              <div className="grid grid-cols-3 gap-2">
                {[500, 1000, 5000].map(w => (
                  <button
                    key={w}
                    onClick={() => setWager(w)}
                    className={`py-2 rounded-xl font-black text-xs border-2 transition-all active:scale-95 ${
                      wager === w
                        ? 'bg-amber-400 text-black border-white shadow-[0_0_12px_#f59e0b]'
                        : 'bg-white/10 text-white border-transparent'
                    }`}
                  >
                    🪙 {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Points */}
            <div>
              <span className="text-xs text-purple-200 font-bold block mb-1">লক্ষ্য পয়েন্ট:</span>
              <div className="flex gap-2">
                {[25, 30, 40].map(t => (
                  <button
                    key={t}
                    onClick={() => setTarget(t)}
                    className={`flex-1 py-1.5 rounded-xl font-bold text-xs border transition-all ${
                      target === t ? 'bg-amber-400 text-black border-white' : 'bg-white/10 text-white border-white/20'
                    }`}
                  >
                    {t} পয়েন্ট
                  </button>
                ))}
              </div>
            </div>

            {/* Game Modes */}
            <div className="space-y-2 mt-2">
              <button
                onClick={() => initGame('bot')}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl font-black text-sm text-white shadow-[0_4px_0_#9a3412] active:translate-y-1 active:shadow-none"
              >
                🧑 একা খেলুন (বট রাহাত-এর বিরুদ্ধে)
              </button>
              <button
                onClick={() => initGame('two')}
                className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-600 rounded-2xl font-black text-sm text-white shadow-[0_4px_0_#065f46] active:translate-y-1 active:shadow-none"
              >
                👥 বন্ধুর সাথে (২ জন, একই স্ক্রিনে)
              </button>
              <button
                onClick={() => initGame('four')}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl font-black text-sm text-white shadow-[0_4px_0_#3730a3] active:translate-y-1 active:shadow-none"
              >
                🎯 ৪ জন (২ বনাম ২ টিম)
              </button>
            </div>
          </div>
        ) : (
          /* Active Carrom Game View */
          <div className="w-full flex flex-col items-center mt-2">
            {/* Scoreboard */}
            <div className="w-full flex gap-2 mb-2">
              <div className={`flex-1 p-2 rounded-xl border-2 flex justify-between items-center ${
                turn % 2 === 0 ? 'bg-amber-400/20 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'bg-black/40 border-white/10'
              }`}>
                <div>
                  <span className="text-[10px] text-gray-300 block">সাদা দল</span>
                  <span className="font-bold text-xs">{userName}</span>
                </div>
                <span className="text-2xl font-black text-amber-300">{score[0]}</span>
              </div>
              <div className={`flex-1 p-2 rounded-xl border-2 flex justify-between items-center ${
                turn % 2 === 1 ? 'bg-amber-400/20 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'bg-black/40 border-white/10'
              }`}>
                <div>
                  <span className="text-[10px] text-gray-300 block">কালো দল</span>
                  <span className="font-bold text-xs">{mode === 'bot' ? 'রাহাত' : 'প্লেয়ার ২'}</span>
                </div>
                <span className="text-2xl font-black text-amber-300">{score[1]}</span>
              </div>
            </div>

            {/* Target and Pot */}
            <div className="w-full flex justify-between text-xs text-purple-200 px-1 mb-1">
              <span>🎯 লক্ষ্য: <b>{target}</b></span>
              <span className="text-amber-300 font-bold">🏆 প্রাইজ পট: 🪙 {pot}</span>
            </div>

            {/* Message Status */}
            <div className="w-full text-center py-1 px-3 bg-black/40 rounded-full text-xs font-bold text-amber-300 mb-2 truncate">
              {msg}
            </div>

            {/* Canvas */}
            <div className="w-full aspect-square max-w-[420px] rounded-2xl overflow-hidden shadow-2xl border-4 border-amber-900/60 touch-none">
              <canvas
                ref={canvasRef}
                width={W}
                height={W}
                className="w-full h-full cursor-crosshair"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />
            </div>

            {/* Power Meter */}
            <div className="w-full max-w-[420px] bg-black/40 h-6 rounded-xl border border-white/20 mt-2 overflow-hidden relative flex items-center justify-center">
              <div
                className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600 transition-all"
                style={{ width: `${powerPercent}%` }}
              ></div>
              <span className="relative z-10 text-[10px] font-black text-white drop-shadow">
                {powerPercent > 0 ? `POWER ${powerPercent}%` : 'টেনে জোর দিন (POWER)'}
              </span>
            </div>

            <p className="text-[10px] text-purple-200 text-center mt-2">
              নিজের দিকের স্ট্রাইকার ধরে সরান। ফাঁকা জায়গা থেকে পিছনে টেনে ছাড়লে শট!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
