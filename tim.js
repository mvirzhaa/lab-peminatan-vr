// =====================================================================
//  TAHAP 8 · KERJASAMA TIM (server-authoritative)
//  - Hanya pemegang 6 lencana (dasar, umum, iot, jari, coding, islam) yang
//    belum pernah menang boleh membentuk / bergabung ke tim (6 orang).
//  - Kode tim 4 huruf, siap-cek, lalu keenam pemain dipindahkan bersama.
//  - Game 1 Ruang Kendali (info asimetris) · Game 2 Platform Seimbang
//    (papan labirin miring sesuai posisi pemain) · Game 3 Pintu Bertekanan.
//  - Game 4 dirahasiakan: aturan & kode kliennya hanya ada di server
//    (tim/g4client.js, dilayani dengan tiket sekali pakai).
//  - Putus koneksi: Game 1–3 dijeda 90 detik (bila tak kembali tim bubar);
//    Game 4 = tersingkir.
//  - Hanya satu pemenang yang mendapat Lencana Kerjasama Tim; semua yang
//    mencapai Game 4 mendapat skin Tentara Futuristik.
// =====================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SIX = ['dasar', 'umum', 'iot', 'jari', 'coding', 'islam'];
const TEAM_N = +process.env.TIM_N || 6;          // ukuran tim (bisa dikecilkan untuk uji coba)
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PAUSE_S = 90;
const G4_FILE = path.join(__dirname, 'tim', 'g4client.js');

// ---------- tata letak dunia (koordinat galeri) — dikirim ke klien ----------
const LAY = {
  g1: { x0: 156, x1: 188, z0: 120, z1: 152, cx: 172, cz: 136, r: 7.5 },
  g2: { x0: 211, x1: 229, z0: 127, z1: 145, cx: 220, cz: 136, half: 9, cell: 3, n: 6 },
  g3: {
    x0: 156, x1: 236, z0: 170, z1: 190, walls: [176, 200, 222], gap: [178, 182],
    start: { x: 162, z: 180 },
    a: [[170, 174], [170, 186], [181.5, 174], [181.5, 186]],           // pelat pintu A (2 sisi depan, 2 sisi belakang)
    bl: [185, 197, 171, 176.5], br: [185, 197, 183.5, 189],             // timbangan kiri & kanan
    lasers: [205, 211, 217],
    lp: [[[202.6, 173], [208, 187]], [[208, 173], [214, 187]], [[214, 173], [220, 187]]],
    ring: { x: 229.5, z: 180, r: 4.2 }, pr: 0.95, rs: 0.2,
    cstart: { x: 201.8, z: 180 }
  },
  g4: { x0: 260, x1: 330, z0: 110, z1: 180, cx: 295, cz: 145, half: 35 },
  aula: { x0: 262, x1: 280, z0: 196, z1: 212 },
  back: { x: 20.4, z: 24.8 }
};

// ---------- utilitas ----------
const ri = (n, R = Math.random) => Math.floor(R() * n);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, a, b, d = 0) => (typeof v === 'number' && isFinite(v) ? clamp(v, a, b) : d);
const shuffle = (a, R = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rng = (seed) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
const cleanText = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').slice(0, n) : '');

// segmen–titik
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / L, 0, 1);
  const qx = ax + dx * t, qz = az + dz * t;
  return [Math.hypot(px - qx, pz - qz), qx, qz];
}

// ---------- Game 2: labirin acak 6×6 (selalu ada jalan) ----------
function makeMaze(seed) {
  const R = rng(seed), N = 6;
  // dinding: h[r][c] = dinding di bawah sel (r,c) (antara r dan r+1); v[r][c] = dinding di kanan sel (r,c)
  const h = Array.from({ length: N - 1 }, () => Array(N).fill(true));
  const v = Array.from({ length: N }, () => Array(N - 1).fill(true));
  const seen = Array.from({ length: N }, () => Array(N).fill(false));
  const st = [[0, 0]]; seen[0][0] = true;
  while (st.length) {
    const [r, c] = st[st.length - 1];
    const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && !seen[a][b]);
    if (!nb.length) { st.pop(); continue; }
    const [a, b] = nb[Math.floor(R() * nb.length)];
    if (a !== r) h[Math.min(a, r)][c] = false; else v[r][Math.min(b, c)] = false;
    seen[a][b] = true; st.push([a, b]);
  }
  // buka sebagian dinding agar bola tidak terlalu sering terjepit
  for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) if (h[r][c] && R() < 0.28) h[r][c] = false;
  for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) if (v[r][c] && R() < 0.28) v[r][c] = false;
  const start = [0, 0], goal = [N - 1, N - 1];
  // BFS jalur
  const prev = {}, q = [start], key = (r, c) => r + ',' + c; prev[key(...start)] = null;
  while (q.length) {
    const [r, c] = q.shift(); if (r === goal[0] && c === goal[1]) break;
    const nx = [];
    if (r > 0 && !h[r - 1][c]) nx.push([r - 1, c]);
    if (r < N - 1 && !h[r][c]) nx.push([r + 1, c]);
    if (c > 0 && !v[r][c - 1]) nx.push([r, c - 1]);
    if (c < N - 1 && !v[r][c]) nx.push([r, c + 1]);
    for (const n of nx) if (!(key(...n) in prev)) { prev[key(...n)] = [r, c]; q.push(n); }
  }
  const pathC = []; for (let p = goal; p; p = prev[key(...p)]) pathC.unshift(p);
  const onPath = new Set(pathC.map((p) => key(...p)));
  const cell = 3, half = 9, cc = (r, c) => [-half + cell / 2 + c * cell, -half + cell / 2 + r * cell];
  // lubang: di sel buntu & di tepi sel jalur (masih bisa dilewati dengan hati-hati)
  const holes = [];
  const free = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!onPath.has(key(r, c)) && !(r === 0 && c === 0)) free.push([r, c]);
  for (const [r, c] of shuffle(free, R).slice(0, 6)) { const [x, z] = cc(r, c); holes.push([x, z]); }
  const mid = pathC.slice(2, -2);
  for (const [r, c] of shuffle(mid, R).slice(0, 3)) {
    // di sudut sel (jauh dari celah pintu di tengah sisi) — bisa dihindari
    const [x, z] = cc(r, c), k = ri(4, R);
    holes.push([x + (k & 1 ? 0.85 : -0.85), z + (k & 2 ? 0.85 : -0.85)]);
  }
  // segmen dinding (koordinat lokal platform)
  const walls = [];
  for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) if (h[r][c]) { const z = -half + (r + 1) * cell; walls.push([-half + c * cell, z, -half + (c + 1) * cell, z]); }
  for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) if (v[r][c]) { const x = -half + (c + 1) * cell; walls.push([x, -half + r * cell, x, -half + (r + 1) * cell]); }
  walls.push([-half, -half, half, -half], [-half, half, half, half], [-half, -half, -half, half], [half, -half, half, half]);
  const cp = pathC[Math.floor(pathC.length / 2)];
  return { walls, holes, start: cc(...start), goal: cc(...goal), cp: cc(...cp), path: pathC.map((p) => cc(...p)) };
}

