import React, { useEffect, useRef } from 'react';

interface Props {
  userCoins: number;
  userName: string;
  userAvatar: string;
  onUpdateCoins: (amount: number, note: string) => Promise<boolean>;
  getBalance: () => number;
  onClose: () => void;
}

export const JackpotFruitGame: React.FC<Props> = props => {
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
      if (data.type === 'jf-ready') {
        initialized.current = true;
        send({ type: 'jf-init', balance: current.current.userCoins, name: current.current.userName, avatar: current.current.userAvatar });
      } else if (data.type === 'jf-exit' && !busy.current) current.current.onClose();
      else if (data.type === 'jf-wallet' && initialized.current && !busy.current) {
        if (!Number.isSafeInteger(data.delta) || data.delta === 0) return;
        busy.current = true;
        const ok = await current.current.onUpdateCoins(data.delta, 'জ্যাকপট ফ্রুট');
        busy.current = false;
        if (ok) {
          // React commits the saved account balance before acknowledgement.
          send({ type: 'jf-saved', balance: current.current.getBalance() });
        } else send({ type: 'jf-error' });
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  return <iframe ref={frame} title="জ্যাকপট ফ্রুট" src={`${import.meta.env.BASE_URL}games/jackpot-fruit.html`} className="absolute inset-0 w-full h-full border-0" allow="autoplay" />;
};
