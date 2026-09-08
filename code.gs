function doGet(e) {
  // --- Rute khusus Dashboard Owner: HARUS dicek paling atas, sebelum apa pun
  // yang lain. Diserve sebagai halaman HtmlService TERPISAH dari 'index',
  // supaya tablet kasir (yang hanya buka index.html via GitHub Pages) tidak
  // pernah menyentuh/mendownload markup atau script dashboard sama sekali. ---
  if (e && e.parameter && e.parameter.page === 'dashboard') {
    try {
      return HtmlService.createTemplateFromFile('dashboard')
          .evaluate()
          .setTitle('Dashboard Owner · D\'CrunchyWan')
          .addMetaTag('viewport', 'width=device-width, initial-scale=1')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch(errDash) {
      return ContentService.createTextOutput(JSON.stringify({ status: "Error", message: "Gagal memuat dashboard: " + errDash.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (!e || !e.parameter || !e.parameter.aksi) {
    try {
      return HtmlService.createTemplateFromFile('index')
          .evaluate()
          .setTitle('D\'CrunchyWan POS')
          .addMetaTag('viewport', 'width=device-width, initial-scale=1')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({ status: "Error", message: "Aksi GET tidak dikenali or file index tidak ada" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  var aksi = e.parameter.aksi;
  var data;
  try {
    if (aksi === "ambilMenu") {
      data = ambilDaftarMenu();
    } else if (aksi === "ambilStokAyam") {
      data = ambilInfoStokAyam();
    } else if (aksi === "ambilStokBarang") {
      data = ambilStokBarang();
    } else if (aksi === "ambilLogDapurHariIni") {
      data = ambilLogDapurHariIni();
    } else if (aksi === "ambilLogDapurHarian") {
      data = ambilLogDapurHarian(e.parameter.tanggal, e.parameter.bulan, e.parameter.tahun);
    } else if (aksi === "ambilDraftOpname") {
      data = ambilDraftOpnamePending();
    } else if (aksi === "ambilRekapHarian") {
      data = ambilRekapHarian(e.parameter.bulan, e.parameter.tahun);
    } else if (aksi === "ambilRekapBulanan") {
      data = ambilRekapBulanan(e.parameter.tahun);
    } else if (aksi === "ambilWalletSaldo") {
      data = getWalletSaldo();
    } else if (aksi === "ambilWalletSaldoPeriode") {
      data = getWalletSaldoPeriode(e.parameter.bulan, e.parameter.tahun, e.parameter.tanggal);
    } else {
      data = { status: "Error", message: "Aksi GET tidak dikenali" };
    }
  } catch(err) {
    data = { status: "Error", error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Helper standar Apps Script untuk menyisipkan file HTML lain (CSS/JS
// terpisah) ke dalam template utama via scriptlet <?!= include('nama'); ?>.
// Dipakai oleh dashboard.html untuk menyisipkan dashboard_css & dashboard_js.
function include(namaFile) {
  return HtmlService.createHtmlOutputFromFile(namaFile).getContent();
}

function doPost(e) {
  try {
    var dataMentah = JSON.parse(e.postData.contents);
    var aksi = dataMentah.aksi;
    var hasil;

    if (aksi === "simpanData") {
      hasil = simpanData(dataMentah.payload);
      // simpanData() menangkap error-nya sendiri dan mengembalikan STRING
      // "Error: ..." kalau gagal, atau OBJECT {status, notaIdServer} kalau
      // berhasil (notaIdServer = identifier nota versi server, dipakai
      // klien untuk target void nanti) -- bukan melempar exception.
      var gagalSimpan = (typeof hasil === "string" && hasil.indexOf("Error") === 0);
      return ContentService.createTextOutput(JSON.stringify({
        status: gagalSimpan ? "Gagal" : "Sukses",
        hasil: hasil,
        itemsDiterima: Array.isArray(dataMentah.payload) ? dataMentah.payload.length : 1
      })).setMimeType(ContentService.MimeType.JSON);
    } else if (aksi === "simpanKas") {
      hasil = simpanPengeluaranToko(dataMentah.payload);
      var gagalKas = (typeof hasil === "string" && hasil.indexOf("Error") === 0);
      return ContentService.createTextOutput(JSON.stringify({
        status: gagalKas ? "Gagal" : "Sukses",
        hasil: hasil
      })).setMimeType(ContentService.MimeType.JSON);
    } else if (aksi === "simpanDapur") {
      hasil = simpanLogOperasional(dataMentah.payload);
    } else if (aksi === "uploadGambar") {
      hasil = uploadGambarMenu(dataMentah.base64, dataMentah.fileName, dataMentah.itemName);
    } else if (aksi === "opname") {
      hasil = catatOpnameBarang(dataMentah.namaBarang, dataMentah.stokSistem, dataMentah.fisikVal, dataMentah.selisih);
    } else if (aksi === "approveOpname") {
      hasil = eksekusiApproveDraftOwner(dataMentah.rowNum, dataMentah.nama, dataMentah.fisikVal);
    } else if (aksi === "rekapGsheet") {
      hasil = simpanLaporanTutupTokoGSheet(dataMentah.payload);
    } else if (aksi === "void") {
      hasil = batalkanTransaksiTerakhir(dataMentah.pin, dataMentah.targetNotaId);
    } else if (aksi === "arsipTahun") {
      hasil = arsipkanTahunTransaksi(dataMentah.pin);
    } else if (aksi === "morningCatchUp") {
      hasil = morningCatchUp();
    } else if (aksi === "autoSnapshot") {
      var tgl = dataMentah.tanggal ? new Date(dataMentah.tanggal) : new Date();
      hasil = generateDailyReportIfMissing(tgl);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ status: "Gagal", error: "Aksi POST tidak dikenali" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "Sukses", hasil: hasil }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "Gagal", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getRealLastRow(sheet) {
  if (!sheet) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) return 0;
  var values = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (var i = lastRow - 1; i >= 0; i--) {
    if (values[i][0] !== "" && values[i][0] !== null) {
      return i + 1;
    }
  }
  return 1;
}

// Kolom tanggal nota (kolom A di Transaksi/Transaksi Mamah) ditulis sebagai
// STRING "dd/MM/yyyy HH:mm:ss" oleh simpanData(). Tapi Google Sheets bisa
// otomatis mengonversi string yang "kelihatan seperti tanggal" itu jadi
// nilai Date asli saat disimpan (tergantung locale sheet) -- walau yang
// kita tulis programatis murni string. Kalau itu terjadi, getRange().
// getValues() akan mengembalikan OBJEK DATE saat dibaca lagi, bukan string
// yang sama persis dengan yang ditulis -- jadi perbandingan/parsing string
// biasa (targetNotaId === sel.toString()) akan SELALU gagal walau isinya
// kelihatan sama persis di tampilan sheet. Fungsi ini menormalisasi nilai
// sel kembali ke format string kanonik yang sama, apa pun tipe aslinya,
// supaya perbandingan & parsing tanggal konsisten di semua fungsi yang
// membaca kolom ini (void, rekap dashboard, arsip tahunan).
function _formatNilaiTglSheet(nilaiSel) {
  if (nilaiSel instanceof Date) {
    return Utilities.formatDate(nilaiSel, "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss");
  }
  return (nilaiSel || "").toString().trim();
}

function ambilDaftarMenu() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Kasir");
    if (!sheet) return [];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    var data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    var daftarMenu = [];
    data.forEach(function(row) {
      var namaMenu = row[1] ? row[1].toString().trim() : "";
      if (namaMenu !== "") {
        var c1 = row[3] ? row[3].toString().trim() : "Lainnya";
        var c2 = row[4] ? row[4].toString().trim() : "";
        daftarMenu.push({
          item: namaMenu,
          harga: Number(row[2]) || 0,
          cat1: c1 === "" ? "Lainnya" : c1,
          cat2: c2,
          imageUrl: row[5] ? row[5].toString().trim() : ""
        });
      }
    });
    return daftarMenu;
  } catch(e) { return []; }
}

function simpanData(payloadData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetAyam = ss.getSheetByName("Transaksi");
    var sheetMamah = ss.getSheetByName("Transaksi Mamah");
    var sheetProcessed = ss.getSheetByName("Processed_Request");

    var daftarMenuGlobal = ambilDaftarMenu();

    var rowsToProcessMentah = Array.isArray(payloadData) ? payloadData : [payloadData];

    // ===============================
    // IDEMPOTENCY CHECK -- PER NOTA (per clientTxnId), bukan cuma dicek dari
    // item pertama di payload. satu payload BISA berisi BEBERAPA nota
    // berbeda sekaligus kalau kasir checkout beberapa kali sebelum sync
    // sebelumnya kelar (mis. koneksi lambat) -- semuanya numpuk di
    // sync_queue lalu dikirim jadi satu batch. Kalau idempotency cuma
    // dicek dari nota PERTAMA di batch (perilaku lama), dan nota pertama
    // itu kebetulan sudah pernah sukses ditulis sebelumnya (server sukses
    // tapi respons ke klien sempat gagal/telat), seluruh batch langsung
    // dibalas "Sukses" tanpa pernah menulis nota-nota LAIN di belakangnya
    // yang sebenarnya baru -- itu penyebab transaksi hilang diam-diam
    // walau di histori lokal kasir sudah tercatat normal.
    //
    // Jadi di sini: filter payload PER BARIS berdasarkan clientTxnId-nya
    // masing-masing terhadap Processed_Request, baru proses yang benar-benar
    // baru. Penandaan "sudah diproses" (appendRow) tetap dilakukan di akhir
    // fungsi, SETELAH TAHAP 2 (tulis transaksi) benar-benar berhasil --
    // supaya kalau penulisan gagal di tengah jalan, retry berikutnya tidak
    // salah dianggap "sudah pernah diproses".
    // ===============================
    var notaIdServerMap = {}; // clientTxnId -> tglWib (identifier yang BENAR-BENAR ditulis ke kolom A sheet)
    if (sheetProcessed) {
      var lastRowReq = sheetProcessed.getLastRow();
      if (lastRowReq > 1) {
        var dataProcessed = sheetProcessed.getRange(2, 1, lastRowReq - 1, 3).getValues();
        dataProcessed.forEach(function(r) {
          if (r[0]) notaIdServerMap[r[0]] = r[2] ? _formatNilaiTglSheet(r[2]) : "";
        });
      }
    }

    var rowsToProcess = rowsToProcessMentah.filter(function(row) {
      return !(row && row.clientTxnId && notaIdServerMap.hasOwnProperty(row.clientTxnId));
    });

    if (rowsToProcess.length === 0) {
      // SEMUA nota di batch ini sudah pernah diproses sebelumnya.
      return { status: "Sukses", notaIdServerMap: notaIdServerMap };
    }

    var waktuNota = new Date();
    // tglWib (waktu SERVER saat sync ini berjalan) sekarang cuma dipakai
    // sebagai FALLBACK kalau row.tgl entah kenapa kosong -- BUKAN lagi
    // nilai utama kolom A. Lihat catatan tglKolomA di TAHAP 1 di bawah.
    var tglWib = Utilities.formatDate(waktuNota, "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss");

    var barisBaruAyam = [];
    var barisBaruMamah = [];
    var totalAyamTerjual = 0;    // dikumpulkan dulu, dipotong dari Stok Barang sekali di akhir (bukan per-item)
    var deduksiStokBaku = {};    // { "nama bahan (lowercase)": totalQtyYangHarusDipotong }
    var tglKolomAPerClientTxnId = {}; // clientTxnId -> nilai kolom A yang dipakai untuk nota ini

    // --- TAHAP 1: proses semua baris di memori dulu. TIDAK ADA operasi
    // baca/tulis ke sheet lain di sini, supaya satu item yang "bermasalah"
    // tidak pernah bisa menggagalkan/menghentikan item lain di keranjang. ---
    for (var k = 0; k < rowsToProcess.length; k++) {
      var row = rowsToProcess[k];
      if (!row || !row.item) continue;

      try {
        var itemNamaLower = row.item.toString().toLowerCase().trim();
        var dataProduk = null;

        for (var i = 0; i < daftarMenuGlobal.length; i++) {
          if (daftarMenuGlobal[i].item.toLowerCase() === itemNamaLower) {
            dataProduk = daftarMenuGlobal[i];
            break;
          }
        }

        var c1Murni = dataProduk ? dataProduk.cat1.toLowerCase() : "";
        var hargaSatuan = dataProduk ? dataProduk.harga : 0;
        var beneranMama = c1Murni.includes("mama") || c1Murni.includes("mamah");
        var qtyBersih = Number(row.qty) || 1;

        // PENTING: kolom A pakai timestamp ASLI dari klien (row.tgl, dibuat
        // persis saat kasir checkout -- termasuk saat offline), BUKAN
        // tglWib (waktu server saat SYNC ini berjalan). Kalau beberapa nota
        // berbeda dibuat offline lalu baru sync bareng dalam satu batch,
        // semuanya akan dikirim dalam SATU panggilan simpanData() -- kalau
        // dipakai tglWib, seluruh nota itu akan tertulis dengan timestamp
        // SAMA PERSIS di kolom A, sehingga void (yang mencocokkan
        // berdasarkan kolom A) salah sasaran dan membatalkan semuanya
        // sekaligus. row.tgl unik per nota (dibuat saat checkout terjadi),
        // jadi ini menjaga tiap nota tetap bisa dibedakan.
        var tglKolomA = (row.tgl && row.tgl.toString().trim() !== "") ? row.tgl.toString().trim() : tglWib;
        if (row.clientTxnId && !tglKolomAPerClientTxnId[row.clientTxnId]) {
          tglKolomAPerClientTxnId[row.clientTxnId] = tglKolomA;
        }

        var barisData = [
          tglKolomA,
          row.item,
          qtyBersih,
          row.pembayaran || "Cash",
          hargaSatuan,
          (dataProduk ? dataProduk.cat1 : "Lainnya"),
          row.wadah || "Takeout",
          Number(row.diskonNilai) || 0,
          row.diskonTipe || "Rp",
          "OK"
        ];

        if (beneranMama) {
          barisBaruMamah.push(barisData);
        } else {
          barisBaruAyam.push(barisData);
        }

        // Kumpulkan kebutuhan potong stok bahan baku (CAT 2), jangan
        // langsung baca/tulis sheet "Stok Barang" di sini per item.
        if (dataProduk && dataProduk.cat2 && dataProduk.cat2.toString().trim() !== "") {
          var keyBahan = dataProduk.cat2.toString().trim().toLowerCase();
          deduksiStokBaku[keyBahan] = (deduksiStokBaku[keyBahan] || 0) + qtyBersih;
        }

        if (!beneranMama && (itemNamaLower.indexOf("ayam") !== -1 || itemNamaLower.indexOf("geprek") !== -1 || c1Murni.indexOf("ayam") !== -1 || c1Murni.indexOf("geprek") !== -1)) {
          totalAyamTerjual += Math.abs(qtyBersih);
        }
      } catch (errItem) {
        // Kalau SATU item gagal diproses (misal data aneh dari klien),
        // catat dan lanjut ke item berikutnya -- jangan menggagalkan
        // seluruh keranjang.
        console.log("Item dilewati karena error: " + JSON.stringify(row) + " | " + errItem.toString());
        continue;
      }
    }

    // --- TAHAP 2: tulis semua hasil ke sheet dalam batch tunggal per sheet ---
    var jumlahDitulis = 0;

    if (barisBaruAyam.length > 0 && sheetAyam) {
      var lastRowAyam = getRealLastRow(sheetAyam);
      // PENTING: format kolom A jadi PLAIN TEXT ("@") SEBELUM nilainya
      // ditulis -- supaya Google Sheets tidak otomatis mengonversi string
      // "dd/MM/yyyy HH:mm:ss" jadi nilai Date asli (yang bisa salah tafsir
      // hari/bulan tertukar tergantung locale sheet, bikin perbandingan
      // string untuk void/rekap jadi tidak pernah cocok). Kalau format
      // diset SETELAH nilai ditulis, ini tidak akan memperbaiki nilai yang
      // sudah kadung terkonversi -- makanya harus sebelum setValues().
      sheetAyam.getRange(lastRowAyam + 1, 1, barisBaruAyam.length, 1).setNumberFormat("@");
      sheetAyam.getRange(lastRowAyam + 1, 1, barisBaruAyam.length, 10).setValues(barisBaruAyam);
      jumlahDitulis += barisBaruAyam.length;
    }

    if (barisBaruMamah.length > 0 && sheetMamah) {
      var lastRowMamah = getRealLastRow(sheetMamah);
      sheetMamah.getRange(lastRowMamah + 1, 1, barisBaruMamah.length, 1).setNumberFormat("@");
      sheetMamah.getRange(lastRowMamah + 1, 1, barisBaruMamah.length, 10).setValues(barisBaruMamah);
      jumlahDitulis += barisBaruMamah.length;
    }

    if (totalAyamTerjual > 0) {
      try {
        // Ayam terjual TIDAK lagi ditulis sebagai baris riwayat di
        // Log_Stok_Ayam (sudah otomatis kebaca lewat rekap Transaksi/
        // Transaksi Mamah di dashboard) -- di sini cukup kurangi angka
        // berjalan "Ayam Matang (Etalase)" di sheet "Stok Barang".
        sesuaikanStokBarang(ss, "Ayam Matang (Etalase)", -totalAyamTerjual);
      } catch (errStokAyam) {
        console.log("Gagal sesuaikan stok Ayam Matang (transaksi tetap tersimpan): " + errStokAyam.toString());
      }
    }

    if (Object.keys(deduksiStokBaku).length > 0) {
      try {
        potongStokBahanBakuKasirBatch(ss, deduksiStokBaku);
      } catch (errStok) {
        console.log("Gagal potong stok bahan baku (transaksi tetap tersimpan): " + errStok.toString());
      }
    }

    if (jumlahDitulis !== rowsToProcess.length) {
      // Sebagian item di payload tidak valid (misal item tanpa nama) dan
      // dilewati -- ini bukan kegagalan sistem, hanya informasi.
      console.log("Info: dikirim " + rowsToProcess.length + " item, berhasil ditulis " + jumlahDitulis + " item.");
    }

    // Tandai SETIAP clientTxnId baru yang muncul di batch ini sebagai "sudah
    // diproses" DI SINI, setelah semua penulisan di atas terbukti berhasil
    // (lihat catatan di IDEMPOTENCY CHECK di awal fungsi ini). Tiap nota
    // pakai tglKolomA MILIKNYA SENDIRI (dari tglKolomAPerClientTxnId, hasil
    // TAHAP 1) -- bukan tglWib global -- supaya identifier yang dikembalikan
    // ke klien untuk void betul-betul cocok dengan yang ditulis di kolom A.
    if (sheetProcessed) {
      var clientTxnIdsBaru = [];
      rowsToProcess.forEach(function(row) {
        if (row && row.clientTxnId && clientTxnIdsBaru.indexOf(row.clientTxnId) === -1) {
          clientTxnIdsBaru.push(row.clientTxnId);
        }
      });
      if (clientTxnIdsBaru.length > 0) {
        var barisProcessedBaru = clientTxnIdsBaru.map(function(id) {
          var tglUntukId = tglKolomAPerClientTxnId[id] || tglWib;
          notaIdServerMap[id] = tglUntukId;
          return [id, new Date(), tglUntukId];
        });
        var lastRowProcessed = getRealLastRow(sheetProcessed);
        // Kolom C (tglWib) diformat PLAIN TEXT dulu sebelum ditulis, dengan
        // alasan yang sama seperti kolom A Transaksi/Transaksi Mamah di atas
        // -- appendRow() tidak memberi kesempatan set format sebelum tulis,
        // jadi di sini ditulis batch via setValues() setelah format diset.
        sheetProcessed.getRange(lastRowProcessed + 1, 3, barisProcessedBaru.length, 1).setNumberFormat("@");
        sheetProcessed.getRange(lastRowProcessed + 1, 1, barisProcessedBaru.length, 3).setValues(barisProcessedBaru);
      }
    }
    _invalidateWalletCache();

    return { status: "Sukses", notaIdServerMap: notaIdServerMap };
  } catch (e) {
    return "Error: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}

// Memotong stok bahan baku untuk BANYAK bahan sekaligus dalam satu kali
// baca dan satu kali tulis, bukan satu kali baca+tulis per item keranjang.
// Ini jauh lebih cepat dan jauh lebih tidak rentan gagal di tengah jalan
// dibanding memanggil getRange()/setValue() berulang kali dalam loop.
function potongStokBahanBakuKasirBatch(ss, deduksiMap) {
  var sheetStok = ss.getSheetByName("Stok Barang");
  if (!sheetStok) return;
  var lastRow = sheetStok.getLastRow();
  if (lastRow < 2) return;

  var range = sheetStok.getRange(2, 1, lastRow - 1, 2);
  var data = range.getValues();
  var adaPerubahan = false;

  for (var i = 0; i < data.length; i++) {
    var namaBarang = data[i][0] ? data[i][0].toString().trim().toLowerCase() : "";
    if (namaBarang !== "" && deduksiMap.hasOwnProperty(namaBarang)) {
      var stokLama = Number(data[i][1]) || 0;
      data[i][1] = Math.max(0, stokLama - deduksiMap[namaBarang]);
      adaPerubahan = true;
    }
  }

  if (adaPerubahan) {
    range.setValues(data);
  }
}

// Sesuaikan (tambah/kurang) stok SATU barang di sheet "Stok Barang"
// berdasarkan nama (case-insensitive). delta boleh positif (nambah) atau
// negatif (mengurangi, hasil akhirnya di-clamp ke 0 -- tidak pernah minus).
// Kalau nama barang belum ada barisnya, baris baru otomatis dibuat.
//
// Ini "angka berjalan" (running value): dipanggil LANGSUNG di titik
// kejadian (goreng, jual, waste, void, masuk) supaya stok ayam
// mentah/matang tidak perlu lagi dihitung ulang dengan menjumlah SELURUH
// riwayat Log_Stok_Ayam tiap kali mau tahu sisa stok (lihat
// ambilInfoStokAyam()) -- Log_Stok_Ayam jadi murni catatan riwayat
// aktivitas dapur, bukan sumber hitung-menghitung stok saat ini lagi.
function sesuaikanStokBarang(ss, namaBarang, delta) {
  var sheetStok = ss.getSheetByName("Stok Barang");
  if (!sheetStok) return;
  var namaLower = namaBarang.toString().trim().toLowerCase();
  var lastRow = getRealLastRow(sheetStok);

  if (lastRow >= 2) {
    var data = sheetStok.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < data.length; i++) {
      var namaBaris = data[i][0] ? data[i][0].toString().trim().toLowerCase() : "";
      if (namaBaris === namaLower) {
        var stokLama = Number(data[i][1]) || 0;
        sheetStok.getRange(i + 2, 2).setValue(Math.max(0, stokLama + delta));
        return;
      }
    }
  }
  // Barang belum pernah ada -- buat baris baru.
  sheetStok.appendRow([namaBarang, Math.max(0, delta)]);
}

function catatOpnameBarang(namaBarang, stokSistem, stokFisik, selisih) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetDraft = ss.getSheetByName("Draft_Opname");
    if (!sheetDraft) {
      sheetDraft = ss.insertSheet("Draft_Opname");
      sheetDraft.appendRow(["ID Draft", "Tanggal Pengajuan", "Nama Barang", "Stok Sistem", "Stok Fisik Kasir", "Selisih", "Status Approval"]);
    }
    var idDraft = "DF-" + new Date().getTime();
    sheetDraft.appendRow([idDraft, new Date(), namaBarang, stokSistem, stokFisik, selisih, "PENDING"]);
    return "Sukses";
  } catch(e) { return e.toString(); } finally { lock.releaseLock(); }
}

function ambilDraftOpnamePending() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetDraft = ss.getSheetByName("Draft_Opname");
    if (!sheetDraft) return [];
    var lastRow = sheetDraft.getLastRow();
    if (lastRow < 2) return [];
    var data = sheetDraft.getRange(2, 1, lastRow - 1, 7).getValues();
    var listPending = [];
    data.forEach(function(row, index) {
      if (row[6] === "PENDING") {
        listPending.push({
          rowNum: index + 2,
          id: row[0],
          nama: row[2],
          sistem: Number(row[3]) || 0,
          fisik: Number(row[4]) || 0,
          selisih: Number(row[5]) || 0
        });
      }
    });
    return listPending;
  } catch(e) { return []; }
}

function eksekusiApproveDraftOwner(rowNum, namaBarang, stokFisik) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetDraft = ss.getSheetByName("Draft_Opname");
    if(sheetDraft) { sheetDraft.getRange(rowNum, 7).setValue("APPROVED"); }
    var sheetStok = ss.getSheetByName("Stok Barang");
    if (sheetStok) {
      var lastRowStok = sheetStok.getLastRow();
      var dataStok = sheetStok.getRange(2, 1, lastRowStok - 1, 2).getValues();
      for (var i = 0; i < dataStok.length; i++) {
        if (dataStok[i][0].toString().trim() === namaBarang.toString().trim()) {
          sheetStok.getRange(i + 2, 2).setValue(stokFisik);
          break;
        }
      }
    }
    var sheetLog = ss.getSheetByName("Log_Opname");
    if (sheetLog) { sheetLog.appendRow([new Date(), namaBarang + " (Approved Owner)", "", stokFisik, ""]); }
    return "Sukses";
  } catch(e) { return e.toString(); } finally { lock.releaseLock(); }
}

// Baca stok TERKINI langsung dari angka berjalan di sheet "Stok Barang" --
// BUKAN lagi menjumlah seluruh riwayat Log_Stok_Ayam tiap kali dipanggil
// (dulu begitu, jadi makin lambat seiring log makin panjang). Angka
// berjalan ini di-update di titik kejadian oleh sesuaikanStokBarang()
// (lihat simpanData, simpanLogOperasional, batalkanTransaksiTerakhir).
function ambilInfoStokAyam() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetStok = ss.getSheetByName("Stok Barang");
    var stokFreezer = 0;
    var stokEtalase = 0;
    var stokMinyak = 0;
    if (sheetStok && sheetStok.getLastRow() > 1) {
      var dataBarang = sheetStok.getRange(2, 1, sheetStok.getLastRow() - 1, 2).getValues();
      for (var i = 0; i < dataBarang.length; i++) {
        var namaBaris = dataBarang[i][0] ? dataBarang[i][0].toString().trim().toLowerCase() : "";
        if (namaBaris === "ayam mentah (freezer)") {
          stokFreezer = Number(dataBarang[i][1]) || 0;
        } else if (namaBaris === "ayam matang (etalase)") {
          stokEtalase = Number(dataBarang[i][1]) || 0;
        } else if (namaBaris === "minyak goreng") {
          stokMinyak = Number(dataBarang[i][1]) || 0;
        }
      }
    }
    return { stokMentah: Math.max(0, stokFreezer), stokEtalase: Math.max(0, stokEtalase), stokMinyakBaku: stokMinyak };
  } catch(e) { return { stokMentah: 0, stokEtalase: 0, stokMinyakBaku: 0 }; }
}

function simpanLogOperasional(logData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetLogStok = ss.getSheetByName("Log_Stok_Ayam");
    if (!sheetLogStok) return "Error: Tab Log_Stok_Ayam tidak ditemukan!";
    // TIMESTAMP SOURCE OF TRUTH: waktu SERVER saat fungsi ini dieksekusi di GAS,
    // bukan parsing string logData.tgl dari klien yang formatnya bisa ambigu
    // (toLocaleString beda device/locale, rentan salah hari/bulan). Client
    // timestamp tetap boleh dikirim sebagai info tambahan tapi kolom A wajib
    // pakai waktu server agar audit "jam berapa?" akurat dan konsisten
    // (Asia/Jakarta).
    var waktuAktivitas = new Date();
    var qty = Math.abs(Number(logData.qty));

    // PENTING: Log_Stok_Ayam sekarang murni CATATAN RIWAYAT aktivitas dapur
    // (dipakai buat rekap per hari di dashboard) -- angka stok saat ini
    // (Ayam Mentah/Matang di sheet "Stok Barang") di-update LANGSUNG lewat
    // sesuaikanStokBarang() di titik kejadian, bukan dihitung ulang dengan
    // menjumlah log ini (lihat ambilInfoStokAyam()).
    if (logData.jenisAktivitas === "Ayam Masuk") {
      sheetLogStok.appendRow([waktuAktivitas, "Ayam Masuk", "Freezer", qty, logData.keterangan || "Masuk dari Supplier"]);
      // Pastikan kolom A tampil dengan jam (bukan hanya tanggal) — format datetime eksplisit
      try { sheetLogStok.getRange(sheetLogStok.getLastRow(), 1).setNumberFormat("dd/MM/yyyy HH:mm:ss"); } catch(eFmt) {}
      sesuaikanStokBarang(ss, "Ayam Mentah (Freezer)", qty);
    } else if (logData.jenisAktivitas === "Goreng Ayam") {
      sheetLogStok.appendRow([waktuAktivitas, "Goreng Ayam (Ambil Mentah)", "Freezer", -qty, logData.keterangan || "Diambil untuk dimasak"]);
      try { sheetLogStok.getRange(sheetLogStok.getLastRow(), 1).setNumberFormat("dd/MM/yyyy HH:mm:ss"); } catch(eFmt2) {}
      sheetLogStok.appendRow([waktuAktivitas, "Goreng Ayam (Matang)", "Etalase", qty, logData.keterangan || "Selesai digoreng"]);
      try { sheetLogStok.getRange(sheetLogStok.getLastRow(), 1).setNumberFormat("dd/MM/yyyy HH:mm:ss"); } catch(eFmt3) {}
      sesuaikanStokBarang(ss, "Ayam Mentah (Freezer)", -qty);
      sesuaikanStokBarang(ss, "Ayam Matang (Etalase)", qty);

      var qtyMinyak = Number(logData.minyakUsed) || 0;
      if (qtyMinyak > 0) {
        // Pemakaian minyak sekarang JUGA dicatat sebagai baris log (dulu
        // cuma langsung mengurangi angka stok tanpa jejak riwayat sama
        // sekali) -- supaya bisa direkap per hari di dashboard, sama
        // seperti ayam.
        sheetLogStok.appendRow([waktuAktivitas, "Pemakaian Minyak", "Minyak", -qtyMinyak, logData.keterangan || "Dipakai saat menggoreng"]);
        try { sheetLogStok.getRange(sheetLogStok.getLastRow(), 1).setNumberFormat("dd/MM/yyyy HH:mm:ss"); } catch(eFmt4) {}
        sesuaikanStokBarang(ss, "Minyak Goreng", -qtyMinyak);
      }
    } else if (logData.jenisAktivitas === "Ayam Waste") {
      sheetLogStok.appendRow([waktuAktivitas, "Ayam Rusak / Waste", "Etalase", -qty, logData.keterangan || "Waste Dapur"]);
      try { sheetLogStok.getRange(sheetLogStok.getLastRow(), 1).setNumberFormat("dd/MM/yyyy HH:mm:ss"); } catch(eFmt5) {}
      sesuaikanStokBarang(ss, "Ayam Matang (Etalase)", -qty);
    }
    return "Sukses";
  } catch(e) { return e.toString(); } finally { lock.releaseLock(); }
}

function ambilStokBarang() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Stok Barang");
    var lastRow = getRealLastRow(sheet);
    if (lastRow < 2) return [];
    return sheet.getRange(2, 1, lastRow - 1, 2).getValues().map(function(r) {
      return { nama: r[0].toString().trim(), stok: Number(r[1]) || 0 };
    });
  } catch(e) { return []; }
}

function simpanPengeluaranToko(logData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Pengeluaran");
    var sheetProcessed = ss.getSheetByName("Processed_Request");
    // Idempotency WAJIB untuk Setoran Owner (dan semua kas jika ada clientTxnId) — cegah duplicate saat retry/timeout
    if (logData.clientTxnId && sheetProcessed) {
      var lastRowReq = sheetProcessed.getLastRow();
      if (lastRowReq > 1) {
        var dataProcessed = sheetProcessed.getRange(2, 1, lastRowReq - 1, 1).getValues();
        for (var r = 0; r < dataProcessed.length; r++) {
          if (dataProcessed[r][0] && dataProcessed[r][0].toString() === logData.clientTxnId.toString()) {
            return "Sukses (sudah pernah diproses)";
          }
        }
      }
    }
    // Server timestamp sebagai source of truth untuk kolom A — jangan parsing logData.tgl client yang ambigu
    var waktuServer = new Date();
    // F = Metode (Cash Toko / Non-Cash), default Cash Toko
    var metodeVal = (logData.metodeKas || logData.metode || "Cash Toko").toString().trim() || "Cash Toko";
    // Pastikan header memiliki kolom F jika sheet lama belum ada
    try{
      if(sheet.getLastColumn() < 6){
        var h = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
        if(h.length < 6) sheet.getRange(1,6).setValue("Metode");
      }
    }catch(eH){}
    sheet.appendRow([waktuServer, logData.jenisKas, logData.namaItem, logData.nominal, logData.keterangan, metodeVal]);
    try { sheet.getRange(sheet.getLastRow(), 1).setNumberFormat("dd/MM/yyyy HH:mm:ss"); } catch(eFmt) {}
    // Tandai clientTxnId sebagai sudah diproses setelah tulis berhasil (untuk Setoran Owner idempotency)
    if (logData.clientTxnId && sheetProcessed) {
      try {
        var lastRowP = getRealLastRow(sheetProcessed);
        sheetProcessed.getRange(lastRowP + 1, 3, 1, 1).setNumberFormat("@");
        sheetProcessed.getRange(lastRowP + 1, 1, 1, 3).setValues([[logData.clientTxnId, new Date(), Utilities.formatDate(waktuServer, "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss")]]);
      } catch(eP) { console.log("Gagal catat Processed_Request kas: " + eP.toString()); }
    }
    // Invalidate wallet cache untuk semua jenis yang mempengaruhi wallet
    if(logData.jenisKas==="Saldo Awal Wallet" || logData.jenisKas==="Adjustment Wallet" || logData.jenisKas==="Belanja Operasional" || logData.jenisKas==="Operasional" || logData.jenisKas==="Tarik Tunai" || logData.jenisKas==="Setoran Owner"){
      var metodeCheck = metodeVal || "Cash Toko";
      if(logData.jenisKas==="Belanja Operasional" || logData.jenisKas==="Operasional"){
        if(metodeCheck==="Cash Toko" || metodeCheck==="") _invalidateWalletCache();
      } else {
        _invalidateWalletCache();
      }
    }
    return "Sukses";
  } catch(e) { return e.toString(); } finally { lock.releaseLock(); }
}

function simpanLaporanTutupTokoGSheet(rekapData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Laporan Tutup Toko");
    if(!sheet){
      sheet = ss.insertSheet("Laporan Tutup Toko");
      sheet.appendRow(["Tanggal","Modal Laci","Cash Ayam","QRIS Ayam","Cash Mamah","QRIS Mamah","Belanja","Tarik Tunai","Wajib Cash","Setoran Owner","Cash Fisik Sebelum","Target Setoran","Belum Disetor","Sisa Cash","Cash Awal Hari","Cash Real","Selisih","Status","Keterangan Selisih","Timestamp Tutup","ClientTxnId"]);
    } else {
      // Expand header ke 21 kolom jika lama 14
      if(sheet.getLastColumn() < 21){
        var header = ["Tanggal","Modal Laci","Cash Ayam","QRIS Ayam","Cash Mamah","QRIS Mamah","Belanja","Tarik Tunai","Wajib Cash","Setoran Owner","Cash Fisik Sebelum","Target Setoran","Belum Disetor","Sisa Cash","Cash Awal Hari","Cash Real","Selisih","Status","Keterangan Selisih","Timestamp Tutup","ClientTxnId"];
        sheet.getRange(1,1,1,header.length).setValues([header]);
      }
    }
    var parts = rekapData.tanggal.split('/');
    var tanggalMurni = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    var setoranOwner = Number(rekapData.setoranOwner) || 0;
    var cashFisik = Number(rekapData.cashFisikSebelumSetoran) || 0;
    var targetSetoran = Number(rekapData.targetSetoran) || 0;
    var belumDisetor = Number(rekapData.belumDisetor) || 0;
    var sisaCash = Number(rekapData.sisaCashDiLaci) || Number(rekapData.wajibCashLaci) || 0;
    var cashAwalHari = (rekapData.cashAwalHari === null || rekapData.cashAwalHari === undefined || rekapData.cashAwalHari === "") ? "" : Number(rekapData.cashAwalHari);
    var cashReal = (rekapData.cashReal === null || rekapData.cashReal === undefined || rekapData.cashReal === "") ? "" : Number(rekapData.cashReal);
    var selisih = (rekapData.selisih === null || rekapData.selisih === undefined || rekapData.selisih === "") ? "" : Number(rekapData.selisih);
    var status = rekapData.status ? rekapData.status.toString() : "";
    var keterangan = rekapData.keteranganSelisih ? rekapData.keteranganSelisih.toString() : "";
    var timestampTutup = rekapData.timestampTutup ? new Date(rekapData.timestampTutup) : new Date();
    var clientTxnId = rekapData.clientTxnId ? rekapData.clientTxnId.toString() : "";
    sheet.appendRow([tanggalMurni, rekapData.modalAwal, rekapData.cashAyam, rekapData.qrisAyam, rekapData.cashMamah, rekapData.qrisMamah, rekapData.belanja, rekapData.tarikTunai, rekapData.wajibCashLaci, setoranOwner, cashFisik, targetSetoran, belumDisetor, sisaCash, cashAwalHari, cashReal, selisih, status, keterangan, timestampTutup, clientTxnId]);
    try{ sheet.getRange(sheet.getLastRow(),1).setNumberFormat("dd/MM/yyyy"); }catch(e){}
    try{ sheet.getRange(sheet.getLastRow(),20).setNumberFormat("dd/MM/yyyy HH:mm:ss"); }catch(e){}
    _invalidateWalletCache();
    return "Sukses Kirim Laporan ke GSheet!";
  } catch(e) { return "Error: " + e.toString(); } finally { lock.releaseLock(); }
}

