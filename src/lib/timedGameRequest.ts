import {requestJson} from './resilientRequest';
export async function timedGameRequest(url:string,options:RequestInit,{retryable=false,timeoutMs=75000,request=fetch,clock=()=>performance.now(),pause}:{retryable?:boolean;timeoutMs?:number;request?:typeof fetch;clock?:()=>number;pause?:(ms:number)=>Promise<void>}={}){
 let sent=0,received=0;
 const measured:typeof fetch=async(input,init)=>{sent=clock();const response=await request(input,init);received=clock();return response};
 const result=await requestJson(url,options,{retryable,timeoutMs,request:measured,pause});
 return {...result,timing:{sent,received}};
}