// ---------- Game 4: peta arena acak per tim ----------
function makeArena(seed) {
  const R = rng(seed), H = LAY.g4.half - 1;
  const spawns = [], picks = [], cover = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; spawns.push([Math.cos(a) * 28, Math.sin(a) * 28, Math.atan2(Math.cos(a), Math.sin(a))]); }
  const kinds = shuffle(['cepat', 'cepat', 'cepat', 'jauh', 'jauh', 'sebar', 'sebar', 'perisai', 'perisai', 'perisai', 'amunisi', 'amunisi', 'amunisi', 'amunisi'], R);
  for (let i = 0; i < 14; i++) {
    const ring = i < 6 ? 11 : 21, a = (i < 6 ? i / 6 : (i - 6) / 8) * Math.PI * 2 + (i < 6 ? 0 : 0.2);
    picks.push({ x: Math.cos(a) * ring, z: Math.sin(a) * ring, k: kinds[i] });
  }
  const clearOf = (x, z, rad) => spawns.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > rad + 3) && picks.every((p) => Math.hypot(x - p.x, z - p.z) > rad + 1.8) && Math.hypot(x, z) > rad + 3.2;
  const overl = (x, z, w, d) => cover.some((c) => Math.abs(c.x - x) < (c.w + w) / 2 + 1.6 && Math.abs(c.z - z) < (c.d + d) / 2 + 1.6);
  // inti tengah: 4 pilar + menara
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; cover.push({ t: 'c', x: Math.cos(a) * 6, z: Math.sin(a) * 6, w: 2, d: 2, r: 1.0, h: 3.2 }); }
  let tries = 0;
  while (cover.length < 40 && tries++ < 3000) {
    const long = R() < 0.3, w0 = long ? 5 + R() * 4 : 1.4 + R() * 2.4, d0 = long ? 0.8 : 1.4 + R() * 2.4, rot = R() < 0.5;
    const w = rot ? d0 : w0, d = rot ? w0 : d0;
    const x = (R() * 2 - 1) * (H - 3), z = (R() * 2 - 1) * (H - 3);
    const rad = Math.max(w, d) / 2;
    if (!clearOf(x, z, rad) || overl(x, z, w, d)) continue;
    if (R() < 0.22) cover.push({ t: 'c', x, z, w: 1.8, d: 1.8, r: 0.9, h: 2.6 + R() * 1.4 });
    else cover.push({ t: 'b', x, z, w, d, h: long ? 1.5 : 1.4 + R() * 1.6 });
  }
  return { spawns, picks, cover };
}
function hitCover(cover, x, z, pad = 0) {
  for (const c of cover) {
    if (c.t === 'c') { if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true; }
    else if (Math.abs(x - c.x) < c.w / 2 + pad && Math.abs(z - c.z) < c.d / 2 + pad) return true;
  }
  return false;
}
// senjata energi (koordinat lokal arena)
const W = {
  pistol: { cd: 0.42, sp: 26, rg: 30, n: 1, fan: 0, ammo: Infinity, nama: 'Pistol Pulsa' },
  cepat: { cd: 0.13, sp: 32, rg: 26, n: 1, fan: 0.05, ammo: 36, nama: 'Senapan Plasma' },
  jauh: { cd: 1.25, sp: 75, rg: 75, n: 1, fan: 0, ammo: 6, nama: 'Senapan Rel' },
  sebar: { cd: 0.85, sp: 22, rg: 14, n: 5, fan: 0.45, ammo: 9, nama: 'Penyebar Ion' }
};
// badai data: [mulai(dtk), lama menyusut, radius akhir]
const ZONE = [[60, 30, 30], [135, 30, 18], [210, 30, 9], [300, 30, 3]];
const G4_LIMIT = 420;

