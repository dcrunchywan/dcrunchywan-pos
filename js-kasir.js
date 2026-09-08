  let menu = []; let cart = []; let isSyncing = false; let isSavingKas = false; let currentCategory1 = 'Semua'; let currentCategory2 = 'Semua'; let totalBelanjaGlobal = 0;
  let bypassModeActive = false; let isOwnerAuthenticated = false; let dataGlobalRekapKirim = {}; let dataOpnameLokalRaw = [];
  let diskonTipe = 'Rp'; let numpadBootstrapModalInstance = null;

  function getLocalIsoDate(d){ const x=d||new Date(); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); }
  document.getElementById('rekapDatePicker').value = getLocalIsoDate();
  document.getElementById('historyDatePicker').value = getLocalIsoDate();


  function toggleOwnerAuth() {
    if (isOwnerAuthenticated) {
      isOwnerAuthenticated = false;
      document.getElementById('ownerModeBtn')?.classList.add('opacity-40');
      if(document.getElementById('ownerMobileBtn')) document.getElementById('ownerMobileBtn').className = "btn btn-sm btn-outline-light py-1 px-2 fw-bold";
      document.getElementById('dashboard-tab-btn').style.setProperty('display', 'none', 'important');
      Swal.fire('Owner Logout', 'Kembali ke mode kasir standar.', 'info');
      applyOwnerUIVisibility();
    } else {
      Swal.fire({ title: 'Verifikasi Owner', input: 'password', inputPlaceholder: 'Masukkan PIN Owner', showCancelButton: true }).then((res) => {
        if(res.value === "445566") {
          isOwnerAuthenticated = true;
          document.getElementById('ownerModeBtn')?.classList.remove('opacity-40');
          if(document.getElementById('ownerMobileBtn')) document.getElementById('ownerMobileBtn').className = "btn btn-sm btn-success py-1 px-2 fw-bold";
          document.getElementById('dashboard-tab-btn').style.setProperty('display', 'block', 'important');
          Swal.fire('Otorisasi Diterima', 'Fitur Admin & Dashboard Owner Aktif!', 'success');
          applyOwnerUIVisibility();
        } else if(res.isConfirmed) {
          Swal.fire('Gagal', 'PIN Salah!', 'error');
        }
      });
    }
  }

  function handleAktivitasDapurChange(val) {
    const minyWrapper = document.getElementById('wrapperMinyakGoreng');
    const lblQty = document.getElementById('labelQtyAyam');
    if (!minyWrapper || !lblQty) return;
    if (val === "Goreng Ayam") { minyWrapper.style.display = "block"; lblQty.innerText = "Jumlah Masak (Potong)"; }
    else if (val === "Ayam Masuk") { minyWrapper.style.display = "none"; lblQty.innerText = "Jumlah Masak (Potong)"; }
    else { minyWrapper.style.display = "none"; lblQty.innerText = "Jumlah Rusak / Sisa (Potong)"; }
  }

  function setStokAyamStatusBadge(state) {
    const badge = document.getElementById('stokAyamStatusBadge');
    if (!badge) return;
    if (state === 'loading') {
      badge.className = 'badge rounded-pill bg-secondary extra-small';
      badge.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Memuat...';
    } else if (state === 'terkini') {
      badge.className = 'badge rounded-pill bg-success extra-small';
      badge.innerHTML = '<i class="fas fa-check me-1"></i>Terkini dari server';
    } else if (state === 'estimasi') {
      badge.className = 'badge rounded-pill bg-warning text-dark extra-small';
      badge.innerHTML = '<i class="fas fa-triangle-exclamation me-1"></i>Estimasi lokal';
    } else {
      badge.className = 'badge rounded-pill bg-secondary extra-small';
      badge.innerHTML = '<i class="fas fa-plug-circle-xmark me-1"></i>Offline, belum ada data';
    }
  }

  function tampilkanStokAyam(data) {
    document.getElementById('liveStokMentah').innerText = (data.stokMentah || 0) + " Ptg";
    document.getElementById('liveStokEtalase').innerText = (data.stokEtalase || 0) + " Ptg";
    document.getElementById('liveStokMinyak').innerText = (data.stokMinyakBaku || 0) + " L";
  }

  // Estimasi OFFLINE: mulai dari nilai server TERAKHIR yang berhasil diambil
  // (base), lalu terapkan efek setiap aksi yang MASIH MENUNGGU sync (belum
  // dikonfirmasi server) -- persis meniru logika sesuaikanStokBarang() di
  // server (simpanData/simpanLogOperasional). Void SENGAJA tidak dihitung di
  // sini (disepakati tetap sederhana) -- kasusnya jarang & akan otomatis
  // benar lagi begitu koneksi kembali dan angka server diambil ulang.
  function computeOptimisticStokEstimate(base) {
    let mentah = Number(base.stokMentah) || 0;
    let etalase = Number(base.stokEtalase) || 0;
    let minyak = Number(base.stokMinyakBaku) || 0;

    const qSales = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    qSales.forEach(row => {
      const nama = (row.item || '').toLowerCase();
      const isAyam = !row.isMama && (nama.indexOf('ayam') !== -1 || nama.indexOf('geprek') !== -1);
      if (isAyam) etalase -= Number(row.qty) || 0;
    });

    const qOpr = JSON.parse(localStorage.getItem('sync_queue_opr') || '[]');
    qOpr.forEach(row => {
      const qty = Number(row.qty) || 0;
      if (row.jenisAktivitas === 'Ayam Masuk') {
        mentah += qty;
      } else if (row.jenisAktivitas === 'Goreng Ayam') {
        mentah -= qty;
        etalase += qty;
        const qtyMinyak = Number(row.minyakUsed) || 0;
        if (qtyMinyak > 0) minyak -= qtyMinyak;
      } else if (row.jenisAktivitas === 'Ayam Waste') {
        etalase -= qty;
      }
    });

    return {
      stokMentah: Math.max(0, mentah),
      stokEtalase: Math.max(0, etalase),
      stokMinyakBaku: Math.max(0, minyak)
    };
  }

  function loadStokAyam() {
    setStokAyamStatusBadge('loading');
    fetch(`${API_URL}?aksi=ambilStokAyam`)
      .then(res => res.json())
      .then(res => {
        tampilkanStokAyam(res);
        localStorage.setItem('cache_stok_ayam', JSON.stringify(res));
        setStokAyamStatusBadge('terkini');
      }).catch(err => {
        console.log("Offline mode: Gagal load real-time stok ayam, pakai estimasi lokal.");
        const cacheRaw = localStorage.getItem('cache_stok_ayam');
        if (!cacheRaw) { setStokAyamStatusBadge('offline'); return; }
        const estimasi = computeOptimisticStokEstimate(JSON.parse(cacheRaw));
        tampilkanStokAyam(estimasi);
        setStokAyamStatusBadge('estimasi');
      });
  }

  // Ringkasan HARI INI (ayam digoreng, ayam terjual, pemakaian minyak) di
  // tab Dapur. Kalau fetch gagal (offline), JANGAN cuma diamkan angka lama
  // apa adanya -- itu justru bisa membuat karyawan mengira input barusan
  // "tidak masuk" (karena angka di layar tidak berubah) lalu input dobel.
  // Sebagai gantinya: mulai dari cache server TERAKHIR, lalu tambahkan
  // efek entri yang MASIH MENUNGGU sync (computeOptimisticRingkasanEstimate),
  // supaya begitu karyawan simpan data dapur, angka di panel ini langsung
  // ikut naik walau belum online -- ditandai jelas sebagai "Estimasi lokal".
  function setDapurStatusBadge(state, waktuLabel) {
    const badge = document.getElementById('dapurStatusBadge');
    if (!badge) return;
    if (state === 'loading') {
      badge.className = 'badge rounded-pill bg-secondary extra-small';
      badge.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Memuat...';
    } else if (state === 'terkini') {
      badge.className = 'badge rounded-pill bg-success extra-small';
      badge.innerHTML = '<i class="fas fa-check me-1"></i>Data terkini';
    } else if (state === 'estimasi') {
      badge.className = 'badge rounded-pill bg-warning text-dark extra-small';
      badge.innerHTML = '<i class="fas fa-triangle-exclamation me-1"></i>Estimasi lokal' + (waktuLabel ? (' (server: ' + waktuLabel + ')') : '');
    } else {
      badge.className = 'badge rounded-pill bg-secondary extra-small';
      badge.innerHTML = '<i class="fas fa-plug-circle-xmark me-1"></i>Offline, belum ada data';
    }
  }

  function tampilkanRingkasanDapur(res) {
    document.getElementById('ringkasanAyamGoreng').innerText = (res.ayamDigoreng || 0).toLocaleString('id-ID');
    document.getElementById('ringkasanAyamTerjual').innerText = (res.ayamTerjual || 0).toLocaleString('id-ID');
    document.getElementById('ringkasanMinyak').innerText = (res.pemakaianMinyak || 0).toLocaleString('id-ID') + ' L';
  }

  // Sama pola-nya dengan computeOptimisticStokEstimate() -- base dari cache
  // server terakhir, ditambah efek entri yang masih di sync_queue/sync_queue_opr.
  // Void SENGAJA tidak dihitung (konsisten dengan estimasi stok di atas).
  function computeOptimisticRingkasanEstimate(base) {
    let ayamDigoreng = Number(base.ayamDigoreng) || 0;
    let ayamTerjual = Number(base.ayamTerjual) || 0;
    let pemakaianMinyak = Number(base.pemakaianMinyak) || 0;

    const qSales = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    qSales.forEach(row => {
      const nama = (row.item || '').toLowerCase();
      const isAyam = !row.isMama && (nama.indexOf('ayam') !== -1 || nama.indexOf('geprek') !== -1);
      if (isAyam) ayamTerjual += Number(row.qty) || 0;
    });

    const qOpr = JSON.parse(localStorage.getItem('sync_queue_opr') || '[]');
    qOpr.forEach(row => {
      if (row.jenisAktivitas === 'Goreng Ayam') {
        ayamDigoreng += Number(row.qty) || 0;
        pemakaianMinyak += Number(row.minyakUsed) || 0;
      }
    });

    return { ayamDigoreng: ayamDigoreng, ayamTerjual: ayamTerjual, pemakaianMinyak: pemakaianMinyak };
  }

  function loadRingkasanDapurHariIni() {
    setDapurStatusBadge('loading');
    fetch(`${API_URL}?aksi=ambilLogDapurHariIni`)
      .then(res => res.json())
      .then(res => {
        if (!res || res.status !== 'ok') throw new Error('Respon tidak valid');
        tampilkanRingkasanDapur(res);
        localStorage.setItem('cache_ringkasan_dapur', JSON.stringify({ data: res, waktu: new Date().toISOString() }));
        setDapurStatusBadge('terkini');
        // Sinkronkan juga list kasir realtime jika picker tidak sedang di tanggal lain
        if (!isOwnerAuthenticated || !document.getElementById('kasirLogTanggalPicker')?.value || isKasirLogPickerHariIni()) {
          renderKasirLogDapurGabungan(res);
        }
      })
      .catch(err => {
        console.log("Offline mode: Gagal load ringkasan dapur hari ini, pakai estimasi lokal.");
        const cacheRaw = localStorage.getItem('cache_ringkasan_dapur');
        if (!cacheRaw) {
          setDapurStatusBadge('offline');
          setKasirLogStatusBadge('offline');
          // tetap tampilkan pending saja
          renderKasirLogDapurGabungan({ daftarAktivitas: [], periodeLabel: new Date().toLocaleDateString('id-ID') });
          return;
        }
        const cache = JSON.parse(cacheRaw);
        const estimasi = computeOptimisticRingkasanEstimate(cache.data);
        tampilkanRingkasanDapur(estimasi);
        setDapurStatusBadge('estimasi', new Date(cache.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
        // cache.data sudah berisi daftarAktivitas server terakhir -> gabungkan pending
        var estimasiLog = Object.assign({}, cache.data, estimasi);
        // pastikan daftarAktivitas tetap dari cache untuk di-merge pending
        estimasiLog.daftarAktivitas = cache.data.daftarAktivitas || [];
        renderKasirLogDapurGabungan(estimasiLog, true, cache.waktu);
      });
  }

  // ========== LOG DAPUR KASIR REALTIME (di bawah form input) ==========
  function setKasirLogStatusBadge(state, waktuLabel) {
    const badge = document.getElementById('kasirLogStatusBadge');
    if (!badge) return;
    if (state === 'loading') {
      badge.className = 'badge rounded-pill bg-secondary extra-small';
      badge.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Memuat...';
    } else if (state === 'terkini') {
      badge.className = 'badge rounded-pill bg-success extra-small';
      badge.innerHTML = '<i class="fas fa-check me-1"></i>Terkini';
    } else if (state === 'estimasi') {
      badge.className = 'badge rounded-pill bg-warning text-dark extra-small';
      badge.innerHTML = '<i class="fas fa-triangle-exclamation me-1"></i>Estimasi lokal' + (waktuLabel ? (' (server: ' + waktuLabel + ')') : '');
    } else {
      badge.className = 'badge rounded-pill bg-secondary extra-small';
      badge.innerHTML = '<i class="fas fa-plug-circle-xmark me-1"></i>Offline, belum ada data';
    }
  }

  function isKasirLogPickerHariIni() {
    const picker = document.getElementById('kasirLogTanggalPicker');
    if (!picker || !picker.value) return true;
    const hariIniIso = getLocalIsoDate();
    return picker.value === hariIniIso;
  }

  function formatJamDariPendingTgl(tglStr) {
    try {
      // toLocaleString('id-ID') bisa "01/09/2026, 21:43:00" atau "01/09/2026 21.43.00" tergantung browser — normalisasi
      let s = (tglStr || '').toString().trim();
      // ambil bagian waktu (setelah koma atau spasi terakhir)
      let waktuPart = '';
      if (s.indexOf(',') !== -1) waktuPart = s.split(',')[1] || '';
      else {
        const parts = s.split(' ');
        waktuPart = parts[parts.length - 1] || '';
      }
      waktuPart = waktuPart.trim().replace(/\./g, ':');
      const jamSplit = waktuPart.split(':');
      if (jamSplit.length >= 2) {
        const hh = (jamSplit[0] || '00').padStart(2,'0');
        const mm = (jamSplit[1] || '00').padStart(2,'0');
        if (!isNaN(parseInt(hh,10)) && !isNaN(parseInt(mm,10))) return hh + ':' + mm;
      }
    } catch(e) {}
    const d = new Date();
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }

  function buildPendingAktivitasUntukHariIni() {
    const qOpr = JSON.parse(localStorage.getItem('sync_queue_opr') || '[]');
    if (qOpr.length === 0) return [];
    const hariIniIso = getLocalIsoDate();
    // hanya pending yang tanggalnya hari ini (bandingkan lewat tgl string client)
    return qOpr.map(function(row) {
      const qty = Number(row.qty) || 0;
      const jam = formatJamDariPendingTgl(row.tgl);
      const ket = row.keterangan || '';
      // Normalisasi agar cocok dengan format server daftarAktivitas
      if (row.jenisAktivitas === 'Goreng Ayam') {
        const hasil = [{ jenis: 'Goreng Ayam (Matang)', sektor: 'Etalase', jumlah: qty, keterangan: ket, jam: jam, pending: true }];
        const minyak = Number(row.minyakUsed) || 0;
        if (minyak > 0) hasil.push({ jenis: 'Pemakaian Minyak', sektor: 'Minyak', jumlah: -minyak, keterangan: ket, jam: jam, pending: true });
        return hasil;
      } else if (row.jenisAktivitas === 'Ayam Masuk') {
        return [{ jenis: 'Ayam Masuk', sektor: 'Freezer', jumlah: qty, keterangan: ket || 'Masuk dari Supplier', jam: jam, pending: true }];
      } else {
        return [{ jenis: 'Ayam Rusak / Waste', sektor: 'Etalase', jumlah: -qty, keterangan: ket || 'Waste Dapur', jam: jam, pending: true }];
      }
    }).flat();
  }

  function renderKasirLogDapurGabungan(resServer, isEstimasi, waktuCacheIso) {
    const container = document.getElementById('kasirLogDapurContainer');
    const labelEl = document.getElementById('kasirLogPeriodeLabel');
    if (!container) return;
    const periode = (resServer && resServer.periodeLabel) ? resServer.periodeLabel : new Date().toLocaleDateString('id-ID');
    if (labelEl) labelEl.textContent = periode;

    const daftarServer = Array.isArray(resServer.daftarAktivitas) ? resServer.daftarAktivitas.slice() : [];
    // Pending hanya ditampilkan jika melihat hari ini (bukan histori owner tanggal lain)
    // Server sudah desc (terbaru atas), pending adalah yang PALING baru → taruh di paling atas, di-reverse agar pending terbaru paling atas
    const tampilkanPending = !isOwnerAuthenticated || isKasirLogPickerHariIni();
    let pendingList = tampilkanPending ? buildPendingAktivitasUntukHariIni() : [];
    if (pendingList.length > 1) pendingList = pendingList.slice().reverse();
    const gabungan = pendingList.concat(daftarServer);

    if (gabungan.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-3 extra-small">Belum ada aktivitas hari ini.</div>';
      if (isEstimasi) setKasirLogStatusBadge('estimasi', waktuCacheIso ? new Date(waktuCacheIso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '');
      else if (daftarServer.length === 0 && pendingList.length === 0) setKasirLogStatusBadge('terkini');
      return;
    }

    let html = '';
    gabungan.forEach(function(a) {
      const isPending = !!a.pending;
      const jamTampil = a.jam || '--:--';
      const jumlah = Number(a.jumlah) || 0;
      const isMinus = jumlah < 0;
      const ketText = (a.keterangan || '').toString().trim();
      const badgePending = isPending ? '<span class="badge bg-warning text-dark ms-1" style="font-size:0.6rem;">Menunggu sync</span>' : '';
      html += `<div class="kasir-log-row ${isPending ? 'is-pending' : ''}">`
        + `<div class="kasir-log-main">`
        + `<span class="kasir-log-jam">${jamTampil}</span>`
        + `<span class="kasir-log-jenis">${a.jenis}</span>`
        + `<span class="kasir-log-leader"></span>`
        + `<span class="kasir-log-jumlah ${isMinus ? 'is-minus' : 'is-plus'}">${jumlah > 0 ? '+' : ''}${jumlah.toLocaleString('id-ID')}</span>`
        + badgePending
        + `</div>`
        + `<div class="kasir-log-ket-row">${ketText}</div>`
        + `</div>`;
    });
    container.innerHTML = html;

    if (isEstimasi) setKasirLogStatusBadge('estimasi', waktuCacheIso ? new Date(waktuCacheIso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '');
    else setKasirLogStatusBadge(tampilkanPending && pendingList.length > 0 ? 'estimasi' : 'terkini', '');
  }

  function loadLogDapurKasir() {
    // Owner mode dengan tanggal dipilih -> fetch histori tanggal itu
    if (isOwnerAuthenticated) {
      const picker = document.getElementById('kasirLogTanggalPicker');
      const tglVal = picker ? picker.value : '';
      if (tglVal) {
        const bagian = tglVal.split('-'); // yyyy-MM-dd
        const tgl = parseInt(bagian[2], 10);
        const bln = parseInt(bagian[1], 10);
        const thn = parseInt(bagian[0], 10);
        setKasirLogStatusBadge('loading');
        fetch(`${API_URL}?aksi=ambilLogDapurHarian&tanggal=${tgl}&bulan=${bln}&tahun=${thn}`)
          .then(res => res.json())
          .then(res => {
            if (!res || res.status !== 'ok') throw new Error('Respon tidak valid');
            renderKasirLogDapurGabungan(res);
          })
          .catch(err => {
            console.log('Gagal load histori dapur tanggal lain', err);
            setKasirLogStatusBadge('offline');
            const container = document.getElementById('kasirLogDapurContainer');
            if (container) container.innerHTML = '<div class="text-center text-muted py-3 extra-small">Gagal memuat histori. Cek koneksi.</div>';
          });
        return;
      }
    }
    // Default kasir (atau owner tanpa tanggal / hari ini) -> hari ini
    setKasirLogStatusBadge('loading');
    fetch(`${API_URL}?aksi=ambilLogDapurHariIni`)
      .then(res => res.json())
      .then(res => {
        if (!res || res.status !== 'ok') throw new Error('Respon tidak valid');
        localStorage.setItem('cache_ringkasan_dapur', JSON.stringify({ data: res, waktu: new Date().toISOString() }));
        // update ringkasan juga agar tetap sinkron
        tampilkanRingkasanDapur(res);
        setDapurStatusBadge('terkini');
        renderKasirLogDapurGabungan(res);
      })
      .catch(err => {
        console.log('Offline mode log dapur kasir, pakai cache + pending');
        const cacheRaw = localStorage.getItem('cache_ringkasan_dapur');
        if (!cacheRaw) {
          setKasirLogStatusBadge('offline');
          renderKasirLogDapurGabungan({ daftarAktivitas: [], periodeLabel: new Date().toLocaleDateString('id-ID') });
          return;
        }
        const cache = JSON.parse(cacheRaw);
        renderKasirLogDapurGabungan(cache.data, true, cache.waktu);
      });
  }

  function toggleTipeDiskon() {
    diskonTipe = (diskonTipe === 'Rp') ? '%' : 'Rp';
    document.getElementById('diskonTipeBtn').innerText = diskonTipe;
    updateUI();
  }

  function bukaPopupNumpad() {
    if(document.getElementById('metodeBayar').value !== 'Cash' || bypassModeActive) return;
    document.getElementById('numpadPopupDisplay').innerText = '0';
    document.getElementById('numpadPopupKembalianLive').innerText = 'Rp 0';
    const diskonVal = parseInt(document.getElementById('diskonNotaInput').value, 10) || 0;
    let nominalPotongan = (diskonTipe === 'Rp') ? diskonVal : Math.round(totalBelanjaGlobal * (diskonVal / 100));
    const finalTagihan = Math.max(0, totalBelanjaGlobal - nominalPotongan);
    document.getElementById('numpadPopupTotalTagihan').innerText = 'Rp ' + finalTagihan.toLocaleString('id-ID');
    if(!numpadBootstrapModalInstance) { numpadBootstrapModalInstance = new bootstrap.Modal(document.getElementById('modalNumpadVirtual')); }
    numpadBootstrapModalInstance.show();
  }

  function pressNumpadPopup(key) {
    let currentDisplay = document.getElementById('numpadPopupDisplay').innerText;
    if(key === 'C') { currentDisplay = '0'; }
    else { if(currentDisplay === '0') { currentDisplay = (key === '00' || key === '000') ? '0' : key; } else { currentDisplay += key; } }
    document.getElementById('numpadPopupDisplay').innerText = currentDisplay;
    const nilaiMasukUang = parseInt(currentDisplay, 10) || 0;
    document.getElementById('uangBayar').value = nilaiMasukUang;
    updateKembalianLivePopup(nilaiMasukUang);
  }

  // Shortcut pecahan uang (mis. +50.000/+100.000) -- DITAMBAHKAN ke nominal
  // yang sedang diketik, bukan menimpanya, supaya cocok dengan cara kasir
  // menyusun lembar uang fisik yang diterima dari pembeli.
  function tambahNumpadPopup(nilaiTambah) {
    const displayEl = document.getElementById('numpadPopupDisplay');
    const nilaiSekarang = parseInt(displayEl.innerText, 10) || 0;
    const nilaiBaru = nilaiSekarang + nilaiTambah;
    displayEl.innerText = String(nilaiBaru);
    document.getElementById('uangBayar').value = nilaiBaru;
    updateKembalianLivePopup(nilaiBaru);
  }

  function updateKembalianLivePopup(nilaiUang) {
    const diskonVal = parseInt(document.getElementById('diskonNotaInput').value, 10) || 0;
    let nominalPotongan = (diskonTipe === 'Rp') ? diskonVal : Math.round(totalBelanjaGlobal * (diskonVal / 100));
    const finalTagihan = Math.max(0, totalBelanjaGlobal - nominalPotongan);
    const kembalianLive = nilaiUang - finalTagihan;
    const elKembalian = document.getElementById('numpadPopupKembalianLive');
    if (kembalianLive >= 0) {
      elKembalian.innerText = 'Rp ' + kembalianLive.toLocaleString('id-ID');
      elKembalian.style.color = '#2ecc71';
    } else {
      elKembalian.innerText = 'Kurang: Rp ' + Math.abs(kembalianLive).toLocaleString('id-ID');
      elKembalian.style.color = '#e74c3c';
    }
  }

  // Tombol konfirmasi DI DALAM popup keypad sekaligus jadi tombol "Bayar" --
  // begitu kasir menekannya, nominal & kembalian sudah ter-set (dari
  // pressNumpadPopup/tambahNumpadPopup), tinggal langsung proses checkout,
  // supaya kasir tidak perlu menekan BAYAR dua kali.
  function konfirmasiTunaiDanBayar() {
    hitungKembalian();
    prosesCheckout();
  }

  // Sumber kebenaran metode bayar tetap <select id="metodeBayar"> (disembunyikan)
  // supaya semua fungsi lain yang sudah baca .value-nya tidak perlu diubah --
  // tombol besar di UI cuma "mendorong" nilai ke select itu.
  function pilihMetodeBayar(metode) {
    document.getElementById('metodeBayar').value = metode;
    document.querySelectorAll('.metode-bayar-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.metode === metode);
    });
    handleMetodeBayarChange();
  }

  // Titik masuk tombol BAYAR: Cash (tanpa mode bypass) buka popup keypad
  // dulu -- metode lain (atau Cash+bypass, yang memang pas uang) langsung
  // diproses tanpa perlu isi nominal.
  function handleTombolBayar() {
    if (cart.length === 0) { Swal.fire({ icon: 'warning', title: 'Keranjang Kosong' }); return; }
    const metode = document.getElementById('metodeBayar').value;
    if (metode === 'Cash' && !bypassModeActive) {
      bukaPopupNumpad();
      return;
    }
    prosesCheckout();
  }

  function applyOwnerUIVisibility() {
    const headerStok = document.getElementById('ownerStokHeader');
    const ownerSection = document.getElementById('ownerApprovalSection');
    const arsipSection = document.getElementById('ownerArsipSection');
    if (headerStok) { headerStok.style.setProperty('display', isOwnerAuthenticated ? 'table-cell' : 'none', 'important'); }
    const kasirPickerWrap = document.getElementById('kasirLogOwnerPickerWrap');
    const kasirPicker = document.getElementById('kasirLogTanggalPicker');
    if (kasirPickerWrap) {
      kasirPickerWrap.style.display = isOwnerAuthenticated ? 'block' : 'none';
      if (isOwnerAuthenticated && kasirPicker && !kasirPicker.value) {
        kasirPicker.value = getLocalIsoDate();
      }
    }
    if (isOwnerAuthenticated) {
      if(ownerSection) ownerSection.style.setProperty('display', 'block', 'important');
      if(arsipSection) arsipSection.style.setProperty('display', 'block', 'important');
      loadDraftOpnameServerSide();
    } else {
      if(ownerSection) ownerSection.style.setProperty('display', 'none', 'important');
      if(arsipSection) arsipSection.style.setProperty('display', 'none', 'important');
      // kembali ke hari ini saat logout owner
      if (kasirPicker) kasirPicker.value = getLocalIsoDate();
    }
    filterTabelOpname();
    renderMenu();
    // wallet owner controls
    try{ renderWalletKasToko(); }catch(e){}
    // refresh log dapur sesuai mode (hari ini vs histori owner)
    if (document.getElementById('panel-stok')?.classList.contains('active') || document.getElementById('panel-stok')?.classList.contains('show')) {
      loadLogDapurKasir();
    }
  }

  let draftOpnameCache = [];
  function loadDraftOpnameServerSide() {
    const tbody = document.getElementById('ownerApprovalTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted"><i class="fas fa-spinner fa-spin"></i> Sinkronisasi Draft...</td></tr>';
    fetch(`${API_URL}?aksi=ambilDraftOpname`)
      .then(res => res.json())
      .then((draftList) => {
        draftOpnameCache = Array.isArray(draftList) ? draftList : [];
        if(!draftOpnameCache || draftOpnameCache.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="text-muted py-2">Tidak ada draft opname tertunda.</td></tr>';
          var ca=document.getElementById('checkAllDraft'); if(ca) ca.checked=false;
          var ch=document.getElementById('checkAllDraftHead'); if(ch) ch.checked=false;
          return;
        }
        tbody.innerHTML = '';
        draftOpnameCache.forEach((x) => {
          var escNama = x.nama.replace(/'/g, "\\'");
          tbody.innerHTML += `<tr><td><input type="checkbox" class="form-check-input draft-check" value="${x.rowNum}" data-nama="${escNama}" data-fisik="${x.fisik}"></td><td class="text-start fw-bold">${x.nama}</td><td><span class="badge bg-secondary">${x.sistem}</span></td><td><span class="badge bg-info">${x.fisik}</span></td><td class="fw-bold ${x.selisih < 0 ? 'text-danger':'text-success'}">${x.selisih}</td><td><button class="btn btn-xs btn-success py-1 px-2 fw-bold" onclick="approveDraftOpnameSingle(${x.rowNum}, '${escNama}', ${x.fisik})">APPROVE</button></td></tr>`;
        });
        var ca2=document.getElementById('checkAllDraft'); if(ca2) ca2.checked=false;
        var ch2=document.getElementById('checkAllDraftHead'); if(ch2) ch2.checked=false;
      });
  }
  function toggleSelectAllDraft(checked){
    document.querySelectorAll('.draft-check').forEach(function(cb){ cb.checked = checked; });
    var a=document.getElementById('checkAllDraft'); if(a) a.checked=checked;
    var b=document.getElementById('checkAllDraftHead'); if(b) b.checked=checked;
  }
  function getSelectedDrafts(){
    var sel=[];
    document.querySelectorAll('.draft-check:checked').forEach(function(cb){
      sel.push({rowNum: parseInt(cb.value,10), nama: cb.getAttribute('data-nama'), fisik: parseInt(cb.getAttribute('data-fisik'),10)});
    });
    return sel;
  }
  function approveBulkSelected(){
    var sel=getSelectedDrafts();
    if(sel.length===0) return Swal.fire('Pilih Draft','Centang minimal 1 draft untuk di-approve.','info');
    approveDraftBulk(sel);
  }
  function approveAllDrafts(){
    if(!draftOpnameCache || draftOpnameCache.length===0) return Swal.fire('Kosong','Tidak ada draft.','info');
    approveDraftBulk(draftOpnameCache.map(function(x){ return {rowNum:x.rowNum, nama:x.nama, fisik:x.fisik}; }));
  }
  function approveDraftBulk(list){
    if(!list || list.length===0) return;
    Swal.fire({ title: 'Approve '+list.length+' Draft?', text: 'Menyelaraskan stok terpilih menjadi nilai fisik kasir.', icon:'question', showCancelButton:true }).then(function(r){
      if(!r.isConfirmed) return;
      Swal.fire({ title: 'Memproses '+list.length+' Approval...', html: '0/'+list.length, allowOutsideClick:false, didOpen:function(){ Swal.showLoading(); }});
      var idx=0, ok=0, fail=0;
      function next(){
        if(idx>=list.length){
          Swal.close();
          Swal.fire('Selesai','Berhasil: '+ok+', Gagal: '+fail,'info');
          loadDraftOpnameServerSide(); loadStokBarang();
          return;
        }
        var it=list[idx];
        fetch(API_URL,{method:'POST', body:JSON.stringify({ aksi:'approveOpname', rowNum:it.rowNum, nama:it.nama, fisikVal:it.fisik })})
          .then(function(res){ return res.json(); })
          .then(function(res){
            if(res.hasil==="Sukses") ok++; else fail++;
          }).catch(function(){ fail++; })
          .finally(function(){
            idx++;
            Swal.getHtmlContainer().innerHTML = idx+'/'+list.length + ' (OK:'+ok+' Gagal:'+fail+')';
            next();
          });
      }
      next();
    });
  }

  function approveDraftOpnameSingle(rowNum, nama, fisikVal) {
    Swal.fire({ title: 'Approve Stok?', text: `Menyelaraskan stok utama ${nama} menjadi ${fisikVal} unit.`, icon: 'question', showCancelButton: true }).then((r) => {
      if(r.isConfirmed){
        Swal.fire({ title: 'Memproses Approval...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        fetch(API_URL, {
          method: 'POST',
          body: JSON.stringify({ aksi: 'approveOpname', rowNum: rowNum, nama: nama, fisikVal: fisikVal })
        })
        .then(res => res.json())
        .then((res) => {
          Swal.close();
          if(res.hasil === "Sukses") { Swal.fire('Berhasil', 'Stok utama sheet telah disesuaikan!', 'success'); loadDraftOpnameServerSide(); loadStokBarang(); }
          else { Swal.fire('Error', res.hasil || 'Gagal menghubungi server.', 'error'); }
        });
      }
    });
  }

  function eksekusiOpnameButa(namaBarang, stokSistem) {
    let cleanId = namaBarang.replace(/[^a-zA-Z0-9]/g, '');
    let inputFisik = document.getElementById(`inputFisikBarang-${cleanId}`);
    let fisikVal = parseInt(inputFisik.value, 10);
    if(isNaN(fisikVal) || fisikVal < 0) { return Swal.fire('Gagal', 'Masukkan nilai fisik yang valid!', 'warning'); }
    let selisih = fisikVal - stokSistem;
    Swal.fire({ title: 'Kirim Draft?', text: `Mengajukan opname untuk ${namaBarang}`, icon: 'info', showCancelButton: true }).then((r) => {
      if(r.isConfirmed) {
        fetch(API_URL, {
          method: 'POST',
          body: JSON.stringify({ aksi: 'opname', namaBarang: namaBarang, stokSistem: stokSistem, fisikVal: fisikVal, selisih: selisih })
        })
        .then(res => res.json())
        .then((res) => {
          if(res.status === "Sukses") { Swal.fire('Draft Terkirim', 'Draft berhasil diajukan ke Owner!', 'success'); inputFisik.value = ''; if(isOwnerAuthenticated) loadDraftOpnameServerSide(); }
        });
      }
    });
  }

  function loadMenuDariSheets() {
    fetch(`${API_URL}?aksi=ambilMenu`)
      .then(res => res.json())
      .then(dataMenu => { 
        if (dataMenu && dataMenu.length > 0) {
          menu = dataMenu; 
          localStorage.setItem('pos_menu_backup', JSON.stringify(dataMenu));
          renderCategory1Buttons(); 
          filterCategory1('Semua'); 
        } else {
          loadMenuOfflineFallback();
        }
      }).catch(err => {
        loadMenuOfflineFallback();
      });
  }

  function loadMenuOfflineFallback() {
    const localBackup = localStorage.getItem('pos_menu_backup');
    if (localBackup) {
      menu = JSON.parse(localBackup);
      Swal.fire({
        icon: 'info',
        title: 'POS Berjalan Offline',
        text: 'Menggunakan database cadangan lokal. Anda tetap bisa bertransaksi, data otomatis sync saat internet aktif.',
        timer: 3500,
        showConfirmButton: false
      });
      renderCategory1Buttons(); 
      filterCategory1('Semua'); 
    } else {
      Swal.fire({ icon: 'warning', title: 'Koneksi Offline', text: 'Aplikasi belum pernah memuat data menu saat online.' });
    }
  }

  function renderCategory1Buttons() {
    const btnArea = document.getElementById('cat1ButtonArea');
    if (!btnArea) return;
    const kategori1Unik = ['Semua', ...new Set(menu.map(item => item.cat1).filter(Boolean))];
    btnArea.innerHTML = '';
    kategori1Unik.forEach(cat1 => {
      let activeClass = (cat1 === currentCategory1) ? 'active' : '';
      btnArea.innerHTML += `<button class="cat-pill-btn ${activeClass} me-1" onclick="filterCategory1('${cat1}')">${cat1}</button>`;
    });
  }

  function filterCategory1(cat1) {
    currentCategory1 = cat1; currentCategory2 = 'Semua';
    document.querySelectorAll('#cat1ButtonArea .cat-pill-btn').forEach(btn => {
      btn.classList.remove('active');
      if(btn.innerText.toLowerCase() === cat1.toLowerCase()) btn.classList.add('active');
    });
    const subCats = [...new Set(menu.filter(item => item.cat1 && item.cat1.toLowerCase() === cat1.toLowerCase() && item.cat2 && item.cat2.trim() !== "").map(item => item.cat2))];
    const subBar = document.getElementById('category2Bar');
    if (cat1 !== 'Semua' && subCats.length > 0) {
      subBar.style.setProperty('display', 'flex', 'important');
      subBar.innerHTML = `<button class="sub-cat-btn active me-1" onclick="filterCategory2('Semua')">Semua Sub</button>`;
      subCats.forEach(cat2 => { subBar.innerHTML += `<button class="sub-cat-btn me-1" onclick="filterCategory2('${cat2}')">${cat2}</button>`; });
    } else { subBar.style.setProperty('display', 'none', 'important'); subBar.innerHTML = ''; }
    renderMenu();
  }

  function filterCategory2(cat2) { 
    currentCategory2 = cat2; renderMenu(); 
    document.querySelectorAll('#category2Bar .sub-cat-btn').forEach(b => { 
      b.classList.remove('active'); 
      if (b.innerText === cat2 || (cat2 === 'Semua' && b.innerText.includes('Semua Sub'))) b.classList.add('active'); 
    }); 
  }

  function renderMenu() {
    const grid = document.getElementById('menuGrid'); 
    if (!grid) return;
    grid.innerHTML = '';
    
    const query = document.getElementById('menuSearchInput')?.value.toLowerCase() || '';
    let filtered = menu || [];
    
    if (currentCategory1 !== 'Semua') {
      filtered = filtered.filter(x => x.cat1 && x.cat1.toString().toLowerCase() === currentCategory1.toLowerCase());
    }
    if (currentCategory2 !== 'Semua') {
      filtered = filtered.filter(x => x.cat2 && x.cat2.toString().toLowerCase() === currentCategory2.toLowerCase());
    }
    if (query) {
      filtered = filtered.filter(x => x.item && x.item.toString().toLowerCase().includes(query));
    }
    
    const favorites = JSON.parse(localStorage.getItem('pos_favorites') || '[]');
    filtered.sort((a, b) => (favorites.includes(b.item) ? 1 : 0) - (favorites.includes(a.item) ? 1 : 0));
    
    if (filtered.length === 0) {
      grid.innerHTML = '<div class="col-12 text-center text-muted py-4">Tidak ada menu yang cocok.</div>';
      return;
    }
    
    filtered.forEach((x) => {
      const globalIndex = menu.findIndex(m => m.item === x.item);
      const isFav = favorites.includes(x.item);
      
      let iconAksiClass = isOwnerAuthenticated ? "fa-camera text-primary" : ("fa-star " + (isFav ? 'active' : ''));
      let judulAksi = isOwnerAuthenticated ? "Upload Gambar Produk" : "Favoritkan";
      
      let iconClass = "fa-utensils";
      const catLower = x.cat1 ? x.cat1.toString().toLowerCase() : '';
      if(catLower.includes('ayam') || catLower.includes('geprek')) iconClass = "fa-drumstick-bite";
      else if(catLower.includes('minum') || catLower.includes('teh') || catLower.includes('es')) iconClass = "fa-glass-water";
      else if(catLower.includes('kopi')) iconClass = "fa-mug-hot";
      else if(catLower.includes('mama') || catLower.includes('mamah')) iconClass = "fa-bowl-food";
      
      let mediaHtml = `<div class="menu-icon-fallback" id="fallbackFallback-${globalIndex}"><i class="fas ${iconClass}"></i></div>`;
      if (x.imageUrl && x.imageUrl.toString().trim() !== "" && x.imageUrl.toString().startsWith('http')) {
        mediaHtml = `<img src="${x.imageUrl.toString().trim()}" alt="${x.item}" referrerpolicy="no-referrer" id="menuImgDOM-${globalIndex}" style="display:none;" onload="document.getElementById('menuImgDOM-${globalIndex}').style.display='block'; document.getElementById('fallbackFallback-${globalIndex}').style.display='none';" onerror="document.getElementById('menuImgDOM-${globalIndex}').style.display='none'; document.getElementById('fallbackFallback-${globalIndex}').style.display='flex';">
                     <div class="menu-icon-fallback" id="fallbackFallback-${globalIndex}"><i class="fas ${iconClass}"></i></div>`;
      }
      grid.innerHTML += `<div class="col-6 col-sm-4 col-md-3"><div class="card menu-card h-100"><span class="fav-star" title="${judulAksi}" onclick="toggleFavorite('${x.item}', event)"><i class="fas ${iconAksiClass}"></i></span><div class="menu-img-container" onclick="addToCart(${globalIndex})">${mediaHtml}</div><div class="card-body p-2 text-center d-flex flex-column justify-content-between" onclick="addToCart(${globalIndex})"><div><h6>${x.item}</h6></div><p class="price-tag mb-0">Rp ${(Number(x.harga) || 0).toLocaleString('id-ID')}</p></div></div></div>`;
    });
  }

  function toggleFavorite(itemName, event) { 
    if (event) event.stopPropagation(); 
    if (isOwnerAuthenticated) {
      const inputUploader = document.getElementById('hiddenGlobalFileUploader');
      inputUploader.value = ""; 
      const newUploader = inputUploader.cloneNode(true);
      inputUploader.parentNode.replaceChild(newUploader, inputUploader);
      
      newUploader.addEventListener('change', function(e) {
        if (this.files && this.files[0]) {
          const file = this.files[0];
          const reader = new FileReader();
          Swal.fire({ title: 'Memproses Gambar...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
          
          reader.onload = function(evt) {
            const base64Data = evt.target.result;
            fetch(API_URL, {
              method: 'POST',
              body: JSON.stringify({ aksi: 'uploadGambar', base64: base64Data, fileName: file.name, itemName: itemName })
            })
            .then(res => res.json())
            .then((res) => {
              Swal.close();
              if (res.status === "Sukses") {
                Swal.fire('Berhasil!', 'Gambar menu baru disimpan ke Drive!', 'success');
                loadMenuDariSheets();
              } else {
                Swal.fire('Gagal Upload', res.error, 'error');
              }
            }).catch(() => { Swal.close(); Swal.fire('Error', 'Gagal terhubung ke internet API.', 'error'); });
          };
          reader.readAsDataURL(file);
        }
      });
      newUploader.click();
    } else {
      let favorites = JSON.parse(localStorage.getItem('pos_favorites') || '[]'); 
      favorites = favorites.includes(itemName) ? favorites.filter(f => f !== itemName) : [...favorites, itemName]; 
      localStorage.setItem('pos_favorites', JSON.stringify(favorites)); 
      renderMenu(); 
    }
  }

  // Dashboard Owner sekarang halaman TERPISAH, diserve langsung oleh Apps
  // Script (doGet?page=dashboard) -- BUKAN tab lokal di index.html. Dibuka
  // di jendela/tab baru supaya tablet kasir tidak pernah ikut memuat
  // markup/JS dashboard sama sekali.
  function bukaDashboardOwner() {
    if (!isOwnerAuthenticated) return;
    window.open(API_URL + '?page=dashboard', '_blank');
  }

  function addToCart(idx) {
    const produk = menu[idx];
    const ada = cart.find(x => x.item === produk.item);
    if(ada) { ada.qty += 1; } else { cart.push({ ...produk, qty: 1 }); }
    updateUI();
  }

  function hapusItemKeranjang(idx) { cart.splice(idx, 1); updateUI(); }

  function updateUI() { 
    const cartDiv = document.getElementById('cartItems'); cartDiv.innerHTML = ''; totalBelanjaGlobal = 0; 
    cart.forEach((c, i) => { totalBelanjaGlobal += (c.harga * c.qty); 
      cartDiv.innerHTML += `<div class="card p-2 mb-1 border-0 bg-light extra-small"><div class="cart-item-title text-uppercase">${c.item}</div><div class="cart-item-row"><span class="text-muted text-nowrap">@${c.harga.toLocaleString('id-ID')}</span><div class="qty-stepper"><button type="button" class="qty-step-btn" onclick="ubahQtyTombol(${i}, -1)">−</button><input type="number" class="form-control form-control-sm qty-control" value="${c.qty}" onchange="ubahQtyManual(${i}, this.value)"><button type="button" class="qty-step-btn" onclick="ubahQtyTombol(${i}, 1)">+</button></div><button class="btn btn-sm text-danger p-0 px-1 fw-bold cart-delete-btn ms-auto" onclick="hapusItemKeranjang(${i})">×</button></div></div>`;
    }); 
    const diskonInputVal = parseInt(document.getElementById('diskonNotaInput').value, 10) || 0;
    let nominalPotongan = (diskonTipe === 'Rp') ? diskonInputVal : Math.round(totalBelanjaGlobal * (diskonInputVal / 100));
    const totalAkhirSetelahDiskon = Math.max(0, totalBelanjaGlobal - nominalPotongan);
    document.getElementById('totalHarga').innerText = 'Rp ' + totalAkhirSetelahDiskon.toLocaleString('id-ID');
    if (bypassModeActive && document.getElementById('metodeBayar').value === 'Cash') { document.getElementById('uangBayar').value = totalAkhirSetelahDiskon; }
    hitungKembalian(); 
  }

  function prosesCheckout() { 
  if(cart.length === 0) { Swal.fire({ icon: 'warning', title: 'Keranjang Kosong' }); return; } 
  const metode = document.getElementById('metodeBayar').value; 
  const diskonInputVal = parseInt(document.getElementById('diskonNotaInput').value, 10) || 0;
  let nominalPotongan = (diskonTipe === 'Rp') ? diskonInputVal : Math.round(totalBelanjaGlobal * (diskonInputVal / 100));
  const totalAkhirSetelahDiskon = Math.max(0, totalBelanjaGlobal - nominalPotongan);
  
  if (metode === 'Cash' && !bypassModeActive) { 
    const uangBayar = parseInt(document.getElementById('uangBayar').value, 10) || 0; 
    if (uangBayar < totalAkhirSetelahDiskon) { Swal.fire({ icon: 'error', title: 'Uang Kurang' }); return; } 
  } 
  const btnPay = document.querySelector('.btn-pay'); if(btnPay) btnPay.disabled = true; 
  
  // FIX PERBAIKAN: Format tanggal ISO bersih tanpa koma agar tidak merusak parser JSON Google Sheets
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, '0');
  const tanggal = String(sekarang.getDate()).padStart(2, '0');
  const jam = String(sekarang.getHours()).padStart(2, '0');
  const menit = String(sekarang.getMinutes()).padStart(2, '0');
  const detik = String(sekarang.getSeconds()).padStart(2, '0');
  
  const notaIdGroup = `${tanggal}/${bulan}/${tahun} ${jam}:${menit}:${detik}`; 
  const jamNow = `${jam}:${menit}`;
  
  // ID unik untuk SATU NOTA.
// Semua item dalam checkout ini memakai ID yang sama.
const clientTxnId = crypto.randomUUID
  ? crypto.randomUUID()
  : (Date.now() + "-" + Math.random().toString(36).substr(2,8));


  const transaksiBaru = [];
  const wadahDipilih = document.getElementById('wadahTipeInput').value;
  
  cart.forEach(c => { 
    let isMamaProduct = c.cat1 && c.cat1.toLowerCase().includes('mama') || c.cat1 && c.cat1.toLowerCase().includes('mamah');
    transaksiBaru.push({ 
      clientTxnId: clientTxnId,
      tgl: notaIdGroup, // Menggunakan format bersih dd/mm/yyyy hh:mm:ss
      item: c.item, 
      qty: Number(c.qty) || 1, 
      pembayaran: metode, 
      isMama: isMamaProduct, 
      diskonNilai: diskonInputVal, 
      diskonTipe: diskonTipe, 
      wadah: wadahDipilih 
    }); 
    
    simpanKeHistoryLokal('penjualan', {
      namaItem: c.item,
      qty: Number(c.qty) || 1,
      subtotal: (Number(c.harga) * Number(c.qty)),
      metode: metode,
      isMamaProduct: isMamaProduct,
      jam: jamNow,
      status: "OK",
      notaIdGroup: notaIdGroup,
      clientTxnId: clientTxnId
    });
  }); 
  
  const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]'); 
  localStorage.setItem('sync_queue', JSON.stringify(queue.concat(transaksiBaru))); 
  
  Swal.fire({ icon: 'success', title: 'Sukses!', timer: 1000, showConfirmButton: false }); 
  cart = []; document.getElementById('uangBayar').value = ''; document.getElementById('diskonNotaInput').value = '';
  document.getElementById('bypassModeToggle').checked = false; bypassModeActive = false;
  updateUI(); if(btnPay) btnPay.disabled = false; try{ renderWalletKasToko(); }catch(e){} attemptSync(); 
}

  function requestArsipTahun() {
    Swal.fire({
      title: 'Arsipkan Transaksi Tahun Ini?',
      html: 'Tab <b>Transaksi</b> & <b>Transaksi Mamah</b> akan di-<i>rename</i> jadi arsip, lalu tab baru kosong dibuat untuk tahun berjalan. Proses ini <b>tidak bisa dibatalkan</b>. Masukkan PIN Owner untuk lanjut:',
      input: 'password',
      inputPlaceholder: 'PIN Owner',
      showCancelButton: true,
      confirmButtonText: 'Ya, Arsipkan',
      confirmButtonColor: '#e74c3c'
    }).then((result) => {
      if (!result.isConfirmed) return;
      Swal.fire({ title: 'Memproses Arsip...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
      fetch(API_URL, { method: 'POST', body: JSON.stringify({ aksi: 'arsipTahun', pin: result.value }) })
        .then(res => res.json())
        .then((respon) => {
          Swal.close();
          const hasil = (respon && respon.hasil) ? respon.hasil.toString() : 'Gagal terhubung ke server.';
          const gagal = hasil.indexOf('Error') === 0 || hasil.indexOf('Gagal') === 0;
          Swal.fire({ title: gagal ? 'Gagal' : 'Selesai', html: hasil, icon: gagal ? 'error' : 'success' });
        })
        .catch(() => { Swal.close(); Swal.fire('Gagal', 'Tidak bisa terhubung ke server. Cek koneksi internet.', 'error'); });
    });
  }

  // Cari clientTxnId dari penjualan lokal terakhir yang statusnya masih OK.
  // clientTxnId dipakai sebagai KUNCI STABIL untuk antrian void -- BUKAN
  // notaIdGroup, karena notaIdGroup itu timestamp buatan KLIEN yang TIDAK
  // PERNAH sama dengan nilai yang benar-benar ditulis server ke kolom A
  // sheet Transaksi (server menulis timestamp-nya SENDIRI, tglWib, lihat
  // simpanData() di code.gs). Identifier server yang valid (notaIdServer)
  // baru terisi setelah penjualan ini benar-benar sukses sync -- lihat
  // attemptSync() bagian qKasir.
  function getLastLocalClientTxnIdOk() {
    const history = JSON.parse(localStorage.getItem('rekap_hari_ini') || '[]');
    for (let k = history.length - 1; k >= 0; k--) {
      if (history[k].tipe === 'penjualan' && history[k].status === 'OK') return history[k].clientTxnId || "";
    }
    return "";
  }

  function tandaiNotaVoidLokal(clientTxnId) {
    let history = JSON.parse(localStorage.getItem('rekap_hari_ini') || '[]');
    history.forEach(h => { if (h.clientTxnId === clientTxnId) h.status = 'VOID'; });
    localStorage.setItem('rekap_hari_ini', JSON.stringify(history));
  }

  function requestVoid() {
    const targetClientTxnId = getLastLocalClientTxnIdOk();
    if (!targetClientTxnId) { Swal.fire('Tidak Ada Transaksi', 'Belum ada transaksi di riwayat sesi ini yang bisa di-void.', 'info'); return; }

    const queueVoidCek = JSON.parse(localStorage.getItem('sync_queue_void') || '[]');
    if (queueVoidCek.some(v => v.clientTxnId === targetClientTxnId)) {
      Swal.fire('Menunggu Sinkronisasi', 'Struk ini sudah diantrekan untuk di-void, menunggu koneksi internet.', 'info');
      return;
    }

    Swal.fire({ title: 'Otorisasi Void', text: 'Masukkan PIN Void untuk pembatalan:', input: 'password', showCancelButton: true }).then((result) => {
      if (!result.isConfirmed) return;
      // PIN Void ini SENGAJA beda dari PIN Owner (lihat toggleOwnerAuth) --
      // supaya kasir biasa bisa void struk keliru tanpa perlu tahu PIN Owner
      // yang membuka akses admin lebih luas (dashboard, upload gambar, dll).
      // Dicek di sisi klien dulu supaya kasir tetap dapat kepastian instan
      // walau offline. Server tetap validasi ulang PIN saat request ini
      // akhirnya tersambung (lihat batalkanTransaksiTerakhir di code.gs).
      if (result.value !== "1234") { Swal.fire('Gagal', 'PIN Salah!', 'error'); return; }

      // Tandai lokal SEKARANG (optimistic) supaya Riwayat & Rekap langsung
      // konsisten dengan niat kasir, tidak menunggu jawaban server.
      tandaiNotaVoidLokal(targetClientTxnId);
      refreshHistoryLogUI();

      const queueVoid = JSON.parse(localStorage.getItem('sync_queue_void') || '[]');
      queueVoid.push({ clientTxnId: targetClientTxnId, pin: result.value });
      localStorage.setItem('sync_queue_void', JSON.stringify(queueVoid));

      if (navigator.onLine) {
        Swal.fire({ icon: 'success', title: 'Void Diproses', text: 'Struk ditandai batal & sedang dikirim ke server.', timer: 1800, showConfirmButton: false });
      } else {
        Swal.fire({ icon: 'info', title: 'Tersimpan (Offline)', text: 'Struk ditandai batal secara lokal. Akan otomatis dikirim ke server saat koneksi kembali.', timer: 2500, showConfirmButton: false });
      }
      attemptSync();
    });
  }

  function loadStokBarang() { 
    const tbody = document.getElementById('stokBarangTableBody'); 
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted"><i class="fas fa-spinner fa-spin"></i> Memuat data...</td></tr>'; 
    fetch(`${API_URL}?aksi=ambilStokBarang`)
      .then(res => res.json())
      .then((data) => { dataOpnameLokalRaw = data; filterTabelOpname(); }); 
  }
  
  function filterTabelOpname() { 
    const tbody = document.getElementById('stokBarangTableBody'); 
    const keyword = document.getElementById('opnameSearchInput').value.toLowerCase(); 
    tbody.innerHTML = ''; 
    const filteredData = dataOpnameLokalRaw.filter(b => b.nama.toLowerCase().includes(keyword)); 
    if (filteredData.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Barang tidak ditemukan.</td></tr>'; return; } 
    filteredData.forEach((b) => { 
      let cleanId = b.nama.replace(/[^a-zA-Z0-9]/g, ''); 
      let sysStokCellHtml = isOwnerAuthenticated ? `<td class="text-center fw-bold text-primary fs-6 border-start border-end" id="stokSysVal-${cleanId}">${b.stok}</td>` : ``; 
      tbody.innerHTML += `<tr class="border-bottom"><td class="fw-bold text-dark py-2">${b.nama}</td>${sysStokCellHtml}<td><div class="input-group input-group-sm"><input type="number" id="inputFisikBarang-${cleanId}" class="form-control text-center font-weight-bold" placeholder="Fisik"><button class="btn btn-warning fw-bold" onclick="eksekusiOpnameButa('${b.nama}', ${b.stok})">KIRIM</button></div></td></tr>`; 
    }); 
  }

  function simpanKeHistoryLokal(tipe, obj) {
    let history = JSON.parse(localStorage.getItem('rekap_hari_ini') || '[]');
    let tglIso = getLocalIsoDate();
    history.push({ tipe: tipe, tglIso: tglIso, ...obj });
    localStorage.setItem('rekap_hari_ini', JSON.stringify(history));
  }

  backgroundSync = attemptSync;
  function rekapCheckWasteReminder() {
    if(!dataGlobalRekapKirim.tanggal) return Swal.fire('Gagal', 'Laporan kosong!', 'error');
    Swal.fire({ title: 'Perhatian!', text: 'Sudah catat Waste Dapur?', icon: 'warning', showCancelButton: true }).then((r) => {
      if (r.isConfirmed) { kirimRekapKeGSheet(); }
    });
  }

  function ubahQtyManual(index, targetQty) { const qtyInput = parseInt(targetQty, 10); if (qtyInput <= 0 || isNaN(qtyInput)) { hapusItemKeranjang(index); } else { cart[index].qty = qtyInput; updateUI(); } }
  function ubahQtyTombol(index, delta) { const qtyBaru = (Number(cart[index]?.qty) || 0) + delta; ubahQtyManual(index, qtyBaru); }
  function toggleBypassMode() { const toggle = document.getElementById('bypassModeToggle'); bypassModeActive = toggle.checked; const uangBayarInput = document.getElementById('uangBayar'); if (bypassModeActive && document.getElementById('metodeBayar').value === 'Cash') { const diskonInputVal = parseInt(document.getElementById('diskonNotaInput').value, 10) || 0; let nominalPotongan = (diskonTipe === 'Rp') ? diskonInputVal : Math.round(totalBelanjaGlobal * (diskonInputVal / 100)); const totalAkhirSetelahDiskon = Math.max(0, totalBelanjaGlobal - nominalPotongan); uangBayarInput.value = totalAkhirSetelahDiskon; } else if (!bypassModeActive) { uangBayarInput.value = ''; } hitungKembalian(); }
  function handleMetodeBayarChange() { const metode = document.getElementById('metodeBayar').value; if (bypassModeActive && metode === 'Cash') { const diskonInputVal = parseInt(document.getElementById('diskonNotaInput').value, 10) || 0; let nominalPotongan = (diskonTipe === 'Rp') ? diskonInputVal : Math.round(totalBelanjaGlobal * (diskonInputVal / 100)); const totalAkhirSetelahDiskon = Math.max(0, totalBelanjaGlobal - nominalPotongan); document.getElementById('uangBayar').value = totalAkhirSetelahDiskon; } hitungKembalian(); }
  function pilihJenisKas(jenis) {
    document.getElementById('jenisKas').value = jenis;
    document.querySelectorAll('.kas-chip-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.jenis === jenis);
    });
    toggleCustomInputLabel();
  }
  function pilihMetodeKas(metode){
    var sel = document.getElementById('metodeKas');
    if(sel) sel.value = metode;
    document.querySelectorAll('[data-metodekas]').forEach(function(btn){
      btn.classList.toggle('active', btn.getAttribute('data-metodekas')===metode);
    });
  }
  function toggleCustomInputLabel() { const jenis = document.getElementById('jenisKas').value; const label = document.getElementById('labelNamaItem'); const input = document.getElementById('namaItemKas'); if (jenis === 'Tarik Tunai') { label.innerText = "Tujuan Tarik Tunai"; input.placeholder = "Customer / QRIS Rp500rb"; } else if (jenis === 'Setoran Owner') { label.innerText = "Setoran ke Owner"; input.placeholder = "Owner / Setoran #001"; } else if (jenis === 'Operasional') { label.innerText = "Keperluan Operasional"; input.placeholder = "Listrik / Plastik"; } else { label.innerText = "Nama Barang"; input.placeholder = "Gas / Beras / Ayam"; } // sinkronkan chip active jika dipanggil via select
    document.querySelectorAll('.kas-chip-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.jenis === jenis));
    var wrap = document.getElementById('metodeKasWrap');
    if(wrap){
      var isBelanja = (jenis==='Belanja Operasional' || jenis==='Operasional');
      wrap.style.display = isBelanja ? 'block' : 'none';
      if(!isBelanja) pilihMetodeKas('Cash Toko');
    }
  }

  function refreshHistoryLogUI() {
    const container = document.getElementById('kasirHistoryLogContainer');
    if(!container) return;
    const tglPilihan = document.getElementById('historyDatePicker')?.value || getLocalIsoDate();
    const historySemua = JSON.parse(localStorage.getItem('rekap_hari_ini') || '[]');
    // Filter ke tanggal yang dipilih saja (tglIso sudah disimpan per-entry
    // oleh simpanKeHistoryLokal) -- supaya riwayat kemarin tidak campur
    // dengan hari ini, dan bisa lihat riwayat tanggal lain lewat picker.
    let history = historySemua.filter(x => (x.tglIso || getLocalIsoDate()) === tglPilihan);
    if(history.length === 0) { container.innerHTML = '<div class="text-center text-muted py-3">Belum ada transaksi di tanggal ini.</div>'; return; }

    // Kelompokkan entri 'penjualan' per struk memakai notaIdGroup (semua
    // item dari satu checkout SELALU berurutan di array ini karena
    // ditulis dalam satu forEach saat prosesCheckout(), jadi cukup deteksi
    // pergantian notaIdGroup -- tidak perlu pengelompokan global). Entri
    // 'kas' tetap baris tersendiri, bukan bagian dari struk manapun.
    let blocks = [];
    history.forEach((x) => {
      if (x.tipe === 'penjualan') {
        let blokTerakhir = blocks[blocks.length - 1];
        if (blokTerakhir && blokTerakhir.tipe === 'struk' && blokTerakhir.notaIdGroup === x.notaIdGroup) {
          blokTerakhir.items.push(x);
        } else {
          blocks.push({ tipe: 'struk', notaIdGroup: x.notaIdGroup, jam: x.jam, metode: x.metode, status: x.status, items: [x] });
        }
      } else if (x.tipe === 'kas') {
        blocks.push({ tipe: 'kas', jenis: x.jenis, nominal: x.nominal });
      }
    });

    let html = '';
    blocks.slice().reverse().forEach((b) => {
      if (b.tipe === 'struk') {
        const isVoid = b.status === 'VOID';
        const textClass = isVoid ? 'text-decoration-line-through text-danger' : '';
        const totalStruk = b.items.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0);
        html += `<div class="history-struk-block">
          <div class="history-struk-header d-flex justify-content-between align-items-center ${textClass}">
            <span class="fw-bold"><i class="fas fa-receipt text-muted me-1"></i>[${b.jam}] ${b.metode}${isVoid ? ' <span class="badge bg-danger">VOID</span>' : ''}</span>
            <span class="fw-bold">Rp ${totalStruk.toLocaleString('id-ID')}</span>
          </div>`;
        b.items.forEach((it) => {
          html += `<div class="history-struk-item ${textClass}">${it.namaItem} x${it.qty} <span class="text-muted">- Rp ${(it.subtotal || 0).toLocaleString('id-ID')}</span></div>`;
        });
        html += `</div>`;
      } else if (b.tipe === 'kas') {
        let warna = 'text-warning';
        if (b.jenis === 'Setoran Owner') warna = 'text-primary';
        else if (b.jenis === 'Tarik Tunai') warna = 'text-info';
        else if (b.jenis === 'Belanja Operasional' || b.jenis === 'Operasional') warna = 'text-danger';
        html += `<div class="history-log-row ${warna}"><b>[KAS ${b.jenis.toUpperCase()}]</b> ${b.jenis}: Rp ${(b.nominal || 0).toLocaleString('id-ID')}</div>`;
      }
    });

    container.innerHTML = html;
  }

  // Helpers untuk Cash Awal Hari per tanggal (backward-compatible localStorage)
  function keyCashAwal(tglIso) { return 'cash_awal_hari_' + tglIso; }
  function keyModalLaci(tglIso) { return 'modal_laci_' + tglIso; }
  function keyCashReal(tglIso) { return 'cash_real_' + tglIso; }
  function keyKetSelisih(tglIso) { return 'ket_selisih_' + tglIso; }
  function getCashAwalHari(tglIso) { const v = localStorage.getItem(keyCashAwal(tglIso)); return (v === null || v === '') ? null : parseNominalKas(v); }
  function setCashAwalHari(tglIso, val) { if(val===null || val==='' || isNaN(val)) localStorage.removeItem(keyCashAwal(tglIso)); else localStorage.setItem(keyCashAwal(tglIso), String(val)); }
  function getModalLaci(tglIso) { return parseNominalKas(localStorage.getItem(keyModalLaci(tglIso)) || document.getElementById('modalAwalInput')?.value || '0'); }
  function setModalLaci(tglIso, val) { localStorage.setItem(keyModalLaci(tglIso), String(val)); }
  function getCashRealVal(tglIso) { const v = localStorage.getItem(keyCashReal(tglIso)); return v === null || v === '' ? null : parseNominalKas(v); }
  function setCashRealVal(tglIso, val) { if(val===null || val==='') localStorage.removeItem(keyCashReal(tglIso)); else localStorage.setItem(keyCashReal(tglIso), String(val)); }
  // Blind Cash Count — STATE detection HANYA via snapshot, bukan cashReal
  function hasSubmittedRekap(tglIso) { return localStorage.getItem('rekap_snapshot_' + tglIso) !== null; }

  // ============================================================
  //  WALLET KAS TOKO — SOT server + optimistic pending only
  //  Saldo = SaldoAwal + CashAyam - Belanja - Tarik - Setoran + Adjustment
  //  cashAwalHari TIDAK masuk wallet, Mamah/QRIS tidak masuk wallet
  //  Optimistic hanya tambah queue pending yang BELUM tercermin di server
  // ============================================================
  const WALLET_CACHE_KEY = 'cache_wallet_server';
  const WALLET_CACHE_TIME_KEY = 'cache_wallet_server_time';
  const WALLET_PENDING_CONFIRM_KEY = 'cache_wallet_pending_confirm';
  function getWalletServerCache(){ try{ var r=localStorage.getItem(WALLET_CACHE_KEY); return r?JSON.parse(r):null; }catch(e){ return null; } }
  function setWalletServerCache(data){ try{ localStorage.setItem(WALLET_CACHE_KEY, JSON.stringify(data)); localStorage.setItem(WALLET_CACHE_TIME_KEY, new Date().toISOString()); }catch(e){} }
  function getWalletPendingConfirm(){ try{ var r=localStorage.getItem(WALLET_PENDING_CONFIRM_KEY); return r?JSON.parse(r):[]; }catch(e){ return []; } }
  function addWalletPendingConfirm(item){ try{ var a=getWalletPendingConfirm(); a.push(item); localStorage.setItem(WALLET_PENDING_CONFIRM_KEY, JSON.stringify(a)); }catch(e){} }
  function clearWalletPendingConfirm(){ try{ localStorage.removeItem(WALLET_PENDING_CONFIRM_KEY); }catch(e){} }
  function computeWalletPendingDelta(){
    var delta = 0;
    // --- Cash Ayam pending: sync_queue items yang masih di queue ---
    try{
      var qKasir = JSON.parse(localStorage.getItem('sync_queue')||'[]');
      if(qKasir.length>0){
        var pendingIds = {};
        qKasir.forEach(function(r){ if(r && r.clientTxnId) pendingIds[r.clientTxnId]=true; });
        // history per-item subtotal, but need nett per nota (diskon)
        var history = JSON.parse(localStorage.getItem('rekap_hari_ini')||'[]');
        // group pending history by clientTxnId to apply diskon per nota
        var notaMap = {};
        history.forEach(function(h){
          if(h.tipe!=='penjualan' || h.status==='VOID' || !h.clientTxnId || !pendingIds[h.clientTxnId]) return;
          if(h.isMamaProduct) return;
          if((h.metode||'').toString().toLowerCase()!=='cash') return;
          if(!notaMap[h.clientTxnId]) notaMap[h.clientTxnId] = { raw:0, diskonNilai: Number(h.diskonNilai)||0, diskonTipe: h.diskonTipe||'Rp' };
          // use subtotal if available, else qty*harga approx; history has subtotal
          notaMap[h.clientTxnId].raw += Number(h.subtotal)||0;
          // keep latest diskon (all items same nota share same diskon)
          if(h.diskonNilai!==undefined) { notaMap[h.clientTxnId].diskonNilai = Number(h.diskonNilai)||0; notaMap[h.clientTxnId].diskonTipe = h.diskonTipe||'Rp'; }
        });
        Object.keys(notaMap).forEach(function(id){
          var n = notaMap[id];
          var pot = (n.diskonTipe==='%' ? Math.round(n.raw * (n.diskonNilai/100)) : n.diskonNilai);
          delta += Math.max(0, n.raw - pot);
        });
      }
    }catch(e){}
    // --- Void pending: if a cash nota di-void, kurangi wallet (revert sale) ---
    try{
      var qVoid = JSON.parse(localStorage.getItem('sync_queue_void')||'[]');
      if(qVoid.length>0){
        var history2 = JSON.parse(localStorage.getItem('rekap_hari_ini')||'[]');
        // history already marked VOID locally, but server saldo still includes sale
        // so pending void should -cashAmount
        qVoid.forEach(function(v){
          if(!v.clientTxnId) return;
          var notaRaw = 0, diskonNilai=0, diskonTipe='Rp', has=false;
          history2.forEach(function(h){
            if(h.clientTxnId===v.clientTxnId && h.tipe==='penjualan' && !h.isMamaProduct && (h.metode||'').toLowerCase()==='cash'){
              // even if status VOID locally, we need original amount to subtract
              // history entry still has subtotal even if status VOID, so count
              notaRaw += Number(h.subtotal)||0;
              diskonNilai = Number(h.diskonNilai)||diskonNilai;
              diskonTipe = h.diskonTipe||diskonTipe;
              has=true;
            }
          });
          if(has){
            var pot2 = (diskonTipe==='%' ? Math.round(notaRaw * (diskonNilai/100)) : diskonNilai);
            var nett = Math.max(0, notaRaw - pot2);
            delta -= nett;
          }
        });
      }
    }catch(e){}
    // --- Pengeluaran pending (Belanja/Tarik/Setor/SaldoAwal/Adjustment) --- F = Metode
    try{
      var qBelanja = JSON.parse(localStorage.getItem('sync_queue_belanja')||'[]');
      qBelanja.forEach(function(row){
        var jenis = row.jenisKas || row.jenis || '';
        var nominal = Number(row.nominal)||0;
        var metode = (row.metodeKas || row.metode || '').toString().trim();
        var isCash = (metode==='' || metode==='Cash Toko');
        if(jenis==='Saldo Awal Wallet') delta += nominal;
        else if(jenis==='Adjustment Wallet') delta += nominal; // bisa negatif
        else if(jenis==='Belanja Operasional' || jenis==='Operasional'){ if(isCash) delta -= nominal; }
        else if(jenis==='Tarik Tunai') delta -= nominal;
        else if(jenis==='Setoran Owner') delta -= nominal;
      });
      // Pending confirm: sudah Sukses di server (queue di-shift) tapi cache belum refresh
      var pendingConfirm = getWalletPendingConfirm();
      pendingConfirm.forEach(function(row){
        var jenis = row.jenisKas || row.jenis || '';
        var nominal = Number(row.nominal)||0;
        var metode = (row.metodeKas || row.metode || '').toString().trim();
        var isCash = (metode==='' || metode==='Cash Toko');
        if(jenis==='Saldo Awal Wallet') delta += nominal;
        else if(jenis==='Adjustment Wallet') delta += nominal;
        else if(jenis==='Belanja Operasional' || jenis==='Operasional'){ if(isCash) delta -= nominal; }
        else if(jenis==='Tarik Tunai') delta -= nominal;
        else if(jenis==='Setoran Owner') delta -= nominal;
        // Cash Ayam via sync_queue already handled above, void via qVoid
      });
    }catch(e){}
    return delta;
  }
  function getWalletOptimisticSaldo(){
    var server = getWalletServerCache();
    var base = server && typeof server.saldo==='number' ? server.saldo : 0;
    var delta = computeWalletPendingDelta();
    return { base: base, delta: delta, optimistic: base + delta, server: server };
  }
  function renderWalletKasToko(){
    var wrap = document.getElementById('walletSaldoValue');
    var helper = document.getElementById('walletHelper');
    var statusEl = document.getElementById('walletStatusBadge');
    if(!wrap) return;
    var serverCache = getWalletServerCache();
    var hasServer = !!serverCache;
    var opt = getWalletOptimisticSaldo();
    var saldoTampil = opt.optimistic;
    if(!hasServer && opt.delta===0){
      wrap.innerText = 'Memuat...';
    } else {
      wrap.innerText = 'Rp ' + Number(saldoTampil||0).toLocaleString('id-ID');
    }
    // Sudah Disetor & Bisa Disetor (Modal tetap untuk hitung bisa, tapi card pertama ganti ke Sudah Disetor)
    var modal = getModalLaci(getLocalIsoDate());
    var bisaDisetor = Math.max(0, saldoTampil - (Number(modal)||0));
    var elBisa = document.getElementById('walletBisaDisetor');
    if(elBisa) elBisa.innerText = 'Rp ' + Number(bisaDisetor||0).toLocaleString('id-ID');
    var elSudah = document.getElementById('walletModalKembalian');
    // el id tetap walletModalKembalian untuk compat, tapi label sudah "Sudah Disetor"
    var sudahDisetorVal = (hasServer && serverCache.breakdown) ? Number(serverCache.breakdown.setoranOwner||0) : 0;
    // jika filter periode aktif, akan di-override oleh renderWalletFiltered
    if(elSudah) {
      // simpan modal asli di dataset untuk kalkulasi bisaDisetor jika perlu
      elSudah.dataset.modal = String(modal);
      // default tampil Sudah Disetor global
      elSudah.innerText = 'Rp ' + Number(sudahDisetorVal||0).toLocaleString('id-ID');
    }
    // status badge
    if(statusEl){
      if(!hasServer && (JSON.parse(localStorage.getItem('sync_queue')||'[]').length>0 || JSON.parse(localStorage.getItem('sync_queue_belanja')||'[]').length>0)){
        statusEl.className='badge bg-warning text-dark extra-small';
        statusEl.innerHTML='<i class="fas fa-triangle-exclamation me-1"></i>Menunggu sync';
      } else if(!navigator.onLine && !hasServer){
        statusEl.className='badge bg-secondary extra-small';
        statusEl.innerHTML='<i class="fas fa-plug-circle-xmark me-1"></i>Offline';
      } else if(opt.delta!==0){
        statusEl.className='badge bg-warning text-dark extra-small';
        statusEl.innerHTML='<i class="fas fa-triangle-exclamation me-1"></i>Estimasi lokal';
      } else {
        statusEl.className='badge bg-success extra-small';
        statusEl.innerHTML='<i class="fas fa-check me-1"></i>Terkini';
      }
    }
    // helper
    if(helper){
      if(!hasServer && opt.delta===0) helper.innerText='Memuat saldo dari server...';
      else if(saldoTampil===0 && !hasServer) helper.innerText='Belum ada Saldo Awal. Owner perlu input Saldo Awal.';
      else helper.innerText='Uang toko yang masih dipegang dan belum disetor.';
    }
    // owner-only controls visibility
    var ownerWalletControls = document.getElementById('walletOwnerControls');
    if(ownerWalletControls) ownerWalletControls.style.display = isOwnerAuthenticated ? 'block' : 'none';
    var penyesuaianInfo = document.getElementById('walletPenyesuaianInfo');
    if(penyesuaianInfo) penyesuaianInfo.style.display = isOwnerAuthenticated ? 'block' : 'none';
    // also refresh rekap bisa disetor mirror if needed
  }
  function fetchWalletSaldo(){
    // jika filter periode aktif, jangan timpa dengan global — polling harus hormati filter
    var monthVal = document.getElementById('walletMonthPicker')?.value;
    if (monthVal) { var pm = monthVal.split('-'); return fetchWalletSaldoPeriode(parseInt(pm[1],10), parseInt(pm[0],10), null); }
    var statusEl = document.getElementById('walletStatusBadge');
    if(statusEl){ statusEl.className='badge bg-secondary extra-small'; statusEl.innerHTML='<i class="fas fa-spinner fa-spin me-1"></i>Memuat...'; }
    fetch(API_URL + '?aksi=ambilWalletSaldo')
      .then(function(res){ return res.json(); })
      .then(function(data){
        if(data && data.status==='ok'){
          setWalletServerCache(data);
          clearWalletPendingConfirm();
          renderWalletKasToko();
          // also refresh rekap hero bisa disetor after wallet sync
          try{ hitungRekapHarian(); }catch(e){}
        } else {
          throw new Error('res not ok');
        }
      })
      .catch(function(err){
        // offline: use cache + pending
        renderWalletKasToko();
      });
  }
  function onWalletPeriodeChange(){
    var monthVal = document.getElementById('walletMonthPicker')?.value; // YYYY-MM
    if (monthVal) {
      var pm = monthVal.split('-');
      fetchWalletSaldoPeriode(parseInt(pm[1],10), parseInt(pm[0],10), null);
    } else {
      fetchWalletSaldo();
    }
  }
  function clearWalletPeriodeFilter(){
    var m = document.getElementById('walletMonthPicker'); if(m) m.value='';
    fetchWalletSaldo();
  }
  function fetchWalletSaldoPeriode(bulan, tahun, tanggal){
    var statusEl = document.getElementById('walletStatusBadge');
    if(statusEl){ statusEl.className='badge bg-secondary extra-small'; statusEl.innerHTML='<i class="fas fa-spinner fa-spin me-1"></i>Memuat...'; }
    var url = API_URL + '?aksi=ambilWalletSaldoPeriode&bulan='+bulan+'&tahun='+tahun;
    if(tanggal) url += '&tanggal='+tanggal;
    fetch(url).then(function(res){ return res.json(); }).then(function(data){
      if(data && data.status==='ok'){
        // render filtered tanpa overwrite cache global
        renderWalletFiltered(data);
      } else throw new Error('res not ok');
    }).catch(function(err){
      if(statusEl){ statusEl.className='badge bg-danger extra-small'; statusEl.innerText='Gagal'; }
    });
  }
  function renderWalletFiltered(r){
    var wrap = document.getElementById('walletSaldoValue');
    if(!wrap) return;
    var fmt = function(v){ return 'Rp ' + Number(v||0).toLocaleString('id-ID'); };
    wrap.innerText = fmt(r.saldo);
    var elSudah = document.getElementById('walletModalKembalian');
    if(elSudah) elSudah.innerText = fmt(r.breakdown ? r.breakdown.setoranOwner : r.saldo);
    var elBisa = document.getElementById('walletBisaDisetor');
    if(elBisa) elBisa.innerText = fmt(r.bisaDisetor);
    var helper = document.getElementById('walletHelper');
    if(helper) helper.innerText = r.periodeLabel ? ('Periode: ' + r.periodeLabel) : 'Uang toko yang masih dipegang dan belum disetor.';
    var statusEl = document.getElementById('walletStatusBadge');
    if(statusEl){ statusEl.className='badge bg-info extra-small'; statusEl.innerText = r.periodeLabel || 'Filter'; }
    // rincian
    if(r.breakdown){
      var b=r.breakdown;
      var set = function(id,val){ var el=document.getElementById(id); if(el) el.innerText=fmt(val); };
      set('walletSaldoAwal', b.saldoAwal);
      // walletModalKembalian sudah di-set sebagai Sudah Disetor
      set('walletSetoran', b.setoranOwner);
      // keep other breakdown for filtered
      document.getElementById('walletCashAyam') && (document.getElementById('walletCashAyam').innerText = fmt(b.cashAyam));
      document.getElementById('walletBelanja') && (document.getElementById('walletBelanja').innerText = fmt(b.belanja));
      document.getElementById('walletTarik') && (document.getElementById('walletTarik').innerText = fmt(b.tarikTunai));
      document.getElementById('walletAdjust') && (document.getElementById('walletAdjust').innerText = fmt(b.adjustment));
    }
  }
  function requestSaldoAwalWallet(){
    if(!isOwnerAuthenticated) return Swal.fire('Akses Owner', 'Hanya owner boleh atur saldo awal.', 'warning');
    var cache = getWalletServerCache();
    if(cache && (cache.breakdown.saldoAwal||0)!==0){
      Swal.fire('Saldo Awal Sudah Ada', 'Saldo awal sudah Rp '+(cache.breakdown.saldoAwal||0).toLocaleString('id-ID')+'. Gunakan Adjustment untuk koreksi.', 'info');
      return;
    }
    Swal.fire({
      title: 'Saldo Awal Wallet',
      html: 'Masukkan total uang toko yang saat ini dipegang operasional (saldo awal).<br><small class="text-muted">Hanya boleh diisi sekali saat Wallet mulai digunakan.</small>',
      input: 'text',
      inputPlaceholder: 'Contoh: 2000000',
      showCancelButton: true,
      confirmButtonText: 'Simpan Saldo Awal',
      inputValidator: function(v){ if(!v || parseNominalKas(v)<=0) return 'Masukkan nominal >0'; }
    }).then(function(res){
      if(!res.isConfirmed) return;
      var nominal = parseNominalKas(res.value);
      var clientTxnId = crypto.randomUUID ? crypto.randomUUID() : (Date.now()+'-'+Math.random().toString(36).substr(2,8));
      // reuse Pengeluaran queue (Saldo Awal Wallet)
      simpanKeHistoryLokal('kas', { jenis: 'Saldo Awal Wallet', nominal: nominal, clientTxnId: clientTxnId });
      var q = JSON.parse(localStorage.getItem('sync_queue_belanja')||'[]');
      localStorage.setItem('sync_queue_belanja', JSON.stringify(q.concat([{ clientTxnId: clientTxnId, tgl: new Date().toLocaleString('id-ID'), jenisKas: 'Saldo Awal Wallet', namaItem: 'Saldo Awal Wallet', nominal: nominal, keterangan: 'Saldo awal ditentukan owner' }])));
      // optimistic render immediately
      renderWalletKasToko();
      hitungRekapHarian();
      refreshHistoryLogUI();
      attemptSync();
      fetchWalletSaldo();
      Swal.fire('Tersimpan', 'Saldo awal Rp '+nominal.toLocaleString('id-ID')+' akan sync ke server.', 'success');
    });
  }
  function requestAdjustmentWallet(){
    if(!isOwnerAuthenticated) return Swal.fire('Akses Owner', 'Hanya owner boleh adjustment.', 'warning');
    Swal.fire({
      title: 'Adjustment Wallet',
      html: '<div class="text-start extra-small mb-2">Nominal positif menambah saldo, negatif mengurangi.<br>Contoh: <code>100000</code> atau <code>-50000</code></div>',
      input: 'text',
      inputPlaceholder: '100000 atau -50000',
      inputValue: '',
      showCancelButton: true,
      confirmButtonText: 'Simpan Adjustment'
    }).then(function(res){
      if(!res.isConfirmed) return;
      var raw = (res.value||'').toString().replace(/[^0-9\-]/g,'');
      var nominal = parseInt(raw,10);
      if(isNaN(nominal) || nominal===0) return Swal.fire('Gagal','Nominal tidak valid','warning');
      Swal.fire({
        title: 'Alasan Adjustment',
        input: 'text',
        inputPlaceholder: 'Koreksi kas / selisih audit',
        showCancelButton: true
      }).then(function(res2){
        if(!res2.isConfirmed) return;
        var alasan = res2.value||'Adjustment owner';
        var before = getWalletOptimisticSaldo().optimistic;
        var clientTxnId = crypto.randomUUID ? crypto.randomUUID() : (Date.now()+'-'+Math.random().toString(36).substr(2,8));
        simpanKeHistoryLokal('kas', { jenis: 'Adjustment Wallet', nominal: nominal, clientTxnId: clientTxnId, keterangan: alasan });
        var q = JSON.parse(localStorage.getItem('sync_queue_belanja')||'[]');
        localStorage.setItem('sync_queue_belanja', JSON.stringify(q.concat([{ clientTxnId: clientTxnId, tgl: new Date().toLocaleString('id-ID'), jenisKas: 'Adjustment Wallet', namaItem: 'Adjustment Wallet', nominal: nominal, keterangan: alasan + ' (sebelum Rp'+before.toLocaleString('id-ID')+')' }])));
        renderWalletKasToko();
        hitungRekapHarian();
        refreshHistoryLogUI();
        attemptSync();
        fetchWalletSaldo();
        Swal.fire('Tersimpan', 'Adjustment Rp '+nominal.toLocaleString('id-ID')+' ('+alasan+') akan sync.', 'success');
      });
    });
  }
  function requestSetorWallet(){
    var opt = getWalletOptimisticSaldo();
    if(opt.optimistic<=0) return Swal.fire('Saldo Kosong','Tidak ada saldo untuk disetor.','info');
    Swal.fire({
      title: 'Setor ke Owner',
      html: 'Saldo saat ini <b>Rp '+opt.optimistic.toLocaleString('id-ID')+'</b><br><small class="text-muted">Masukkan nominal setor.</small>',
      input: 'text',
      inputPlaceholder: 'Contoh: 1000000',
      showCancelButton: true,
      didOpen: function(){ var inp=Swal.getInput(); if(inp) inp.addEventListener('input', function(){ formatNominalKas(inp); }); },
      inputValidator: function(v){ var n=parseNominalKas(v); if(n<=0) return 'Nominal >0'; if(n>opt.optimistic) return 'Melebihi saldo Rp '+opt.optimistic.toLocaleString('id-ID'); }
    }).then(function(res){
      if(!res.isConfirmed) return;
      var nominal = parseNominalKas(res.value);
      var clientTxnId = crypto.randomUUID ? crypto.randomUUID() : (Date.now()+'-'+Math.random().toString(36).substr(2,8));
      // reuse simpanKasOperasional path but via generic queue
      simpanKeHistoryLokal('kas', { jenis: 'Setoran Owner', nominal: nominal, clientTxnId: clientTxnId });
      var q = JSON.parse(localStorage.getItem('sync_queue_belanja')||'[]');
      localStorage.setItem('sync_queue_belanja', JSON.stringify(q.concat([{ clientTxnId: clientTxnId, tgl: new Date().toLocaleString('id-ID'), jenisKas: 'Setoran Owner', namaItem: 'Setoran Owner', nominal: nominal, keterangan: 'Setor wallet' }])));
      Swal.fire({ icon:'success', title:'Setoran Dicatat', text:'Rp '+nominal.toLocaleString('id-ID')+' akan sync.', timer:1500, showConfirmButton:false});
      renderWalletKasToko();
      hitungRekapHarian();
      refreshHistoryLogUI();
      attemptSync();
      fetchWalletSaldo();
    });
  }

  function onRekapTanggalGanti() {
    const tgl = document.getElementById('rekapDatePicker').value;
    // load per-tanggal values
    const ca = localStorage.getItem(keyCashAwal(tgl));
    const ml = localStorage.getItem(keyModalLaci(tgl));
    const cr = localStorage.getItem(keyCashReal(tgl));
    const ket = localStorage.getItem(keyKetSelisih(tgl));
    document.getElementById('cashAwalHariInput').value = (ca === null || ca === '') ? '' : Number(ca).toLocaleString('id-ID');
    if (ml !== null) document.getElementById('modalAwalInput').value = Number(ml).toLocaleString('id-ID');
    document.getElementById('cashRealInput').value = cr ? Number(cr).toLocaleString('id-ID') : '';
    document.getElementById('keteranganSelisihInput').value = ket || '';
    hitungRekapHarian();
  }
  function onCashAwalHariInput(el) { formatNominalKas(el); const tgl = document.getElementById('rekapDatePicker').value; const v = el.value.trim()==='' ? null : parseNominalKas(el.value); setCashAwalHari(tgl, v); hitungRekapHarian(); }
  function onModalLaciInput(el) { formatNominalKas(el); const tgl = document.getElementById('rekapDatePicker').value; setModalLaci(tgl, parseNominalKas(el.value)); hitungRekapHarian(); try{ renderWalletKasToko(); }catch(e){} }
  function onCashRealInput(el) { formatNominalKas(el); const tgl = document.getElementById('rekapDatePicker').value; const v = el.value.trim()==='' ? '' : parseNominalKas(el.value); setCashRealVal(tgl, v===''? null : v); const ketEl = document.getElementById('keteranganSelisihInput'); if(ketEl) localStorage.setItem(keyKetSelisih(tgl), ketEl.value); hitungRekapHarian(); }

  function hitungRekapHarian() {
    let history = JSON.parse(localStorage.getItem('rekap_hari_ini') || '[]');
    let targetTanggalPilihan = document.getElementById('rekapDatePicker').value;
    // Cash Awal Hari = fisik saat buka (per tanggal), Modal Laci = target float
    let cashAwalHari = getCashAwalHari(targetTanggalPilihan);
    let modalLaciTarget = parseNominalKas(document.getElementById('modalAwalInput')?.value || '0');
    // persist modal laci per tanggal for morning catch-up
    if(targetTanggalPilihan) setModalLaci(targetTanggalPilihan, modalLaciTarget);
    let cashAyam = 0, qrisAyam = 0, cashMamah = 0, qrisMamah = 0, belanja = 0, tarikTunai = 0, setoranOwner = 0;
    history.forEach((x) => {
      let itemDate = x.tglIso || getLocalIsoDate();
      if (itemDate !== targetTanggalPilihan) return;
      if(x.tipe === 'penjualan' && x.status !== 'VOID') {
        let subtotalVal = parseInt(x.subtotal, 10) || 0;
        if(x.isMamaProduct) { if(x.metode === 'Cash') cashMamah += subtotalVal; else qrisMamah += subtotalVal; }
        else { if(x.metode === 'Cash') cashAyam += subtotalVal; else qrisAyam += subtotalVal; }
      } else if(x.tipe === 'kas') {
        let nominalVal = parseInt(x.nominal, 10) || 0;
        if(x.jenis === 'Saldo Awal Wallet' || x.jenis === 'Adjustment Wallet') {
          // tidak masuk rekap harian (bukan pengeluaran toko) — hanya untuk Wallet kas toko
        } else if(x.jenis === 'Tarik Tunai') tarikTunai += nominalVal;
        else if(x.jenis === 'Setoran Owner') setoranOwner += nominalVal;
        else belanja += nominalVal;
      }
    });
    // cashMamah dipisah (Uang Dipisah) → tidak masuk drawer Ayam
    // F2: jika cashAwalHari belum diinput (null), jangan anggap 0 — status BELUM LENGKAP
    let cashTeoritisSebelumSetoran, targetSetoran, belumDisetor, cashTeoritisAkhir, wajibCash;
    if (cashAwalHari === null) {
      cashTeoritisSebelumSetoran = null;
      targetSetoran = null;
      belumDisetor = null;
      cashTeoritisAkhir = null;
      wajibCash = null;
    } else {
      cashTeoritisSebelumSetoran = cashAwalHari + cashAyam - belanja - tarikTunai;
      targetSetoran = Math.max(0, cashTeoritisSebelumSetoran - modalLaciTarget);
      belumDisetor = Math.max(0, targetSetoran - setoranOwner);
      cashTeoritisAkhir = cashTeoritisSebelumSetoran - setoranOwner;
      wajibCash = cashTeoritisAkhir;
    }
    // Cash Real & selisih
    let cashRealRaw = getCashRealVal(targetTanggalPilihan);
    let cashReal = cashRealRaw;
    let selisih = null;
    let status = 'BELUM LENGKAP';
    if (cashAwalHari === null) {
      status = 'BELUM LENGKAP';
      selisih = null;
    } else if (cashReal === null) {
      status = 'BELUM REKONSILIASI';
      selisih = null;
    } else {
      // cashTeoritisAkhir pasti not null di sini karena cashAwal not null
      selisih = cashReal - cashTeoritisAkhir;
      if (selisih === 0) status = 'BALANCE';
      else if (selisih < 0) status = 'SHORT';
      else status = 'OVER';
    }
    // persist keteranganSelisih per tanggal
    let ketSelisih = document.getElementById('keteranganSelisihInput')?.value || localStorage.getItem(keyKetSelisih(targetTanggalPilihan)) || '';
    document.getElementById('rekapCashAyam').innerText = 'Rp ' + cashAyam.toLocaleString('id-ID');
    document.getElementById('rekapQrisAyam').innerText = 'Rp ' + qrisAyam.toLocaleString('id-ID');
    document.getElementById('rekapCashMamah').innerText = 'Rp ' + cashMamah.toLocaleString('id-ID');
    document.getElementById('rekapQrisMamah').innerText = 'Rp ' + qrisMamah.toLocaleString('id-ID');
    document.getElementById('rekapBelanja').innerText = 'Rp ' + belanja.toLocaleString('id-ID');
    document.getElementById('rekapTarikTunai').innerText = 'Rp ' + tarikTunai.toLocaleString('id-ID');
    const elSetoran = document.getElementById('rekapSetoranOwner'); if(elSetoran) elSetoran.innerText = 'Rp ' + setoranOwner.toLocaleString('id-ID');
    const fmtCash = (v) => (v === null || v === undefined) ? '—' : 'Rp ' + Number(v).toLocaleString('id-ID');
    // Blind Cash Count — STATE B hanya jika snapshot submit ada
    const hasSubmitted = hasSubmittedRekap(targetTanggalPilihan);
    const elHeroWrap = document.getElementById('rekapHeroWrap');
    const elHeroBreakdown = document.getElementById('rekapHeroBreakdown');
    const elCheckWrap = document.getElementById('rekapCheckWrap');
    const elBlindHero = document.getElementById('rekapBlindHelperHero');
    const elBlindCheck = document.getElementById('rekapBlindHelperCheck');
    const elCheckTeoritisRow = document.getElementById('rekapCheckTeoritisRow');
    const fmtBlind = '—';
    if (!hasSubmitted) {
      // STATE A — BELUM SUBMIT: sembunyikan expected cash, target, belum setor, selisih, status
      // PENJUALAN & UANG KELUAR tetap terlihat (di-render sebelum cabang ini)
      if (elHeroWrap) elHeroWrap.classList.add('is-blind');
      if (elCheckWrap) elCheckWrap.classList.add('is-blind');
      if (elBlindHero) elBlindHero.style.display = 'block';
      if (elBlindCheck) elBlindCheck.style.display = 'block';
      const elWajib = document.getElementById('rekapWajibCash'); if(elWajib) elWajib.innerText = fmtBlind;
      const elCashFisik = document.getElementById('rekapCashFisik'); if(elCashFisik) elCashFisik.innerText = fmtBlind;
      const elTarget = document.getElementById('rekapTargetSetoran'); if(elTarget) elTarget.innerText = fmtBlind;
      const elSudah = document.getElementById('rekapSudahSetor'); if(elSudah) elSudah.innerText = fmtBlind;
      const elBelum = document.getElementById('rekapBelumDisetor'); if(elBelum) elBelum.innerText = fmtBlind;
      const elSisa = document.getElementById('rekapSisaCash'); if(elSisa) elSisa.innerText = fmtBlind;
      const elCheck = document.getElementById('rekapCheckTeoritis'); if(elCheck) elCheck.innerText = fmtBlind;
      const elSelisih = document.getElementById('rekapSelisih'); if(elSelisih) elSelisih.innerText = fmtBlind;
      const elStatus = document.getElementById('rekapStatus'); if(elStatus){ elStatus.innerText = 'TERKUNCI'; elStatus.className = 'badge bg-secondary'; }
      const box = document.getElementById('rekapSelisihBox'); if(box){ box.style.background = '#f8f9fa'; }
    } else {
      // STATE B — SUDAH SUBMIT: tampilkan semua hasil (offline-first, tidak tunggu server)
      if (elHeroWrap) elHeroWrap.classList.remove('is-blind');
      if (elCheckWrap) elCheckWrap.classList.remove('is-blind');
      if (elBlindHero) elBlindHero.style.display = 'none';
      if (elBlindCheck) elBlindCheck.style.display = 'none';
      if (elCheckTeoritisRow) elCheckTeoritisRow.style.display = '';
      const elCashFisik = document.getElementById('rekapCashFisik'); if(elCashFisik) elCashFisik.innerText = fmtCash(cashTeoritisSebelumSetoran);
      const elTarget = document.getElementById('rekapTargetSetoran'); if(elTarget) elTarget.innerText = fmtCash(targetSetoran);
      const elSudah = document.getElementById('rekapSudahSetor'); if(elSudah) elSudah.innerText = 'Rp ' + setoranOwner.toLocaleString('id-ID');
      const elBelum = document.getElementById('rekapBelumDisetor'); if(elBelum) elBelum.innerText = fmtCash(belumDisetor);
      document.getElementById('rekapWajibCash').innerText = fmtCash(wajibCash);
      const elSisa = document.getElementById('rekapSisaCash'); if(elSisa) elSisa.innerText = fmtCash(cashTeoritisAkhir);
      const displayStatus = status==='BALANCE' ? '✓ Cocok' : status==='SHORT' ? '⚠ Kurang' : status==='OVER' ? '⚠ Lebih' : status==='BELUM REKONSILIASI' ? 'BELUM DICEK' : status==='BELUM LENGKAP' ? 'BELUM LENGKAP' : status;
      const elSelisih = document.getElementById('rekapSelisih'); if(elSelisih) elSelisih.innerText = (selisih===null ? '—' : (selisih>0?'+ Lebih Rp ' : selisih<0?'- Kurang Rp ' : '') + Math.abs(selisih||0).toLocaleString('id-ID'));
      const elStatus = document.getElementById('rekapStatus'); if(elStatus){ elStatus.innerText = displayStatus; elStatus.className = 'badge ' + (status==='BALANCE'?'bg-success': status==='SHORT'?'bg-danger': status==='OVER'?'bg-warning text-dark':'bg-secondary'); }
      const box = document.getElementById('rekapSelisihBox'); if(box){ box.style.background = status==='BALANCE'?'#d4edda': status==='SHORT'?'#f8d7da': status==='OVER'?'#fff3cd':'#f8f9fa'; }
      const elCheck = document.getElementById('rekapCheckTeoritis'); if(elCheck) elCheck.innerText = fmtCash(cashTeoritisAkhir);
    }
    const emptyEl = document.getElementById('rekapEmptyState'); if(emptyEl){
      const hasTransaksi = (cashAyam+qrisAyam+cashMamah+qrisMamah+belanja+tarikTunai+setoranOwner) > 0;
      const hasCashAwal = cashAwalHari !== null;
      emptyEl.style.display = (!hasTransaksi && !hasCashAwal) ? 'block' : 'none';
    }
    let pickDate = targetTanggalPilihan.split('-');
    // simpan keteranganSelisih live
    if(targetTanggalPilihan) localStorage.setItem(keyKetSelisih(targetTanggalPilihan), ketSelisih);
    dataGlobalRekapKirim = { tanggal: pickDate.length === 3 ? `${pickDate[2]}/${pickDate[1]}/${pickDate[0]}` : "", modalAwal: modalLaciTarget, modalLaciTarget, cashAwalHari, cashAyam, qrisAyam, cashMamah, qrisMamah, belanja, tarikTunai, setoranOwner, cashTeoritisSebelumSetoran, cashFisikSebelumSetoran: cashTeoritisSebelumSetoran, targetSetoran, belumDisetor, cashTeoritisAkhir, sisaCashDiLaci: cashTeoritisAkhir, wajibCashLaci: wajibCash, cashReal, selisih, status, keteranganSelisih: ketSelisih, timestampTutup: new Date().toISOString() };
  }

  function formatNominalKas(el) {
    let v = (el.value || '').toString().replace(/[^0-9]/g, '');
    if (v === '') { el.value = ''; return; }
    // hapus leading zero, format ribuan id-ID (titik)
    v = String(parseInt(v, 10) || 0);
    el.value = Number(v).toLocaleString('id-ID');
  }
  function parseNominalKas(str) {
    return parseInt((str || '').toString().replace(/[^0-9]/g, ''), 10) || 0;
  }
  function simpanKasOperasional() { 
    if (isSavingKas) return;
    isSavingKas = true;
    const btn = document.querySelector('#panel-belanja button[onclick="simpanKasOperasional()"]');
    if (btn) btn.disabled = true;
    const jenis = document.getElementById('jenisKas').value; 
    const nama = document.getElementById('namaItemKas') ? document.getElementById('namaItemKas').value : "Kas Toko"; 
    const nominal = parseNominalKas(document.getElementById('nominalKas').value); 
    if (!nama || nominal <= 0) { Swal.fire('Peringatan', 'Lengkapi pengeluaran!', 'warning'); if (btn) btn.disabled = false; isSavingKas = false; return; } 
    const clientTxnId = crypto.randomUUID ? crypto.randomUUID() : (Date.now() + "-" + Math.random().toString(36).substr(2,8));
    var metodeKas = (document.getElementById('metodeKas')?.value || 'Cash Toko');
    if(jenis!=='Belanja Operasional' && jenis!=='Operasional') metodeKas = 'Cash Toko';
    // Setoran Owner butuh idempotency wajib — pakai clientTxnId + Processed_Request di GAS (seperti penjualan)
    simpanKeHistoryLokal('kas', { jenis: jenis, nominal: nominal, clientTxnId: clientTxnId, metodeKas: metodeKas }); 
    const queueBelanja = JSON.parse(localStorage.getItem('sync_queue_belanja') || '[]'); 
    localStorage.setItem('sync_queue_belanja', JSON.stringify([...queueBelanja, { clientTxnId: clientTxnId, tgl: new Date().toLocaleString('id-ID'), jenisKas: jenis, namaItem: nama, nominal: nominal, keterangan: document.getElementById('ketKas').value, metodeKas: metodeKas, metode: metodeKas }])); 
    Swal.fire({ icon: 'success', title: 'Kas Tercatat!', timer: 1000, showConfirmButton: false }); 
    document.getElementById('namaItemKas').value = ''; document.getElementById('nominalKas').value = ''; document.getElementById('ketKas').value = ''; 
    hitungRekapHarian();
    refreshHistoryLogUI();
    try{ renderWalletKasToko(); }catch(e){}
    attemptSync();
    setTimeout(function(){ if (btn) btn.disabled = false; isSavingKas = false; }, 1200);
  }

  function clearRekapHarian() { Swal.fire({ title: 'Hapus Sesi?', icon: 'warning', showCancelButton: true }).then((r) => { if (r.isConfirmed) { localStorage.removeItem('rekap_hari_ini'); document.getElementById('modalAwalInput').value = 0; hitungRekapHarian(); Swal.fire('Cleared!', '', 'success'); } }); }

  function attemptSync() {
    if (isSyncing) return;
    const statusEl = document.getElementById('syncStatus');

    // PENTING: cek navigator.onLine PALING AWAL, terlepas dari isi antrian --
    // sebelumnya status "Offline" cuma ditampilkan kalau kebetulan ADA
    // antrian menunggu sync, jadi kalau device offline tapi belum ada
    // transaksi baru yang di-queue, badge tetap nyangkut di "Online" padahal
    // sebenarnya tidak terhubung sama sekali.
    if (!navigator.onLine) {
      if (statusEl) { statusEl.innerText = "Offline"; statusEl.className = "badge bg-secondary extra-small"; }
      return;
    }

    const qKasir = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    const qVoid = JSON.parse(localStorage.getItem('sync_queue_void') || '[]');
    const qOpr = JSON.parse(localStorage.getItem('sync_queue_opr') || '[]');
    const qBelanja = JSON.parse(localStorage.getItem('sync_queue_belanja') || '[]');
    const qRekap = JSON.parse(localStorage.getItem('sync_queue_rekap') || '[]');

    if(qKasir.length === 0 && qVoid.length === 0 && qOpr.length === 0 && qBelanja.length === 0 && qRekap.length === 0) {
      if(statusEl) { statusEl.innerText = "Online"; statusEl.className = "badge bg-success extra-small"; }
      return;
    }

    isSyncing = true;
    if(statusEl) { statusEl.innerText = "Syncing..."; statusEl.className = "badge bg-warning extra-small"; }
    
    if (qKasir.length > 0) { 
      const dataYangDikirim = [...qKasir]; 
      
      fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ aksi: 'simpanData', payload: dataYangDikirim }) 
      })
      .then(res => res.json())
      .then((res) => { 
        isSyncing = false;
        // PENTING: backend sekarang mengirim status "Sukses" HANYA jika
        // benar-benar berhasil menulis (lihat perbaikan pada doPost/simpanData
        // di code.gs). Jangan pernah menghapus antrian lokal kalau statusnya
        // bukan "Sukses" -- biarkan tetap di queue supaya dicoba lagi nanti,
        // daripada datanya hilang diam-diam.
        if (res.status === "Sukses") {
          let currentQueue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
          currentQueue.splice(0, dataYangDikirim.length);
          localStorage.setItem('sync_queue', JSON.stringify(currentQueue));

          // Simpan notaIdServer PER NOTA (map clientTxnId -> identifier yang
          // BENAR-BENAR ditulis server ke kolom A sheet Transaksi -- lihat
          // catatan di simpanData/code.gs) ke histori lokal, supaya void
          // nanti bisa menargetkan baris yang tepat. notaIdGroup buatan
          // klien TIDAK BISA dipakai langsung karena tidak pernah sama
          // dengan nilai yang ditulis server. Dipetakan per clientTxnId
          // (bukan satu nilai untuk seluruh batch) karena satu batch bisa
          // berisi beberapa nota berbeda sekaligus.
          const notaIdServerMap = (res.hasil && res.hasil.notaIdServerMap) || {};
          if (Object.keys(notaIdServerMap).length > 0) {
            let historyUpdate = JSON.parse(localStorage.getItem('rekap_hari_ini') || '[]');
            historyUpdate.forEach(h => {
              if (h.tipe === 'penjualan' && h.clientTxnId && notaIdServerMap[h.clientTxnId]) {
                h.notaIdServer = notaIdServerMap[h.clientTxnId];
              }
            });
            localStorage.setItem('rekap_hari_ini', JSON.stringify(historyUpdate));
          }

          attemptSync();
          refreshHistoryLogUI();
          try{ fetchWalletSaldo(); }catch(e){}
        } else {
          console.log("Sync ditolak server, item tetap di antrian untuk dicoba lagi:", res);
          if (statusEl) { statusEl.innerText = "Gagal Sync, akan dicoba lagi"; statusEl.className = "badge bg-danger extra-small"; }
        }
      })
      .catch((err) => { 
        console.log("Sync Error: ", err);
        isSyncing = false; 
      });
    } else if (qVoid.length > 0) {
      // Sengaja dicek SETELAH qKasir kosong: kalau nota yang mau di-void masih
      // antre di sync_queue, void baru dikirim setelah nota itu benar-benar
      // tersimpan di server -- supaya server selalu menemukan nota yang tepat,
      // bukan malah membatalkan nota lain yang kebetulan jadi "terakhir".
      const itemVoid = qVoid[0];
      const historyCek = JSON.parse(localStorage.getItem('rekap_hari_ini') || '[]');
      const entriTersinkron = historyCek.find(h => h.tipe === 'penjualan' && h.clientTxnId === itemVoid.clientTxnId && h.notaIdServer);

      if (!entriTersinkron) {
        // Nota yang mau di-void belum punya notaIdServer -- penjualannya
        // sendiri belum kelar sync (seharusnya jarang terjadi karena qKasir
        // sudah dipastikan kosong di atas, tapi jaga-jaga). Jangan kirim
        // dulu, biarkan tetap di antrian untuk dicoba lagi di siklus
        // berikutnya (interval 20 detik / event online), supaya tidak kirim
        // targetNotaId kosong ke server.
        isSyncing = false;
        return;
      }

      fetch(API_URL, { method: 'POST', body: JSON.stringify({ aksi: 'void', pin: itemVoid.pin, targetNotaId: entriTersinkron.notaIdServer }) })
        .then(res => res.json())
        .then((res) => {
          console.log("Sync void selesai untuk clientTxnId " + itemVoid.clientTxnId + ":", res);
          var q = JSON.parse(localStorage.getItem('sync_queue_void') || '[]');
          q.shift();
          localStorage.setItem('sync_queue_void', JSON.stringify(q));
          isSyncing = false;
          try{ fetchWalletSaldo(); }catch(e){}
          attemptSync();
          loadStokAyam();
        })
        .catch((err) => { console.log("Sync void error, akan dicoba lagi: ", err); isSyncing = false; });
    } else if (qOpr.length > 0) {
      fetch(API_URL, { method: 'POST', body: JSON.stringify({ aksi: 'simpanDapur', payload: qOpr[0] }) }).then(res=>res.json()).then(()=>{ var q=JSON.parse(localStorage.getItem('sync_queue_opr')); q.shift(); localStorage.setItem('sync_queue_opr', JSON.stringify(q)); isSyncing = false; attemptSync(); loadRingkasanDapurHariIni(); loadLogDapurKasir(); loadStokAyam(); }).catch(()=>isSyncing=false);
    } else if (qBelanja.length > 0) { 
      fetch(API_URL, { method: 'POST', body: JSON.stringify({ aksi: 'simpanKas', payload: qBelanja[0] }) }).then(res=>res.json()).then(function(res){ if(res && res.status==="Sukses"){ var q=JSON.parse(localStorage.getItem('sync_queue_belanja')); var justSynced = q[0]; if(justSynced) addWalletPendingConfirm(justSynced); q.shift(); localStorage.setItem('sync_queue_belanja', JSON.stringify(q)); try{ fetchWalletSaldo(); }catch(e){} } else { console.log("simpanKas gagal, tetap di queue untuk retry", res); } isSyncing = false; attemptSync(); }).catch(function(){ isSyncing=false; });
    } else if (qRekap.length > 0) {
      const item = qRekap[0];
      fetch(API_URL, { method: 'POST', body: JSON.stringify({ aksi: 'rekapGsheet', payload: item.payload }) }).then(res=>res.json()).then((res)=>{
        let hasilStr = (res && res.hasil) ? res.hasil.toString() : "";
        let isSudahPernah = hasilStr.indexOf('sudah pernah') !== -1;
        let isFinalized = hasilStr.indexOf('finalized from auto snapshot') !== -1;
        let isSudahDitutup = hasilStr.indexOf('sudah ditutup') !== -1;
        let isGagal = hasilStr.indexOf('Gagal:') === 0;
        // Sukses: outer Sukses + hasil tidak Gagal, atau idempotent/finalized
        if(res && res.status==='Sukses' && !isGagal){
          var q=JSON.parse(localStorage.getItem('sync_queue_rekap') || '[]'); q.shift(); localStorage.setItem('sync_queue_rekap', JSON.stringify(q));
          Swal.fire({ icon:'success', title:'Laporan Terkirim', text: hasilStr || 'Sukses', timer:1500, showConfirmButton:false });
        } else if(isSudahPernah || isFinalized){
          var q=JSON.parse(localStorage.getItem('sync_queue_rekap') || '[]'); q.shift(); localStorage.setItem('sync_queue_rekap', JSON.stringify(q));
          if(isFinalized) Swal.fire({ icon:'success', title:'Laporan Difinalisasi', text:'Snapshot AUTO berhasil difinalisasi', timer:1500, showConfirmButton:false });
        } else if(isSudahDitutup){
          // CASE D: laporan sudah manual final dengan uuid berbeda → jangan retry forever, hapus dan info
          var q=JSON.parse(localStorage.getItem('sync_queue_rekap') || '[]'); q.shift(); localStorage.setItem('sync_queue_rekap', JSON.stringify(q));
          Swal.fire({ icon:'error', title:'Sudah Ditutup', text: hasilStr });
        } else {
          console.log('Rekap ditolak, tetap di queue untuk retry', res);
          if(isGagal) Swal.fire({ icon:'error', title:'Gagal', text: hasilStr });
        }
        isSyncing = false; attemptSync();
      }).catch(()=>{ isSyncing=false; });
    } 
  }

  function simpanStok() { 
    const jenis = document.getElementById('opsiAktivitas').value; 
    const qty = parseInt(document.getElementById('qtyAyam').value, 10) || 0; 
    if (qty <= 0) { Swal.fire('Error', 'Jumlah salah', 'warning'); return; } 
    const queueOpr = JSON.parse(localStorage.getItem('sync_queue_opr') || '[]'); 
    localStorage.setItem('sync_queue_opr', JSON.stringify([...queueOpr, { tgl: new Date().toLocaleString('id-ID'), jenisAktivitas: jenis, qty: qty, minyakUsed: parseFloat(document.getElementById('minyakAyam').value) || 0, keterangan: document.getElementById('ketAyam').value }])); 
    Swal.fire({ icon: 'success', title: 'Tercatat', timer: 1000, showConfirmButton: false }); 
    document.getElementById('qtyAyam').value = ''; document.getElementById('minyakAyam').value = ''; document.getElementById('ketAyam').value = ''; 
    // Realtime monitoring: langsung render pending di list tanpa tunggu server
    try {
      const cacheRaw = localStorage.getItem('cache_ringkasan_dapur');
      if (cacheRaw) {
        const cache = JSON.parse(cacheRaw);
        renderKasirLogDapurGabungan(cache.data, true, cache.waktu);
      } else {
        renderKasirLogDapurGabungan({ daftarAktivitas: [], periodeLabel: new Date().toLocaleDateString('id-ID') }, true, null);
      }
    } catch(e) {}
    attemptSync(); setTimeout(loadStokAyam, 1500); setTimeout(loadRingkasanDapurHariIni, 1500); setTimeout(loadLogDapurKasir, 1500);
  }

  function hitungKembalian() { const metode = document.getElementById('metodeBayar').value; if (metode !== 'Cash') { document.getElementById('uangKembalian').innerText = "Metode: Non-Tunai"; return; } const uangBayar = parseInt(document.getElementById('uangBayar').value, 10) || 0; if (bypassModeActive) { document.getElementById('uangKembalian').innerText = "Bypass Aktif"; return; } const diskonInputVal = parseInt(document.getElementById('diskonNotaInput').value, 10) || 0; let nominalPotongan = (diskonTipe === 'Rp') ? diskonInputVal : Math.round(totalBelanjaGlobal * (diskonInputVal / 100)); const totalAkhirSetelahDiskon = Math.max(0, totalBelanjaGlobal - nominalPotongan); const kembalian = uangBayar - totalAkhirSetelahDiskon; document.getElementById('uangKembalian').innerText = kembalian >= 0 ? 'Kembali: Rp ' + kembalian.toLocaleString('id-ID') : 'Kurang: Rp ' + Math.abs(kembalian).toLocaleString('id-ID'); }
  function kirimRekapKeGSheet() { // legacy, tetap dipakai, tapi simpanTutupToko yang baru akan pakai queue
    // pastikan hitung terbaru sebelum kirim
    hitungRekapHarian();
    if(!dataGlobalRekapKirim.tanggal) return Swal.fire('Gagal', 'Laporan kosong!', 'error');
    fetch(API_URL, { method: 'POST', body: JSON.stringify({ aksi: 'rekapGsheet', payload: dataGlobalRekapKirim }) }).then(res=>res.json()).then(res=>{ Swal.fire('Berhasil!', res.hasil, 'success'); }); 
  }
  function simpanTutupToko() {
    hitungRekapHarian();
    if(!dataGlobalRekapKirim.tanggal) return Swal.fire('Gagal', 'Laporan kosong!', 'error');
    // validasi Cash Awal & Cash Real
    const tglIso = document.getElementById('rekapDatePicker').value;
    const caEl = document.getElementById('cashAwalHariInput');
    if(!caEl || parseNominalKas(caEl.value)===0 && (getCashAwalHari(tglIso)===0)) {
      // tidak wajib block, tapi warning
      console.log('Cash Awal Hari masih 0 — pastikan sudah hitung fisik pagi');
    }
    // clientTxnId untuk idempotency close report
    const clientTxnId = crypto.randomUUID ? crypto.randomUUID() : (Date.now() + "-" + Math.random().toString(36).substr(2,8));
    dataGlobalRekapKirim.clientTxnId = clientTxnId;
    dataGlobalRekapKirim.timestampTutup = new Date().toISOString();
    // simpan keterangan selisih live
    const ketEl = document.getElementById('keteranganSelisihInput');
    if(ketEl) { dataGlobalRekapKirim.keteranganSelisih = ketEl.value; localStorage.setItem(keyKetSelisih(tglIso), ketEl.value); }
    // queue offline-first
    const qRekap = JSON.parse(localStorage.getItem('sync_queue_rekap') || '[]');
    localStorage.setItem('sync_queue_rekap', JSON.stringify([...qRekap, { clientTxnId: clientTxnId, payload: Object.assign({}, dataGlobalRekapKirim) }]));
    // also save local snapshot for morning catch-up check — INI penentu STATE B (Blind Cash Count)
    localStorage.setItem('rekap_snapshot_' + tglIso, JSON.stringify(dataGlobalRekapKirim));
    // langsung buka STATE B tanpa tunggu server (offline-first)
    hitungRekapHarian();
    Swal.fire({ icon: 'success', title: 'Tutup Toko Disimpan', text: 'Rekapan tersimpan. Akan sync ke Sheet saat online.', timer: 1500, showConfirmButton: false });
    attemptSync();
  }

  window.addEventListener('online', function(){ attemptSync(); try{ fetchWalletSaldo(); }catch(e){} });
  // PENTING: dengarkan juga event 'offline' supaya badge status langsung
  // berubah SAAT ITU JUGA ketika koneksi putus, bukan menunggu sampai
  // interval 20 detik berikutnya (lihat catatan di attemptSync()).
  window.addEventListener('offline', attemptSync);
  setInterval(function(){ attemptSync(); try{ if(navigator.onLine && !isSyncing) fetchWalletSaldo(); }catch(e){} }, 60000);
  handleAktivitasDapurChange('Goreng Ayam');
  loadMenuDariSheets();
  attemptSync();
  // Wallet: SOT server + optimistic
  try{ renderWalletKasToko(); fetchWalletSaldo(); }catch(e){}
  // Inisialisasi log dapur kasir (hari ini) — jangan tunggu klik tab Dapur dulu
  setTimeout(loadLogDapurKasir, 800);
  // Set default picker owner ke hari ini agar siap pakai
  const pickerInit = document.getElementById('kasirLogTanggalPicker');
  if (pickerInit && !pickerInit.value) pickerInit.value = getLocalIsoDate();
  // Init rekap per-tanggal (Cash Awal Hari & Modal Laci per hari) dan morning catch-up
  setTimeout(function(){
    const tgl = document.getElementById('rekapDatePicker')?.value;
    if(tgl){
      const ca = localStorage.getItem(keyCashAwal(tgl));
      const ml = localStorage.getItem(keyModalLaci(tgl));
      const cr = localStorage.getItem(keyCashReal(tgl));
      const ket = localStorage.getItem(keyKetSelisih(tgl));
      const elCa = document.getElementById('cashAwalHariInput'); if(elCa && ca!==null) elCa.value = Number(ca).toLocaleString('id-ID');
      const elMl = document.getElementById('modalAwalInput'); if(elMl && ml!==null) elMl.value = Number(ml).toLocaleString('id-ID');
      const elCr = document.getElementById('cashRealInput'); if(elCr && cr!==null) elCr.value = Number(cr).toLocaleString('id-ID');
      const elKet = document.getElementById('keteranganSelisihInput'); if(elKet && ket!==null) elKet.value = ket;
      hitungRekapHarian();
    }
    // Morning catch-up: jika laporan kemarin belum ada snapshot, buat snapshot lokal (backend juga handle via trigger)
    try{
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
      const yIso = getLocalIsoDate(yesterday);
      if(!localStorage.getItem('rekap_snapshot_' + yIso)){
        console.log('Morning catch-up: snapshot kemarin belum ada, akan diisi saat rekap hari itu dibuka');
      }
      // panggil backend catch-up jika ada endpoint (non-blocking)
      fetch(API_URL, { method: 'POST', body: JSON.stringify({ aksi: 'morningCatchUp' }) }).catch(()=>{});
    }catch(e){}
  }, 1000);
  // Live save keterangan selisih
  document.getElementById('keteranganSelisihInput')?.addEventListener('input', function(){
    const tgl = document.getElementById('rekapDatePicker').value;
    localStorage.setItem(keyKetSelisih(tgl), this.value);
    hitungRekapHarian();
  });

