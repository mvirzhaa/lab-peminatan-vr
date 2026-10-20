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
| **IT-Mart** (timur Ruang Sambutan) | Kafe kayu dengan meja bar, papan menu kopi, papan keahlian dosen TI, barista **Rahman** (info kopi, petunjuk awal lorong rahasia, keahlian dosen, saran dosen pembimbing) |
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
| `ALLOWED_ORIGINS` | (situs yang sama) | Daftar origin WebSocket yang diizinkan, pisahkan koma. Bila kosong, hanya halaman dari host yang sama (atau klien tanpa header Origin) yang boleh membuka `/ws`. Isi bila galeri disajikan lewat domain/port lain dari yang dilihat Nginx |
| `MAX_ROOMS` | 100 | Batas jumlah nama ruang (`?room=`) berbeda, yaitu yang aktif + yang punya berkas catatan. Nama baru di luar batas ditolak |
| `ADMIN_NAME` | `~velov~` | Nama pengguna yang berwenang kick |
| `DATA_DIR` | `./data` | Folder penyimpanan Hall of Fame (jangan dihapus saat deploy ulang) |
| `ADMIN_KEY` | (acak tiap start) | Kunci rahasia moderator. Jika kosong, server membuat kunci acak dan menampilkannya sekali di konsol saat start |

Tambahkan `?room=nama-kelas` di URL untuk memisahkan kelompok, mis. `https://domainanda/?room=ti-2026`.

## Fitur tambahan (versi ini)
- **Ruang Sambutan**: robot **Dul** (kurikulum OBE, visi-misi prodi/fakultas/universitas, profil lulusan, CPL, mata kuliah per semester) + kios; dinding **Kepala Program Studi** (10 Ka Prodi berurutan tahun jabatan); logo besar TI 3D di dinding utara Atrium.
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
- **Halaman admin**: `https://domain-anda/4adm1in` (di luar VR), login username + password.
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

### 3. IT-Mart
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

## Pembaruan v5
- **Video gempa pintu rahasia**: setelah keempat robot lab menerima jawaban *secret passage*, terasa gempa kecil lalu video `assets/ext/lorong-rahasia.webm` / `.mp4` diputar layar penuh (bisa dilewati; tidak diputar saat mode headset VR). Server kini mendukung permintaan *Range* untuk video.
- **Ruang E-Portal UIKA**: ruang luas (29 × 26 m) di selatan Ruang Sambutan, lewat pintu hijau di dinding selatannya. Tercantum di denah, minimap, dan GO TO. Berisi slide 9 aplikasi E-Portal SSO (CBT, E-Library UIKA, Meeting, Short Course, SIAKAD, SIMPEG, UCL, UCL Mobile Android, Short Course Android) dengan keterangan *under construction*, papan selamat datang, dan gerbang portal. Robot **Vir** memberi akses ke `https://eportal.uika-bogor.ac.id` (tab baru) dan menyampaikan bahwa sistem masih dalam pengembangan.
- **KURI** kini bernama **Dul**.
- **Sit**, waitress IT-Mart: menjelaskan ke-8 ruangan di denah, posisi pemain, membuka denah, dan mengantar ke ruangan mana pun (tidak membocorkan ruang rahasia).

## Pembaruan v6
- **Sudut Al-Qur'an** (Atrium, sisi timur laut — di kanan pintu masuk): paviliun berkubah hijau berlis emas di atas panggung bertingkat, karpet bermotif bintang, lentera gantung, dan mushaf terbuka di atas rehal. Klik mushaf atau papan kaligrafi untuk membuka pembaca:
  - 114 surah, teks Arab rasm Utsmani + terjemahan Kementerian Agama RI (data disimpan di server sendiri: `public/assets/quran/`, ±2,6 MB), pencarian surah, ukuran huruf, sembunyikan/tampilkan terjemahan, penanda baca terakhir.
  - Audio murattal per ayat atau satu surah berurutan (Alafasy / Al-Husary / As-Sudais) dari `cdn.islamic.network`. **Audio hanya diputar di perangkat pemain yang menekan tombol putar** — tidak disiarkan ke pemain lain. Musik galeri otomatis dikecilkan selama murattal.
  - Mode headset VR: klik mushaf menampilkan halaman (5 ayat) di panel 3D; klik lagi untuk halaman berikutnya.
  - Sumber: The Noble Qur'an Encyclopedia (quranenc.com) via paket `quran-json` 3.1.2 (CC BY-SA 4.0); font KFGQPC Uthmanic Script HAFS (© King Fahd Complex, dipakai tanpa diubah). Lihat `public/assets/quran/SUMBER.txt`. Penanda catatan kaki terjemahan dihapus karena isi catatan kakinya tidak tersedia.
- **Cafe Rahman → IT-Mart**.
- **Rak Buku Digital IT-Mart**: lemari di dinding barat IT-Mart menampilkan buku PDF yang bisa diunduh. Koleksi dikelola di **/4adm1in → tab "Rak Buku IT-Mart"** (akun yang sama dengan admin peminatan): unggah (hanya PDF, maks. 40 MB, diverifikasi tanda tangan `%PDF-`), ubah judul/penulis/kategori/ringkasan, hapus. File di `data/buku/`.
- **NPC Ivy** (penjaga buku): menjelaskan isi buku dari ringkasan admin dan teks PDF yang diekstrak server (`pdfjs-dist`), menjawab pertanyaan dengan kutipan halaman yang paling relevan, dan memberi tombol unduh. PDF hasil pindaian (tanpa teks) hanya dijelaskan dari ringkasannya.
- **Suara pemain sesuai jarak**: tanpa pengeras suara (megafon), suara terdengar penuh ≤ 3 m, makin pelan, dan tidak terdengar ≥ 20 m (`VOICE_NEAR`/`VOICE_FAR`). Dengan megafon tetap terdengar oleh semua.
- **Papan Pesan IT'ers permanen**: catatan disimpan di `data/notes/<ruang>.json` (tidak hilang saat server dimulai ulang, hingga 5.000 catatan per ruang). Penulis bisa menghapus catatannya sendiri (kunci tersimpan di browsernya); moderator dan admin (/4adm1in → tab "Papan Pesan") bisa menghapus catatan mana pun.
- Dependensi baru: `pdfjs-dist` — jalankan `npm install` ulang. Folder `data/` sekarang berisi `buku/`, `notes/`, `peminatan.json`, `hof.json` → **jangan dihapus saat deploy ulang**.

## Pembaruan v7 — Explorer Card
- **Kang Santo** kini juga memberi **Explorer Card** (template `public/assets/ext/explorer-card.jpg`) bertuliskan **nama pemain** dan **nomor sertifikat** (nomor yang sama dengan sertifikat penjelajah) plus tanggal terbit. Bisa dilihat & diunduh sebagai PNG dari kartu Kang Santo, chat ("kartu"/"explorer card"), halaman sertifikat, dan daftar misi.
- Kartu tersimpan di progres pemain (`Q().card`). Untuk ruangan tantangan berikutnya sudah disiapkan penjaga akses: `XC.has()` (punya kartu?) dan `XC.require("Nama Ruangan")` (menampilkan pesan & menolak bila belum punya).
- Catatan: progres pemain disimpan di browser masing-masing, jadi untuk tantangan yang butuh keamanan tinggi kepemilikan kartu sebaiknya kelak juga dicatat & diverifikasi di server.

