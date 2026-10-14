/** One foreground, request-bound credential handoff from the Android account picker. */
export function nativeGoogleToken(target:Window=window):Promise<string>{
 const bridge=(target as any).EarnBDGoogleAuth;
 if(!bridge?.signIn)return Promise.reject(Object.assign(Error('Update the Android app to use Google login'),{code:'native/update-required'}));
 const requestId=crypto.randomUUID();
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{target.removeEventListener('earnbd-google-signin',receive);clearTimeout(timer)};
  const receive=(event:Event)=>{const data=(event as CustomEvent).detail;if(data?.requestId!==requestId)return;cleanup();if(typeof data.token==='string'&&data.token)resolve(data.token);else reject(Object.assign(Error('Native Google sign-in failed'),{code:data.error||'native/google-signin-failed'}))};
  const timer=setTimeout(()=>{cleanup();bridge.cancel?.(requestId);reject(Object.assign(Error('Google account selection timed out'),{code:'account-timeout'}))},120000);
  target.addEventListener('earnbd-google-signin',receive);
  try{bridge.signIn(requestId)}catch{cleanup();reject(Object.assign(Error('Native Google sign-in failed'),{code:'native/google-signin-failed'}))}
 });
}
