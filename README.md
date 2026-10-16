# Lab Peminatan VR — Teknik Informatika UIKA Bogor

Galeri 3D/VR multi-user untuk sosialisasi 4 lab peminatan: **KERIS**, **GIT**, **SE**, dan **CSN**.
Dibangun di atas mesin "Galeri Media Imersif" (semua fiturnya tetap ada: multi-user, chat & balon,
emoji, kilau, obrolan suara WebRTC, megafon, foto & rekam layar, duduk, papan tulis, papan pesan,
kuis, zoom/unduh/tautan panel, denah + minimap, joystick ponsel, dan mode VR WebXR).

## Isi galeri
| Ruang | Isi |
|---|---|
| **Ruang Sambutan** (titik awal) | Layar besar dengan video YouTube sambutan di dalam dunia 3D (klik layar = putar/jeda, tombol SUARA & PERBESAR), slideshow "Kenali Lab Peminatan", papan bantuan, denah, headset VR |
| **Atrium Pendaftaran** (tengah) | Resepsionis **Kak Tias** + meja & formulir pendaftaran internal, layar **pie chart persentase peminatan** di belakang Kak Tias, **Papan Pengumuman** hasil final (dinding timur), hologram 4 lab, kuis "Kasus ini cocok di lab mana?", papan tulis, papan pesan, 4 pintu lab |
| **Lab KERIS** (barat) | Tema pusat data: rak server berkedip, hologram jaringan saraf, workstation HPC, 11 slide + slideshow dokumentasi, layar 3 video Google Drive, robot **KERI** |
| **Lab GIT** (utara-kiri) | Tema geospasial: lantai peta kota neon, globe hologram + satelit, drone terbang, tumpukan layer peta, 13 slide + slideshow kegiatan/drone, video kegiatan lapangan, robot **GEO** |
| **Lab SE** (utara-kanan) | Tema studio developer: meja laptop berisi kode, beanbag, rak piala, kanban, neon motto, 16 slide + 3 slideshow (prestasi, produk, kegiatan), robot **CODY** |
| **Cafe Rahman** (timur Ruang Sambutan) | Kafe kayu dengan meja bar, papan menu kopi, papan keahlian dosen TI, barista **Rahman** (info kopi, petunjuk awal lorong rahasia, keahlian dosen, saran dosen pembimbing) |
| **Lab CSN** (timur) | Tema Network Operation Center: 3 layar monitoring animasi, hologram topologi dengan paket data mengalir, rak server, 8 slide, robot **NETA** |

- Nama karakter default: **IT'ers** (bisa diganti di Pengaturan).
- Setiap robot menjawab dari isi presentasi lab-nya sendiri (deskripsi slide + catatan FAQ di `content`), bisa memberi kuis, mengantar ke panel/lab, dan membacakan jawaban (suara browser). Bila ditanya hal lab lain, robot merujuk ke temannya.
- Musik **piano santai** dibangkitkan langsung di browser (WebAudio), berbeda nuansa untuk tiap lab dan memudar saat keluar lab. Tombol ♪ di toolbar untuk nyala/mati, volume di Pengaturan.
- Formulir pendaftaran **internal** (menggantikan Google Form): meja Kak Tias, kios "Daftar" di tiap lab, dan chat NPC. Data tersimpan di server (`data/peminatan.json`).

## Menjalankan
```bash
npm install
npm start            # http://localhost:8080
```
Buka lewat **http(s)**, bukan dengan klik ganda file `index.html`: video YouTube menolak diputar
dari `file://`. three.js sudah disertakan di `public/vendor`, jadi tidak bergantung pada CDN.

## Online untuk mahasiswa (wajib HTTPS agar mikrofon, VR & video lancar)
Deploy folder ini ke layanan Node apa pun (Render, Railway, Fly.io, VPS + Nginx/Caddy).
WebSocket otomatis memakai `wss://` bila halaman dibuka lewat `https://`.

| Variabel | Default | Fungsi |
|---|---|---|
| `PORT` | 8080 | Port server |
| `MAX_CLIENTS` | 150 | Batas total koneksi |
| `MAX_PER_ROOM` | 60 | Batas orang per ruang |
| `ALLOWED_ORIGINS` | (semua) | Daftar origin yang diizinkan, pisahkan koma |
| `ADMIN_NAME` | `~velov~` | Nama pengguna yang berwenang kick |
| `DATA_DIR` | `./data` | Folder penyimpanan Hall of Fame (jangan dihapus saat deploy ulang) |
| `ADMIN_KEY` | (acak tiap start) | Kunci rahasia moderator. Jika kosong, server membuat kunci acak dan menampilkannya sekali di konsol saat start |

Tambahkan `?room=nama-kelas` di URL untuk memisahkan kelompok, mis. `https://domainanda/?room=ti-2026`.

