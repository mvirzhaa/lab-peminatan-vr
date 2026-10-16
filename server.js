// =====================================================================
//  Server multi-user Galeri Media Imersif
//  - Menyajikan galeri (public/index.html) + WebSocket di /ws
//  - Relay posisi avatar, chat, emoji, dan sinyal WebRTC (obrolan suara)
//  Jalankan:  npm install  &&  npm start      (default port 8080)
// =====================================================================
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { createPeminatan } = require('./peminatan');
const { createBuku } = require('./buku');
const { createKartu } = require('./kartu');

// baca file .env otomatis jika ada (memudahkan konfigurasi ADMIN_KEY, PEMINATAN_USER, dll tanpa terhambat cache PM2)
try {
  const envFile = path.join(__dirname, '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (m) {
        const k = m[1].trim();
        const v = (m[2] || '').replace(/^['"]|['"]$/g, '').trim();
        if (v && (!process.env[k] || process.env[k] === 'GANTI-DENGAN-KUNCI-RAHASIA' || process.env[k] === 'GANTI-DENGAN-PASSWORD-ADMIN-PEMINATAN')) {
          process.env[k] = v;
        }
      }
    }
  }
} catch {}


const PORT = +process.env.PORT || 8080;
const MAX_CLIENTS = +process.env.MAX_CLIENTS || 150;     // total koneksi
const MAX_PER_ROOM = +process.env.MAX_PER_ROOM || 60;    // per ruang (?room=kelas-a)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean); // kosong = semua
const MAX_MSG = 16 * 1024;           // byte per pesan (16 KB)
const RATE = 60;                     // pesan per detik per klien
const PUBLIC = path.join(__dirname, 'public');
const MAX_HOF_MSG = 64 * 1024;       // pesan Hall of Fame (berisi foto) boleh s.d. 64 KB