## Pembaruan v8 — Lantai 2 IT-Mart, Nan & Tantangan Kognitif
- **Lantai 2 IT-Mart ("Explorer Zone")**: naik lewat tangga kayu di sudut timur laut IT-Mart (berjalan ke anak tangga atau klik papan "⬆ LANTAI 2"); turun lewat tangga di sudut yang sama. Karena mesin galeri hanya memiliki satu ketinggian lantai, lantai 2 dibangun sebagai area tersendiri (tidak tampil di denah) dengan jendela langit agar terasa berada di atas.
- **NPC Nan** memverifikasi Explorer Card ke **database server** (`data/kartu.json`). Kartu otomatis didaftarkan saat diambil dari Kang Santo (kartu lama didaftarkan saat pertama diverifikasi). Kartu terdaftar → gerbang kaca terbuka. Tanpa kartu → Nan menyuruh pemain menemui **Rahman** di lantai 1.
- **Admin** (/4adm1in → tab "Explorer Card"): daftar semua kartu, jumlah verifikasi, cabut/aktifkan kembali (kartu yang dicabut ditolak Nan).
- **Rahman**: lorong rahasia kini disebut ada "di salah satu lab peminatan" (tidak lagi menyebut Lab SE); Rahman juga menjelaskan cara mendapat Explorer Card dan arah ke lantai 2.
- **Tantangan 1 · Kognitif**: pintu di ujung lorong balik gerbang. Pemain dilempar ke **penjara bawah tanah**; 20 soal matematika pilihan ganda, **urutan soal & pilihan diacak setiap percobaan**, batas **60 detik** (tombol 1–4 bisa dipakai). Satu salah / waktu habis → kembali ke Nan. Berhasil → jeruji terangkat, pemain masuk ruang **Tantangan 2 · COMING SOON** (ada portal kembali ke lantai 2). Jawaban soal dihitung oleh kode (`COG_BANK`), bukan diketik manual. Pintu Tantangan 2 & 3 di lorong masih terkunci ("segera hadir").
- Kinerja: ruangan baru tidak menambah PointLight (memakai material berpendar) agar tetap ringan di ponsel & headset VR.

## Pembaruan v9 — Tahap 2, Lencana & Capaian
- **4 ruang tantangan di Lantai 2 IT-Mart** (setelah verifikasi Nan): Kognitif (matematika), Bahasa Inggris, Sahabat Rasulullah, Dasar Coding. Masing-masing 20 soal pilihan ganda acak dalam 60 detik; satu salah atau waktu habis → kembali ke Nan. Bank soal ada di `CH_BANK` (Inggris/Sahabat/Coding, 25 soal per bank, 20 diambil acak) dan `COG_BANK` (matematika).
- **Teh Fety** (paviliun putih, Taman Apresiasi): menyematkan **Lencana Pengetahuan Dasar** bila keempat tantangan tuntas (butuh Explorer Card).
- **Kode cepat tahap 2**: ketik `butnavudivoxyziz2` ke **Sit** (waitress IT-Mart) → keempat tantangan dinyatakan tuntas, berhak atas lencana dari Teh Fety. Kode disimpan sebagai hash.
- **Menu CAPAIAN** (tombol 🏅 di bilah atas / menu ☰): sertifikat, Explorer Card, 7 slot lencana (Dasar, Umum, IoT & Drone, Jari, Coding, Agama Islam, Kerjasama Tim).
- **Profil pemain**: klik avatar pemain lain (atau 👤 Profil di menu PEOPLE) → sertifikat, kartu (dicek ke database server) & lencananya.
- **Pamerkan**: tombol 📣 menyiarkan capaian ke semua pemain (melayang di atas avatar 15 detik + notifikasi "Lihat"). Ikon capaian kecil di atas kepala bisa dimatikan di menu Capaian.
- **Database kartu** (`DATA_DIR/kartu.json`) kini juga mencatat tantangan & lencana; terlihat di admin → tab Explorer Card. API publik baru: `GET /api/kartu/cek?no=…`; `POST /api/kartu/tantangan`, `POST /api/kartu/lencana` (butuh token pemilik kartu).
- **Lorong rahasia Lab SE**: selama misi 4 robot lab belum tuntas, dinding tertutup rapat dan tampak sama persis dengan dinding sekitarnya (tanpa celah, garis, atau simbol).

## Pembaruan v10 — Tahap 3 · Gua Pustaka
- **Pintu masuk**: rak buku Silvia (IT-Mart). Silvia memeriksa **Lencana Pengetahuan Dasar** ke database kartu server; bila valid, rak bergeser dan membuka lorong ke Gua Pustaka.
- **Gua gelap**: kabut pekat (±5 m terlihat jelas, selebihnya remang lalu gelap) + vinyet lentera; tombol "🔦 Lentera" memperbesar jarak pandang. **Mode solo**: pemain lain tidak terlihat dan tidak terdengar selama salah satu pihak berada di gua.
- **3 nyawa untuk 3 babak**:
  1. *Lantai Benar/Salah* — 10 pernyataan (3 tentang Kaprodi TI); berdiri di petak BENAR/SALAH dalam 9 detik. Salah → lantai runtuh, nyawa −1.
  2. *Lini Masa* — dekati prasasti, urutkan 2 set kartu (set urutan Kaprodi TI + sejarah atau penemuan). Seret kartu atau ▲▼. Salah → nyawa −1.
  3. *Galeri Benda* — 12 benda + 8 potret Kaprodi dalam gelap; 5 petunjuk acak, 35 detik per petunjuk; harus mendekat ±2 m untuk memilih. Salah pilih / waktu habis → nyawa −1.
- Nyawa habis → kembali ke Silvia. Lolos → pintu ujung gua terbuka; **Teh Puspa** (tersembunyi, tidak tercantum di PEOPLE/GO TO) menyematkan **Lencana Pengetahuan Umum**.
- **Kode cepat tahap 3**: `butnavudivoxyziz3` ke **Kang Santo** (hanya untuk pemegang Lencana Dasar) → langsung diantar ke Teh Puspa.
- Server: tantangan `pustaka` & lencana `umum` (syarat `pustaka` + lencana `dasar`) tercatat di `kartu.json`; tampil di admin → Explorer Card.
- **Nama NPC baru**: Ivy → Silvia, Sit → Patimah, Nan → Ananda, Dul → Haris, Vir → Virzha.
- **Lencana diganti**: Pengetahuan Alam → **Teknologi · IoT & Drone**; Geografi → **Keterampilan · Kerjasama Tim** (tantangannya menyusul).
- Bank soal di `public/index.html`: `CV_BS`, `CV_BS_KP` (Benar/Salah), `CV_LM` (lini masa), `CV_OBJ`, `CV_KP` (galeri).
- **Portal Ring 1** (sudut barat laut Taman Apresiasi): portal hitam yang kelak terbuka bagi pemegang **Black Card** (diberikan setelah 7 lencana). Saat ini dijaga **Kang Ritzkal**, yang tidak bisa diajak chatting dan hanya mengatakan: "Anda hanya dapat mengakses portal ini jika memiliki Black Card".

## Pembaruan v11 — Main ulang & sinkron lencana
- **Main ulang atau biarkan tuntas**: setiap pemenang (termasuk pengguna kode) mendapat pilihan saat mendatangi tantangannya:
  - *Ular Tangga (Lorong 4)*: tawaran muncul saat memasuki papan, ada tombol "🔁 Main ulang" di HUD, dan Kang Santo punya pilihan "Main ulang Ular Tangga". Main ulang memakai progres bayangan — status tuntas, sertifikat & akses taman tidak pernah hilang (Lubang Hitam hanya mengembalikan ke awal papan).
  - *4 ruang tantangan Lantai 2*: tombol "🔁 Main ulang" / "✅ Biarkan tuntas"; gagal saat main ulang tidak menghapus status tuntas. Menang sungguhan mengubah catatan server dari "kode" menjadi "main".
  - *Gua Pustaka*: "🔁 Main ulang dari Babak 1" / "✅ Biarkan tuntas · ke Teh Puspa".
- **Sinkron lencana lebih tangguh**: browser kini mencocokkan progres dengan database server dan mengirim ulang tantangan/lencana yang belum tercatat. Silvia menjelaskan penyebab bila tetap gagal (server belum versi terbaru / kartu tercatat di perangkat lain / kartu dicabut / server tidak terhubung).

