import {gameServerUrl} from './gameServerUrl';
/** Wake an idle profile service while the account picker is open. Never gate login on this probe. */
export function createAccountServerWarmup(request:typeof fetch=fetch){
 let pending:Promise<void>|undefined,lastStarted=-Infinity;
 return (url:string,now=Date.now())=>{
  if(pending)return pending;
  if(now-lastStarted<60000)return Promise.resolve();
  let base:string;try{base=gameServerUrl(url)}catch{return Promise.resolve()}
  lastStarted=now;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),75000);
  const job=Promise.resolve().then(()=>request(base+'/health',{signal:controller.signal,cache:'no-store'})).then(()=>{},()=>{}).finally(()=>{clearTimeout(timer);if(pending===job)pending=undefined});
  pending=job;return job;
 };
}
export const warmAccountServer=createAccountServerWarmup();