// ============================================================
//  LAPORAN OTOMATIS — AUTO SNAPSHOT 23:59
//  Jika tutup toko belum dilakukan manual sampai 23:59, buat snapshot
//  otomatis agar Laporan Tutup Toko tidak bolong. Snapshot tidak
//  mempengaruhi Wallet (hanya laporan), status BELUM REKONSILIASI.
// ============================================================
function _laporanExistsForDate(tanggalObj){
  try{
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Laporan Tutup Toko");
    if(!sheet) return false;
    var target = new Date(tanggalObj.getFullYear(), tanggalObj.getMonth(), tanggalObj.getDate());
    var lastRow = getRealLastRow(sheet);
    if(lastRow < 2) return false;
    var data = sheet.getRange(2,1,lastRow-1,1).getValues();
    for(var i=0;i<data.length;i++){
      var d = data[i][0];
      if(d instanceof Date){
        if(d.getDate()===target.getDate() && d.getMonth()===target.getMonth() && d.getFullYear()===target.getFullYear()) return true;
      } else if(d){
        try{
          var p = d.toString().split('/');
          if(parseInt(p[0],10)===target.getDate() && parseInt(p[1],10)===(target.getMonth()+1) && parseInt(p[2],10)===target.getFullYear()) return true;
        }catch(e){}
      }
    }
  }catch(e){}
  return false;
}
function generateDailyReportIfMissing(tanggalObj){
  var lock = LockService.getScriptLock();
  try{
    lock.waitLock(15000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Laporan Tutup Toko");
    if(!sheet){
      sheet = ss.insertSheet("Laporan Tutup Toko");
      sheet.appendRow(["Tanggal","Modal Laci","Cash Ayam","QRIS Ayam","Cash Mamah","QRIS Mamah","Belanja","Tarik Tunai","Wajib Cash","Setoran Owner","Cash Fisik Sebelum","Target Setoran","Belum Disetor","Sisa Cash","Cash Awal Hari","Cash Real","Selisih","Status","Keterangan Selisih","Timestamp Tutup","ClientTxnId"]);
    } else if(sheet.getLastColumn() < 21){
      sheet.getRange(1,1,1,21).setValues([["Tanggal","Modal Laci","Cash Ayam","QRIS Ayam","Cash Mamah","QRIS Mamah","Belanja","Tarik Tunai","Wajib Cash","Setoran Owner","Cash Fisik Sebelum","Target Setoran","Belum Disetor","Sisa Cash","Cash Awal Hari","Cash Real","Selisih","Status","Keterangan Selisih","Timestamp Tutup","ClientTxnId"]]);
    }
    var target = tanggalObj instanceof Date ? new Date(tanggalObj.getFullYear(), tanggalObj.getMonth(), tanggalObj.getDate()) : new Date();
    target = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    if(_laporanExistsForDate(target)) return "Sudah ada laporan untuk "+Utilities.formatDate(target,"Asia/Jakarta","dd/MM/yyyy");
    var autoId = "AUTO-"+Utilities.formatDate(target,"Asia/Jakarta","yyyyMMdd");
    // Cek Processed_Request agar tidak duplikat
    var shP = ss.getSheetByName("Processed_Request");
    if(shP && shP.getLastRow()>1){
      var vals = shP.getRange(2,1,shP.getLastRow()-1,1).getValues();
      for(var i=0;i<vals.length;i++) if(vals[i][0] && vals[i][0].toString()===autoId) return "Sudah ada (Processed_Request)";
    }
    // Snapshot kosong: semua 0, status BELUM REKONSILIASI, tidak ada cashReal
    sheet.appendRow([target, 0,0,0,0,0,0,0,0,0,0,0,0,0, "", "", "", "BELUM REKONSILIASI", "Auto snapshot 23:59", new Date(), autoId]);
    try{ sheet.getRange(sheet.getLastRow(),1).setNumberFormat("dd/MM/yyyy"); }catch(e){}
    try{ sheet.getRange(sheet.getLastRow(),20).setNumberFormat("dd/MM/yyyy HH:mm:ss"); }catch(e){}
    if(shP){
      try{
        var lr = getRealLastRow(shP);
        shP.getRange(lr+1,3,1,1).setNumberFormat("@");
        shP.getRange(lr+1,1,1,3).setValues([[autoId, new Date(), Utilities.formatDate(target,"Asia/Jakarta","dd/MM/yyyy")]]);
      }catch(e){}
    }
    _invalidateWalletCache();
    return "Auto snapshot dibuat untuk "+Utilities.formatDate(target,"Asia/Jakarta","dd/MM/yyyy");
  }catch(e){ return "Error: "+e.toString(); }finally{ lock.releaseLock(); }
}
function morningCatchUp(){
  var yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  yesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  return generateDailyReportIfMissing(yesterday);
}
function autoSnapshotTrigger(){
  return generateDailyReportIfMissing(new Date());
}
function installDailyTrigger(){
  try{
    var triggers = ScriptApp.getProjectTriggers();
    for(var i=0;i<triggers.length;i++) if(triggers[i].getHandlerFunction()==="autoSnapshotTrigger") ScriptApp.deleteTrigger(triggers[i]);
    ScriptApp.newTrigger("autoSnapshotTrigger").timeBased().atHour(23).nearMinute(59).everyDays(1).inTimezone("Asia/Jakarta").create();
    return "Trigger 23:59 terpasang";
  }catch(e){ return "Error: "+e.toString(); }
}

function batalkanTransaksiTerakhir(pinInput, targetNotaId) {
  var PIN_VOID = "1234"; // PIN khusus void -- SENGAJA beda dari PIN Owner (lihat arsipkanTahunTransaksi)
  if (pinInput !== PIN_VOID) return "Gagal: PIN Admin Salah!";
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var targetWaktuTerakhir = (targetNotaId || "").toString().trim();
    var totalItemVoid = 0;
    var adaBarisCocok = false; // ada baris yang cocok dengan targetWaktuTerakhir sama sekali (OK maupun sudah VOID) -- dipakai membedakan pesan "tidak ketemu" vs "memang sudah VOID"
    var sheetAyam = ss.getSheetByName("Transaksi");
    var lastRowAyam = getRealLastRow(sheetAyam);
    var sheetMamah = ss.getSheetByName("Transaksi Mamah");
    var lastRowMamah = getRealLastRow(sheetMamah);

    // Fallback lama (kompatibilitas): kalau klien tidak mengirim nota target
    // spesifik, tetap ambil baris terakhir di sheet seperti perilaku sebelumnya.
    if (targetWaktuTerakhir === "") {
      if (lastRowAyam >= 2) {
        targetWaktuTerakhir = _formatNilaiTglSheet(sheetAyam.getRange(lastRowAyam, 1).getValue());
      }
      if (lastRowMamah >= 2 && targetWaktuTerakhir === "") {
        targetWaktuTerakhir = _formatNilaiTglSheet(sheetMamah.getRange(lastRowMamah, 1).getValue());
      }
    }

    if (targetWaktuTerakhir === "") {
      return "Peringatan: Tidak ada data transaksi yang dapat ditemukan.";
    }

    if (lastRowAyam >= 2) {
      var dataAyam = sheetAyam.getRange(2, 1, lastRowAyam - 1, 10).getValues();
      for (var i = dataAyam.length - 1; i >= 0; i--) {
        if (_formatNilaiTglSheet(dataAyam[i][0]) === targetWaktuTerakhir) {
          adaBarisCocok = true;
        }
        if (_formatNilaiTglSheet(dataAyam[i][0]) === targetWaktuTerakhir && dataAyam[i][9] !== "VOID") {
          var rNum = i + 2;
          var namaItem = dataAyam[i][1].toString();
          var qtyLama = Number(dataAyam[i][2]) || 0;

          sheetAyam.getRange(rNum, 10).setValue("VOID");
          sheetAyam.getRange(rNum, 3).setValue(0);
          totalItemVoid++;
          if (qtyLama > 0 && (namaItem.toLowerCase().indexOf("ayam") !== -1 || namaItem.toLowerCase().indexOf("geprek") !== -1)) {
            // Void mengembalikan item ke stok -- kembalikan juga angka
            // berjalan "Ayam Matang (Etalase)" (kebalikan dari pengurangan
            // saat penjualan di simpanData()), bukan lagi dicatat sebagai
            // baris riwayat baru di Log_Stok_Ayam.
            try {
              sesuaikanStokBarang(ss, "Ayam Matang (Etalase)", Math.abs(qtyLama));
            } catch (errStokVoid) {
              console.log("Gagal sesuaikan stok Ayam Matang saat void (void tetap tersimpan): " + errStokVoid.toString());
            }
          }
        }
      }
    }

    if (lastRowMamah >= 2) {
      var dataMamah = sheetMamah.getRange(2, 1, lastRowMamah - 1, 10).getValues();
      for (var j = dataMamah.length - 1; j >= 0; j--) {
        if (_formatNilaiTglSheet(dataMamah[j][0]) === targetWaktuTerakhir) {
          adaBarisCocok = true;
        }
        if (_formatNilaiTglSheet(dataMamah[j][0]) === targetWaktuTerakhir && dataMamah[j][9] !== "VOID") {
          var rNumM = j + 2;
          sheetMamah.getRange(rNumM, 10).setValue("VOID");
          sheetMamah.getRange(rNumM, 3).setValue(0);
          totalItemVoid++;
        }
      }
    }

    if (totalItemVoid === 0) {
      if (!adaBarisCocok) {
        return "Peringatan: Nota tidak ditemukan di sheet (targetNotaId '" + targetWaktuTerakhir + "' tidak cocok baris manapun).";
      }
      return "Peringatan: Struk transaksi terakhir sudah berstatus VOID sebelumnya.";
    }
    _invalidateWalletCache();
    return "Sukses! 1 Struk Belanja Penuh Berhasil Di-VOID (Total: " + totalItemVoid + " Item Produk).";
  } catch(e) { return "Error: " + e.toString(); } finally { lock.releaseLock(); }
}

