// =====================================================================
//  KELAS FUNGSIONAL — Kelas 1, Kelas 2 & Ruang Rapat
//  - Jadwal (sekali / mingguan) dikelola admin. Di luar jadwal ruang terbuka
//    bebas; selama jadwal berlangsung hanya pemain dengan TOKEN PESERTA atau
//    KODE PENGAJAR yang boleh masuk.
//  - Peran pengajar: kunci papan, bisukan semua, beri giliran bicara,
//    keluarkan peserta, kuis/polling, berbagi layar.
//  - Peserta: angkat tangan, chat ruang, notulen bersama, ikut polling.
//  - Presensi otomatis per sesi (masuk, keluar, durasi) → Excel di admin.
//  - Kapasitas: kursi yang tersedia (kelas 128, rapat 25).
//  Data: DATA_DIR/kelas.json
// =====================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RUANG = { kelas1: 'Kelas 1 · Auditorium', kelas2: 'Kelas 2 · Auditorium', rapat: 'Ruang Rapat' };
const CAP = { kelas1: 128, kelas2: 128, rapat: 25 };
const WEEK = 7 * 864e5;
// bagian notulen (rangkuman tertulis)
const NOTE_F = ['agenda', 'ringkasan', 'keputusan', 'tindak'];
const NOTE_L = { agenda: 'Agenda', ringkasan: 'Ringkasan pembahasan', keputusan: 'Keputusan / kesimpulan', tindak: 'Tindak lanjut (siapa · apa · tenggat)' };
const noteText = (t) => (typeof t === 'string' ? { ringkasan: t } : t || {});
const TOK_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genTok = (n) => { let s = ''; const b = crypto.randomBytes(n); for (let i = 0; i < n; i++) s += TOK_CH[b[i] % TOK_CH.length]; return s; };
const normTok = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const clean = (v, n) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const cleanLong = (v, n) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').slice(0, n);