## Fitur tambahan (versi ini)
- **Ruang Sambutan**: robot **KURI** (kurikulum OBE, visi-misi prodi/fakultas/universitas, profil lulusan, CPL, mata kuliah per semester) + kios; dinding **Kepala Program Studi** (10 Ka Prodi berurutan tahun jabatan); logo besar TI 3D di dinding utara Atrium.
- **Nama robot lab**: Keri, Geo, Cody, Neta.
- **Pintu rahasia (Lab SE)**: tiap robot lab punya pertanyaan *secret passage* (chip **🔐 Secret passage** di jendela chat robot):
  Cody = visi Universitas, Geo = visi Fakultas Teknik dan Sains, Keri = visi Prodi TI, Neta = nama keempat lab (urutan bebas).
  Jawaban visi dinilai toleran (salah ketik kecil, tanda baca, "&"/"dan", minimal 85% kata cocok + tahun 2040). Setelah keempatnya benar,
  terasa guncangan kecil dan pintu di dinding utara Lab SE terbuka, tanpa pemberitahuan apa pun.
- **Lorong rahasia** (tidak tampil di peta/minimap):
  1. **Labirin** (15×15)
  2. **Rumah Kaca** (cermin + kaca bening)
  3. **10 Teka-teki** (jawaban satu kata, kunci disimpan sebagai hash)
  4. **Ular Tangga** (40 pijakan, maju hanya dengan dadu: tombol R, tombol di layar, atau klik dadu di atas kepala). Tangga 4→14, 9→23, 17→30, 22→33, 27→37; ular 13→5, 19→8, 26→16, 32→21, 36→24, 39→29.
     Pijakan **35 = Lubang Hitam**: pemain dikembalikan ke Ruang Sambutan dan harus mengulang dari Lorong 1 (pintu rahasia tetap terbuka). Finis harus **tepat** di 40; kelebihan langkah memantul mundur.
- **Taman Apresiasi**: air mancur, paviliun **Daftar Dosen & Daftar Mahasiswa**, papan **Hall of Fame**, dan **Kang Santo** (penjaga taman). Kang Santo memberi **sertifikat PNG**, mengaktifkan skin, dan meminta pemain menulis nama serta mengunggah foto untuk **Hall of Fame**.
- **Hall of Fame**: tampil sebagai pita LED berjalan di dinding selatan **Atrium** (ruang resepsionis), di papan taman, dan di galeri (klik layar). Data disimpan permanen di `data/hof.json` dan foto di `data/hof/` (atur lokasi dengan `DATA_DIR`). Foto dipotong 240×300 JPEG di browser; server hanya menerima JPEG valid ≤45 KB. Moderator dapat menghapus entri dari galeri.
- **Skin pemain**: Astronot Nebula, Ronin Neon, Hantu Hologram. Terkunci sampai pemain masuk taman dan bicara dengan Kang Santo; setelah itu buka **Menu → Lemari Skin** atau tombol **K**.
- **Moderator**: masuk dengan nama `~velov~` lalu isi kunci moderator yang muncul di bawah kolom nama. Di daftar **PEOPLE** muncul tombol **Kick** (klik dua kali untuk konfirmasi). Pengguna yang di-kick dikembalikan ke layar login dengan nama kosong. Tidak ada pesan chat dan tidak ada log server. Orang lain yang memakai nama `~velov~` tanpa kunci tampil sebagai "Pengunjung".
- Progres misi tersimpan **per nama** di browser masing-masing. Menjawab teka-teki dalam mode headset VR memerlukan keluar dari VR sebentar (butuh keyboard).

## Mengubah konten
- Teks, slide yang dipasang, FAQ robot, kuis, warna & musik tiap lab ada di bagian `src/content.js`
  di dalam `public/index.html` (objek `LABS`).
- Gambar slide ada di `public/assets/<lab>/` — `wNN.webp` (tekstur dinding 1024 px) dan `zNN.webp`
  (Zoom In/unduh 1600 px), `NN` = nomor halaman PDF asli.
- Pengetahuan tambahan juga bisa ditambahkan langsung dari tab **KNOWLEDGE** di jendela chat NPC
  (tersimpan di browser masing-masing).

## Keamanan
- Batas ukuran pesan 8 KB dan laju 40 pesan/detik per klien, pembatasan origin (opsional), batas koneksi
- Proteksi path traversal + header keamanan; CSP hanya mengizinkan iframe YouTube & Google Drive
- Semua teks dari pengguna lain ditampilkan sebagai teks biasa
- Suara mengalir peer-to-peer, server tidak menyimpan apa pun
- Coretan papan tulis, catatan, dan Papan Kehormatan divalidasi di server (tipe, panjang, jumlah titik)
- Wewenang kick diverifikasi **di server** dengan kunci (perbandingan hash waktu-konstan, maks. 5 percobaan per koneksi); nama saja tidak cukup
- Hall of Fame: nama dibersihkan, foto diverifikasi tanda tangan JPEG & ukurannya, disajikan dengan `Content-Security-Policy: default-src 'none'`; satu nama hanya bisa diperbarui pemilik token-nya; batas 5 kiriman/koneksi & 30/menit
- Skin & progres misi bersifat kosmetik di sisi klien; nilai skin dari pemain lain divalidasi terhadap daftar putih

