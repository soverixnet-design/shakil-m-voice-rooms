import test from 'node:test';import assert from 'node:assert/strict';import {giftLevel} from '../src/lib/giftLevel.ts';
test('levels start at one and increase at progressively higher gift thresholds',()=>{
 assert.deepEqual(giftLevel(0),{coins:0,level:1,progress:0,required:1000,remaining:1000,percent:0});
 for(const [coins,level] of [[999,1],[1000,2],[2499,2],[2500,3],[4749,3],[4750,4],[30000000,24],[20000000,23]])assert.equal(giftLevel(coins).level,level);
 assert.equal(giftLevel(1250).remaining,1250);assert.equal(giftLevel(1750).percent,50);
});
test('confirmed gifts stay stable and invalid data cannot raise levels',()=>{
 assert.deepEqual(giftLevel(5000),giftLevel(5000));for(const value of [undefined,-1,NaN,Infinity,100.5])assert.equal(giftLevel(value).level,1);
 const maximum=giftLevel(Number.MAX_SAFE_INTEGER);assert(maximum.percent>=0&&maximum.percent<100);assert(maximum.remaining>0);
});