// ---- Hall of Fame: disimpan permanen di folder data/ (global untuk semua ruang) ----
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const PHOTO_DIR = path.join(DATA_DIR, 'hof');
const HOF_FILE = path.join(DATA_DIR, 'hof.json');
fs.mkdirSync(PHOTO_DIR, { recursive: true });
let HOF = [];
try { const raw = JSON.parse(fs.readFileSync(HOF_FILE, 'utf8')); if (Array.isArray(raw)) HOF = raw.filter(e => e && /^[a-f0-9]{16}$/.test(e.id) && typeof e.n === 'string'); } catch { /* belum ada */ }
let hofSaveT = null;
function hofSave() {
  clearTimeout(hofSaveT);
  hofSaveT = setTimeout(() => {
    const tmp = HOF_FILE + '.tmp';
    fs.writeFile(tmp, JSON.stringify(HOF), err => { if (!err) fs.rename(tmp, HOF_FILE, () => {}); });
  }, 300);
}
const hofPublic = e => ({ id: e.id, n: e.n, t: e.t, v: e.v });
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const cleanHofName = v => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/[^\p{L}\p{N} .,'\u2019~-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
function decodePhoto(d) {
  // hanya JPEG base64 kecil yang diterima; byte awal harus penanda JPEG asli
  if (typeof d !== 'string' || d.length > 60000) return null;
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(d); if (!m) return null;
  const b = Buffer.from(m[1], 'base64');
  if (b.length < 800 || b.length > 45000 || b[0] !== 0xFF || b[1] !== 0xD8 || b[2] !== 0xFF || b[b.length - 2] !== 0xFF || b[b.length - 1] !== 0xD9) return null;
  return b;
}
let hofGlobal = { t: 0, n: 0 };

// ---- Pendaftaran peminatan (pengganti Google Form) + halaman admin ----
const pem = createPeminatan({
  dataDir: DATA_DIR,
  // setiap perubahan data → kirim statistik terbaru ke semua pengunjung (pie chart & papan pengumuman)
  onChange: (stats) => { for (const c of wss.clients) send(c, { type: 'pem', s: stats }); }
});
// ---- Rak Buku Digital IT-Mart (PDF) — dikelola dari halaman admin yang sama ----
const buku = createBuku({ dataDir: DATA_DIR, pem, onChange: () => { for (const c of wss.clients) send(c, { type: 'buku' }); } });

const kartu = createKartu({ dataDir: DATA_DIR, pem });

// ---- Papan Pesan IT'ers: disimpan permanen per ruang (?room=) di DATA_DIR/notes/<ruang>.json ----
const NOTES_DIR = path.join(DATA_DIR, 'notes');
fs.mkdirSync(NOTES_DIR, { recursive: true });
const MAX_NOTES = 5000;
const notesFile = (room) => path.join(NOTES_DIR, room + '.json');
function loadNotes(room) {
  try { const a = JSON.parse(fs.readFileSync(notesFile(room), 'utf8')); if (Array.isArray(a)) return a.filter((n) => n && typeof n.t === 'string' && typeof n.id === 'string'); } catch { /* belum ada */ }
  return null;
}
const notesSaveT = new Map();
function saveNotes(room, notes) {
  clearTimeout(notesSaveT.get(room));
  notesSaveT.set(room, setTimeout(() => { const f = notesFile(room), tmp = f + '.tmp'; fs.writeFile(tmp, JSON.stringify(notes), (e) => { if (!e) fs.rename(tmp, f, () => {}); }); }, 250));
}
const notePublic = (n) => ({ id: n.id, n: n.n, t: n.t, time: n.time });
const ADMIN_PAGE = path.join(PUBLIC, 'admin', 'index.html');
const ADMIN_CSP = "default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp4': 'video/mp4', '.webm': 'video/webm', '.otf': 'font/otf', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const secHeaders = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN', 'Permissions-Policy': 'geolocation=(self), microphone=(self), xr-spatial-tracking=(self), autoplay=(self "https://www.youtube-nocookie.com" "https://www.youtube.com" "https://drive.google.com"), fullscreen=(self "https://www.youtube-nocookie.com" "https://www.youtube.com" "https://drive.google.com")' };
  let u, p; try { u = new URL(req.url, 'http://x'); p = decodeURIComponent(u.pathname); } catch { res.writeHead(400, secHeaders); return res.end(); }
  if (p.startsWith('/buku/') && (req.method === 'GET' || req.method === 'HEAD') && buku.serveFile(req, res, p)) return;
  if (p.startsWith('/api/admin/notes')) return adminNotes(req, res, p, u);
  if (p.startsWith('/api/kartu/') || p.startsWith('/api/admin/kartu')) return Promise.resolve(kartu.handle(req, res, p)).then((done) => { if (done === false) pem.handle(req, res, p, u); });
  if (p.startsWith('/api/buku') || p.startsWith('/api/admin/buku')) {
    return Promise.resolve(buku.handle(req, res, p, u)).then((done) => { if (done === false) pem.handle(req, res, p, u); });
  }
  if (p.startsWith('/api/')) return pem.handle(req, res, p, u);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, secHeaders); return res.end(); }
  if (p === '/admin' || p === '/admin/') {
    return fs.readFile(ADMIN_PAGE, (err, buf) => {
      if (err) { res.writeHead(404, secHeaders); return res.end('Not found'); }
      res.writeHead(200, { ...secHeaders, 'X-Frame-Options': 'DENY', 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': ADMIN_CSP });
      res.end(req.method === 'HEAD' ? undefined : buf);
    });
  }
  if (p === '/health') { res.writeHead(200, { ...secHeaders, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, clients: wss.clients.size })); }
  const hm = /^\/hof\/([a-f0-9]{16})\.jpg$/.exec(p);
  if (hm) {
    const f = path.join(PHOTO_DIR, hm[1] + '.jpg');
    return fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404, secHeaders); return res.end(); }
      res.writeHead(200, { ...secHeaders, 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=600', 'Content-Security-Policy': "default-src 'none'" });
      res.end(req.method === 'HEAD' ? undefined : buf);
    });
  }
  if (p === '/' || p === '') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403, secHeaders); return res.end(); } // cegah path traversal
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, secHeaders); return res.end('Not found'); }
    const base = { ...secHeaders, 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': p.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache', 'Accept-Ranges': 'bytes' };
    // dukungan Range (dibutuhkan pemutar video, terutama Safari/iOS)
    const rm = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (rm && (rm[1] || rm[2])) {
      let a = rm[1] ? +rm[1] : st.size - +rm[2], b = rm[1] && rm[2] ? Math.min(+rm[2], st.size - 1) : st.size - 1;
      if (a < 0) a = 0;
      if (a > b || a >= st.size) { res.writeHead(416, { ...secHeaders, 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...base, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, { ...base, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

// admin: kelola Papan Pesan (lihat & hapus) — login sama dengan admin peminatan
function adminNotes(req, res, p, u) {
  const J = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(o)); };
  if (!pem.authed(req)) return J(401, { ok: false, err: 'Sesi berakhir. Silakan login kembali.' });
  const room = (u.searchParams.get('room') || 'lobi').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32) || 'lobi';
  const getRoomNotes = () => { const r = rooms.get(room); return r ? r.notes : (loadNotes(room) || []); };
  if (p === '/api/admin/notes' && req.method === 'GET') {
    let list = []; try { list = fs.readdirSync(NOTES_DIR).filter((f) => /^[a-z0-9_-]+\.json$/.test(f)).map((f) => f.slice(0, -5)); } catch { /* kosong */ }
    for (const k of rooms.keys()) if (!list.includes(k)) list.push(k);
    return J(200, { ok: true, room, rooms: list, notes: getRoomNotes().map(notePublic) });
  }
  if (p === '/api/admin/notes/delete' && req.method === 'POST') {
    if (!pem.sameOrigin(req)) return J(403, { ok: false, err: 'Permintaan ditolak.' });
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
    req.on('end', () => {
      let o = {}; try { o = JSON.parse(body || '{}'); } catch { /* abaikan */ }
      const r = rooms.get(room), notes = r ? r.notes : (loadNotes(room) || []);
      const ids = Array.isArray(o.ids) ? o.ids.filter((x) => typeof x === 'string').slice(0, 5000) : [o.id];
      let n = 0;
      for (const id of ids) { const i = notes.findIndex((x) => x.id === id); if (i >= 0) { notes.splice(i, 1); n++; if (r) for (const c of r.members) send(c, { type: 'note_del', id }); } }
      saveNotes(room, notes);
      J(200, { ok: true, deleted: n });
    });
    return;
  }
  return J(404, { ok: false, err: 'Tidak ditemukan.' });
}

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_HOF_MSG });
const rooms = new Map(); // nama → { members: Set, wb: Array, notes: Array }

