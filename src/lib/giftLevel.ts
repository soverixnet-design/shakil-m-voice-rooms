export const GIFT_COINS_PER_LEVEL = 1000;
/** Uses only cumulative successful gift spend confirmed by the wallet server. */
export function giftLevel(value: unknown) {
 const n=Number(value);const coins=Number.isSafeInteger(n)&&n>=0?n:0;
 const level=Math.floor(coins/GIFT_COINS_PER_LEVEL)+1;
 const progress=coins%GIFT_COINS_PER_LEVEL;
 return {coins,level,progress,remaining:GIFT_COINS_PER_LEVEL-progress,percent:progress/GIFT_COINS_PER_LEVEL*100};
}