## Pembaruan v12 — Tahap 4 · Hanggar Drone (Lencana IoT & Drone)
- **Akses**: **Haryani** (IT-Mart Lantai 2, di seberang Ananda) memeriksa Explorer Card + Lencana Pengetahuan Dasar + Lencana Pengetahuan Umum ke database server, lalu mengaktifkan **lift kaca di sisi timur laut Lab CSN**. Lift membawa pemain ke **Hanggar Drone** di atap (malam hari, langit berbintang, kota di kejauhan).
- **3 nyawa · 3 babak (sulit)**:
  1. *Rakit node sensor ESP32* — 6 komponen (DHT22, LDR, sensor tanah, PIR, relay, HC-SR04) dalam 4 menit. Jebakan: pin ADC2 tak bisa dipakai saat WiFi aktif, GPIO34–39 hanya input, ECHO 5 V butuh pembagi tegangan, DHT22 butuh pull-up, PIR butuh 5 V. Lalu 2 soal wawasan (MQTT, deep sleep).
  2. *Program otomasi kebun* — aturan JIKA…DAN…MAKA untuk pompa, kipas, dan lampu tumbuh; simulasi 24 jam dengan cuaca acak dan anggaran listrik harian. Gagal bila satu petak rusak atau listrik melebihi anggaran.
  3. *Misi drone* — daftar periksa pra-terbang, lalu terbang melewati 5 cincin yang makin sempit, menghindari menara antena, memindai petak yang node sensornya mati, menjatuhkan node pengganti (2 kesempatan), dan mendarat pelan di helipad. Ada angin berubah arah dan baterai terbatas. Lulus minimal **2⭐** (waktu ≤ 95 dtk, baterai ≥ 20%, mendarat ≤ 0,7 m dari tengah).
- **Kontrol**: laptop — W/S maju-mundur, A/D geser, Spasi/↑ naik, C/↓ turun, Q/E/←/→ putar, F jatuhkan; HP — dua joystick sentuh + tombol 📦.
- **Kang Hendri** (berkopiah) & **Kang Erwin** (rambut keriting) berdiri berdampingan di hanggar; bicara dengan salah satunya sama saja. Mereka memberi **Lencana Teknologi · IoT & Drone**.
- **Papan rekor** waktu misi drone tercepat (jalur main) di hanggar, data dari `GET /api/kartu/rekor?id=iot`.
- **Main ulang atau lewati** bagi yang sudah lulus. **Kode cepat**: `butnavudivoxyziz4` ke **Rahman** (hanya untuk pemegang Lencana Dasar & Umum).
- Server: tantangan `iot` (+ bintang) & lencana `iot` (syarat `iot` + lencana `umum`).

## Pembaruan v13 — Tahap 5 · Kawah Api (Lencana Keterampilan Jari)
- **Akses:** Sugiarti (Lab GIT) memeriksa Explorer Card, Lencana Dasar, Umum, dan IoT & Drone di server, **dan** pemain harus sedang memakai skin **Ronin Neon**. Setelah itu lubang tangga di lantai sebelahnya terbuka.
- **Kawah Api** (bawah tanah, 3 nyawa untuk 4 babak, dimainkan sendirian):
  1. **Jalur Lava**: celah yang harus diloncati, pijakan retak yang runtuh, pijakan bergerak, semburan lava, dan satu checkpoint.
  2. **Labirin Bola Api**: kumpulkan 3 rune. Ada bola patroli, bola pemburu yang mengejar bila dekat, dan bola pemantul yang bisa diloncati.
  3. **Labirin Bayangan**: gelap, hanya terlihat saat petir. Ada lantai jebakan, dan jatuh berarti −1 nyawa lalu mulai dari awal babak.
  4. **Kejaran Bola Batu**: labirin bercabang. Bola batu mengikuti jejak pemain dan melambat tiap kali membentur belokan.
- **Lencana:** Kang Safar & Teh Berlin di Aula Juara menyematkan **Lencana Keterampilan Jari**. Papan rekor Kawah Api memakai `GET /api/kartu/rekor?id=jari`.
- **Kode cepat:** `butnavudivoxyziz5`, diketik ke Haris (berlaku bagi pemegang 3 lencana sebelumnya).
- **Main ulang:** pemenang bisa memilih main ulang atau langsung ke Aula Juara.
- **Fitur baru di semua tempat:** loncat dengan **Spasi** (laptop) atau tombol **⤒ LONCAT** (HP).
- **Suara (Web Audio, tanpa berkas):** musik mencekam di Kawah Api plus guntur di Labirin Bayangan, detak jantung di tantangan Lantai 2 dan Gua Pustaka, dan desau angin saat menerbangkan drone.
- **HP:** panel info tantangan (Gua Pustaka, Hanggar, Kawah) pindah ke atas layar dan bisa diciutkan dengan mengetuk judulnya, sehingga joystick dan tombol tidak tertutup.
- **Server:** `kartu.js` mengenal tantangan `jari` dan lencana `jari` (prasyarat `iot`). Batas waktu rekor dinaikkan ke 60 menit. Admin menampilkan "Kawah ✓" dan "👆 Jari".
- Setelah deploy: `pm2 restart` (atau restart proses Node) agar `kartu.js` baru aktif.

## Perbaikan keamanan & stabilitas (pasca-v13)
- **Rate limit kartu memakai IP asli klien.** `kartu.js` kini memakai `clientIp()` yang sama dengan `peminatan.js` (membaca `X-Real-IP` dari Nginx lokal). Sebelumnya semua pengunjung di belakang Nginx terlihat sebagai `127.0.0.1` dan berbagi satu kuota (20 daftar / 60 verifikasi / 120 catat per 10 menit untuk seluruh pengguna).
- **Batas ruang.** `?room=` baru ditolak setelah `MAX_ROOMS` tercapai. Berkas `data/notes/<ruang>.json` kini hanya dibuat saat ada catatan ditambah/dihapus (bukan tiap ada sambungan), dan ruang yang kosong dibuang dari memori setelah 10 menit (catatan tetap di disk; coretan papan tulis ikut hilang).
- **Origin WebSocket** dicek secara bawaan (lihat `ALLOWED_ORIGINS`).
- Catatan: pastikan Nginx tetap meneruskan `Host` dan `X-Real-IP` seperti di `nginx.conf.example`.

## Pembaruan v14 — Tahap 6 · Dunia Server Lab KERIS (Lencana Pengetahuan Coding)
- **Hartono** (teknisi server, berkacamata) berjalan acak antara meja Kak Tias dan keempat lab sambil berkata "akan ada bahaya…".
  - Bertemu pemain **tanpa** Lencana Keterampilan Jari → "Kamu belum siap mengerjakannya."
  - Bertemu pemegang Lencana Keterampilan Jari → "Tolong bantu, apakah kamu bersedia membantu? Jika iya, ikuti aku." dengan pilihan **Bersedia / Tidak**. Bila bersedia, kartu & 4 lencana diverifikasi ke server, lalu Hartono berjalan mengantar ke rak **SERVER KERIS-08** (rak paling timur di Lab KERIS). Rak terbuka menjadi portal; melangkah ke depannya = masuk Dunia Server.
- **Dunia Server** (solo, 5 nyawa, 6 babak, bahasa campuran Python/JavaScript/pseudocode):
  1. *Robot Kurir* — susun blok `maju(n)`, `belok_kiri()`, `belok_kanan()`, `ulangi n× { }` (3 level, batas jumlah blok memaksa pemakaian perulangan); robot 3D menjalankan program, jatuh bila salah.
  2. *Pemburu Bug* — ketuk baris yang salah (3 bug, 45 dtk/program); salah → alarm & kode "bocor" berjatuhan.
  3. *Duel Kilat* — tebak output lebih cepat dari robot SENIOR-9000; tarik tambang ±3.
  4. *Brankas Hacker* — cari input fungsi yang menghasilkan target (3 gembok acak, 4 percobaan/gembok).
  5. *Lorong Laser* — 6 gerbang laser, tebak output; salah → dinding laser di belakang mendekat; tersentuh = nyawa −1.
  6. *Jinakkan Bom* — 3 bom (60/45/30 dtk) di meja resepsionis inti; potong kabel berisi potongan kode yang benar. Salah/waktu habis → ledakan: kilat putih, **gempa**, lantai & dinding **retak menjalar**, **asap**, puing, ruangan gosong lalu pulih.
