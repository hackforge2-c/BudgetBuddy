const CACHE = 'expenseiq-v4'
const ASSETS = ['/', '/index.html', '/src/main.jsx', '/src/App.jsx', '/src/index.css']

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))))
self.addEventListener('fetch', e => {
  if (e.request.url.includes('api.anthropic.com')) return
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)).catch(() => caches.match('/')))
})
