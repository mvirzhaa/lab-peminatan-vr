// =====================================================================
//  Rak Buku Digital IT-Mart
//  - Admin (halaman /admin, akun yang sama dengan pengelola peminatan)
//    mengunggah/menghapus/mengubah buku PDF.
//  - Pengunjung melihat daftar & mengunduh PDF (GET /buku/<id>.pdf).
//  - NPC Ivy menjelaskan isi buku: teks PDF diekstrak di server, lalu
//    pertanyaan dicocokkan dengan potongan halaman (GET /api/buku/tanya).
//  Data: DATA_DIR/buku.json (metadata), DATA_DIR/buku/<id>.pdf & <id>.json (teks per halaman)
// =====================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let pdfjs = null;
function loadPdfjs() {
  if (pdfjs) return pdfjs;
  const w = console.warn, l = console.log; console.warn = console.log = () => {}; // pdf.js memperingatkan polyfill canvas yang tidak dibutuhkan untuk ekstraksi teks
  try { pdfjs = require('pdfjs-dist/legacy/build/pdf.js'); } finally { console.warn = w; console.log = l; }
  return pdfjs;
}

const MAX_PDF = 40 * 1024 * 1024;
const STOP = new Set('yang dan di ke dari itu ini apa adalah untuk dengan pada atau saya kamu anda apakah bagaimana jelaskan tolong mohon dong sih kah lah tentang mengenai the of a an to is are be ada bisa akan juga sebagai dalam oleh karena agar maka saja lebih tidak bukan nya kalau jika bila seperti mana siapa kapan berapa sebutkan coba beri berikan tahu ingin mau minta buku isi bab halaman and or for in on with that this from by as at it its was were has have had not but can which their they these those we our you your he she his her than then there also into more such may will what when where who how kak ivy tolong dijelaskan jelaskan apa'.split(' '));
const toks = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));

