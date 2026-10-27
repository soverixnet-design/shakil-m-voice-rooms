import React, { useState } from 'react';
import { 
  CreditCard, 
  Send, 
  QrCode, 
  History, 
  Copy, 
  Check, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Sparkles, 
  X, 
  ShieldCheck 
} from 'lucide-react';
import { TransactionRecord, RechargePackage } from '../types';

interface Props {
  userCoins: number;
  userId: string;
  userName: string;
  transactions: TransactionRecord[];
  onRecharge: (amount: number, usd: number) => void;
  onSendCoins: (recipientId: string, amount: number, note: string) => boolean;
  onClose: () => void;
}

const PACKAGES: RechargePackage[] = [
  { usd: 1, coins: 1000 },
  { usd: 5, coins: 5500, badge: '+10% Bonus' },
  { usd: 10, coins: 12000, badge: '+20% Bonus' },
  { usd: 20, coins: 26000, badge: '+30% Bonus' },
  { usd: 50, coins: 70000, badge: '+40% Bonus' },
  { usd: 100, coins: 150000, badge: '+50% Bonus' },
];

export const WalletModal: React.FC<Props> = ({
  userCoins,
  userId,
  userName,
  transactions,
  onRecharge,
  onSendCoins,
  onClose,
}) => {
  const [tab, setTab] = useState<'recharge' | 'send' | 'receive' | 'history'>('recharge');
  const [sendTargetId, setSendTargetId] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendNote, setSendNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; success: boolean } | null>(null);

  const handleCopyId = () => {
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(sendAmount);
    if (!sendTargetId.trim()) {
      setFeedbackMsg({ text: 'Enter the recipient's user ID', success: false });
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      setFeedbackMsg({ text: 'Enter a valid coin amount', success: false });
      return;
    }
    if (amt > userCoins) {
      setFeedbackMsg({ text: 'Insufficient coins in your wallet', success: false });
      return;
    }
    if (sendTargetId.trim() === userId) {
      setFeedbackMsg({ text: 'You cannot transfer coins to your own account', success: false });
      return;
    }

    const success = onSendCoins(sendTargetId.trim(), amt, sendNote.trim() || 'Coin transfer');
    if (success) {
      setFeedbackMsg({ text: `Successfully sent ${amt.toLocaleString()} coins!`, success: true });
      setSendTargetId('');
      setSendAmount('');
      setSendNote('');
    } else {
      setFeedbackMsg({ text: 'Coin transfer failed', success: false });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-[#111827] border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col overflow-hidden text-white shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-950/60 to-indigo-950/60">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👛</span>
            <div>
              <h2 className="font-black text-lg text-amber-300">Coin Wallet</h2>
              <p className="text-[11px] text-gray-300">Recharge, transfers and balance history</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-gray-300 hover:text-white active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* Balance Card */}
        <div className="p-4 bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-indigo-500/20 border-b border-white/10">
          <div className="bg-black/40 rounded-2xl p-4 border border-amber-400/30 flex items-center justify-between">
            <div>
              <span className="text-xs text-amber-200/80 font-bold block">Current total balance</span>
              <div className="text-3xl font-black text-amber-400 flex items-center gap-2 mt-0.5">
                <span>🪙</span>
                <span>{userCoins.toLocaleString()}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 block">Your ID</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-sm text-cyan-300">{userId}</span>
                <button
                  onClick={handleCopyId}
                  className="p-1 rounded bg-white/10 hover:bg-white/20 active:scale-95"
                  title="Copy"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-black/20 px-2 pt-2 gap-1 overflow-x-auto">
          {[
            { id: 'recharge', label: 'Recharge', icon: CreditCard },
            { id: 'send', label: 'Send coins', icon: Send },
            { id: 'receive', label: 'Receive coins', icon: QrCode },
            { id: 'history', label: 'History', icon: History },
          ].map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id as any);
                  setFeedbackMsg(null);
                }}
                className={`flex-1 min-w-[85px] py-2.5 px-2 rounded-t-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  active
                    ? 'bg-[#1f2937] text-amber-300 border-t-2 border-amber-400 shadow'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {feedbackMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                feedbackMsg.success
                  ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-500/40'
                  : 'bg-rose-950/80 text-rose-200 border border-rose-500/40'
              }`}
            >
              <ShieldCheck size={16} />
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* TAB 1: RECHARGE */}
          {tab === 'recharge' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-amber-600/30 to-orange-600/30 p-3 rounded-2xl border border-amber-500/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🎁</span>
                  <div>
                    <span className="font-black text-sm text-amber-300 block">First Recharge Bonus</span>
                    <span className="text-[11px] text-amber-100/80">Special frame and bonus coins on your first recharge!</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-300 mb-2">Choose a coin package</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {PACKAGES.map((pkg, idx) => (
                    <div
                      key={idx}
                      className="relative bg-black/40 hover:bg-black/60 border border-white/10 hover:border-amber-400/50 rounded-2xl p-3 flex flex-col justify-between transition-all"
                    >
                      {pkg.badge && (
                        <span className="absolute -top-2.5 right-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full shadow">
                          {pkg.badge}
                        </span>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🪙</span>
                        <div>
                          <span className="font-black text-base text-amber-400 block leading-tight">
                            {pkg.coins.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-gray-400">Coins</span>
                        </div>
                      </div>
                      <button
                        onClick={() => onRecharge(pkg.coins, pkg.usd)}
                        className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-xs rounded-xl shadow active:scale-95"
                      >
                        ${pkg.usd} (Recharge)
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SEND COINS (TRANSFER) */}
          {tab === 'send' && (
            <form onSubmit={handleSendSubmit} className="space-y-4">
              <div className="bg-black/30 p-3 rounded-2xl border border-white/10 text-xs text-gray-300 leading-relaxed">
                💡 You can send coins directly to any room member using their Shakil M user ID.
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1.5">
                  Recipient user ID *
                </label>
                <input
                  type="text"
                  placeholder="Example: 103948 or SM103948"
                  value={sendTargetId}
                  onChange={e => setSendTargetId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 text-sm font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1.5">
                  Coin amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-amber-400">🪙</span>
                  <input
                    type="number"
                    min="1"
                    max={userCoins}
                    placeholder="Amount to send"
                    value={sendAmount}
                    onChange={e => setSendAmount(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-black/50 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 text-sm font-bold"
                    required
                  />
                </div>
                {/* Quick amount chips */}
                <div className="flex gap-2 mt-2">
                  {[100, 500, 1000, 5000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setSendAmount(String(amt))}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-bold text-gray-300"
                    >
                      +{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSendAmount(String(userCoins))}
                    className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold"
                  >
                    All (Max)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1.5">
                  Note or greeting (optional)
                </label>
                <input
                  type="text"
                  placeholder="Example: Happy birthday / Game tip"
                  value={sendNote}
                  onChange={e => setSendNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-sm rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Send size={16} /> Send coins
              </button>
            </form>
          )}

          {/* TAB 3: RECEIVE COINS */}
          {tab === 'receive' && (
            <div className="text-center space-y-4 py-2">
              <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl shadow-xl flex flex-col items-center justify-center">
                <div className="w-full h-full border-4 border-dashed border-gray-400 rounded-xl flex flex-col items-center justify-center text-slate-900">
                  <QrCode size={90} className="text-slate-900" />
                  <span className="text-[10px] font-black text-slate-800 uppercase mt-1">
                    SM-{userId}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs text-gray-400 block mb-1">Your receive code and ID:</span>
                <div className="inline-flex items-center gap-2 bg-black/50 px-4 py-2 rounded-xl border border-amber-400/50">
                  <span className="font-mono text-xl font-black text-amber-300">SM{userId}</span>
                  <button
                    onClick={handleCopyId}
                    className="p-1.5 bg-amber-400 text-black rounded-lg font-bold text-xs flex items-center gap-1 active:scale-95"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                Share this ID with friends or in a room. They can use it in Send Coins to transfer coins directly to your wallet.
              </p>
            </div>
          )}

          {/* TAB 4: HISTORY */}
          {tab === 'history' && (
            <div className="space-y-2">
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  No transactions yet
                </div>
              ) : (
                transactions.map((t, idx) => {
                  const isPositive = t.amount > 0;
                  return (
                    <div
                      key={t.id || idx}
                      className="bg-black/30 p-3 rounded-xl border border-white/10 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {isPositive ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </div>
                        <div>
                          <span className="font-bold text-gray-200 block text-xs">{t.description}</span>
                          <span className="text-[10px] text-gray-400">{t.timestamp}</span>
                        </div>
                      </div>
                      <span
                        className={`font-mono font-black text-sm ${
                          isPositive ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isPositive ? `+${t.amount.toLocaleString()}` : `${t.amount.toLocaleString()}`} 🪙
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
