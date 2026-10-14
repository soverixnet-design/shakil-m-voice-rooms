const CACHE='earnbd-install-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['./offline.html','./icons/app-192.png','./icons/app-512.png'])).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('earnbd-install-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// Never cache account balances, authenticated APIs, Firebase reads or bets.
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||event.request.mode!=='navigate'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).catch(()=>caches.match(new URL('./offline.html',self.location.href).href)))});

self.addEventListener('notificationclick',event=>{event.notification.close();const peer=event.notification.data?.senderId;if(typeof peer!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(peer))return;const url=new URL('./',self.location.href);url.searchParams.set('chat',peer);event.waitUntil(self.clients.openWindow(url.href));});
