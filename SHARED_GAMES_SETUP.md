# লাইভ গেম চালু করার শেষ ধাপ

## বর্তমান অবস্থা

ওয়েবসাইটের পাঁচটি বেটিং গেম (`greedy_lion`, `lion_wheel`, `night_wheel`, `jackpot_fruit`, `slots`) এখন নতুন shared-game সার্ভারের client ব্যবহার করে। পুরোনো ডিভাইসভিত্তিক timer, ফলাফল ও নমুনা ranking এই live mode-এ ব্যবহার হয় না। Firebase Functions deploy এবং নিচের নতুন rules প্রকাশ না হওয়া পর্যন্ত লাইভ বেট বন্ধ থাকে। সংযোগের ত্রুটি দেখাবে; কয়েন কাটবে না। Carrom ও Chess এখনও স্থানীয় single-player গেম; তাদের online matchmaking এই পরিবর্তনের অন্তর্ভুক্ত নয়।

Firebase অ্যাপের apiKey, authDomain, appId ও projectId পরিবর্তন করা হয়নি। একই named Firestore database ব্যবহার করা হয়:

- Project: `gen-lang-client-0043151803`
- Database: `ai-studio-22dd0b7a-14da-47df-9bc8-d4b58ab5ab0b`
- Functions region: `asia-southeast1`

## Deploy

Firebase Console-এ **এই project** নির্বাচন করুন। Cloud Functions deploy করার জন্য Blaze billing plan প্রয়োজন। Billing চালু করার সিদ্ধান্ত ও payment setup project owner করবেন। Functions ও Firestore ব্যবহারের খরচ হতে পারে; এটি সম্পূর্ণ free server হওয়ার দাবি নয়।

Google Cloud Shell বা Node.js 22 থাকা কম্পিউটারের terminal-এ:

```bash
git clone https://github.com/soverixnet-design/shakil-m-voice-rooms.git
cd shakil-m-voice-rooms
npm ci --prefix functions
npx --yes firebase-tools@14.10.1 login --no-localhost
npx --yes firebase-tools@14.10.1 deploy --project gen-lang-client-0043151803 --config firebase.games.json --only firestore:rules,functions:shared-games
```

লগইন project owner-এর Google account দিয়ে করবেন। এই terminal command কোড ও server deploy করে; Firebase Rules editor-এ JavaScript/Node.js কোড paste করবেন না। Service-account JSON/key GitHub বা চ্যাটে দেওয়া লাগবে না। CLI প্রথম deploy-এ Functions image cleanup policy-এর retention জানতে চাইতে পারে; 7 দিন দেওয়া যায়। প্রয়োজনীয় APIs/IAM অনুমতি সংক্রান্ত ত্রুটি হলে terminal-এর exact error অনুযায়ী ঠিক করতে হবে; অন্য project তৈরি বা config বদলানো লাগবে না।

Deploy সফল হলে তিনটি function থাকবে:

- `syncSharedGame`
- `placeSharedBet`
- `settleSharedGames`

Rules হাতে প্রকাশ করলে repository-এর **পুরো `firestore.rules`** named database-এর Rules/Security editor-এ বসাবেন। Realtime Database-এর Rules-এ নয়। শুধু Rules প্রকাশ করলে Functions চালু হয় না। ওয়েবসাইটের জন্য GitHub Pages build আলাদাভাবে স্বয়ংক্রিয় চলে।

## কীভাবে কাজ করে

প্রতি game-এ সব রুমের সব ইউজার একই global round খেলে। Round Unix সময় অনুযায়ী 32 সেকেন্ড: 20 সেকেন্ড বেট, 6 সেকেন্ড spin, 6 সেকেন্ড result। পরে ঢুকলে নতুন timer শুরু হয় না। Client monotonic clock দিয়ে server সময় অনুমান করে এবং নিয়মিত আবার মিলিয়ে নেয়। Network latency-এর কারণে display-এ সামান্য পার্থক্য হতে পারে; বেটের deadline সর্বদা server যাচাই করে। ফোনের ঘড়ি বদলানো বা wallet save delay timer থামাতে পারে না।

সব গেমে chips: **1,000 / 10,000 / 100,000 / 1,000,000**। প্রতিটি food/slot-এ নিজের এবং সবার মোট বেট দেখাবে। “সবার বেট” তালিকায় নাম, public ID, বেটের ধরন ও amount থাকবে। র‍্যাঙ্কিং game অনুযায়ী server-confirmed **আজকের মোট জেতা কয়েন** দিয়ে হয়। দিন পরিবর্তন UTC midnight; সমান score হলে UID দিয়ে স্থায়ী ক্রম রাখা হয়। Fake players, fake pool বা demo ranking নেই।

ফলাফল random server secret থেকে একবার তৈরি হয়। Secret client পড়তে পারে না; বেট বন্ধ হওয়ার আগে outcome প্রকাশ হয় না। ফলাফলের cutoff পেরুলে নতুন bet গ্রহণ হয় না। একই request পুনরায় গেলে কয়েন দ্বিতীয়বার কাটে না। Reply হারালে “একই বেটের ফল যাচাই করুন” ব্যবহার করুন। অন্য chip-এ নতুন click করার আগে pending bet-এর উত্তর নিশ্চিত হয়। একই round-এর payout প্রতিটি account-এ একবারই যোগ হয়। Game বন্ধ থাকলেও scheduled settlement পরের মিনিটের মধ্যে pending payout আবার চেষ্টা করে। তাৎক্ষণিক settlement সক্রিয় client-এর sync call-এও হয়।

নতুন rules সাধারণ ইউজারের নিজের balance বাড়ানোর ক্ষমতা বন্ধ করে। Owner recharge, যাচাইকৃত seller transfer এবং gift debit কাজ করে; ordinary profile edit থেকে coins বদলানো যায় না। পুরোনো local-game payout code আর এই পাঁচটি live game-এ ব্যবহার হয় না। Client-এ arbitrary “জেতা কয়েন” পাঠিয়ে server payout নেওয়া যায় না।

Fruit game-এর live mode-এ fruit multipliers ব্যবহৃত হয়; পুরোনো local random bonus/jackpot pool এখন দেখানো বা credit করা হয় না। Slots-এ একই round-এ একই three-symbol result সবার জন্য হয়; একাধিক accepted bets যোগ হয়। Auto Play নতুন live mode-এ রাখা হয়নি। এগুলো পরে server-controlled ভাবে আলাদা যোগ করা যাবে।

## যাচাই

স্থানীয় পরীক্ষা পাস করেছে: দুই user একই round, public bets, seed গোপন, late bet rejection, duplicate retry, simultaneous overspend prevention, payout once, shared ranking, all five games' scheduled settlement; recharge/seller/room/gift rules-এর পুরোনো পরীক্ষাও পাস। Production deploy/login না থাকায় production-এ দুই real Google account দিয়ে পরীক্ষা এখনও হয়নি।

Deploy-এর পরে দুই ফোনে Google login করে একই game খুলুন। একটি account-এ ছোট bet দিন। অন্য account-এ ID ও amount দেখা, একই round ID/result দেখা এবং Wallet balance refresh-এর পরে থাকা যাচাই করুন। Deadline-এ server rejected bet হলে balance কমবে না। Server unavailable হলে interface কোনো local round চালাবে না।

Official docs: https://firebase.google.com/docs/functions/get-started এবং https://firebase.google.com/docs/functions/callable
