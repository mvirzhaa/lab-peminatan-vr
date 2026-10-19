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
  const TAHAP2 = ['kognitif', 'inggris', 'sahabat', 'coding'];
  // tahap 3: Gua Pustaka di balik rak buku Silvia → lencana Pengetahuan Umum (Teh Puspa)
  // tahap 6: Dunia Server Lab KERIS (6 babak coding) → lencana Pengetahuan Coding (Kang Sahid & Teh Gibhta)
  // tahap 7: Galeri Islam & Lembah Gurun → lencana Pengetahuan Agama Islam (Kang Fitrah & Teh Freza)
  const TANTANGAN = TAHAP2.concat(['pustaka', 'iot', 'jari', 'server', 'islam', 'pohon', 'raptor']);
  // Portal Ring 1 (khusus pemegang Black Card = lencana tim): batu bercahaya, berurutan
  const BATU = { kuning: { ch: 'pohon', pre: null }, hijau: { ch: 'raptor', pre: 'kuning' }, merah: null, birutua: null, oranye: null, ungu: null, birulangit: null, putih: null, hitam: null };
  const SIX = ['dasar', 'umum', 'iot', 'jari', 'coding', 'islam'];
  // kode cepat tahap 8 (hanya hash yang disimpan)
  const KODE8 = '084326aacdb1a8b12e294f1cc07125c3a864a46a2314dea5b143acfa4c7f14ce';
  // syarat tiap lencana: tantangan yang harus tercatat + lencana sebelumnya
  const LENCANA = { dasar: { ch: TAHAP2, pre: null }, umum: { ch: ['pustaka'], pre: 'dasar' }, iot: { ch: ['iot'], pre: 'umum' }, jari: { ch: ['jari'], pre: 'iot' }, coding: { ch: ['server'], pre: 'jari' }, islam: { ch: ['islam'], pre: 'coding' } }; // tim (Kerjasama Tim) TIDAK bisa dikirim klien: hanya diberikan server (tim.js) kepada pemenang Game 4
  const SEC = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
  const json = (res, code, o) => { res.writeHead(code, { ...SEC, 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
  const readJson = (req) => new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 4096) req.destroy(); }); req.on('end', () => { try { const o = JSON.parse(b || '{}'); resolve(o && typeof o === 'object' ? o : {}); } catch { resolve({}); } }); req.on('error', () => resolve({})); });
  const lim = new Map();
  const limited = (req, key, max) => { const ip = pem.clientIp(req); const k = key + ip, now = Date.now(); const r = lim.get(k) || { n: 0, t: now }; if (now - r.t > 10 * 60e3) { r.n = 0; r.t = now; } r.n++; lim.set(k, r); return r.n > max; };
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
      return json(res, 200, { ok: true, ada: true, no: k.no, nama: k.nama, t: k.t, cabut: !!k.cabut, lencana: k.lb || {}, tantangan: k.ch || {}, hadiah: k.rw || {}, batu: k.bt || {} });
    }
    // papan rekor publik (mis. misi drone): 10 waktu tercepat jalur "main"
    if (p === '/api/kartu/rekor' && req.method === 'GET') {
      if (limited(req, 'k', 300)) return json(res, 429, { ok: false, err: 'Terlalu banyak permintaan.' });
      const id = String(new URL(req.url, 'http://x').searchParams.get('id') || '');
      if (!TANTANGAN.includes(id)) return json(res, 400, { ok: false, err: 'Tantangan tidak dikenal.' });
      const list = K.filter((k) => !k.cabut && k.ch && k.ch[id] && k.ch[id].jalur === 'main' && k.ch[id].best > 0).map((k) => ({ nama: k.nama, best: k.ch[id].best, bintang: k.ch[id].bintang || 0 })).sort((a, b) => a.best - b.best).slice(0, 10);
      return json(res, 200, { ok: true, list });
    }
    // batu Portal Ring 1 & kode cepat tahap 8 (butuh token pemilik)
    if ((p === '/api/kartu/batu' || p === '/api/kartu/kode') && req.method === 'POST') {
      if (!pem.sameOrigin(req)) return json(res, 403, { ok: false, err: 'Permintaan ditolak.' });
      if (limited(req, p === '/api/kartu/kode' ? 'q' : 'r', p === '/api/kartu/kode' ? 20 : 120)) return json(res, 429, { ok: false, err: 'Terlalu banyak percobaan. Coba lagi nanti.' });
      const o = await readJson(req);
      const no = String(o.no || '').toUpperCase(), tok = typeof o.tok === 'string' ? o.tok.slice(0, 64) : '', id = String(o.id || '');
      const k = noOK(no) ? K.find((x) => x.no === no) : null;
      if (!k || k.cabut || !(tok && eq(k.kh, sha(tok)))) return json(res, 403, { ok: false, err: 'Kartu tidak valid.' });
      if (p === '/api/kartu/batu') {
        const B = BATU[id];
        if (!B) return json(res, 400, { ok: false, err: 'Batu tidak dikenal.' });
        if (!(k.lb && k.lb.tim)) return json(res, 403, { ok: false, err: 'Khusus pemegang Black Card.' });
        if (!(k.ch && k.ch[B.ch]) || (B.pre && !(k.bt && k.bt[B.pre]))) return json(res, 403, { ok: false, err: 'Syarat batu belum terpenuhi.' });
        k.bt = k.bt || {};
        if (!k.bt[id]) k.bt[id] = Date.now();
        save();
        return json(res, 200, { ok: true, batu: k.bt });
      }
      // kode cepat tahap 8: lencana Kerjasama Tim + skin Tentara Futuristik
      const kode = typeof o.kode === 'string' ? o.kode.trim().toLowerCase().slice(0, 40) : '';
      if (id !== 'tim' || !eq(sha('itlab8|' + kode), KODE8)) return json(res, 403, { ok: false, err: 'Ditolak.' });
      if (!SIX.every((b) => k.lb && k.lb[b])) return json(res, 403, { ok: false, err: 'Syarat belum terpenuhi.' });
      k.lb = k.lb || {}; k.ch = k.ch || {}; k.rw = k.rw || {};
      if (!k.lb.tim) k.lb.tim = Date.now();
      if (!k.ch.tim) k.ch.tim = { t: Date.now(), best: 0, jalur: 'kode', bintang: 0 };
      if (!k.rw.trooper) k.rw.trooper = Date.now();
      save();
      return json(res, 200, { ok: true, lencana: k.lb, tantangan: k.ch, hadiah: k.rw });
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
        k.ch[id] = { t: (prev && prev.t) || Date.now(), best: Number.isFinite(dt) && dt > 0 && dt <= 3600 ? Math.min(prev && prev.best ? prev.best : 1e9, Math.round(dt * 10) / 10) : (prev && prev.best) || 0, jalur: o.jalur === 'kode' ? ((prev && prev.jalur === 'main') ? 'main' : 'kode') : 'main', bintang: Math.max((prev && prev.bintang) || 0, Math.min(3, Math.max(0, Math.floor(Number(o.bintang) || 0)))) };
      } else {
        if (!LENCANA[id]) return json(res, 400, { ok: false, err: 'Lencana tidak dikenal.' });
        // syarat lencana: tantangan tercatat (+ lencana sebelumnya)
        const L = LENCANA[id];
        if (!L.ch.every((c) => k.ch && k.ch[c]) || (L.pre && !(k.lb && k.lb[L.pre]))) return json(res, 403, { ok: false, err: 'Syarat lencana belum terpenuhi.' });
        k.lb = k.lb || {};
        if (!k.lb[id]) k.lb[id] = Date.now();
      }
      save();
      return json(res, 200, { ok: true, lencana: k.lb || {}, tantangan: k.ch || {} });
    }
    if (!p.startsWith('/api/admin/kartu')) return false;
    if (!pem.authed(req)) return json(res, 401, { ok: false, err: 'Sesi berakhir. Silakan login kembali.' });
    if (p === '/api/admin/kartu' && req.method === 'GET') return json(res, 200, { ok: true, kartu: K.map((k) => ({ no: k.no, nama: k.nama, t: k.t, ver: k.ver || 0, lv: k.lv || 0, cabut: !!k.cabut, ch: k.ch || {}, lb: k.lb || {}, rw: k.rw || {}, tm: k.tm || {}, bt: k.bt || {} })) });
    if (p === '/api/admin/kartu/status' && req.method === 'POST') {
      if (!pem.sameOrigin(req)) return json(res, 403, { ok: false, err: 'Permintaan ditolak.' });
      const o = await readJson(req), k = K.find((x) => x.no === o.no);
      if (!k) return json(res, 404, { ok: false, err: 'Kartu tidak ditemukan.' });
      k.cabut = !!o.cabut; save();
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { ok: false, err: 'Tidak ditemukan.' });
  }
  // dipakai modul Kerjasama Tim (tim.js): verifikasi pemilik kartu lewat WebSocket
  const auth = (no, tok) => { const k = noOK(no) ? K.find((x) => x.no === no) : null; return k && !k.cabut && tok && eq(k.kh, sha(tok)) ? k : null; };
  return { handle, auth, list: () => K, save };
}
module.exports = { createKartu };
