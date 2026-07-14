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

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('sw.js').then(function(reg) {
        console.log('ServiceWorker Aktif di scope: ', reg.scope);
      }, function(err) { console.log('ServiceWorker Gagal: ', err); });
    });
  }
