# EarnBD Android ও সার্ভার গাইড

বর্তমান preview সংস্করণ 1.9.0। অ্যাপটি নিজস্ব Android WebView-তে চলে এবং native Google account picker ব্যবহার করে। মাইক্রোফোন ও media playback foreground service আছে। দুই ফোনে একই রুমে কথা শোনা এবং গেমের ফলাফল যাচাই না হওয়া পর্যন্ত production-ready ধরে নেওয়া যাবে না।

## APK ও Firebase Google লগইন
GitHub Releases-এর `android-1.9-preview` থেকে APK নিন। পুরোনো 1.8 preview সর্বশেষ সংস্করণ নয়।

একই Firebase project-এ Authentication → Sign-in method → Google চালু করুন। Project settings → Your apps-এ Android package `work.earnbd.app` না থাকলে যোগ করুন।

1.9 preview release-এর `Android-Signing-Fingerprints.txt` অনুযায়ী:
- SHA-1: `C2:2A:EF:6B:C4:02:20:2A:EA:4B:9B:D5:5E:F3:13:33:5D:E9:B8:5C`
- SHA-256: `4E:67:B3:F5:D9:A8:28:DA:FD:BB:64:8A:13:02:D8:6F:38:9F:22:AC:A0:BE:A3:6C:30:EB:4C:96:05:9E:5F:29`

Firebase Android app-এ fingerprint যোগ করুন। নতুন signing key-তে বিল্ড হলে সেই APK-এর fingerprint পুনরায় মিলিয়ে যোগ করতে হবে। Native Google bridge-এ Web OAuth client ID ব্যবহার হয়; সেটি একই Firebase project-এর হতে হবে। Google Cloud-এ Android OAuth client-এর package/SHA-1 মিলতে হবে। Firebase config বদলাবেন না। বর্তমান native bridge Firebase Android SDK ব্যবহার করে না, তাই শুধু `google-services.json` ডাউনলোড করলেই এই bridge-এর client ID বদলায় না।

ওয়েব লগইনের Authorized domains-এ `earnbd.work`, `www.earnbd.work` এবং ব্যবহার করা Render host যোগ করুন। APK-তে microphone permission Allow করুন। WebView-এর trusted-origin check বন্ধ করবেন না।

## মূল অ্যাপ ঠিকানা পরিবর্তন
`android/app/src/main/java/work/earnbd/app/MainActivity.java`-এর `APP_URL` পরিবর্তন করুন। HTTPS ঠিকানা ব্যবহার করুন। পরিবর্তন commit করলে Android workflow আবার APK বানাবে।

## Backend সার্ভার পরিবর্তন
বর্তমান মূল সার্ভার: https://shakil-m-voice-rooms.onrender.com
ওয়েব অ্যাপের fallback `game-server-config.json`-এ আছে। Owner হিসেবে https://earnbd.work/admin.html-এ লগইন করে **গেম সার্ভার সংযোগ** থেকে মূল HTTPS URL যাচাই করে সেভ করুন। বিস্তারিত `RENDER_SETUP.md` পড়ুন। এই পরিবর্তন server configuration-এ হয়; APK নতুন করে বানাতে হয় না।

## Agora ভয়েস পরিবর্তন
Render dashboard → সংশ্লিষ্ট service → Environment:
- `AGORA_APP_ID`: আপনার Agora project App ID
- `AGORA_APP_CERTIFICATE`: একই project-এর certificate
Certificate শুধু server secret হিসেবে রাখুন; APK, public file বা GitHub-এ লিখবেন না। Save/redeploy-এর পরে দুই ফোনে voice test করুন। `functions/agora-voice.js` token বানায়; client `agora-rtc-sdk-ng` ব্যবহার করে।

## বাড়তি সার্ভার
আরেকটি Render service-এ একই `functions` code চালাতে পারেন। একই database credential ও Agora project সেটিংস ব্যবহার করুন। বর্তমানে admin configuration-এ একটি active URL থাকে; স্বয়ংক্রিয় multi-server failover যোগ করা হয়নি। পুরোনো server সমস্যা করলে নতুনটির `/health` যাচাই করে admin panel-এ URL বদলান। Free service sleep বা quota হলে একাধিক URL থাকলেই সমস্যা দূর হবে না।

## Logo ও পুনরায় বিল্ড
Logo: `android/app/src/main/res/drawable/earnbd_logo.png`। প্রথম গোলাকার EarnBD–Shakil logo ব্যবহার করা হয়েছে।
GitHub → Actions → Build Android preview → Run workflow। সফল হলে Releases-এ APK পাবেন। Publish করার আগে Google login, microphone, room join/leave এবং দুই ফোনে audio পরীক্ষা জরুরি। Production signing key স্থায়ীভাবে সংরক্ষণ করে release signing যোগ করতে হবে; preview APK-কে Play Store build হিসেবে ব্যবহার করবেন না।


### Android 1.10 — ব্যক্তিগত মেসেজের নোটিফিকেশন
- একই `work.earnbd.app` প্যাকেজ ও আগের সাইনিং কী রেখে আপডেট ইনস্টল করুন।
- Messages পাতায় **মেসেজ নোটিফিকেশন চালু করুন** চাপুন এবং ফোনের অনুমতি দিন।
- অন্য ইউজারের প্রোফাইল থেকে Follow করে Message খুলুন। প্রাপক উত্তর দিতে পারবেন; ফলো সম্পর্ক উঠে গেলে নতুন মেসেজ বন্ধ থাকবে, পুরোনো চ্যাট পড়া যাবে।
- Firebase Messaging একই Firebase প্রজেক্টের Android app ID এবং sender ID ব্যবহার করে। Render-এর Firebase service account দিয়ে FCM HTTP v1 API-তে পাঠানো হয়; Firebase Cloud Messaging API চালু ও service account-এর messaging permission থাকতে হবে।
- টোকেন সার্ভারে শুধু লগইন করা ইউজারের পরিচয়ে নিবন্ধিত হয়। লগআউট বা অ্যাকাউন্ট পরিবর্তনের পরে পুরোনো অ্যাকাউন্টের নোটিফিকেশন ফোনে দেখানো হয় না।
- নোটিফিকেশনে চ্যাটের আসল লেখা দেখানো হয় না; চাপলে সংশ্লিষ্ট চ্যাট খোলে।
- প্রাপককে অন্তত একবার Android 1.10-এ লগইন করে ডিভাইস নিবন্ধন করতে হবে। ফোনের অনুমতি, Google Play services, ইন্টারনেট ও Android-এর battery/background ব্যবস্থার উপর ডেলিভারি নির্ভর করে।
- অ্যাক্টিভিটি রুম: Admin → Voice Room Management → অ্যাক্টিভিটি রুম আবেদন। তিনটি স্লটে অনুমোদন/সরানোর ব্যবস্থা আছে।
