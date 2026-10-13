import test from 'node:test';import assert from 'node:assert/strict';import {giftLevel} from '../src/lib/giftLevel.ts';
test('gift level advances only at cumulative successful spend thresholds',()=>{
 assert.deepEqual(giftLevel(0),{coins:0,level:1,progress:0,remaining:1000,percent:0});
 assert.equal(giftLevel(999).level,1);assert.equal(giftLevel(1000).level,2);assert.equal(giftLevel(10000).level,11);
 assert.equal(giftLevel(1250).remaining,750);assert.equal(giftLevel(1250).percent,25);
});
test('confirmed cumulative spend is stable on repeated reads and invalid data cannot raise levels',()=>{
 assert.deepEqual(giftLevel(5000),giftLevel(5000));for(const value of [undefined,-1,NaN,Infinity,100.5])assert.equal(giftLevel(value).level,1);
});
