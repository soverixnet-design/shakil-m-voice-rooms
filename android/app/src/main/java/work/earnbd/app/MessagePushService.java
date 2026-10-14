package work.earnbd.app;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;
public class MessagePushService extends FirebaseMessagingService {
 @Override public void onNewToken(String token){getSharedPreferences("earnbd-push",MODE_PRIVATE).edit().putString("token",token).apply();}
 @Override public void onMessageReceived(RemoteMessage message){
  Map<String,String> data=message.getData();String user=getSharedPreferences("earnbd-push",MODE_PRIVATE).getString("user","");
  if(user.isEmpty()||!user.equals(data.get("uid"))||!"direct-message".equals(data.get("type")))return;
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
  String peer=data.get("senderId"),id=data.get("messageId");if(peer==null||!peer.matches("[A-Za-z0-9_-]{1,128}")||id==null)return;
  NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
  if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(new NotificationChannel("messages","ব্যক্তিগত মেসেজ",NotificationManager.IMPORTANCE_HIGH));
  Intent intent=new Intent(this,MainActivity.class).putExtra("chatUid",peer).setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
  PendingIntent pending=PendingIntent.getActivity(this,peer.hashCode(),intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification.Builder builder=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,"messages"):new Notification.Builder(this);
  manager.notify("dm-"+id,1,builder.setSmallIcon(android.R.drawable.ic_dialog_email).setContentTitle(data.get("title")).setContentText("আপনাকে একটি মেসেজ পাঠিয়েছেন।").setContentIntent(pending).setAutoCancel(true).setCategory(Notification.CATEGORY_MESSAGE).setPriority(Notification.PRIORITY_HIGH).build());
 }
}