server.on('upgrade', (req, socket, head) => {
  let url; try { url = new URL(req.url, 'http://x'); } catch { return socket.destroy(); }
  if (url.pathname !== '/ws') return socket.destroy();
  if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(req.headers.origin)) return socket.destroy();
  if (wss.clients.size >= MAX_CLIENTS) return socket.destroy();
  const room = (url.searchParams.get('room') || 'lobi').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32) || 'lobi';
  if ((rooms.get(room)?.members?.size || 0) >= MAX_PER_ROOM) return socket.destroy();
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, room));
});

const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const isPlainObj = v => v && typeof v === 'object' && !Array.isArray(v);
// ---- validasi data dari klien (jangan percaya isi pesan) ----
const cleanText = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, n) : '';
const cleanNameS = v => cleanText(v, 40).replace(/[^\p{L}\p{N} ._'\u2019~-]/gu, '').trim().slice(0, 16);
// ---- moderator: nama khusus + kunci rahasia (nama saja mudah ditiru) ----
const ADMIN_NAME = (process.env.ADMIN_NAME || '~velov~').trim().toLowerCase();
const ADMIN_KEY = process.env.ADMIN_KEY || crypto.randomBytes(9).toString('base64url');
const ADMIN_HASH = crypto.createHash('sha256').update(ADMIN_KEY).digest();
const isAdminName = n => typeof n === 'string' && n.trim().toLowerCase() === ADMIN_NAME;
const keyOK = k => typeof k === 'string' && k.length > 0 && k.length <= 200 && crypto.timingSafeEqual(crypto.createHash('sha256').update(k).digest(), ADMIN_HASH);
function validStroke(st) {
  if (!isPlainObj(st) || !Array.isArray(st.p) || st.p.length < 1 || st.p.length > 1500) return null;
  const c = typeof st.c === 'string' && /^#[0-9a-fA-F]{6}$/.test(st.c) ? st.c : '#1d4fb8';
  const w = typeof st.w === 'number' && isFinite(st.w) ? Math.max(1, Math.min(40, st.w)) : 7;
  const p = [];
  for (const q of st.p) { if (!Array.isArray(q) || q.length < 2) return null; const a = +q[0], b = +q[1]; if (!isFinite(a) || !isFinite(b)) return null; p.push([Math.max(0, Math.min(1, a)), Math.max(0, Math.min(1, b))]); }
  return { c, w, p };
}
function validNote(nt) {
  if (!isPlainObj(nt)) return null;
  const t = cleanText(nt.t, 280).trim(); if (!t) return null;
  return { id: cleanText(nt.id, 40) || crypto.randomBytes(6).toString('hex'), n: cleanNameS(nt.n) || 'Pengunjung', t, time: Date.now() };
}

wss.on('connection', (ws, room) => {
  ws.id = crypto.randomBytes(8).toString('hex');
  ws.room = room; ws.presence = {}; ws.alive = true; ws.tokens = RATE; ws.last = Date.now();
  if (!rooms.has(room)) {
    const saved = loadNotes(room);
    rooms.set(room, {
      members: new Set(),
      wb: [],
      notes: saved || [
        { id: 'seed-1', n: 'Kak Tias', t: 'Selamat datang di Lab Peminatan VR! Tulis pendapatmu mengenai lab pilihanmu di papan ini ya.', time: Date.now() },
        { id: 'seed-2', n: "IT'ers", t: 'Aku tertarik dengan KERIS karena fokus di Artificial Intelligence & Machine Learning!', time: Date.now() }
      ]
    });
  }
  const rData = rooms.get(room);
  if (!rData.savedOnce) { rData.savedOnce = true; if (!fs.existsSync(notesFile(room))) saveNotes(room, rData.notes); }
  const members = rData.members;
  send(ws, {
    type: 'welcome',
    id: ws.id,
    peers: [...members].map(c => ({ id: c.id, data: c.presence })),
    wb: rData.wb,
    notes: rData.notes.slice(-1000).map(notePublic),
    hof: HOF.map(hofPublic),
    pem: pem.publicStats()
  });
  members.add(ws);

  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (buf, isBinary) => {
    // token bucket: batasi banjir pesan
    const now = Date.now(); ws.tokens = Math.min(RATE, ws.tokens + (now - ws.last) / 1000 * RATE); ws.last = now;
    if (ws.tokens < 1) return; ws.tokens -= 1;
    if (isBinary || buf.length > MAX_HOF_MSG) return;
    if (buf.length > MAX_MSG && buf.subarray(0, 23).toString('latin1') !== '{"type":"hof_add","n":"' ) return;
    let m; try { m = JSON.parse(buf.toString('utf8')); } catch { return; }
    if (!isPlainObj(m)) return;
    if (m.type === 'auth') {
      // maks. 5 percobaan per koneksi untuk mencegah tebak-tebakan kunci
      ws.authTries = (ws.authTries || 0) + 1;
      ws.admin = ws.authTries <= 5 && keyOK(m.key);
      send(ws, { type: 'auth', ok: ws.admin });
      if (!ws.admin && isAdminName(ws.presence.n)) { ws.presence = { ...ws.presence, n: 'Pengunjung' }; for (const c of members) if (c !== ws) send(c, { type: 'presence', id: ws.id, data: ws.presence }); }
    } else if (m.type === 'kick' && typeof m.id === 'string') {
      if (!ws.admin || m.id === ws.id) return;
      for (const c of members) if (c.id === m.id) { c.kicked = true; send(c, { type: 'kicked' }); setTimeout(() => c.close(4001), 50); break; }
    } else if (m.type === 'presence' && isPlainObj(m.data)) {
      // nama moderator hanya boleh dipakai klien yang sudah lolos verifikasi kunci
      ws.presence = !ws.admin && isAdminName(m.data.n) ? { ...m.data, n: 'Pengunjung' } : m.data;
      for (const c of members) if (c !== ws) send(c, { type: 'presence', id: ws.id, data: ws.presence });
    } else if (m.type === 'signal' && typeof m.to === 'string' && isPlainObj(m.data)) {
      for (const c of members) if (c.id === m.to) { send(c, { type: 'signal', from: ws.id, data: m.data }); break; }
    } else if (m.type === 'wb_stroke' && isPlainObj(m.stroke)) {
      const stroke = validStroke(m.stroke); if (!stroke) return;
      rData.wb.push(stroke);
      if (rData.wb.length > 500) rData.wb.shift();
      for (const c of members) if (c !== ws) send(c, { type: 'wb_stroke', stroke });
    } else if (m.type === 'wb_undo') {
      rData.wb.pop();
      for (const c of members) if (c !== ws) send(c, { type: 'wb_undo' });
    } else if (m.type === 'wb_clear') {
      rData.wb.length = 0;
      for (const c of members) if (c !== ws) send(c, { type: 'wb_clear' });
    } else if (m.type === 'note_add' && isPlainObj(m.note)) {
      // batas 8 catatan/menit per koneksi
      const nowN = Date.now(); ws.noteT = (ws.noteT || []).filter((x) => nowN - x < 60000);
      if (ws.noteT.length >= 8) return; ws.noteT.push(nowN);
      const note = validNote(m.note); if (!note) return;
      if (rData.notes.some((x) => x.id === note.id)) return;
      // kunci pemilik (hash) — hanya penulis / moderator / admin yang bisa menghapus
      if (typeof m.k === 'string' && m.k.length >= 16 && m.k.length <= 64) note.kh = sha(m.k);
      rData.notes.push(note);
      if (rData.notes.length > MAX_NOTES) rData.notes.shift();
      saveNotes(room, rData.notes);
      for (const c of members) if (c !== ws) send(c, { type: 'note_add', note: notePublic(note) });
    } else if (m.type === 'hof_add') {
      // Hall of Fame: nama + foto. Nama yang sudah terdaftar hanya bisa diperbarui pemilik token-nya.
      const reply = (ok, extra) => send(ws, { type: 'hof_res', ok, ...extra });
      ws.hofN = (ws.hofN || 0) + 1;
      if (ws.hofN > 5) return reply(false, { err: 'Terlalu banyak percobaan. Muat ulang halaman lalu coba lagi.' });
      const now2 = Date.now();
      if (now2 - hofGlobal.t > 60000) hofGlobal = { t: now2, n: 0 };
      if (++hofGlobal.n > 30) return reply(false, { err: 'Server sedang sibuk, coba sebentar lagi.' });
      const n = cleanHofName(m.n); if (n.length < 2) return reply(false, { err: 'Nama minimal 2 huruf.' });
      const img = decodePhoto(m.photo); if (!img) return reply(false, { err: 'Foto tidak valid (gunakan JPG/PNG/WebP biasa).' });
      let e = HOF.find(x => x.n.toLowerCase() === n.toLowerCase());
      const tok = typeof m.tok === 'string' && m.tok.length <= 64 ? m.tok : '';
      let newTok = null;
      if (e && !(tok && e.th === sha(tok))) return reply(false, { err: 'Nama itu sudah ada di Hall of Fame. Gunakan nama lengkap yang berbeda.' });
      if (!e && tok) { const own = HOF.find(x => x.th === sha(tok)); if (own) e = own; }
      if (!e) {
        if (HOF.length >= 2000) return reply(false, { err: 'Hall of Fame penuh.' });
        newTok = crypto.randomBytes(16).toString('hex');
        e = { id: crypto.randomBytes(8).toString('hex'), n, t: Date.now(), v: 1, th: sha(newTok) };
        HOF.push(e);
      } else { e.n = n; e.v = (e.v || 1) + 1; }
      fs.writeFile(path.join(PHOTO_DIR, e.id + '.jpg'), img, err => {
        if (err) return reply(false, { err: 'Gagal menyimpan foto.' });
        hofSave();
        reply(true, { e: hofPublic(e), tok: newTok || tok });
        for (const c of wss.clients) if (c !== ws) send(c, { type: 'hof_add', e: hofPublic(e) });
      });
    } else if (m.type === 'hof_del' && typeof m.id === 'string') {
      if (!ws.admin) return;
      const idx = HOF.findIndex(x => x.id === m.id); if (idx === -1) return;
      HOF.splice(idx, 1); hofSave();
      fs.unlink(path.join(PHOTO_DIR, m.id + '.jpg'), () => {});
      for (const c of wss.clients) send(c, { type: 'hof_del', id: m.id });
    } else if (m.type === 'note_del') {
      if (typeof m.id !== 'string' || m.id.length > 40) return;
      const idx = rData.notes.findIndex(x => x.id === m.id);
      if (idx === -1) return;
      const nt = rData.notes[idx];
      const own = typeof m.k === 'string' && m.k.length <= 64 && nt.kh && nt.kh === sha(m.k);
      if (!own && !ws.admin) return send(ws, { type: 'note_res', ok: false, err: 'Hanya penulis catatan atau moderator yang bisa menghapus.' });
      rData.notes.splice(idx, 1);
      saveNotes(room, rData.notes);
      for (const c of members) if (c !== ws) send(c, { type: 'note_del', id: m.id });
    }
  });
  ws.on('close', () => {
    members.delete(ws);
    for (const c of members) send(c, ws.kicked ? { type: 'leave', id: ws.id, q: 1 } : { type: 'leave', id: ws.id });
  });
  ws.on('error', () => {});
});

// detak jantung: putuskan koneksi mati
setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 25000);

server.listen(PORT, () => {
  console.log(`Galeri Media Imersif berjalan di http://localhost:${PORT}  (WebSocket: /ws)`);
  console.log(`Halaman admin peminatan: http://localhost:${PORT}/admin  (username: ${pem.info.user})`);
  if (pem.info.pass) console.log(`Password admin peminatan (sesi ini saja): ${pem.info.pass}  -> atur variabel PEMINATAN_PASS agar tetap`);
  if (!process.env.ADMIN_KEY) console.log(`Kunci moderator untuk "${ADMIN_NAME}" (sesi ini saja): ${ADMIN_KEY}  -> atur variabel ADMIN_KEY agar tetap`);
});
