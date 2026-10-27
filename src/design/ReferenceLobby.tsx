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
  const [country,setCountry]=useState('all'),[listLayout,setListLayout]=useState(false),[lobbyEvents,setLobbyEvents]=useState<any[]>([]),[selectedEvent,setSelectedEvent]=useState<string|null>(null),[rankView,setRankView]=useState<{kind:string;period:string}|null>(null),[rankPreview,setRankPreview]=useState<any[]>([]),[category,setCategory]=useState('All'),[walletTab,setWalletTab]=useState('recharge'),[diamonds,setDiamonds]=useState(0),[posts,setPosts]=useState<any[]>([]),[post,setPost]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(!auth.currentUser)return;return onSnapshot(doc(db,'diamondWallets',auth.currentUser.uid),v=>setDiamonds(Number(v.data()?.balance||0)),()=>setStatus('Wallet data could not load. Check database rules.'))},[]);
  useEffect(()=>{if(screen!=='moments')return;return onSnapshot(query(collection(db,'moments'),orderBy('createdAt','desc'),limit(50)),v=>setPosts(v.docs.map(d=>({id:d.id,...d.data()}))),()=>setStatus('Moments could not load. Check your database rules.'))},[screen]);
  const banners=media.filter(x=>x.kind==='banner');
  const flags=[...new Set<string>(s.rooms.map((r:any)=>roomFlag(r)))];
  const rooms=visibleRooms(s.rooms,country);
  useEffect(()=>{if(screen!=='rooms')return;let live=true;void walletApi('events',{action:'rankings',kind:'sending',period:'weekly'}).then(r=>{if(live)setRankPreview(r.rows.slice(0,3));}).catch(()=>{});return()=>{live=false;};},[screen]);
  useEffect(()=>{if(screen!=='rooms')return;let alive=true;async function load(){try{const result=await walletApi('events',{action:'list'});if(alive)setLobbyEvents(result.events.filter((e:any)=>e.phase==='active'||e.phase==='upcoming'));}catch{}}void load();const timer=setInterval(()=>void load(),30000);return()=>{alive=false;clearInterval(timer);};},[screen]);
  const bannerSlides=[...banners.map(b=>({id:b.id,name:b.name,image:b.image})),...lobbyEvents.map(e=>({id:'event-'+e.id,name:e.title,title:e.title,image:e.banner||undefined,eventId:e.id,subtitle:e.phase==='active'?'Event live · View details ›':'Upcoming event · View details ›'}))];
  async function publishPost(){if(busy||!post.trim()||!auth.currentUser)return;setBusy(true);try{await addDoc(collection(db,'moments'),{userId:auth.currentUser.uid,text:post.trim(),name:s.name,avatar:s.img||s.av||'👤',createdAt:serverTimestamp()});setPost('');setStatus('✅ Post saved')}catch{setStatus('Could not save post. Check connection and rules.')}finally{setBusy(false)}}
  function roomList(followed:boolean){return roomLibrary.filter(x=>followed?x.followed:x.visitedAt).map(x=>s.rooms.find((r:any)=>String(r.id)===x.id)).filter(Boolean)}
  const roomRow=(r:any)=><button className="ref-card ref-room-row" key={r.id} onClick={()=>onAction('room',String(r.id))}><span className="ref-avatar"><MediaAvatar avatar={r.photoURL||r.cv} size={50}/></span><span><b data-no-translate="true">{r.name}</b><small>{r.sc||8} mics · {r.host||'Voice room'}</small></span><strong>Enter ›</strong></button>;
  const actions=[['🛍️','Shop','store'],['🏅','Badges','items'],['🖼️','Frames','frames'],['🎯','Tasks','tasks']];
  return <section className={'reference-lobby screen-'+screen} aria-label="EarnBD app">
    <div className="ref-scroll" key={screen}><div className="ref-language-bar"><LanguagePicker/></div>
      {['rooms','mine','games'].includes(screen)&&<><header className="ref-top-tabs"><button className={screen==='mine'?'selected':''} onClick={()=>onScreen('mine')}>Me</button><button className={screen==='rooms'?'selected':''} onClick={()=>onScreen('rooms')}>Hot</button><button className={screen==='games'?'selected':''} onClick={()=>onScreen('games')}>Games</button><button className="ref-orb" aria-label="Search users" onClick={()=>onAction('users')}>⌕</button></header><ServerStatus/></>}
      {screen==='rooms'&&<>
        <div className="lobby-ranking-cards">
          <button className="lobby-rank-feature" onClick={()=>setRankView({kind:'sending',period:'weekly'})}><b>Ranking</b><div className="lobby-podium">{rankPreview.length?rankPreview.map((u,i)=><span key={u.id}><small>{['🥇','🥈','🥉'][i]}</small><MediaAvatar avatar={u.avatar} size={i===0?64:48}/></span>):<span className="lobby-crown">👑 🏆 👑</span>}</div><small>Sending · Receiving ›</small></button>
          <button className="lobby-cp-feature" onClick={()=>setRankView({kind:'cp',period:'weekly'})}><b>CP</b><span>💞</span><small>Gift pairs ›</small></button>
          <button className="lobby-week-feature" onClick={()=>setRankView({kind:'sending',period:'weekly'})}><b>Week</b><span>🥇 🥈 🥉</span><small>Weekly / Monthly ›</small></button>
        </div>
        <LobbyBannerCarousel slides={bannerSlides} onEvent={setSelectedEvent} onManage={admin?()=>onAction('page','admin'):undefined}/>

        <div className="lobby-room-surface"><div className="lobby-country-bar"><div className="ref-chips"><button className={country==='all'?'selected':''} onClick={()=>setCountry('all')}>All</button>{flags.map(flag=><button key={flag} aria-label={`${flag} rooms in this country`} className={country===flag?'selected':''} onClick={()=>setCountry(flag)}>{flag}</button>)}</div><button className="lobby-layout-button" aria-label="Change room layout" onClick={()=>setListLayout(v=>!v)}>{listLayout?'▦':'☷'}</button></div>
          <div className={'lobby-showcase-rooms '+(listLayout?'list':'')}>{rooms.map((r:any,i:number)=><button className="lobby-showcase-room" key={r.id} onClick={()=>onAction('room',String(r.id))}><div className="lobby-showcase-art" style={{background:roomThemes[Number(r.th||0)%4]}}>{/^(https:\/\/|data:image\/)/.test(r.photoURL||r.cv||'')?<img src={r.photoURL||r.cv} alt={r.name}/>:<span>{r.cv||'🎙️'}</span>}<span className="lobby-room-country">{roomFlag(r)}</span><small className="lobby-room-tag">{r.locked?'🔒':r.tag||r.c||'Voice'}</small><span className="lobby-room-crown">♛</span></div><b data-no-translate="true">{r.name}</b><small>{r.sc||8} mics · {r.host||'Voice room'}</small></button>)}</div>
          {!rooms.length&&<p className="ref-empty">No rooms in this country yet.</p>}

        </div>
      </>}
      {selectedEvent&&<div className="ref-overlay"><section className="ref-entry"><button className="ref-back" onClick={()=>setSelectedEvent(null)}>‹ Back</button><EventCenter initialEventId={selectedEvent==='all'?undefined:selectedEvent}/></section></div>}
      {rankView&&<LobbyRankings {...rankView} media={media} onUser={uid=>{setRankView(null);onAction('users',uid)}} onClose={()=>setRankView(null)}/>}
      {screen==='mine'&&<><div className="ref-me-banner"><span className="ref-avatar"><MediaAvatar avatar={s.img||s.av} size={60}/></span><div><h1 data-no-translate="true">{s.name}</h1><p>ID: {s.id}</p></div><button className="ref-pill" onClick={()=>onScreen('profile')}>Profile ›</button></div><div className="ref-surface"><h2>My room</h2>{myRoom?<>{roomRow(myRoom)}<p className="ref-muted">Manage your own room photo and seat permissions from room settings.</p></>:<div className="ref-card ref-create-teaser"><span>🎙️</span><h2>Your own place to hang out</h2><p>Customize your room with a photo, name and theme</p><button className="ref-button wide" onClick={()=>onAction('create-room')}>Create room</button></div>}
        {[['Recent rooms',false],['Followed rooms',true]].map(([title,follow])=><section key={String(title)}><h2>{String(title)}</h2>{roomList(Boolean(follow)).map(roomRow)}{!roomList(Boolean(follow)).length&&<p className="ref-empty">{follow?'Follow a room from its profile to see it here.':'Rooms you visit will appear here.'}</p>}</section>)}</div></>}
      {screen==='games'&&<><div className="ref-card ref-games-banner"><span>🏆</span><h1>One shared round, same time for everyone</h1><button onClick={()=>onAction('page','game_rank')}>Daily / weekly rankings ›</button></div><div className="ref-surface"><div className="ref-games-grid">{liveGames.map(g=><article className="ref-card ref-game-card" key={g.id}><div className="ref-game-art" style={{background:`linear-gradient(${g.color},#1A1040)`}}><span>{g.icon}</span><small>Live round</small></div><h2>{g.name}</h2><button className="ref-button green wide" onClick={()=>onAction('game',g.id)}>Open</button></article>)}</div><p className="ref-muted">Balances, bets and results are saved on the server.</p></div></>}
      {screen==='profile'&&<><header className="ref-profile-hero"><button className="ref-back" onClick={()=>onScreen('rooms')}>‹ Back</button><span className="ref-avatar large"><MediaAvatar avatar={s.img||s.av} frame={media.find(a=>a.id===activeRankingAward(s)?.frameId)?.image} size={112}/></span><h1 data-no-translate="true">{s.name}</h1><p>ID: {s.id}</p><div className="ref-chips"><button onClick={()=>onAction('page','level')} aria-label="Sending and receiving levels"><ProfileLevels user={s}/></button>{s.svip>0&&<span>SVIP {s.svip}</span>}</div><button className="ref-pill" onClick={()=>onAction('page','edit_profile')}>✎ Edit profile</button></header><div className="ref-surface profile-surface"><div className="ref-social-counts">{[[s.followerCount||0,'Followers'],[(s.follow||[]).length,'Following'],[s.visitorCount||0,'Visitors']].map(([n,label])=><div key={label}><b>{fmt(n)}</b><small>{label}</small></div>)}</div>{activeRankingAward(s)&&<p className="profile-ranking-award">🏅 {activeRankingAward(s).badgeName||activeRankingAward(s).title} · {new Date(activeRankingAward(s).expiresAt).toLocaleDateString()} (expiry date)</p>}<ProfilePhotoEditor/>
        <div className="ref-quick-links">{actions.map(([icon,label,page])=><button className="ref-card" key={page} onClick={()=>onAction('page',page)}><span>{icon}</span>{label}</button>)}</div>
        <button className="ref-card ref-profile-wallet" onClick={()=>onScreen('wallet')}><b>Wallet ›</b><span>🪙 {fmt(s.coins)} &nbsp; 💎 {fmt(diamonds)}</span></button>
        <div className="ref-card ref-link-list">{[['🎙️','My room',()=>onScreen('mine')],['✨','Entry effects','entries'],['👑','SVIP','svip'],['🎁','Invite rewards','invite'],['🧾','Transaction history','hist'],['🪙','Coin seller directory','coin_sellers'],['🎧','Customer support','support_chat'],['📜','Privacy Policy','policy_privacy'],['📋','Terms & Conditions','policy_terms'],...(seller?[['🪙','Seller wallet','seller']]:[]),...((admin||staff)?[['🛡️','Admin panel','admin']]:[])].map(([icon,label,page])=><button key={String(label)} onClick={()=>typeof page==='function'?page():onAction('page',String(page))}><span>{String(icon)} {String(label)}</span>›</button>)}</div><button className="ref-button wide" onClick={()=>onAction('logout')}>Sign out</button></div></>}
      {screen==='messages'&&<div className="ref-surface message-home">
        <header className="message-home-heading"><h1>Messages</h1><button aria-label="Find a user to message" onClick={()=>onAction('users')}>⌕</button></header>
        <div className="message-official-links">
          <button onClick={()=>onAction('page','support_chat')}><span>🛡️</span><b>Official</b><small>Official support ›</small></button>
          <button onClick={()=>onAction('page','notices')}><span>📢</span><b>Official notices</b><small>View updates ›</small></button>
        </div>
        <DirectMessages/>
      </div>}
      {screen==='wallet'&&<><header className="ref-wallet-header"><button className="ref-back" onClick={()=>onScreen('profile')}>‹ Back</button><div><button className={walletTab==='recharge'?'selected':''} onClick={()=>setWalletTab('recharge')}>Recharge</button><button className={walletTab==='exchange'?'selected':''} onClick={()=>setWalletTab('exchange')}>Exchange</button></div></header><div className="ref-surface"><div className="ref-coin-card"><small>My gold coins</small><b>🪙 {fmt(s.coins)}</b><p>ID {s.id}</p></div><div className="ref-diamond-summary"><span>💎 Your diamonds</span><b>{fmt(diamonds)}</b></div>{walletTab==='exchange'?<DiamondWallet/>:<><div className="ref-section-title"><h2>Recharge packages</h2><span className="ref-pill">{s.country||'BD'}</span></div><div className="ref-card ref-packages"><p className="ref-muted">Choose a package and send a recharge request for approval.</p>{(s.pk||[]).map((p:any,i:number)=><button key={i} onClick={()=>onAction('recharge',String(i))}><span>🪙 {fmt(p.c)} coins</span><strong>${p.u} ›</strong></button>)}</div><button className="ref-button blue wide" onClick={()=>onAction('page',seller?'seller':'support_chat')}>{seller?'Seller wallet':'Contact recharge support'}</button></>}<button className="ref-button wide seller-list-entry" onClick={()=>onAction('page','coin_sellers')}>Coins seller directory</button><WalletRanks/><button className="ref-card ref-room-row wide" onClick={()=>onAction('page','hist')}>🧾 Transaction history ›</button></div></>}
      {screen==='moments'&&<><h1 className="ref-page-title">Moments</h1><div className="ref-surface"><div className="ref-card ref-post-form"><textarea maxLength={2000} placeholder="What's on your mind?" value={post} onChange={e=>setPost(e.target.value)}/><button className="ref-button" disabled={busy||!post.trim()} onClick={()=>void publishPost()}>{busy?'Saving…':'Post'}</button></div>{posts.map(p=><article className="ref-card ref-post" key={p.id}><header><MediaAvatar avatar={p.avatar} size={36}/><div><b data-no-translate="true">{p.name}</b><small>{p.createdAt?.toDate?.().toLocaleString('en-US')||'Saving…'}</small></div></header><p data-no-translate="true">{p.text}</p></article>)}{!posts.length&&<p className="ref-empty">No posts yet.</p>}</div></>}
      {status&&<p className="ref-status" role="status">{status}</p>}
    </div>
    <nav className="ref-nav" aria-label="Main navigation">{[['rooms','🎙️','Rooms'],['moments','🌍','Moments'],['messages','✉️','Messages'],['profile','👤','Me']].map(([key,icon,label])=><button key={key} className={screen===key||key==='rooms'&&['mine','games'].includes(screen)?'selected':''} onClick={()=>onScreen(key as LobbyScreen)} aria-current={screen===key?'page':undefined}><span>{icon}</span>{label}</button>)}</nav>
  </section>;
}
