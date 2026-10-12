# নতুন গেম, wallet ও voice update

চারটি নতুন runnable HTML (Greedy Lion, সিংহ ফুড হুইল, নাইট ফুড হুইল, জ্যাকপট ফ্রুট) থেকে static design রাখা হয়েছে। পুরোনো local random result, demo coins ও demo players-এর scripts সরিয়ে verified parent/server bridge ব্যবহার করা হয়েছে। বেট 1,000 / 10,000 / 100,000 / 1,000,000; সময় server-aligned 20+6+6 seconds। Slots-এর attachment শুধু Markdown text, তাই server-controlled Slots screen আপাতত আছে; নতুন Slots HTML পাওয়া প্রয়োজন। Chess attachment-ও শুধু Markdown; পুরোনো single-player Chess ও Carrom সরানো হয়েছে, নতুন runnable Chess HTML পাওয়া বাকি।

প্রতি game-এ daily/weekly ranking, ব্যক্তিগত accepted bet/payout history এবং live player/public-ID/bet/payout তালিকা আছে। Weekly UTC সোমবার থেকে। সব গেম মিলিয়ে daily/weekly board home ranking থেকে খোলে। Server payout একবার হয়, global win feed রুম ও রুমের বাইরে দেখায়। Fruit-এর server-secret bonus +1/+2/x2/x3/JP আছে; pool আসল bet-এর 5% থেকে তৈরি। JP হলে round মোট stake-এর slab অনুযায়ী pool-এর 10/30/50/70% reserve হয়; সেই budget অংশগ্রহণকারীদের stake অনুপাতে ভাগ হয়। এটি পুরোনো demo pool-এর অসংগত fake amount রাখে না।

ডায়মন্ডের আসল balance server-only `diamondWallets` ledger-এ থাকে; public profile-এর diamond সংখ্যা দিয়ে exchange হয় না। নতুন gifts server catalog থেকে price যাচাই করে atomic sender debit + receiver diamond credit + receipt + room animation event সেভ করে। 100 coin gift = 100 receiver diamonds। Self-gift-ও debit হয়; self-gift তারপর exchange করে extra coins তৈরি হয় না। Exchange 100-এর গুণিতক diamonds-এ; 100 diamonds = 70 coins। Request IDs retries ও concurrent transaction overspend আটকায়। নতুন ledger credits চলে; historical unverified demo gifts থেকে diamonds backfill করা হয়নি।

Microphone button browser permission চায়। WebRTC audio peers Firestore room-scoped offer/answer/ICE signals দিয়ে যুক্ত হয়। কেবল active room member signals পড়তে/লিখতে পারে; valid seat ও unmuted permission ছাড়া speaking presence publish হয় না। Listener mute/blocked peer-এর audio বন্ধ রাখে। Room minimize বা game opening-এ room audio component mounted থাকে। Leave-এ tracks/peers বন্ধ হয়।

Default ICE STUN আছে। সব mobile/restrictive NAT-এ direct audio নিশ্চিত নয়। Compatible TURN service থাকলে Render secrets `TURN_URLS` (comma-separated turn:/turns: URLs) ও `TURN_SHARED_SECRET` দিন; `/api/voice-config` authenticated room members-কে 1-hour HMAC credentials দেয়। Static shared secret client-এ যায় না। Relay configure না থাকলে restrictive networks-এ call fail হতে পারে। দুই real phone/Google account-এ microphone/audio পরীক্ষা এখনও হয়নি। এটি বড় room-এর SFU voice server নয়; peer-to-peer mesh বেশি user হলে bandwidth বেশি নেয়।

## চালু করার প্রয়োজনীয় ধাপ

1. GitHub Pages updated code deploy করে। Render auto-deploy চালু থাকলে `functions` পরিবর্তনের নতুন commit নিজে deploy হবে। বন্ধ থাকলে Render → Manual Deploy → Deploy latest commit। Secret File আগের মতোই থাকবে।
2. **নতুন Firestore Rules প্রকাশ করুন**: https://earnbd.work/admin.html → সম্পূর্ণ কন্ট্রোল → Firebase Rules → সম্পূর্ণ রুলস কপি → Firebase Firestore named database `ai-studio-22dd0b7a-14da-47df-9bc8-d4b58ab5ab0b` → Rules/Security → Publish। GitHub বা Render deploy এই rules স্বয়ংক্রিয়ভাবে প্রকাশ করে না।
3. https://shakil-m-voice-rooms.onrender.com/health-এ `apiVersion: 2` থাকলে নতুন routes deployed। Health credential setup বোঝায়; authenticated production bet/gift success-এর বিকল্প নয়।
4. দুই account দিয়ে একই game round/countdown/players/results, one gift 100 → diamonds100, exchange → coins70 ও room voice পরীক্ষা করুন। Microphone permission Allow দিতে হবে। Error হলে owner panel/Render Logs দিয়ে diagnosis করুন।

স্থানীয় পরীক্ষা: types/build, four uploaded DOM screens with no local coin mutations, chips/timer/player display, authenticated API boundary, Firestore atomic coins/diamonds, gift catalog, duplicate retry, concurrent overspend, shared payout/daily/weekly ranking/jackpot reservation, voice room membership/mute rules। Production দুই account পরীক্ষা এখনও হয়নি।
