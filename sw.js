const CACHE_NAME = 'dcrunchywan-pos-cache-v7';
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

// PENTING: KEMBALI ke CACHE-FIRST (sempat diganti network-first, tapi itu
// bikin app shell ikut menunggu jaringan setiap dibuka -- buruk untuk app
// yang harus tetap cepat & andal walau offline/sinyal jelek). Sekarang app
// selalu buka INSTAN dari cache. Update konten (index.html/js-kasir.js/dst)
// tetap kepakai dengan aman lewat jalur LAIN: karena skipWaiting() tidak
// otomatis (lihat 'install' di atas), versi baru (termasuk urlsToCache
// terbaru) di-cache di bawah CACHE_NAME BARU saat install, tapi baru
// benar-benar dipakai setelah kasir menekan tombol "Update" -- jadi tombol
// itu sekarang menggerbangi SEMUA perubahan (kode sw.js MAUPUN isi
// halaman), bukan cuma sw.js seperti sebelumnya.
self.addEventListener('fetch', event => {
  // Hanya tangani request GET halaman lokal agar data POST transaksi tidak macet
  if (event.request.method === 'GET' && !event.request.url.includes('script.google.com')) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).catch(() => {
          return caches.match('./index.html');
        });
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
