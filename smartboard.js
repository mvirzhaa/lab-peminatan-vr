// =====================================================================
//  Smart Board Auditorium Budi Susetyo, Auditorium Puspa Eosina, Ruang Rapat & RK 1–3
//  - Konten (slide gambar atau video YouTube) diatur admin di /admin → tab "Smart Board".
//  - Pengunjung: GET /api/sb (konfigurasi), GET /sb/<id>.<ext> (gambar slide).
//  - Keadaan langsung per ruang ?room= (slide aktif, coretan anotasi, putar/jeda YouTube)
//    disimpan di memori server dan dibagikan ke semua pemain lewat pesan WebSocket sb_*.
//  Data: DATA_DIR/smartboard.json, gambar di DATA_DIR/smartboard/<id>.<ext>
// =====================================================================
'use strict';
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const path = require('path');
const crypto = require('crypto');

const BOARDS = { kelas1: 'Auditorium Budi Susetyo', kelas2: 'Auditorium Puspa Eosina', rapat: 'Ruang Rapat', rk1: 'RK 1 · Ruang Kelas', rk2: 'RK 2 · Ruang Kelas', rk3: 'RK 3 · Ruang Kelas', keris: 'Lab KERIS', git: 'Lab GIT', se: 'Lab Software Engineering', csn: 'Lab CSN' };
// smart board lab: diputar masing-masing pemain (tidak disinkronkan); ruang kelas & rapat: dibagikan ke semua pemain
const LOCAL = new Set(['keris', 'git', 'se', 'csn']);
const WELCOME_DEFAULT = 'o3LwrgW86U8';
const MAX_IMG = 8 * 1024 * 1024, MAX_SLIDES = 80, MAX_STROKES = 400;
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function imgType(b) {
  if (b.length < 32) return null;
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}
// terima URL YouTube apa pun (watch, youtu.be, shorts, embed, live) atau ID 11 karakter
function ytId(v) {
  const s = String(v || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/.exec(s);
  return m ? m[1] : '';
}

function createSmartboard({ dataDir, pem, onCfg }) {
  const DIR = path.join(dataDir, 'smartboard');
  const FILE = path.join(dataDir, 'smartboard.json');
  fs.mkdirSync(DIR, { recursive: true });
  let C = {};
  try { const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (raw && typeof raw === 'object') C = raw; } catch { /* belum ada */ }
  C.welcome = { yt: ytId(C.welcome && C.welcome.yt) || WELCOME_DEFAULT, judul: C.welcome && typeof C.welcome.judul === 'string' ? C.welcome.judul.slice(0, 80) : '' };
  for (const k of Object.keys(BOARDS)) {
    const c = C[k] && typeof C[k] === 'object' ? C[k] : {};
    C[k] = { mode: c.mode === 'youtube' ? 'youtube' : 'slide', yt: ytId(c.yt), judul: typeof c.judul === 'string' ? c.judul.slice(0, 80) : '', slides: Array.isArray(c.slides) ? c.slides.filter((s) => s && /^[a-f0-9]{16}$/.test(s.id) && MIME[s.ext]) : [], v: +c.v || 1 };
  }
  const save = () => { const tmp = FILE + '.tmp'; fs.writeFile(tmp, JSON.stringify(C), (e) => { if (!e) fs.rename(tmp, FILE, () => {}); }); };
  // keadaan langsung (slide aktif, coretan, posisi video) disimpan agar tidak hilang saat server di-restart
  const LIVE = path.join(dataDir, 'smartboard-live.json');
  let LV = {}; try { LV = JSON.parse(fs.readFileSync(LIVE, 'utf8')) || {}; } catch { /* belum ada */ }
  let liveT = null;
  const saveLive = (room, rData) => { if (!rData.sb) return; LV[room] = rData.sb; clearTimeout(liveT); liveT = setTimeout(() => { const tmp = LIVE + '.tmp'; fs.writeFile(tmp, JSON.stringify(LV), (e) => { if (!e) fs.rename(tmp, LIVE, () => {}); }); }, 1500); };
  const restore = (room) => { const o = LV[room]; if (!o || typeof o !== 'object') return undefined; const r = {}; for (const [b, L] of Object.entries(o)) if (BOARDS[b] && !LOCAL.has(b) && L && C[b] && L.v === C[b].v) r[b] = { v: L.v, i: +L.i || 0, strokes: Array.isArray(L.strokes) ? L.strokes.slice(-MAX_STROKES) : [], yt: { p: false, t: +(L.yt && L.yt.t) || 0, at: Date.now() } }; return r; };
  const changed = (b) => { if (C[b]) C[b].v = (C[b].v || 1) + 1; save(); if (onCfg) onCfg(b); };
  const clean = (v, n) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  const pub = () => { const o = {}; for (const k of Object.keys(BOARDS)) { const c = C[k]; o[k] = { nama: BOARDS[k], lokal: LOCAL.has(k), mode: c.mode, yt: c.yt, judul: c.judul, v: c.v, slides: c.slides.map((s) => ({ id: s.id, ext: s.ext, judul: s.judul || '' })) }; } return o; };
  const pubAll = () => ({ ok: true, boards: pub(), welcome: { yt: C.welcome.yt, judul: C.welcome.judul } });

  // ---------- HTTP ----------
  const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Cache-Control': 'no-store' };
  const json = (res, code, o) => { res.writeHead(code, { ...SEC, 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
  function readBody(req, max) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > max) { reject(Object.assign(new Error('too_large'), { code: 413 })); req.destroy(); return; } chunks.push(c); });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }
  const readJson = async (req) => { try { const o = JSON.parse((await readBody(req, 16 * 1024)).toString('utf8') || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };

  // GET /sb/<id>.<ext>
  function serveFile(req, res, p) {
    const m = /^\/sb\/([a-f0-9]{16})\.(jpg|png|webp)$/.exec(p);
    if (!m) return false;
    const f = path.join(DIR, m[1] + '.' + m[2]);
    fs.stat(f, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, SEC); return res.end('Not found'); }
      res.writeHead(200, { ...SEC, 'Cache-Control': 'public, max-age=86400, immutable', 'Content-Type': MIME[m[2]], 'Content-Length': st.size, 'Content-Security-Policy': "default-src 'none'" });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(f).pipe(res);
    });
    return true;
  }

  async function handle(req, res, p, url) {
    try {
      if (p === '/api/sb' && req.method === 'GET') return json(res, 200, pubAll());
      if (!p.startsWith('/api/admin/sb')) return false;
      if (!pem.authed(req)) return json(res, 401, { ok: false, err: 'Sesi berakhir. Silakan login kembali.' });
      if (req.method === 'POST' && !pem.sameOrigin(req)) return json(res, 403, { ok: false, err: 'Permintaan ditolak.' });
      if (p === '/api/admin/sb' && req.method === 'GET') return json(res, 200, pubAll());
      const board = url.searchParams.get('b');
      if (p === '/api/admin/sb/pptx' && req.method === 'POST') {
        // PowerPoint → PDF lewat LibreOffice di server (bila terpasang); halaman PDF lalu diubah jadi slide di browser admin
        const buf = await readBody(req, 60 * 1024 * 1024);
        if (buf.length < 100 || buf[0] !== 0x50 || buf[1] !== 0x4B) return json(res, 400, { ok: false, err: 'Berkas bukan PowerPoint (.pptx).' });
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbpptx-')), src = path.join(dir, 'slide.pptx');
        fs.writeFileSync(src, buf);
        const bin = process.env.SOFFICE || 'soffice';
        const out = await new Promise((resolve) => execFile(bin, ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', dir, src], { timeout: 180000 }, (err) => resolve(err ? null : path.join(dir, 'slide.pdf'))));
        if (!out || !fs.existsSync(out)) { fs.rm(dir, { recursive: true, force: true }, () => {}); return json(res, 501, { ok: false, err: 'Server belum bisa mengubah PowerPoint (LibreOffice tidak terpasang). Simpan presentasi sebagai PDF dulu lalu unggah PDF-nya, atau pasang LibreOffice di server: sudo apt install libreoffice-impress' }); }
        const pdf = fs.readFileSync(out); fs.rm(dir, { recursive: true, force: true }, () => {});
        res.writeHead(200, { ...SEC, 'Content-Type': 'application/pdf', 'Content-Length': pdf.length });
        return res.end(pdf);
      }
      if (p === '/api/admin/sb/upload' && req.method === 'POST') {
        if (!BOARDS[board]) return json(res, 400, { ok: false, err: 'Ruangan tidak dikenal.' });
        if (C[board].slides.length >= MAX_SLIDES) return json(res, 507, { ok: false, err: `Maksimal ${MAX_SLIDES} slide per ruangan.` });
        const buf = await readBody(req, MAX_IMG);
        const ext = imgType(buf);
        if (!ext) return json(res, 400, { ok: false, err: 'Berkas bukan gambar JPG, PNG, atau WebP.' });
        const id = crypto.randomBytes(8).toString('hex');
        fs.writeFileSync(path.join(DIR, id + '.' + ext), buf);
        const judul = clean(decodeURIComponent(String(req.headers['x-filename'] || '')).replace(/\.[a-z0-9]+$/i, ''), 80);
        C[board].slides.push({ id, ext, judul, t: Date.now() });
        changed(board);
        return json(res, 200, { ok: true, id });
      }
      if (req.method !== 'POST') return json(res, 404, { ok: false, err: 'Tidak ditemukan.' });
      const o = await readJson(req), b = o.b;
      if (p === '/api/admin/sb/welcome') {
        const yt = ytId(o.yt);
        if (!yt) return json(res, 400, { ok: false, err: 'Tautan YouTube tidak valid. Tempel URL video YouTube (mis. https://www.youtube.com/watch?v=…).' });
        C.welcome = { yt, judul: clean(o.judul, 80) };
        changed('welcome'); return json(res, 200, { ok: true, yt });
      }
      if (!BOARDS[b]) return json(res, 400, { ok: false, err: 'Ruangan tidak dikenal.' });
      const c = C[b];
      if (p === '/api/admin/sb/set') {
        const mode = o.mode === 'youtube' ? 'youtube' : 'slide';
        const yt = ytId(o.yt);
        if (mode === 'youtube' && !yt) return json(res, 400, { ok: false, err: 'Tautan YouTube tidak valid. Tempel URL video YouTube (mis. https://www.youtube.com/watch?v=…).' });
        Object.assign(c, { mode, yt: yt || c.yt, judul: clean(o.judul, 80) });
        changed(b); return json(res, 200, { ok: true, yt: c.yt });
      }
      const i = c.slides.findIndex((s) => s.id === o.id);
      if (i < 0) return json(res, 404, { ok: false, err: 'Slide tidak ditemukan.' });
      if (p === '/api/admin/sb/delete') {
        const [s] = c.slides.splice(i, 1);
        fs.unlink(path.join(DIR, s.id + '.' + s.ext), () => {});
        changed(b); return json(res, 200, { ok: true });
      }
      if (p === '/api/admin/sb/move') {
        const j = i + (o.dir < 0 ? -1 : 1);
        if (j >= 0 && j < c.slides.length) { [c.slides[i], c.slides[j]] = [c.slides[j], c.slides[i]]; changed(b); }
        return json(res, 200, { ok: true });
      }
      if (p === '/api/admin/sb/rename') { c.slides[i].judul = clean(o.judul, 80); changed(b); return json(res, 200, { ok: true }); }
      return json(res, 404, { ok: false, err: 'Tidak ditemukan.' });
    } catch (e) {
      if (e && e.code === 413) return json(res, 413, { ok: false, err: 'Gambar terlalu besar (maks. 8 MB per slide).' });
      console.error('smartboard:', e);
      if (!res.headersSent) return json(res, 500, { ok: false, err: 'Terjadi kesalahan server.' });
    }
    return true;
  }

  // ---------- keadaan langsung per ruang (?room=) ----------
  function live(rData, b) {
    rData.sb = rData.sb || {};
    if (!rData.sb[b] || rData.sb[b].v !== C[b].v) rData.sb[b] = { v: C[b].v, i: 0, strokes: [], yt: { p: false, t: 0, at: Date.now() } };
    return rData.sb[b];
  }
  function stateFor(rData) {
    const o = {}, now = Date.now();
    for (const b of Object.keys(BOARDS)) { if (LOCAL.has(b)) continue; const L = live(rData, b); o[b] = { v: L.v, i: L.i, strokes: L.strokes, yt: { p: L.yt.p, t: L.yt.t, el: now - L.yt.at } }; }
    return o;
  }
  function validStroke(st) {
    if (!st || typeof st !== 'object' || !Array.isArray(st.p) || st.p.length < 1 || st.p.length > 1500) return null;
    const c = typeof st.c === 'string' && /^#[0-9a-fA-F]{6}$/.test(st.c) ? st.c : '#1d4ed8';
    const w = typeof st.w === 'number' && isFinite(st.w) ? Math.max(1, Math.min(80, st.w)) : 6;
    const p = [];
    for (const q of st.p) { if (!Array.isArray(q) || q.length < 2) return null; const a = +q[0], b = +q[1]; if (!isFinite(a) || !isFinite(b)) return null; p.push([Math.round(Math.max(0, Math.min(1, a)) * 1e4) / 1e4, Math.round(Math.max(0, Math.min(1, b)) * 1e4) / 1e4]); }
    return { c, w, p, e: st.e ? 1 : 0 };
  }
  // pesan dari pemain; kembalikan true bila ditangani
  function onMessage(ws, m, rData, members, allow) {
    const b = m.b;
    if (!BOARDS[b] || LOCAL.has(b)) return true;
    if (allow && !allow(ws, b)) { if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'sb_deny', b })); return true; }
    const L = live(rData, b), out = (o) => { for (const c of members) if (c !== ws) c.readyState === 1 && c.send(JSON.stringify(o)); };
    if (m.type === 'sb_set') {
      const n = C[b].slides.length || 999, i = Math.max(0, Math.min(n - 1, Math.floor(+m.i) || 0));
      L.i = i; L.strokes = [];
      out({ type: 'sb_set', b, i });
    } else if (m.type === 'sb_stroke') {
      const st = validStroke(m.stroke); if (!st) return true;
      L.strokes.push(st); if (L.strokes.length > MAX_STROKES) L.strokes.shift();
      out({ type: 'sb_stroke', b, stroke: st });
    } else if (m.type === 'sb_clear') {
      L.strokes = [];
      out({ type: 'sb_clear', b });
    } else if (m.type === 'sb_yt') {
      const t = Math.max(0, Math.min(86400, +m.t || 0));
      L.yt = { p: !!m.p, t, at: Date.now() };
      out({ type: 'sb_yt', b, p: !!m.p, t });
    }
    saveLive(ws.room, rData);
    return true;
  }
  return { handle, serveFile, stateFor, onMessage, restore, BOARDS };
}
module.exports = { createSmartboard };
