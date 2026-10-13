import test from 'node:test';import assert from 'node:assert/strict';import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {JSDOM} from 'jsdom';import {LobbyBannerCarousel,DEFAULT_LOBBY_SLIDES} from '../src/components/LobbyBannerCarousel.tsx';
test('carousel rotates every five seconds, supports slide selection and opens event details',async()=>{
 const dom=new JSDOM('<div id="test"></div>',{pretendToBeVisual:true});const saved={window:globalThis.window,document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true});
 const intervals=new Map();let timer=0;globalThis.setInterval=(fn,ms)=>{if(ms!==5000)return saved.setInterval(fn,ms);const id='carousel-'+(++timer);intervals.set(id,fn);return id;};globalThis.clearInterval=id=>intervals.has(id)?intervals.delete(id):saved.clearInterval(id);
 const root=createRoot(document.getElementById('test'));let selected='';
 try{
  const slides=[{id:'image',name:'Banner',image:'data:image/png;base64,YQ=='},{id:'event',name:'Festival',eventId:'festival',title:'Festival'}];
  await act(async()=>root.render(React.createElement(LobbyBannerCarousel,{slides,onEvent:id=>selected=id})));
  assert.equal(document.querySelectorAll('.lobby-banner-slide').length,3);
  await act(async()=>[...intervals.values()][0]());assert.equal(document.querySelector('.lobby-banner-track').style.transform,'translateX(-100%)');
  await act(async()=>document.querySelector('.lobby-event-banner').click());assert.equal(selected,'festival');
  await act(async()=>document.querySelector('.lobby-banner-dots button').click());assert.equal(document.querySelector('.lobby-banner-track').style.transform,'translateX(-0%)');
  await act(async()=>root.render(React.createElement(LobbyBannerCarousel,{slides:[],onEvent:()=>{}})));assert.equal(document.querySelectorAll('.lobby-banner-dots button').length,3);assert.deepEqual(DEFAULT_LOBBY_SLIDES.map(x=>x.lang),['bn','en','ar']);
 }finally{await act(async()=>root.unmount());Object.assign(globalThis,saved);dom.window.close();}
});