function uploadGambarMenu(base64Str, fileName, itemName) {
  try {
    var splitData = base64Str.split(',');
    var contentType = splitData[0].match(/:(.*?);/)[1];
    var rawBase64 = splitData[1];
    var byteCharacters = Utilities.base64Decode(rawBase64);
    var blob = Utilities.newBlob(byteCharacters, contentType, "produk_" + itemName + "_" + fileName);
    var file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var targetImageUrl = "https://lh3.googleusercontent.com/d/" + file.getId();

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetMenu = ss.getSheetByName("Kasir");
    var dataRange = sheetMenu.getDataRange().getValues();
    var ditemukan = false;

    for (var i = 1; i < dataRange.length; i++) {
      if (dataRange[i][1].toString().toLowerCase() === itemName.toLowerCase()) {
        sheetMenu.getRange(i + 1, 6).setValue(targetImageUrl);
        ditemukan = true;
        break;
      }
    }

    if (ditemukan) {
      return { status: "Sukses", url: targetImageUrl };
    } else {
      return { status: "Gagal", error: "Item menu tidak ditemukan di database sheet Kasir." };
    }
  } catch (err) {
    return { status: "Gagal", error: err.toString() };
  }
}

// ============================================================
//  DASHBOARD OWNER — fungsi READ-ONLY murni.
//  SENGAJA TIDAK memakai LockService di sini: dashboard hanya boleh
//  membaca data, tidak pernah menulis, jadi tidak ada alasan untuk
//  ikut mengantre lock dengan proses checkout kasir yang sedang jalan.
// ============================================================