function createKelas({ dataDir, pem, getRooms, sfu, sb }) {
  const FILE = path.join(dataDir, 'kelas.json');
  let D = { jadwal: [], sesi: {}, catatan: {} };
  try { const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (raw && typeof raw === 'object') D = Object.assign(D, raw); } catch { /* belum ada */ }
  if (!Array.isArray(D.jadwal)) D.jadwal = [];
  let saveT = null;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { const tmp = FILE + '.tmp'; fs.writeFile(tmp, JSON.stringify(D), (e) => { if (!e) fs.rename(tmp, FILE, () => {}); }); }, 400); };
  const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

  // ---------- jadwal ----------
  // kemunculan jadwal yang sedang berlangsung pada waktu t
  function occAt(j, t) {
    const dur = j.selesai - j.mulai;
    if (j.ulang === 'mingguan') {
      if (t < j.mulai) return null;
      const k = Math.floor((t - j.mulai) / WEEK), s = j.mulai + k * WEEK;
      if (j.sampai && s > j.sampai) return null;
      return t >= s && t < s + dur ? { s, e: s + dur } : null;
    }
    return t >= j.mulai && t < j.selesai ? { s: j.mulai, e: j.selesai } : null;
  }
  function nextOcc(j, t) {
    const dur = j.selesai - j.mulai;
    if (j.ulang === 'mingguan') {
      const k = Math.max(0, Math.ceil((t - j.mulai) / WEEK)), s = j.mulai + k * WEEK;
      if (j.sampai && s > j.sampai) return null;
      return { s, e: s + dur };
    }
    return j.mulai > t ? { s: j.mulai, e: j.selesai } : null;
  }
  function aktif(r, t = Date.now()) {
    for (const j of D.jadwal) if (j.ruang === r) { const o = occAt(j, t); if (o) return { j, s: o.s, e: o.e, key: j.id + ':' + o.s }; }
    return null;
  }
  function berikut(r, t = Date.now()) {
    let best = null;
    for (const j of D.jadwal) if (j.ruang === r) { const o = nextOcc(j, t); if (o && (!best || o.s < best.s)) best = { j, s: o.s, e: o.e }; }
    return best;
  }
  const pubSesi = (a) => a ? { judul: a.j.judul, pengajar: a.j.pengajar, mulai: a.s, selesai: a.e } : null;
  function jadwalPub() {
    const o = {}, now = Date.now();
    for (const r of Object.keys(RUANG)) { const n = berikut(r, now); o[r] = { aktif: pubSesi(aktif(r, now)), berikut: n ? { judul: n.j.judul, pengajar: n.j.pengajar, mulai: n.s, selesai: n.e } : null, cap: CAP[r] }; }
    return o;
  }
  function overlap(a, b) {
    // cek bentrok kasar untuk 52 minggu ke depan
    const occs = (j) => { const out = []; if (j.ulang === 'mingguan') { for (let k = 0; k < 60; k++) { const s = j.mulai + k * WEEK; if (j.sampai && s > j.sampai) break; out.push([s, s + j.selesai - j.mulai]); } } else out.push([j.mulai, j.selesai]); return out; };
    const A = occs(a), B = occs(b);
    return A.some(([s1, e1]) => B.some(([s2, e2]) => s1 < e2 && s2 < e1));
  }

  // ---------- keadaan langsung per ruang server (?room=) ----------
  function L(rData, r) {
    rData.kls = rData.kls || {};
    if (!rData.kls[r]) rData.kls[r] = { members: new Map(), ctl: { lock: true, muteAll: false }, chat: [], poll: null, sesiKey: null, screen: null, polls: [] };
    return rData.kls[r];
  }
  const sfuKey = (ws, r) => ws.room + '|' + r;
  const noteKey = (ws, r, a) => a ? 'sesi:' + a.key : 'bebas:' + ws.room + ':' + r;
  function roleOf(ws) { return ws.kls ? ws.kls.role : null; }
  function isTeacher(ws) { return ws.kls && ws.kls.role === 'pengajar'; }
  // dalam sesi, peserta hanya boleh bicara bila tidak dibisukan semua atau diberi giliran
  function micAllowed(K, ws) {
    if (!K) return false;
    const m = K.members.get(ws); if (!m) return false;
    if (m.role === 'pengajar' || m.role === 'bebas') return true;
    return !K.ctl.muteAll || m.floor;
  }
  function state(ws, K, r) {
    const a = aktif(r), me = K.members.get(ws);
    const peserta = [...K.members.entries()].map(([c, m]) => ({ id: c.id, n: m.n, role: m.role, hand: !!m.hand, floor: !!m.floor, mic: micAllowed(K, c) }));
    const poll = K.poll ? { id: K.poll.id, q: K.poll.q, opsi: K.poll.opsi, open: K.poll.open, show: K.poll.show, by: K.poll.by, n: K.poll.votes.size, hasil: K.poll.opsi.map((_, i) => [...K.poll.votes.values()].filter((v) => v === i).length), mine: K.poll.votes.has(ws.id) ? K.poll.votes.get(ws.id) : -1 } : null;
    return { type: 'kls_st', r, sesi: pubSesi(a), me: me ? { role: me.role, hand: !!me.hand, floor: !!me.floor, mic: micAllowed(K, ws) } : null, peserta, ctl: K.ctl, poll, screen: K.screen, cap: CAP[r] };
  }
  function broadcast(rData, r) {
    const K = L(rData, r);
    for (const c of K.members.keys()) send(c, state(c, K, r));
  }
  function applyMics(rData, r) {
    if (!sfu) return;
    const K = L(rData, r);
    for (const [c] of K.members) sfu.setMic(c, sfuKey(c, r), !micAllowed(K, c));
  }

  // ---------- presensi ----------
  function presMasuk(a, ws, m) {
    const S = D.sesi[a.key] = D.sesi[a.key] || { key: a.key, jid: a.j.id, ruang: a.j.ruang, judul: a.j.judul, pengajar: a.j.pengajar, mulai: a.s, selesai: a.e, peserta: {} };
    const k = (m.no ? m.no : 'nama:' + m.n.toLowerCase()) + '|' + m.role;
    const e = S.peserta[k] = S.peserta[k] || { nama: m.n, no: m.no || '', peran: m.role, masuk: Date.now(), keluar: 0, durasi: 0, kali: 0 };
    e.kali++; e.nama = m.n; m.presK = k; m.presT = Date.now(); m.presS = a.key;
    save();
  }
  function presKeluar(m) {
    if (!m || !m.presS) return;
    const S = D.sesi[m.presS], e = S && S.peserta[m.presK];
    if (e) { const now = Math.min(Date.now(), S.selesai); e.durasi += Math.max(0, now - m.presT); e.keluar = Date.now(); save(); }
    m.presS = null;
  }

  // ---------- masuk / keluar ruang ----------
  function join(ws, rData, members, m) {
    const r = m.r; if (!RUANG[r]) return;
    const K = L(rData, r), a = aktif(r);
    if (ws.kls && ws.kls.r !== r) leave(ws, rData);
    if (K.members.has(ws)) { send(ws, { type: 'kls_join_res', r, ok: true, role: K.members.get(ws).role }); send(ws, state(ws, K, r)); return; }
    const n = clean(ws.presence && ws.presence.n, 16) || 'Pengunjung';
    let role = 'bebas';
    if (a) {
      const tok = normTok(m.token), kode = normTok(m.kode);
      if ((K.banned || new Map()).get(a.key + '|' + n.toLowerCase())) return send(ws, { type: 'kls_join_res', r, ok: false, err: 'Kamu telah dikeluarkan pengajar dari sesi ini.' });
      if (kode && kode === a.j.kode) role = 'pengajar';
      else if (tok && tok === a.j.token) role = 'peserta';
      else return send(ws, { type: 'kls_join_res', r, ok: false, need: true, sesi: pubSesi(a), err: tok || kode ? 'Token tidak cocok. Minta token yang benar kepada pengajar.' : '' });
    }
    if (K.members.size >= CAP[r]) return send(ws, { type: 'kls_join_res', r, ok: false, err: `${RUANG[r]} penuh (${CAP[r]} orang).` });
    const info = { n, no: clean(m.no, 20), role, hand: false, floor: false };
    K.members.set(ws, info);
    ws.kls = { r, role, rData };
    if (a) { if (K.sesiKey !== a.key) { K.sesiKey = a.key; K.ctl = { lock: true, muteAll: false }; K.poll = null; } presMasuk(a, ws, info); }
    send(ws, { type: 'kls_join_res', r, ok: true, role, sfu: !!(sfu && sfu.ok()) });
    const nk = noteKey(ws, r, a), note = D.catatan[nk] || { t: {}, v: 0 };
    send(ws, { type: 'kls_note', r, t: note.t, v: note.v, by: note.by || '' });
    send(ws, { type: 'kls_chatlog', r, list: K.chat.slice(-60) });
    broadcast(rData, r);
  }
  function leave(ws, rData) {
    if (!ws.kls) return;
    const RD = rData || ws.kls.rData, r = ws.kls.r, K = L(RD, r), m = K.members.get(ws);
    presKeluar(m);
    K.members.delete(ws);
    if (K.screen && K.screen.id === ws.id) K.screen = null;
    if (sfu) sfu.leave(ws, sfuKey(ws, r));
    ws.kls = null;
    broadcast(RD, r);
  }

  // izin mengendalikan smart board (dipakai modul smartboard)
  function boardAllow(ws, rData, b) {
    if (!RUANG[b]) return true;
    const a = aktif(b); if (!a) return true;
    const K = L(rData, b), m = K.members.get(ws);
    if (!m) return false;
    return m.role === 'pengajar' || !K.ctl.lock;
  }
  // izin SFU
  function sfuAllow(ws, rData, r, src, resume) {
    const K = L(rData, r), m = K.members.get(ws);
    if (!m) return 'Belum bergabung ke ruangan.';
    if (src === 'mic') return micAllowed(K, ws) ? '' : (resume ? 'Pengajar sedang membisukan peserta. Angkat tangan untuk minta giliran bicara.' : '');
    // berbagi layar: pengajar dalam sesi; di luar sesi siapa saja (satu per ruang)
    if (aktif(r) && m.role !== 'pengajar') return 'Hanya pengajar yang bisa berbagi layar selama sesi.';
    if (K.screen && K.screen.id !== ws.id) return `${K.screen.n} sedang berbagi layar.`;
    return '';
  }

  // ---------- pesan WebSocket ----------
  const RL = new WeakMap();
  function limited(ws, n = 8) { const now = Date.now(), a = (RL.get(ws) || []).filter((x) => now - x < 10000); if (a.length >= n) return true; a.push(now); RL.set(ws, a); return false; }
  async function onMessage(ws, m, rData, members) {
    if (m.type === 'kls_join') return join(ws, rData, members, m);
    if (m.type === 'kls_leave') return leave(ws, rData);
    if (m.type === 'kls_jadwal') return send(ws, { type: 'kls_jadwal', j: jadwalPub() });
    if (m.type && m.type.startsWith('sfu_')) {
      const rid = m.rid, r = ws.kls && ws.kls.r;
      if (!sfu || !r) return send(ws, { type: 'sfu_res', rid, ok: false, err: 'SFU tidak tersedia' });
      try {
        const data = await sfu.request(ws, sfuKey(ws, r), m, (c, src, resume) => sfuAllow(c, rData, r, src, resume));
        send(ws, { type: 'sfu_res', rid, ok: true, data });
        if (m.type === 'sfu_prod') { const K = L(rData, r); if (m.src === 'screen') { K.screen = { id: ws.id, n: K.members.get(ws).n }; broadcast(rData, r); } else if (!micAllowed(K, ws)) sfu.setMic(ws, sfuKey(ws, r), true); }
        if (m.type === 'sfu_stop') { const K = L(rData, r); if (K.screen && K.screen.id === ws.id) { K.screen = null; broadcast(rData, r); } }
      } catch (e) { send(ws, { type: 'sfu_res', rid, ok: false, err: e.message }); }
      return;
    }
    if (!ws.kls) return;
    const r = ws.kls.r, K = L(rData, r), me = K.members.get(ws); if (!me) return;
    const a = aktif(r), T = me.role === 'pengajar';
    const target = (id) => [...K.members.keys()].find((c) => c.id === id);
    switch (m.type) {
      case 'kls_hand': me.hand = !!m.up; break;
      case 'kls_floor': { if (!T) return; const c = target(m.id); if (!c) return; const x = K.members.get(c); x.floor = !!m.on; if (x.floor) x.hand = false; applyMics(rData, r); send(c, { type: 'kls_info', r, t: x.floor ? '🎤 Pengajar memberimu giliran bicara — mikrofonmu kini bisa dinyalakan.' : 'Giliran bicaramu selesai.' }); break; }
      case 'kls_muteall': if (!T) return; K.ctl.muteAll = !!m.on; if (!K.ctl.muteAll) for (const x of K.members.values()) x.floor = false; applyMics(rData, r); for (const c of K.members.keys()) if (c !== ws) send(c, { type: 'kls_info', r, t: K.ctl.muteAll ? '🔇 Pengajar membisukan semua peserta. Angkat tangan ✋ untuk minta giliran bicara.' : '🔊 Pengajar membuka mikrofon semua peserta.' }); break;
      case 'kls_lock': if (!T) return; K.ctl.lock = !!m.on; break;
      case 'kls_kick': {
        if (!T) return; const c = target(m.id); if (!c || c === ws) return;
        const x = K.members.get(c); if (x.role === 'pengajar') return;
        if (a) { K.banned = K.banned || new Map(); K.banned.set(a.key + '|' + x.n.toLowerCase(), 1); }
        send(c, { type: 'kls_out', r, why: 'Kamu dikeluarkan dari ruangan oleh pengajar.' });
        leave(c, rData); return;
      }
      case 'kls_chat': {
        if (limited(ws, 6)) return;
        const t = clean(m.t, 300); if (!t) return;
        const msg = { n: me.n, role: me.role, t, at: Date.now() };
        K.chat.push(msg); if (K.chat.length > 200) K.chat.shift();
        for (const c of K.members.keys()) send(c, { type: 'kls_chat', r, m: msg });
        return;
      }
      case 'kls_note': {
        // notulen: di Ruang Rapat semua peserta boleh menulis; di kelas saat sesi hanya pengajar
        if (a && r !== 'rapat' && !T) return send(ws, { type: 'kls_info', r, t: 'Selama sesi kelas, catatan papan hanya ditulis pengajar.' });
        const nk = noteKey(ws, r, a), cur = D.catatan[nk] || { t: {}, v: 0 };
        if (typeof m.v === 'number' && m.v !== cur.v) return send(ws, { type: 'kls_note', r, t: cur.t, v: cur.v, by: cur.by || '', conflict: true });
        const src = m.t && typeof m.t === 'object' ? m.t : {};
        const t = {}; for (const f of NOTE_F) t[f] = cleanLong(src[f], 8000);
        const nt = { t, v: cur.v + 1, by: me.n, at: Date.now() };
        D.catatan[nk] = nt; save();
        for (const c of K.members.keys()) send(c, { type: 'kls_note', r, t: nt.t, v: nt.v, by: nt.by, mine: c === ws });
        return;
      }
      case 'kls_poll': {
        if (a && !T) return;
        const q = clean(m.q, 200), opsi = (Array.isArray(m.opsi) ? m.opsi : []).map((x) => clean(x, 80)).filter(Boolean).slice(0, 6);
        if (!q || opsi.length < 2) return send(ws, { type: 'kls_info', r, t: 'Isi pertanyaan dan minimal 2 pilihan.' });
        K.poll = { id: crypto.randomBytes(4).toString('hex'), q, opsi, open: true, show: false, by: me.n, byId: ws.id, votes: new Map() };
        break;
      }
      case 'kls_vote': { if (!K.poll || !K.poll.open) return; const i = Math.floor(+m.i); if (!(i >= 0 && i < K.poll.opsi.length)) return; K.poll.votes.set(ws.id, i); break; }
      case 'kls_pollctl': {
        if (!K.poll || !(T || (!a && K.poll.byId === ws.id))) return;
        if (m.a === 'tutup') { K.poll.open = false; if (a) { const S = D.sesi[a.key]; if (S) { S.polls = S.polls || []; S.polls.push({ q: K.poll.q, hasil: K.poll.opsi.map((o, i) => [o, [...K.poll.votes.values()].filter((v) => v === i).length]) }); save(); } } } else if (m.a === 'tampil') K.poll.show = !!m.on; else if (m.a === 'hapus') K.poll = null;
        break;
      }
      default: return;
    }
    broadcast(rData, r);
  }
  function onClose(ws) { if (ws.kls) leave(ws, ws.kls.rData); }
  // siapa yang sedang berbicara (dari SFU) → indikator di daftar peserta & avatar
  function speak(key, ids) {
    const i = key.indexOf('|'), room = key.slice(0, i), r = key.slice(i + 1), rData = getRooms().get(room);
    const K = rData && rData.kls && rData.kls[r]; if (!K) return;
    for (const c of K.members.keys()) send(c, { type: 'kls_spk', r, ids });
  }

  // ---------- pergantian sesi (jadwal mulai/berakhir) ----------
  let lastPub = '';
  setInterval(() => {
    const pub = jadwalPub(), s = JSON.stringify(pub);
    const rooms = getRooms();
    for (const rData of rooms.values()) {
      if (!rData.kls) continue;
      for (const r of Object.keys(RUANG)) {
        const K = rData.kls[r]; if (!K) continue;
        const a = aktif(r), key = a ? a.key : null;
        if (K.sesiKey === key) continue;
        // sesi berganti: tutup presensi lama, keluarkan yang tidak berhak
        K.sesiKey = key; K.ctl = { lock: true, muteAll: false }; K.poll = null; K.banned = null;
        for (const [c, m] of [...K.members]) {
          presKeluar(m);
          if (a) { send(c, { type: 'kls_out', r, why: `Sesi terjadwal "${a.j.judul}" dimulai. Masukkan token dari pengajar untuk bergabung.`, need: true }); leave(c, rData); }
          else { m.role = 'bebas'; m.floor = false; m.hand = false; c.kls.role = 'bebas'; send(c, { type: 'kls_info', r, t: 'Sesi terjadwal telah berakhir — ruangan kembali terbuka untuk umum.' }); }
        }
        broadcast(rData, r); applyMics(rData, r);
      }
    }
    if (s !== lastPub) { lastPub = s; for (const rData of rooms.values()) for (const c of rData.members) send(c, { type: 'kls_jadwal', j: pub }); }
  }, 5000).unref();

  // ---------- notulen (HTML siap cetak / simpan PDF) ----------
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtT = (t) => new Date(t).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'short' });
  function notulenHtml(S) {
    const c = D.catatan['sesi:' + S.key], t = noteText(c && c.t);
    const hadir = Object.values(S.peserta).sort((a, b) => (a.peran === b.peran ? a.nama.localeCompare(b.nama, 'id') : a.peran === 'pengajar' ? -1 : 1));
    const sec = NOTE_F.map((f) => `<h2>${NOTE_L[f]}</h2>${t[f] ? '<p>' + esc(t[f]).replace(/\n/g, '<br>') + '</p>' : '<p class="k">—</p>'}`).join('');
    const polls = (S.polls || []).map((p) => `<li><b>${esc(p.q)}</b><br>${p.hasil.map(([o, n]) => `${esc(o)}: ${n} suara`).join(' · ')}</li>`).join('');
    return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Notulen ${esc(S.judul)}</title><style>body{font:15px/1.6 system-ui,Segoe UI,sans-serif;max-width:780px;margin:32px auto;padding:0 20px;color:#111}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 6px;color:#4c1d95;border-bottom:1px solid #ddd;padding-bottom:3px}.m{color:#555;margin:0}.k{color:#999}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}th{background:#f3f0ff}@media print{body{margin:0}}</style></head><body>
<h1>NOTULEN · ${esc(S.judul)}</h1><p class="m">${esc(RUANG[S.ruang])} · Galeri VR Teknik Informatika UIKA Bogor</p><p class="m">${esc(fmtT(S.mulai))} – ${esc(new Date(S.selesai).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', timeStyle: 'short' }))} WIB</p><p class="m">Pengajar / pimpinan: ${esc(S.pengajar || '-')}${c && c.by ? ' · Notulis terakhir: ' + esc(c.by) : ''}</p>
${sec}${polls ? `<h2>Hasil polling</h2><ul>${polls}</ul>` : ''}
<h2>Daftar hadir (${hadir.length} orang)</h2><table><tr><th>No</th><th>Nama</th><th>Peran</th><th>Durasi hadir</th></tr>${hadir.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.nama)}</td><td>${e.peran === 'pengajar' ? 'Pengajar' : 'Peserta'}</td><td>${Math.round(e.durasi / 60000)} menit</td></tr>`).join('')}</table>
</body></html>`;
  }

  // ---------- HTTP admin ----------
  const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Cache-Control': 'no-store' };
  const json = (res, code, o) => { res.writeHead(code, { ...SEC, 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
  const readJson = (req) => new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 32768) req.destroy(); }); req.on('end', () => { try { const o = JSON.parse(b || '{}'); resolve(o && typeof o === 'object' ? o : {}); } catch { resolve({}); } }); });
  const sesiRingkas = () => Object.values(D.sesi).sort((a, b) => b.mulai - a.mulai).slice(0, 300).map((S) => ({ key: S.key, ruang: S.ruang, judul: S.judul, pengajar: S.pengajar, mulai: S.mulai, selesai: S.selesai, n: Object.values(S.peserta).filter((e) => e.peran === 'peserta').length, catatan: !!(D.catatan['sesi:' + S.key] && Object.values(noteText(D.catatan['sesi:' + S.key].t)).some(Boolean)) }));
  async function handle(req, res, p, url) {
    if (!p.startsWith('/api/admin/kelas')) return false;
    if (!pem.authed(req)) return json(res, 401, { ok: false, err: 'Sesi berakhir. Silakan login kembali.' });
    if (req.method === 'POST' && !pem.sameOrigin(req)) return json(res, 403, { ok: false, err: 'Permintaan ditolak.' });
    if (p === '/api/admin/kelas' && req.method === 'GET') {
      const now = Date.now();
      return json(res, 200, { ok: true, ruang: RUANG, cap: CAP, jadwal: D.jadwal.slice().sort((a, b) => a.mulai - b.mulai).map((j) => ({ ...j, aktif: !!occAt(j, now), berikut: nextOcc(j, now) })), sesi: sesiRingkas(), sfu: sfu ? sfu.info() : null });
    }
    if (p === '/api/admin/kelas/presensi.xlsx' && req.method === 'GET') {
      const k = url.searchParams.get('k'), S = D.sesi[k];
      if (!S) return json(res, 404, { ok: false, err: 'Sesi tidak ditemukan.' });
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook(), ws2 = wb.addWorksheet('Presensi');
      const fmt = (t) => t ? new Date(t).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) : '-';
      ws2.addRow([RUANG[S.ruang] + ' · ' + S.judul]); ws2.getRow(1).font = { bold: true, size: 14 };
      ws2.addRow([`Pengajar: ${S.pengajar || '-'}  ·  ${fmt(S.mulai)} – ${fmt(S.selesai)}`]);
      ws2.addRow([]);
      const h = ws2.addRow(['No', 'Nama', 'No. Explorer Card', 'Peran', 'Pertama masuk', 'Terakhir keluar', 'Durasi hadir (menit)', 'Jumlah masuk']);
      h.font = { bold: true, color: { argb: 'FFFFFFFF' } }; h.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C1D95' } }; });
      const list = Object.values(S.peserta).sort((a, b) => (a.peran === b.peran ? a.nama.localeCompare(b.nama, 'id') : a.peran === 'pengajar' ? -1 : 1));
      list.forEach((e, i) => ws2.addRow([i + 1, e.nama, e.no || '-', e.peran === 'pengajar' ? 'Pengajar' : 'Peserta', fmt(e.masuk), e.keluar ? fmt(e.keluar) : '(masih di ruangan)', Math.round(e.durasi / 60000), e.kali]));
      ws2.columns.forEach((c, i) => { c.width = [6, 26, 18, 11, 22, 22, 18, 13][i]; });
      const buf = await wb.xlsx.writeBuffer();
      const name = `presensi-${S.ruang}-${new Date(S.mulai).toISOString().slice(0, 10)}.xlsx`;
      res.writeHead(200, { ...SEC, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}"` });
      return res.end(Buffer.from(buf));
    }
    if (p === '/api/admin/kelas/notulen.html' && req.method === 'GET') {
      const k = url.searchParams.get('k'), S = D.sesi[k];
      if (!S) return json(res, 404, { ok: false, err: 'Sesi tidak ditemukan.' });
      res.writeHead(200, { ...SEC, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", 'Content-Disposition': `attachment; filename="notulen-${S.ruang}-${new Date(S.mulai).toISOString().slice(0, 10)}.html"` });
      return res.end(notulenHtml(S));
    }
    if (req.method !== 'POST') return json(res, 404, { ok: false, err: 'Tidak ditemukan.' });
    const o = await readJson(req);
    if (p === '/api/admin/kelas/simpan') {
      if (!RUANG[o.ruang]) return json(res, 400, { ok: false, err: 'Pilih ruangan.' });
      const judul = clean(o.judul, 100); if (judul.length < 2) return json(res, 400, { ok: false, err: 'Isi judul kegiatan.' });
      const mulai = +o.mulai, selesai = +o.selesai;
      if (!(mulai > 0 && selesai > mulai)) return json(res, 400, { ok: false, err: 'Waktu selesai harus setelah waktu mulai.' });
      if (selesai - mulai > 12 * 3600e3) return json(res, 400, { ok: false, err: 'Durasi maksimal 12 jam.' });
      const ulang = o.ulang === 'mingguan' ? 'mingguan' : 'sekali', sampai = ulang === 'mingguan' ? (+o.sampai || 0) : 0;
      if (ulang === 'mingguan' && sampai && sampai < mulai) return json(res, 400, { ok: false, err: '"Berulang sampai" harus setelah tanggal mulai.' });
      const old = o.id ? D.jadwal.find((j) => j.id === o.id) : null;
      const j = { id: old ? old.id : crypto.randomBytes(6).toString('hex'), ruang: o.ruang, judul, pengajar: clean(o.pengajar, 80), mulai, selesai, ulang, sampai, token: old ? old.token : genTok(6), kode: old ? old.kode : 'P' + genTok(7), t: old ? old.t : Date.now() };
      const bentrok = D.jadwal.find((x) => x.id !== j.id && x.ruang === j.ruang && overlap(x, j));
      if (bentrok) return json(res, 409, { ok: false, err: `Bentrok dengan jadwal "${bentrok.judul}" di ruangan yang sama.` });
      if (old) Object.assign(old, j); else D.jadwal.push(j);
      save(); return json(res, 200, { ok: true, jadwal: j });
    }
    const j = D.jadwal.find((x) => x.id === o.id);
    if (!j) return json(res, 404, { ok: false, err: 'Jadwal tidak ditemukan.' });
    if (p === '/api/admin/kelas/hapus') { D.jadwal.splice(D.jadwal.indexOf(j), 1); save(); return json(res, 200, { ok: true }); }
    if (p === '/api/admin/kelas/token') { if (o.jenis === 'kode') j.kode = 'P' + genTok(7); else j.token = genTok(6); save(); return json(res, 200, { ok: true, jadwal: j }); }
    return json(res, 404, { ok: false, err: 'Tidak ditemukan.' });
  }
  return { onMessage, onClose, handle, boardAllow, jadwalPub, speak, RUANG };
}
module.exports = { createKelas };
