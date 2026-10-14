package work.earnbd.app;

import android.app.*;
import android.Manifest;
import android.content.pm.PackageManager;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;

/** Keep the existing room's WebView audio process foreground while the screen is hidden. */
public class RoomAudioService extends Service {
 private PowerManager.WakeLock wake;
 private int startedTypes=-1;
 @Override public void onCreate(){
  super.onCreate();
  NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
  if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(new NotificationChannel("room_audio","রুমের অডিও",NotificationManager.IMPORTANCE_LOW));
 }
 @Override public int onStartCommand(Intent intent,int flags,int startId){
  Intent open=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
  PendingIntent pending=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification.Builder builder=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,"room_audio"):new Notification.Builder(this);
  boolean microphone=intent!=null&&intent.getBooleanExtra("microphone",false)&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED;
  Notification notification=builder.setSmallIcon(android.R.drawable.ic_lock_silent_mode_off).setContentTitle(microphone?"EarnBD · রুমের মাইক ও অডিও চালু":"EarnBD · রুমের অডিও চলছে").setContentText("রুমে ফিরতে চাপুন। অডিও বন্ধ করতে রুম ছেড়ে দিন।").setContentIntent(pending).setOngoing(true).setCategory(Notification.CATEGORY_SERVICE).build();
  int types=ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK;
  if(Build.VERSION.SDK_INT>=30&&microphone)types|=ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
  if(types!=startedTypes){
   try{if(Build.VERSION.SDK_INT>=29)startForeground(71,notification,types);else startForeground(71,notification);startedTypes=types;}
   catch(SecurityException failure){stopSelf();return START_NOT_STICKY;}
  }

  if(wake==null){wake=((PowerManager)getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"EarnBD:RoomAudio");wake.setReferenceCounted(false);}
  // Bound each renewal; leaving/destroying the room releases immediately.
  wake.acquire(5*60*1000L);
  return START_NOT_STICKY;
 }
 @Override public void onTaskRemoved(Intent intent){stopSelf();}
 @Override public void onDestroy(){if(wake!=null&&wake.isHeld())wake.release();super.onDestroy();}
 @Override public IBinder onBind(Intent intent){return null;}
}