var NAMA_BULAN_INDO = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

// Kembalikan nama tab Transaksi yang benar untuk tahun tertentu.
// Tahun berjalan -> "Transaksi" (tab aktif). Tahun lampau yang sudah
// diarsipkan -> "Transaksi_<tahun>". Dipakai supaya dashboard tetap bisa
// menampilkan rekap tahun-tahun sebelumnya walau tabnya sudah di-rename
// oleh arsipkanTahunTransaksi().
function namaSheetTransaksiUntukTahun(tahun) {
  var tahunSekarang = new Date().getFullYear();
  var tahunNum = parseInt(tahun, 10);
  return (tahunNum === tahunSekarang) ? "Transaksi" : ("Transaksi_" + tahunNum);
}

// Sama seperti namaSheetTransaksiUntukTahun() tapi untuk sheet "Transaksi
// Mamah" (arsipkanTahunTransaksi() menamai arsipnya "Transaksi Mamah_<tahun>").
function namaSheetMamahUntukTahun(tahun) {
  var tahunSekarang = new Date().getFullYear();
  var tahunNum = parseInt(tahun, 10);
  return (tahunNum === tahunSekarang) ? "Transaksi Mamah" : ("Transaksi Mamah_" + tahunNum);
}

// Parse string tanggal format "dd/MM/yyyy HH:mm:ss" (format yang dipakai
// simpanData()) menjadi { tanggal, bulan, tahun } angka murni.
function _parseTglNota(tglStrAtauDate) {
  var tglBersih = _formatNilaiTglSheet(tglStrAtauDate).split(',')[0].trim();
  var bagianTgl = tglBersih.split(' ')[0].split('/');
  return {
    tanggal: parseInt(bagianTgl[0], 10),
    bulan: parseInt(bagianTgl[1], 10),
    tahun: parseInt(bagianTgl[2], 10)
  };
}

