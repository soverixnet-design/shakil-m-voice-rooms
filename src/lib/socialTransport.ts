import {deviceHeaders} from './deviceIdentity';
import serverConfig from '../../game-server-config.json';
import {createGameServerSelector,isBackendUnavailable} from './serverFailover';
import {withTimeout} from './authTimeout';
const socialRoots=new Set(['users','rooms','roomOwners','follows','moments','diamondWallets','transactions','admins','assets','system','supportTickets','sellerWallets','sellerTransfers','sharedGames','gameRanks','gameReceipts','gameWins','liveAnnouncements','directMessages','roomApplications','pushDevices']);
export function socialPath(path:string){return socialRoots.has(path.split('/')[0]);}
export function createSocialTransport(url:string,nameRoot:string,request:typeof fetch=fetch){
 const selector=createGameServerSelector({request});
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
  let selected='';
  try{
   return await withTimeout((async()=>{
    selected=await selector.choose(url,serverConfig.backupUrl);
    const response=await request(selected+'/api/social',{method:'POST',headers:{...deviceHeaders(),'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(data),signal:controller.signal});
    const result=await response.json();
    if(!response.ok||result.error)throw Object.assign(Error(result.error?.message||'Social database unavailable.'),{code:result.error?.code||'unavailable'});
    return {handled:true,body:result.data};
   })(),75000);
  }catch(error){if(selected&&isBackendUnavailable(error))selector.fail(selected);throw error}finally{controller.abort();}
 };
}
