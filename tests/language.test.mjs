import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const script=fs.readFileSync('public/ui-language.js','utf8');

test('English stays locked across old Bangla preferences while preserving user-generated content',async()=>{
 const dom=new JSDOM('<body><button>আমার রুম</button><span data-no-translate>আমি</span><div data-no-translate>বাংলা মেসেজ রুম</div><input value="বাংলা কথা" placeholder="রুমের নাম"><textarea>বাংলা মেসেজ</textarea></body>',{url:'https://earnbd.work',runScripts:'outside-only'});
 try{
  dom.window.localStorage.setItem('earnbd-language','bn');
  dom.window.eval(script);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await new Promise(r=>setTimeout(r,0));
  assert.equal(dom.window.EarnBDLanguage.get(),'en');
  assert.equal(dom.window.localStorage.getItem('earnbd-language'),'en');
  assert.equal(dom.window.document.documentElement.lang,'en');
  assert.equal(dom.window.document.querySelector('button').textContent,'My room');
  assert.equal(dom.window.document.querySelector('input').value,'বাংলা কথা');
  assert.equal(dom.window.document.querySelector('input').placeholder,'Room name');
  assert.equal(dom.window.document.querySelector('[data-no-translate]').textContent,'আমি');
  assert.equal(dom.window.document.querySelector('textarea').value,'বাংলা মেসেজ');
  dom.window.EarnBDLanguage.set('bn');
  assert.equal(dom.window.EarnBDLanguage.get(),'en');
  assert.equal(dom.window.localStorage.getItem('earnbd-language'),'en');
  assert.equal(dom.window.document.querySelector('button').textContent,'My room');
  const p=dom.window.document.createElement('p');
  p.textContent='রুম ছেড়ে চলে যান';
  dom.window.document.body.append(p);
  await new Promise(r=>setTimeout(r,0));
  assert.equal(p.textContent,'Leave room');
 }finally{dom.window.close()}
});
