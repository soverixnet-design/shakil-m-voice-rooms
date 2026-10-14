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
import android.webkit.*;
import android.widget.*;
import android.view.*;

/** Android shell: application stays inside this Activity, with origin-scoped microphone access. */
public class MainActivity extends Activity {
 private static final String APP_URL="https://earnbd.work/";
 private AudioManager audioManager;
 private int previousAudioMode;
 private boolean previousSpeaker;
 private WebView web;
 private ProgressBar progress;
 private LinearLayout error;
 private PermissionRequest microphoneRequest;
 private ValueCallback<Uri[]> uploadCallback;
 private static final int MICROPHONE=20, UPLOAD=21;
 private boolean roomAudio=false;
 public class RoomAudioBridge {
  @JavascriptInterface public void setActive(boolean active){runOnUiThread(()->{
   if(web==null||!trusted(Uri.parse(web.getUrl()==null?"":web.getUrl())))return;
   if(active){
    boolean first=!roomAudio;roomAudio=true;
    if(first&&Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},22);
    try{Intent service=new Intent(MainActivity.this,RoomAudioService.class);if(Build.VERSION.SDK_INT>=26)startForegroundService(service);else startService(service);}catch(RuntimeException e){roomAudio=false;Toast.makeText(MainActivity.this,"ব্যাকগ্রাউন্ড অডিও চালু হয়নি। অ্যাপ খোলা রাখুন।",Toast.LENGTH_LONG).show();}
   }else{roomAudio=false;stopService(new Intent(MainActivity.this,RoomAudioService.class));}
  });}
 }


 private boolean trusted(Uri uri) {
  return uri!=null && "https".equals(uri.getScheme()) && ("earnbd.work".equals(uri.getHost())||"www.earnbd.work".equals(uri.getHost())) && (uri.getPort()==-1 || uri.getPort()==443) && uri.getUserInfo()==null;
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
  WebSettings settings=web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true); settings.setUseWideViewPort(true); settings.setLoadWithOverviewMode(true); settings.setMediaPlaybackRequiresUserGesture(false);
  settings.setAllowFileAccess(false); settings.setAllowContentAccess(true); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  settings.setUserAgentString(settings.getUserAgentString()+" EarnBDAndroid/1.7");
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
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else new AlertDialog.Builder(this).setMessage("EarnBD বন্ধ করবেন?").setNegativeButton("থাকুন",null).setPositiveButton("বন্ধ করুন",(d,w)->finish()).show();}
 private void prepareVoiceAudio(){audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);audioManager.setSpeakerphoneOn(true);}
 @Override protected void onPause(){super.onPause();if(web!=null&&roomAudio)web.evaluateJavascript("window.dispatchEvent(new Event('earnbd-background-listening'))",null);}
 @Override protected void onDestroy(){if(microphoneRequest!=null)microphoneRequest.deny();if(uploadCallback!=null)uploadCallback.onReceiveValue(null);stopService(new Intent(this,RoomAudioService.class));if(web!=null){web.removeJavascriptInterface("EarnBDRoomAudio");web.stopLoading();web.destroy();}if(audioManager!=null){audioManager.setMode(previousAudioMode);audioManager.setSpeakerphoneOn(previousSpeaker);}super.onDestroy();}
}