function createBuku({ dataDir, pem, onChange }) {
  const DIR = path.join(dataDir, 'buku');
  const FILE = path.join(dataDir, 'buku.json');
  fs.mkdirSync(DIR, { recursive: true });
  let B = [];
  try { const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (Array.isArray(raw)) B = raw.filter((b) => b && /^[a-f0-9]{16}$/.test(b.id)); } catch { /* belum ada */ }
  // ekstraksi yang terputus saat server mati → ulangi
  for (const b of B) if (b.status === 'proses') setTimeout(() => extract(b), 1500);
  const save = () => { const tmp = FILE + '.tmp'; fs.writeFile(tmp, JSON.stringify(B), (e) => { if (!e) fs.rename(tmp, FILE, () => {}); }); };
  const changed = () => { save(); if (onChange) onChange(); };
  const clean = (v, n) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, n);
  const cleanLong = (v, n) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
  const pub = (b) => ({ id: b.id, judul: b.judul, penulis: b.penulis, kategori: b.kategori, ringkasan: b.ringkasan, hal: b.hal || 0, ukuran: b.ukuran, t: b.t, status: b.status, topik: b.topik || [] });
  const slug = (s) => String(s || 'buku').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'buku';

  // ---------- ekstraksi teks PDF ----------
  const idxCache = new Map(); // id → { chunks:[{hal, teks, tk:Map}], idf }
  async function extract(b) {
    b.status = 'proses'; save();
    try {
      const data = new Uint8Array(fs.readFileSync(path.join(DIR, b.id + '.pdf')));
      const doc = await loadPdfjs().getDocument({ data, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
      const pages = [];
      const n = Math.min(doc.numPages, 1500);
      for (let i = 1; i <= n; i++) {
        const pg = await doc.getPage(i);
        const tc = await pg.getTextContent();
        let s = '';
        for (const it of tc.items) { s += it.str; s += it.hasEOL ? '\n' : (it.str.endsWith(' ') ? '' : ' '); }
        pages.push(s.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim().slice(0, 20000));
        pg.cleanup();
      }
      await doc.destroy();
      fs.writeFileSync(path.join(DIR, b.id + '.json'), JSON.stringify(pages));
      b.hal = doc.numPages;
      const chars = pages.reduce((a, p) => a + p.length, 0);
      // topik: kata paling sering (selain kata umum)
      const tf = new Map();
      for (const p of pages) for (const w of toks(p)) if (w.length > 3) tf.set(w, (tf.get(w) || 0) + 1);
      b.topik = [...tf.entries()].sort((a, c) => c[1] - a[1]).slice(0, 12).map((x) => x[0]);
      b.status = chars > 200 ? 'siap' : 'tanpa-teks';
      idxCache.delete(b.id);
    } catch (e) {
      console.error('buku: gagal mengekstrak', b.id, e && e.message);
      b.status = 'gagal';
    }
    changed();
  }
  function index(b) {
    if (idxCache.has(b.id)) return idxCache.get(b.id);
    let pages = [];
    try { pages = JSON.parse(fs.readFileSync(path.join(DIR, b.id + '.json'), 'utf8')); } catch { /* tidak ada */ }
    const chunks = [];
    pages.forEach((p, i) => {
      const paras = p.split(/\n{1,}/).map((x) => x.trim()).filter(Boolean);
      let cur = '';
      const push = () => { if (cur.trim().length > 40) chunks.push({ hal: i + 1, teks: cur.trim() }); cur = ''; };
      for (const para of paras) { cur += (cur ? ' ' : '') + para; if (cur.length > 700) push(); }
      push();
    });
    const df = new Map();
    for (const c of chunks) { c.tk = new Map(); for (const w of toks(c.teks)) c.tk.set(w, (c.tk.get(w) || 0) + 1); for (const w of c.tk.keys()) df.set(w, (df.get(w) || 0) + 1); }
    const r = { chunks, idf: (w) => Math.log(1 + chunks.length / (df.get(w) || 0.5)) };
    if (idxCache.size > 20) idxCache.delete(idxCache.keys().next().value);
    idxCache.set(b.id, r);
    return r;
  }
  function bestSnippet(text, qt) {
    const sents = text.split(/(?<=[.!?;:])\s+/).filter((s) => s.length > 15);
    if (!sents.length) return text.slice(0, 380);
    let bi = 0, bv = -1;
    sents.forEach((s, i) => { const st = new Set(toks(s)); const v = qt.filter((w) => st.has(w) || [...st].some((u) => u.length > 4 && w.length > 4 && (u.startsWith(w) || w.startsWith(u)))).length; if (v > bv) { bv = v; bi = i; } });
    let out = sents[bi];
    if (out.length < 200 && sents[bi + 1]) out += ' ' + sents[bi + 1];
    if (out.length < 200 && bi > 0) out = sents[bi - 1] + ' ' + out;
    return out.length > 420 ? out.slice(0, 417) + '…' : out;
  }
  function search(q, ids) {
    const qt = [...new Set(toks(q))];
    if (!qt.length) return [];
    const hits = [];
    for (const b of B) {
      if (ids && !ids.includes(b.id)) continue;
      if (b.status !== 'siap') continue;
      const ix = index(b);
      for (const c of ix.chunks) {
        let s = 0, m = 0;
        for (const w of qt) {
          let f = c.tk.get(w) || 0;
          if (!f && w.length > 4) for (const [u, k] of c.tk) if (u.length > 4 && (u.startsWith(w) || w.startsWith(u))) { f = k * 0.6; break; }
          if (f) { s += (1 + Math.log(f)) * ix.idf(w); m++; }
        }
        if (!m) continue;
        s *= m / qt.length; // utamakan potongan yang memuat lebih banyak kata kunci
        hits.push({ b, c, s });
      }
    }
    hits.sort((a, c) => c.s - a.s);
    const out = [], seen = new Set();
    for (const h of hits) { const k = h.b.id + ':' + h.c.hal; if (seen.has(k)) continue; seen.add(k); out.push({ id: h.b.id, judul: h.b.judul, hal: h.c.hal, teks: bestSnippet(h.c.teks, qt), skor: +h.s.toFixed(2) }); if (out.length >= 3) break; }
    return out;
  }

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
  const readJson = async (req) => { try { const o = JSON.parse((await readBody(req, 32 * 1024)).toString('utf8') || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };

  // GET /buku/<id>.pdf
  function serveFile(req, res, p) {
    const m = /^\/buku\/([a-f0-9]{16})\.pdf$/.exec(p);
    if (!m) return false;
    const b = B.find((x) => x.id === m[1]);
    const f = path.join(DIR, m[1] + '.pdf');
    if (!b) { res.writeHead(404, SEC); res.end('Not found'); return true; }
    fs.stat(f, (err, st) => {
      if (err) { res.writeHead(404, SEC); return res.end('Not found'); }
      const name = slug(b.judul) + '.pdf';
      res.writeHead(200, { ...SEC, 'Cache-Control': 'public, max-age=300', 'Content-Type': 'application/pdf', 'Content-Length': st.size, 'Content-Disposition': `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`, 'Content-Security-Policy': "default-src 'none'; sandbox" });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(f).pipe(res);
    });
    return true;
  }

  async function handle(req, res, p, url) {
    try {
      if (p === '/api/buku' && req.method === 'GET') return json(res, 200, { ok: true, books: B.map(pub) });
      if (p === '/api/buku/tanya' && req.method === 'GET') {
        const id = url.searchParams.get('id');
        const q = clean(url.searchParams.get('q'), 300);
        const ids = id ? id.split(',').filter((x) => /^[a-f0-9]{16}$/.test(x)).slice(0, 10) : null;
        return json(res, 200, { ok: true, hits: search(q, ids && ids.length ? ids : null) });
      }
      if (!p.startsWith('/api/admin/buku')) return false;
      if (!pem.authed(req)) return json(res, 401, { ok: false, err: 'Sesi berakhir. Silakan login kembali.' });
      if (req.method === 'POST' && !pem.sameOrigin(req)) return json(res, 403, { ok: false, err: 'Permintaan ditolak.' });
      if (p === '/api/admin/buku' && req.method === 'GET') return json(res, 200, { ok: true, books: B.map((b) => ({ ...pub(b), file: b.file })) });
      if (p === '/api/admin/buku/upload' && req.method === 'POST') {
        let meta = {};
        try { meta = JSON.parse(decodeURIComponent(String(req.headers['x-meta'] || '%7B%7D'))); } catch { /* kosong */ }
        const judul = clean(meta.judul, 140);
        if (judul.length < 2) return json(res, 400, { ok: false, err: 'Judul buku wajib diisi.' });
        if (B.length >= 500) return json(res, 507, { ok: false, err: 'Rak penuh (maks. 500 buku).' });
        const buf = await readBody(req, MAX_PDF);
        // hanya PDF asli: tanda tangan %PDF- di awal berkas
        const head = buf.subarray(0, 1024).toString('latin1');
        if (buf.length < 100 || head.indexOf('%PDF-') < 0 || head.indexOf('%PDF-') > 1000) return json(res, 400, { ok: false, err: 'Berkas bukan PDF. Hanya file PDF yang diterima.' });
        const id = crypto.randomBytes(8).toString('hex');
        fs.writeFileSync(path.join(DIR, id + '.pdf'), buf);
        const b = { id, judul, penulis: clean(meta.penulis, 100), kategori: clean(meta.kategori, 60), ringkasan: cleanLong(meta.ringkasan, 2000), file: clean(decodeURIComponent(String(req.headers['x-filename'] || '')), 140), ukuran: buf.length, t: Date.now(), status: 'proses', hal: 0, topik: [] };
        B.push(b); changed();
        extract(b); // di latar belakang
        return json(res, 200, { ok: true, id });
      }
      if (p === '/api/admin/buku/update' && req.method === 'POST') {
        const o = await readJson(req), b = B.find((x) => x.id === o.id);
        if (!b) return json(res, 404, { ok: false, err: 'Buku tidak ditemukan.' });
        const judul = clean(o.judul, 140); if (judul.length < 2) return json(res, 400, { ok: false, err: 'Judul buku wajib diisi.' });
        Object.assign(b, { judul, penulis: clean(o.penulis, 100), kategori: clean(o.kategori, 60), ringkasan: cleanLong(o.ringkasan, 2000) });
        changed(); return json(res, 200, { ok: true });
      }
      if (p === '/api/admin/buku/delete' && req.method === 'POST') {
        const o = await readJson(req), i = B.findIndex((x) => x.id === o.id);
        if (i < 0) return json(res, 404, { ok: false, err: 'Buku tidak ditemukan.' });
        const [b] = B.splice(i, 1);
        for (const ext of ['.pdf', '.json']) fs.unlink(path.join(DIR, b.id + ext), () => {});
        idxCache.delete(b.id);
        changed(); return json(res, 200, { ok: true });
      }
      return json(res, 404, { ok: false, err: 'Tidak ditemukan.' });
    } catch (e) {
      if (e && e.code === 413) return json(res, 413, { ok: false, err: 'Berkas terlalu besar (maks. 40 MB).' });
      console.error('buku:', e);
      if (!res.headersSent) return json(res, 500, { ok: false, err: 'Terjadi kesalahan server.' });
    }
    return true;
  }
  return { handle, serveFile, list: () => B.map(pub) };
}
module.exports = { createBuku };