function _itemAdalahAyam(namaItem, cat1) {
  var n = (namaItem || "").toString().toLowerCase();
  var c = (cat1 || "").toString().toLowerCase();
  return n.indexOf("ayam") !== -1 || n.indexOf("geprek") !== -1 || c.indexOf("ayam") !== -1 || c.indexOf("geprek") !== -1;
}
const PORSI_NASI_PER_LITER = 13;
function _isNasi(namaItem, cat1) {
  var n = (namaItem || "").toString().toLowerCase();
  return n.indexOf("paket") !== -1 || n.indexOf("nasi") !== -1;
}

// Total pengeluaran toko dalam satu periode. filterFn(tglDate) -> boolean.
// FIX #2: hanya hitung Belanja Operasional/Operasional dengan Metode Cash Toko
// (kolom F). Sebelumnya menjumlah SEMUA jenis (Saldo Awal, Setoran, Adjustment)
// sehingga incomeKotor = grandTotal - totalPengeluaran jadi defisit palsu.
// Sekarang mirror logic getWalletSaldo() untuk konsistensi dashboard vs wallet.
function _totalPengeluaranPeriode(ss, filterFn) {
  var sheet = ss.getSheetByName("Pengeluaran");
  var total = 0;
  var lastRow = getRealLastRow(sheet);
  if (!sheet || lastRow < 2) return total;
  var data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  data.forEach(function(row) {
    var tglRow = row[0];
    if (!(tglRow instanceof Date) || !filterFn(tglRow)) return;
    var jenis = row[1] ? row[1].toString().trim() : "";
    var nominal = Number(row[3]) || 0;
    var metode = row[5] ? row[5].toString().trim() : "";
    var isCash = (metode === "" || metode === "Cash Toko");
    var isBelanja = (jenis === "Belanja Operasional" || jenis === "Operasional");
    var isTarik = (jenis === "Tarik Tunai");
    if ((isBelanja || isTarik) && isCash) total += nominal;
  });
  return total;
}

// Baca seluruh baris "Transaksi" (Ayam) yang OK, dikelompokkan per NOTA
// (baris-baris dengan timestamp/tgl yang sama = satu struk/keranjang yang
// sama, karena diskonNilai/diskonTipe/metode dibagi sama rata oleh
// simpanData() untuk semua item dalam satu keranjang). Pengelompokan ini
// penting supaya diskon per-struk tidak terhitung berkali-kali per item.
function _kumpulkanNotaTransaksi(sheet, filterBulanTahunFn) {
  var lastRow = getRealLastRow(sheet);
  var notaMap = {}; // key: tgl string -> { rawTotal, diskonNilai, diskonTipe, metode, tanggal, bulan, tahun }
  var ayamQtyPerHari = {}; // key: "tahun-bulan-tanggal" -> qty
  var ayamTotalQty = 0;
  var nasiQtyPerHari = {};
  var nasiTotalQty = 0;

  if (!sheet || lastRow < 2) return { notaMap: notaMap, ayamQtyPerHari: ayamQtyPerHari, ayamTotalQty: ayamTotalQty, nasiQtyPerHari: nasiQtyPerHari, nasiTotalQty: nasiTotalQty };

  var data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  data.forEach(function(row) {
    var status = row[9];
    if (status === "VOID") return;
    var tglStr = row[0] ? _formatNilaiTglSheet(row[0]) : "";
    if (tglStr === "") return;

    var p;
    try { p = _parseTglNota(tglStr); } catch (errP) { return; }
    if (!filterBulanTahunFn(p)) return;

    var namaItem = row[1] ? row[1].toString() : "";
    var qty = Number(row[2]) || 0;
    var metode = row[3] || "Cash";
    var harga = Number(row[4]) || 0;
    var cat1 = row[5] || "";
    var diskonNilai = Number(row[7]) || 0;
    var diskonTipe = row[8] || "Rp";
    var subtotalRow = qty * harga;

    if (!notaMap[tglStr]) {
      notaMap[tglStr] = { rawTotal: 0, diskonNilai: diskonNilai, diskonTipe: diskonTipe, metode: metode, tanggal: p.tanggal, bulan: p.bulan, tahun: p.tahun };
    }
    notaMap[tglStr].rawTotal += subtotalRow;

    if (_itemAdalahAyam(namaItem, cat1)) {
      ayamTotalQty += qty;
      var keyHari = p.tahun + "-" + p.bulan + "-" + p.tanggal;
      ayamQtyPerHari[keyHari] = (ayamQtyPerHari[keyHari] || 0) + qty;
    }
    if (_isNasi(namaItem, cat1)) {
      nasiTotalQty += qty;
      var keyHariNasi = p.tahun + "-" + p.bulan + "-" + p.tanggal;
      nasiQtyPerHari[keyHariNasi] = (nasiQtyPerHari[keyHariNasi] || 0) + qty;
    }
  });

  return { notaMap: notaMap, ayamQtyPerHari: ayamQtyPerHari, ayamTotalQty: ayamTotalQty, nasiQtyPerHari: nasiQtyPerHari, nasiTotalQty: nasiTotalQty };
}

function _nettNota(nota) {
  var potongan = (nota.diskonTipe === "%") ? Math.round(nota.rawTotal * (nota.diskonNilai / 100)) : nota.diskonNilai;
  return Math.max(0, nota.rawTotal - potongan);
}

// Rekap HARIAN dalam 1 bulan (dipakai mode "Harian" di dashboard).
function ambilRekapHarian(bulan, tahun) {
  try {
    var bulanNum = parseInt(bulan, 10);
    var tahunNum = parseInt(tahun, 10);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var namaSheet = namaSheetTransaksiUntukTahun(tahunNum);
    var sheet = ss.getSheetByName(namaSheet);

    var hasilKumpul = _kumpulkanNotaTransaksi(sheet, function(p) {
      return p.bulan === bulanNum && p.tahun === tahunNum;
    });

    var jumlahHariDalamBulan = new Date(tahunNum, bulanNum, 0).getDate();
    var totalPerHari = {}; // tanggal -> nett
    var metodeMap = {};    // metode -> { nilai, jumlah }
    var grandTotal = 0;
    var hariSet = {};

    Object.keys(hasilKumpul.notaMap).forEach(function(key) {
      var nota = hasilKumpul.notaMap[key];
      var nett = _nettNota(nota);
      grandTotal += nett;
      totalPerHari[nota.tanggal] = (totalPerHari[nota.tanggal] || 0) + nett;
      hariSet[nota.tanggal] = true;

      if (!metodeMap[nota.metode]) metodeMap[nota.metode] = { nilai: 0, jumlah: 0 };
      metodeMap[nota.metode].nilai += nett;
      metodeMap[nota.metode].jumlah += 1;
    });

    var jumlahHariAdaTransaksi = Object.keys(hariSet).length;
    var totalPengeluaran = _totalPengeluaranPeriode(ss, function(tglDate) {
      return (tglDate.getMonth() + 1) === bulanNum && tglDate.getFullYear() === tahunNum;
    });

    var chartLabels = [];
    var chartValues = [];
    for (var d = 1; d <= jumlahHariDalamBulan; d++) {
      chartLabels.push(String(d));
      chartValues.push(Math.round(totalPerHari[d] || 0));
    }
    // chartAyam 1..akhir bulan
    var chartAyamValues = [];
    for (var d2 = 1; d2 <= jumlahHariDalamBulan; d2++) {
      var keyAyam = tahunNum + "-" + bulanNum + "-" + d2;
      chartAyamValues.push(hasilKumpul.ayamQtyPerHari[keyAyam] || 0);
    }

    var metodeArr = Object.keys(metodeMap).map(function(k) {
      return { label: k, nilai: Math.round(metodeMap[k].nilai), jumlah: metodeMap[k].jumlah };
    }).sort(function(a, b) { return b.nilai - a.nilai; });
    var totalCash = 0;
    Object.keys(metodeMap).forEach(function(k){ if(k.toLowerCase()==="cash") totalCash = Math.round(metodeMap[k].nilai); });

    return {
      status: "ok",
      mode: "harian",
      periodeLabel: NAMA_BULAN_INDO[bulanNum - 1] + " " + tahunNum,
      grandTotal: Math.round(grandTotal),
      totalCash: totalCash,
      rataRataPerHari: jumlahHariAdaTransaksi > 0 ? Math.round(grandTotal / jumlahHariAdaTransaksi) : 0,
      ayamTerjual: hasilKumpul.ayamTotalQty,
      ayamRataRataPerHari: jumlahHariAdaTransaksi > 0 ? Math.round(hasilKumpul.ayamTotalQty / jumlahHariAdaTransaksi) : 0,
      nasiTerjual: hasilKumpul.nasiTotalQty,
      nasiRataRataPerHari: jumlahHariAdaTransaksi > 0 ? Math.round(hasilKumpul.nasiTotalQty / jumlahHariAdaTransaksi) : 0,
      nasiLiter: parseFloat((hasilKumpul.nasiTotalQty / PORSI_NASI_PER_LITER).toFixed(2)),
      incomeKotor: Math.round(grandTotal - totalPengeluaran),
      totalPengeluaran: Math.round(totalPengeluaran),
      metode: metodeArr,
      chart: { labels: chartLabels, values: chartValues },
      chartAyam: { labels: chartLabels.slice(), values: chartAyamValues },
      jumlahHariDalamBulan: jumlahHariDalamBulan,
      adaData: Object.keys(hasilKumpul.notaMap).length > 0
    };
  } catch (e) {
    return { status: "Error", message: e.toString() };
  }
}
function ambilRekapPerHari(tanggal, bulan, tahun) {
  try {
    var tanggalNum = parseInt(tanggal, 10);
    var bulanNum = parseInt(bulan, 10);
    var tahunNum = parseInt(tahun, 10);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var namaSheet = namaSheetTransaksiUntukTahun(tahunNum);
    var sheet = ss.getSheetByName(namaSheet);
    var hasilKumpul = _kumpulkanNotaTransaksi(sheet, function(p) {
      return p.tanggal === tanggalNum && p.bulan === bulanNum && p.tahun === tahunNum;
    });
    var grandTotal = 0;
    var totalCash = 0;
    Object.keys(hasilKumpul.notaMap).forEach(function(k){
      var nota = hasilKumpul.notaMap[k];
      var nett = _nettNota(nota);
      grandTotal += nett;
      if((nota.metode||"").toString().toLowerCase()==="cash") totalCash += nett;
    });
    var totalPengeluaran = _totalPengeluaranPeriode(ss, function(tglDate){
      return tglDate.getDate()===tanggalNum && (tglDate.getMonth()+1)===bulanNum && tglDate.getFullYear()===tahunNum;
    });
    // Label tanggal Indonesia
    var dd = (tanggalNum < 10 ? "0" : "") + tanggalNum;
    var mm = (bulanNum < 10 ? "0" : "") + bulanNum;
    return {
      status: "ok",
      mode: "harianPerTanggal",
      tanggal: tanggalNum,
      bulan: bulanNum,
      tahun: tahunNum,
      periodeLabel: dd + "/" + mm + "/" + tahunNum,
      grandTotal: Math.round(grandTotal),
      totalCash: Math.round(totalCash),
      ayamTerjual: hasilKumpul.ayamTotalQty,
      nasiTerjual: hasilKumpul.nasiTotalQty,
      nasiLiter: parseFloat((hasilKumpul.nasiTotalQty / PORSI_NASI_PER_LITER).toFixed(2)),
      totalPengeluaran: Math.round(totalPengeluaran),
      incomeKotor: Math.round(grandTotal - totalPengeluaran),
      adaData: Object.keys(hasilKumpul.notaMap).length > 0
    };
  } catch(e){
    return { status: "Error", message: e.toString() };
  }
}

