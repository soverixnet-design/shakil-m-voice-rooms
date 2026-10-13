export async function updateVoicePublication({client,track,config,wants,allowed,alive,published}:any){
 const stop=async()=>{if(track)await track.setEnabled(false);if(published){await client.unpublish();published=false;}await client.setClientRole('audience');return {published:false,speaking:false};};
 if(!alive())return {published:false,speaking:false};
 await client.renewToken(config.token);
 if(!alive())return {published:false,speaking:false};
 if(!wants||!allowed()||!config.canPublish||!track)return stop();
 await client.setClientRole('host');
 if(!alive()||!allowed())return stop();
 await track.setEnabled(true);
 if(!alive()||!allowed())return stop();
 try{if(!published)await client.publish(track);}catch(error){await track.setEnabled(false);throw error;}
 if(!alive()||!allowed()){await track.setEnabled(false);await client.unpublish();return {published:false,speaking:false};}
 return {published:true,speaking:true};
}
export function voiceFailure(error:any){
 const code=String(error?.code||error?.name||'');
 if(['PERMISSION_DENIED','NotAllowedError','SecurityError'].includes(code))return 'মাইক্রোফোনের অনুমতি বন্ধ আছে। ব্রাউজার Site settings → Microphone → Allow করুন।';
 if(['DEVICE_NOT_FOUND','NotFoundError'].includes(code))return 'ফোনের মাইক্রোফোন পাওয়া যায়নি।';
 if(['NOT_READABLE','NotReadableError','TRACK_IS_DISABLED'].includes(code))return 'মাইক্রোফোন অন্য অ্যাপে ব্যস্ত থাকতে পারে। অন্য কল বন্ধ করে আবার চেষ্টা করুন।';
 if(code==='functions/permission-denied')return 'রুমের সদস্যপদ বা সিটের অনুমতি পাওয়া যায়নি। রুমে আবার ঢুকুন।';
 if(error?.message==='seat-permission-required')return 'সিটের অনুমতি পাওয়া যায়নি বা অ্যাডমিন মিউট করেছেন। সিটে আবার বসুন।';
 if(error?.message==='agora-not-configured')return 'সার্ভারের Agora App ID ও Certificate সঠিকভাবে সেট করা নেই।';
 if(['INVALID_TOKEN','CAN_NOT_GET_GATEWAY_SERVER','TOKEN_EXPIRED'].includes(code))return 'Agora টোকেন গ্রহণ হয়নি। App ID ও Certificate মিলিয়ে পরীক্ষা করতে হবে।';
 return 'ভয়েস সংযোগ প্রস্তুত হয়নি বা নেটওয়ার্কে আটকে আছে। কয়েক সেকেন্ড পরে আবার মাইক চাপুন।';
}
