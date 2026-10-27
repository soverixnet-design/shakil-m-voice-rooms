import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameServerSelector,isBackendUnavailable} from '../src/lib/serverFailover.ts';

const render='https://shakil-m-voice-rooms.onrender.com';
const backup='https://api.earnbd.work';
const ok=()=>new Response(JSON.stringify({status:'ok'}),{status:200,headers:{'Content-Type':'application/json'}});

test('single-server setting makes no additional health calls', async()=>{
  let calls=0;
  const selector=createGameServerSelector({request:async()=>{calls++;return ok()}});
  assert.equal(await selector.choose(render),render);
  assert.equal(calls,0);
});

test('failed Render health selects DigitalOcean and caches the result',async()=>{
  let now=0,calls=[];
  const selector=createGameServerSelector({
    now:()=>now,
    request:async url=>{calls.push(String(url));if(String(url).startsWith(render))throw new TypeError('offline');return ok();}
  });
  assert.equal(await selector.choose(render,backup),backup);
  assert.equal(await selector.choose(render,backup),backup);
  assert.equal(calls.length,2);
  now+=21000;
  assert.equal(await selector.choose(render,backup),backup);
  assert.equal(calls.length,4);
});

test('server failure invalidates cached health before the next request',async()=>{
  let hits=0;
  const selector=createGameServerSelector({request:async()=>{hits++;return ok()}});
  assert.equal(await selector.choose(render,backup),render);
  selector.fail(render);
  assert.equal(await selector.choose(render,backup),backup);
  assert.equal(hits,2);
});

test('unhealthy database status does not count as a healthy API',async()=>{
  const selector=createGameServerSelector({request:async url=>String(url).startsWith(render)
    ?new Response(JSON.stringify({status:'database-unavailable'}),{status:200})
    :ok()});
  assert.equal(await selector.choose(render,backup),backup);
});

test('both unhealthy endpoints fail closed and invalid backup host is rejected',async()=>{
  const selector=createGameServerSelector({request:async()=>{throw new TypeError('offline')}});
  await assert.rejects(selector.choose(render,backup),error=>error.code==='functions/unavailable');
  await assert.rejects(selector.choose(render,'http://1.2.3.4'),/Render/);
  assert.equal(isBackendUnavailable(new TypeError('failed')),true);
  assert.equal(isBackendUnavailable(Object.assign(Error('offline'),{code:'functions/unavailable'})),true);
  assert.equal(isBackendUnavailable(Object.assign(Error('bad-bet'),{code:'functions/invalid-argument'})),false);
});

test('dedicated DigitalOcean HTTPS name works without accepting lookalike hosts',async()=>{
  const backup='https://shakilm-api.soverixnet.online';
  const selector=createGameServerSelector({request:async url=>String(url).startsWith(render)
    ?new Response(JSON.stringify({status:'database-unavailable'}),{status:503})
    :ok()});
  assert.equal(await selector.choose(render,backup),backup);
  await assert.rejects(selector.choose(render,'https://shakilm-api.soverixnet.online.evil.example'),/Render/);
  await assert.rejects(selector.choose(render,'http://shakilm-api.soverixnet.online'),/Render/);
});
