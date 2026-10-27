import {randomInt} from 'node:crypto';

// Lucky Gift outcomes are decided on the server, never by the phone or browser.
// Basis points: 10_000 = 100%. No rewards or debits unless an admin enables
// a valid configuration in system/luckyGiftConfig.
export const LUCKY_MULTIPLIERS=Object.freeze([5,10,50,100]);
export const DEFAULT_LUCKY_GIFTS=Object.freeze([
 {id:'kitty',name:'Lucky Cat',emoji:'🐱',cost:20},
 {id:'butterfly',name:'Butterfly',emoji:'🦋',cost:40},
 {id:'hat',name:'Magic Hat',emoji:'🎩',cost:60},
 {id:'drum',name:'Lucky Drum',emoji:'🥁',cost:60},
 {id:'love',name:'Love Wand',emoji:'💝',cost:100},
 {id:'bells',name:'Golden Bells',emoji:'🔔',cost:200},
 {id:'star',name:'Happy Star',emoji:'🌟',cost:400},
 {id:'flower',name:'Wind Flower',emoji:'🌺',cost:500}
]);

function invalid(reason){return Object.assign(Error(reason),{code:'failed-precondition'});}
export function validateLuckySettings(config){
 if(!config||config.enabled!==true)throw invalid('lucky-gifts-disabled');
 const chances=config.chancesBps;
 if(!chances||typeof chances!=='object'||Array.isArray(chances))throw invalid('lucky-config-invalid');
 const keys=Object.keys(chances);
 if(keys.some(key=>!LUCKY_MULTIPLIERS.includes(Number(key))))throw invalid('lucky-config-invalid');
 let sum=0;
 for(const multiplier of LUCKY_MULTIPLIERS){
  const value=chances[String(multiplier)];
  if(!Number.isSafeInteger(value)||value<0||value>10000)throw invalid('lucky-config-invalid');
  sum+=value;
 }
 if(sum>10000)throw invalid('lucky-config-invalid');
 const maxPayout=Number(config.maxPayout);
 if(!Number.isSafeInteger(maxPayout)||maxPayout<100||maxPayout>1000000000)throw invalid('lucky-config-invalid');
 return {chancesBps:chances,maxPayout,expectedReturnBps:LUCKY_MULTIPLIERS.reduce((n,m)=>n+m*chances[String(m)],0)};
}
export function luckyOutcome(totalCost,validatedSettings,draw=randomInt){
 if(!Number.isSafeInteger(totalCost)||totalCost<1||totalCost>100000000)throw invalid('invalid-lucky-cost');
 const {chancesBps,maxPayout}=validatedSettings;
 const roll=draw(10000);
 if(!Number.isSafeInteger(roll)||roll<0||roll>=10000)throw invalid('lucky-random-invalid');
 let threshold=0,multiplier=0;
 for(const candidate of LUCKY_MULTIPLIERS){
  threshold+=chancesBps[String(candidate)];
  if(roll<threshold){multiplier=candidate;break;}
 }
 const reward=totalCost*multiplier;
 if(!Number.isSafeInteger(reward)||reward>maxPayout)throw invalid('lucky-payout-limit');
 return {roll,multiplier,reward};
}

export function luckyBatchOutcome(unitCost,quantity,settings,draw=randomInt){
 if(!Number.isSafeInteger(unitCost)||unitCost<1||unitCost>1000000||
    !Number.isSafeInteger(quantity)||quantity<1||quantity>777)throw invalid('invalid-lucky-cost');
 const totalCost=unitCost*quantity;
 if(!Number.isSafeInteger(totalCost)||totalCost>100000000)throw invalid('invalid-lucky-cost');
 let reward=0,wins=0,highestMultiplier=0;
 for(let i=0;i<quantity;i++){
  const result=luckyOutcome(unitCost,settings,()=>draw(10000,i));
  reward+=result.reward;
  if(result.multiplier){wins++;highestMultiplier=Math.max(highestMultiplier,result.multiplier)}
  if(!Number.isSafeInteger(reward)||reward>settings.maxPayout)throw invalid('lucky-payout-limit');
 }
 return {reward,wins,multiplier:highestMultiplier};
}
