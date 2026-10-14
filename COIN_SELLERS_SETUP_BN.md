# কয়েন সেলার ব্যবস্থা

অ্যাডমিন প্যানেল → **ID দিয়ে কয়েন সেলার ও বরাদ্দ** খুলুন। বিদ্যমান ইউজারের public ID দিয়ে খুঁজুন, সেলার কার্ডের বিবরণ লিখুন, কত কয়েন বরাদ্দ দেবেন লিখে সেভ করুন। শূন্য কয়েন দিলেও সেলার অনুমতি চালু করা যায়। এটি ওই user's `admins` grant ও `sellerWallets` pool-এ সেভ হয়; নতুন Auth account বা password তৈরি হয় না। আগে থেকে active seller permission থাকলেও তালিকায় স্বয়ংক্রিয়ভাবে আসে।

অ্যাপ → ওয়ালেট → **Coins seller list**। প্রোফাইলেও তালিকার শর্টকাট আছে। তালিকায় নাম, ছবি, public ID, বরাদ্দ কয়েন, মোট পাঠানো কয়েন, সম্পন্ন ট্রান্সফারের সংখ্যা ও অ্যাডমিনের লেখা বিবরণ দেখা যায়। Send Message একই অ্যাপের ব্যক্তিগত মেসেজ খোলে। নিজের seller card থেকে নিজের seller wallet খোলা যায়।

সেলার নিজের সাধারণ login করা account থেকেই **সেলার ওয়ালেট** খুলবেন। গ্রাহকের ID দিয়ে খুঁজে নির্দিষ্ট কয়েন পাঠাবেন। একই transaction-এ seller pool কমে এবং গ্রাহকের spendable coins বাড়ে। নিজের কাছে পাঠানো, বরাদ্দের বেশি পাঠানো, blocked user-কে পাঠানো এবং বাতিল permission দিয়ে পাঠানো নিষিদ্ধ।

Owner-এর সেভে অনিশ্চিত network response হলে একই receipt পুনরায় যাচাই হয়; বরাদ্দ দ্বিগুণ হয় না। সেলার বন্ধ করলে তালিকা ও অ্যাকাউন্টের seller menu সাধারণ polling cycle-এ সরে যায়; server সঙ্গে সঙ্গে নতুন transfer অনুমতি যাচাই করে। অন্যান্য staff permissions অক্ষত থাকে।

কোনো sample seller, বাইরের screenshot-এর phone number, success percentage বা অর্থের GMV production-এ বসানো হয়নি। অনুমোদিত বাস্তব seller না থাকলে তালিকা খালি থাকবে। Public seller card-এ personal login email, password, সাধারণ game wallet বা অন্য staff permissions প্রকাশ হয় না।

Tencent Advanced Permission Control ব্যবহারকারীর অনুমতিতে চালু। Free-only routing-এ verified budget ছাড়া Agora fallback নেওয়া হয় না। Agora-র free minutes যাচাই করে `AGORA_FREE_MINUTES` বসালে সেটি provider order অনুযায়ী যুক্ত হবে। Server health-এ configured `voiceProviders` দেখা যায়; এটি বাস্তব দুই ফোনে অডিও পৌঁছানোর প্রমাণ নয়।
