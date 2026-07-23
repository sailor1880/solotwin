/* Sailing Assistant service worker — app shell + ENC/tile + data offline caching */
const APP='sa-app-v1', TILES='sa-tiles-v1', DATA='sa-data-v1';
const SHELL=['./','index.html','windy.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-180.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(APP).then(c=>c.addAll(SHELL)).catch(()=>{}).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys()
    .then(ks=>Promise.all(ks.map(k=>[APP,TILES,DATA].includes(k)?null:caches.delete(k))))
    .then(()=>self.clients.claim()));
});

// map-tile / chart hosts -> cache-first (works offline; instant on revisit)
const TILE_RE=/\/export\?|MaritimeChartService|charttools\.noaa|tile\.openstreetmap|basemaps\.cartocdn|tiles\.openseamap|mesonet\.agron\.iastate|arcgisonline/;

self.addEventListener('fetch', e=>{
  const req=e.request; if(req.method!=='GET') return;
  let url; try{ url=new URL(req.url); }catch(_){ return; }
  if(TILE_RE.test(req.url)){ e.respondWith(cacheFirst(req,TILES)); return; }
  if(url.origin===location.origin && /\.(json|gpx)$/.test(url.pathname)){ e.respondWith(staleWhile(req,DATA)); return; }
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).then(r=>{ caches.open(APP).then(c=>c.put(req,r.clone())); return r; })
      .catch(()=>caches.match(req).then(r=>r||caches.match('index.html')))); return;
  }
  if(url.origin===location.origin){ e.respondWith(caches.match(req).then(r=>r||fetch(req))); }
});

function cacheFirst(req,name){
  return caches.open(name).then(c=>c.match(req).then(hit=> hit ||
    fetch(req).then(res=>{ if(res && (res.ok||res.type==='opaque')) c.put(req,res.clone()); return res; })
      .catch(()=>hit) ));
}
function staleWhile(req,name){
  return caches.open(name).then(c=>c.match(req).then(hit=>{
    const net=fetch(req).then(res=>{ if(res && res.ok) c.put(req,res.clone()); return res; }).catch(()=>hit);
    return hit || net; }));
}
