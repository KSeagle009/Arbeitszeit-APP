'use strict';
const VERSION="0.9",BUILD="0.9-f60ba90f7394fd1e",ASSETS=[
  {
    "url": "./index.html",
    "sha256": "ea374847b6f2c55bb8e179f541c916d2c69e1dc2b72181142919933386691c7c"
  },
  {
    "url": "./app.js?v=9a1b3db0419e",
    "sha256": "9a1b3db0419e649a845155a1290696f242c3b67bf340c30a288dde15bf25b047"
  },
  {
    "url": "./style.css?v=3c1e7d71f6e3",
    "sha256": "3c1e7d71f6e3032b5e58f6662cbf808ad268002251675483f243fb244465bbad"
  },
  {
    "url": "./manifest.webmanifest",
    "sha256": "21c36fc55870fb90b5c9c474c368c8f689c2ad426cef52a2f0f3e1893e59e93d"
  },
  {
    "url": "./icon.svg",
    "sha256": "1cd6bf05667f16818b7c33fd6c38660fcb3bc3dcc3b64f320e90498bf0388918"
  },
  {
    "url": "./icon-192.png",
    "sha256": "dc90dca81efca71c8f1e9289d455dac298cb04d796696847f92312b1a975c9ed"
  },
  {
    "url": "./icon-512.png",
    "sha256": "5dceaca0b4d3475462cf5e6affef34b75946e085c5fb3f3914e3b5991414a143"
  },
  {
    "url": "./apple-touch-icon.png",
    "sha256": "6127c94aa7f72b47f58f1489f9934236550fce4d2ad5ff494fbb91f7c3c0674a"
  },
  {
    "url": "./vendor/pdf-lib.min.js",
    "sha256": "0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f"
  }
];
const scopeURL=self.registration.scope;
const PREFIX='arbeitszeit-offline:'+encodeURIComponent(new URL(scopeURL).pathname)+':';
const CACHE=PREFIX+BUILD;
const absolute=path=>new URL(path,scopeURL).href;
const READY=absolute('./__offline_ready__');
async function checkedFetch(asset){
 const response=await fetch(new Request(absolute(asset.url),{cache:'no-store',credentials:'same-origin'}));
 if(!response.ok||response.type==='opaque'||new URL(response.url).origin!==new URL(scopeURL).origin)throw Error('Datei nicht verfügbar');
 const bytes=await response.clone().arrayBuffer();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 if(digest!==asset.sha256)throw Error('Dateien gehören noch nicht zum selben Stand');
 return response;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 try{
  const responses=await Promise.all(ASSETS.map(checkedFetch));
  const cache=await caches.open(CACHE);
  for(let i=0;i<ASSETS.length;i++)await cache.put(absolute(ASSETS[i].url),responses[i]);
  await cache.put(READY,new Response(JSON.stringify({version:VERSION,build:BUILD}),{headers:{'Content-Type':'application/json'}}));
 }catch(error){await caches.delete(CACHE);throw error;}
 // Updates wait until the user presses the update button; first install activates normally.
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const own=(await caches.keys()).filter(key=>key.startsWith(PREFIX)&&key!==CACHE);
 // Keep two previous releases for still-open older tabs; never touch other apps' caches.
 for(const key of own.slice(0,Math.max(0,own.length-2)))await caches.delete(key);
 await self.clients.claim();
})()));
async function status(){
 const cache=await caches.open(CACHE);
 const ready=!!(await cache.match(READY))&&(await Promise.all(ASSETS.map(asset=>cache.match(absolute(asset.url))))).every(Boolean);
 return {version:VERSION,build:BUILD,ready};
}
self.addEventListener('message',event=>{
 if(!event.source?.url?.startsWith(scopeURL))return;
 if(event.data?.type==='OFFLINE_STATUS')event.waitUntil(status().then(result=>event.ports[0]?.postMessage(result)));
 if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==new URL(scopeURL).origin||!url.href.startsWith(scopeURL))return;
 const documentRequest=request.mode==='navigate'&&(url.pathname===new URL(scopeURL).pathname||url.pathname===new URL('./index.html',scopeURL).pathname);
 const asset=ASSETS.find(item=>absolute(item.url)===url.href);
 if(!documentRequest&&!asset){
  // Old versioned asset URLs are only served from this app's previous release caches.
  if(/\/(app\.js|style\.css)$/.test(url.pathname)&&url.search)event.respondWith((async()=>{for(const key of(await caches.keys()).filter(key=>key.startsWith(PREFIX)).reverse()){const cached=await(await caches.open(key)).match(request);if(cached)return cached;}return fetch(request);})());
  return;
 }
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),key=documentRequest?absolute('./index.html'):request;
  const cached=await cache.match(key);if(cached)return cached;
  const target=documentRequest?ASSETS.find(item=>item.url==='./index.html'):asset;
  try{const response=await checkedFetch(target);await cache.put(key,response.clone());return response;}
  catch{return new Response(documentRequest?'Die Offline-Dateien sind nicht mehr vollständig verfügbar. Bitte die App mit Internet erneut einrichten.':'Offline-Datei nicht verfügbar',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}
 })());
});
