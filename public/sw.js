const CACHE = 'aetherphone-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  e.respondWith(
    caches.match(req).then(cached=>{
      const fetchPromise=fetch(req).then(res=>{
        if(res.ok){
          const clone=res.clone();
          caches.open(CACHE).then(c=>c.put(req, clone));
        }
        return res;
      }).catch(()=>cached);
      return cached || fetchPromise;
    })
  );
});
self.addEventListener('sync', e=>{
  if(e.tag==='aether-sync'){
    e.waitUntil(fetch('/').then(()=>self.registration.showNotification('AetherPhone DB', {body:'Background sync complete — catalog up to date', icon:'/icons/icon-192.png'})));
  }
});
