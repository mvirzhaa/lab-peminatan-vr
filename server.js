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

// baca file .env otomatis jika ada (memudahkan konfigurasi ADMIN_KEY tanpa terhambat cache PM2)
try {
  const envFile = path.join(__dirname, '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (m) {
        const k = m[1].trim();
        const v = (m[2] || '').replace(/^['"]|['"]$/g, '').trim();
        if (v && (!process.env[k] || process.env[k] === 'GANTI-DENGAN-KUNCI-RAHASIA')) {
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

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const secHeaders = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN', 'Permissions-Policy': 'microphone=(self), xr-spatial-tracking=(self), autoplay=(self "https://www.youtube-nocookie.com" "https://www.youtube.com" "https://drive.google.com"), fullscreen=(self "https://www.youtube-nocookie.com" "https://www.youtube.com" "https://drive.google.com")' };
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, secHeaders); return res.end(); }
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400, secHeaders); return res.end(); }
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
    res.writeHead(200, { ...secHeaders, 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': p.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

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
    rooms.set(room, {
      members: new Set(),
      wb: [],
      notes: [
        { id: 'seed-1', n: 'Kak Tias', t: 'Selamat datang di Lab Peminatan VR! Tulis pendapatmu mengenai lab pilihanmu di papan ini ya.', time: Date.now() },
        { id: 'seed-2', n: "IT'ers", t: 'Aku tertarik dengan KERIS karena fokus di Artificial Intelligence & Machine Learning!', time: Date.now() }
      ]
    });
  }
  const rData = rooms.get(room);
  const members = rData.members;
  send(ws, {
    type: 'welcome',
    id: ws.id,
    peers: [...members].map(c => ({ id: c.id, data: c.presence })),
    wb: rData.wb,
    notes: rData.notes,
    hof: HOF.map(hofPublic)
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
      const note = validNote(m.note); if (!note) return;
      rData.notes.push(note);
      if (rData.notes.length > 60) rData.notes.shift();
      for (const c of members) if (c !== ws) send(c, { type: 'note_add', note });
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
      if (typeof m.id === 'string' && m.id.length <= 40) {
        const idx = rData.notes.findIndex(x => x.id === m.id);
        if (idx !== -1) rData.notes.splice(idx, 1);
      } else if (typeof m.idx === 'number') {
        rData.notes.splice(m.idx, 1);
      }
      for (const c of members) if (c !== ws) send(c, { type: 'note_del', id: m.id, idx: m.idx });
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
  if (!process.env.ADMIN_KEY) console.log(`Kunci moderator untuk "${ADMIN_NAME}" (sesi ini saja): ${ADMIN_KEY}  -> atur variabel ADMIN_KEY agar tetap`);
});
