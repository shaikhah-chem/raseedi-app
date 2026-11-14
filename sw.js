// يجعل «رصيدي الذهبي» يعمل بدون إنترنت بعد أول فتح
const CACHE = 'raseedi-v2';
const FILES = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  // نحفظ ملفات التطبيق ومكتبات Firebase فقط (لا نحفظ اتصالات قاعدة البيانات)
  if (u.origin !== self.location.origin && u.host !== 'www.gstatic.com') return;
  // الشبكة أولًا (للحصول على التحديثات)، ثم النسخة المحفوظة عند انقطاع الإنترنت
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