// Rekap BULANAN dalam 1 tahun (dipakai mode "Bulanan" di dashboard).
function ambilRekapBulanan(tahun) {
  try {
    var tahunNum = parseInt(tahun, 10);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var namaSheet = namaSheetTransaksiUntukTahun(tahunNum);
    var sheet = ss.getSheetByName(namaSheet);

    var hasilKumpul = _kumpulkanNotaTransaksi(sheet, function(p) {
      return p.tahun === tahunNum;
    });

    var totalPerBulan = {}; // bulan(1-12) -> nett
    var metodeMap = {};
    var grandTotal = 0;
    var bulanSet = {};

    Object.keys(hasilKumpul.notaMap).forEach(function(key) {
      var nota = hasilKumpul.notaMap[key];
      var nett = _nettNota(nota);
      grandTotal += nett;
      totalPerBulan[nota.bulan] = (totalPerBulan[nota.bulan] || 0) + nett;
      bulanSet[nota.bulan] = true;

      if (!metodeMap[nota.metode]) metodeMap[nota.metode] = { nilai: 0, jumlah: 0 };
      metodeMap[nota.metode].nilai += nett;
      metodeMap[nota.metode].jumlah += 1;
    });

    var jumlahBulanAdaTransaksi = Object.keys(bulanSet).length;
    var totalPengeluaran = _totalPengeluaranPeriode(ss, function(tglDate) {
      return tglDate.getFullYear() === tahunNum;
    });

    var chartLabels = [];
    var chartValues = [];
    for (var m = 1; m <= 12; m++) {
      chartLabels.push(NAMA_BULAN_INDO[m - 1].substring(0, 3));
      chartValues.push(Math.round(totalPerBulan[m] || 0));
    }

    var metodeArr = Object.keys(metodeMap).map(function(k) {
      return { label: k, nilai: Math.round(metodeMap[k].nilai), jumlah: metodeMap[k].jumlah };
    }).sort(function(a, b) { return b.nilai - a.nilai; });

    return {
      status: "ok",
      mode: "bulanan",
      periodeLabel: "Tahun " + tahunNum,
      grandTotal: Math.round(grandTotal),
      rataRataPerHari: jumlahBulanAdaTransaksi > 0 ? Math.round(grandTotal / jumlahBulanAdaTransaksi) : 0,
      ayamTerjual: hasilKumpul.ayamTotalQty,
      ayamRataRataPerHari: jumlahBulanAdaTransaksi > 0 ? Math.round(hasilKumpul.ayamTotalQty / jumlahBulanAdaTransaksi) : 0,
      incomeKotor: Math.round(grandTotal - totalPengeluaran),
      totalPengeluaran: Math.round(totalPengeluaran),
      metode: metodeArr,
      chart: { labels: chartLabels, values: chartValues },
      adaData: Object.keys(hasilKumpul.notaMap).length > 0
    };
  } catch (e) {
    return { status: "Error", message: e.toString() };
  }
}

// ============================================================
//  DAFTAR TRANSAKSI QRIS — dipakai tab "QRIS" di dashboard supaya Owner
//  bisa mencocokkan SATU PER SATU struk QRIS ke mutasi aplikasi pembayaran
//  (GoPay/OVO/dsb), beda dari ambilRekapHarian/ambilRekapBulanan yang cuma
//  angka agregat. Gabungan Ayam + Mamah, karena uang QRIS masuk ke akun
//  yang sama terlepas dari kategori produknya di POS.
// ============================================================

// Baca satu sheet Transaksi (Ayam atau Mamah), kelompokkan per nota persis
// seperti _kumpulkanNotaTransaksi, tapi: (1) filter khusus metode QRIS,
// (2) TIDAK membuang baris berstatus VOID -- sengaja tetap disertakan
// (ditandai) supaya Owner tahu nota itu ada, walau catatan qty-nya sudah
// di-nol-kan oleh batalkanTransaksiTerakhir() saat void (jadi nominalnya
// akan tampil Rp 0 -- itu keterbatasan data yang sudah ada, bukan bug
// fungsi ini).
function _isMetodeQris(m){ return (m||"").toString().toLowerCase()==="qris"; }
function _isMetodeShopee(m){ var s=(m||"").toString().toLowerCase(); return s.indexOf("shopee")!==-1 || s.indexOf("shoppee")!==-1; }
function _isMetodeGrab(m){ return (m||"").toString().toLowerCase().indexOf("grab")!==-1; }
function _isMetodeGofood(m){ var s=(m||"").toString().toLowerCase(); return s.indexOf("gojek")!==-1 || s.indexOf("gofood")!==-1; }
function _daftarNotaByMetode(sheet, filterBulanTahunFn, labelSumber, checkFn) {
  var lastRow = getRealLastRow(sheet);
  var hasil = [];
  if (!sheet || lastRow < 2) return hasil;

  var data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  var notaMap = {};

  data.forEach(function(row) {
    var tglStr = row[0] ? _formatNilaiTglSheet(row[0]) : "";
    if (tglStr === "") return;
    var p;
    try { p = _parseTglNota(tglStr); } catch (errP) { return; }
    if (!filterBulanTahunFn(p)) return;

    var metode = (row[3] || "Cash").toString();
    if (!checkFn(metode)) return;

    var qty = Number(row[2]) || 0;
    var harga = Number(row[4]) || 0;
    var diskonNilai = Number(row[7]) || 0;
    var diskonTipe = row[8] || "Rp";
    var statusRow = row[9] === "VOID" ? "VOID" : "OK";

    if (!notaMap[tglStr]) {
      notaMap[tglStr] = { tglStr: tglStr, rawTotal: 0, diskonNilai: diskonNilai, diskonTipe: diskonTipe, status: statusRow };
    }
    notaMap[tglStr].rawTotal += qty * harga;
    if (statusRow === "OK") notaMap[tglStr].status = "OK";
  });

  Object.keys(notaMap).forEach(function(key) {
    var n = notaMap[key];
    var bagianJam = n.tglStr.split(' ')[1] || "";
    hasil.push({
      tglStr: n.tglStr,
      jam: bagianJam.substring(0, 5),
      total: Math.round(_nettNota(n)),
      status: n.status,
      sumber: labelSumber
    });
  });

  return hasil;
}
function _daftarNotaQrisDariSheet(sheet, filter, label){ return _daftarNotaByMetode(sheet, filter, label, _isMetodeQris); }
function _daftarNotaShopeeDariSheet(sheet, filter, label){ return _daftarNotaByMetode(sheet, filter, label, _isMetodeShopee); }
function _daftarNotaGrabDariSheet(sheet, filter, label){ return _daftarNotaByMetode(sheet, filter, label, _isMetodeGrab); }
function _daftarNotaGofoodDariSheet(sheet, filter, label){ return _daftarNotaByMetode(sheet, filter, label, _isMetodeGofood); }

