# EarnBD Shakil — স্টোর প্রস্তুতির বর্তমান অবস্থা

এটি জমা দেওয়ার অনুমোদন বা সম্পূর্ণ প্রস্তুত অ্যাপের সার্টিফিকেট নয়।

## তৈরি করা হয়েছে
- Android compile/target API 36, version 1.3.0, release AAB build এবং release lint।
- Release signing configuration: keystore repository-তে রাখা হবে না। পরিবেশে EARNBD_KEYSTORE_PATH, EARNBD_KEYSTORE_PASSWORD, EARNBD_KEY_ALIAS, EARNBD_KEY_PASSWORD দিতে হবে। এগুলো না দিলে AAB unsigned থাকে এবং Play Console-এ জমা দেওয়া যাবে না।
- iOS WKWebView প্রজেক্ট, safe area, Back/Refresh, origin সীমাবদ্ধ microphone prompt এবং simulator build workflow। এটি iPhone-এ install করার IPA নয়।
- অ্যাপের embedded browser-এ email login; Google popup native OAuth নয়।

## জমা দেওয়ার আগে বাধ্যতামূলক বাকি কাজ
- Google Play Console ও Apple Developer account তৈরি, পরিচয় যাচাই এবং app ownership ঠিক করা।
- Android upload key নিরাপদে তৈরি/ব্যাকআপ; Apple signing certificate ও provisioning profile।
- iOS App Store icon, physical iPhone-এ gallery upload, login এবং দুই ফোনে voice test। Background voice এই সংস্করণে নেই।
- Accounts এবং সংশ্লিষ্ট তথ্য ডিলিটের server workflow; শুধু সাপোর্টে যোগাযোগের লেখা যথেষ্ট নয়। Play-এর জন্য বাইরের web request pathway-ও লাগবে।
- User-generated content report/block এবং moderation-এর সম্পূর্ণ পরীক্ষা।
- Coins/recharge-এর চূড়ান্ত payment model: স্টোর billing integration এখনো নেই। টাকা দিয়ে বাজি বা নগদ পুরস্কার হলে সংশ্লিষ্ট স্টোরের gambling policy, অনুমোদন, অঞ্চল ও বয়স নিয়ন্ত্রণের প্রয়োজন নির্ধারণ করতে হবে।
- Data safety, App Privacy, content rating, reviewer demo account, বাস্তব screenshots এবং verified contact details।
- Firebase/Agora/server-এর live connection failure ঠিক করা এবং কয়েন, গিফট ও wallet-এর server tests।
- iOS minimum functionality review: একটি web wrapper build পাস করলেই Apple অনুমোদন নিশ্চিত হয় না।

## অ্যাকাউন্ট তৈরি
Google Play: https://play.google.com/console/signup
Apple Developer: https://developer.apple.com/programs/enroll/
নিজের পরিচয় ও payment information নিজের অ্যাকাউন্টেই দিন; chat-এ password, card বা signing secret দেবেন না।

## সরকারি রেফারেন্স
- Target API: https://developer.android.com/google/play/requirements/target-sdk
- Android signing: https://developer.android.com/studio/publish/app-signing
- Play account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Apple account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Apple review: https://developer.apple.com/app-store/review/guidelines/
- Google gambling policy: https://support.google.com/googleplay/android-developer/answer/9877032
