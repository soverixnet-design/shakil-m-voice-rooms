import React,{useEffect,useRef,useState} from 'react';
export interface LobbySlide{id:string;name:string;image?:string;title?:string;subtitle?:string;lang?:string;eventId?:string;}
export const DEFAULT_LOBBY_SLIDES:LobbySlide[]=[
 {id:'welcome-bn',name:'বাংলা',title:'আপনার আড্ডা, আপনার রুম',subtitle:'বন্ধুদের সঙ্গে কথা বলুন · গিফট পাঠান',lang:'bn'},
 {id:'welcome-en',name:'English',title:'Your voice. Your room.',subtitle:'Meet friends · Share gifts · Stay connected',lang:'en'},
 {id:'welcome-ar',name:'العربية',title:'صوتك، غرفتك',subtitle:'تحدث مع الأصدقاء وشارك الهدايا',lang:'ar'},
];
export function LobbyBannerCarousel({slides,onEvent,onManage}:{slides:LobbySlide[];onEvent:(id:string)=>void;onManage?:()=>void}){
 const items=slides.length?slides:DEFAULT_LOBBY_SLIDES,[index,setIndex]=useState(0),[animate,setAnimate]=useState(true),[paused,setPaused]=useState(false),touch=useRef<number|null>(null);
 const count=items.length,signature=items.map(x=>x.id).join('|');
 useEffect(()=>{setIndex(0);setAnimate(false);},[signature]);
 useEffect(()=>{if(animate)return;let second=0;const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>setAnimate(true));});return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};},[animate]);
 useEffect(()=>{if(count<2||paused)return;const timer=setInterval(()=>setIndex(i=>i>=count?1:i+1),5000);return()=>clearInterval(timer);},[count,paused,signature]);
 const current=index%count,track=count>1?[...items,items[0]]:items;
 const select=(i:number)=>{setAnimate(true);setIndex(i);};
 return <div className="lobby-banner-carousel" aria-roledescription="carousel" aria-label="ব্যানার ও ইভেন্ট" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setPaused(false);}} onTouchStart={e=>{touch.current=e.touches[0].clientX;setPaused(true);}} onTouchEnd={e=>{const start=touch.current;touch.current=null;setPaused(false);if(start===null)return;const delta=e.changedTouches[0].clientX-start;if(Math.abs(delta)>35)select(delta<0?(current+1)%count:(current+count-1)%count);}}>
  <div dir="ltr" className={'lobby-banner-track '+(!animate?'no-animation':'')} style={{transform:`translateX(-${index*100}%)`}} onTransitionEnd={e=>{if(e.target===e.currentTarget&&index>=count){setAnimate(false);setIndex(0);}}}>
   {track.map((slide,i)=><div key={slide.id+'-'+i} className="lobby-banner-slide" aria-hidden={i!==index} lang={slide.lang} data-no-translate="true" dir={slide.lang==='ar'?'rtl':'ltr'}>
    {slide.eventId?<button tabIndex={i===index?0:-1} onClick={()=>onEvent(slide.eventId!)} className="lobby-event-banner">{slide.image?<img src={slide.image} alt={slide.name}/>:<div className="lobby-banner-empty"><span>🏆</span><b>{slide.title||slide.name}</b><small>{slide.subtitle||'ইভেন্টের বিস্তারিত দেখুন ›'}</small></div>}</button>:slide.image?<img src={slide.image} alt={slide.name}/>:<div className={'lobby-banner-empty welcome-'+(slide.lang||'bn')}><span>🎙️</span><b>{slide.title}</b><small>{slide.subtitle}</small></div>}
   </div>)}
  </div>
  {count>1&&<><div className="lobby-banner-dots">{items.map((b,i)=><button key={b.id} aria-label={`${b.name} ব্যানার দেখুন`} aria-current={current===i} onClick={()=>select(i)}/>)}</div><button className="lobby-banner-pause" aria-label={paused?'ব্যানার স্লাইড চালু করুন':'ব্যানার স্লাইড থামান'} onClick={()=>setPaused(v=>!v)}>{paused?'▶':'Ⅱ'}</button></>}
  {onManage&&<button className="lobby-banner-manage" onClick={onManage}>＋ ব্যানার যোগ করুন</button>}
 </div>;
}
