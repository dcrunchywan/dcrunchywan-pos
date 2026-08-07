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
// PENTING: self.skipWaiting() SENGAJA TIDAK dipanggil otomatis di sini lagi
// -- versi baru akan ter-install di background lalu MENUNGGU (tidak
// langsung aktif), supaya kasir tetap pakai versi LAMA sampai sengaja
// menekan tombol "Update" di layar (lihat js-core.js & pesan 'SKIP_WAITING'
// di bawah). Ini penting selagi aplikasi masih sering diubah -- supaya
// tidak ada perubahan mendadak di tengah shift kasir tanpa sepengetahuan.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Dipanggil dari halaman (lewat tombol "Update") saat kasir siap pindah ke
// versi baru -- baru di titik ini service worker yang sedang menunggu
// dipaksa aktif.
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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
// service worker baru langsung mengambil alih tab yang SUDAH terbuka begitu
// dia AKHIRNYA aktif (dipicu tombol "Update", lewat pesan 'SKIP_WAITING'
// di atas) -- jadi kasir tidak perlu tutup-buka tab lagi setelah update.
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
