const CACHE_NAME = 'dcrunchywan-pos-cache-v6';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './js-core.js',
  './js-kasir.js',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11'
];

// Pemasangan asset ke storage internal tablet.
// self.skipWaiting() dipanggil supaya service worker versi baru LANGSUNG
// aktif setelah ter-install, tidak menunggu semua tab POS ditutup dulu --
// sebelumnya ini tidak ada, jadi update kode (js-kasir.js dkk) bisa
// tertahan lama di cache lama walau sudah di-push ke GitHub.
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// PENTING: strategi NETWORK-FIRST (bukan cache-first seperti sebelumnya).
// Tablet SELALU coba ambil versi TERBARU dari internet dulu setiap kali
// buka/refresh app -- cache cuma dipakai sebagai cadangan kalau memang
// sedang offline. Ini sengaja diganti dari cache-first supaya update kode
// otomatis kepakai begitu ada koneksi, TANPA perlu hard refresh/unregister
// manual di tablet setiap kali ada perubahan -- sebelumnya cache-first
// bikin tablet bisa "terkunci" ke versi lama walau online, karena cache
// selalu dicek duluan sebelum jaringan.
self.addEventListener('fetch', event => {
  // Hanya tangani request GET halaman lokal agar data POST transaksi tidak macet
  if (event.request.method === 'GET' && !event.request.url.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        // Simpan salinan terbaru ke cache supaya tetap ada cadangan offline
        // yang up-to-date (bukan snapshot beku dari saat install pertama).
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        return networkResponse;
      }).catch(() => {
        // Offline / jaringan gagal -> baru pakai cache sebagai fallback
        return caches.match(event.request).then(cached => cached || caches.match('./index.html'));
      })
    );
  }
});

// Pembersihan cache versi lama saat update, plus clients.claim() supaya
// service worker baru langsung mengambil alih tab yang SUDAH terbuka
// (bukan cuma tab yang dibuka setelah ini), sepasang dengan skipWaiting()
// di atas.
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (cache !== CACHE_NAME) {
              return caches.delete(cache);
            }
          })
        );
      })
    ])
  );
});
