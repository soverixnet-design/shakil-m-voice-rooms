# ভয়েস প্রোভাইডার ও Android 1.5

## যাচাই করা তথ্য

আপনার স্ক্রিনশটে `CONNECTED`, `NOT_READABLE`, `Mic: 0%` আছে। সংযোগ হলেও মাইক্রোফোন ক্যাপচার ব্যর্থ। অন্য কল চলছে—এটি এই error থেকে প্রমাণ হয় না। Browser-এ আনমিউট হলেও অন্য ফোনে অডিও না আসার সঠিক কারণ দুই ডিভাইসের প্রকাশ/গ্রহণ পরীক্ষা ছাড়া নিশ্চিত নয়।

Android 1.5 WebView-তে প্রথমে সরাসরি `getUserMedia({audio:true})` দিয়ে ক্যাপচার করে, তারপর অডিও SDK-তে সেই একই ট্র্যাক দেয়। Android-এ microphone permission দেওয়ার সময় communication audio mode ও speaker route চালু হয়। অ্যাপ বন্ধ হলে পূর্বের mode ফিরে আসে। www.earnbd.work-ও একই অনুমোদিত origin।

## Render → Environment

আগের Agora App ID / Certificate অপরিবর্তিত রাখুন। যোগ করুন:

| নাম | মান |
|---|---|
| `TENCENT_SDK_APP_ID` | `20049429` — Tencent RTC console-এ SDKAppID হিসেবে যাচাই করুন |
| `TENCENT_SECRET_KEY` | ব্যবহারকারীর দেওয়া secret; শুধু Render secret environment-এ |
| `TENCENT_ADVANCED_PERMISSION_ENABLED` | Tencent console-এ Advanced Permission Control চালুর পর `true` |
| `VOICE_PROVIDER_ORDER` | `agora,tencent` |
| `AGORA_FREE_MINUTES` | ওই account-এর যাচাই করা অবশিষ্ট audio participant-minutes |
| `TENCENT_FREE_MINUTES` | ওই account-এর যাচাই করা অবশিষ্ট audio participant-minutes |
| `TENCENT_FREE_UNTIL` | যাচাই করা trial শেষের ISO সময়, যেমন `2026-11-01T00:00:00Z`; উদাহরণটি প্রকৃত মেয়াদ নয় |
| `VOICE_QUOTA_CYCLE` | quota সেট করার unique cycle, যেমন `2026-10`; কেবল নতুন quota যাচাই হলে বদলান |

Secret কখনও GitHub, browser code, APK বা `VITE_` variable-এ রাখবেন না। Tencent-এ Advanced Permission Control চালু না থাকলে `privateMapKey` server-side seat/mute restrictions কার্যকর হবে না। তাই সেটিং নিশ্চিত না হলে Tencent route বন্ধ থাকে। একই Tencent account-এর অন্য product-এর ব্যবহারও free quota কমাতে পারে। SDKAppID ও UserSig secret একা billing API access দেয় না; automatic invoice reconciliation এখানে নেই।

## হিসাব ও সুইচিং

Server database transaction-এ প্রতি verified room participant-এর জন্য 90-second lease ও 1.5 participant-minute আগাম reserve হয়। একই lease refresh করলে দ্বিগুণ হিসাব হয় না; restart-এর পর হিসাব থাকে। Poll-এর সময় lease-এ 30 সেকেন্ডের কম বাকি থাকলে নতুন reservation হয়। সিটের মাইক বন্ধ থাকলেও connected listener quota ব্যবহার করে। Early leave ও refresh overlap-এর টাকা ফেরত ধরা হয় না, তাই এটি conservative estimate, invoice-এর সঠিক used-minute reading নয়। অন্য apps/account usage এবং provider rounding-এর জন্য cap-এ margin রাখুন।

সব রুম global provider budget ভাগ করে। একটি রুমের route/epoch server-এ স্থির থাকে। আগের cap শেষ হলে পরের configured provider নেওয়া হয়; সবাই সর্বোচ্চ সাধারণ 20-second poll-এ একই route-এ চলে যায়। Temporary overlap বা অডিওর বিরতি হতে পারে। এটি cross-provider seamless media bridge নয়। Tencent token refresh-এ পুনঃসংযোগও হতে পারে। সব cap শেষ বা trial expired হলে নতুন token দেওয়া বন্ধ হয়; বিদ্যমান token তার expiry পর্যন্ত চলতে পারে।

Budget ছাড়া আগে থেকে থাকা Agora চালু থাকে; সেটি free-only spend guard নয়। Multi-provider free-only routing চালু করতে দুই provider-এর budget সেট করুন। নতুন cycle স্বয়ংক্রিয়ভাবে trial entitlement প্রমাণ করে না।

## ফোনে শেষ পরীক্ষা

1. নতুন Android 1.5 APK ইনস্টল করুন; microphone permission দিন। অন্য ফোনে browser খুলুন।
2. একই রুমে আলাদা দুই account দিয়ে ঢুকুন; প্রথমজন সিটে বসে unmute করুন। কথা বললে Mic শতাংশ বাড়ছে কি না দেখুন।
3. দ্বিতীয়জনের `Remote audio` 1 হচ্ছে কি না ও কথা শোনা যাচ্ছে কি না দেখুন; এবার উল্টো দিকে পরীক্ষা করুন।
4. Room sound বন্ধ/চালু, mute/unmute, seat leave ও reconnect পরীক্ষা করুন। Bluetooth/headset থাকলে সেটাও আলাদাভাবে পরীক্ষা করুন।
5. Staging-এ ছোট verified budget দিয়ে দুই user একই provider/epoch-এ সুইচ হয় কি না যাচাই করুন। Production quota কমিয়ে পরীক্ষা করবেন না।

Automated token, quota, permission, capture tests ও TypeScript/build checks বাস্তব ফোনের microphone বা Tencent account-এর trial activation প্রমাণ করে না। দুই ফোনের পরীক্ষা এখনো বাকি।