// Daftar transaksi QRIS untuk SATU hari tertentu (tanggal/bulan/tahun),
// diurutkan berdasarkan jam. Dipakai tab QRIS di dashboard.
// Sekarang juga kembalikan total per-bulan per kategori Ayam/Mamah.
function ambilDaftarTransaksiQris(tanggal, bulan, tahun) {
  try {
    var tanggalNum = parseInt(tanggal, 10);
    var bulanNum = parseInt(bulan, 10);
    var tahunNum = parseInt(tahun, 10);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var filterHari = function(p) {
      return p.tanggal === tanggalNum && p.bulan === bulanNum && p.tahun === tahunNum;
    };
    var filterBulan = function(p) {
      return p.bulan === bulanNum && p.tahun === tahunNum;
    };

    var sheetAyam = ss.getSheetByName(namaSheetTransaksiUntukTahun(tahunNum));
    var sheetMamah = ss.getSheetByName(namaSheetMamahUntukTahun(tahunNum));

    var daftar = _daftarNotaQrisDariSheet(sheetAyam, filterHari, "Ayam")
      .concat(_daftarNotaQrisDariSheet(sheetMamah, filterHari, "Mamah"));

    daftar.sort(function(a, b) { return a.tglStr < b.tglStr ? -1 : (a.tglStr > b.tglStr ? 1 : 0); });

    var totalQris = 0;
    daftar.forEach(function(n) { totalQris += n.total; });
    // Per-kategori hari
    var totalAyamHari = 0, totalMamahHari = 0, jumlahAyamHari=0, jumlahMamahHari=0;
    daftar.forEach(function(n){ if(n.sumber==="Ayam"){ totalAyamHari+=n.total; jumlahAyamHari++; } else if(n.sumber==="Mamah"){ totalMamahHari+=n.total; jumlahMamahHari++; } });
    // Per-bulan
    var daftarAyamBulan = _daftarNotaQrisDariSheet(sheetAyam, filterBulan, "Ayam");
    var daftarMamahBulan = _daftarNotaQrisDariSheet(sheetMamah, filterBulan, "Mamah");
    var totalAyamBulan = 0; daftarAyamBulan.forEach(function(n){ totalAyamBulan+=n.total; });
    var totalMamahBulan = 0; daftarMamahBulan.forEach(function(n){ totalMamahBulan+=n.total; });

    return {
      status: "ok",
      periodeLabel: (tanggalNum < 10 ? "0" : "") + tanggalNum + "/" + (bulanNum < 10 ? "0" : "") + bulanNum + "/" + tahunNum,
      daftar: daftar,
      totalQris: totalQris,
      jumlahNota: daftar.length,
      totalAyamHari: totalAyamHari,
      totalMamahHari: totalMamahHari,
      jumlahAyamHari: jumlahAyamHari,
      jumlahMamahHari: jumlahMamahHari,
      totalAyamBulan: totalAyamBulan,
      totalMamahBulan: totalMamahBulan,
      jumlahAyamBulan: daftarAyamBulan.length,
      jumlahMamahBulan: daftarMamahBulan.length,
      totalBulan: totalAyamBulan + totalMamahBulan,
      jumlahNotaBulan: daftarAyamBulan.length + daftarMamahBulan.length
    };
  } catch (e) {
    return { status: "Error", message: e.toString() };
  }
}
function ambilDaftarTransaksiShopee(tanggal, bulan, tahun){
  try{
    var tanggalNum=parseInt(tanggal,10), bulanNum=parseInt(bulan,10), tahunNum=parseInt(tahun,10);
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var filterHari=function(p){return p.tanggal===tanggalNum && p.bulan===bulanNum && p.tahun===tahunNum;};
    var filterBulan=function(p){return p.bulan===bulanNum && p.tahun===tahunNum;};
    var sheetAyam=ss.getSheetByName(namaSheetTransaksiUntukTahun(tahunNum));
    var sheetMamah=ss.getSheetByName(namaSheetMamahUntukTahun(tahunNum));
    var daftar=_daftarNotaShopeeDariSheet(sheetAyam,filterHari,"Ayam").concat(_daftarNotaShopeeDariSheet(sheetMamah,filterHari,"Mamah"));
    daftar.sort(function(a,b){return a.tglStr<b.tglStr?-1:(a.tglStr>b.tglStr?1:0);});
    var total=0; daftar.forEach(function(n){total+=n.total;});
    var totalAyamHari=0,totalMamahHari=0,jmlAyamHari=0,jmlMamahHari=0;
    daftar.forEach(function(n){ if(n.sumber==="Ayam"){totalAyamHari+=n.total;jmlAyamHari++;}else{totalMamahHari+=n.total;jmlMamahHari++;}});
    var daftarAyamBulan=_daftarNotaShopeeDariSheet(sheetAyam,filterBulan,"Ayam");
    var daftarMamahBulan=_daftarNotaShopeeDariSheet(sheetMamah,filterBulan,"Mamah");
    var totalAyamBulan=0; daftarAyamBulan.forEach(function(n){totalAyamBulan+=n.total;});
    var totalMamahBulan=0; daftarMamahBulan.forEach(function(n){totalMamahBulan+=n.total;});
    return {status:"ok", periodeLabel:(tanggalNum<10?"0":"")+tanggalNum+"/"+(bulanNum<10?"0":"")+bulanNum+"/"+tahunNum, daftar:daftar, totalQris:total, jumlahNota:daftar.length, totalAyamHari:totalAyamHari, totalMamahHari:totalMamahHari, jumlahAyamHari:jmlAyamHari, jumlahMamahHari:jmlMamahHari, totalAyamBulan:totalAyamBulan, totalMamahBulan:totalMamahBulan, jumlahAyamBulan:daftarAyamBulan.length, jumlahMamahBulan:daftarMamahBulan.length, totalBulan:totalAyamBulan+totalMamahBulan, jumlahNotaBulan:daftarAyamBulan.length+daftarMamahBulan.length};
  }catch(e){ return {status:"Error", message:e.toString()}; }
}
function ambilDaftarTransaksiGrab(tanggal, bulan, tahun){
  try{
    var tanggalNum=parseInt(tanggal,10), bulanNum=parseInt(bulan,10), tahunNum=parseInt(tahun,10);
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var filterHari=function(p){return p.tanggal===tanggalNum && p.bulan===bulanNum && p.tahun===tahunNum;};
    var filterBulan=function(p){return p.bulan===bulanNum && p.tahun===tahunNum;};
    var sheetAyam=ss.getSheetByName(namaSheetTransaksiUntukTahun(tahunNum));
    var sheetMamah=ss.getSheetByName(namaSheetMamahUntukTahun(tahunNum));
    var daftar=_daftarNotaGrabDariSheet(sheetAyam,filterHari,"Ayam").concat(_daftarNotaGrabDariSheet(sheetMamah,filterHari,"Mamah"));
    daftar.sort(function(a,b){return a.tglStr<b.tglStr?-1:(a.tglStr>b.tglStr?1:0);});
    var total=0; daftar.forEach(function(n){total+=n.total;});
    var totalAyamHari=0,totalMamahHari=0,jmlAyamHari=0,jmlMamahHari=0;
    daftar.forEach(function(n){ if(n.sumber==="Ayam"){totalAyamHari+=n.total;jmlAyamHari++;}else{totalMamahHari+=n.total;jmlMamahHari++;}});
    var daftarAyamBulan=_daftarNotaGrabDariSheet(sheetAyam,filterBulan,"Ayam");
    var daftarMamahBulan=_daftarNotaGrabDariSheet(sheetMamah,filterBulan,"Mamah");
    var totalAyamBulan=0; daftarAyamBulan.forEach(function(n){totalAyamBulan+=n.total;});
    var totalMamahBulan=0; daftarMamahBulan.forEach(function(n){totalMamahBulan+=n.total;});
    return {status:"ok", periodeLabel:(tanggalNum<10?"0":"")+tanggalNum+"/"+(bulanNum<10?"0":"")+bulanNum+"/"+tahunNum, daftar:daftar, totalQris:total, jumlahNota:daftar.length, totalAyamHari:totalAyamHari, totalMamahHari:totalMamahHari, jumlahAyamHari:jmlAyamHari, jumlahMamahHari:jmlMamahHari, totalAyamBulan:totalAyamBulan, totalMamahBulan:totalMamahBulan, jumlahAyamBulan:daftarAyamBulan.length, jumlahMamahBulan:daftarMamahBulan.length, totalBulan:totalAyamBulan+totalMamahBulan, jumlahNotaBulan:daftarAyamBulan.length+daftarMamahBulan.length};
  }catch(e){ return {status:"Error", message:e.toString()}; }
}
function ambilDaftarTransaksiGofood(tanggal, bulan, tahun){
  try{
    var tanggalNum=parseInt(tanggal,10), bulanNum=parseInt(bulan,10), tahunNum=parseInt(tahun,10);
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var filterHari=function(p){return p.tanggal===tanggalNum && p.bulan===bulanNum && p.tahun===tahunNum;};
    var filterBulan=function(p){return p.bulan===bulanNum && p.tahun===tahunNum;};
    var sheetAyam=ss.getSheetByName(namaSheetTransaksiUntukTahun(tahunNum));
    var sheetMamah=ss.getSheetByName(namaSheetMamahUntukTahun(tahunNum));
    var daftar=_daftarNotaGofoodDariSheet(sheetAyam,filterHari,"Ayam").concat(_daftarNotaGofoodDariSheet(sheetMamah,filterHari,"Mamah"));
    daftar.sort(function(a,b){return a.tglStr<b.tglStr?-1:(a.tglStr>b.tglStr?1:0);});
    var total=0; daftar.forEach(function(n){total+=n.total;});
    var totalAyamHari=0,totalMamahHari=0,jmlAyamHari=0,jmlMamahHari=0;
    daftar.forEach(function(n){ if(n.sumber==="Ayam"){totalAyamHari+=n.total;jmlAyamHari++;}else{totalMamahHari+=n.total;jmlMamahHari++;}});
    var daftarAyamBulan=_daftarNotaGofoodDariSheet(sheetAyam,filterBulan,"Ayam");
    var daftarMamahBulan=_daftarNotaGofoodDariSheet(sheetMamah,filterBulan,"Mamah");
    var totalAyamBulan=0; daftarAyamBulan.forEach(function(n){totalAyamBulan+=n.total;});
    var totalMamahBulan=0; daftarMamahBulan.forEach(function(n){totalMamahBulan+=n.total;});
    return {status:"ok", periodeLabel:(tanggalNum<10?"0":"")+tanggalNum+"/"+(bulanNum<10?"0":"")+bulanNum+"/"+tahunNum, daftar:daftar, totalQris:total, jumlahNota:daftar.length, totalAyamHari:totalAyamHari, totalMamahHari:totalMamahHari, jumlahAyamHari:jmlAyamHari, jumlahMamahHari:jmlMamahHari, totalAyamBulan:totalAyamBulan, totalMamahBulan:totalMamahBulan, jumlahAyamBulan:daftarAyamBulan.length, jumlahMamahBulan:daftarMamahBulan.length, totalBulan:totalAyamBulan+totalMamahBulan, jumlahNotaBulan:daftarAyamBulan.length+daftarMamahBulan.length};
  }catch(e){ return {status:"Error", message:e.toString()}; }
}

// Rekap Log Dapur untuk SATU hari spesifik (dipakai tab "Log Dapur" di
// dashboard, mengikuti pola yang sama seperti tab QRIS di atas). Ayam
// terjual dihitung dari _kumpulkanNotaTransaksi (yang sama dipakai rekap
// Harian/Bulanan) -- BUKAN dibaca dari Log_Stok_Ayam lagi, karena
// penjualan sudah tidak dicatat sebagai baris riwayat di sana (lihat
// simpanData). Ayam digoreng & pemakaian minyak tetap dari Log_Stok_Ayam,
// yang sekarang murni catatan riwayat aktivitas dapur.
function ambilLogDapurHarian(tanggal, bulan, tahun) {
  try {
    var tanggalNum = parseInt(tanggal, 10);
    var bulanNum = parseInt(bulan, 10);
    var tahunNum = parseInt(tahun, 10);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var sheetAyam = ss.getSheetByName(namaSheetTransaksiUntukTahun(tahunNum));
    var hasilKumpul = _kumpulkanNotaTransaksi(sheetAyam, function(p) {
      return p.tanggal === tanggalNum && p.bulan === bulanNum && p.tahun === tahunNum;
    });
    var keyHari = tahunNum + "-" + bulanNum + "-" + tanggalNum;
    var ayamTerjual = hasilKumpul.ayamQtyPerHari[keyHari] || 0;

    var ayamDigoreng = 0;
    var pemakaianMinyak = 0;
    var daftarAktivitas = [];

    var sheetLog = ss.getSheetByName("Log_Stok_Ayam");
    var lastRowLog = getRealLastRow(sheetLog);
    if (sheetLog && lastRowLog >= 2) {
      var dataLog = sheetLog.getRange(2, 1, lastRowLog - 1, 5).getValues();
      dataLog.forEach(function(row) {
        var tglRow = row[0];
        if (!(tglRow instanceof Date)) return;
        if (tglRow.getDate() !== tanggalNum || (tglRow.getMonth() + 1) !== bulanNum || tglRow.getFullYear() !== tahunNum) return;

        var jenis = row[1] ? row[1].toString() : "";
        var jumlah = Number(row[3]) || 0;

        if (jenis === "Goreng Ayam (Matang)") {
          ayamDigoreng += jumlah;
        } else if (jenis === "Pemakaian Minyak") {
          pemakaianMinyak += Math.abs(jumlah);
        }
        // JAM SERVER sebagai source of truth untuk audit "dicatat jam berapa?"
        // Format HH:mm Asia/Jakarta, konsisten dengan kolom A yang sekarang
        // diisi waktuAktivitas server di simpanLogOperasional().
        var jamStr = "";
        try { jamStr = Utilities.formatDate(tglRow, "Asia/Jakarta", "HH:mm"); } catch(eJam) { jamStr = ""; }
        daftarAktivitas.push({ jenis: jenis, sektor: row[2] || "", jumlah: jumlah, keterangan: row[4] ? row[4].toString() : "", jam: jamStr, timestamp: tglRow.getTime() });
      });
    }

    // Urutkan terbaru di atas (desc) — untuk audit kasir realtime & dashboard
    daftarAktivitas.sort(function(a,b){ return (b.timestamp||0) - (a.timestamp||0); });
    return {
      status: "ok",
      periodeLabel: (tanggalNum < 10 ? "0" : "") + tanggalNum + "/" + (bulanNum < 10 ? "0" : "") + bulanNum + "/" + tahunNum,
      ayamDigoreng: ayamDigoreng,
      ayamTerjual: ayamTerjual,
      pemakaianMinyak: pemakaianMinyak,
      daftarAktivitas: daftarAktivitas
    };
  } catch (e) {
    return { status: "Error", message: e.toString() };
  }
}

// Ringkasan Log Dapur HARI INI saja -- dipakai tab Dapur di kasir (bukan
// dashboard, yang punya date picker sendiri). "Hari ini" dihitung dari jam
// SERVER (bukan tanggal perangkat kasir) supaya konsisten walau device lupa
// zona waktu.
function ambilLogDapurHariIni() {
  var sekarang = new Date();
  return ambilLogDapurHarian(sekarang.getDate(), sekarang.getMonth() + 1, sekarang.getFullYear());
}

