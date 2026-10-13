export async function ensureVoiceMembership(tx:any,ref:any,roomId:string,entrySeat:number|null,heartbeat:any){
 const snapshot=await tx.get(ref),profile=snapshot.data();
 if(profile?.currentRoomId===roomId)return;
 tx.update(ref,{currentRoomId:roomId,roomSeat:entrySeat,online:true,lastSeen:heartbeat});
}
