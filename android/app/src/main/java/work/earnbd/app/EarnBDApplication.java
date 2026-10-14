package work.earnbd.app;
import android.app.Application;
import android.content.Context;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
public class EarnBDApplication extends Application {
 @Override public void onCreate(){super.onCreate();
  if(FirebaseApp.getApps(this).isEmpty())FirebaseApp.initializeApp(this,new FirebaseOptions.Builder().setApplicationId("1:702890155720:android:158d446a608580f6948ffd").setApiKey("AIzaSyC7hTjXoua1C6jm8IMxWTN0xgPo38lc_xU").setProjectId("gen-lang-client-0043151803").setGcmSenderId("702890155720").build());
  FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token->getSharedPreferences("earnbd-push",Context.MODE_PRIVATE).edit().putString("token",token).apply());
 }
}
