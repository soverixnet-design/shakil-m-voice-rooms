import {withTimeout} from './authTimeout';
export async function readExistingAccount({request,url,token,isOwner}:{request:typeof fetch;url:string;token:string;isOwner:boolean}){
  const controller=new AbortController();
  try{return await withTimeout((async()=>{
    const response=await request(url,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
    if(response.status===404)return null;
    const body=await response.json();
    if(!response.ok)throw Object.assign(Error(body.error?.status||'firebase-profile-unavailable'),{code:'login/firebase-profile-unavailable'});
    const fields=body.fields||{};
    const status=fields.status?.stringValue;
    if(['banned','archived'].includes(status))throw Error('inactive-user');
    const id=fields.id?.stringValue||fields.id?.integerValue;
    if(!id)return null;
    const coins=Number(fields.coins?.integerValue??fields.coins?.doubleValue??0);
    if(!Number.isSafeInteger(coins)||coins<0)throw Error('invalid-profile-balance');
    return {id:String(id),name:fields.name?.stringValue||'User',photoURL:fields.photoURL?.stringValue||'',coins,role:isOwner?'admin':'user'};
  })(),10000)}finally{controller.abort()}
}
