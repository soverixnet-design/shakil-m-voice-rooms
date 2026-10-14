export async function updateVoicePublication({client,track,config,wants,allowed,alive,published}:any){
 const stop=async()=>{if(published){await client.unpublish();published=false;}if(track)await track.setEnabled(false);await client.setClientRole('audience');return {published:false,speaking:false};};
 if(!alive())return {published:false,speaking:false};
 await client.renewToken(config.token);
 if(!alive())return {published:false,speaking:false};
 if(!wants||!allowed()||!config.canPublish||!track)return stop();
 await client.setClientRole('host');
 if(!alive()||!allowed())return stop();
 await track.setEnabled(true);
 if(!alive()||!allowed())return stop();
 // Restore the synchronous safety gate only after permission is confirmed.
 const mediaTrack=track.getMediaStreamTrack?.();if(mediaTrack)mediaTrack.enabled=true;
 try{if(!published)await client.publish(track);}catch(error){await track.setEnabled(false);throw error;}
 if(!alive()||!allowed()){await track.setEnabled(false);await client.unpublish();return {published:false,speaking:false};}
 return {published:true,speaking:true};
}
export function outdatedVoiceBundle(error:any){return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk .* failed/i.test(String(error?.message||''))}
export function voiceFailure(error:any){
 if(outdatedVoiceBundle(error))return 'অ্যাপের পুরোনো ভয়েস ফাইল লোড হয়নি। আপডেট লোড করুন বোতামে চাপুন।';
 const code=String(error?.code||error?.name||'');
 if(code==='TRACK_IS_DISABLED')return 'মাইক্রোফোনের অডিও ট্র্যাক বন্ধ হয়ে গেছে। আবার মাইক চাপলে নতুন করে চালু হবে।';
 if(code==='CONSTRAINT_NOT_SATISFIED'||code==='OverconstrainedError')return 'এই মাইক্রোফোনের অডিও সেটিংস চালু করা যায়নি। আবার মাইক চাপুন।';
 if(['PERMISSION_DENIED','NotAllowedError','SecurityError'].includes(code))return 'মাইক্রোফোনের অনুমতি বন্ধ আছে। ব্রাউজার Site settings → Microphone → Allow করুন।';
 if(['DEVICE_NOT_FOUND','NotFoundError'].includes(code))return 'ফোনের মাইক্রোফোন পাওয়া যায়নি।';
 if(['NOT_READABLE','NotReadableError'].includes(code))return 'ফোনের মাইক্রোফোন থেকে অডিও নেওয়া যাচ্ছে না। ফোনের Microphone access চালু আছে কি না দেখুন এবং আবার চেষ্টা করুন।';
 if(code==='functions/permission-denied')return 'রুমের সদস্যপদ বা সিটের অনুমতি পাওয়া যায়নি। রুমে আবার ঢুকুন।';
 if(error?.message==='seat-permission-required')return 'সিটের অনুমতি পাওয়া যায়নি বা অ্যাডমিন মিউট করেছেন। সিটে আবার বসুন।';
 if(error?.message==='voice-quota-exhausted')return 'সব প্রস্তুত ভয়েস প্রোভাইডারের নির্ধারিত মিনিট শেষ হয়েছে। অ্যাডমিনকে প্যাকেজ বা পরবর্তী প্রোভাইডার যুক্ত করতে হবে।';
 if(error?.message==='voice-not-configured')return 'ভয়েস প্রোভাইডারের সার্ভার সেটিংস প্রস্তুত হয়নি।';
 if(error?.message==='agora-not-configured')return 'সার্ভারের Agora App ID ও Certificate সঠিকভাবে সেট করা নেই।';
 if(['INVALID_TOKEN','CAN_NOT_GET_GATEWAY_SERVER','TOKEN_EXPIRED'].includes(code))return 'Agora টোকেন গ্রহণ হয়নি। App ID ও Certificate মিলিয়ে পরীক্ষা করতে হবে।';
 return 'ভয়েস সংযোগ প্রস্তুত হয়নি বা নেটওয়ার্কে আটকে আছে। কয়েক সেকেন্ড পরে আবার মাইক চাপুন।';
}