- **Kang Sahid** (gamis putih, kopiah) & **Teh Gibtha** (kerudung hijau) di Aula Penyelamat menyematkan **Lencana Pengetahuan Coding**; papan rekor `GET /api/kartu/rekor?id=server`.
- **Kode cepat:** `butnavudivoxyziz6` diketik ke **Teh Puspa** (bagi pemegang Lencana Dasar, Umum, IoT & Drone, Jari).
- Server: tantangan `server`, lencana `coding` (prasyarat `jari`). Admin menampilkan "Server ✓" dan "💻 Coding".

## Pembaruan v15 — Tahap 7 · Galeri Islam & Lembah Gurun (Lencana Pengetahuan Agama Islam)
- **Teh Mila** (kerudung putih) baru muncul di samping **Sudut Al-Qur'an** Atrium bila pemain memegang Lencana Pengetahuan Coding. Ia meminta pemain **berwudhu** dulu dan mengaktifkan lift kaca Lab CSN.
- **Tempat wudhu** di Hanggar Drone, di sebelah ruang praktik drone (barat panggung pilot). Klik anggota wudhu pada gambar sesuai urutan — tangan, mulut, hidung, wajah, lengan, ubun-ubun, telinga, kaki — masing-masing **3×**. Salah urutan → ulang dari awal. Selesai → animasi wudhu lengkap + doa setelah wudhu. Status wudhu berlaku untuk hari itu.
- Kembali ke Teh Mila: **Man Rabbuka? Ma Dinuka? Man Nabiyyuka? Ma Kitabuka?** Jawaban diketik (Latin atau Arab), toleran terhadap variasi penulisan (mis. "Allah SWT", "Nabi Muhammad", "Al-Qur'an", "Quran").
- **Galeri Islam** (40 × 26 m): dinding berisi ayat pilihan — teks Arab & terjemahan diambil langsung dari data mushaf `assets/quran/` (tidak diketik manual), termasuk Ayat Kursi di atas portal — dan 9 hadits populer. Murattal **Al-Ikhlas, Al-Falaq, An-Nas** berulang selama pemain di galeri (hanya di perangkat pemain; musik piano dimatikan).
- Portal di ujung galeri → **Lembah Gurun Senja** (musik piano diganti suara angin, gemericik air, dan kicau burung — semua Web Audio). **3 nyawa · 4 babak:**
  1. *Bayangan Waktu* — matahari bergerak di langit; tebak sholat yang sedang masuk waktunya dari ketinggian matahari & panjang bayangan tongkat istiwa' (dihitung dengan rumus yang sama dengan fitur adzan, untuk lokasi pemain/ Bogor dan tanggal hari ini). Lalu hadapkan badan ke **kiblat** dari kota acak (rumus lingkaran besar, toleransi ±10°).
  2. *Jembatan Ayat* — seberangi ngarai lewat 5 tiang; tiap tiang 3 gerbang. Soal dibangkitkan otomatis dari data mushaf (Juz 30, Al-Fatihah, Ayat Kursi, akhir Al-Baqarah): sambung ayat, tebak surah dari terjemahan, Makkiyah/Madaniyah, jumlah ayat; tombol 🔊 murattal. Gerbang salah → jembatan runtuh.
  3. *Peta Hijrah* — susun lini masa 6 peristiwa sirah acak, lalu tempatkan tiap peristiwa di lokasinya pada peta raksasa (Makkah, Bukit Aqabah, Gua Tsur, Hudaibiyah, Badar, Quba, Madinah, Uhud).
  4. *Simpang Akhlak* — 5 skenario etika digital (tabayyun, menyalin kode, celah keamanan, ghibah di grup, janji ke klien) dengan dalil; jalan keliru → kabut turun, nyawa −1.
- **Serambi masjid**: **Kang Fitrah** (berjenggot) & **Teh Freza** (kerudung putih), keduanya berbaju putih, menyematkan **Lencana Pengetahuan Agama Islam**; papan rekor `GET /api/kartu/rekor?id=islam`.
- Server: tantangan `islam`, lencana `islam` (prasyarat `coding`).
- **Mohon ditinjau dosen/ustadz**: teks hadits (Arab & terjemahan) di Galeri Islam ditulis manual di `IS_HADITS`, lafaz niat & doa wudhu di `IS_NIAT`/`IS_DOA_WUDHU`, serta data sirah `IS_SIRAH` dan skenario `IS_AKHLAK`. Ayat Al-Qur'an selalu diambil dari data mushaf.
- Setelah deploy: `pm2 restart` agar `kartu.js` baru aktif.
- Daftar dosen IT-Mart (`DOSEN_TI`): nama lengkap "Bu Mila" kini **Nurul Kamilah, M.Kom.** (lab GIT).
- Panel tantangan (Dunia Server, wudhu, Lembah Gurun) otomatis menutup jendela obrolan NPC agar tidak bertumpuk di sisi kanan.
- Hartono hanya mengajak pemain yang **belum** menuntaskan Dunia Server; yang sudah tuntas cukup disapa (main ulang tetap bisa lewat obrolan dengannya).
- **Kode cepat tahap 7:** `butnavudivoxyziz7` diketik ke **Kang Jejen** — NPC baru (bertubuh gemuk) yang duduk ngopi di meja tengah IT-Mart bersama **Kang Bayu** (kurus). Berlaku bagi pemegang Lencana Dasar, Umum, IoT & Drone, Jari, dan Coding; pemain langsung diantar ke serambi masjid (Kang Fitrah & Teh Freza). Keduanya sesekali mengobrol (balon kata) saat pemain berada di IT-Mart; kursi mereka tidak bisa diduduki pemain.

