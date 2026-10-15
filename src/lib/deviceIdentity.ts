// Installation identity: stable across sign-out/accounts, reset by clearing app data.
let cached='';
export function deviceHeaders():Record<string,string>{
 try{if(!cached){cached=localStorage.getItem('earnbd-install-device')||'';if(!/^install-[a-f0-9-]{36}$/.test(cached)){cached='install-'+crypto.randomUUID();localStorage.setItem('earnbd-install-device',cached)}}return {'X-EarnBD-Device':cached}}catch{return {}}
}