// ============================================================
//  ARSIP TAHUNAN — dipicu MANUAL oleh Owner (misal awal Januari
//  setelah tutup buku tahun lalu). Rename tab aktif jadi "..._<tahun>"
//  (instan, tanpa hapus baris satu-satu -> tidak ada risiko timeout),
//  lalu buat tab baru kosong (hanya header) untuk tahun berikutnya.
//  Dibungkus LockService supaya tidak bentrok dengan checkout yang
//  sedang berjalan, dan ada pengecekan supaya tidak menimpa arsip yang
//  sudah ada kalau tombol tidak sengaja diklik 2x.
// ============================================================
// ============================================================
//  WALLET KAS TOKO — saldo kumulatif milik toko (bukan owner)
//  SOT permanen = Transaksi (Cash Ayam !Mama) + Pengeluaran (Saldo Awal/Adjustment/Belanja/Tarik/Setor)
//  localStorage hanya cache/optimistic, server adalah sumber final.
//  F = Metode (Cash Toko / Non-Cash), kosong = Cash Toko (backward compat)
// ============================================================
function _invalidateWalletCache(){
  try{ var c=CacheService.getScriptCache(); c.remove('walletSaldo_v1'); c.remove('walletSaldo_v2'); }catch(e){}
}
function getWalletSaldo() {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('walletSaldo_v2');
    if (cached) {
      try{ return JSON.parse(cached); }catch(e){}
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // --- Cash Ayam kumulatif (semua Transaksi_* + Transaksi) ---
    var totalCashAyam = 0;
    var sheets = ss.getSheets();
    for (var s = 0; s < sheets.length; s++) {
      var sh = sheets[s];
      var nama = sh.getName();
      var isTransaksiAyam = (nama === "Transaksi" || nama.indexOf("Transaksi_") === 0);
      // skip Transaksi Mamah* (dimulai dengan "Transaksi Mamah")
      if (nama.indexOf("Transaksi Mamah") === 0) continue;
      if (!isTransaksiAyam) continue;
      var hk = _kumpulkanNotaTransaksi(sh, function(p){ return true; });
      Object.keys(hk.notaMap).forEach(function(k){
        var nota = hk.notaMap[k];
        // hanya Cash yang masuk wallet (Qris/Ojol bukan tunai di laci)
        if ((nota.metode || "").toString().toLowerCase() !== "cash") return;
        totalCashAyam += _nettNota(nota);
      });
    }
    // --- Pengeluaran kumulatif --- F = Metode
    var sheetPeng = ss.getSheetByName("Pengeluaran");
    var saldoAwal = 0, adjustment = 0, totalBelanja = 0, totalTarik = 0, totalSetoran = 0;
    var lastRowPeng = getRealLastRow(sheetPeng);
    if (sheetPeng && lastRowPeng >= 2) {
      var dataPeng = sheetPeng.getRange(2, 1, lastRowPeng - 1, 6).getValues();
      dataPeng.forEach(function(row){
        var jenis = row[1] ? row[1].toString().trim() : "";
        var nominal = Number(row[3]) || 0;
        var metode = row[5] ? row[5].toString().trim() : "";
        var isCash = (metode === "" || metode === "Cash Toko");
        if (jenis === "Saldo Awal Wallet") {
          saldoAwal += nominal;
        } else if (jenis === "Adjustment Wallet") {
          adjustment += nominal; // nominal bisa negatif (koreksi -)
        } else if (jenis === "Belanja Operasional" || jenis === "Operasional") {
          if (isCash) totalBelanja += nominal;
        } else if (jenis === "Tarik Tunai") {
          totalTarik += nominal;
        } else if (jenis === "Setoran Owner") {
          totalSetoran += nominal;
        }
      });
    }
    var walletSaldo = saldoAwal + totalCashAyam - totalBelanja - totalTarik - totalSetoran + adjustment;
    // FIX #1: Modal Kembalian hari ini dari server (Laporan Tutup Toko), bukan
    // localStorage cross-origin. Dashboard sebelumnya pakai
    // localStorage.getItem('modal_laci_'+toISOString) di script.google.com
    // yang tidak pernah berbagi storage dengan github.io + toISOString UTC
    // salah hari WIB. Sekarang server jadi SOT: ambil Modal Laci terbaru
    // untuk hari ini (Asia/Jakarta) dari sheet Laporan Tutup Toko.
    var modalLaciToday = 0;
    try {
      var sheetLaporan = ss.getSheetByName("Laporan Tutup Toko");
      if (sheetLaporan && sheetLaporan.getLastRow() >= 2) {
        var todayJakartaStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy");
        var partsT = todayJakartaStr.split('/');
        var tHari = parseInt(partsT[0], 10), tBulan = parseInt(partsT[1], 10), tTahun = parseInt(partsT[2], 10);
        var lastRowLap = getRealLastRow(sheetLaporan);
        // Kolom A = Tanggal, B = Modal Laci
        var dataLap = sheetLaporan.getRange(2, 1, lastRowLap - 1, 2).getValues();
        for (var li = dataLap.length - 1; li >= 0; li--) {
          var tglLap = dataLap[li][0];
          if (!(tglLap instanceof Date)) continue;
          if (tglLap.getDate() === tHari && (tglLap.getMonth() + 1) === tBulan && tglLap.getFullYear() === tTahun) {
            modalLaciToday = Number(dataLap[li][1]) || 0;
            break;
          }
        }
      }
    } catch (eModal) { modalLaciToday = 0; }
    var bisaDisetor = Math.max(0, walletSaldo - modalLaciToday);
    var result = {
      status: "ok",
      saldo: Math.round(walletSaldo),
      modalLaci: Math.round(modalLaciToday),
      bisaDisetor: Math.round(bisaDisetor),
      breakdown: {
        saldoAwal: Math.round(saldoAwal),
        cashAyam: Math.round(totalCashAyam),
        belanja: Math.round(totalBelanja),
        tarikTunai: Math.round(totalTarik),
        setoranOwner: Math.round(totalSetoran),
        adjustment: Math.round(adjustment)
      }
    };
    try{ cache.put('walletSaldo_v2', JSON.stringify(result), 90); }catch(e){}
    return result;
  } catch(e) {
    return { status: "Error", message: e.toString() };
  }
}

function getWalletSaldoPeriode(bulan, tahun, tanggal) {
  try {
    var bulanNum = bulan ? parseInt(bulan, 10) : null;
    var tahunNum = tahun ? parseInt(tahun, 10) : null;
    var tanggalNum = tanggal ? parseInt(tanggal, 10) : null;
    var hasFilter = !!(bulanNum && tahunNum);
    // tanpa filter → global
    if (!hasFilter) return getWalletSaldo();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var totalCashAyam = 0;
    var sheets = ss.getSheets();
    for (var s = 0; s < sheets.length; s++) {
      var sh = sheets[s];
      var nama = sh.getName();
      var isTransaksiAyam = (nama === "Transaksi" || nama.indexOf("Transaksi_") === 0);
      if (nama.indexOf("Transaksi Mamah") === 0) continue;
      if (!isTransaksiAyam) continue;
      var hk = _kumpulkanNotaTransaksi(sh, function(p){
        if (tanggalNum) return p.tanggal === tanggalNum && p.bulan === bulanNum && p.tahun === tahunNum;
        return p.bulan === bulanNum && p.tahun === tahunNum;
      });
      Object.keys(hk.notaMap).forEach(function(k){
        var nota = hk.notaMap[k];
        if ((nota.metode || "").toString().toLowerCase() !== "cash") return;
        totalCashAyam += _nettNota(nota);
      });
    }
    var sheetPeng = ss.getSheetByName("Pengeluaran");
    var saldoAwal = 0, adjustment = 0, totalBelanja = 0, totalTarik = 0, totalSetoran = 0;
    var lastRowPeng = getRealLastRow(sheetPeng);
    if (sheetPeng && lastRowPeng >= 2) {
      var dataPeng = sheetPeng.getRange(2, 1, lastRowPeng - 1, 6).getValues();
      dataPeng.forEach(function(row){
        var tglRow = row[0];
        if (!(tglRow instanceof Date)) return;
        var match = false;
        if (tanggalNum) match = tglRow.getDate()===tanggalNum && (tglRow.getMonth()+1)===bulanNum && tglRow.getFullYear()===tahunNum;
        else match = (tglRow.getMonth()+1)===bulanNum && tglRow.getFullYear()===tahunNum;
        if (!match) return;
        var jenis = row[1] ? row[1].toString().trim() : "";
        var nominal = Number(row[3]) || 0;
        var metode = row[5] ? row[5].toString().trim() : "";
        var isCash = (metode === "" || metode === "Cash Toko");
        if (jenis === "Saldo Awal Wallet") saldoAwal += nominal;
        else if (jenis === "Adjustment Wallet") adjustment += nominal;
        else if (jenis === "Belanja Operasional" || jenis === "Operasional") { if (isCash) totalBelanja += nominal; }
        else if (jenis === "Tarik Tunai") totalTarik += nominal;
        else if (jenis === "Setoran Owner") totalSetoran += nominal;
      });
    }
    // per periode: saldo tanpa carry-over global, hanya transaksi periode
    var saldoPeriode = totalCashAyam - totalBelanja - totalTarik - totalSetoran + saldoAwal + adjustment;
    // modal untuk periode: jika filter tanggal → modal hari itu, jika bulanan → modal terakhir di bulan
    var modalPeriode = 0;
    try {
      var sheetLap = ss.getSheetByName("Laporan Tutup Toko");
      if (sheetLap && sheetLap.getLastRow() >= 2) {
        var lastRowLap = getRealLastRow(sheetLap);
        var dataLap = sheetLap.getRange(2, 1, lastRowLap - 1, 2).getValues();
        for (var li = dataLap.length - 1; li >= 0; li--) {
          var tglLap = dataLap[li][0];
          if (!(tglLap instanceof Date)) continue;
          var m = false;
          if (tanggalNum) m = tglLap.getDate()===tanggalNum && (tglLap.getMonth()+1)===bulanNum && tglLap.getFullYear()===tahunNum;
          else m = (tglLap.getMonth()+1)===bulanNum && tglLap.getFullYear()===tahunNum;
          if (m) { modalPeriode = Number(dataLap[li][1]) || 0; break; }
        }
      }
    } catch(eM) {}
    var bisaPeriode = Math.max(0, saldoPeriode - modalPeriode);
    return {
      status: "ok",
      saldo: Math.round(saldoPeriode),
      modalLaci: Math.round(modalPeriode),
      bisaDisetor: Math.round(bisaPeriode),
      periodeLabel: tanggalNum ? (String(tanggalNum).padStart(2,'0')+"/"+String(bulanNum).padStart(2,'0')+"/"+tahunNum) : (NAMA_BULAN_INDO[bulanNum-1]+" "+tahunNum),
      breakdown: {
        saldoAwal: Math.round(saldoAwal),
        cashAyam: Math.round(totalCashAyam),
        belanja: Math.round(totalBelanja),
        tarikTunai: Math.round(totalTarik),
        setoranOwner: Math.round(totalSetoran),
        adjustment: Math.round(adjustment)
      }
    };
  } catch(e) { return { status:"Error", message:e.toString() }; }
}

function arsipkanTahunTransaksi(pinInput) {
  var PIN_OWNER = "445566"; // PIN Owner -- SENGAJA beda dari PIN void (lihat batalkanTransaksiTerakhir)
  if (pinInput !== PIN_OWNER) return "Gagal: PIN Admin Salah!";

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var pesanHasil = [];
    var namaTabTarget = ["Transaksi", "Transaksi Mamah"];

    namaTabTarget.forEach(function(namaTab) {
      var sheetAktif = ss.getSheetByName(namaTab);
      if (!sheetAktif) {
        pesanHasil.push("Lewati '" + namaTab + "': tab tidak ditemukan.");
        return;
      }

      var lastRowData = getRealLastRow(sheetAktif);
      if (lastRowData < 2) {
        pesanHasil.push("Lewati '" + namaTab + "': tidak ada data transaksi untuk diarsipkan.");
        return;
      }

      // PENTING: tahun arsip diambil dari tanggal TRANSAKSI TERAKHIR di
      // sheet ini, BUKAN dari tanggal hari ini. Tombol ini biasanya diklik
      // awal Januari untuk mengarsipkan data tahun LALU -- kalau dilabeli
      // pakai tahun berjalan (tahun baru) saat itu, arsip akan salah nama
      // dan dashboard tidak akan menemukan rekap tahun lalu itu lagi.
      var tahunArsip = null;
      try { tahunArsip = _parseTglNota(sheetAktif.getRange(lastRowData, 1).getValue()).tahun; } catch (errParse) { tahunArsip = null; }
      if (!tahunArsip) {
        pesanHasil.push("Lewati '" + namaTab + "': tidak bisa membaca tahun dari transaksi terakhir.");
        return;
      }

      var namaArsip = namaTab + "_" + tahunArsip;
      if (ss.getSheetByName(namaArsip)) {
        pesanHasil.push("Lewati '" + namaTab + "': arsip '" + namaArsip + "' sudah ada (kemungkinan tombol sudah pernah diklik).");
        return;
      }

      var lastCol = Math.max(sheetAktif.getLastColumn(), 1);
      var headerRow = sheetAktif.getRange(1, 1, 1, lastCol).getValues();

      sheetAktif.setName(namaArsip);
      var sheetBaru = ss.insertSheet(namaTab, sheetAktif.getIndex());
      sheetBaru.getRange(1, 1, 1, lastCol).setValues(headerRow);

      pesanHasil.push("Sukses: '" + namaTab + "' diarsipkan jadi '" + namaArsip + "', tab '" + namaTab + "' baru (kosong) sudah dibuat.");
    });

    return pesanHasil.join(" | ");
  } catch (e) {
    return "Error: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}