function createTim({ kartu, sendRaw, allClients, onWinner }) {
  const teams = new Map();      // kode → tim
  const online = new Map();     // no kartu → ws
  const tickets = new Map();    // tiket modul Game 4 → { no, exp, n }
  const send = (ws, o) => { if (ws && ws.readyState === 1) sendRaw(ws, o); };

  const findK = (no) => kartu.list().find((k) => k.no === no);
  function elig(k) {
    if (!k || k.cabut) return { ok: false, why: 'kartu' };
    if (!SIX.every((id) => k.lb && k.lb[id])) return { ok: false, why: 'six' };
    if (k.lb.tim) return { ok: false, why: 'win' };
    return { ok: true };
  }
  const teamOf = (no) => { for (const T of teams.values()) if (T.mem.some((m) => m.no === no && !m.out)) return T; return null; };
  const memOf = (T, no) => T.mem.find((m) => m.no === no && !m.out);
  const act = (T) => T.mem.filter((m) => !m.out);
  function newCode() { for (;;) { let c = ''; for (let i = 0; i < 4; i++) c += LETTERS[crypto.randomInt(LETTERS.length)]; if (!teams.has(c)) return c; } }

  function pub(T) {
    return {
      code: T.code, lead: T.lead, ph: T.ph, g: T.gno || 0, n: TEAM_N,
      pause: T.pause ? { who: T.pause.nama, left: Math.max(0, Math.ceil((T.pause.until - Date.now()) / 1000)) } : null,
      cd: T.cdLeft != null ? Math.ceil(T.cdLeft) : null,
      tr: T.ph === 'tr' ? { next: T.trNext, left: Math.ceil(T.trLeft) } : null,
      mem: T.mem.filter((m) => !m.out).map((m) => ({ s: m.slot, n: m.nama, r: !!m.ready, on: !!m.ws, c: m.c, sk: m.sk, lead: m.no === T.lead }))
    };
  }
  const bc = (T, o, exceptNo) => { for (const m of T.mem) if (!m.out && m.ws && m.no !== exceptNo) send(m.ws, o); };
  const sendSt = (T) => { const s = { type: 'tim_st', team: pub(T) }; bc(T, s); };
  const ev = (T, e) => bc(T, Object.assign({ type: 'tim_ev' }, e));

  function meMsg(ws) {
    const k = findK(ws.timNo), e = elig(k);
    return { type: 'tim_me', ok: true, el: e.ok, why: e.why || '', nama: k ? k.nama : '', win: !!(k && k.lb && k.lb.tim), rw: (k && k.rw) || {}, lay: LAY };
  }

  // ---------------------------------------------------------------
  // lobi
  // ---------------------------------------------------------------
  function leave(T, no, why) {
    const i = T.mem.findIndex((m) => m.no === no);
    if (i < 0) return;
    const m = T.mem[i];
    T.mem.splice(i, 1);
    if (m.ws) send(m.ws, { type: 'tim_st', team: null, why: why || '' });
    if (!T.mem.length) { teams.delete(T.code); return; }
    if (T.lead === no) T.lead = T.mem[0].no;
    T.mem.forEach((mm, k) => { mm.slot = k; });
    if (T.ph === 'cd') { T.ph = 'lobby'; T.cdLeft = null; }
    sendSt(T);
  }
  function startCountdown(T) {
    T.ph = 'cd'; T.cdLeft = 5; sendSt(T);
  }

  // ---------------------------------------------------------------
  // GAME 1 · Ruang Kendali Server
  // ---------------------------------------------------------------
  function expr(n, R) {
    const a = 1 + ri(5, R), opts = [`${n + a} − ${a}`, `${n * 2} ÷ 2`];
    if (n > 1) { const b = 1 + ri(n - 1, R); opts.push(`${b} + ${n - b}`); }
    if (n % 2 === 0) opts.push(`${n / 2} × 2`);
    return opts[ri(opts.length, R)];
  }
  function g1Round(T, r) {
    const G = T.g, n = T.mem.length;
    G.r = r; G.left = r === 3 ? 180 : 150;
    G.v = T.mem.map(() => ({ c: ri(4), n: 1 + ri(4) }));
    G.set = T.mem.map(() => ({ c: -1, n: -1, k: false }));
    G.clue = T.mem.map(() => []);
    G.legend = null; G.key = -1;
    if (r === 1) G.v.forEach((v, j) => G.clue[(j + 1) % n].push({ j, c: v.c, n: v.n }));
    else if (r === 2) G.v.forEach((v, j) => { G.clue[(j + 2) % n].push({ j, c: v.c }); G.clue[(j + 3) % n].push({ j, n: v.n }); });
    else {
      const sym = shuffle([0, 1, 2, 3]); // sym[s] = indeks warna
      G.key = ri(n);
      G.legend = sym;
      G.v.forEach((v, j) => G.clue[(j + 4) % n].push({ j, s: sym.indexOf(v.c), e: expr(v.n) }));
    }
    for (const m of T.mem) g1Send(T, m);
    g1Snap(T);
  }
  function g1Send(T, m) {
    const G = T.g; if (!m.ws) return;
    send(m.ws, { type: 'tim_g', g: 1, r: G.r, clue: G.clue[m.slot], legend: m.slot === G.key ? G.legend : null, key: G.key, set: G.set[m.slot], left: Math.ceil(G.left), lay: LAY });
  }
  function g1Snap(T) { const G = T.g; bc(T, { type: 'tim_s', g: 1, r: G.r, k: G.set.map((s) => s.k), left: Math.ceil(G.left) }); }
  function g1In(T, m, d) {
    const G = T.g, s = G.set[m.slot];
    if (d.a === 'set' && !s.k) { s.c = num(d.c, -1, 3, -1) | 0; s.n = num(d.n, -1, 4, -1) | 0; send(m.ws, { type: 'tim_ev', e: 'g1set', set: s }); }
    else if (d.a === 'lock') {
      if (s.c < 0 || s.n < 1) return send(m.ws, { type: 'tim_ev', e: 'g1kurang' });
      s.k = true; g1Snap(T);
      if (G.set.every((x) => x.k)) {
        const wrong = G.v.filter((v, j) => v.c !== G.set[j].c || v.n !== G.set[j].n).length;
        if (!wrong) {
          ev(T, { e: 'g1ok', r: G.r });
          if (G.r < 3) { G.pending = { r: G.r + 1, t: 3 }; }
          else finishGame(T, 1);
        } else {
          G.left = Math.max(5, G.left - 15);
          G.set.forEach((x) => { x.k = false; });
          ev(T, { e: 'g1salah', w: wrong });
          g1Snap(T);
        }
      }
    } else if (d.a === 'unlock' && s.k) { s.k = false; g1Snap(T); }
  }
  function g1Tick(T, dt) {
    const G = T.g;
    if (G.pending) { G.pending.t -= dt; if (G.pending.t <= 0) { const r = G.pending.r; G.pending = null; g1Round(T, r); } return; }
    G.left -= dt;
    if (G.left <= 0) { ev(T, { e: 'g1waktu' }); g1Round(T, G.r); return; }
    if ((G.snapT = (G.snapT || 0) + dt) > 1) { G.snapT = 0; g1Snap(T); }
  }

  // ---------------------------------------------------------------
  // GAME 2 · Platform Seimbang
  // ---------------------------------------------------------------
  function g2Init(T) {
    const mz = makeMaze(crypto.randomInt(1, 2 ** 31 - 1));
    T.g = { mz, bx: mz.start[0], bz: mz.start[1], vx: 0, vz: 0, sx: 0, sz: 0, cp: false, falls: 0, freeze: 1.5, t: 0, done: false };
    bc(T, { type: 'tim_g', g: 2, mz: { walls: mz.walls, holes: mz.holes, start: mz.start, goal: mz.goal, cp: mz.cp }, lay: LAY });
  }
  function g2Tick(T, dt) {
    const G = T.g, L = LAY.g2, TM = 0.15, BR = 0.42;
    G.t += dt;
    // pusat massa pemain → kemiringan
    let sx = 0, sz = 0, n = 0;
    for (const m of act(T)) if (m.ws && m.x != null) { sx += clamp(m.x - L.cx, -L.half, L.half); sz += clamp(m.z - L.cz, -L.half, L.half); n++; }
    const tx = n ? clamp(sx / n / 6, -1, 1) * TM : 0, tz = n ? clamp(sz / n / 6, -1, 1) * TM : 0;
    G.sx += (tx - G.sx) * Math.min(1, dt * 2.2); G.sz += (tz - G.sz) * Math.min(1, dt * 2.2);
    if (G.freeze > 0) { G.freeze -= dt; G.vx = G.vz = 0; }
    else if (!G.done) {
      const steps = 3, h = dt / steps;
      for (let s = 0; s < steps; s++) {
        G.vx += 9.8 * Math.sin(G.sx) * 0.62 * h; G.vz += 9.8 * Math.sin(G.sz) * 0.62 * h;
        const f = 1 - 0.45 * h; G.vx *= f; G.vz *= f;
        const sp = Math.hypot(G.vx, G.vz); if (sp > 3.4) { G.vx *= 3.4 / sp; G.vz *= 3.4 / sp; }
        G.bx += G.vx * h; G.bz += G.vz * h;
        for (const [ax, az, bx2, bz2] of G.mz.walls) {
          const [d, qx, qz] = segDist(G.bx, G.bz, ax, az, bx2, bz2);
          const rr = BR + 0.12;
          if (d < rr) {
            const nx = (G.bx - qx) / (d || 1), nz = (G.bz - qz) / (d || 1);
            G.bx = qx + nx * rr; G.bz = qz + nz * rr;
            const vn = G.vx * nx + G.vz * nz;
            if (vn < 0) { G.vx -= 1.35 * vn * nx; G.vz -= 1.35 * vn * nz; if (vn < -1.2) G.bump = (G.bump || 0) + 1; }
          }
        }
      }
      if (!G.cp && Math.hypot(G.bx - G.mz.cp[0], G.bz - G.mz.cp[1]) < 1.0) { G.cp = true; ev(T, { e: 'g2cp' }); }
      for (const [hx, hz] of G.mz.holes) if (Math.hypot(G.bx - hx, G.bz - hz) < 0.52) {
        G.falls++; ev(T, { e: 'g2jatuh', n: G.falls, x: hx, z: hz });
        const p = G.cp ? G.mz.cp : G.mz.start; G.bx = p[0]; G.bz = p[1]; G.vx = G.vz = 0; G.freeze = 1.6; break;
      }
      if (Math.hypot(G.bx - G.mz.goal[0], G.bz - G.mz.goal[1]) < 0.95) { G.done = true; ev(T, { e: 'g2ok', falls: G.falls }); setTimeout(() => { if (T.g === G && T.ph === 'g2') finishGame(T, 2); }, 2500); }
    }
    if ((G.snapT = (G.snapT || 0) + dt) >= 1 / 15) { G.snapT = 0; bc(T, { type: 'tim_s', g: 2, b: [+G.bx.toFixed(3), +G.bz.toFixed(3)], v: [+G.vx.toFixed(2), +G.vz.toFixed(2)], t: [+G.sx.toFixed(4), +G.sz.toFixed(4)], f: G.falls, cp: G.cp, fr: G.freeze > 0 ? 1 : 0 }); }
  }

  // ---------------------------------------------------------------
  // GAME 3 · Pintu Bertekanan
  // ---------------------------------------------------------------
  function g3Init(T) {
    const n = act(T).length, l = 1 + ri(n - 1);
    T.g = { dA: false, dB: false, bHold: 0, tgt: [l, n - l], las: [true, true, true], ang: 0, hold: 0, done: false, pres: [] };
    for (const m of act(T)) { m.x = LAY.g3.start.x; m.z = LAY.g3.start.z; }
    bc(T, { type: 'tim_g', g: 3, tgt: T.g.tgt, lay: LAY });
  }
  const onPlate = (T, x, z, r) => act(T).some((m) => m.ws && m.x != null && Math.hypot(m.x - x, m.z - z) < r);
  function g3Tick(T, dt) {
    const G = T.g, L = LAY.g3, PR = L.pr;
    const a = L.a.map(([x, z]) => onPlate(T, x, z, PR));
    G.dA = (a[0] && a[1]) || (a[2] && a[3]);
    const inR = (r) => act(T).filter((m) => m.ws && m.x > r[0] && m.x < r[1] && m.z > r[2] && m.z < r[3]).length;
    const cl = inR(L.bl), cr = inR(L.br);
    if (!G.dB) {
      if (cl === G.tgt[0] && cr === G.tgt[1]) { G.bHold += dt; if (G.bHold >= 2.5) { G.dB = true; ev(T, { e: 'g3b' }); } }
      else G.bHold = 0;
    }
    const lp = L.lp.map((pair) => pair.map(([x, z]) => onPlate(T, x, z, PR)));
    G.las = lp.map((p) => !(p[0] || p[1]));
    G.ang += dt * L.rs;
    const pads = []; for (let i = 0; i < 6; i++) { const an = G.ang + i / 6 * Math.PI * 2; pads.push([L.ring.x + Math.cos(an) * L.ring.r, L.ring.z + Math.sin(an) * L.ring.r]); }
    const need = Math.min(6, act(T).length);
    const pp = pads.map(([x, z]) => onPlate(T, x, z, PR));
    const cnt = pp.filter(Boolean).length;
    if (!G.done) {
      if (cnt >= need) { G.hold += dt; if (G.hold >= 4) { G.done = true; ev(T, { e: 'g3ok' }); setTimeout(() => { if (T.g === G && T.ph === 'g3') finishGame(T, 3); }, 3000); } }
      else G.hold = Math.max(0, G.hold - dt * 2);
    }
    if ((G.snapT = (G.snapT || 0) + dt) >= 0.1) {
      G.snapT = 0;
      bc(T, { type: 'tim_s', g: 3, dA: G.dA, dB: G.dB, bh: +(G.bHold / 2.5).toFixed(2), bc: [cl, cr], tgt: G.tgt, a, lp, las: G.las, ang: +G.ang.toFixed(3), pp, hold: +(G.hold / 4).toFixed(2), need });
    }
  }

  // ---------------------------------------------------------------
  // GAME 4 · (rahasia)
  // ---------------------------------------------------------------
  function g4Prep(T) {
    T.ph = 'g4i'; T.gno = 4; T.g4wait = 30; T.g = null;
    for (const m of act(T)) {
      m.g4 = true; m.g4ok = false;
      const t = crypto.randomBytes(18).toString('base64url');
      tickets.set(t, { no: m.no, exp: Date.now() + 120e3, n: 0 });
      if (m.ws) send(m.ws, { type: 'tim_g4', url: 'api/tim/g4.js?t=' + t });
    }
    // semua yang mencapai babak akhir mendapat skin Tentara Futuristik
    for (const m of act(T)) { const k = findK(m.no); if (k) { k.rw = k.rw || {}; if (!k.rw.trooper) k.rw.trooper = Date.now(); } }
    kartu.save();
    for (const m of act(T)) if (m.ws) send(m.ws, meMsg(m.ws));
    sendSt(T);
  }
  function g4Start(T) {
    const map = makeArena(crypto.randomInt(1, 2 ** 31 - 1));
    T.ph = 'g4';
    const G = T.g = { map, t: 0, cdn: 5, proj: [], pid: 0, pk: map.picks.map((p) => ({ ...p, on: true, re: 0 })), zone: { x: 0, z: 0, r: 52, fx: 0, fz: 0, fr: 52, from: null }, done: false, hits: {} };
    const order = shuffle(act(T));
    order.forEach((m, i) => {
      const s = map.spawns[i % map.spawns.length];
      Object.assign(m, { x: LAY.g4.cx + s[0], z: LAY.g4.cz + s[1], lives: 3, inv: 0, sh: 0, w: 'pistol', ammo: { pistol: Infinity, cepat: 0, jauh: 0, sebar: 0 }, cdT: 0, storm: 0, hitN: 0, alive: true, lastP: Date.now() });
      m.sp = i;
    });
    for (const m of act(T)) if (m.ws) send(m.ws, { type: 'tim_g', g: 4, map, me: m.slot, sp: m.sp, lay: LAY, limit: G4_LIMIT, W: Object.fromEntries(Object.entries(W).map(([k, v]) => [k, { cd: v.cd, sp: v.sp, rg: v.rg, n: v.n, fan: v.fan, ammo: v.ammo === Infinity ? -1 : v.ammo, nama: v.nama }])), zone: ZONE });
    sendSt(T);
  }
  function g4Hit(T, v, a, why) {
    if (!v.alive) return;
    if (why !== 'badai' && v.inv > 0) return;
    if (why !== 'badai' && v.sh > 0) { v.sh--; v.inv = 0.6; ev(T, { e: 'tameng', v: v.slot, a: a ? a.slot : -1, sh: v.sh }); return; }
    v.lives--; v.inv = 2;
    if (a) { a.hitN++; }
    ev(T, { e: 'kena', v: v.slot, a: a ? a.slot : -1, l: v.lives, why: why || '' });
    if (v.lives <= 0) g4Out(T, v, a ? 'kena' : why);
  }
  function g4Out(T, v, why) {
    if (!v.alive) return;
    v.alive = false; v.lives = 0;
    ev(T, { e: 'terputus', v: v.slot, n: v.nama, why: why || '' });
    if (v.ws) send(v.ws, { type: 'tim_end', why: 'gugur' });
    v.out = true; v.gone = v.ws; // dikeluarkan langsung — tanpa menonton
    const k = findK(v.no); if (k) { k.tm = k.tm || {}; k.tm.ikut = (k.tm.ikut || 0) + 1; k.tm.t = Date.now(); kartu.save(); }
    g4Check(T);
  }
  function g4Check(T) {
    const G = T.g; if (!G || G.done) return;
    const alive = T.mem.filter((m) => m.alive && !m.out);
    if (alive.length <= 1 || G.t >= G4_LIMIT) {
      let win = alive[0];
      if (alive.length > 1) win = alive.slice().sort((a, b) => b.lives - a.lives || b.hitN - a.hitN || Math.random() - 0.5)[0];
      g4Win(T, win);
    }
  }
  function g4Win(T, win) {
    const G = T.g; G.done = true;
    const secs = Math.round((Date.now() - T.t0) / 1000);
    if (win) {
      const k = findK(win.no);
      if (k) {
        k.lb = k.lb || {}; k.ch = k.ch || {};
        if (!k.lb.tim) k.lb.tim = Date.now();
        k.ch.tim = { t: Date.now(), best: secs, jalur: 'main', bintang: Math.max(0, Math.min(3, win.lives)) };
        k.tm = k.tm || {}; k.tm.ikut = (k.tm.ikut || 0) + 1; k.tm.t = Date.now();
        kartu.save();
      }
      if (win.ws) send(win.ws, { type: 'tim_win', nama: win.nama, secs, lives: win.lives });
      if (onWinner) onWinner(win.nama);
    }
    // semua anggota (termasuk yang sudah tersingkir & masih online) hanya diberi tahu siapa pemenangnya
    const msg = { type: 'tim_end', why: 'selesai', win: win ? win.nama : '' };
    for (const m of T.mem) { const w = m.ws || m.gone; if (m !== win && w && w.readyState === 1) send(w, msg); }
    setTimeout(() => teams.delete(T.code), 500);
  }
  function g4In(T, m, d) {
    const G = T.g; if (!G || G.done || !m.alive || G.cdn > 0) return;
    if (d.a === 'sw' && typeof d.w === 'string' && W[d.w] && (d.w === 'pistol' || m.ammo[d.w] > 0)) { m.w = d.w; return; }
    if (d.a === 'f') {
      const w = W[m.w]; if (!w) return;
      if (m.cdT > 0) return;
      if (m.w !== 'pistol' && !(m.ammo[m.w] > 0)) { m.w = 'pistol'; return; }
      const ang = num(d.d, -10, 10, 0);
      m.cdT = w.cd * 0.92;
      if (m.w !== 'pistol') { m.ammo[m.w]--; if (m.ammo[m.w] <= 0) { m.ammo[m.w] = 0; } }
      const lx = m.x - LAY.g4.cx, lz = m.z - LAY.g4.cz;
      const shots = [];
      for (let i = 0; i < w.n; i++) {
        const off = w.n > 1 ? (i / (w.n - 1) - 0.5) * w.fan : (Math.random() - 0.5) * w.fan;
        const a = ang + off, dx = Math.sin(a), dz = Math.cos(a);
        const p = { id: ++G.pid, o: m, x: lx + dx * 0.55, z: lz + dz * 0.55, dx, dz, sp: w.sp, left: w.rg, w: m.w };
        G.proj.push(p); shots.push([p.id, +p.x.toFixed(2), +p.z.toFixed(2), +a.toFixed(4)]);
      }
      ev(T, { e: 'tembak', o: m.slot, w: m.w, s: shots, sp: w.sp, rg: w.rg });
      if (m.w !== 'pistol' && m.ammo[m.w] <= 0) { m.w = 'pistol'; }
    }
  }
  function g4Tick(T, dt) {
    const G = T.g; if (!G || G.done) return;
    if (G.cdn > 0) { G.cdn -= dt; if (G.cdn <= 0) ev(T, { e: 'mulai' }); return; }
    G.t += dt;
    const LX = LAY.g4.cx, LZ = LAY.g4.cz, alive = T.mem.filter((m) => m.alive && !m.out);
    // zona badai data
    const Z = G.zone;
    let r = 52;
    for (const [st, dur, to] of ZONE) {
      if (G.t >= st) {
        if (!Z['c' + st]) { Z['c' + st] = 1; Z.from = { x: Z.x, z: Z.z, r: Z.r }; const lim = Math.max(0, Z.r - to) * 0.6, a = Math.random() * 6.28, d = Math.random() * lim; Z.tx = clamp(Z.x + Math.cos(a) * d, -30 + to, 30 - to); Z.tz = clamp(Z.z + Math.sin(a) * d, -30 + to, 30 - to); Z.tr = to; Z.st = st; Z.dur = dur; ev(T, { e: 'zona', to, x: Z.tx, z: Z.tz, dur }); }
      }
    }
    if (Z.from) { const k = clamp((G.t - Z.st) / Z.dur, 0, 1); Z.x = Z.from.x + (Z.tx - Z.from.x) * k; Z.z = Z.from.z + (Z.tz - Z.from.z) * k; Z.r = Z.from.r + (Z.tr - Z.from.r) * k; }
    r = Z.r;
    for (const m of alive) {
      m.inv = Math.max(0, m.inv - dt); m.cdT = Math.max(0, m.cdT - dt);
      const out = Math.hypot(m.x - LX - Z.x, m.z - LZ - Z.z) > r;
      if (out) { m.storm += dt; if (m.storm >= 4) { m.storm = 0.01; g4Hit(T, m, null, 'badai'); } }
      else m.storm = 0;
      // ambil item
      for (let i = 0; i < G.pk.length; i++) {
        const p = G.pk[i]; if (!p.on || !m.alive) continue;
        if (Math.hypot(m.x - LX - p.x, m.z - LZ - p.z) < 1.3) {
          if (p.k === 'perisai') { if (m.sh >= 2) continue; m.sh++; }
          else if (p.k === 'amunisi') { let any = false; for (const k of ['cepat', 'jauh', 'sebar']) if (m.ammo[k] > 0 || m.w === k) { m.ammo[k] += Math.ceil(W[k].ammo * 0.6); any = true; } if (!any) { m.ammo.cepat += 18; } }
          else { m.ammo[p.k] += W[p.k].ammo; m.w = p.k; }
          p.on = false; p.re = 22;
          ev(T, { e: 'ambil', i, v: m.slot, k: p.k });
        }
      }
    }
    for (let i = 0; i < G.pk.length; i++) { const p = G.pk[i]; if (!p.on) { p.re -= dt; if (p.re <= 0) { p.on = true; ev(T, { e: 'muncul', i }); } } }
    // proyektil
    for (let i = G.proj.length - 1; i >= 0; i--) {
      const p = G.proj[i]; let dead = false;
      let dist = p.sp * dt;
      while (dist > 0 && !dead) {
        const st = Math.min(0.4, dist); dist -= st; p.left -= st;
        p.x += p.dx * st; p.z += p.dz * st;
        if (p.left <= 0 || Math.abs(p.x) > LAY.g4.half || Math.abs(p.z) > LAY.g4.half) { dead = true; break; }
        if (hitCover(G.map.cover, p.x, p.z, 0.05)) { dead = true; ev(T, { e: 'pecah', id: p.id, x: +p.x.toFixed(2), z: +p.z.toFixed(2) }); break; }
        for (const m of alive) {
          if (m === p.o || !m.alive) continue;
          if (Math.hypot(m.x - LX - p.x, m.z - LZ - p.z) < 0.55) { dead = true; ev(T, { e: 'pecah', id: p.id, x: +p.x.toFixed(2), z: +p.z.toFixed(2), v: m.slot }); g4Hit(T, m, p.o.alive ? p.o : p.o, 'kena'); break; }
        }
      }
      if (dead) G.proj.splice(i, 1);
      if (G.done) return;
    }
    if (G.t >= G4_LIMIT) { g4Check(T); return; }
    if ((G.snapT = (G.snapT || 0) + dt) >= 1 / 15) {
      G.snapT = 0;
      const p = T.mem.filter((m) => m.alive && !m.out).map((m) => [m.slot, +(m.x - LX).toFixed(2), +(m.z - LZ).toFixed(2), +(m.r || 0).toFixed(2), m.lives, m.inv > 0 ? 1 : 0, m.sh, m.w, m.mv ? 1 : 0]);
      for (const m of T.mem) if (m.alive && !m.out && m.ws) send(m.ws, { type: 'tim_s', g: 4, t: +G.t.toFixed(1), z: [+Z.x.toFixed(2), +Z.z.toFixed(2), +Z.r.toFixed(2)], p, al: p.length, me: { a: Object.fromEntries(Object.entries(m.ammo).map(([k, v]) => [k, v === Infinity ? -1 : v])), w: m.w, st: m.storm > 0 ? +m.storm.toFixed(1) : 0, h: m.hitN } });
    }
  }

  // ---------------------------------------------------------------
  // alur game
  // ---------------------------------------------------------------
  function startGame(T, g) {
    T.gno = g; T.ph = 'g' + g;
    if (g === 1) { T.t0 = Date.now(); T.g = {}; for (const m of act(T)) { const k = findK(m.no); if (k) { k.tm = k.tm || {}; k.tm.mulai = (k.tm.mulai || 0) + 1; } } kartu.save(); g1Round(T, 1); }
    else if (g === 2) g2Init(T);
    else if (g === 3) g3Init(T);
    sendSt(T);
  }
  function finishGame(T, g) {
    if (T.ph !== 'g' + g) return;
    T.ph = 'tr'; T.trNext = g + 1; T.trLeft = g === 3 ? 8 : 7;
    ev(T, { e: 'gameok', g });
    sendSt(T);
  }
  function disband(T, why) {
    for (const m of T.mem) if (m.ws && !m.out) send(m.ws, { type: 'tim_end', why });
    teams.delete(T.code);
  }

  // ---------------------------------------------------------------
  // detak server (30 Hz)
  // ---------------------------------------------------------------
  let lastT = Date.now();
  setInterval(() => {
    const now = Date.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    for (const T of [...teams.values()]) {
      try {
        if (T.pause) {
          if (now > T.pause.until) { disband(T, 'bubar'); continue; }
          if ((T.pauseSnap = (T.pauseSnap || 0) + dt) > 1) { T.pauseSnap = 0; sendSt(T); }
          continue;
        }
        if (T.ph === 'cd') { T.cdLeft -= dt; if (Math.ceil(T.cdLeft) !== T.cdShown) { T.cdShown = Math.ceil(T.cdLeft); sendSt(T); } if (T.cdLeft <= 0) { T.cdLeft = null; startGame(T, 1); } }
        else if (T.ph === 'tr') { T.trLeft -= dt; if (Math.ceil(T.trLeft) !== T.trShown) { T.trShown = Math.ceil(T.trLeft); sendSt(T); } if (T.trLeft <= 0) { if (T.trNext === 4) g4Prep(T); else startGame(T, T.trNext); } }
        else if (T.ph === 'g1') g1Tick(T, dt);
        else if (T.ph === 'g2') g2Tick(T, dt);
        else if (T.ph === 'g3') g3Tick(T, dt);
        else if (T.ph === 'g4i') {
          T.g4wait -= dt;
          const live = act(T);
          if (live.every((m) => m.g4ok || !m.ws) || T.g4wait <= 0) {
            // yang belum siap / terputus dianggap tersingkir
            for (const m of live) if (!m.g4ok || !m.ws) { m.alive = false; m.out = true; m.gone = m.ws; if (m.ws) send(m.ws, { type: 'tim_end', why: 'gugur' }); }
            if (act(T).length === 0) { teams.delete(T.code); continue; }
            g4Start(T);
            if (act(T).length === 1) { T.g.cdn = 0; g4Win(T, act(T)[0]); }
          }
        } else if (T.ph === 'g4') g4Tick(T, dt);
        // posisi rekan (Game 1–3) 10 Hz
        if (/^g[123]$/.test(T.ph) && (T.psT = (T.psT || 0) + dt) >= 0.1) {
          T.psT = 0;
          const p = act(T).filter((m) => m.ws && m.x != null).map((m) => [m.slot, +m.x.toFixed(2), +m.z.toFixed(2), +(m.r || 0).toFixed(2), m.mv ? 1 : 0, +(m.y || 0).toFixed(2)]);
          bc(T, { type: 'tim_ps', p });
        }
      } catch (e) { console.error('[tim]', e); }
    }
    for (const [t, v] of tickets) if (now > v.exp) tickets.delete(t);
  }, 33).unref();

  // ---------------------------------------------------------------
  // pesan WebSocket
  // ---------------------------------------------------------------
  function onMessage(ws, m) {
    const ty = m.type;
    if (ty === 'tim_hi') {
      const no = String(m.no || '').toUpperCase(), tok = typeof m.tok === 'string' ? m.tok.slice(0, 64) : '';
      const k = kartu.auth(no, tok);
      if (!k) return send(ws, { type: 'tim_me', ok: false });
      if (ws.timNo && ws.timNo !== no && online.get(ws.timNo) === ws) online.delete(ws.timNo);
      const old = online.get(no);
      if (old && old !== ws) { old.timNo = null; send(old, { type: 'tim_end', why: 'dobel' }); }
      ws.timNo = no; online.set(no, ws);
      ws.timSid = ws.timSid || crypto.randomBytes(6).toString('hex');
      ws.timC = /^#[0-9a-f]{6}$/i.test(m.c) ? m.c : '#38bdf8'; ws.timSk = typeof m.sk === 'string' ? m.sk.slice(0, 12) : 'default';
      send(ws, meMsg(ws));
      const T = teamOf(no);
      if (!T) send(ws, { type: 'tim_st', team: null });   // mis. server dimulai ulang saat bermain → klien keluar dari arena
      if (T) {
        const me = memOf(T, no); me.ws = ws; me.c = ws.timC; me.sk = ws.timSk; me.off = 0;
        if (T.pause && T.pause.no === no) {
          T.pause = null;
          const still = act(T).find((x) => !x.ws);
          if (still) T.pause = { no: still.no, nama: still.nama, until: still.offUntil };
          ev(T, { e: 'kembali', n: me.nama });
        }
        sendSt(T);
        if (T.ph === 'g1' && T.g && T.g.r) g1Send(T, me);
        if (T.ph === 'g2' && T.g) send(ws, { type: 'tim_g', g: 2, mz: { walls: T.g.mz.walls, holes: T.g.mz.holes, start: T.g.mz.start, goal: T.g.mz.goal, cp: T.g.mz.cp }, lay: LAY, re: true });
        if (T.ph === 'g3' && T.g) send(ws, { type: 'tim_g', g: 3, tgt: T.g.tgt, lay: LAY, re: true });
      }
      return;
    }
    const no = ws.timNo; if (!no || online.get(no) !== ws) return send(ws, { type: 'tim_err', t: 'Explorer Card belum terverifikasi.' });
    const k = findK(no);
    let T = teamOf(no);
    const me = T ? memOf(T, no) : null;
    switch (ty) {
      case 'tim_new': {
        const e = elig(k); if (!e.ok) return send(ws, { type: 'tim_err', t: e.why === 'win' ? 'Kamu sudah memenangkan Kerjasama Tim — belum bisa membentuk tim baru.' : 'Hanya pemegang 6 lencana yang bisa membentuk tim.' });
        if (T) return send(ws, { type: 'tim_err', t: 'Kamu sudah berada di tim ' + T.code + '.' });
        T = { code: newCode(), lead: no, ph: 'lobby', mem: [], t: Date.now() };
        T.mem.push({ no, nama: k.nama, ws, slot: 0, ready: false, c: ws.timC, sk: ws.timSk });
        teams.set(T.code, T); sendSt(T); return;
      }
      case 'tim_join': {
        const e = elig(k); if (!e.ok) return send(ws, { type: 'tim_err', t: e.why === 'win' ? 'Pemenang Kerjasama Tim belum bisa bergabung ke tim baru.' : 'Hanya pemegang 6 lencana yang bisa bergabung.' });
        const code = String(m.code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
        const J = teams.get(code);
        if (!J) return send(ws, { type: 'tim_err', t: 'Kode tim tidak ditemukan.' });
        if (T && T !== J) return send(ws, { type: 'tim_err', t: 'Keluar dulu dari tim ' + T.code + '.' });
        if (T === J) return sendSt(J);
        if (J.ph !== 'lobby') return send(ws, { type: 'tim_err', t: 'Tim itu sudah mulai bermain.' });
        if (J.mem.length >= TEAM_N) return send(ws, { type: 'tim_err', t: 'Tim itu sudah penuh (' + TEAM_N + ' orang).' });
        J.mem.push({ no, nama: k.nama, ws, slot: J.mem.length, ready: false, c: ws.timC, sk: ws.timSk });
        ev(J, { e: 'gabung', n: k.nama }); sendSt(J); return;
      }
      case 'tim_out': if (T && (T.ph === 'lobby' || T.ph === 'cd')) leave(T, no, 'keluar'); else if (T && /^g[123]$|^tr$/.test(T.ph)) { ev(T, { e: 'mundur', n: me.nama }); disband(T, 'mundur'); } return;
      case 'tim_kick': { if (!T || T.lead !== no || T.ph !== 'lobby') return; const v = T.mem.find((x) => x.slot === (m.s | 0)); if (v && v.no !== no) leave(T, v.no, 'dikeluarkan'); return; }
      case 'tim_rdy': if (T && (T.ph === 'lobby' || T.ph === 'cd')) { me.ready = !!m.v; if (!me.ready && T.ph === 'cd') { T.ph = 'lobby'; T.cdLeft = null; } sendSt(T); } return;
      case 'tim_go': {
        if (!T || T.lead !== no || T.ph !== 'lobby') return;
        if (T.mem.length < TEAM_N) return send(ws, { type: 'tim_err', t: `Tim harus ${TEAM_N} orang (sekarang ${T.mem.length}).` });
        if (!T.mem.every((x) => x.ready && x.ws)) return send(ws, { type: 'tim_err', t: 'Semua anggota harus online dan menekan SIAP.' });
        for (const x of T.mem) { const kk = findK(x.no); if (!elig(kk).ok) return send(ws, { type: 'tim_err', t: x.nama + ' tidak memenuhi syarat.' }); }
        startCountdown(T); return;
      }
      case 'tim_find': {
        const list = [];
        for (const [n2, w2] of online) {
          if (n2 === no) continue; const k2 = findK(n2); if (!elig(k2).ok) continue;
          const T2 = teamOf(n2);
          list.push({ id: w2.timSid, n: k2.nama, tim: T2 ? (T2.ph === 'lobby' ? 'lobi' : 'main') : '' });
          if (list.length >= 40) break;
        }
        return send(ws, { type: 'tim_list', list });
      }
      case 'tim_ajak': {
        if (!T || T.ph !== 'lobby') return send(ws, { type: 'tim_err', t: 'Buat tim dulu sebelum mengajak teman.' });
        const nowA = Date.now(); ws.timInv = (ws.timInv || []).filter((x) => nowA - x < 60e3); if (ws.timInv.length >= 10) return send(ws, { type: 'tim_err', t: 'Terlalu banyak ajakan. Tunggu sebentar.' }); ws.timInv.push(nowA);
        for (const w2 of online.values()) if (w2.timSid === m.to) { send(w2, { type: 'tim_inv', from: k.nama, code: T.code }); send(ws, { type: 'tim_ev', e: 'ajakTerkirim', n: findK(w2.timNo)?.nama || '' }); break; }
        return;
      }
      case 'tim_chat': {
        if (!T || T.ph === 'g4' || T.ph === 'g4i') return;
        const t = cleanText(m.t, 200).trim(); if (!t) return;
        const nowC = Date.now(); ws.timCh = (ws.timCh || []).filter((x) => nowC - x < 10e3); if (ws.timCh.length >= 8) return; ws.timCh.push(nowC);
        bc(T, { type: 'tim_chat', s: me.slot, n: me.nama, t }); return;
      }
      case 'tim_p': {
        if (!T || !me) return;
        const x = num(m.x, -400, 400, me.x || 0), z = num(m.z, -400, 400, me.z || 0);
        if (T.ph === 'g4' && T.g) {
          if (!me.alive) return;
          const nowP = Date.now(), dtp = Math.max(0.03, (nowP - (me.lastP || nowP)) / 1000); me.lastP = nowP;
          const L4 = LAY.g4, maxD = 9.5 * dtp + 0.6;
          let nx = clamp(x, L4.x0 + 0.5, L4.x1 - 0.5), nz = clamp(z, L4.z0 + 0.5, L4.z1 - 0.5);
          const d = Math.hypot(nx - me.x, nz - me.z);
          if (d > maxD) { nx = me.x + (nx - me.x) / d * maxD; nz = me.z + (nz - me.z) / d * maxD; }
          if (T.g.cdn > 0) return;
          me.x = nx; me.z = nz;
        } else { me.x = x; me.z = z; }
        me.r = num(m.r, -50, 50, 0); me.mv = !!m.mv; me.y = num(m.y, -2, 6, 0);
        return;
      }
      case 'tim_in': {
        if (!T || !me || T.pause) return;
        if (T.ph === 'g1' && m.g === 1) g1In(T, me, m);
        else if (T.ph === 'g4' && m.g === 4) g4In(T, me, m);
        return;
      }
      case 'tim_g4ok': if (T && T.ph === 'g4i' && me) { me.g4ok = true; } return;
      case 'tim_me': return send(ws, meMsg(ws));
      case 'tim_st': return send(ws, { type: 'tim_st', team: T ? pub(T) : null });
    }
  }
  function onClose(ws) {
    const no = ws.timNo; if (!no || online.get(no) !== ws) return;
    online.delete(no);
    const T = teamOf(no); if (!T) return;
    const me = memOf(T, no);
    if (T.ph === 'lobby' || T.ph === 'cd') { leave(T, no, ''); return; }
    if (T.ph === 'g4' || T.ph === 'g4i') {
      me.ws = null;
      if (T.ph === 'g4') g4Out(T, me, 'putus');
      return;
    }
    // Game 1–3 & jeda antar-game: tunggu 90 detik
    me.ws = null; me.off = Date.now(); me.offUntil = Date.now() + PAUSE_S * 1000;
    if (!T.pause) T.pause = { no, nama: me.nama, until: me.offUntil };
    ev(T, { e: 'putus', n: me.nama, s: PAUSE_S });
    sendSt(T);
  }

  // ---------------------------------------------------------------
  // HTTP: papan Penjelajah 6 Lencana & modul Game 4
  // ---------------------------------------------------------------
  const SEC = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
  let papanC = { t: 0, body: '' };
  function handle(req, res, p, u) {
    if (p === '/api/tim/papan' && req.method === 'GET') {
      if (Date.now() - papanC.t > 3000) {
        const list = kartu.list().filter((k) => !k.cabut && SIX.every((id) => k.lb && k.lb[id])).map((k) => ({ n: k.nama, on: online.has(k.no), w: k.lb.tim || 0, t: Math.max(...SIX.map((id) => k.lb[id] || 0)), ikut: (k.tm && k.tm.ikut) || 0 }))
          .sort((a, b) => (b.w ? 1 : 0) - (a.w ? 1 : 0) || (b.on ? 1 : 0) - (a.on ? 1 : 0) || a.t - b.t).slice(0, 300);
        papanC = { t: Date.now(), body: JSON.stringify({ ok: true, list, tim: [...teams.values()].filter((T) => T.ph !== 'lobby').length }) };
      }
      res.writeHead(200, { ...SEC, 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(papanC.body), true;
    }
    if (p === '/api/tim/g4.js' && req.method === 'GET') {
      const t = String(u.searchParams.get('t') || ''), v = tickets.get(t);
      if (!v || Date.now() > v.exp || v.n >= 2) { res.writeHead(404, SEC); res.end(); return true; }
      v.n++;
      fs.readFile(G4_FILE, (err, buf) => {
        if (err) { res.writeHead(500, SEC); return res.end(); }
        res.writeHead(200, { ...SEC, 'Content-Type': 'text/javascript; charset=utf-8' });
        res.end(buf);
      });
      return true;
    }
    return false;
  }
  return { onMessage, onClose, handle, LAY, _teams: teams };
}
module.exports = { createTim, makeMaze, makeArena, LAY };