## Pembaruan v4
### 1. Kode rahasia Cody
Ketik `butnavudivoxyziz` di chat **Cody** (Lab SE). Pemain langsung dinyatakan menuntaskan Labirin dan seluruh lorong rahasia
(pintu rahasia, Rumah Kaca, 10 teka-teki, Ular Tangga), lalu diteleport ke **Taman Apresiasi** tepat di depan **Kang Santo**.
Kode disimpan sebagai hash di sumber (seperti jawaban teka-teki) dan tidak disebut oleh NPC mana pun.

### 2. Sistem pendaftaran peminatan (pengganti Google Form)
- **Formulir di galeri**: nama, NIM, angkatan, WhatsApp/email, pilihan 1, pilihan 2, alasan. Satu NIM = satu pendaftaran; perubahan hanya dari browser yang sama (token) atau lewat admin.
- **Layar pie chart** di belakang Kak Tias: persentase pilihan 1 per lab, diperbarui langsung lewat WebSocket.
- **Papan Pengumuman** (dinding timur Atrium): menampilkan hasil final yang diumumkan admin; daftar nama berganti halaman otomatis, klik untuk mencari nama atau cek NIM. NIM di papan disamarkan.
- **Halaman admin**: `https://domain-anda/admin` (di luar VR), login username + password.
  - Unduh **Excel** (.xlsx: lembar Pendaftar, Rekap, Hasil Final)
  - Buka/tutup pendaftaran, hapus data pendaftar, ubah label periode
  - **Unggah hasil final** (.xlsx/.csv, kolom `NIM`, `Nama`, `Lab`) → pratinjau → **Umumkan** / tarik pengumuman. Template berisi semua pendaftar (lab = pilihan 1) bisa diunduh sebagai draf.
  - **Arsipkan & reset**: data periode berjalan disimpan ke `data/arsip-peminatan/` (bisa diunduh sebagai Excel kapan saja), lalu data aktif dikosongkan dengan label periode baru.

| Variabel | Default | Fungsi |
|---|---|---|
| `PEMINATAN_USER` | `admin` | Username halaman admin |
| `PEMINATAN_PASS` | (acak tiap start) | Password admin. Bila kosong, server membuat password acak dan menampilkannya sekali di konsol — **wajib diatur** untuk produksi |

Keamanan: password di-hash (scrypt) dan dibandingkan waktu-konstan; maks. 8 login gagal per 15 menit per IP; sesi cookie `HttpOnly; SameSite=Strict` (+`Secure` di HTTPS) 8 jam; header anti-CSRF pada semua permintaan yang mengubah data; CSP ketat di halaman admin; batas 12 pendaftaran/10 menit per IP.
Dependensi baru: `exceljs` (jalankan `npm install` ulang).

### 3. Cafe Rahman
Ruangan baru di timur Ruang Sambutan (pintu kayu di dinding timur, dekat gerbang Atrium), tercantum di denah, minimap, dan menu GO TO.
Barista **Rahman** menjawab: jenis-jenis kopi & rekomendasi, kopi Nusantara, petunjuk awal (bertahap) soal lorong rahasia, keahlian 19 dosen TI,
dan **saran dosen pembimbing**: tulis judul skripsi (mis. “judul: Klasifikasi penyakit daun padi dengan CNN”), Rahman mencocokkan kata kunci
judul dengan bidang keahlian dosen lalu menyarankan pembimbing utama + pendamping. Data dosen ada di `DOSEN_TI` (bagian `src/ext_cafe.js` di index.html).

### 4. Jeda adzan (auto-kick)
- Saat mengisi nama, pemain **wajib mengizinkan akses lokasi**. Bila ditolak atau tidak tersedia, galeri tidak bisa dimasuki.
- Jadwal sholat dihitung di browser dari koordinat pemain (parameter Kemenag RI: Subuh 20°, Isya 18°, Ashar Syafi'i, ihtiyat 2 menit), jadi sesuai wilayah masing-masing tanpa API luar. Koordinat tidak dikirim ke server.
- 5 menit sebelum adzan muncul peringatan. Saat adzan tiba (Subuh, Dzuhur, Ashar, Maghrib, Isya) pemain otomatis dikeluarkan ke layar awal dan tidak bisa masuk selama **15 menit** (`ADZAN_BLOCK_MIN`, ubah di `src/ext_adzan.js`). Mencabut izin lokasi saat bermain juga mengeluarkan pemain.
- Geolocation hanya berjalan di **HTTPS** (atau `localhost`). Server mengirim `Permissions-Policy: geolocation=(self)`.
- Pemeriksaan berjalan di sisi klien; pengguna yang sengaja mengutak-atik browser (devtools) secara teori bisa melewatinya.
