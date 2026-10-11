export async function deliverSelectedGifts(receiverIds:string[],send:(uid:string)=>Promise<any>){
 const ids=[...new Set(receiverIds)];
 if(!ids.length)throw Error('একজন ইউজার সিলেক্ট করুন।');
 const delivered:any[]=[];
 for(let index=0;index<ids.length;index++){
  try{delivered.push(await send(ids[index]))}
  catch(error){return {delivered,remaining:ids.slice(index),error}}
 }
 return {delivered,remaining:[] as string[],error:null};
}
