/** Each successive level needs 50% more gift value; existing confirmed gifts are preserved. */
export function giftLevel(value: unknown) {
 const n=Number(value);const coins=Number.isSafeInteger(n)&&n>=0?n:0;
 const threshold=(level:number)=>Math.ceil(2000*(Math.pow(1.5,level-1)-1));
 let level=1;
 while(coins>=threshold(level+1))level++;
 const start=threshold(level),required=threshold(level+1)-start,progress=coins-start;
 return {coins,level,progress,required,remaining:required-progress,percent:progress/required*100};
}
