# EarnBD Android ও সার্ভার গাইড

Android 1.1 সংস্করণে EarnBD অ্যাপের নিজস্ব Android Activity-র WebView-তে সরাসরি চলে। রুম ও গেমস খুলতে আলাদা ব্রাউজার লাগে না। এটি hybrid Android app; সব স্ক্রিন Kotlin/Java-তে নতুন করে লেখা সম্পূর্ণ native app নয়। Internet প্রয়োজন; Android background voice service এতে নেই।

## APK ইনস্টল
GitHub Releases-এর `android-1.1-preview` সংস্করণে `EarnBD-Shakil-preview.apk` ডাউনলোড করুন। এটি পরীক্ষার জন্য debug-signed APK; Play Store release নয়। Android চাইলে যে ব্রাউজার থেকে ডাউনলোড করেছেন তার Install unknown apps অনুমতি চালু করুন। অ্যাপ খুললেই EarnBD স্ক্রিন দেখাবে। Email / Gmail ও EarnBD পাসওয়ার্ড দিয়ে লগইন করুন। নতুন হলে account তৈরি করুন। ভয়েস রুমে Android ও ওয়েব মাইক্রোফোনের অনুমতি দিন। Google popup login WebView-তে চালানো হয় না; native Google OAuth integration এখনো যোগ হয়নি। আগে Google দিয়ে খুললে Forgot password দিয়ে EarnBD password সেট করার চেষ্টা করুন; Firebase Email/Password provider চালু থাকা প্রয়োজন। আগের preview APK ইনস্টল থাকলে নতুনটি ইনস্টল করতে পুরোনোটি uninstall লাগতে পারে, কারণ পরীক্ষার signing key স্থায়ী নয়। প্রথমে দুই ফোন দিয়ে একই রুমে কথা পরীক্ষা করুন।

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

