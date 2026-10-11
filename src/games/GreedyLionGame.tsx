import React, { useEffect, useRef } from 'react';

interface Props {
  userCoins: number;
  userName: string;
  userAvatar: string;
  onUpdateCoins: (amount: number, note: string) => Promise<boolean>;
  getBalance: () => number;
  onClose: () => void;
}

export const GreedyLionGame: React.FC<Props> = props => {
  const frame = useRef<HTMLIFrameElement>(null);
  const current = useRef(props);
  current.current = props;
  const busy = useRef(false);
  const initialized = useRef(false);
  useEffect(() => {
    const send = (data: object) => frame.current?.contentWindow?.postMessage(data, window.location.origin);
    const receive = async (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.type === 'gl-ready') {
        initialized.current = true;
        send({ type: 'gl-init', balance: current.current.userCoins, name: current.current.userName, avatar: current.current.userAvatar });
      } else if (data.type === 'gl-exit' && !busy.current) current.current.onClose();
      else if (data.type === 'gl-wallet' && initialized.current && !busy.current) {
        if (!Number.isSafeInteger(data.delta) || data.delta === 0) return;
        busy.current = true;
        let ok = false;
        try { ok = await current.current.onUpdateCoins(data.delta, 'Greedy Lion'); }
        catch { ok = false; }
        finally { busy.current = false; }
        if (ok) {
          // React commits the saved account balance before acknowledgement.
          send({ type: 'gl-saved', balance: current.current.getBalance() });
        } else send({ type: 'gl-error' });
      }
    };
    const exit=()=>send({type:'gl-request-exit'});
    window.addEventListener('greedy-lion-exit',exit);
    window.addEventListener('message', receive);
    return () => {window.removeEventListener('message', receive);window.removeEventListener('greedy-lion-exit',exit)};
  }, []);
  return <iframe ref={frame} title="Greedy Lion" src={`${import.meta.env.BASE_URL}games/greedy-lion.html`} className="absolute inset-0 w-full h-full border-0" allow="autoplay" />;
};