## Pembaruan v16 — Tahap 8 · Kerjasama Tim (Lencana Kerjasama Tim)
- **Syarat:** memiliki 6 lencana (Dasar, Umum, IoT & Drone, Jari, Coding, Agama Islam) yang **tercatat di database kartu server** dan belum pernah menang Kerjasama Tim. Pemain yang kalah boleh membentuk tim baru; pemenang tidak bisa membentuk/bergabung ke tim baru.
- **Papan "Penjelajah 6 Lencana"** di Taman Apresiasi (timur jalan setapak, dekat Kang Santo): daftar pemegang 6 lencana dari server (`GET /api/tim/papan`, hanya nama), 🟢 = sedang online, 🏆 = juara. Klik papan untuk daftar lengkap.
- **Kang Bayu** (IT-Mart) membantu membentuk tim: *Buat tim* (kode 4 huruf), *Gabung tim* (masukkan kode), *Cari teman* (pemegang 6 lencana yang online + tombol Ajak → muncul undangan di layar teman). Lobi: 6 slot, tombol SIAP, ketua menekan **Mulai** bila 6 anggota online & siap; anggota bisa dikeluarkan ketua. Keenam pemain dipindahkan bersama dan **tidak terlihat** pengunjung lain selama tantangan. Chat galeri otomatis menjadi chat tim + tombol cepat (Siap, Tunggu, Kiri, Kanan, …).
- **Game 1 · Ruang Kendali** — 6 konsol mengelilingi inti server. Nilai (warna + angka) konsolmu tampil di layar rekan lain: putaran 1 satu layar, putaran 2 warna & angka di dua layar berbeda, putaran 3 berupa simbol + hitungan dengan **satu Pemegang Kunci Simbol**. Keenam konsol harus dikunci lalu diperiksa server sekaligus (salah → jumlah konsol salah diumumkan, waktu −15 dtk; waktu habis → nilai diacak ulang).
- **Game 2 · Platform Seimbang** — platform melayang 18×18 m miring ke arah pusat berat keenam pemain; bola emas menggelinding di labirin acak (selalu ada jalan) menghindari lubang, ada titik simpan, menuju gerbang hijau. Fisika bola dihitung server; peta mini menampilkan labirin, bola, dan pusat berat tim.
- **Game 3 · Pintu Bertekanan** — Pintu A (2 pelat di satu sisi), Timbangan pintu B (tepat *n* orang di pelat ungu & *m* di pelat biru selama 2,5 dtk), Lorong Laser (laser mati selama pelatnya diinjak; tersentuh → kembali ke awal lorong), Brankas (6 pelat emas yang berputar harus diinjak bersamaan 4 dtk).
- **Game 4 · ???** — dirahasiakan dari pemain. Kode kliennya ada di `tim/g4client.js` (di luar `public/`, **jangan dipindah ke public/**) dan hanya dilayani `GET /api/tim/g4.js?t=<tiket>` dengan tiket per pemain (maks. 2 unduhan, berlaku 2 menit) saat tim menuntaskan Game 3. Isinya *battle royale futuristik*: senjata energi (pistol pulsa ∞, senapan plasma, senapan rel, penyebar ion), perisai & sel amunisi, 3 nyawa, kebal 2 dtk setelah terkena, proyektil terlihat (bukan hitscan), zona "badai data" menyempit, batas 7 menit (penentu: sisa nyawa → jumlah tembakan kena), musik elektronik yang makin cepat & detak jantung saat sisa 1 nyawa. Semua tembakan/kena/nyawa/amunisi/item dihitung server. Pemain yang tersingkir langsung dikeluarkan (tanpa menonton), chat dimatikan, hasil hanya menyebut pemenang.
- **Putus koneksi:** Game 1–3 dijeda, anggota punya 90 detik untuk tersambung lagi (otomatis kembali ke permainan); bila tidak, tim dibubarkan. Game 4: putus = tersingkir. Tombol 🚪 Mundur membubarkan tim untuk semua anggota.
- **Hadiah:** satu-satunya pemenang dipindahkan ke **Aula Kerjasama Tim** — **Teh Dewi** (kerudung ungu muda, blazer abu-abu) & **Kang Eko** (kemeja batik cokelat, berkacamata) menyematkan **Lencana Kerjasama Tim**, lalu pemain berjalan ke **Kang Santo** untuk menerima **Black Card** (template hitam-emas `assets/ext/black-card.jpg`, nama/nomor/tanggal diisi otomatis, bisa diunduh PNG; juga lewat 🏅 Capaian). Akses Portal Ring 1 menyusul. Semua peserta yang mencapai Game 4 mendapat skin **Tentara Futuristik** (Lemari Skin) — skin ini juga dipakai semua pemain selama Game 4.
- Server: modul baru `tim.js` (tim, lobi, Game 1–4, putus koneksi, papan) terhubung lewat pesan WebSocket `tim_*`; lencana `tim` & `ch.tim` **hanya ditulis server** (tidak bisa dikirim klien lewat `/api/kartu/lencana`); `rw.trooper` = hadiah skin; `tm` = statistik ikut. Admin menampilkan "🤝 Kerjasama Tim", "Tim n×", 🪖.
- Uji coba: `TIM_N=2 node server.js` mengecilkan ukuran tim untuk uji internal. Disarankan uji nyata bersama 6 mahasiswa sebelum dibuka.
- Setelah deploy: `pm2 restart` (berkas server baru: `tim.js`, folder `tim/`).
- **Kebijakan kode rahasia (v16.1):** tidak ada NPC yang menyebut, menawarkan, atau mengisyaratkan kode rahasia/kode cepat — tombol "Ada kode rahasia?" (Kang Jejen) diganti "Tips tantangan?", peran & pengetahuan NPC dibersihkan, pemain yang belum memenuhi syarat mendapat jawaban biasa (keberadaan kode tidak diakui), dan pesan setelah kode diterima tidak lagi memuat kata "kode". NPC tetap boleh membahas lorong rahasia dan memberi petunjuk tantangan. Kode-kode cepat masih berfungsi diam-diam untuk admin (daftar di README bagian sebelumnya).
- **Perbaikan tembus dinding (v16.2):** saat berlari cepat (kecepatan 2× + Shift/joystick penuh, atau frame tersendat di ponsel) satu langkah bisa sampai 0,64 m sehingga melewati garis tengah dinding tipis (Labirin Lorong 1, pagar tangga IT-Mart, dinding Lantai 2) lalu pemain terdorong ke sisi sebaliknya. Gerak kini dipecah menjadi langkah ≤ 0,12 m (`tryMove` → `tryMoveStep`). Uji otomatis: Labirin 196/201 → 0 tembus, IT-Mart 9/11 → 0, Lantai 2 16/16 → 0.
- **Hanggar Drone · Babak 1 baru "Kabel Jumper" (v16.3):** menggantikan rakitan berbasis dropdown. Satu komponen per giliran (DHT22, LDR, sensor tanah, PIR, relay, HC-SR04 — urutan acak): tarik kabel dari pin komponen ke pin ESP32 (atau ketuk-ketuk di ponsel), ketuk kabel sinyal untuk menyisipkan resistor pull-up 10kΩ atau pembagi tegangan 1k/2k, arahkan ke pin ESP32 untuk melihat kemampuannya (ADC1/ADC2/input saja). "⚡ Nyalakan": benar → komponen menyala & Serial Monitor menampilkan data; salah → percikan, penjelasan, nyawa −1 dan kabel yang salah dilepas. GPIO yang sudah dipakai terkunci. Aturan kelistrikan sama dengan versi lama (3V3 vs 5V, ADC1 saat WiFi, pin input-saja, pull-up DHT22, pembagi tegangan ECHO). Setelah 6 komponen → 2 soal wawasan seperti sebelumnya.
- **Main ulang untuk pemakai kode cepat (v16.3):** semua tahap sudah menyediakan "Main ulang" bagi pemain yang tuntas lewat kode (Lantai 2, Ular Tangga via Kang Santo, Gua Pustaka, Hanggar, Kawah Api, Dunia Server, Lembah Gurun). Tambahan: 10 teka-teki Lorong 3 kini bisa dijawab ulang (status tetap tuntas), dan Hartono menanggapi "main ulang".
- **Perbaikan notifikasi murattal (v16.4):** setelah audio Al-Qur'an selesai/dihentikan, muncul berulang "Audio murattal tidak dapat dimuat (periksa koneksi internet)". Penyebab: `qrStop()` mengosongkan `src` audio sementara penangan `onerror` masih terpasang — browser menganggap src kosong sebagai error. Kini penangan dilepas sebelum audio dihentikan, error dari pemutaran lama diabaikan, dan pesan gagal sungguhan paling banyak sekali per 8 detik.
- **Kang Aftaf (v16.5):** NPC baru yang duduk sendirian di meja timur depan IT-Mart. Ia bercerita betapa serunya tantangan-tantangan galeri, menegaskan bahwa VR ini tidak sekadar untuk peminatan, mengajak pemain menjelajah lebih jauh untuk mendapatkan Explorer Card dan lencana, serta dengan ragu menyebut rumor tentang Black Card. Sesekali bergumam (balon kata) bila pemain berada di dekatnya. Tidak menyebut kode rahasia apa pun.
- **Kelas 1, Kelas 2 & Ruang Rapat (v16.5):** tiga ruang baru berpintu kaca geser otomatis, semuanya terhubung dengan Ruang E-Portal (tercantum di denah, minimap, GO TO, dan penjelasan Patimah):
  - *Kelas 1 · Auditorium* (pintu biru, dinding selatan E-Portal sisi kiri) dan *Kelas 2 · Auditorium* (pintu toska, dinding timur E-Portal; berada di selatan IT-Mart): area dosen datar di depan (meja dosen + laptop, mimbar berlogo TI), lalu 8 baris lantai bertingkat (naik 0,25 m per baris) berisi 128 kursi dengan meja panjang; semua kursi bisa diduduki (tombol duduk / X). Lantai bertingkat juga berlaku untuk teleport VR.
  - *Smart board* 5,6 × 3,15 m di dinding depan tiap kelas (isi dan cara kerjanya: lihat v16.6).
  - *Ruang Rapat* (pintu kuning, dinding selatan E-Portal sisi kanan): panel kayu walnut, meja elips panjang berlis emas, kursi eksekutif dengan mikrofon meja, lampu gantung linear, kredenza, dan layar presentasi di dinding selatan (smart board, lihat v16.6). Diperbesar di v16.7: 18 × 24 m, meja elips 14 m, 25 kursi.

## Pembaruan v16.6 — Smart board dari admin, video sambutan, suara ruang kelas, mic & speaker wajib
- **Admin → tab "Smart Board & Video"** (akun admin peminatan):
  - *Video sambutan* Ruang Sambutan: tempel URL/ID YouTube → langsung berganti untuk pemain yang online.
  - *Smart board* (7 buah): Kelas 1, Kelas 2, Ruang Rapat, dan satu di tiap lab (KERIS, GIT, SE, CSN). Tiap smart board memakai mode **Slide** (unggah gambar JPG/PNG/WebP maks. 8 MB, bisa banyak sekaligus, urutkan ↑↓, beri judul, hapus) atau **YouTube**. Untuk PowerPoint/PDF, ekspor halaman menjadi gambar. Tanpa slide, layar menampilkan slide bawaan profil keempat lab.
  - Data: `DATA_DIR/smartboard.json` + gambar di `DATA_DIR/smartboard/` (modul server `smartboard.js`). API publik `GET /api/sb`, gambar `GET /sb/<id>.<ext>`.
- **Kelas 1, Kelas 2, Ruang Rapat — dibagikan ke semua pemain** di ruang (`?room=`) yang sama: slide yang dibuka (◀ ▶), coretan anotasi (warna, ketebalan, penghapus, bersihkan), serta putar/jeda/ulang video YouTube tersinkron lewat pesan WebSocket `sb_*`; pemain yang baru masuk langsung melihat slide aktif, coretan, dan posisi video terkini. Suara video (bisukan) dan "Perbesar" tetap per perangkat. Saat admin mengubah konten, slide/coretan/pemutaran direset.
- **Smart board lab — dimainkan masing-masing:** papan beroda di tiap lab (KERIS: dinding barat, GIT: dinding barat, SE: tengah ruang menghadap pintu, CSN: dinding selatan). Slide, coretan, dan video hanya di perangkat pemain itu.
- Video YouTube di smart board tampil langsung di layar 3D (CSS3D, seperti layar sambutan) selama pemain berada di ruangan itu; di mode headset VR atau bila embed tidak tersedia, tersedia tombol "Tonton di YouTube".
- **Suara tanpa batas jarak di Kelas 1, Kelas 2, dan Ruang Rapat:** pemain yang berada di ruangan yang sama saling mendengar dengan volume penuh tanpa pengeras suara (`VOICE_ROOMS`). Di luar ketiga ruang itu aturan jarak tetap (jelas ≤ 3 m, hilang ≥ 20 m).
- **Mikrofon & speaker wajib sebelum masuk** (selain izin lokasi): layar awal menampilkan kotak "WAJIB SEBELUM MASUK" — *Mikrofon* (minta izin + bilah level suara) dan *Speaker/headset* (putar suara tes → pilih "✅ Terdengar"). Tombol MASUK tertahan sampai keduanya siap. Setelah masuk, mikrofon langsung menyala (bisa dibisukan dengan tombol mikrofon); izin mikrofon dicabut saat bermain → pemain dikeluarkan ke layar awal.
- Setelah deploy: `pm2 restart` (berkas server baru: `smartboard.js`). Bila memakai Nginx, pastikan `client_max_body_size` ≥ 10m untuk unggah slide.

## Pembaruan v16.7 — Kelas & ruang rapat fungsional
- **Ruang Rapat diperbesar:** 18 × 24 m, meja elips 14 m, **25 kursi**, layar presentasi besar di dinding selatan.
- **Kapasitas = jumlah kursi:** Kelas 1 & 2 masing-masing 128 orang, Ruang Rapat 25 orang. Batas server dinaikkan: `MAX_PER_ROOM` default 200, `MAX_CLIENTS` default 300.
- **Jadwal & token (admin → tab "Kelas & Jadwal"):** jadwal sekali atau berulang tiap minggu (dengan tanggal akhir), bentrok di ruangan yang sama ditolak. Tiap jadwal mendapat **Token Peserta** (6 huruf, dibagikan dosen ke mahasiswa) dan **Kode Pengajar** (untuk dosen/pimpinan rapat); keduanya bisa diganti. Di luar jadwal ruangan terbuka bebas. Selama jadwal: pintu kaca terkunci, pemain memasukkan token di depan pintu; yang berada di dalam tanpa token saat sesi dimulai dipindahkan ke luar. Data: `DATA_DIR/kelas.json` (modul `kelas.js`).
- **Peran pengajar** (masuk dengan Kode Pengajar): kunci/buka kontrol smart board, **bisukan semua** peserta, **beri giliran bicara** kepada yang angkat tangan, **keluarkan** peserta (tidak bisa masuk lagi selama sesi itu), berbagi layar, buat polling. **Peserta:** angkat tangan ✋, chat ruangan, ikut polling, membaca/mengunduh notulen.
- **Panel kelas** (kiri layar) saat berada di ruangan: daftar peserta dengan indikator sedang bicara (juga cincin hijau di atas avatar), tab Chat, Notulen, Polling.
- **Notulen tertulis terstruktur:** Agenda, Ringkasan pembahasan, Keputusan/kesimpulan, Tindak lanjut. Di Ruang Rapat semua peserta boleh menulis; di kelas selama sesi hanya pengajar. Admin mengunduh notulen per sesi (HTML siap cetak/simpan PDF, lengkap dengan daftar hadir & hasil polling). Tidak ada rekaman suara.
- **Polling/kuis cepat:** 2–6 pilihan, hasil langsung, bisa ditampilkan di smart board.
- **Presensi otomatis** per sesi terjadwal: nama, nomor Explorer Card, peran, pertama masuk, terakhir keluar, total durasi hadir → unduh Excel di admin.
- **Server media (SFU) untuk suara & berbagi layar** (modul `sfu.js`, paket opsional `mediasoup` ~3.15, Node ≥ 18): tiap pemain mengirim satu aliran suara ke server; cocok untuk kelas besar. Indikator bicara dari server. Peserta yang dibisukan pengajar benar-benar dijeda di server.
  - **Berbagi layar laptop → smart board:** pengajar (atau siapa saja di luar jadwal) menekan "🖥 Bagikan layar" di panel kelas, memilih layar/jendela/tab di browser laptop, dan tampilannya muncul di smart board untuk semua peserta.
  - Variabel: `SFU_ANNOUNCED_IP` (**wajib**: IP publik server), `SFU_PORT` (default 44444), `SFU_LISTEN_IP` (default 0.0.0.0), `SFU=0` untuk mematikan. **Buka port 44444 UDP dan TCP** di firewall (mis. `sudo ufw allow 44444/udp && sudo ufw allow 44444/tcp`). Lalu lintas media tidak lewat Nginx.
  - Tanpa SFU (paket tidak terpasang/port tertutup) suara kelas kembali ke mode langsung peer-to-peer (cocok ±10 orang) dan berbagi layar tidak tersedia.
- **Unggah PDF & PowerPoint ke smart board:** di tab "Smart Board & Video", file PDF diubah menjadi slide (satu halaman = satu slide) langsung di browser admin; file .pptx diubah ke PDF dulu di server dengan LibreOffice (`sudo apt install libreoffice-impress`), bila belum terpasang admin diminta mengunggah PDF.
- **Slide & coretan smart board tersimpan** (`DATA_DIR/smartboard-live.json`) sehingga tidak hilang saat server di-restart.
- Setelah deploy: `npm install` (memasang mediasoup), atur `SFU_ANNOUNCED_IP`, buka port 44444, lalu `pm2 restart`.

## Pembaruan v17 — Portal Ring 1 · Lembah Purba, 60 skin, Daftar NPC
- **Kode cepat tahap 8:** `butnavudivoxyziz8` diketik ke **Kang Aftaf** (IT-Mart). Kode ini diverifikasi **server** (`POST /api/kartu/kode`, hanya hash yang disimpan) dan hanya berlaku bagi pemegang 6 lencana. Pemain langsung mendapat Lencana Kerjasama Tim + skin **Tentara Futuristik**, diantar ke Aula Kerjasama (Teh Dewi & Kang Eko), lalu menerima Black Card dari Kang Santo. Kang Aftaf tetap tidak pernah menyebut kode.
- **Daftar NPC (kunjungi cepat):** menu PEOPLE → "Daftar NPC", atau menu ☰.
  - Setiap NPC yang pernah diajak bicara tercatat. NPC tersembunyi (Kang Santo, Teh Fety, Teh Puspa, penguji lencana, dll.) baru muncul setelah ditemui; sisanya tampil sebagai "??? · belum ditemui". Pemain lama otomatis dianggap sudah bertemu NPC sesuai progres lencananya.
  - Panel berisi pencarian, kelompok (Penyambut & Pemandu Lab, IT-Mart & Kafe, Penjaga Tantangan, Pemberi Lencana & Hadiah), dan kartu NPC dengan tombol **Kunjungi**.
  - Tombol Kunjungi langsung mengantar ke NPC, termasuk yang berada di dalam area tantangan (Gua Pustaka, Hanggar, Aula Juara Kawah Api, Dunia Server, Serambi Masjid, Aula Kerjasama, Lembah Purba). Untuk mengulang tantangan, pemain mendatangi penjaga awal dan memilih "main ulang" di chat.
- **Katalog 60 skin (SKN-001…SKN-060):** model 3D bergaya kotak dibangun dari data katalog (tipe tubuh, warna, rambut, penutup kepala, barang di tangan, aksesori punggung). Ilustrasi katalog disimpan di `public/assets/skins/` (240×320) sebagai kartu pratinjau.
  - Skin katalog **tidak** ditampilkan sekaligus: hanya yang sudah dimiliki. Skin Portal Ring 1 (**Flinstone**, **Indian**, **Raptor**) terlihat — terkunci — hanya bagi pemegang Black Card.
  - Skin lain dibuka satu per satu oleh tantangan-tantangan berikutnya (cukup `sktGrant(["SKN-0xx"])` di kode tantangan).
- **Lemari Skin baru:** pencarian, filter (Semua / Eksklusif / Portal Ring 1 / Katalog), dan carousel 4 kartu per halaman (◀ ▶, titik halaman, geser di HP; di HP 2×2).
- **Portal Ring 1 terbuka** bagi pemegang Black Card. Kang Ritzkal mempersilakan masuk. Di gerbang pemain memilih **Flinstone** atau **Indian** (keduanya masuk koleksi). Selama di **Lembah Purba** skin tantangan dipakai otomatis dan kembali ke skin semula saat keluar.
- **Lembah Purba:** pakis, sikas, gunung api berasap, brachiosaurus berjalan di kejauhan, pterosaurus berputar, sungai, langit senja, suara alam purba (Web Audio).
- **Tantangan 1 · Pohon Purba (80 m) melawan Andrian** (skin Pelukis Gua):
  - Jalur melingkari batang: tanjakan dahan, jamur, celah yang harus diloncati, kulit kayu lapuk yang runtuh, **dahan rapuh** yang berderak lalu patah bila diinjak terlalu lama (±2 detik), dan daun pengangkat. Ada titik simpan.
  - **Kabut makin tebal saat makin tinggi** — di puncak jarak pandang tinggal belasan meter.
  - Jatuh lebih dari 4 m → nyawa −1 (3 nyawa) dan kembali ke titik simpan.
  - **3 batu prasasti** (±22, 46, 67 m): soal persamaan, pertidaksamaan, dan integral — pilihan ganda, dibangkitkan acak sehingga tiap percobaan berbeda. Salah → nyawa −1 dan soal baru. Andrian ikut berhenti selama pemain menjawab.
  - Tiba di puncak lebih dulu → **Batu Kuning**. Papan rekor `GET /api/kartu/rekor?id=pohon`.
- **Tantangan 2 · Raptor Run melawan Azka** (skin Raptor; pemain juga mendapat skin Raptor dan memakainya selama balapan). Terbuka setelah Batu Kuning.
  - Raptor berlari otomatis 2 putaran (±940 m) di 3 jalur. Laptop: ←/→ atau A/D, Spasi/↑ loncat. HP: geser layar atau tombol ◀ ⤒ ▶.
  - Rintangan kecil (batang kayu, retakan lava, lumpur) hanya memperlambat; rintangan besar (batu, kaki dinosaurus, triceratops menyeberang, pterosaurus menukik) mengurangi nyawa (3).
  - Booster ⚡ (kecepatan) dan 🛡 (perisai cangkang telur) — Azka juga mengincarnya.
  - Menang → **Batu Hijau**, Andrian & Azka memberi salam penghormatan, dan gerbang berikutnya tampak (masih tersegel). Papan rekor `?id=raptor`.
- **Batu Portal Ring 1:** 9 slot di Capaian (kuning, hijau, merah, biru tua, oranye, ungu, biru langit, putih, hitam), hanya tampil bagi pemegang Black Card. Server: `POST /api/kartu/batu` (wajib lencana tim + tantangan terkait, berurutan), `GET /api/kartu/cek` kini memuat `batu`. Admin menampilkan "Pohon Purba ✓", "Raptor ✓", dan "Batu: 🟡🟢".
- Server: tantangan baru `pohon`, `raptor`; endpoint `/api/kartu/batu` dan `/api/kartu/kode`. Setelah deploy: `pm2 restart`.

## Pembaruan v17.1 — Peningkatan visual

- **Skin:** jenggot & kumis di bawah mulut (tidak menutupi wajah), hijab/tudung bulat yang membingkai wajah, barang dipegang di tangan dengan pose lengan, dan 4 varian warna kulit (Terang, Kuning langsat, Sawo matang, Gelap) untuk setiap skin manusia — dipilih lewat titik warna di Lemari Skin.
- **Dinosaurus:** raptor, brontosaurus, triceratops & pterosaurus dibentuk ulang dengan badan meruncing yang mulus, tekstur bercak, perut terang, gigi, mata, jambul bulu dan cakar sabit.
- **Pohon Purba:** pijakan kini berupa 108 daun besar — daun **kuat** (hijau), daun **rapuh** (kuning berlubang, jatuh bila diinjak ±1 detik lalu tumbuh lagi) dan daun **bergoyang** (ikut membawa pemain). Batang lathe bertekstur dengan akar, sulur, pakis dan kanopi.
- **Lembah Purba:** 8 siluet brontosaurus raksasa yang berjalan di balik bukit, gunung berapi dengan aliran lava & asap, sungai mengalir, bukit organik, batu berlumut, pakis 3D dan pohon sikas.
- **Raptor Run:** rintangan baru — batu berlumut, kayu tumbang, lumpur bergelembung, retakan lava, kaki sauropoda raksasa, triceratops dan pterosaurus menukik.
- **Kawah Api:** dinding Labirin Bola Api & Kejaran Bola Batu kini batu basal bergerigi dengan retakan lava berdenyut, stalaktit, uap panas, bara melayang dan debu di belakang bola batu.
- Soal pertidaksamaan/nilai mutlak kini ditulis rapi (mis. `|x + 3|`, bukan `|x − -3|`).

Setelah memperbarui berkas: `pm2 restart all` (atau jalankan ulang `node server.js`).

## Pembaruan v17.2 — Dunia Seni & Desain (Tantangan 3 Portal Ring 1) & slot Black Card

- **Gerbang ke Dunia Seni & Desain:** gerbang di dekat garis start Raptor Run terbuka bagi pemegang Batu Hijau. Pemain otomatis memakai skin **UI/UX Designer** (SKN-052, masuk koleksi), sama dengan penjaganya, **Kang Eq**.
- **Anti-Gravity UI Race** (lawan Kang Eq):
  - Gravitasi berganti dengan pola tetap: 6 detik normal, lalu 8 detik melayang. Ada hitungan mundur, bunyi peringatan 3 detik sebelum berganti, dan panel status di atas layar.
  - Saat melayang, gerak dengan WASD/joystick. Naik dengan Spasi (▲) dan turun dengan C/F (▼); di HP lewat tombol ▲/▼.
  - Ada 5 pijakan berbentuk komponen UI: Button, Card, Toggle, Slider, Input Field. Pijakan berikutnya menyala dengan kotak seleksi biru. Pijakan yang belum terbuka tampil sebagai garis putus-putus dan bisa ditembus.
  - Setiap pijakan berisi satu soal Multimedia/UI-UX pilihan ganda. Bank soal berisi 45 soal dan 5 di antaranya diacak setiap percobaan.
  - Selama pemain menjawab, siklus gravitasi dan Kang Eq ikut berhenti.
  - Jawaban salah membuat pijakan runtuh dan pemain jatuh. Pemain yang belum berpijak saat gravitasi kembali jatuh ke jurang. Setiap kali jatuh, permainan diulang dari awal (Kang Eq juga kembali ke garis mulai).
  - Bayangan dan garis bantu merah muda menunjukkan pijakan di bawah pemain (merah berarti tidak ada pijakan). Garis ukur (redline) menunjukkan jarak antarpijakan.
  - Yang pertama mendarat di tombol **PUBLISH** menang dan mendapat **Batu Merah**. Kang Eq memberi salam hormat, lalu muncul gerbang berikutnya (masih tersegel).
- **Server:** tantangan `gravitasi` tercatat dan masuk papan rekor. Batu Merah hanya diterima setelah tantangan `gravitasi` tercatat dan pemain memiliki Batu Hijau. Halaman admin menampilkan "Anti-Gravitasi ✓".
- **Capaian:** slot **Black Card** di samping Sertifikat dan Explorer Card, dengan tombol Lihat dan Pamerkan (ikon 🖤 di atas kepala). Profil pemain lain juga menampilkan Black Card.
- **Kang Eq** masuk Daftar NPC (kunjungi cepat) setelah ditemui.

Setelah memperbarui berkas: `pm2 restart all` (atau jalankan ulang `node server.js`).

## Pembaruan v17.3 — Smart board YouTube
- Video YouTube diputar di **smart board di dinding ruangan**, bukan di jendela panel. Setelah ▶ Putar ditekan, jendela panel otomatis tertutup supaya videonya terlihat. Untuk menonton di jendela besar, gunakan ⛶ Perbesar.
- Kalau browser menahan pemutaran bersuara (kebijakan autoplay), video tetap diputar tanpa suara dan pemain diberi tahu cara menyalakan suaranya.

## Pembaruan v17.4 — Diagnosa media kelas (SFU)
- Panel kelas kini menampilkan status sambungan media: **📡 Media: tersambung / menyambung… / GAGAL tersambung (port 44444?)**. Kalau sambungan gagal atau belum tersambung setelah 12 detik, pemain mendapat peringatan.
- Peserta mendapat pemberitahuan bila layar pengajar tidak sampai ke perangkatnya dalam 9 detik.
- Server mencatat di `pm2 logs` bila sambungan media (DTLS/ICE) gagal, lengkap dengan port dan `SFU_ANNOUNCED_IP` yang dipakai.
- Diuji dengan dua peserta (pengajar berbagi layar → layar 1920×1080 diterima peserta) saat port SFU terjangkau.

## Pembaruan v18 — Nyawa per babak, Azis & Arena Mengetik (Tantangan 4 Portal Ring 1)
- **6 nyawa di setiap babak** untuk semua tantangan bernyawa: Gua Pustaka, Hanggar Drone, Kawah Api, Dunia Server, Lembah Gurun, Pohon Purba, Raptor Run, dan Game 4 Kerjasama Tim. Nyawa terisi penuh lagi di awal setiap babak.
- **Gagal = ulang babak itu saja.** Bila nyawa habis, babak yang sedang dimainkan diulang dari awal; babak yang sudah tuntas tetap aman.
  - **Ular Tangga:** masuk Lubang Hitam hanya mengulang papan Ular Tangga, bukan lagi mulai dari Lorong 1.
  - **Ruang tantangan Lantai 2:** salah jawab atau waktu habis langsung mengulang tantangan ruangan itu dengan soal baru. Tombol menyerah tetap mengembalikan pemain ke Ananda.
- **Pohon Purba:** Andrian kini memanjat sangat lambat.
- **Raptor Run:** NPC penunggang raptor berganti nama menjadi **Azis**.
- **Arena Mengetik · Typing Master** (tantangan 4):
  - Gerbang di ujung kanvas Dunia Seni & Desain terbuka bagi pemegang Batu Merah. Arenanya ruangan modern: dua meja dengan keyboard RGB, dinding LED, dan pemandangan kota malam.
  - Lawannya **Azka**, berbaju hacker (skin Pentester Hoodie Hitam, SKN-049). Pemain ikut memakai skin yang sama dan skin itu masuk koleksi.
  - Lomba berlangsung 60 detik, mengetik kata-kata bahasa Indonesia. Spasi atau Enter mengirim kata, Backspace menghapus huruf. Bisa dimainkan di laptop maupun HP (keyboard layar).
  - Yang dinilai adalah **jumlah kata yang benar**. Azka mengetik sekitar 80 WPM (standar 5 karakter = 1 kata) dan sesekali salah ketik.
  - Kata benar lebih banyak dari Azka berarti menang dan mendapat **Batu Biru Tua**.
  - Papan rekor diurutkan dari kata terbanyak. Server mencatat tantangan `ketik`, dan Batu Biru Tua hanya diterima setelah tantangan `ketik` tercatat dan pemain memiliki Batu Merah.

Setelah memperbarui berkas: `pm2 restart all`.

## Pembaruan v18.1 — Jeda adzan di dalam game
- Saat waktu adzan tiba, pemain yang sedang bermain **tidak lagi dikeluarkan**. Layar berubah hijau dan permainan dikunci 15 menit di posisi terakhir.
  - Semua hitung mundur tantangan, gerak lawan, dan siklus waktu ikut berhenti, begitu juga keyboard dan sentuhan.
  - Musik diredam dan mikrofon dibisukan sementara.
- Di layar adzan tampil panduan **menjawab adzan** dan **doa setelah adzan** (teks Arab, latin, dan arti).
- Setelah 15 menit, tombol **▶ Lanjutkan bermain** aktif. Permainan baru berjalan lagi setelah tombol itu ditekan.
- Halaman login tetap terkunci selama jeda adzan seperti sebelumnya.
- Game Kerjasama Tim berjalan di server, jadi waktunya tidak ikut berhenti.

## Pembaruan v19 — Teh Isna & Ruang Komando (Tembak Kapal)
- **Teh Isna** menyerahkan batu di setiap kemenangan tantangan Portal Ring 1. Ia berkerudung, bersayap, dan bertubuh agak gemuk.
  - Ia turun melayang di dekat pemain, memberikan batunya, lalu mengingatkan jumlah batu yang sudah terkumpul.
  - Pesannya selalu sama: bila kesembilan batu terkumpul, sesuatu yang besar akan terjadi.
  - Ia juga muncul saat pemain memenangi ulang tantangan yang batunya sudah dimiliki.
- **Tantangan 5 · Tembak Kapal** melawan **Guido**, ahli GIS dan militer, di **Ruang Komando**.
  - Masuk lewat gerbang di sudut Arena Mengetik, yang terbuka untuk pemegang Batu Biru Tua.
  - Guido dan pemain memakai skin **Jenderal Strategis** (SKN-024) selama di ruangan.
  - Laut berukuran 12×12 (kolom A–L, baris 1–12). Masing-masing memasang 5 kapal: Induk 6, Tempur 5, Selam 4, Perusak 3, Patroli 2. Kapal dipasang manual (ketuk, putar dengan R atau klik kanan) atau dengan tombol 🎲 Acak.
  - Menembak bergantian satu kali per giliran. Kotak yang mengenai kapal berwarna merah; titik putih berarti meleset.
  - Yang lebih dulu menenggelamkan semua kapal lawan menang. Kalah berarti diulang dari awal (pasang kapal lagi).
  - Menang memberi **Batu Oranye**. Rekor dihitung dari jumlah tembakan paling sedikit.
- Server: tantangan `kapal` dan syarat Batu Oranye (setelah Batu Biru Tua) ditambahkan di `kartu.js`. Admin menampilkan "Tembak Kapal N tembakan ✓".
