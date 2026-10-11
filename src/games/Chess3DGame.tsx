import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Volume2, VolumeX, HelpCircle, Trophy, RotateCcw, Eye } from 'lucide-react';

interface Props {
  userCoins: number;
  userName: string;
  userAvatar: string;
  onUpdateCoins: (newCoins: number, note: string) => void;
  onClose: () => void;
}

const RT: Record<number, string> = { 60: 'KQ', 63: 'K', 56: 'Q', 4: 'kq', 7: 'k', 0: 'q' };
const VAL: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const PV: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const GL: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };

export const Chess3DGame: React.FC<Props> = ({
  userCoins,
  userName,
  userAvatar,
  onUpdateCoins,
  onClose,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<number>(2); // 0: 2P local, 2: vs Computer
  const [lvl, setLvl] = useState<number>(1); // 0: easy, 1: med, 2: hard
  const [humanColor, setHumanColor] = useState<number>(1); // 1: White, -1: Black
  const [msg, setMsg] = useState<string>('সাদার চাল');
  const [capturedWhite, setCapturedWhite] = useState<string[]>([]);
  const [capturedBlack, setCapturedBlack] = useState<string[]>([]);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [showRules, setShowRules] = useState<boolean>(false);
  const [pot, setPot] = useState<number>(1000);
  const [wager, setWager] = useState<number>(500);
  const [isMatchActive, setIsMatchActive] = useState<boolean>(false);

  // Engine state refs
  const stateRef = useRef<{
    b: string[];
    turn: number;
    cr: string;
    ep: number;
    sel: number;
    mv: number[];
    over: boolean;
    last: [number, number];
    hm: number;
    cap: { w: string[]; b: string[] };
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    renderer: THREE.WebGLRenderer | null;
    pieceGroup: THREE.Group | null;
    markerGroup: THREE.Group | null;
    squares: THREE.Mesh[];
    audioCtx: AudioContext | null;
    camAngle: number;
    camElevation: number;
  }>({
    b: ('rnbqkbnr' + 'pppppppp' + ' '.repeat(32) + 'PPPPPPPP' + 'RNBQKBNR').split(''),
    turn: 1,
    cr: 'KQkq',
    ep: -1,
    sel: -1,
    mv: [],
    over: false,
    last: [-1, -1],
    hm: 0,
    cap: { w: [], b: [] },
    scene: null,
    camera: null,
    renderer: null,
    pieceGroup: null,
    markerGroup: null,
    squares: [],
    audioCtx: null,
    camAngle: 0,
    camElevation: 0.95,
  });

  const playSfx = (type: string) => {
    if (!soundOn) return;
    try {
      if (!stateRef.current.audioCtx) {
        stateRef.current.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = stateRef.current.audioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = type === 'cap' ? 440 : type === 'check' ? 880 : 330;
      gain.gain.value = 0.1;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (type === 'check' ? 0.25 : 0.1));
    } catch (_) {}
  };

  const getCol = (c: string) => (c === ' ' ? 0 : c === c.toUpperCase() ? 1 : -1);

  const genMoves = (board: string[], i: number, cr: string, ep: number, attOnly = false): number[] => {
    const p = board[i];
    const c = getCol(p);
    const t = p.toLowerCase();
    const r = i >> 3;
    const f = i & 7;
    const o: number[] = [];

    const add = (R: number, F: number) => {
      if (R < 0 || R > 7 || F < 0 || F > 7) return 0;
      const j = R * 8 + F;
      if (getCol(board[j]) === c) return 0;
      o.push(j);
      return board[j] === ' ';
    };

    const slide = (ds: number[][]) => {
      ds.forEach(([dr, df]) => {
        let R = r + dr, F = f + df;
        while (add(R, F)) {
          R += dr;
          F += df;
        }
      });
    };

    const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const X = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

    if (t === 'r') slide(D);
    else if (t === 'b') slide(X);
    else if (t === 'q') slide([...D, ...X]);
    else if (t === 'n') {
      [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([dr, df]) => add(r + dr, f + df));
    } else if (t === 'k') {
      [...D, ...X].forEach(([dr, df]) => add(r + dr, f + df));
      if (!attOnly) {
        const B = c === 1 ? 60 : 4;
        const rs = c === 1 ? 'KQ' : 'kq';
        if (i === B && !isAttacked(board, B, -c)) {
          if (cr.includes(rs[0]) && board[B + 1] === ' ' && board[B + 2] === ' ' && !isAttacked(board, B + 1, -c) && !isAttacked(board, B + 2, -c)) {
            o.push(B + 2);
          }
          if (cr.includes(rs[1]) && board[B - 1] === ' ' && board[B - 2] === ' ' && board[B - 3] === ' ' && !isAttacked(board, B - 1, -c) && !isAttacked(board, B - 2, -c)) {
            o.push(B - 2);
          }
        }
      }
    } else if (t === 'p') {
      const d = -c;
      const R = r + d;
      if (!attOnly && R >= 0 && R < 8 && board[R * 8 + f] === ' ') {
        o.push(R * 8 + f);
        if (r === (c === 1 ? 6 : 1) && board[(R + d) * 8 + f] === ' ') {
          o.push((R + d) * 8 + f);
        }
      }
      [-1, 1].forEach(df => {
        const F = f + df;
        if (F < 0 || F > 7 || R < 0 || R > 7) return;
        const j = R * 8 + F;
        if (attOnly) o.push(j);
        else if (getCol(board[j]) === -c || j === ep) o.push(j);
      });
    }

    return o;
  };

  const isAttacked = (board: string[], sq: number, by: number): boolean => {
    for (let j = 0; j < 64; j++) {
      if (getCol(board[j]) === by && genMoves(board, j, '', -1, true).includes(sq)) {
        return true;
      }
    }
    return false;
  };

  const applyMove = (board: string[], a: number, z: number, ep: number, pr = 'q'): string[] => {
    const n = [...board];
    const p = n[a];
    const t = p.toLowerCase();
    if (t === 'p' && z === ep && n[z] === ' ') n[(a >> 3) * 8 + (z & 7)] = ' ';
    if (t === 'k' && Math.abs(z - a) === 2) {
      const isKingside = z > a;
      n[isKingside ? z - 1 : z + 1] = n[isKingside ? a + 3 : a - 4];
      n[isKingside ? a + 3 : a - 4] = ' ';
    }
    n[z] = p;
    n[a] = ' ';
    if (t === 'p' && (z >> 3 === 0 || z >> 3 === 7)) {
      n[z] = getCol(p) === 1 ? pr.toUpperCase() : pr.toLowerCase();
    }
    return n;
  };

  const getLegalMoves = (i: number): number[] => {
    const s = stateRef.current;
    const c = getCol(s.b[i]);
    return genMoves(s.b, i, s.cr, s.ep, false).filter(z => {
      const n = applyMove(s.b, i, z, s.ep);
      const kingPos = n.indexOf(c === 1 ? 'K' : 'k');
      return !isAttacked(n, kingPos, -c);
    });
  };

  const hasAnyLegalMove = (c: number): boolean => {
    const s = stateRef.current;
    for (let i = 0; i < 64; i++) {
      if (getCol(s.b[i]) === c && getLegalMoves(i).length > 0) return true;
    }
    return false;
  };

  const updateStatus = () => {
    const s = stateRef.current;
    const kingPos = s.b.indexOf(s.turn === 1 ? 'K' : 'k');
    const isCheck = isAttacked(s.b, kingPos, -s.turn);
    const hasLegal = hasAnyLegalMove(s.turn);

    const sideName = s.turn === 1 ? 'সাদা' : 'কালো';
    const otherSideName = s.turn === 1 ? 'কালো' : 'সাদা';

    if (!hasLegal) {
      s.over = true;
      if (isCheck) {
        setMsg(`কিস্তিমাত! ${otherSideName} জিতেছে! 🏆`);
        playSfx('check');
        if ((mode === 2 && s.turn !== humanColor) || mode === 0) {
          onUpdateCoins(userCoins + pot, `দাবা ৩ডি জয় (+${pot} কয়েন)`);
        }
      } else {
        setMsg('স্টেলমেট! খেলা ড্র');
      }
    } else {
      setMsg(`${sideName}র চাল` + (isCheck ? ' (কিস্তি!)' : ''));
      if (isCheck) playSfx('check');
    }
  };

  const executeMove = (a: number, z: number) => {
    const s = stateRef.current;
    const p = s.b[a];
    const t = p.toLowerCase();
    const isCap = s.b[z] !== ' ' || (t === 'p' && z === s.ep);
    const capturedPiece = t === 'p' && z === s.ep && s.b[z] === ' ' ? (s.turn === 1 ? 'p' : 'P') : s.b[z];

    if (capturedPiece !== ' ') {
      const key = s.turn === 1 ? 'w' : 'b';
      s.cap[key].push(capturedPiece);
      setCapturedWhite([...s.cap.w]);
      setCapturedBlack([...s.cap.b]);
      playSfx('cap');
    } else {
      playSfx('move');
    }

    const nextEp = t === 'p' && Math.abs(z - a) === 16 ? (a + z) / 2 : -1;
    s.b = applyMove(s.b, a, z, s.ep);

    [a, z].forEach(sq => {
      if (RT[sq]) {
        for (const ch of RT[sq]) s.cr = s.cr.replace(ch, '');
      }
    });

    s.last = [a, z];
    s.ep = nextEp;
    s.turn = -s.turn;
    s.sel = -1;
    s.mv = [];

    updateStatus();
    render3D();

    if (mode === 2 && !s.over && s.turn !== humanColor) {
      setTimeout(makeAiMove, 300);
    }
  };

  const makeAiMove = () => {
    const s = stateRef.current;
    if (s.over || s.turn === humanColor) return;

    const allMoves: { a: number; z: number; score: number }[] = [];
    for (let i = 0; i < 64; i++) {
      if (getCol(s.b[i]) === s.turn) {
        const moves = getLegalMoves(i);
        moves.forEach(z => {
          const capScore = s.b[z] !== ' ' ? (VAL[s.b[z].toLowerCase()] || 0) : 0;
          allMoves.push({ a: i, z, score: capScore + Math.random() * 20 });
        });
      }
    }

    if (allMoves.length === 0) return;
    allMoves.sort((x, y) => y.score - x.score);
    const chosen = allMoves[0];
    executeMove(chosen.a, chosen.z);
  };

  const initGame = () => {
    if (userCoins < wager) {
      alert('কয়েন যথেষ্ট নয়!');
      return;
    }
    onUpdateCoins(userCoins - wager, `দাবা ৩ডি এন্ট্রি (${wager} কয়েন)`);
    setPot(wager * 2);

    const s = stateRef.current;
    s.b = ('rnbqkbnr' + 'pppppppp' + ' '.repeat(32) + 'PPPPPPPP' + 'RNBQKBNR').split('');
    s.turn = 1;
    s.cr = 'KQkq';
    s.ep = -1;
    s.sel = -1;
    s.mv = [];
    s.over = false;
    s.last = [-1, -1];
    s.cap = { w: [], b: [] };
    setCapturedWhite([]);
    setCapturedBlack([]);
    setMsg('সাদার চাল');
    setIsMatchActive(true);

    if (humanColor === -1) {
      s.camAngle = Math.PI;
    } else {
      s.camAngle = 0;
    }
    updateCamera();
    render3D();
  };

  const updateCamera = () => {
    const s = stateRef.current;
    if (!s.camera) return;
    const dist = 14;
    s.camera.position.set(
      dist * Math.cos(s.camElevation) * Math.sin(s.camAngle),
      dist * Math.sin(s.camElevation),
      dist * Math.cos(s.camElevation) * Math.cos(s.camAngle)
    );
    s.camera.lookAt(0, 0, 0);
  };

  // 3D Scene Initialization
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(6, 12, 8);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Outer Wooden Frame
    const frameGeo = new THREE.BoxGeometry(9.6, 0.3, 9.6);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.5 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = -0.16;
    frame.receiveShadow = true;
    scene.add(frame);

    // Board Squares (8x8)
    const squares: THREE.Mesh[] = [];
    for (let i = 0; i < 64; i++) {
      const isLight = ((i >> 3) + (i & 7)) % 2 === 0;
      const sqMat = new THREE.MeshStandardMaterial({
        color: isLight ? 0xfef3c7 : 0x78350f,
        roughness: 0.4,
      });
      const sqGeo = new THREE.BoxGeometry(1, 0.15, 1);
      const mesh = new THREE.Mesh(sqGeo, sqMat);
      mesh.position.set((i & 7) - 3.5, -0.075, (i >> 3) - 3.5);
      mesh.receiveShadow = true;
      mesh.userData = { sqIndex: i };
      scene.add(mesh);
      squares.push(mesh);
    }

    const pieceGroup = new THREE.Group();
    const markerGroup = new THREE.Group();
    scene.add(pieceGroup, markerGroup);

    stateRef.current.scene = scene;
    stateRef.current.camera = camera;
    stateRef.current.renderer = renderer;
    stateRef.current.squares = squares;
    stateRef.current.pieceGroup = pieceGroup;
    stateRef.current.markerGroup = markerGroup;

    updateCamera();
    render3D();

    // Raycast handling on canvas tap
    const handlePointerDown = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects([...squares, ...pieceGroup.children], true);
      if (intersects.length > 0) {
        let hitObj: THREE.Object3D | null = intersects[0].object;
        while (hitObj && hitObj.userData?.sqIndex === undefined && hitObj.parent) {
          hitObj = hitObj.parent;
        }
        if (hitObj && hitObj.userData?.sqIndex !== undefined) {
          handleSquareClick(hitObj.userData.sqIndex);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.dispose();
    };
  }, []);

  const handleSquareClick = (index: number) => {
    const s = stateRef.current;
    if (s.over) return;
    if (mode === 2 && s.turn !== humanColor) return;

    if (s.sel >= 0 && s.mv.includes(index)) {
      executeMove(s.sel, index);
    } else if (getCol(s.b[index]) === s.turn) {
      s.sel = index;
      s.mv = getLegalMoves(index);
      playSfx('sel');
      render3D();
    } else {
      s.sel = -1;
      s.mv = [];
      render3D();
    }
  };

  const render3D = () => {
    const s = stateRef.current;
    if (!s.pieceGroup || !s.markerGroup) return;

    // Highlight squares
    for (let i = 0; i < 64; i++) {
      const isLight = ((i >> 3) + (i & 7)) % 2 === 0;
      let color = isLight ? 0xfef3c7 : 0x78350f;
      if (s.last.includes(i)) color = 0xfde047;
      if (i === s.sel) color = 0x60a5fa;
      (s.squares[i].material as THREE.MeshStandardMaterial).color.set(color);
    }

    // Clear old pieces and markers
    s.pieceGroup.clear();
    s.markerGroup.clear();

    // Render 3D pieces
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.25 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.35 });

    s.b.forEach((char, i) => {
      if (char === ' ') return;
      const isWhite = getCol(char) === 1;
      const mat = isWhite ? whiteMat : blackMat;
      const t = char.toLowerCase();

      const piece = new THREE.Group();
      piece.userData = { sqIndex: i };

      // Base
      const baseGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.15, 24);
      const baseMesh = new THREE.Mesh(baseGeo, mat);
      baseMesh.castShadow = true;
      piece.add(baseMesh);

      // Body / Shape by piece type
      if (t === 'p') {
        const body = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 20), mat);
        body.position.y = 0.38;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), mat);
        head.position.y = 0.72;
        piece.add(body, head);
      } else if (t === 'r') {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.7, 20), mat);
        body.position.y = 0.45;
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.2, 16), mat);
        crown.position.y = 0.85;
        piece.add(body, crown);
      } else if (t === 'n') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.7, 0.25), mat);
        body.position.y = 0.45;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.24), mat);
        head.position.set(0.08, 0.75, 0);
        head.rotation.z = -0.25;
        piece.add(body, head);
      } else if (t === 'b') {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.8, 20), mat);
        body.position.y = 0.48;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), mat);
        head.scale.y = 1.4;
        head.position.y = 0.95;
        piece.add(body, head);
      } else if (t === 'q') {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.95, 20), mat);
        body.position.y = 0.55;
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.2, 0.25, 20), mat);
        crown.position.y = 1.1;
        piece.add(body, crown);
      } else if (t === 'k') {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.05, 20), mat);
        body.position.y = 0.6;
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), mat);
        crossH.position.y = 1.25;
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.08), mat);
        crossV.position.y = 1.25;
        piece.add(body, crossH, crossV);
      }

      piece.position.set((i & 7) - 3.5, 0.08, (i >> 3) - 3.5);
      s.pieceGroup?.add(piece);
    });

    // Render legal move markers
    s.mv.forEach(dest => {
      const isCapture = s.b[dest] !== ' ';
      const markerGeo = isCapture
        ? new THREE.TorusGeometry(0.4, 0.05, 8, 24)
        : new THREE.CylinderGeometry(0.15, 0.15, 0.04, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: isCapture ? 0xef4444 : 0x22c55e });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      if (isCapture) marker.rotation.x = Math.PI / 2;
      marker.position.set((dest & 7) - 3.5, 0.04, (dest >> 3) - 3.5);
      s.markerGroup?.add(marker);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-gradient-to-b from-[#1c1917] via-[#0c0a09] to-[#040303] text-white select-none overflow-y-auto pb-8 pt-safe">
      <div className="w-full max-w-[480px] px-3 py-2 flex flex-col items-center">
        {/* Top Header */}
        <div className="w-full flex items-center justify-between pb-2 border-b border-white/20">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-bold active:scale-95">
              ✕
            </button>
            <button onClick={() => setSoundOn(!soundOn)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center active:scale-95">
              {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>

          <div className="bg-black/60 px-3 py-1 rounded-full border border-amber-400/50">
            <span className="text-amber-400 font-bold">🪙 {userCoins.toLocaleString()}</span>
          </div>

          <button onClick={() => setShowRules(true)} className="w-9 h-9 rounded-xl bg-white/10 text-amber-300 flex items-center justify-center active:scale-95">
            <HelpCircle size={18} />
          </button>
        </div>

        {/* Title */}
        <div className="text-center my-1">
          <h1 className="text-3xl font-black text-amber-300 drop-shadow">
            দাবা ৩ডি
          </h1>
        </div>

        {/* Status Message */}
        <div className="w-full text-center py-1.5 px-4 bg-black/60 rounded-full border border-white/15 text-xs font-black text-amber-300 mb-2">
          {msg}
        </div>

        {/* Captured Pieces Bar (Opponent Top) */}
        <div className="w-full bg-black/50 p-2 rounded-xl flex items-center justify-between text-xs mb-1 border border-white/10">
          <span className="text-gray-300">প্রতিপক্ষের কাটা ঘুঁটি:</span>
          <div className="flex gap-1 text-base">
            {capturedWhite.map((p, idx) => (
              <span key={idx} className="text-white drop-shadow">{GL[p.toLowerCase()]}</span>
            ))}
          </div>
        </div>

        {/* 3D Canvas Container */}
        <div
          ref={mountRef}
          className="w-full aspect-square max-w-[420px] rounded-2xl overflow-hidden shadow-2xl border-4 border-amber-950 bg-radial-at-c from-slate-800 to-black touch-none"
        />

        {/* Captured Pieces Bar (My Bottom) */}
        <div className="w-full bg-black/50 p-2 rounded-xl flex items-center justify-between text-xs mt-1 border border-white/10">
          <span className="text-gray-300">আমার কাটা ঘুঁটি:</span>
          <div className="flex gap-1 text-base">
            {capturedBlack.map((p, idx) => (
              <span key={idx} className="text-amber-400 drop-shadow">{GL[p.toLowerCase()]}</span>
            ))}
          </div>
        </div>

        {/* Camera and Match Controls */}
        <div className="w-full flex gap-2 mt-2">
          <button
            onClick={() => {
              stateRef.current.camAngle = 0;
              stateRef.current.camElevation = 0.95;
              updateCamera();
            }}
            className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold"
          >
            সাদার দিক
          </button>
          <button
            onClick={() => {
              stateRef.current.camAngle = Math.PI;
              stateRef.current.camElevation = 0.95;
              updateCamera();
            }}
            className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold"
          >
            কালোর দিক
          </button>
          <button
            onClick={() => {
              stateRef.current.camElevation = 1.45;
              updateCamera();
            }}
            className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold"
          >
            উপর থেকে
          </button>
        </div>

        {/* Game Mode / New Game Panel */}
        <div className="w-full bg-black/50 p-3 rounded-2xl border border-white/10 mt-3 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-300">ম্যাচ এন্ট্রি / প্রাইজ পট:</span>
            <span className="text-amber-400 font-bold">🪙 {pot} (এন্ট্রি {wager})</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setMode(2);
                initGame();
              }}
              className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl font-black text-xs text-white shadow active:scale-95"
            >
              🤖 কম্পিউটারের সাথে খেলো
            </button>
            <button
              onClick={() => {
                setMode(0);
                initGame();
              }}
              className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl font-black text-xs text-white shadow active:scale-95"
            >
              👥 ২ জন খেলোয়াড়
            </button>
          </div>

          <div className="flex justify-between items-center text-xs pt-1">
            <button
              onClick={() => {
                const s = stateRef.current;
                s.over = true;
                setMsg('আপনি হার মেনেছেন');
              }}
              className="px-3 py-1 bg-red-600/30 text-red-300 border border-red-500/40 rounded-lg font-bold"
            >
              হার মানো
            </button>
            <button
              onClick={initGame}
              className="px-3 py-1 bg-white/10 text-white rounded-lg font-bold"
            >
              নতুন খেলা
            </button>
          </div>
        </div>
      </div>

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-stone-900 border-2 border-amber-400 rounded-2xl p-4 max-h-[80vh] overflow-y-auto text-xs leading-relaxed space-y-2">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-amber-400 font-black text-base">📖 দাবা ৩ডি নিয়ম ও পয়েন্ট</h3>
              <button onClick={() => setShowRules(false)} className="text-white text-lg">✕</button>
            </div>
            <p className="font-bold text-amber-300">ঘুঁটির পয়েন্ট:</p>
            <p>বোড়ে ১, ঘোড়া ৩, গজ ৩, নৌকা ৫, মন্ত্রী ৯। রাজার দাম নেই, রাজা কাটা যায় না। পয়েন্টে জয় হয় না, জয় হয় কিস্তিমাতে।</p>
            <p className="font-bold text-amber-300">চাল:</p>
            <p>রাজা সব দিকে ১ ঘর। মন্ত্রী সোজা-কোণাকুণি যত খুশি। নৌকা সোজা। গজ কোণাকুণি। ঘোড়া L আকারে। বোড়ে সামনে ১ ঘর (প্রথম চালে ২), কাটে কোণাকুণি।</p>
            <p>কিস্তিমাত হলে বিজয়ী পুরো প্রাইজ পট জিতে নেয়!</p>
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
