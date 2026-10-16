// =====================================================================
//  Database Explorer Card (XC)
//  - Kartu yang diberikan Kang Santo didaftarkan ke server
//    (POST /api/kartu/daftar) → server menyimpan nomor + nama + hash token pemilik.
//  - NPC Nan di Lantai 2 IT-Mart memverifikasi kartu (POST /api/kartu/verifikasi)
//    sebelum membuka gerbang ruang tantangan.
//  - Admin (/admin → tab "Explorer Card") bisa melihat & mencabut/mengaktifkan kartu.
//  Data: DATA_DIR/kartu.json
// =====================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createKartu({ dataDir, pem }) {
  const FILE = path.join(dataDir, 'kartu.json');
  let K = [];
  try { const a = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (Array.isArray(a)) K = a.filter((k) => k && typeof k.no === 'string'); } catch { /* belum ada */ }
  let saveT = null;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { const tmp = FILE + '.tmp'; fs.writeFile(tmp, JSON.stringify(K), (e) => { if (!e) fs.rename(tmp, FILE, () => {}); }); }, 200); };
  const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
  const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  const cleanName = (v) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').replace(/[^\p{L}\p{N} ._'’~-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const noOK = (s) => typeof s === 'string' && /^[0-9A-Z]{6,12}$/.test(s);
  // tahap 2: empat ruang tantangan di Lantai 2 IT-Mart → lencana Pengetahuan Dasar (Teh Fety)
  const TANTANGAN = ['kognitif', 'inggris', 'sahabat', 'coding'];
  const LENCANA = { dasar: TANTANGAN }; // lencana lain (umum, alam, jari, coding, islam, geografi) menyusul
  const SEC = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
  const json = (res, code, o) => { res.writeHead(code, { ...SEC, 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
  const readJson = (req) => new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 4096) req.destroy(); }); req.on('end', () => { try { const o = JSON.parse(b || '{}'); resolve(o && typeof o === 'object' ? o : {}); } catch { resolve({}); } }); req.on('error', () => resolve({})); });
  const lim = new Map();
  const limited = (req, key, max) => { const ip = req.socket.remoteAddress || ''; const k = key + ip, now = Date.now(); const r = lim.get(k) || { n: 0, t: now }; if (now - r.t > 10 * 60e3) { r.n = 0; r.t = now; } r.n++; lim.set(k, r); return r.n > max; };
  setInterval(() => { const now = Date.now(); for (const [k, r] of lim) if (now - r.t > 10 * 60e3) lim.delete(k); }, 60e3).unref();

  async function handle(req, res, p) {
    if (p === '/api/kartu/daftar' && req.method === 'POST') {
      if (!pem.sameOrigin(req)) return json(res, 403, { ok: false, err: 'Permintaan ditolak.' });
      if (limited(req, 'd', 20)) return json(res, 429, { ok: false, err: 'Terlalu banyak percobaan. Coba lagi nanti.' });
      const o = await readJson(req);
      const no = String(o.no || '').toUpperCase(), nama = cleanName(o.nama), tok = typeof o.tok === 'string' ? o.tok.slice(0, 64) : '';
      if (!noOK(no) || nama.length < 2) return json(res, 400, { ok: false, err: 'Data kartu tidak valid.' });
      let k = K.find((x) => x.no === no);
      if (k) {
        if (k.cabut) return json(res, 403, { ok: false, err: 'Kartu ini telah dicabut oleh admin.', cabut: true });
        if (!(tok && eq(k.kh, sha(tok)))) return json(res, 409, { ok: false, err: 'Nomor kartu ini sudah terdaftar di perangkat lain.' });
        k.nama = nama; k.u = Date.now(); save();
        return json(res, 200, { ok: true, tok });
      }
      if (K.length >= 50000) return json(res, 507, { ok: false, err: 'Database kartu penuh.' });
      const nt = crypto.randomBytes(16).toString('hex');
      K.push({ no, nama, t: Date.now(), kh: sha(nt), ver: 0 });
      save();
      return json(res, 200, { ok: true, tok: nt, baru: true });
    }
    if (p === '/api/kartu/verifikasi' && req.method === 'POST') {
      if (!pem.sameOrigin(req)) return json(res, 403, { ok: false, err: 'Permintaan ditolak.' });
      if (limited(req, 'v', 60)) return json(res, 429, { ok: false, err: 'Terlalu banyak percobaan. Coba lagi nanti.' });
      const o = await readJson(req);
      const no = String(o.no || '').toUpperCase(), tok = typeof o.tok === 'string' ? o.tok.slice(0, 64) : '';
      const k = noOK(no) ? K.find((x) => x.no === no) : null;
      if (!k) return json(res, 200, { ok: false, alasan: 'tidak-terdaftar' });
      if (k.cabut) return json(res, 200, { ok: false, alasan: 'dicabut' });
      if (!(tok && eq(k.kh, sha(tok)))) return json(res, 200, { ok: false, alasan: 'bukan-pemilik' });
      k.ver = (k.ver || 0) + 1; k.lv = Date.now(); save();
      return json(res, 200, { ok: true, nama: k.nama, no: k.no });
    }
    // cek publik (dipakai profil pemain lain): nama, tanggal, status, lencana & tantangan — tanpa token
    if (p === '/api/kartu/cek' && req.method === 'GET') {
      if (limited(req, 'c', 300)) return json(res, 429, { ok: false, err: 'Terlalu banyak permintaan.' });
      const no = String(new URL(req.url, 'http://x').searchParams.get('no') || '').toUpperCase();
      const k = noOK(no) ? K.find((x) => x.no === no) : null;
      if (!k) return json(res, 200, { ok: true, ada: false });
      return json(res, 200, { ok: true, ada: true, no: k.no, nama: k.nama, t: k.t, cabut: !!k.cabut, lencana: k.lb || {}, tantangan: k.ch || {} });
    }
    // catat tantangan / lencana milik pemegang kartu (butuh token pemilik)
    if ((p === '/api/kartu/tantangan' || p === '/api/kartu/lencana') && req.method === 'POST') {
      if (!pem.sameOrigin(req)) return json(res, 403, { ok: false, err: 'Permintaan ditolak.' });
      if (limited(req, 'r', 120)) return json(res, 429, { ok: false, err: 'Terlalu banyak percobaan. Coba lagi nanti.' });
      const o = await readJson(req);
      const no = String(o.no || '').toUpperCase(), tok = typeof o.tok === 'string' ? o.tok.slice(0, 64) : '', id = String(o.id || '');
      const k = noOK(no) ? K.find((x) => x.no === no) : null;
      if (!k || k.cabut || !(tok && eq(k.kh, sha(tok)))) return json(res, 403, { ok: false, err: 'Kartu tidak valid.' });
      if (p === '/api/kartu/tantangan') {
        if (!TANTANGAN.includes(id)) return json(res, 400, { ok: false, err: 'Tantangan tidak dikenal.' });
        k.ch = k.ch || {};
        const dt = Number(o.dt), prev = k.ch[id];
        k.ch[id] = { t: (prev && prev.t) || Date.now(), best: Number.isFinite(dt) && dt > 0 && dt <= 600 ? Math.min(prev && prev.best ? prev.best : 1e9, Math.round(dt * 10) / 10) : (prev && prev.best) || 0, jalur: o.jalur === 'kode' ? 'kode' : (prev && prev.jalur) || 'main' };
      } else {
        if (!LENCANA[id]) return json(res, 400, { ok: false, err: 'Lencana tidak dikenal.' });
        // syarat lencana Pengetahuan Dasar: keempat tantangan Lantai 2 tercatat
        if (!LENCANA[id].every((c) => k.ch && k.ch[c])) return json(res, 403, { ok: false, err: 'Syarat lencana belum terpenuhi.' });
        k.lb = k.lb || {};
        if (!k.lb[id]) k.lb[id] = Date.now();
      }
      save();
      return json(res, 200, { ok: true, lencana: k.lb || {}, tantangan: k.ch || {} });
    }
    if (!p.startsWith('/api/admin/kartu')) return false;
    if (!pem.authed(req)) return json(res, 401, { ok: false, err: 'Sesi berakhir. Silakan login kembali.' });
    if (p === '/api/admin/kartu' && req.method === 'GET') return json(res, 200, { ok: true, kartu: K.map((k) => ({ no: k.no, nama: k.nama, t: k.t, ver: k.ver || 0, lv: k.lv || 0, cabut: !!k.cabut, ch: k.ch || {}, lb: k.lb || {} })) });
    if (p === '/api/admin/kartu/status' && req.method === 'POST') {
      if (!pem.sameOrigin(req)) return json(res, 403, { ok: false, err: 'Permintaan ditolak.' });
      const o = await readJson(req), k = K.find((x) => x.no === o.no);
      if (!k) return json(res, 404, { ok: false, err: 'Kartu tidak ditemukan.' });
      k.cabut = !!o.cabut; save();
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { ok: false, err: 'Tidak ditemukan.' });
  }
  return { handle };
}
module.exports = { createKartu };
