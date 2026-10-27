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
