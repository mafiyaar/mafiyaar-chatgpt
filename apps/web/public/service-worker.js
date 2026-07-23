const VERSION='mafiyaar-v1.0.0';
const SHELL=['/','/styles.css','/assets/client/app.js','/assets/client/api.js','/assets/client/realtime.js','/assets/shared/copy.js','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET'||new URL(req.url).pathname.startsWith('/api/')||new URL(req.url).pathname.startsWith('/ws/'))return;event.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(VERSION).then(c=>c.put(req,copy));return res}).catch(()=>caches.match(req).then(r=>r||caches.match('/'))));});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting()});
