# Lab Peminatan VR — Teknik Informatika UIKA Bogor

Galeri 3D/VR multi-user untuk sosialisasi 4 lab peminatan: **KERIS**, **GIT**, **SE**, dan **CSN**.
Dibangun di atas mesin "Galeri Media Imersif" (semua fiturnya tetap ada: multi-user, chat & balon,
emoji, kilau, obrolan suara WebRTC, megafon, foto & rekam layar, duduk, papan tulis, papan pesan,
kuis, zoom/unduh/tautan panel, denah + minimap, joystick ponsel, dan mode VR WebXR).

## Isi galeri
| Ruang | Isi |
|---|---|
| **Ruang Sambutan** (titik awal) | Layar besar dengan video YouTube sambutan di dalam dunia 3D (klik layar = putar/jeda, tombol SUARA & PERBESAR), slideshow "Kenali Lab Peminatan", papan bantuan, denah, headset VR |
| **Atrium Pendaftaran** (tengah) | Resepsionis **Kak Tias** + meja pendaftaran, QR & tautan Google Form, hologram 4 lab, kuis "Kasus ini cocok di lab mana?", papan tulis, papan pesan, 4 pintu lab |
| **Lab KERIS** (barat) | Tema pusat data: rak server berkedip, hologram jaringan saraf, workstation HPC, 11 slide + slideshow dokumentasi, layar 3 video Google Drive, robot **KERI** |
| **Lab GIT** (utara-kiri) | Tema geospasial: lantai peta kota neon, globe hologram + satelit, drone terbang, tumpukan layer peta, 13 slide + slideshow kegiatan/drone, video kegiatan lapangan, robot **GEO** |
| **Lab SE** (utara-kanan) | Tema studio developer: meja laptop berisi kode, beanbag, rak piala, kanban, neon motto, 16 slide + 3 slideshow (prestasi, produk, kegiatan), robot **CODY** |
| **Lab CSN** (timur) | Tema Network Operation Center: 3 layar monitoring animasi, hologram topologi dengan paket data mengalir, rak server, 8 slide, robot **NETA** |

- Nama karakter default: **IT'ers** (bisa diganti di Pengaturan).
- Setiap robot menjawab dari isi presentasi lab-nya sendiri (deskripsi slide + catatan FAQ di `content`), bisa memberi kuis, mengantar ke panel/lab, dan membacakan jawaban (suara browser). Bila ditanya hal lab lain, robot merujuk ke temannya.
- Musik **piano santai** dibangkitkan langsung di browser (WebAudio), berbeda nuansa untuk tiap lab dan memudar saat keluar lab. Tombol ♪ di toolbar untuk nyala/mati, volume di Pengaturan.
- Formulir pendaftaran: `https://forms.gle/fJfi9qn8QgmJCUdPA` (tombol di kartu resepsionis, kios "Daftar" di tiap lab, poster QR).

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

Tambahkan `?room=nama-kelas` di URL untuk memisahkan kelompok, mis. `https://domainanda/?room=ti-2026`.

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
