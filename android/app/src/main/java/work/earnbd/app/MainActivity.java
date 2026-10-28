package work.earnbd.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.Build;
import android.os.CancellationSignal;
import android.content.MutableContextWrapper;
import androidx.credentials.*;
import androidx.credentials.exceptions.*;
import com.google.android.libraries.identity.googleid.*;
import org.json.JSONObject;
import java.security.SecureRandom;
import android.util.Base64;
import android.webkit.*;
import android.widget.*;
import android.view.*;

/** Android shell: application stays inside this Activity, with origin-scoped microphone access. */
public class MainActivity extends Activity {
 private static final String APP_URL=BuildConfig.APP_URL;
 private AudioManager audioManager;
 private int previousAudioMode;
 private boolean previousSpeaker;
 private WebView web;
 private ProgressBar progress;
 private LinearLayout error;
 private PermissionRequest microphoneRequest;
 private ValueCallback<Uri[]> uploadCallback;
 private static final int MICROPHONE=20, UPLOAD=21;
 private CancellationSignal googleCancellation;
 private String googleRequest;
 private final CredentialManagerCallback<Void,ClearCredentialException> clearCallback=new CredentialManagerCallback<Void,ClearCredentialException>(){
  @Override public void onResult(Void ignored){}
  @Override public void onError(ClearCredentialException ignored){}
 };
 public class GoogleAuthBridge {
  @JavascriptInterface public void clearSession(){runOnUiThread(()->{if(web!=null&&trusted(Uri.parse(web.getUrl()==null?"":web.getUrl())))CredentialManager.create(MainActivity.this).clearCredentialStateAsync(new ClearCredentialStateRequest(),null,command->runOnUiThread(command),clearCallback);});}
  @JavascriptInterface public void cancel(String requestId){runOnUiThread(()->{if(requestId!=null&&requestId.equals(googleRequest)&&googleCancellation!=null)googleCancellation.cancel();});}
  @JavascriptInterface public void signIn(String requestId){runOnUiThread(()->{
   if(!activityVisible||web==null||!trusted(Uri.parse(web.getUrl()==null?"":web.getUrl()))||googleRequest!=null||requestId==null||!requestId.matches("[A-Za-z0-9-]{36}"))return;
   googleRequest=requestId;googleCancellation=new CancellationSignal();
   byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);String nonce=Base64.encodeToString(bytes,Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING);
   try{
   GetSignInWithGoogleOption option=new GetSignInWithGoogleOption.Builder("702890155720-apviuhq9h3h93miibnmc9sn2gocdp5a3.apps.googleusercontent.com").setNonce(nonce).build();
   GetCredentialRequest request=new GetCredentialRequest.Builder().addCredentialOption(option).build();
   CredentialManager.create(MainActivity.this).getCredentialAsync(new MutableContextWrapper(MainActivity.this),request,googleCancellation,command->runOnUiThread(command),new CredentialManagerCallback<GetCredentialResponse,GetCredentialException>(){
    @Override public void onResult(GetCredentialResponse result){
     try{if(!(result.getCredential() instanceof CustomCredential))throw new IllegalArgumentException();String token=GoogleIdTokenCredential.createFrom(result.getCredential().getData()).getIdToken();String[] parts=token.split("\\.");JSONObject claims=new JSONObject(new String(Base64.decode(parts[1],Base64.URL_SAFE),java.nio.charset.StandardCharsets.UTF_8));if(!nonce.equals(claims.optString("nonce")))throw new IllegalArgumentException();finishGoogle(requestId,token,null);}catch(Exception ignored){finishGoogle(requestId,null,"native/invalid-google-credential");}
    }
    @Override public void onError(GetCredentialException failure){finishGoogle(requestId,null,failure instanceof GetCredentialCancellationException?"auth/popup-closed-by-user":"native/google-signin-failed");}
   });
   }catch(RuntimeException ignored){finishGoogle(requestId,null,"native/google-signin-failed");}
  });}
 }
 private void finishGoogle(String requestId,String token,String error){
  if(!requestId.equals(googleRequest))return;googleRequest=null;googleCancellation=null;
  if(web==null||isDestroyed()||!trusted(Uri.parse(web.getUrl()==null?"":web.getUrl())))return;
  try{JSONObject result=new JSONObject();result.put("requestId",requestId);if(token!=null)result.put("token",token);else result.put("error",error);web.evaluateJavascript("window.dispatchEvent(new CustomEvent('earnbd-google-signin',{detail:"+result.toString()+"}))",null);}catch(Exception ignored){}
 }
 private boolean roomAudio=false,microphoneActive=false,activityVisible=false;
 public class RoomAudioBridge {
  @JavascriptInterface public void setMicrophoneActive(boolean active){runOnUiThread(()->{
   if(web==null||!trusted(Uri.parse(web.getUrl()==null?"":web.getUrl())))return;
   if(active&&!microphoneActive&&(!activityVisible||checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED))return;
   microphoneActive=active;
   if(roomAudio)setActive(true);
  });}

  @JavascriptInterface public void setActive(boolean active){runOnUiThread(()->{
   if(web==null||!trusted(Uri.parse(web.getUrl()==null?"":web.getUrl())))return;
   if(active){
    boolean first=!roomAudio;roomAudio=true;
    if(first&&Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},22);
    try{Intent service=new Intent(MainActivity.this,RoomAudioService.class).putExtra("microphone",microphoneActive);if(Build.VERSION.SDK_INT>=26)startForegroundService(service);else startService(service);}catch(RuntimeException e){roomAudio=false;Toast.makeText(MainActivity.this,"ব্যাকগ্রাউন্ড অডিও চালু হয়নি। অ্যাপ খোলা রাখুন।",Toast.LENGTH_LONG).show();}
   }else{roomAudio=false;microphoneActive=false;stopService(new Intent(MainActivity.this,RoomAudioService.class));}
  });}
  @JavascriptInterface public void exitApp(){runOnUiThread(()->finishAffinity());}
 }


 private boolean trusted(Uri uri) {
  if(uri==null || !"https".equals(uri.getScheme()) || uri.getUserInfo()!=null || uri.getHost()==null)return false;
  if(BuildConfig.VOICE_PREVIEW)return "voice.soverixnet.online".equals(uri.getHost());
  return uri.getHost().endsWith("earnbd.work") || uri.getHost().endsWith(".run.app") || uri.getHost().endsWith("github.io");
 }
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  audioManager=(AudioManager)getSystemService(AUDIO_SERVICE);previousAudioMode=audioManager.getMode();previousSpeaker=audioManager.isSpeakerphoneOn();
  getWindow().setStatusBarColor(Color.rgb(5,12,40));
  getWindow().setNavigationBarColor(Color.rgb(5,12,40));
  LinearLayout root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Color.rgb(5,12,40));
  progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal); root.addView(progress,new LinearLayout.LayoutParams(-1,6));
  FrameLayout content=new FrameLayout(this); root.addView(content,new LinearLayout.LayoutParams(-1,0,1));
  web=new WebView(this); web.setBackgroundColor(Color.rgb(5,12,40)); content.addView(web,new FrameLayout.LayoutParams(-1,-1));
  error=new LinearLayout(this); error.setOrientation(LinearLayout.VERTICAL); error.setGravity(Gravity.CENTER); error.setPadding(40,40,40,40); error.setBackgroundColor(Color.rgb(5,12,40));
  TextView message=new TextView(this); message.setText("সংযোগ পাওয়া যাচ্ছে না। ইন্টারনেট চালু করে আবার চেষ্টা করুন।"); message.setTextColor(Color.WHITE); message.setGravity(Gravity.CENTER); error.addView(message);
  Button retry=new Button(this); retry.setText("আবার চেষ্টা করুন"); retry.setOnClickListener(v->{error.setVisibility(View.GONE);web.loadUrl(APP_URL);}); error.addView(retry); content.addView(error,new FrameLayout.LayoutParams(-1,-1)); error.setVisibility(View.GONE);
  root.setOnApplyWindowInsetsListener((view,insets)->{view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
  setContentView(root);
  web.addJavascriptInterface(new RoomAudioBridge(),"EarnBDRoomAudio");
  web.addJavascriptInterface(new GoogleAuthBridge(),"EarnBDGoogleAuth");
  WebSettings settings=web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true); settings.setUseWideViewPort(true); settings.setLoadWithOverviewMode(true); settings.setMediaPlaybackRequiresUserGesture(false);
  settings.setAllowFileAccess(false); settings.setAllowContentAccess(true); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  settings.setUserAgentString(settings.getUserAgentString()+" EarnBDAndroid/1.9");
  CookieManager.getInstance().setAcceptCookie(true);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
    Uri target=request.getUrl(); if(trusted(target))return false;
    if(!request.isForMainFrame())return false;
    if("https".equals(target.getScheme())||"mailto".equals(target.getScheme())||"tel".equals(target.getScheme())){
     try{startActivity(new Intent(Intent.ACTION_VIEW,target));}catch(android.content.ActivityNotFoundException e){Toast.makeText(MainActivity.this,"এই লিংক খোলার অ্যাপ নেই।",Toast.LENGTH_SHORT).show();}
    }
    return true;
   }
   @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){progress.setVisibility(View.VISIBLE);}
   @Override public void onPageFinished(WebView view,String url){progress.setVisibility(View.GONE);CookieManager.getInstance().flush();}
   @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError failure){if(request.isForMainFrame())error.setVisibility(View.VISIBLE);}
   @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response){if(request.isForMainFrame()&&response.getStatusCode()>=400)error.setVisibility(View.VISIBLE);}
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public void onProgressChanged(WebView view,int value){progress.setProgress(value);}
   @Override public void onPermissionRequest(PermissionRequest request){runOnUiThread(()->{
    if(!trusted(request.getOrigin())||!trusted(Uri.parse(web.getUrl()==null?"":web.getUrl()))){request.deny();return;}
    boolean audio=false; for(String resource:request.getResources())if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource))audio=true;
    if(!audio){request.deny();return;}
    if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED){prepareVoiceAudio();request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});return;}
    if(microphoneRequest!=null)microphoneRequest.deny();microphoneRequest=request;
    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},MICROPHONE);
   });}
   @Override public void onPermissionRequestCanceled(PermissionRequest request){if(microphoneRequest==request)microphoneRequest=null;}
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(!trusted(Uri.parse(view.getUrl()==null?"":view.getUrl()))){callback.onReceiveValue(null);return true;}
    if(uploadCallback!=null)uploadCallback.onReceiveValue(null);uploadCallback=callback;
    Intent pick=new Intent(Intent.ACTION_GET_CONTENT);pick.setType("image/*");pick.addCategory(Intent.CATEGORY_OPENABLE);pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
    try{startActivityForResult(Intent.createChooser(pick,"ছবি নির্বাচন করুন"),UPLOAD);}catch(android.content.ActivityNotFoundException e){uploadCallback.onReceiveValue(null);uploadCallback=null;}
    return true;
   }
  });
  if(state==null||web.restoreState(state)==null)web.loadUrl(APP_URL);
 }
 @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){
  super.onRequestPermissionsResult(requestCode,permissions,results);
  if(requestCode==MICROPHONE&&microphoneRequest!=null){
   PermissionRequest request=microphoneRequest;microphoneRequest=null;
   if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED&&trusted(request.getOrigin())&&trusted(Uri.parse(web.getUrl()==null?"":web.getUrl()))){prepareVoiceAudio();request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});}else request.deny();
  }
 }
 @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode==UPLOAD&&uploadCallback!=null){Uri[] selected=null;if(resultCode==RESULT_OK&&data!=null){if(data.getClipData()!=null){int count=data.getClipData().getItemCount();selected=new Uri[count];for(int i=0;i<count;i++)selected[i]=data.getClipData().getItemAt(i).getUri();}else if(data.getData()!=null)selected=new Uri[]{data.getData()};}uploadCallback.onReceiveValue(selected);uploadCallback=null;}}
 @Override protected void onSaveInstanceState(Bundle out){web.saveState(out);super.onSaveInstanceState(out);}
 private long lastBackPressTime = 0;
 @Override public void onBackPressed(){
  long now = System.currentTimeMillis();
  if (now - lastBackPressTime < 2500) {
   finishAffinity();
   return;
  }
  lastBackPressTime = now;
  Toast.makeText(this, "অ্যাপ বন্ধ করতে আবার ব্যাক চাপুন", Toast.LENGTH_SHORT).show();
 }
 private void prepareVoiceAudio(){audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);audioManager.setSpeakerphoneOn(true);}
 @Override protected void onResume(){super.onResume();activityVisible=true;}
 @Override protected void onPause(){activityVisible=false;super.onPause();}
 @Override protected void onDestroy(){if(googleCancellation!=null)googleCancellation.cancel();if(microphoneRequest!=null)microphoneRequest.deny();if(uploadCallback!=null)uploadCallback.onReceiveValue(null);stopService(new Intent(this,RoomAudioService.class));if(web!=null){web.removeJavascriptInterface("EarnBDRoomAudio");web.removeJavascriptInterface("EarnBDGoogleAuth");web.stopLoading();web.destroy();}if(audioManager!=null){audioManager.setMode(previousAudioMode);audioManager.setSpeakerphoneOn(previousSpeaker);}super.onDestroy();}
}
