// Retry only reads or operations protected by a persistent request receipt.
export async function requestJson(url:string,options:RequestInit,{retryable=false,request=fetch,pause=(ms:number)=>new Promise(r=>setTimeout(r,ms)),timeoutMs=75000}={}){
 const body=options.body,deadline=Date.now()+timeoutMs;
 for(let attempt=0;;attempt++){
  const remaining=deadline-Date.now();if(remaining<=0)throw Object.assign(Error('server-timeout'),{code:'functions/unavailable'});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),remaining);
  try{
   const response=await request(url,{...options,body,signal:controller.signal});
   let result:any;try{result=await response.json();}catch{throw Object.assign(Error('server-unavailable'),{code:'functions/unavailable'});}
   if(response.ok&&!result.error)return result;
   const error=Object.assign(Error(result.error?.message||'server-unavailable'),{code:`functions/${result.error?.code||'unavailable'}`,retryable:false});
   if(!retryable||attempt>=2||![502,503,504].includes(response.status)&&!(response.status===409&&result.error?.code==='aborted'))throw error;
  }catch(error:any){
   if(!retryable||attempt>=2||error?.retryable===false||!['TypeError','AbortError'].includes(error?.name)&&!['functions/unavailable','functions/aborted'].includes(error?.code))throw error;
  }finally{clearTimeout(timer);}
  await pause(250*2**attempt);
 }
}
