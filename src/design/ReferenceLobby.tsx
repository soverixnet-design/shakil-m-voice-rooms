import {ProfileLevels} from '../components/ProfileLevels';
import {activeRankingAward} from '../lib/rankingAwards';
import {LobbyBannerCarousel} from '../components/LobbyBannerCarousel';
import {LobbyRankings} from '../components/LobbyRankings';
import {roomFlag,visibleRooms} from '../lib/lobbyRooms';
import {walletApi} from '../lib/walletApi';
import {giftLevel} from '../lib/giftLevel';
import {DirectMessages} from '../components/DirectMessages';
import {EventCenter} from '../components/EventCenter';
import {onSnapshot,query,orderBy,limit,addDoc} from '../lib/reliableFirestore';
import {LanguagePicker} from '../i18n/LanguagePicker';
import React,{useEffect,useState} from 'react';
import {collection,doc,serverTimestamp} from 'firebase/firestore';
import {auth,db} from '../firebase';
import {MediaAvatar} from '../components/MediaAssets';
import {ProfilePhotoEditor} from '../components/ProfilePhotoEditor';
import {DiamondWallet} from '../components/DiamondWallet';
import {WalletRanks} from '../components/WalletRanks';
import {GameWinFeed} from '../components/GameWinFeed';
import {liveGames,roomThemes} from './catalog';
import {ServerStatus} from './ServerStatus';
export type LobbyScreen='rooms'|'mine'|'games'|'profile'|'messages'|'wallet'|'moments';
interface Props{state:any;screen:LobbyScreen;onScreen:(screen:LobbyScreen)=>void;onAction:(action:string,value?:string)=>void;admin:boolean;staff?:boolean;media:any[];roomLibrary:any[];myRoom?:any;seller:boolean}
const fmt=(n:unknown)=>Number(n||0).toLocaleString();
export function ReferenceLobby({state:s,screen,onScreen,onAction,admin,staff=false,media,roomLibrary,myRoom,seller}:Props){
  const [country,setCountry]=useState('all'),[listLayout,setListLayout]=useState(false),[lobbyEvents,setLobbyEvents]=useState<any[]>([]),[selectedEvent,setSelectedEvent]=useState<string|null>(null),[rankView,setRankView]=useState<{kind:string;period:string}|null>(null),[rankPreview,setRankPreview]=useState<any[]>([]),[category,setCategory]=useState('সব'),[walletTab,setWalletTab]=useState('recharge'),[diamonds,setDiamonds]=useState(0),[posts,setPosts]=useState<any[]>([]),[post,setPost]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(!auth.currentUser)return;return onSnapshot(doc(db,'diamondWallets',auth.currentUser.uid),v=>setDiamonds(Number(v.data()?.balance||0)),()=>setStatus('ওয়ালেটের তথ্য লোড হয়নি। Rules পরীক্ষা করুন।'))},[]);
  useEffect(()=>{if(screen!=='moments')return;return onSnapshot(query(collection(db,'moments'),orderBy('createdAt','desc'),limit(50)),v=>setPosts(v.docs.map(d=>({id:d.id,...d.data()}))),()=>setStatus('মোমেন্ট লোড হয়নি। নতুন Rules প্রকাশ করুন।'))},[screen]);
  const banners=media.filter(x=>x.kind==='banner');
  const flags=[...new Set<string>(s.rooms.map((r:any)=>roomFlag(r)))];
  const rooms=visibleRooms(s.rooms,country);
  useEffect(()=>{if(screen!=='rooms')return;let live=true;void walletApi('events',{action:'rankings',kind:'sending',period:'weekly'}).then(r=>{if(live)setRankPreview(r.rows.slice(0,3));}).catch(()=>{});return()=>{live=false;};},[screen]);
  useEffect(()=>{if(screen!=='rooms')return;let alive=true;async function load(){try{const result=await walletApi('events',{action:'list'});if(alive)setLobbyEvents(result.events.filter((e:any)=>e.phase==='active'||e.phase==='upcoming'));}catch{}}void load();const timer=setInterval(()=>void load(),30000);return()=>{alive=false;clearInterval(timer);};},[screen]);
  const bannerSlides=[...banners.map(b=>({id:b.id,name:b.name,image:b.image})),...lobbyEvents.map(e=>({id:'event-'+e.id,name:e.title,title:e.title,image:e.banner||undefined,eventId:e.id,subtitle:e.phase==='active'?'ইভেন্ট চলছে · বিস্তারিত দেখুন ›':'ইভেন্ট আসছে · বিস্তারিত দেখুন ›'}))];
  async function publishPost(){if(busy||!post.trim()||!auth.currentUser)return;setBusy(true);try{await addDoc(collection(db,'moments'),{userId:auth.currentUser.uid,text:post.trim(),name:s.name,avatar:s.img||s.av||'👤',createdAt:serverTimestamp()});setPost('');setStatus('✅ পোস্ট সেভ হয়েছে')}catch{setStatus('পোস্ট সেভ হয়নি। সংযোগ ও Rules পরীক্ষা করুন।')}finally{setBusy(false)}}
  function roomList(followed:boolean){return roomLibrary.filter(x=>followed?x.followed:x.visitedAt).map(x=>s.rooms.find((r:any)=>String(r.id)===x.id)).filter(Boolean)}
  const roomRow=(r:any)=><button className="ref-card ref-room-row" key={r.id} onClick={()=>onAction('room',String(r.id))}><span className="ref-avatar"><MediaAvatar avatar={r.photoURL||r.cv} size={50}/></span><span><b data-no-translate="true">{r.name}</b><small>{r.sc||8} মাইক · {r.host||'ভয়েস রুম'}</small></span><strong>ঢুকুন ›</strong></button>;
  const actions=[['🛍️','মল','store'],['🏅','ব্যাজ','items'],['🖼️','ফ্রেম','frames'],['🎯','টাস্ক','tasks']];
  return <section className={'reference-lobby screen-'+screen} aria-label="EarnBD অ্যাপ">
    <div className="ref-scroll" key={screen}><div className="ref-language-bar"><LanguagePicker/></div>
      {['rooms','mine','games'].includes(screen)&&<><header className="ref-top-tabs"><button className={screen==='mine'?'selected':''} onClick={()=>onScreen('mine')}>আমি</button><button className={screen==='rooms'?'selected':''} onClick={()=>onScreen('rooms')}>হট</button><button className={screen==='games'?'selected':''} onClick={()=>onScreen('games')}>গেম</button><button className="ref-orb" aria-label="ইউজার খুঁজুন" onClick={()=>onAction('users')}>⌕</button></header><ServerStatus/></>}
      {screen==='rooms'&&<>
        <div className="lobby-ranking-cards">
          <button className="lobby-rank-feature" onClick={()=>setRankView({kind:'sending',period:'weekly'})}><b>Ranking</b><div className="lobby-podium">{rankPreview.length?rankPreview.map((u,i)=><span key={u.id}><small>{['🥇','🥈','🥉'][i]}</small><MediaAvatar avatar={u.avatar} size={i===0?64:48}/></span>):<span className="lobby-crown">👑 🏆 👑</span>}</div><small>Sending · Receiving ›</small></button>
          <button className="lobby-cp-feature" onClick={()=>setRankView({kind:'cp',period:'weekly'})}><b>CP</b><span>💞</span><small>গিফট জুটি ›</small></button>
          <button className="lobby-week-feature" onClick={()=>setRankView({kind:'sending',period:'weekly'})}><b>Week</b><span>🥇 🥈 🥉</span><small>Weekly / Monthly ›</small></button>
        </div>
        <LobbyBannerCarousel slides={bannerSlides} onEvent={setSelectedEvent} onManage={admin?()=>onAction('page','admin'):undefined}/>

        <div className="lobby-room-surface"><div className="lobby-country-bar"><div className="ref-chips"><button className={country==='all'?'selected':''} onClick={()=>setCountry('all')}>All</button>{flags.map(flag=><button key={flag} aria-label={`${flag} দেশের রুম`} className={country===flag?'selected':''} onClick={()=>setCountry(flag)}>{flag}</button>)}</div><button className="lobby-layout-button" aria-label="রুমের তালিকার বিন্যাস বদলান" onClick={()=>setListLayout(v=>!v)}>{listLayout?'▦':'☷'}</button></div>
          <div className={'lobby-showcase-rooms '+(listLayout?'list':'')}>{rooms.map((r:any,i:number)=><button className="lobby-showcase-room" key={r.id} onClick={()=>onAction('room',String(r.id))}><div className="lobby-showcase-art" style={{background:roomThemes[Number(r.th||0)%4]}}>{/^(https:\/\/|data:image\/)/.test(r.photoURL||r.cv||'')?<img src={r.photoURL||r.cv} alt={r.name}/>:<span>{r.cv||'🎙️'}</span>}<span className="lobby-room-country">{roomFlag(r)}</span><small className="lobby-room-tag">{r.locked?'🔒':r.tag||r.c||'Voice'}</small><span className="lobby-room-crown">♛</span></div><b data-no-translate="true">{r.name}</b><small>{r.sc||8} মাইক · {r.host||'Voice room'}</small></button>)}</div>
          {!rooms.length&&<p className="ref-empty">এই দেশের রুম এখনও নেই।</p>}

        </div>
      </>}
      {selectedEvent&&<div className="ref-overlay"><section className="ref-entry"><button className="ref-back" onClick={()=>setSelectedEvent(null)}>‹ ফিরে যান</button><EventCenter initialEventId={selectedEvent==='all'?undefined:selectedEvent}/></section></div>}
      {rankView&&<LobbyRankings {...rankView} media={media} onUser={uid=>{setRankView(null);onAction('users',uid)}} onClose={()=>setRankView(null)}/>}
      {screen==='mine'&&<><div className="ref-me-banner"><span className="ref-avatar"><MediaAvatar avatar={s.img||s.av} size={60}/></span><div><h1 data-no-translate="true">{s.name}</h1><p>ID: {s.id}</p></div><button className="ref-pill" onClick={()=>onScreen('profile')}>প্রোফাইল ›</button></div><div className="ref-surface"><h2>আমার রুম</h2>{myRoom?<>{roomRow(myRoom)}<p className="ref-muted">একটি নিজের রুম। ছবি ও সিটের অনুমতি রুমের পরিচালনা থেকে বদলাতে পারবেন।</p></>:<div className="ref-card ref-create-teaser"><span>🎙️</span><h2>আপনার নিজের আড্ডার জায়গা</h2><p>ছবি, নাম ও থিম দিয়ে রুম সাজান</p><button className="ref-button wide" onClick={()=>onAction('create-room')}>রুম তৈরি করুন</button></div>}
        {[['সাম্প্রতিক রুম',false],['ফলো করা রুম',true]].map(([title,follow])=><section key={String(title)}><h2>{String(title)}</h2>{roomList(Boolean(follow)).map(roomRow)}{!roomList(Boolean(follow)).length&&<p className="ref-empty">{follow?'রুমের প্রোফাইল থেকে ফলো করলে এখানে থাকবে।':'আপনি যেসব রুমে ঢুকবেন এখানে দেখা যাবে।'}</p>}</section>)}</div></>}
      {screen==='games'&&<><div className="ref-card ref-games-banner"><span>🏆</span><h1>একই রাউন্ড, সবার একই সময়</h1><button onClick={()=>onAction('page','game_rank')}>দৈনিক / সাপ্তাহিক র‍্যাঙ্কিং ›</button></div><div className="ref-surface"><div className="ref-games-grid">{liveGames.map(g=><article className="ref-card ref-game-card" key={g.id}><div className="ref-game-art" style={{background:`linear-gradient(${g.color},#1A1040)`}}><span>{g.icon}</span><small>লাইভ রাউন্ড</small></div><h2>{g.name}</h2><button className="ref-button green wide" onClick={()=>onAction('game',g.id)}>খুলুন</button></article>)}</div><p className="ref-muted">ব্যালেন্স, বাজি ও ফলাফল সার্ভারে সেভ হয়।</p></div></>}
      {screen==='profile'&&<><header className="ref-profile-hero"><button className="ref-back" onClick={()=>onScreen('rooms')}>‹ ফিরে যান</button><span className="ref-avatar large"><MediaAvatar avatar={s.img||s.av} frame={media.find(a=>a.id===activeRankingAward(s)?.frameId)?.image} size={112}/></span><h1 data-no-translate="true">{s.name}</h1><p>ID: {s.id}</p><div className="ref-chips"><button onClick={()=>onAction('page','level')} aria-label="Sending ও Receiving লেভেলের বিস্তারিত"><ProfileLevels user={s}/></button>{s.svip>0&&<span>SVIP {s.svip}</span>}</div><button className="ref-pill" onClick={()=>onAction('page','edit_profile')}>✎ প্রোফাইল এডিট</button></header><div className="ref-surface profile-surface"><div className="ref-social-counts">{[[s.followerCount||0,'ফলোয়ার'],[(s.follow||[]).length,'ফলোইং'],[s.visitorCount||0,'ভিজিটর']].map(([n,label])=><div key={label}><b>{fmt(n)}</b><small>{label}</small></div>)}</div>{activeRankingAward(s)&&<p className="profile-ranking-award">🏅 {activeRankingAward(s).badgeName||activeRankingAward(s).title} · {new Date(activeRankingAward(s).expiresAt).toLocaleDateString()} পর্যন্ত</p>}<ProfilePhotoEditor/>
        <div className="ref-quick-links">{actions.map(([icon,label,page])=><button className="ref-card" key={page} onClick={()=>onAction('page',page)}><span>{icon}</span>{label}</button>)}</div>
        <button className="ref-card ref-profile-wallet" onClick={()=>onScreen('wallet')}><b>ওয়ালেট ›</b><span>🪙 {fmt(s.coins)} &nbsp; 💎 {fmt(diamonds)}</span></button>
        <div className="ref-card ref-link-list">{[['🎙️','আমার রুম',()=>onScreen('mine')],['✨','এন্ট্রি','entries'],['👑','SVIP','svip'],['🎁','ইনভাইট রিওয়ার্ড','invite'],['🧾','লেনদেনের ইতিহাস','hist'],['🪙','কয়েন সেলার তালিকা','coin_sellers'],['🎧','কাস্টমার সার্ভিস','support_chat'],['📜','Privacy Policy','policy_privacy'],['📋','Terms & Conditions','policy_terms'],...(seller?[['🪙','সেলার ওয়ালেট','seller']]:[]),...((admin||staff)?[['🛡️','অ্যাডমিন প্যানেল','admin']]:[])].map(([icon,label,page])=><button key={String(label)} onClick={()=>typeof page==='function'?page():onAction('page',String(page))}><span>{String(icon)} {String(label)}</span>›</button>)}</div><button className="ref-button wide" onClick={()=>onAction('logout')}>লগআউট</button></div></>}
      {screen==='messages'&&<div className="ref-surface message-home">
        <header className="message-home-heading"><h1>মেসেজ</h1><button aria-label="মেসেজ করার ইউজার খুঁজুন" onClick={()=>onAction('users')}>⌕</button></header>
        <div className="message-official-links">
          <button onClick={()=>onAction('page','support_chat')}><span>🛡️</span><b>অফিশিয়াল</b><small>অফিশিয়াল সহায়তা ›</small></button>
          <button onClick={()=>onAction('page','notices')}><span>📢</span><b>অফিশিয়াল নোটিশ</b><small>আপডেট দেখুন ›</small></button>
        </div>
        <DirectMessages/>
      </div>}
      {screen==='wallet'&&<><header className="ref-wallet-header"><button className="ref-back" onClick={()=>onScreen('profile')}>‹ ফিরে যান</button><div><button className={walletTab==='recharge'?'selected':''} onClick={()=>setWalletTab('recharge')}>রিচার্জ</button><button className={walletTab==='exchange'?'selected':''} onClick={()=>setWalletTab('exchange')}>এক্সচেঞ্জ</button></div></header><div className="ref-surface"><div className="ref-coin-card"><small>আমার গোল্ড কয়েন</small><b>🪙 {fmt(s.coins)}</b><p>ID {s.id}</p></div><div className="ref-diamond-summary"><span>💎 আপনার ডায়মন্ড</span><b>{fmt(diamonds)}</b></div>{walletTab==='exchange'?<DiamondWallet/>:<><div className="ref-section-title"><h2>রিচার্জ প্যাকেজ</h2><span className="ref-pill">{s.country||'BD'}</span></div><div className="ref-card ref-packages"><p className="ref-muted">প্যাকেজ বেছে অনুমোদিত রিচার্জের অনুরোধ পাঠান।</p>{(s.pk||[]).map((p:any,i:number)=><button key={i} onClick={()=>onAction('recharge',String(i))}><span>🪙 {fmt(p.c)} কয়েন</span><strong>${p.u} ›</strong></button>)}</div><button className="ref-button blue wide" onClick={()=>onAction('page',seller?'seller':'support_chat')}>{seller?'সেলার ওয়ালেট':'রিচার্জের জন্য যোগাযোগ করুন'}</button></>}<button className="ref-button wide seller-list-entry" onClick={()=>onAction('page','coin_sellers')}>Coins seller list · কয়েন সেলার তালিকা</button><WalletRanks/><button className="ref-card ref-room-row wide" onClick={()=>onAction('page','hist')}>🧾 লেনদেনের ইতিহাস ›</button></div></>}
      {screen==='moments'&&<><h1 className="ref-page-title">মোমেন্ট</h1><div className="ref-surface"><div className="ref-card ref-post-form"><textarea maxLength={2000} placeholder="আপনার মনে কী চলছে?" value={post} onChange={e=>setPost(e.target.value)}/><button className="ref-button" disabled={busy||!post.trim()} onClick={()=>void publishPost()}>{busy?'সেভ হচ্ছে…':'পোস্ট করুন'}</button></div>{posts.map(p=><article className="ref-card ref-post" key={p.id}><header><MediaAvatar avatar={p.avatar} size={36}/><div><b data-no-translate="true">{p.name}</b><small>{p.createdAt?.toDate?.().toLocaleString('bn-BD')||'সেভ হচ্ছে…'}</small></div></header><p data-no-translate="true">{p.text}</p></article>)}{!posts.length&&<p className="ref-empty">এখনো কোনো পোস্ট নেই।</p>}</div></>}
      {status&&<p className="ref-status" role="status">{status}</p>}
    </div>
    <nav className="ref-nav" aria-label="মূল নেভিগেশন">{[['rooms','🎙️','রুম'],['moments','🌍','মোমেন্ট'],['messages','✉️','মেসেজ'],['profile','👤','আমি']].map(([key,icon,label])=><button key={key} className={screen===key||key==='rooms'&&['mine','games'].includes(screen)?'selected':''} onClick={()=>onScreen(key as LobbyScreen)} aria-current={screen===key?'page':undefined}><span>{icon}</span>{label}</button>)}</nav>
  </section>;
}
