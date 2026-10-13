import {gameServerUrl} from './gameServerUrl';
import {withTimeout} from './authTimeout';
const socialRoots=new Set(['users','rooms','roomOwners','follows','moments','diamondWallets','transactions','admins','assets','system','supportTickets','sellerWallets','sellerTransfers','sharedGames','gameRanks','gameReceipts','gameWins']);
export function socialPath(path:string){return socialRoots.has(path.split('/')[0]);}
export function createSocialTransport(url:string,nameRoot:string,request:typeof fetch=fetch){
 return async(suffix:string,options:any,token:string)=>{
  let data:any;
  if(suffix===':commit'){
   const body=JSON.parse(options.body||'{}');
   const paths=(body.writes||[]).map((w:any)=>(w.update?.name||w.delete||w.verify||'').slice(nameRoot.length+1));
   if(!paths.some(socialPath))return {handled:false};
   if(!paths.every(socialPath))throw Object.assign(Error('Mixed database writes are unavailable.'),{code:'failed-precondition'});
   data={action:'commit',writes:body.writes};
  }else if(suffix.endsWith(':runQuery')){
   const parent=suffix.slice(0,-':runQuery'.length).replace(/^\//,''),body=JSON.parse(options.body||'{}');
   const collection=body.structuredQuery?.from?.[0]?.collectionId;
   if(!socialPath((parent?parent+'/':'')+collection))return {handled:false};
   data={action:'query',parent,structuredQuery:body.structuredQuery};
  }else{
   const path=suffix.replace(/^\//,'');if(!socialPath(path))return {handled:false};
   data={action:'get',path};
  }
  const controller=new AbortController();
  try{
   return await withTimeout((async()=>{
    const response=await request(gameServerUrl(url)+'/api/social',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(data),signal:controller.signal});
    const result=await response.json();
    if(!response.ok||result.error)throw Object.assign(Error(result.error?.message||'Social database unavailable.'),{code:result.error?.code||'unavailable'});
    return {handled:true,body:result.data};
   })(),20000);
  }finally{controller.abort();}
 };
}
