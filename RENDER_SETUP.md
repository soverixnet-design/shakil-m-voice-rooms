# EarnBD গেম সার্ভার: Google Cloud billing ছাড়া Render setup

ওয়েবসাইট GitHub Pages/Earnbd.work-এ থাকে। Login ও coins একই Firebase project/database-এ থাকে। Render শুধু গেম API চালায়। Firebase Functions deploy করার প্রয়োজন নেই। এই setup-এর সার্ভার ফাইল, shared game engine এবং owner panel-এর URL সংযোগ repository-তে প্রস্তুত করা হয়েছে; Render-এ আপনার service এখনও deploy করা হয়নি।

## ছবির form-এ যা বসাবেন

| Field | Value |
| --- | --- |
| Repository | `soverixnet-design/shakil-m-voice-rooms` |
| Language / Runtime | Node |
| Branch | `main` |
| Name | `earnbd-game-server` (নাম unavailable হলে অন্য নাম দিন) |
| Root Directory | `functions` |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Region | Singapore, পাওয়া গেলে |
| Compute | Free (পরীক্ষার জন্য) |
| Health Check Path | `/health` |

এই তিনটি Root Directory/Build/Start মান একসঙ্গে ব্যবহার করবেন। `functions`-এ package.json এবং `render-server.js` আছে। Root Directory খালি রেখে এই Start Command ব্যবহার করলে root app চালানোর script পাওয়া যাবে না।

## Firebase secret যোগ করা

Render server-কে আপনার বিদ্যমান Firebase database-এ লিখতে private server credential প্রয়োজন। ওয়েবসাইটের public firebaseConfig দিয়ে এই অনুমতি পাওয়া যায় না।

Firebase Console → Project `gen-lang-client-0043151803` → Project settings → Service accounts → Firebase Admin SDK → Generate new private key। Download হওয়া JSON ফাইল **চ্যাট বা GitHub-এ দেবেন না**। এটি শুধু নিজের কাছে এবং Render-এর secret storage-তে রাখবেন।

Service তৈরি হওয়ার পরে Render → আপনার service → Environment → Secret Files → Add Secret File:

- Filename: `firebase-service-account.json`
- Contents: download হওয়া JSON ফাইলের পুরো লেখা
- Save Changes / Redeploy

Render-এ এই ফাইল `/etc/secrets/firebase-service-account.json` পথে পাওয়া যাবে; server ইতিমধ্যে সেই পথ পড়ার জন্য তৈরি। চাইলে Secret File-এর বদলে Render Environment Variable `FIREBASE_SERVICE_ACCOUNT_JSON`-এর value হিসেবে পুরো JSON দিতে পারেন। একই credential দেওয়ার জন্য যেকোনো একটি পদ্ধতি যথেষ্ট। Environment secret ছাড়া `/health`-এ HTTP 503 এবং `setup-required` দেখাবে; server বেট নেবে না। Valid credential configure হলে `/health` 200 দেয়। Database permission সমস্যা হলে request-এ connection error হবে এবং Render Logs-এ error code দেখা যাবে।

Node version দরকার হলে Environment Variable `NODE_VERSION` = `22` দিন। package.json-এও Node 22 নির্ধারিত আছে।

## Rules

Firestore-এর **বিদ্যমান named database** নির্বাচন করুন:

`ai-studio-22dd0b7a-14da-47df-9bc8-d4b58ab5ab0b`

Repository-এর পুরো `firestore.rules` Rules/Security editor-এ Publish করুন। Owner admin panel-এর Rules copy অপশনও ব্যবহার করতে পারেন। Render-এ যাওয়ার কারণে Firebase apiKey, authDomain বা projectId পরিবর্তন করবেন না।

Google login-এর জন্য Firebase Authentication → Settings → Authorized domains-এ `earnbd.work` ও `www.earnbd.work` যোগ করুন, যদি আগে দেওয়া না থাকে। authDomain আগের `.firebaseapp.com`-ই থাকবে।

## ওয়েবসাইটের সঙ্গে সংযোগ

Render Live হলে তার public URL যেমন `https://earnbd-game-server.onrender.com` কপি করুন। `/health` খুলে `{"status":"ok","service":"earnbd-shared-games"}` দেখুন।

https://earnbd.work/admin.html খুলে verified owner account (`yfastvpn@gmail.com`) দিয়ে login করুন। “সম্পূর্ণ কন্ট্রোল” অংশে **গেম সার্ভার সংযোগ** বক্সে URL দিন → “যাচাই করে সংযোগ সেভ করুন”। এটি `/system/gameServer` document-এ URL সেভ করে; সব user একই server ব্যবহার করে। Secret key এই বক্সে বসাবেন না। URL সেভ না হলে client পুরোনো Firebase Functions পথ ব্যবহার করবে।

শুধু server-এর মূল `https://নাম.onrender.com` URL দিন; শেষে `/health` বা `/api` নয়। Client Render-এর `/api/sync` ও `/api/bet`-এ Firebase ID token দিয়ে request পাঠায়। Server token যাচাই করে UID ঠিক করে; body-তে অন্য user ID পাঠিয়ে তাদের wallet বদলানো যায় না। CORS-এ `earnbd.work`, `www.earnbd.work` ও GitHub origin দেওয়া আছে।

## Free plan সীমা

Render Free instance 15 মিনিট inbound traffic না পেলে sleep করে; আবার চালু হতে প্রায় এক মিনিট লাগে। Client cold-start response-এর দীর্ঘ delay থেকে সময় গণনা না করে server warm হওয়ার পরে আবার সময় মিলিয়ে নেয়। সেই সময় নতুন বেট বন্ধ থাকে। Server ঘুমিয়ে থাকলে pending payout সঙ্গে সঙ্গে যোগ হবে না; আবার চালু হলে database-এ থাকা অসমাপ্ত round settle করবে। Restart-এ coins/bets হারানোর কথা নয়, কারণ এগুলো Firestore-এ থাকে।

এটি পরীক্ষামূলক free setup। নিরবচ্ছিন্ন production game-এর জন্য always-on server প্রয়োজন। Firebase-এর free database quota এবং Render-এর usage limits প্রযোজ্য; Google Cloud Functions billing লাগছে না মানেই unlimited capacity নয়।

## পরীক্ষা

HTTP adapter-এর auth/CORS/verified UID/error mapping, game URL validation, existing deterministic round/payout tests পাস করেছে। Shared-game Firestore emulator tests আগে পাস করেছে। Production service account/Render service owner-এর account-এ configure ও deploy হওয়া বাকি; দুই real Google user দিয়ে production test হয়নি।

Official docs:
https://render.com/docs/deploy-node-express-app
https://render.com/docs/configure-environment-variables
https://render.com/docs/free
https://firebase.google.com/docs/admin/setup
