// =====================================================================
//  Sistem Pendaftaran Peminatan (menggantikan Google Form)
//  - Pendaftaran dari dalam galeri VR (POST /api/peminatan/daftar)
//  - Statistik publik untuk layar pie chart (GET /api/peminatan/stats)
//  - Pengumuman hasil final untuk papan Atrium (GET /api/peminatan/pengumuman)
//  - Halaman admin (/admin) dengan login: unduh Excel, unggah hasil final,
//    umumkan, arsipkan & reset untuk tahun berikutnya.
//  Data disimpan di DATA_DIR/peminatan.json, arsip di DATA_DIR/arsip-peminatan/
// =====================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');

const LABS = {
  keris: { code: 'KERIS', name: 'Knowledge Engineering & Reliable Intelligent Systems' },
  git: { code: 'GIT', name: 'Geospatial Information Technology' },
  se: { code: 'SE', name: 'Software Engineering' },
  csn: { code: 'CSN', name: 'Computing System Networking' }
};
const LAB_IDS = Object.keys(LABS);

function createPeminatan({ dataDir, onChange }) {
  const FILE = path.join(dataDir, 'peminatan.json');
  const ARC_DIR = path.join(dataDir, 'arsip-peminatan');
  fs.mkdirSync(ARC_DIR, { recursive: true });

  // ---------- akun admin ----------
  const ADMIN_USER = (process.env.PEMINATAN_USER || 'admin').trim();
  const genPass = !process.env.PEMINATAN_PASS;
  const ADMIN_PASS = process.env.PEMINATAN_PASS || crypto.randomBytes(9).toString('base64url');
  const SALT = crypto.randomBytes(16);
  const PASS_HASH = crypto.scryptSync(ADMIN_PASS, SALT, 32);
  const USER_HASH = crypto.createHash('sha256').update(ADMIN_USER.toLowerCase()).digest();

  // ---------- penyimpanan ----------
  const nowYear = new Date().getFullYear();
  const defPeriod = `${nowYear}/${nowYear + 1}`;
  let D = { period: defPeriod, open: true, entries: [], final: null, fv: 1, updated: Date.now() };
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (raw && typeof raw === 'object') {
      D = Object.assign(D, raw);
      if (!Array.isArray(D.entries)) D.entries = [];
    }
  } catch { /* belum ada */ }
  let saveT = null;
  function save() {
    D.updated = Date.now();
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const tmp = FILE + '.tmp';
      fs.writeFile(tmp, JSON.stringify(D), (err) => { if (!err) fs.rename(tmp, FILE, () => {}); });
    }, 200);
  }
  function changed(finalChanged) {
    if (finalChanged) D.fv = (D.fv || 1) + 1;
    save();
    if (onChange) onChange(publicStats());
  }

  // ---------- util ----------
  const clean = (v, n) => (typeof v === 'string' ? v : v == null ? '' : String(v))
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  const cleanName = (v) => clean(v, 80).replace(/[^\p{L}\p{M} .,'’-]/gu, '').trim();
  const cleanNim = (v) => clean(v, 24).replace(/\s+/g, '').toUpperCase();
  const nimOK = (s) => /^[0-9A-Z.\-]{5,20}$/.test(s);
  function normLab(v) {
    const s = clean(v, 120).toLowerCase();
    if (!s) return null;
    if (LAB_IDS.includes(s)) return s;
    if (/\bkeris\b|knowledge|intelligent|kecerdasan/.test(s)) return 'keris';
    if (/\bgit\b|geospa|geograf/.test(s)) return 'git';
    if (/\bcsn\b|network|jaringan|computing system|computer system/.test(s)) return 'csn';
    if (/\bse\b|\brpl\b|software|rekayasa perangkat/.test(s)) return 'se';
    return null;
  }
  const maskNim = (n) => (n.length <= 5 ? n[0] + '***' : n.slice(0, 4) + '•'.repeat(Math.max(2, n.length - 6)) + n.slice(-2));
  const countBy = (list, key) => { const c = { keris: 0, git: 0, se: 0, csn: 0 }; for (const e of list) if (c[e[key]] != null) c[e[key]]++; return c; };

  function publicStats() {
    return {
      period: D.period, open: !!D.open, total: D.entries.length,
      counts: countBy(D.entries, 'p1'), counts2: countBy(D.entries, 'p2'),
      updated: D.updated, fv: D.final && D.final.published ? D.fv : 0
    };
  }
  function publicFinal() {
    const F = D.final;
    if (!F || !F.published) return { published: false, period: D.period };
    return {
      published: true, period: F.period || D.period, title: F.title, note: F.note, at: F.publishedAt,
      counts: countBy(F.rows, 'lab'), total: F.rows.length,
      rows: F.rows.map((r) => ({ n: r.nama, m: maskNim(r.nim), l: r.lab }))
    };
  }

  // ---------- sesi admin ----------
  const sessions = new Map(); // token → { exp }
  const SESSION_MS = 8 * 3600e3;
  const loginFails = new Map(); // ip → { n, t }
  setInterval(() => {
    const now = Date.now();
    for (const [k, s] of sessions) if (s.exp < now) sessions.delete(k);
    for (const [k, f] of loginFails) if (now - f.t > 15 * 60e3) loginFails.delete(k);
    for (const [k, f] of regLimit) if (now - f.t > 10 * 60e3) regLimit.delete(k);
  }, 60e3).unref();
  const regLimit = new Map();
  let regGlobal = { t: 0, n: 0 };

  function clientIp(req) {
    const ra = req.socket.remoteAddress || '';
    // hanya percaya header proxy bila koneksi datang dari proxy lokal (Nginx di mesin yang sama)
    if ((ra === '127.0.0.1' || ra === '::1' || ra === '::ffff:127.0.0.1') && req.headers['x-real-ip']) return String(req.headers['x-real-ip']).slice(0, 64);
    return ra;
  }
  function cookies(req) {
    const o = {};
    for (const part of String(req.headers.cookie || '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0) o[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return o;
  }
  function authed(req) {
    const t = cookies(req).pem_sid;
    if (!t || t.length > 100) return false;
    const s = sessions.get(t);
    if (!s || s.exp < Date.now()) return false;
    s.exp = Date.now() + SESSION_MS; // perpanjang selama aktif
    return true;
  }
  const isHttps = (req) => !!req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

  // ---------- respons ----------
  const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store' };
  function json(res, code, obj, extra) {
    const body = JSON.stringify(obj);
    res.writeHead(code, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', ...(extra || {}) });
    res.end(body);
  }
  function readBody(req, max) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > max) { reject(Object.assign(new Error('too_large'), { code: 413 })); req.destroy(); return; } chunks.push(c); });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }
  async function readJson(req, max = 32 * 1024) {
    const b = await readBody(req, max);
    try { const o = JSON.parse(b.toString('utf8') || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; }
  }
  // perlindungan CSRF untuk endpoint admin yang mengubah data
  function sameOrigin(req) {
    if (req.headers['x-pem'] !== '1') return false;
    const o = req.headers.origin;
    if (!o) return true;
    try { return new URL(o).host === req.headers.host; } catch { return false; }
  }

  // ---------- Excel ----------
  const fmtTime = (t) => (t ? new Date(t).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) : '');
  function styleSheet(ws, color) {
    const h = ws.getRow(1);
    h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h.alignment = { vertical: 'middle' };
    h.height = 22;
    h.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }; c.border = { bottom: { style: 'thin', color: { argb: 'FF999999' } } }; });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    if (ws.rowCount > 1) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  }
  async function buildWorkbook(src) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Lab Peminatan VR — Teknik Informatika UIKA';
    wb.created = new Date();
    const entries = src.entries || [];
    const ws = wb.addWorksheet('Pendaftar');
    ws.columns = [
      { header: 'No', key: 'no', width: 6 }, { header: 'Waktu Daftar', key: 't', width: 22 }, { header: 'NIM', key: 'nim', width: 16 },
      { header: 'Nama Lengkap', key: 'nama', width: 32 }, { header: 'Angkatan', key: 'ang', width: 10 }, { header: 'Email', key: 'email', width: 28 },
      { header: 'No. WhatsApp', key: 'hp', width: 18 }, { header: 'Pilihan 1', key: 'p1', width: 11 }, { header: 'Pilihan 2', key: 'p2', width: 11 },
      { header: 'Alasan Memilih', key: 'alasan', width: 60 }, { header: 'Nama di VR', key: 'vr', width: 16 }, { header: 'Diperbarui', key: 'u', width: 22 }
    ];
    entries.forEach((e, i) => ws.addRow({ no: i + 1, t: fmtTime(e.t), nim: e.nim, nama: e.nama, ang: e.angkatan, email: e.email, hp: e.hp, p1: LABS[e.p1]?.code || e.p1, p2: LABS[e.p2]?.code || e.p2, alasan: e.alasan, vr: e.vr, u: e.u ? fmtTime(e.u) : '' }));
    ws.getColumn('alasan').alignment = { wrapText: true, vertical: 'top' };
    ws.getColumn('nim').numFmt = '@';
    styleSheet(ws, 'FF6D28D9');

    const rk = wb.addWorksheet('Rekap');
    rk.columns = [{ header: 'Lab Peminatan', key: 'lab', width: 48 }, { header: 'Pilihan 1', key: 'c1', width: 12 }, { header: 'Persentase', key: 'pc', width: 13 }, { header: 'Pilihan 2', key: 'c2', width: 12 }];
    const c1 = countBy(entries, 'p1'), c2 = countBy(entries, 'p2'), tot = entries.length || 0;
    for (const id of LAB_IDS) rk.addRow({ lab: `${LABS[id].code} — ${LABS[id].name}`, c1: c1[id], pc: tot ? c1[id] / tot : 0, c2: c2[id] });
    const tr = rk.addRow({ lab: 'TOTAL', c1: tot, pc: tot ? 1 : 0, c2: tot });
    tr.font = { bold: true };
    rk.getColumn('pc').numFmt = '0.0%';
    styleSheet(rk, 'FF0EA5E9');
    rk.addRow([]);
    rk.addRow([`Periode: ${src.period || '-'}`]);
    rk.addRow([`Diunduh: ${fmtTime(Date.now())} WIB`]);

    if (src.final && Array.isArray(src.final.rows) && src.final.rows.length) {
      const fs2 = wb.addWorksheet('Hasil Final');
      fs2.columns = [{ header: 'No', key: 'no', width: 6 }, { header: 'NIM', key: 'nim', width: 16 }, { header: 'Nama', key: 'nama', width: 32 }, { header: 'Lab', key: 'lab', width: 10 }, { header: 'Nama Lab', key: 'ln', width: 48 }];
      src.final.rows.forEach((r, i) => fs2.addRow({ no: i + 1, nim: r.nim, nama: r.nama, lab: LABS[r.lab]?.code || r.lab, ln: LABS[r.lab]?.name || '' }));
      styleSheet(fs2, 'FF16A34A');
    }
    return wb;
  }
  async function sendXlsx(res, wb, name) {
    const buf = await wb.xlsx.writeBuffer();
    res.writeHead(200, { ...SEC, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}"`, 'Content-Length': buf.length });
    res.end(Buffer.from(buf));
  }
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'periode';

  // ---------- unggah hasil final (xlsx / csv) ----------
  function parseCsv(text) {
    const rows = []; let row = [], cur = '', q = false;
    const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
      if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch !== '\r') cur += ch;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  const cellText = (v) => {
    if (v == null) return '';
    if (typeof v === 'object') { if (v.richText) return v.richText.map((r) => r.text).join(''); if (v.text != null) return String(v.text); if (v.result != null) return String(v.result); if (v instanceof Date) return v.toISOString(); return ''; }
    return String(v);
  };
  async function parseUpload(buf, filename) {
    let table = [];
    const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
    if (isZip) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      // pilih lembar "Hasil Final" bila ada, kalau tidak lembar pertama
      const ws = wb.getWorksheet('Hasil Final') || wb.worksheets[0];
      if (!ws) throw new Error('Berkas Excel tidak memiliki lembar kerja.');
      ws.eachRow({ includeEmpty: false }, (r) => { const a = []; r.eachCell({ includeEmpty: true }, (c, col) => { a[col - 1] = cellText(c.value); }); table.push(a.map((x) => x || '')); });
    } else if (/\.xls$/i.test(filename || '')) {
      throw new Error('Format .xls lama tidak didukung. Simpan ulang sebagai .xlsx atau .csv.');
    } else {
      table = parseCsv(buf.toString('utf8').replace(/^﻿/, ''));
    }
    // cari baris judul yang memuat kolom NIM, Nama, dan Lab/Peminatan
    let hi = -1, cN = -1, cM = -1, cL = -1;
    for (let i = 0; i < Math.min(table.length, 15) && hi < 0; i++) {
      const r = table[i].map((x) => String(x).toLowerCase().trim());
      const n = r.findIndex((x) => /^nim|npm|nomor induk/.test(x)), m = r.findIndex((x) => /^nama(?! lab)/.test(x)), l = r.findIndex((x) => /^(lab|peminatan|hasil|penetapan)/.test(x));
      if (n >= 0 && m >= 0 && l >= 0) { hi = i; cN = n; cM = m; cL = l; }
    }
    if (hi < 0) throw new Error('Kolom tidak ditemukan. Baris judul harus memuat kolom "NIM", "Nama", dan "Lab" (atau "Peminatan").');
    const rows = [], errors = [], seen = new Set();
    for (let i = hi + 1; i < table.length; i++) {
      const r = table[i];
      if (!r || r.every((x) => !String(x).trim())) continue;
      const nim = cleanNim(r[cN]), nama = cleanName(r[cM]), lab = normLab(r[cL]);
      const at = `Baris ${i + 1}`;
      if (!nimOK(nim)) { errors.push(`${at}: NIM "${clean(r[cN], 30)}" tidak valid`); continue; }
      if (nama.length < 2) { errors.push(`${at}: nama kosong`); continue; }
      if (!lab) { errors.push(`${at}: lab "${clean(r[cL], 30)}" tidak dikenali (gunakan KERIS/GIT/SE/CSN)`); continue; }
      if (seen.has(nim)) { errors.push(`${at}: NIM ${nim} ganda — baris diabaikan`); continue; }
      seen.add(nim);
      rows.push({ nim, nama, lab });
      if (rows.length >= 5000) break;
    }
    return { rows, errors };
  }

  // ---------- arsip ----------
  function listArchives() {
    let files = [];
    try { files = fs.readdirSync(ARC_DIR).filter((f) => /^[a-z0-9-]+\.json$/.test(f)); } catch { /* kosong */ }
    return files.map((f) => {
      try { const a = JSON.parse(fs.readFileSync(path.join(ARC_DIR, f), 'utf8')); return { id: f.slice(0, -5), label: a.label, period: a.period, at: a.archivedAt, total: (a.entries || []).length, final: a.final ? (a.final.rows || []).length : 0 }; } catch { return null; }
    }).filter(Boolean).sort((a, b) => b.at - a.at);
  }
  const arcPath = (id) => (/^[a-z0-9-]{3,80}$/.test(id || '') ? path.join(ARC_DIR, id + '.json') : null);

  function adminState() {
    return {
      user: ADMIN_USER, period: D.period, open: !!D.open, stats: publicStats(),
      entries: D.entries.map((e) => ({ id: e.id, t: e.t, u: e.u || 0, nim: e.nim, nama: e.nama, angkatan: e.angkatan, email: e.email, hp: e.hp, p1: e.p1, p2: e.p2, alasan: e.alasan, vr: e.vr })),
      final: D.final ? { title: D.final.title, note: D.final.note, published: !!D.final.published, publishedAt: D.final.publishedAt || 0, uploadedAt: D.final.uploadedAt, source: D.final.source, rows: D.final.rows, counts: countBy(D.final.rows, 'lab') } : null,
      archives: listArchives()
    };
  }

  // ---------- router ----------
  async function handle(req, res, p, url) {
    try {
      // ===== publik =====
      if (p === '/api/peminatan/stats' && req.method === 'GET') return json(res, 200, publicStats());
      if (p === '/api/peminatan/pengumuman' && req.method === 'GET') return json(res, 200, publicFinal());
      if (p === '/api/peminatan/cek' && req.method === 'GET') {
        const nim = cleanNim(url.searchParams.get('nim'));
        const F = D.final;
        if (!F || !F.published) return json(res, 200, { published: false });
        const r = nimOK(nim) ? F.rows.find((x) => x.nim === nim) : null;
        return json(res, 200, r ? { published: true, found: true, nama: r.nama, lab: r.lab } : { published: true, found: false });
      }
      if (p === '/api/peminatan/daftar' && req.method === 'POST') {
        if (!sameOrigin(req)) return json(res, 403, { ok: false, err: 'Permintaan ditolak.' });
        const ip = clientIp(req), now = Date.now();
        const rl = regLimit.get(ip) || { n: 0, t: now };
        if (now - rl.t > 10 * 60e3) { rl.n = 0; rl.t = now; }
        if (++rl.n > 12) { regLimit.set(ip, rl); return json(res, 429, { ok: false, err: 'Terlalu banyak percobaan. Coba lagi 10 menit lagi.' }); }
        regLimit.set(ip, rl);
        if (now - regGlobal.t > 60e3) regGlobal = { t: now, n: 0 };
        if (++regGlobal.n > 400) return json(res, 503, { ok: false, err: 'Server sedang sibuk, coba sebentar lagi.' });
        if (!D.open) return json(res, 403, { ok: false, err: 'Pendaftaran peminatan sedang ditutup.' });
        const b = await readJson(req);
        const nama = cleanName(b.nama), nim = cleanNim(b.nim), angkatan = clean(b.angkatan, 4).replace(/\D/g, '');
        const email = clean(b.email, 80), hp = clean(b.hp, 20).replace(/[^0-9+ -]/g, ''), p1 = normLab(b.p1), p2 = normLab(b.p2);
        const alasan = clean(b.alasan, 500), vr = clean(b.vr, 16), tok = clean(b.tok, 64);
        const errs = [];
        if (nama.length < 3) errs.push('Nama lengkap minimal 3 huruf.');
        if (!nimOK(nim)) errs.push('NIM tidak valid (5–20 karakter angka/huruf).');
        const y = +angkatan;
        if (!(y >= 2010 && y <= nowYear + 1)) errs.push('Angkatan harus berupa tahun, mis. 2024.');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errs.push('Format email tidak valid.');
        if (hp && hp.replace(/\D/g, '').length < 9) errs.push('Nomor WhatsApp terlalu pendek.');
        if (!email && !hp) errs.push('Isi minimal email atau nomor WhatsApp.');
        if (!p1) errs.push('Pilih lab peminatan pilihan 1.');
        if (!p2) errs.push('Pilih lab peminatan pilihan 2.');
        if (p1 && p2 && p1 === p2) errs.push('Pilihan 1 dan pilihan 2 harus berbeda.');
        if (errs.length) return json(res, 400, { ok: false, err: errs.join(' ') });
        let e = D.entries.find((x) => x.nim === nim);
        let newTok = null;
        if (e) {
          if (!(tok && e.th === crypto.createHash('sha256').update(tok).digest('hex'))) return json(res, 409, { ok: false, err: `NIM ${nim} sudah terdaftar. Bila ingin mengubah pilihan, gunakan browser yang sama saat mendaftar atau hubungi admin peminatan.` });
          Object.assign(e, { nama, angkatan, email, hp, p1, p2, alasan, vr, u: now });
        } else {
          if (D.entries.length >= 20000) return json(res, 507, { ok: false, err: 'Kapasitas pendaftaran penuh.' });
          newTok = crypto.randomBytes(16).toString('hex');
          e = { id: crypto.randomBytes(8).toString('hex'), t: now, nim, nama, angkatan, email, hp, p1, p2, alasan, vr, th: crypto.createHash('sha256').update(newTok).digest('hex') };
          D.entries.push(e);
        }
        changed(false);
        return json(res, 200, { ok: true, updated: !newTok, tok: newTok || tok, e: { nim, nama, angkatan, email, hp, p1, p2, alasan, t: e.t } });
      }

      // ===== admin =====
      if (!p.startsWith('/api/admin/')) return json(res, 404, { ok: false, err: 'Tidak ditemukan.' });
      if (p === '/api/admin/login' && req.method === 'POST') {
        if (!sameOrigin(req)) return json(res, 403, { ok: false, err: 'Permintaan ditolak.' });
        const ip = clientIp(req), f = loginFails.get(ip) || { n: 0, t: Date.now() };
        if (f.n >= 8 && Date.now() - f.t < 15 * 60e3) return json(res, 429, { ok: false, err: 'Terlalu banyak percobaan login. Coba lagi 15 menit lagi.' });
        const b = await readJson(req, 4096);
        const u = clean(b.user, 100).toLowerCase(), pw = typeof b.pass === 'string' ? b.pass.slice(0, 200) : '';
        const okU = crypto.timingSafeEqual(crypto.createHash('sha256').update(u).digest(), USER_HASH);
        const okP = crypto.timingSafeEqual(crypto.scryptSync(pw, SALT, 32), PASS_HASH);
        if (!(okU && okP)) {
          if (Date.now() - f.t > 15 * 60e3) { f.n = 0; f.t = Date.now(); }
          f.n++; loginFails.set(ip, f);
          return json(res, 401, { ok: false, err: 'Username atau password salah.' });
        }
        loginFails.delete(ip);
        const t = crypto.randomBytes(32).toString('base64url');
        sessions.set(t, { exp: Date.now() + SESSION_MS });
        return json(res, 200, { ok: true }, { 'Set-Cookie': `pem_sid=${t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}${isHttps(req) ? '; Secure' : ''}` });
      }
      if (p === '/api/admin/logout' && req.method === 'POST') {
        const t = cookies(req).pem_sid; if (t) sessions.delete(t);
        return json(res, 200, { ok: true }, { 'Set-Cookie': 'pem_sid=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' });
      }
      if (!authed(req)) return json(res, 401, { ok: false, err: 'Sesi berakhir. Silakan login kembali.' });
      if (req.method === 'POST' && !sameOrigin(req)) return json(res, 403, { ok: false, err: 'Permintaan ditolak.' });

      if (p === '/api/admin/state' && req.method === 'GET') return json(res, 200, { ok: true, ...adminState() });
      if (p === '/api/admin/export.xlsx' && req.method === 'GET') {
        const id = url.searchParams.get('arsip');
        if (id) {
          const f = arcPath(id); if (!f) return json(res, 400, { ok: false, err: 'Arsip tidak valid.' });
          let a; try { a = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return json(res, 404, { ok: false, err: 'Arsip tidak ditemukan.' }); }
          return sendXlsx(res, await buildWorkbook(a), `arsip-peminatan-${slug(a.label || a.period)}.xlsx`);
        }
        return sendXlsx(res, await buildWorkbook(D), `peminatan-${slug(D.period)}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      }
      if (p === '/api/admin/template.xlsx' && req.method === 'GET') {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Hasil Final');
        ws.columns = [{ header: 'NIM', key: 'nim', width: 16 }, { header: 'Nama', key: 'nama', width: 32 }, { header: 'Lab', key: 'lab', width: 10 }, { header: 'Catatan (opsional)', key: 'c', width: 40 }];
        for (const e of D.entries) ws.addRow({ nim: e.nim, nama: e.nama, lab: LABS[e.p1]?.code || '', c: `Pilihan 2: ${LABS[e.p2]?.code || '-'}` });
        ws.getColumn('nim').numFmt = '@';
        styleSheet(ws, 'FF16A34A');
        ws.dataValidations?.add?.(`C2:C${Math.max(2, D.entries.length + 200)}`, { type: 'list', allowBlank: true, formulae: ['"KERIS,GIT,SE,CSN"'] });
        return sendXlsx(res, wb, `template-hasil-final-${slug(D.period)}.xlsx`);
      }
      if (p === '/api/admin/open' && req.method === 'POST') { const b = await readJson(req); D.open = !!b.open; changed(false); return json(res, 200, { ok: true, open: D.open }); }
      if (p === '/api/admin/period' && req.method === 'POST') {
        const b = await readJson(req); const v = clean(b.period, 40);
        if (v.length < 4) return json(res, 400, { ok: false, err: 'Label periode minimal 4 karakter (mis. 2026/2027).' });
        D.period = v; if (D.final) D.final.period = v; changed(true); return json(res, 200, { ok: true });
      }
      if (p === '/api/admin/entry/delete' && req.method === 'POST') {
        const b = await readJson(req); const i = D.entries.findIndex((x) => x.id === b.id);
        if (i < 0) return json(res, 404, { ok: false, err: 'Data tidak ditemukan.' });
        D.entries.splice(i, 1); changed(false); return json(res, 200, { ok: true });
      }
      if (p === '/api/admin/final/upload' && req.method === 'POST') {
        const buf = await readBody(req, 5 * 1024 * 1024);
        if (!buf.length) return json(res, 400, { ok: false, err: 'Berkas kosong.' });
        let r;
        try { r = await parseUpload(buf, clean(decodeURIComponent(String(req.headers['x-filename'] || '')), 120)); } catch (e) { return json(res, 400, { ok: false, err: e.message && e.message.length < 200 ? e.message : 'Berkas tidak bisa dibaca. Gunakan .xlsx atau .csv.' }); }
        if (!r.rows.length) return json(res, 400, { ok: false, err: 'Tidak ada baris data yang valid.', errors: r.errors.slice(0, 50) });
        const prev = D.final || {};
        D.final = { title: prev.title || `Hasil Penetapan Peminatan ${D.period}`, note: prev.note || '', rows: r.rows, published: false, publishedAt: 0, uploadedAt: Date.now(), source: clean(decodeURIComponent(String(req.headers['x-filename'] || 'unggahan')), 120), period: D.period };
        changed(true);
        return json(res, 200, { ok: true, count: r.rows.length, errors: r.errors.slice(0, 50), nErr: r.errors.length });
      }
      if (p === '/api/admin/final/meta' && req.method === 'POST') {
        if (!D.final) return json(res, 400, { ok: false, err: 'Belum ada data hasil final.' });
        const b = await readJson(req);
        D.final.title = clean(b.title, 120) || `Hasil Penetapan Peminatan ${D.period}`;
        D.final.note = clean(b.note, 400);
        changed(true); return json(res, 200, { ok: true });
      }
      if (p === '/api/admin/final/publish' && req.method === 'POST') {
        if (!D.final) return json(res, 400, { ok: false, err: 'Unggah data hasil final terlebih dahulu.' });
        const b = await readJson(req);
        D.final.published = !!b.publish; D.final.publishedAt = D.final.published ? Date.now() : 0;
        changed(true); return json(res, 200, { ok: true, published: D.final.published });
      }
      if (p === '/api/admin/final/clear' && req.method === 'POST') { D.final = null; changed(true); return json(res, 200, { ok: true }); }
      if (p === '/api/admin/archive' && req.method === 'POST') {
        const b = await readJson(req);
        const label = clean(b.label, 60) || D.period, next = clean(b.next, 40);
        if (next && next.length < 4) return json(res, 400, { ok: false, err: 'Label periode baru minimal 4 karakter.' });
        if (!D.entries.length && !D.final) return json(res, 400, { ok: false, err: 'Tidak ada data untuk diarsipkan.' });
        const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const id = `${stamp}-${slug(label)}`;
        const arc = { label, period: D.period, archivedAt: Date.now(), entries: D.entries, final: D.final };
        fs.writeFileSync(arcPath(id), JSON.stringify(arc));
        D.entries = []; D.final = null; D.open = b.open !== false;
        if (next) D.period = next;
        changed(true);
        return json(res, 200, { ok: true, id });
      }
      if (p === '/api/admin/archive/delete' && req.method === 'POST') {
        const b = await readJson(req); const f = arcPath(b.id);
        if (!f) return json(res, 400, { ok: false, err: 'Arsip tidak valid.' });
        try { fs.unlinkSync(f); } catch { return json(res, 404, { ok: false, err: 'Arsip tidak ditemukan.' }); }
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { ok: false, err: 'Tidak ditemukan.' });
    } catch (e) {
      if (e && e.code === 413) return json(res, 413, { ok: false, err: 'Berkas terlalu besar (maks. 5 MB).' });
      console.error('peminatan:', e);
      if (!res.headersSent) return json(res, 500, { ok: false, err: 'Terjadi kesalahan server.' });
    }
    return true;
  }

  return {
    handle, publicStats, authed, sameOrigin, clientIp,
    info: { user: ADMIN_USER, pass: genPass ? ADMIN_PASS : null }
  };
}

module.exports = { createPeminatan };
