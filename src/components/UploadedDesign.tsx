import React, { useEffect, useRef } from 'react';
interface Props { state: any; admin: boolean; visible: boolean; onAction: (action: string, value?: string) => void; }
export const UploadedDesign: React.FC<Props> = props => {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef(props); latest.current = props;
  const send = () => {
    const s = latest.current.state;
    const escape = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
    const state = { ...s, svip: Math.min(3, Math.max(0, Number(s.svip) || 0)), name: escape(s.name), bio: escape(s.bio),bn:{...s.bn,t:escape(s.bn?.t)},
      rooms: (s.rooms || []).map((r: any) => ({...r, cv:/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(r.photoURL||'')?`<img src="${r.photoURL}" alt="রুম" style="width:100%;height:100%;object-fit:cover;border-radius:14px">`:escape(r.cv), name: escape(r.name), host: escape(r.host), ann: escape(r.ann)})) };
    frame.current?.contentWindow?.postMessage({type:'design-state', state, admin:latest.current.admin}, window.location.origin);
  };
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin) return;
      if (event.data?.type === 'design-ready') send();
      if (event.data?.type === 'design-action' && typeof event.data.action === 'string') latest.current.onAction(event.data.action, event.data.value);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  useEffect(send, [props.state, props.admin, props.visible]);
  return <iframe ref={frame} title="Shakil M নতুন ডিজাইন" src={`${import.meta.env.BASE_URL}voice-design.html`} onLoad={send} style={{position:'absolute',inset:0,width:'100%',height:'100%',border:0,zIndex:40,display:props.visible?'block':'none'}} />;
};
