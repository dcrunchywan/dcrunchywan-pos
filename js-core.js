// ⚠️ URL DEPLOYMENT API WEB APP GOOGLE APPS SCRIPT ANDA
  const API_URL = "https://script.google.com/macros/s/AKfycbw7o57RDEHgpuKdYWtysY_94vVEDhzAOu-b_EK0oUH0znTcWc3rr6S7Jj2E1NQgRpAV/exec";

// Util format angka ke Rupiah, dipakai bersama oleh kasir & dashboard.
// Contoh: formatRupiah(15000) -> "Rp 15.000"
function formatRupiah(angka) {
  return 'Rp ' + (Number(angka) || 0).toLocaleString('id-ID');
}

  function toggleMobileSidebar() { 
    document.querySelector('.sidebar-nav')?.classList.toggle('show'); 
    document.querySelector('.sidebar-overlay')?.classList.toggle('show'); 
  }
  function closeMobileSidebar() { 
    document.querySelector('.sidebar-nav')?.classList.remove('show'); 
    document.querySelector('.sidebar-overlay')?.classList.remove('show'); 
  }

  // Tampilkan tombol "Update" (elemen ber-class .update-available-btn, ada
  // di sidebar & header mobile) begitu ketahuan ada versi baru yang sudah
  // ter-install tapi masih menunggu -- kasir yang pilih kapan mau pindah,
  // bukan otomatis. Sengaja dibuat sesederhana mungkin: satu tombol, satu
  // aksi, tanpa versi/channel macam-macam.
  function tampilkanTombolUpdate(workerBaru) {
    document.querySelectorAll('.update-available-btn').forEach(function(btn) {
      btn.style.display = 'inline-flex';
      btn.onclick = function() { workerBaru.postMessage('SKIP_WAITING'); };
    });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('sw.js').then(function(reg) {
        console.log('ServiceWorker Aktif di scope: ', reg.scope);

        if (reg.waiting) { tampilkanTombolUpdate(reg.waiting); }

        reg.addEventListener('updatefound', function() {
          var workerBaru = reg.installing;
          if (!workerBaru) return;
          workerBaru.addEventListener('statechange', function() {
            // 'installed' + sudah ada controller (bukan install pertama kali)
            // berarti ini update untuk versi yang SUDAH terpasang sebelumnya.
            if (workerBaru.state === 'installed' && navigator.serviceWorker.controller) {
              tampilkanTombolUpdate(workerBaru);
            }
          });
        });

        // PENTING: browser TIDAK otomatis sering-sering cek sw.js kalau tab
        // dibiarkan terbuka lama (khas tablet kasir yang jarang di-reload
        // manual) -- register() cuma cek sekali saat itu. Jadi di sini kita
        // PAKSA cek update: langsung sekali sekarang, lalu berkala tiap 5
        // menit selama tab terbuka, supaya tombol "Update" tetap ketahuan
        // muncul tanpa perlu reload manual sama sekali.
        reg.update();
        setInterval(function() { reg.update(); }, 5 * 60 * 1000);
      }, function(err) { console.log('ServiceWorker Gagal: ', err); });

      // Setelah tombol Update ditekan (SKIP_WAITING terkirim) dan service
      // worker baru selesai ambil alih, reload SEKALI supaya halaman benar-benar
      // pakai kode versi baru.
      var sudahReload = false;
      navigator.serviceWorker.addEventListener('controllerchange', function() {
        if (sudahReload) return;
        sudahReload = true;
        window.location.reload();
      });
    });
  }
