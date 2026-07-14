  let menu = []; let cart = []; let isSyncing = false; let currentCategory1 = 'Semua'; let currentCategory2 = 'Semua'; let totalBelanjaGlobal = 0;
  let bypassModeActive = false; let isOwnerAuthenticated = false; let dataGlobalRekapKirim = {}; let dataOpnameLokalRaw = [];
  let diskonTipe = 'Rp'; let numpadBootstrapModalInstance = null;

  document.getElementById('rekapDatePicker').value = new Date().toISOString().split('T')[0];


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
        if(res.value === "1234") {
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

  function loadStokAyam() {
    fetch(`${API_URL}?aksi=ambilStokAyam`)
      .then(res => res.json())
      .then(res => {
        document.getElementById('liveStokMentah').innerText = (res.stokMentah || 0) + " Ptg";
        document.getElementById('liveStokEtalase').innerText = (res.stokEtalase || 0) + " Ptg";
        document.getElementById('liveStokMinyak').innerText = (res.stokMinyakBaku || 0) + " L";
      }).catch(err => console.log("Offline mode: Gagal load real-time stok ayam"));
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
    const diskonVal = parseInt(document.getElementById('diskonNotaInput').value, 10) || 0;
    let nominalPotongan = (diskonTipe === 'Rp') ? diskonVal : Math.round(totalBelanjaGlobal * (diskonVal / 100));
    const finalTagihan = Math.max(0, totalBelanjaGlobal - nominalPotongan);
    const kembalianLive = nilaiMasukUang - finalTagihan;
    if (kembalianLive >= 0) {
      document.getElementById('numpadPopupKembalianLive').innerText = 'Rp ' + kembalianLive.toLocaleString('id-ID');
      document.getElementById('numpadPopupKembalianLive').style.color = '#2ecc71';
    } else {
      document.getElementById('numpadPopupKembalianLive').innerText = 'Kurang: Rp ' + Math.abs(kembalianLive).toLocaleString('id-ID');
      document.getElementById('numpadPopupKembalianLive').style.color = '#e74c3c';
    }
  }

  function applyOwnerUIVisibility() {
    const headerStok = document.getElementById('ownerStokHeader');
    const ownerSection = document.getElementById('ownerApprovalSection');
    const arsipSection = document.getElementById('ownerArsipSection');
    if (headerStok) { headerStok.style.setProperty('display', isOwnerAuthenticated ? 'table-cell' : 'none', 'important'); }
    if (isOwnerAuthenticated) {
      if(ownerSection) ownerSection.style.setProperty('display', 'block', 'important');
      if(arsipSection) arsipSection.style.setProperty('display', 'block', 'important');
      loadDraftOpnameServerSide();
    } else {
      if(ownerSection) ownerSection.style.setProperty('display', 'none', 'important');
      if(arsipSection) arsipSection.style.setProperty('display', 'none', 'important');
    }
    filterTabelOpname();
    renderMenu();
  }

  function loadDraftOpnameServerSide() {
    const tbody = document.getElementById('ownerApprovalTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted"><i class="fas fa-spinner fa-spin"></i> Sinkronisasi Draft...</td></tr>';
    fetch(`${API_URL}?aksi=ambilDraftOpname`)
      .then(res => res.json())
      .then((draftList) => {
        if(!draftList || draftList.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="text-muted py-2">Tidak ada draft opname tertunda.</td></tr>';
          return;
        }
        tbody.innerHTML = '';
        draftList.forEach((x) => {
          tbody.innerHTML += `<tr><td class="text-start fw-bold">${x.nama}</td><td><span class="badge bg-secondary">${x.sistem}</span></td><td><span class="badge bg-info">${x.fisik}</span></td><td class="fw-bold ${x.selisih < 0 ? 'text-danger':'text-success'}">${x.selisih}</td><td><button class="btn btn-xs btn-success py-1 px-2 fw-bold" onclick="approveDraftOpnameSingle(${x.rowNum}, '${x.nama}', ${x.fisik})">APPROVE</button></td></tr>`;
        });
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
          else { Swal.fire('Error', res.error, 'error'); }
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
      cartDiv.innerHTML += `<div class="card p-2 mb-1 border-0 bg-light extra-small"><div class="cart-item-row"><div class="cart-item-name"><span class="text-uppercase">${c.item}</span></div><div class="cart-item-controls"><span class="text-muted text-nowrap me-1">@${c.harga.toLocaleString('id-ID')}</span><input type="number" class="form-control form-control-sm qty-control" value="${c.qty}" onchange="ubahQtyManual(${i}, this.value)"><button class="btn btn-sm text-danger p-0 px-1 fw-bold" onclick="hapusItemKeranjang(${i})">×</button></div></div></div>`; 
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
  
  const transaksiBaru = [];
  const wadahDipilih = document.getElementById('wadahTipeInput').value;
  
  cart.forEach(c => { 
    let isMamaProduct = c.cat1 && c.cat1.toLowerCase().includes('mama') || c.cat1 && c.cat1.toLowerCase().includes('mamah');
    transaksiBaru.push({ 
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
      notaIdGroup: notaIdGroup 
    });
  }); 
  
  const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]'); 
  localStorage.setItem('sync_queue', JSON.stringify(queue.concat(transaksiBaru))); 
  
  Swal.fire({ icon: 'success', title: 'Sukses!', timer: 1000, showConfirmButton: false }); 
  cart = []; document.getElementById('uangBayar').value = ''; document.getElementById('diskonNotaInput').value = '';
  document.getElementById('bypassModeToggle').checked = false; bypassModeActive = false;
  updateUI(); if(btnPay) btnPay.disabled = false; attemptSync(); 
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

  function requestVoid() { 
    Swal.fire({ title: 'Otorisasi Admin', text: 'Masukkan PIN Owner untuk pembatalan:', input: 'password', showCancelButton: true }).then((result) => { 
      if (result.isConfirmed) { 
        Swal.fire({ title: 'Memproses Void...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ aksi: 'void', pin: result.value }) })
        .then(res => res.json())
        .then((respon) => { 
          Swal.close(); 
          Swal.fire(respon.hasil.includes("Sukses") ? 'success' : 'error', respon.hasil); 
          let history = JSON.parse(localStorage.getItem('rekap_hari_ini') || '[]');
          if(history.length > 0) {
            let targetNotaGroupText = "";
            for(let k = history.length - 1; k >= 0; k--) {
              if(history[k].tipe === 'penjualan' && history[k].status === 'OK') { targetNotaGroupText = history[k].notaIdGroup || ""; break; }
            }
            if(targetNotaGroupText !== "") {
              for(let m = 0; m < history.length; m++) { if(history[m].notaIdGroup === targetNotaGroupText) { history[m].status = 'VOID'; } }
            }
            localStorage.setItem('rekap_hari_ini', JSON.stringify(history));
          }
          refreshHistoryLogUI(); loadStokAyam();
        }); 
      } 
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
    let tglIso = new Date().toISOString().split('T')[0];
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
  function toggleBypassMode() { const toggle = document.getElementById('bypassModeToggle'); bypassModeActive = toggle.checked; const uangBayarInput = document.getElementById('uangBayar'); if (bypassModeActive && document.getElementById('metodeBayar').value === 'Cash') { const diskonInputVal = parseInt(document.getElementById('diskonNotaInput').value, 10) || 0; let nominalPotongan = (diskonTipe === 'Rp') ? diskonInputVal : Math.round(totalBelanjaGlobal * (diskonInputVal / 100)); const totalAkhirSetelahDiskon = Math.max(0, totalBelanjaGlobal - nominalPotongan); uangBayarInput.value = totalAkhirSetelahDiskon; } else if (!bypassModeActive) { uangBayarInput.value = ''; } hitungKembalian(); }
  function handleMetodeBayarChange() { const metode = document.getElementById('metodeBayar').value; if (bypassModeActive && metode === 'Cash') { const diskonInputVal = parseInt(document.getElementById('diskonNotaInput').value, 10) || 0; let nominalPotongan = (diskonTipe === 'Rp') ? diskonInputVal : Math.round(totalBelanjaGlobal * (diskonInputVal / 100)); const totalAkhirSetelahDiskon = Math.max(0, totalBelanjaGlobal - nominalPotongan); document.getElementById('uangBayar').value = totalAkhirSetelahDiskon; } hitungKembalian(); }
  function toggleCustomInputLabel() { const jenis = document.getElementById('jenisKas').value; const label = document.getElementById('labelNamaItem'); const input = document.getElementById('namaItemKas'); if (jenis === 'Tarik Tunai') { label.innerText = "Tujuan Tarik Tunai"; input.placeholder = "Setor ke Bos"; } else { label.innerText = "Nama Barang"; input.placeholder = "Gas / Beras"; } }

  function refreshHistoryLogUI() {
    const container = document.getElementById('kasirHistoryLogContainer');
    if(!container) return;
    let history = JSON.parse(localStorage.getItem('rekap_hari_ini') || '[]');
    if(history.length === 0) { container.innerHTML = '<div class="text-center text-muted py-3">Belum ada transaksi.</div>'; return; }
    container.innerHTML = '';
    history.reverse().forEach((x) => {
      if(x.tipe === 'penjualan') {
        let textClass = x.status === 'VOID' ? 'text-decoration-line-through text-danger' : '';
        container.innerHTML += `<div class="history-log-row ${textClass}"><b>[${x.jam}]</b> Jual ${x.namaItem} x${x.qty} - Rp ${(x.subtotal || 0).toLocaleString('id-ID')} (${x.metode}) ${x.status === 'VOID' ? '<b>[VOID]</b>':''}</div>`;
      } else if(x.tipe === 'kas') {
        container.innerHTML += `<div class="history-log-row text-warning"><b>[KAS OUT]</b> ${x.jenis}: Rp ${(x.nominal || 0).toLocaleString('id-ID')}</div>`;
      }
    });
  }

  function hitungRekapHarian() {
    let history = JSON.parse(localStorage.getItem('rekap_hari_ini') || '[]');
    let modalAwal = parseInt(document.getElementById('modalAwalInput').value, 10) || 0;
    let targetTanggalPilihan = document.getElementById('rekapDatePicker').value; 
    let cashAyam = 0, qrisAyam = 0, cashMamah = 0, qrisMamah = 0, belanja = 0, tarikTunai = 0; 
    
    history.forEach((x) => {
      let itemDate = x.tglIso || new Date().toISOString().split('T')[0];
      if (itemDate !== targetTanggalPilihan) return; 
      if(x.tipe === 'penjualan' && x.status !== 'VOID') {
        let subtotalVal = parseInt(x.subtotal, 10) || 0; 
        if(x.isMamaProduct) { if(x.metode === 'Cash') cashMamah += subtotalVal; else qrisMamah += subtotalVal; } 
        else { if(x.metode === 'Cash') cashAyam += subtotalVal; else qrisAyam += subtotalVal; }
      } else if(x.tipe === 'kas') {
        let nominalVal = parseInt(x.nominal, 10) || 0; 
        if(x.jenis === 'Tarik Tunai') tarikTunai += nominalVal; else belanja += nominalVal; 
      }
    });
    let wajibCash = modalAwal + cashAyam - belanja - tarikTunai; 
    document.getElementById('rekapCashAyam').innerText = 'Rp ' + cashAyam.toLocaleString('id-ID'); 
    document.getElementById('rekapQrisAyam').innerText = 'Rp ' + qrisAyam.toLocaleString('id-ID'); 
    document.getElementById('rekapCashMamah').innerText = 'Rp ' + cashMamah.toLocaleString('id-ID'); 
    document.getElementById('rekapQrisMamah').innerText = 'Rp ' + qrisMamah.toLocaleString('id-ID'); 
    document.getElementById('rekapBelanja').innerText = 'Rp ' + belanja.toLocaleString('id-ID'); 
    document.getElementById('rekapTarikTunai').innerText = 'Rp ' + tarikTunai.toLocaleString('id-ID'); 
    document.getElementById('rekapWajibCash').innerText = 'Rp ' + wajibCash.toLocaleString('id-ID'); 
    let pickDate = targetTanggalPilihan.split('-');
    dataGlobalRekapKirim = { tanggal: pickDate.length === 3 ? `${pickDate[2]}/${pickDate[1]}/${pickDate[0]}` : "", modalAwal, cashAyam, qrisAyam, cashMamah, qrisMamah, belanja, tarikTunai, wajibCashLaci: wajibCash };
  }

  function simpanKasOperasional() { 
    const jenis = document.getElementById('jenisKas').value; 
    const nama = document.getElementById('namaItemKas') ? document.getElementById('namaItemKas').value : "Kas Toko"; 
    const nominal = parseInt(document.getElementById('nominalKas').value, 10) || 0; 
    if (!nama || nominal <= 0) { Swal.fire('Peringatan', 'Lengkapi pengeluaran!', 'warning'); return; } 
    simpanKeHistoryLokal('kas', { jenis: jenis, nominal: nominal }); 
    const queueBelanja = JSON.parse(localStorage.getItem('sync_queue_belanja') || '[]'); 
    localStorage.setItem('sync_queue_belanja', JSON.stringify([...queueBelanja, { tgl: new Date().toLocaleString('id-ID'), jenisKas: jenis, namaItem: nama, nominal: nominal, keterangan: document.getElementById('ketKas').value }])); 
    Swal.fire({ icon: 'success', title: 'Kas Tercatat!', timer: 1000, showConfirmButton: false }); 
    document.getElementById('namaItemKas').value = ''; document.getElementById('nominalKas').value = ''; document.getElementById('ketKas').value = ''; 
    attemptSync(); 
  }

  function clearRekapHarian() { Swal.fire({ title: 'Hapus Sesi?', icon: 'warning', showCancelButton: true }).then((r) => { if (r.isConfirmed) { localStorage.removeItem('rekap_hari_ini'); document.getElementById('modalAwalInput').value = 0; hitungRekapHarian(); Swal.fire('Cleared!', '', 'success'); } }); }

  function attemptSync() { 
    if (isSyncing) return; 
    const statusEl = document.getElementById('syncStatus'); 
    const qKasir = JSON.parse(localStorage.getItem('sync_queue') || '[]'); 
    const qOpr = JSON.parse(localStorage.getItem('sync_queue_opr') || '[]'); 
    const qBelanja = JSON.parse(localStorage.getItem('sync_queue_belanja') || '[]'); 
    
    if(qKasir.length === 0 && qOpr.length === 0 && qBelanja.length === 0) { 
      if(statusEl) statusEl.innerText = "Online"; 
      return; 
    } 
    
    if(!navigator.onLine) { 
      if(statusEl) statusEl.innerText = "Offline"; 
      return; 
    } 
    
    isSyncing = true; 
    if(statusEl) statusEl.innerText = "Syncing..."; 
    
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
          attemptSync(); 
          refreshHistoryLogUI(); 
        } else {
          console.log("Sync ditolak server, item tetap di antrian untuk dicoba lagi:", res);
          if (statusEl) statusEl.innerText = "Gagal Sync, akan dicoba lagi";
        }
      })
      .catch((err) => { 
        console.log("Sync Error: ", err);
        isSyncing = false; 
      });
    } else if (qOpr.length > 0) { 
      fetch(API_URL, { method: 'POST', body: JSON.stringify({ aksi: 'simpanDapur', payload: qOpr[0] }) }).then(res=>res.json()).then(()=>{ var q=JSON.parse(localStorage.getItem('sync_queue_opr')); q.shift(); localStorage.setItem('sync_queue_opr', JSON.stringify(q)); isSyncing = false; attemptSync(); }).catch(()=>isSyncing=false);
    } else if (qBelanja.length > 0) { 
      fetch(API_URL, { method: 'POST', body: JSON.stringify({ aksi: 'simpanKas', payload: qBelanja[0] }) }).then(res=>res.json()).then(()=>{ var q=JSON.parse(localStorage.getItem('sync_queue_belanja')); q.shift(); localStorage.setItem('sync_queue_belanja', JSON.stringify(q)); isSyncing = false; attemptSync(); }).catch(()=>isSyncing=false);
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
    attemptSync(); setTimeout(loadStokAyam, 1500); 
  }

  function hitungKembalian() { const metode = document.getElementById('metodeBayar').value; if (metode !== 'Cash') { document.getElementById('uangKembalian').innerText = "Metode: Non-Tunai"; return; } const uangBayar = parseInt(document.getElementById('uangBayar').value, 10) || 0; if (bypassModeActive) { document.getElementById('uangKembalian').innerText = "Bypass Aktif"; return; } const diskonInputVal = parseInt(document.getElementById('diskonNotaInput').value, 10) || 0; let nominalPotongan = (diskonTipe === 'Rp') ? diskonInputVal : Math.round(totalBelanjaGlobal * (diskonInputVal / 100)); const totalAkhirSetelahDiskon = Math.max(0, totalBelanjaGlobal - nominalPotongan); const kembalian = uangBayar - totalAkhirSetelahDiskon; document.getElementById('uangKembalian').innerText = kembalian >= 0 ? 'Kembali: Rp ' + kembalian.toLocaleString('id-ID') : 'Kurang: Rp ' + Math.abs(kembalian).toLocaleString('id-ID'); }
  function kirimRekapKeGSheet() { fetch(API_URL, { method: 'POST', body: JSON.stringify({ aksi: 'rekapGsheet', payload: dataGlobalRekapKirim }) }).then(res=>res.json()).then(res=>{ Swal.fire('Berhasil!', res.hasil, 'success'); }); }

  window.addEventListener('online', attemptSync);
  setInterval(attemptSync, 20000);
  handleAktivitasDapurChange('Goreng Ayam');
  loadMenuDariSheets();

