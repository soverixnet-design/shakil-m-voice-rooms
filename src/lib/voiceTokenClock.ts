/** Token renewal uses elapsed time, so changing the phone clock cannot delay refresh. */
export function voiceTokenDeadline(config:{expiresAt?:number;serverNow?:number},sent:number,received:number){
 const lifetime=Number.isFinite(config.serverNow)&&Number.isFinite(config.expiresAt)?Number(config.expiresAt)-Number(config.serverNow):60000;
 return received+Math.max(0,lifetime-Math.max(0,received-sent));
}
