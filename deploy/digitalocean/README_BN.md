# Shakil M — DigitalOcean read-only test

এই সেটআপ **Akira-এর Docker Compose, PostgreSQL, LiveKit, Nginx, APK বা Render-এর লাইভ সার্ভার বদলায় না**।

## প্রথম ধাপ — কেবল Docker/CPU/RAM পরীক্ষা

DigitalOcean-এর 2GB সার্ভারে SSH/Termux দিয়ে:

```bash
cd /opt/shakilm-test
git fetch origin deploy/shakilm-do-readonly-test-20261027
git switch -c deploy/shakilm-do-readonly-test-20261027 --track origin/deploy/shakilm-do-readonly-test-20261027
docker compose -f deploy/digitalocean/docker-compose.test.yml config --quiet
docker compose -f deploy/digitalocean/docker-compose.test.yml up --build -d
curl -fsS http://127.0.0.1:4315/ping
docker stats --no-stream shakilm-readonly-test
```

Expected: `{"status":"ok","mode":"read-only-staging"}`. If port 4315 is occupied, **stop and ask before changing ports**.

## ডেটাবেজ পরীক্ষা (পরে)

`SUPABASE_DATABASE_URL` সেট না করলে `/health` 503 `configuration-required` দেখাবে — এটি স্বাভাবিক। ডেটাবেজ কানেকশন স্ট্রিং বা Firebase JSON কখনো GitHub বা চ্যাটে পাঠাবেন না। নিরাপদে কনফিগার করা হলে `/health` শুধু SQL SELECT দিয়ে Supabase schema check করে। 

```bash
curl -i http://127.0.0.1:4315/health
```

**সতর্কতা:** এই কন্টেইনারে কোনো `/api/bet`, `/api/sync`, wallet, login বা voice endpoint নেই। আসল গেম টেস্টের আগে আলাদা test database ও গোপন কনফিগারেশন এবং যথাযথ load test লাগবে। একই production Supabase দিয়ে দ্বিতীয় live game server একসঙ্গে শুরু করবেন না — দুটি settlement loop ডেটা সংঘর্ষ ঘটাতে পারে।

## Rollback

শুধু নতুন টেস্ট কন্টেইনারটি বন্ধ করতে:

```bash
cd /opt/shakilm-test
docker compose -f deploy/digitalocean/docker-compose.test.yml stop
```

এতে Akira ও Render চলতেই থাকবে।

## নতুন সাবডোমেইন — `shakilm-api.soverixnet.online`

ব্যবহারকারী DigitalOcean API-র জন্য এই নির্দিষ্ট নামটি অনুমোদন করেছেন। অ্যাপের URL validation-এ নামটি যুক্ত, **কিন্তু `game-server-config.json`-এ `backupUrl` এখনো খালি**। ফলে লাইভ ট্র্যাফিক DigitalOcean-এ যাবে না।

DNS যেখান থেকে `soverixnet.online` পরিচালিত হয়, সেখানে কেবল **নতুন** রেকর্ড যোগ করতে হবে:

- Type: `A`
- Name/Host: `shakilm-api`
- IPv4 value: `139.59.73.98` (2 GB Akira droplet; চালুর আগে আবার IP যাচাই করুন)
- TTL: `300` বা DNS প্রদানকারীর ডিফল্ট

`voice.soverixnet.online`, অন্য DNS রেকর্ড বা Akira-এর Nginx virtual host পরিবর্তন করবেন না। আগে এই নামের কোনো A/AAAA/CNAME রেকর্ড থাকলে ওভাররাইট না করে থামুন।

DNS resolve হয়ে সঠিক IP দেখালে, **শুধু টেস্টের জন্য**, repo-তে থাকা `nginx-shakilm-api-staging.conf` আলাদা Nginx server block হিসেবে ইনস্টল করা যায়। এটি কেবল `GET /ping` ও `GET /health` রুটকে লোকাল read-only port `4315`-এ পাঠায় এবং অন্য সব রুটে 404 ফেরায়। `nginx -t` সফল না হলে Nginx reload করবেন না। লাইভ Akira host-এর কনফিগারেশন না বদলিয়ে নতুন virtual host ব্যবহার করবেন।

তারপর DNS ও HTTP-01 যাচাই করে এই নামের trusted TLS certificate ইস্যু করতে হবে (বর্তমান Nginx/Certbot সেটআপ দেখে)। SSL ছাড়া অ্যাপে ব্যাকআপ URL সক্রিয় করবেন না। HTTPS পর্যায়ের প্রত্যাশিত টেস্ট:

```bash
curl -fsS https://shakilm-api.soverixnet.online/ping
```

এতে `{\"status\":\"ok\",\"mode\":\"read-only-staging\"}` আসার কথা। `/health`-এ DB credential না থাকলে 503 স্বাভাবিক। এটি আসল গেম API নয়। Render ও DigitalOcean উভয়ে একই safe settlement lease backend না চালানো পর্যন্ত `backupUrl` পরিবর্তন করা নিষিদ্ধ।

### কেন এখনই live হবে না?

- Safe production rollout-এ Render-এর backend আপডেট, সুরক্ষিত Firebase credential ও Supabase connection, এবং load test দরকার।
- 2 GB সার্ভারে Akira-এর CPU/RAM সীমার মধ্যে নতুন API-র resource cap পরীক্ষা করতে হবে।
- পরিবর্তনগুলো এখনও draft PR-এ রয়েছে, `main`-এ মিশানো হয়নি।
