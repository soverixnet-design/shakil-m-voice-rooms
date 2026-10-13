package work.earnbd.app;
import android.app.Activity;
import android.os.Bundle;
import android.net.Uri;
import android.graphics.Color;
import android.content.Intent;
import android.widget.*;
import android.view.Gravity;
import androidx.browser.customtabs.CustomTabsIntent;
public class MainActivity extends Activity {
 private static final String APP_URL="https://earnbd.work";
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  LinearLayout root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setGravity(Gravity.CENTER); root.setPadding(36,48,36,48); root.setBackgroundColor(Color.rgb(5,12,40));
  ImageView logo=new ImageView(this); logo.setImageResource(work.earnbd.app.R.drawable.earnbd_logo); root.addView(logo,new LinearLayout.LayoutParams(280,280));
  TextView title=new TextView(this); title.setText("EarnBD Shakil"); title.setTextColor(Color.WHITE); title.setTextSize(28); title.setGravity(Gravity.CENTER); root.addView(title);
  TextView note=new TextView(this); note.setText("ভয়েস রুম • গেমস • কমিউনিটি\nGoogle লগইন ও মাইক্রোফোনের জন্য ব্রাউজারে খুলবে।"); note.setTextColor(Color.LTGRAY); note.setGravity(Gravity.CENTER); root.addView(note);
  Button open=new Button(this); open.setText("EarnBD খুলুন"); open.setOnClickListener(v->open(APP_URL)); root.addView(open);
  Button help=new Button(this); help.setText("সার্ভার ও ভয়েস সেটআপ গাইড"); help.setOnClickListener(v->open("https://github.com/soverixnet-design/shakil-m-voice-rooms/blob/main/ANDROID_SETUP_BN.md")); root.addView(help);
  setContentView(root);
 }
 private void open(String url) {
  try { new CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(this,Uri.parse(url)); }
  catch(android.content.ActivityNotFoundException e) { try { startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url))); } catch(android.content.ActivityNotFoundException unavailable) { Toast.makeText(this,"Chrome বা অন্য ব্রাউজার ইনস্টল করুন।",Toast.LENGTH_LONG).show(); } }
 }
}
