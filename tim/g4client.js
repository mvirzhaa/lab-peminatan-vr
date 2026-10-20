// =====================================================================
//  GAME 4 · SINYAL TERAKHIR — kode klien RAHASIA Tantangan Kerjasama Tim.
//  Berkas ini TIDAK ada di public/ dan tidak dirujuk index.html: server
//  (tim.js) hanya melayaninya lewat tiket sekali pakai saat sebuah tim
//  menuntaskan Game 3. Semua hitungan (tembakan, kena, nyawa, amunisi,
//  item, zona) dilakukan server; berkas ini hanya menampilkan & mengirim
//  input (posisi, arah tembak, ganti senjata).
// =====================================================================
export default function (A) {
  const T3 = A.THREE, TIM = A.TIM, P = A.P, S = A.S;
  const st = {
    L: null, map: null, W: null, me: -1, root: null, opp: new Map(), bolts: new Map(), picks: [], cols: [], circles: [], hidden: [],
    started: false, ended: false, lives: 6, sh: 0, inv: false, w: "pistol", ammo: { pistol: -1, cepat: 0, jauh: 0, sebar: 0 }, al: 6, t: 0, limit: 420,
    zone: { x: 0, z: 0, r: 52 }, next: null, stormSt: 0, hits: 0, pT: 0, fireHeld: false, lastFire: 0, phase: 0, speed0: S.speed, cam0: null, dom: {}, fx: [], anims: [], snapT: 0
  };
  const WCOL = { pistol: 0x22d3ee, cepat: 0xa3e635, jauh: 0xe879f9, sebar: 0xfb923c };
  const WNAME = { pistol: "Pistol Pulsa", cepat: "Senapan Plasma", jauh: "Senapan Rel", sebar: "Penyebar Ion" };
  const WICON = { pistol: "🔫", cepat: "⚡", jauh: "🎯", sebar: "💥" };
  const PICKN = { cepat: "Senapan Plasma", jauh: "Senapan Rel", sebar: "Penyebar Ion", perisai: "Perisai Energi", amunisi: "Sel Amunisi" };
  const toW = (lx, lz) => [st.L.cx + lx, st.L.cz + lz];
  const nameOf = (s) => { const m = TIM.team && TIM.team.mem.find((x) => x.s === s); return m ? m.n : "Pemain " + (s + 1); };
  const colOf = (s) => { const m = TIM.team && TIM.team.mem.find((x) => x.s === s); return m && /^#[0-9a-f]{6}$/i.test(m.c) ? m.c : "#38bdf8"; };
  const touch = document.body.classList.contains("touch");

  // ------------------------------------------------------------------
  // SUARA: musik elektronik menegangkan + efek (Web Audio, tanpa berkas)
  // ------------------------------------------------------------------
  const AU = (() => {
    let ac = null, out = null, mus = null, sfx = null, nb = null, timer = null, next = 0, step = 0, bpm = 124, inten = 0, on = false;
    const ctx = () => {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
        ac = new AC(); out = ac.createDynamicsCompressor(); out.threshold.value = -14; out.ratio.value = 3; out.connect(ac.destination);
        mus = ac.createGain(); mus.gain.value = (S.music ? 0.55 : 0.0) * (S.vol ?? 0.85); mus.connect(out);
        sfx = ac.createGain(); sfx.gain.value = 0.8 * (S.vol ?? 0.85); sfx.connect(out);
      }
      if (ac.state === "suspended") ac.resume().catch(() => {});
      return ac;
    };
    const noise = () => { if (nb) return nb; nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return nb; };
    const env = (g, t0, a, peak, dec) => { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec); };
    const osc = (type, f, t0, dur, vol, dest, f2, filt) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      env(g, t0, 0.004, vol, dur); if (filt) { const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(filt, t0); lp.Q.value = 6; o.connect(lp); lp.connect(g); } else o.connect(g);
      g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
    };
    const nz = (t0, dur, vol, dest, type, f) => { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise(); fl.type = type; fl.frequency.value = f; env(g, t0, 0.002, vol, dur); s.connect(fl); fl.connect(g); g.connect(dest); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05); };
    // progresi: Am – F – C – G (akar oktaf rendah)
    const ROOT = [55, 43.65, 65.41, 49], CH = [[0, 3, 7, 12], [0, 4, 7, 12], [0, 4, 7, 12], [0, 4, 7, 10]];
    const tick = () => {
      if (!on || !ac) return;
      const spb = 60 / bpm / 4;
      while (next < ac.currentTime + 0.14) {
        const s = step % 16, bar = Math.floor(step / 16) % 4, r = ROOT[bar];
        if (s % 4 === 0) osc("sine", 140, next, 0.28, 0.9, mus, 42);
        if (inten >= 1 && (s === 4 || s === 12)) nz(next, 0.14, 0.38, mus, "bandpass", 1900);
        if (s % 2 === 1 || (inten >= 3 && Math.random() < 0.5)) nz(next, 0.035, inten >= 2 ? 0.16 : 0.1, mus, "highpass", 7500);
        if (s % 2 === 0) osc("sawtooth", r * (s % 8 === 6 ? 2 : 1), next, spb * 1.7, 0.22, mus, null, 300 + inten * 260 + (s % 4 === 2 ? 500 : 0));
        if (inten >= 1) { const iv = CH[bar][(s + Math.floor(step / 64)) % 4]; osc("square", r * 4 * Math.pow(2, iv / 12), next, spb * 0.8, 0.045 + inten * 0.012, mus, null, 1800 + inten * 700); }
        if (inten >= 2 && s === 0) osc("sawtooth", r * 2, next, spb * 15, 0.06, mus, r * 2.02, 900);
        if (inten >= 4 && s % 4 === 2) osc("square", 880 * (1 + (step % 3) * 0.25), next, 0.05, 0.05, mus);
        next += spb; step++;
      }
    };
    return {
      start() { if (!ctx()) return; on = true; next = ac.currentTime + 0.05; step = 0; clearInterval(timer); timer = setInterval(tick, 30); },
      stop() { on = false; clearInterval(timer); timer = null; if (mus) mus.gain.setTargetAtTime(0, ac.currentTime, 0.4); },
      inten(i) { inten = i; bpm = 124 + i * 9; },
      fire(w, near) { if (!ctx()) return; const t0 = ac.currentTime, v = near ? 0.5 : 0.18; if (w === "jauh") { osc("sawtooth", 2400, t0, 0.35, v, sfx, 120); nz(t0, 0.25, v * 0.6, sfx, "lowpass", 2400); } else if (w === "sebar") { nz(t0, 0.22, v, sfx, "bandpass", 900); osc("square", 520, t0, 0.18, v * 0.6, sfx, 90); } else if (w === "cepat") osc("square", 1500, t0, 0.07, v * 0.6, sfx, 600); else osc("sawtooth", 1200, t0, 0.14, v * 0.8, sfx, 260); },
      hit() { if (!ctx()) return; const t0 = ac.currentTime; nz(t0, 0.35, 0.9, sfx, "lowpass", 1400); osc("sine", 160, t0, 0.4, 0.8, sfx, 40); },
      ding() { if (!ctx()) return; const t0 = ac.currentTime; osc("triangle", 1760, t0, 0.12, 0.35, sfx); osc("triangle", 2637, t0 + 0.06, 0.12, 0.25, sfx); },
      shield() { if (!ctx()) return; const t0 = ac.currentTime; osc("sine", 900, t0, 0.3, 0.5, sfx, 1800); },
      pick() { if (!ctx()) return; const t0 = ac.currentTime; [660, 880, 1320].forEach((f, i) => osc("triangle", f, t0 + i * 0.06, 0.12, 0.3, sfx)); },
      out() { if (!ctx()) return; const t0 = ac.currentTime; osc("sawtooth", 600, t0, 0.9, 0.4, sfx, 60); nz(t0, 0.8, 0.4, sfx, "lowpass", 900); },
      alarm() { if (!ctx()) return; const t0 = ac.currentTime; for (let i = 0; i < 3; i++) osc("sawtooth", 880, t0 + i * 0.28, 0.2, 0.25, sfx, 440); },
      beep(hi) { if (!ctx()) return; osc("square", hi ? 1320 : 660, ac.currentTime, 0.12, 0.3, sfx); },
      spark() { if (!ctx()) return; nz(ac.currentTime, 0.06, 0.15, sfx, "highpass", 3000); },
      storm(k) { if (!ctx() || !on) return; if (Math.random() < k * 0.05) nz(ac.currentTime, 0.12, 0.25 * k, sfx, "bandpass", 300 + Math.random() * 3000); }
    };
  })();

  // ------------------------------------------------------------------
  // CSS & HUD (dibuat modul — tidak ada di index.html)
  // ------------------------------------------------------------------
  const css = document.createElement("style");
  css.textContent = `
#g4Hud{position:fixed;inset:0;z-index:31;pointer-events:none;font-family:system-ui,sans-serif;color:#fff}
#g4Top{position:absolute;top:calc(64px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;background:rgba(6,4,18,.82);border:1px solid #a21caf;border-radius:14px;padding:7px 14px;box-shadow:0 0 24px rgba(217,70,239,.35)}
#g4Lives{font-size:24px;letter-spacing:3px;filter:drop-shadow(0 0 6px #22d3ee)}
#g4Lives .x{opacity:.22;filter:grayscale(1)}
#g4Sh{font-size:16px;color:#7dd3fc}
#g4Info{font:800 15px ui-monospace,monospace;color:#f0abfc;letter-spacing:.05em}
#g4Zone{font:700 12px system-ui;color:#fda4af}
#g4Cross{position:absolute;left:50%;top:50%;width:34px;height:34px;transform:translate(-50%,-50%);border-radius:50%;border:2px solid rgba(255,255,255,.75);box-shadow:0 0 8px #22d3ee}
#g4Cross::before,#g4Cross::after{content:"";position:absolute;background:#fff;left:50%;top:50%;transform:translate(-50%,-50%)}
#g4Cross::before{width:2px;height:10px}#g4Cross::after{width:10px;height:2px}
#g4Cross.lock{border-color:#f43f5e;box-shadow:0 0 12px #f43f5e}
#g4HitM{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:900 46px system-ui;color:#f43f5e;opacity:0;text-shadow:0 0 12px #f43f5e;transition:opacity .25s}
#g4W{position:absolute;right:max(12px,env(safe-area-inset-right,0px));bottom:calc(84px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:5px;pointer-events:auto}
#g4W button{display:flex;align-items:center;gap:6px;min-width:160px;height:38px;border-radius:10px;border:1px solid #4c1d95;background:rgba(10,6,28,.85);color:#e9d5ff;font:700 13px system-ui;padding:0 10px;text-align:left}
#g4W button b{flex:1}#g4W button small{font:800 12px ui-monospace,monospace;color:#a5f3fc}
#g4W button.on{border-color:#22d3ee;box-shadow:0 0 12px rgba(34,211,238,.6);color:#fff}
#g4W button:disabled{opacity:.35}
#g4Fire{position:absolute;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(250px + env(safe-area-inset-bottom,0px));width:92px;height:92px;border-radius:50%;border:3px solid #f0abfc;background:radial-gradient(circle,#c026d3,#4a044e);color:#fff;font:900 15px system-ui;pointer-events:auto;box-shadow:0 0 22px #d946ef;display:${touch ? "block" : "none"};touch-action:none}
#g4Fire:active{transform:scale(.94)}
#g4Feed{position:absolute;left:max(12px,env(safe-area-inset-left,0px));top:calc(130px + env(safe-area-inset-top,0px));display:flex;flex-direction:column;gap:4px;font:700 13px system-ui}
#g4Feed div{background:rgba(6,4,18,.8);border-left:3px solid #d946ef;padding:4px 9px;border-radius:6px;animation:g4in .3s ease-out}
@keyframes g4in{0%{transform:translateX(-30px);opacity:0}100%{transform:none;opacity:1}}
#g4Vig{position:absolute;inset:0;background:radial-gradient(circle,transparent 45%,rgba(217,70,239,.65));opacity:0;transition:opacity .3s}
#g4Dmg{position:absolute;inset:0;background:radial-gradient(circle,transparent 30%,rgba(239,68,68,.75));opacity:0;transition:opacity .5s}
#g4Warn{position:absolute;left:50%;top:32%;transform:translateX(-50%);font:900 clamp(18px,4vw,30px) system-ui;color:#f0abfc;text-shadow:0 0 14px #d946ef,2px 0 #22d3ee,-2px 0 #f43f5e;display:none;text-align:center}
#g4Radar{position:absolute;right:max(12px,env(safe-area-inset-right,0px));top:calc(64px + env(safe-area-inset-top,0px));width:${touch ? 110 : 150}px;height:${touch ? 110 : 150}px;border-radius:50%;background:rgba(6,4,18,.75);border:1px solid #a21caf}
#g4Help{position:absolute;left:max(12px,env(safe-area-inset-left,0px));bottom:calc(84px + env(safe-area-inset-bottom,0px));font:600 12px system-ui;color:#c4b5fd;background:rgba(6,4,18,.7);border-radius:8px;padding:5px 9px;display:${touch ? "none" : "block"}}
body.g4 #chatDr,body.g4 #btnChat,body.g4 #questHud,body.g4 #mini{display:none!important}`;
  document.head.appendChild(css);
  document.body.classList.add("g4");
  const hud = document.createElement("div"); hud.id = "g4Hud";
  hud.innerHTML = `<div id="g4Vig"></div><div id="g4Dmg"></div><div id="g4Top"><span id="g4Lives"></span><span id="g4Sh"></span><span id="g4Info"></span><span id="g4Zone"></span></div><div id="g4Cross"></div><div id="g4HitM">✕</div><div id="g4Warn"></div><div id="g4Feed"></div><canvas id="g4Radar" width="300" height="300"></canvas><div id="g4W"></div><button id="g4Fire">⚡<br>TEMBAK</button><div id="g4Help">Klik / F = tembak (tahan = beruntun) · 1–4 = senjata · Shift = lari · bidikan terbantu otomatis</div>`;
  document.body.appendChild(hud);
  const $h = (id) => document.getElementById(id);
  const feed = (html) => { const d = document.createElement("div"); d.innerHTML = html; $h("g4Feed").prepend(d); setTimeout(() => d.remove(), 5500); while ($h("g4Feed").children.length > 5) $h("g4Feed").lastChild.remove(); };
  function hudW() {
    const el = $h("g4W"); if (!el) return;
    el.innerHTML = ["pistol", "cepat", "jauh", "sebar"].map((w, i) => { const a = st.ammo[w]; const ok = w === "pistol" || a > 0; return `<button data-w="${w}" class="${st.w === w ? "on" : ""}" ${ok ? "" : "disabled"}>${WICON[w]}<b>${i + 1} · ${WNAME[w]}</b><small>${w === "pistol" ? "∞" : a}</small></button>`; }).join("");
    el.querySelectorAll("button").forEach((b) => { b.onpointerdown = (e) => { e.stopPropagation(); e.preventDefault(); sw(b.dataset.w); }; });
  }
  function hudTop() {
    if (!$h("g4Lives")) return;
    $h("g4Lives").innerHTML = [0, 1, 2, 3, 4, 5].map((i) => `<span class="${i < st.lives ? "" : "x"}">⚡</span>`).join("");
    $h("g4Sh").textContent = st.sh ? "🛡".repeat(st.sh) : "";
    const left = Math.max(0, st.limit - st.t);
    $h("g4Info").textContent = `👥 ${st.al}  ⏱ ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
  }

  // ------------------------------------------------------------------
  // ARENA
  // ------------------------------------------------------------------
  const tex = (w, h, fn, rep) => { const c = A.l2Canvas(w, h, fn); return A.xTex(c, rep); };
  function build(m) {
    const L = st.L = m.lay.g4, map = st.map = m.map;
    A.XROOMS.t_g4 = { x0: L.x0, x1: L.x1, z0: L.z0, z1: L.z1, h: 14, name: "Arena Sinyal Terakhir", short: "Arena" };
    const root = st.root = new T3.Group(); root.position.set(L.cx, 0, L.cz); A.scene.add(root); A.own(root);
    // lantai heksagon neon
    const ft = tex(512, 512, (x, w, h) => { x.fillStyle = "#05030f"; x.fillRect(0, 0, w, h); x.strokeStyle = "#7c3aed"; x.lineWidth = 2; x.globalAlpha = 0.55; const R = 32; for (let r = -1; r < 11; r++) for (let c = -1; c < 10; c++) { const cx = c * R * 1.732 + (r % 2 ? R * 0.866 : 0), cy = r * R * 1.5; x.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; x[k ? "lineTo" : "moveTo"](cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95); } x.closePath(); x.stroke(); } x.globalAlpha = 0.9; x.fillStyle = "#22d3ee"; for (let i = 0; i < 40; i++) x.fillRect(Math.random() * w, Math.random() * h, 3, 3); }, [14, 14]);
    const floor = new T3.Mesh(new T3.PlaneGeometry(70, 70), new T3.MeshStandardMaterial({ map: ft, emissiveMap: ft, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.6 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);
    A.world.floors && A.world.floors.push(floor); st.floor = floor;
    // pagar energi keliling
    const fence = new T3.MeshBasicMaterial({ map: tex(256, 256, (x, w, h) => { const g = x.createLinearGradient(0, h, 0, 0); g.addColorStop(0, "rgba(34,211,238,.75)"); g.addColorStop(0.5, "rgba(124,58,237,.25)"); g.addColorStop(1, "rgba(124,58,237,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = "rgba(255,255,255,.35)"; for (let y = 0; y < h; y += 8) x.fillRect(0, y, w, 1); }, [10, 1]), transparent: true, side: T3.DoubleSide, depthWrite: false, toneMapped: false });
    st.fenceTex = fence.map;
    for (const [x, z, ry] of [[0, -35, 0], [0, 35, 0], [-35, 0, Math.PI / 2], [35, 0, Math.PI / 2]]) { const f = new T3.Mesh(new T3.PlaneGeometry(70, 9), fence); f.position.set(x, 4.5, z); f.rotation.y = ry; root.add(f); }
    for (const [x, z] of [[-35, -35], [35, -35], [-35, 35], [35, 35]]) { const p = new T3.Mesh(new T3.CylinderGeometry(0.6, 0.8, 11, 6), new T3.MeshStandardMaterial({ color: 0x1e1b4b, metalness: 0.8, roughness: 0.3 })); p.position.set(x, 5.5, z); root.add(p); const gl = A.world.glowSprite("#d946ef", 4, 0.7); gl.position.set(x, 11.2, z); root.add(gl); }
    // langit badai
    const sky = new T3.Mesh(new T3.SphereGeometry(160, 32, 16), new T3.MeshBasicMaterial({ map: tex(32, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#020010"); g.addColorStop(0.55, "#1e0b3b"); g.addColorStop(0.7, "#4a044e"); g.addColorStop(1, "#0b0420"); x.fillStyle = g; x.fillRect(0, 0, w, h); }), side: T3.BackSide, depthWrite: false, toneMapped: false, fog: false }));
    root.add(sky); st.sky = sky;
    // penutup (cover)
    const crateT = tex(256, 256, (x, w, h) => { x.fillStyle = "#151a28"; x.fillRect(0, 0, w, h); x.strokeStyle = "#334155"; x.lineWidth = 10; x.strokeRect(8, 8, w - 16, h - 16); x.strokeStyle = "#22d3ee"; x.globalAlpha = 0.8; x.lineWidth = 4; x.beginPath(); x.moveTo(20, h / 2); x.lineTo(w - 20, h / 2); x.stroke(); x.globalAlpha = 1; x.fillStyle = "#f0abfc"; x.font = "bold 26px monospace"; x.fillText("SNYL-" + Math.floor(Math.random() * 90 + 10), 26, 60); });
    const crateM = new T3.MeshStandardMaterial({ map: crateT, emissiveMap: crateT, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.4, metalness: 0.7 });
    const edgeM = new T3.LineBasicMaterial({ color: 0x22d3ee });
    const pilM = new T3.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.25, metalness: 0.9, emissive: 0x4c1d95, emissiveIntensity: 0.3 });
    for (const c of map.cover) {
      const [wx, wz] = toW(c.x, c.z);
      if (c.t === "c") {
        const m = new T3.Mesh(new T3.CylinderGeometry(c.r, c.r * 1.08, c.h, 10), pilM); m.position.set(c.x, c.h / 2, c.z); m.castShadow = true; root.add(m);
        for (const y of [0.4, c.h - 0.3]) { const r = new T3.Mesh(new T3.TorusGeometry(c.r * 1.05, 0.04, 6, 24), A.cvGlowMat(0xd946ef)); r.rotation.x = Math.PI / 2; r.position.set(c.x, y, c.z); root.add(r); }
        const ci = { x: wx, z: wz, r: c.r }; A.world.circles.push(ci); st.circles.push(ci);
      } else {
        const m = new T3.Mesh(new T3.BoxGeometry(c.w, c.h, c.d), crateM); m.position.set(c.x, c.h / 2, c.z); m.castShadow = true; root.add(m);
        const e = new T3.LineSegments(new T3.EdgesGeometry(new T3.BoxGeometry(c.w + 0.02, c.h + 0.02, c.d + 0.02)), edgeM); e.position.copy(m.position); root.add(e);
        const x0 = wx - c.w / 2, x1 = wx + c.w / 2, z0 = wz - c.d / 2, z1 = wz + c.d / 2;
        for (const s of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]) st.cols.push(A.xCol(s[0], s[1], s[2], s[3], 0.04));
      }
    }
    // zona badai data
    const zt = tex(512, 256, (x, w, h) => { x.fillStyle = "rgba(0,0,0,0)"; x.clearRect(0, 0, w, h); for (let i = 0; i < 70; i++) { x.fillStyle = Math.random() < 0.5 ? "rgba(217,70,239,.8)" : "rgba(34,211,238,.6)"; x.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 60, 2 + Math.random() * 6); } x.fillStyle = "rgba(240,171,252,.9)"; x.font = "bold 22px monospace"; for (let i = 0; i < 18; i++) x.fillText(Math.random() < 0.5 ? "01" : "10", Math.random() * w, Math.random() * h); }, [8, 2]);
    st.zoneTex = zt;
    const zw = new T3.Mesh(new T3.CylinderGeometry(1, 1, 22, 96, 1, true), new T3.MeshBasicMaterial({ map: zt, color: 0xffffff, transparent: true, opacity: 0.85, side: T3.DoubleSide, depthWrite: false, blending: T3.AdditiveBlending, toneMapped: false, fog: false }));
    zw.position.y = 11; root.add(zw); st.zw = zw;
    const zf = new T3.Mesh(new T3.CylinderGeometry(1, 1, 22, 96, 1, true), new T3.MeshBasicMaterial({ color: 0x86198f, transparent: true, opacity: 0.25, side: T3.BackSide, depthWrite: false, toneMapped: false, fog: false }));
    zf.position.y = 11; root.add(zf); st.zf = zf;
    const nx = new T3.Mesh(new T3.RingGeometry(0.97, 1, 96), new T3.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: T3.DoubleSide, toneMapped: false, fog: false })); nx.rotation.x = -Math.PI / 2; nx.position.y = 0.05; nx.visible = false; root.add(nx); st.nx = nx;
    // item
    const padM = new T3.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 });
    map.picks.forEach((p, i) => {
      const g = new T3.Group(); g.position.set(p.x, 0, p.z); root.add(g);
      const pad = new T3.Mesh(new T3.CylinderGeometry(0.75, 0.85, 0.12, 6), padM); pad.position.y = 0.06; g.add(pad);
      const col = p.k === "perisai" ? 0x38bdf8 : p.k === "amunisi" ? 0xfacc15 : WCOL[p.k];
      const ring = new T3.Mesh(new T3.TorusGeometry(0.7, 0.04, 6, 6), A.cvGlowMat(col)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.14; g.add(ring);
      const item = itemMesh(p.k, col); item.position.y = 1.0; g.add(item);
      const gl = A.world.glowSprite("#" + new T3.Color(col).getHexString(), 1.8, 0.55); gl.position.y = 1.0; g.add(gl);
      const lb = A.spriteFrom(A.drawLabel(PICKN[p.k], { size: 40, padX: 10, padY: 3 }), 0.26); lb.position.y = 1.85; g.add(lb);
      st.picks.push({ g, item, gl, lb, on: true, k: p.k, x: p.x, z: p.z });
    });
  }
  function itemMesh(k, col) {
    const g = new T3.Group(), gm = A.cvGlowMat(col), dm = new T3.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.25 });
    if (k === "perisai") { const h = new T3.Mesh(new T3.TorusGeometry(0.32, 0.06, 6, 6), gm); g.add(h); const c = new T3.Mesh(new T3.CircleGeometry(0.28, 6), new T3.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, side: T3.DoubleSide, toneMapped: false })); g.add(c); }
    else if (k === "amunisi") { const b = new T3.Mesh(new T3.BoxGeometry(0.42, 0.3, 0.3), dm); g.add(b); for (const x of [-0.12, 0.12]) { const c = new T3.Mesh(new T3.CylinderGeometry(0.05, 0.05, 0.34, 10), gm); c.position.set(x, 0, 0); c.rotation.x = Math.PI / 2; g.add(c); } }
    else {
      const len = k === "jauh" ? 1.0 : k === "sebar" ? 0.6 : 0.75;
      const body = new T3.Mesh(new T3.BoxGeometry(0.14, 0.16, len * 0.6), dm); g.add(body);
      const bar = new T3.Mesh(new T3.CylinderGeometry(k === "sebar" ? 0.09 : 0.035, 0.04, len * 0.5, 10), dm); bar.rotation.x = Math.PI / 2; bar.position.z = len * 0.5; g.add(bar);
      const ln = new T3.Mesh(new T3.BoxGeometry(0.02, 0.05, len * 0.62), gm); ln.position.set(0.075, 0.02, 0.05); g.add(ln);
      const grip = new T3.Mesh(new T3.BoxGeometry(0.08, 0.22, 0.08), dm); grip.position.set(0, -0.15, -0.08); grip.rotation.x = 0.3; g.add(grip);
      if (k === "jauh") { const sc = new T3.Mesh(new T3.CylinderGeometry(0.04, 0.04, 0.3, 10), dm); sc.rotation.x = Math.PI / 2; sc.position.set(0, 0.14, 0); g.add(sc); }
    }
    return g;
  }

  // ------------------------------------------------------------------
  // LAWAN
  // ------------------------------------------------------------------
  function hearts(n, sh) { return A.l2Canvas(380, 64, (x, w, h) => { x.font = "40px system-ui"; x.textAlign = "center"; x.textBaseline = "middle"; x.shadowColor = "#22d3ee"; x.shadowBlur = 10; x.fillText("⚡".repeat(Math.max(0, n)) + (sh ? " " + "🛡".repeat(sh) : ""), w / 2, h / 2); }); }
  function oppGet(s, lx, lz) {
    let o = st.opp.get(s);
    if (o) return o;
    const col = colOf(s), av = A.makeAvatar(col, nameOf(s));
    A.applySkin(av, "trooper", col);
    const [wx, wz] = toW(lx, lz); av.position.set(wx, 0, wz); A.scene.add(av); A.own(av);
    const hc = hearts(6, 0), hs = new T3.Sprite(new T3.SpriteMaterial({ map: A.xTex(hc), transparent: true, depthTest: false, toneMapped: false })); hs.scale.set(1.42, 0.24, 1); hs.position.y = 2.42; av.add(hs);
    const bub = new T3.Mesh(new T3.SphereGeometry(0.75, 20, 14), new T3.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false })); bub.position.y = 1.0; bub.visible = false; av.add(bub);
    o = { s, av, hs, hc, bub, cur: { x: wx, z: wz }, tgt: { x: wx, z: wz }, yaw: 0, tyaw: 0, lives: 6, sh: 0, inv: 0, mv: 0, w: "pistol" };
    st.opp.set(s, o);
    return o;
  }
  function oppDrop(s, boom) {
    const o = st.opp.get(s); if (!o) return;
    if (boom) { burst(o.cur.x, 1.0, o.cur.z, 0xd946ef, 46, 5); burst(o.cur.x, 1.0, o.cur.z, 0x22d3ee, 30, 3.5); }
    A.scene.remove(o.av); A.unown(o.av); o.av.traverse((q) => q.geometry?.dispose?.());
    st.opp.delete(s);
  }

  // ------------------------------------------------------------------
  // EFEK: proyektil energi, percikan
  // ------------------------------------------------------------------
  const boltGeo = new T3.CylinderGeometry(0.055, 0.055, 1, 8); boltGeo.rotateX(Math.PI / 2);
  const boltMat = {}; for (const [k, c] of Object.entries(WCOL)) boltMat[k] = A.cvGlowMat(c);
  function bolt(id, lx, lz, a, w, sp, rg, owner) {
    const [wx, wz] = toW(lx, lz), g = new T3.Group();
    const len = w === "jauh" ? 2.4 : w === "cepat" ? 0.7 : 1.0;
    const m = new T3.Mesh(boltGeo, boltMat[w] || boltMat.pistol); m.scale.set(w === "jauh" ? 0.7 : 1, w === "jauh" ? 0.7 : 1, len); g.add(m);
    const core = new T3.Mesh(boltGeo, A.cvGlowMat(0xffffff)); core.scale.set(0.45, 0.45, len * 0.9); g.add(core);
    const gl = A.world.glowSprite("#" + new T3.Color(WCOL[w] || 0xffffff).getHexString(), w === "jauh" ? 1.6 : 1.1, 0.75); g.add(gl);
    g.position.set(wx, 1.2, wz); g.rotation.y = a; A.scene.add(g); A.own(g);
    st.bolts.set(id, { g, x: lx, z: lz, dx: Math.sin(a), dz: Math.cos(a), sp, left: rg, w, o: owner });
  }
  function boltDrop(id, spark) {
    const b = st.bolts.get(id); if (!b) return;
    if (spark) { const [wx, wz] = toW(b.x, b.z); burst(wx, 1.2, wz, WCOL[b.w] || 0xffffff, 12, 2.2); }
    A.scene.remove(b.g); A.unown(b.g); st.bolts.delete(id);
  }
  function burst(x, y, z, col, n, sp) {
    const g = new T3.BufferGeometry(), p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) { p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; const a = Math.random() * 6.28, u = Math.random() * 2 - 1, s = sp * (0.4 + Math.random()); v.push([Math.cos(a) * Math.sqrt(1 - u * u) * s, u * s + 1, Math.sin(a) * Math.sqrt(1 - u * u) * s]); }
    g.setAttribute("position", new T3.BufferAttribute(p, 3));
    const m = new T3.Points(g, new T3.PointsMaterial({ color: col, size: 0.12, transparent: true, opacity: 1, depthWrite: false, blending: T3.AdditiveBlending, toneMapped: false }));
    A.scene.add(m); A.own(m);
    st.fx.push({ m, v, t: 0, life: 0.7 });
  }
  function coverHit(x, z, pad = 0) { for (const c of st.map.cover) { if (c.t === "c") { if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true; } else if (Math.abs(x - c.x) < c.w / 2 + pad && Math.abs(z - c.z) < c.d / 2 + pad) return true; } return false; }
  function los(ax, az, bx, bz) { const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.5); for (let i = 1; i < n; i++) { const k = i / n; if (coverHit(ax + (bx - ax) * k, az + (bz - az) * k)) return false; } return true; }

  // ------------------------------------------------------------------
  // INPUT: tembak, ganti senjata, bidikan terbantu
  // ------------------------------------------------------------------
  function myLocal() { return [P.x - st.L.cx, P.z - st.L.cz]; }
  function aim() {
    const base = Math.atan2(-Math.sin(P.camYaw), -Math.cos(P.camYaw)), [mx, mz] = myLocal(), W = st.W[st.w] || st.W.pistol;
    let best = null, bs = 1e9; const cone = touch ? 0.5 : 0.32;
    for (const o of st.opp.values()) {
      const lx = o.cur.x - st.L.cx, lz = o.cur.z - st.L.cz, dx = lx - mx, dz = lz - mz, d = Math.hypot(dx, dz);
      if (d > W.rg + 1) continue;
      let df = Math.atan2(dx, dz) - base; df = Math.atan2(Math.sin(df), Math.cos(df));
      if (Math.abs(df) > cone) continue;
      if (!los(mx, mz, lx, lz)) continue;
      const sc = Math.abs(df) * 3 + d / W.rg; if (sc < bs) { bs = sc; best = Math.atan2(dx, dz); }
    }
    return { a: best ?? base, lock: best !== null };
  }
  function fire() {
    if (!st.started || st.ended || st.lives <= 0) return;
    const W = st.W[st.w] || st.W.pistol, now = performance.now();
    if (now - st.lastFire < W.cd * 1000) return;
    if (st.w !== "pistol" && !(st.ammo[st.w] > 0)) { sw("pistol"); return; }
    st.lastFire = now;
    const { a } = aim();
    P.yaw = a + Math.PI; P.walkTo = null;
    A.send({ type: "tim_in", g: 4, a: "f", d: Math.round(a * 1e4) / 1e4 });
  }
  function sw(w) {
    if (w !== "pistol" && !(st.ammo[w] > 0)) { A.toast(`${WNAME[w]} belum kamu miliki — ambil di arena.`, 1800); return; }
    st.w = w; A.send({ type: "tim_in", g: 4, a: "sw", w }); hudW();
  }
  const onKey = (e) => {
    if (e.target && e.target.closest && e.target.closest("input,textarea,select")) return;
    if (e.code === "KeyF") { if (e.type === "keydown") { st.fireHeld = true; fire(); } else st.fireHeld = false; e.preventDefault(); }
    if (e.type === "keydown" && /^Digit[1-4]$/.test(e.code)) sw(["pistol", "cepat", "jauh", "sebar"][+e.code[5] - 1]);
    if (e.type === "keydown" && (e.code === "Enter" || e.code === "KeyT")) { e.stopPropagation(); e.preventDefault(); A.toast("🔇 Chat dimatikan pada babak ini.", 1500); }
  };
  const cv = A.renderer.domElement;
  const onDown = (e) => { if (e.button !== 0 || e.pointerType === "touch") return; st.fireHeld = true; fire(); };
  const onUp = () => { st.fireHeld = false; };
  addEventListener("keydown", onKey, true); addEventListener("keyup", onKey, true);
  cv.addEventListener("pointerdown", onDown); addEventListener("pointerup", onUp);
  const fb = $h("g4Fire");
  fb.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); st.fireHeld = true; fire(); });
  fb.addEventListener("pointerup", (e) => { e.preventDefault(); st.fireHeld = false; });
  fb.addEventListener("pointercancel", () => { st.fireHeld = false; });

  // ------------------------------------------------------------------
  // PESAN SERVER
  // ------------------------------------------------------------------
  function onG(m) {
    st.W = m.W; st.limit = m.limit || 420; st.me = m.me; st.zoneDef = m.zone;
    build(m);
    const s = m.map.spawns[m.sp], [wx, wz] = toW(s[0], s[1]);
    TIM.forceSkin = "trooper"; A.refreshMySkin(); A.presHide();
    st.speed0 = S.speed; S.speed = Math.min(S.speed || 1, 1.3);
    A.xTeleport(wx, wz, s[2]); P.camPitch = -0.28; st.cam0 = P.camDist; P.camDist = Math.max(3.8, Math.min(P.camDist, 5));
    TIM.musicOff = true; try { if (A.Music.xMute) A.Music.xMute(true); else { A.Music.xmuted = true; A.Music.setVol(); } } catch { /* */ }
    st.myBub = new T3.Mesh(new T3.SphereGeometry(0.75, 20, 14), new T3.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false })); st.myBub.visible = false; A.scene.add(st.myBub); A.own(st.myBub);
    A.ov("GAME 4 · SINYAL TERAKHIR", "Ambil senjata energi · berlindung di balik penutup · 6 nyawa · zona badai data menyempit. Hanya SATU sinyal yang tersisa.", 0);
    hudW(); hudTop();
    let n = 3; const cd = () => { if (st.ended || st.started) return; A.ov(String(n), "Bersiap…", 0); AU.beep(false); if (--n > 0) setTimeout(cd, 1000); };
    setTimeout(cd, 2000);
  }
  function onS(m) {
    st.t = m.t; st.al = m.al; st.snapT = performance.now();
    st.zone = { x: m.z[0], z: m.z[1], r: m.z[2] };
    const seen = new Set();
    for (const [s, lx, lz, r, lives, inv, sh, w, mv] of m.p) {
      if (s === st.me) {
        if (lives < st.lives) { /* kena: ditangani event */ }
        st.lives = lives; st.inv = !!inv; st.sh = sh;
        continue;
      }
      seen.add(s);
      const o = oppGet(s, lx, lz), [wx, wz] = toW(lx, lz);
      o.tgt = { x: wx, z: wz }; o.tyaw = r; o.mv = mv; o.inv = inv; o.w = w;
      if (o.lives !== lives || o.sh !== sh) { o.lives = lives; o.sh = sh; const c = hearts(lives, sh); o.hs.material.map.dispose(); o.hs.material.map = A.xTex(c); }
      o.bub.visible = sh > 0;
    }
    for (const s of [...st.opp.keys()]) if (!seen.has(s)) oppDrop(s, true);
    const me = m.me || {};
    if (me.a) { const changed = JSON.stringify(me.a) !== JSON.stringify(st.ammo) || me.w !== st.w; st.ammo = me.a; if (me.w && me.w !== st.w) st.w = me.w; if (changed) hudW(); }
    st.stormSt = me.st || 0; st.hits = me.h || 0;
    hudTop();
  }
  function onEv(m) {
    const e = m.e;
    if (e === "mulai") { st.started = true; A.ov("MULAI!", "Bertahanlah sampai akhir!", 1400); AU.start(); AU.inten(0); AU.beep(true); feed("⚡ Arena aktif — semua sinyal dinyalakan"); }
    else if (e === "tembak") {
      const [ox, oz] = myLocal(); let near = m.o === st.me;
      for (const [id, x, z, a] of m.s) { bolt(id, x, z, a, m.w, m.sp, m.rg, m.o); if (!near && Math.hypot(x - ox, z - oz) < 14) near = true; }
      AU.fire(m.w, near || m.o === st.me);
      const src = m.o === st.me ? A.avatar : st.opp.get(m.o) && st.opp.get(m.o).av;
      if (src) { const f = A.world.glowSprite("#" + new T3.Color(WCOL[m.w]).getHexString(), 1.2, 0.9); f.position.set(src.position.x, 1.25, src.position.z); A.scene.add(f); A.own(f); st.fx.push({ m: f, t: 0, life: 0.1, flash: true }); }
      if (m.o !== st.me && st.opp.get(m.o)) { const o = st.opp.get(m.o); o.tyaw = m.s[0][3]; }
    }
    else if (e === "pecah") { const b = st.bolts.get(m.id); if (b) { b.x = m.x; b.z = m.z; } boltDrop(m.id, true); AU.spark(); }
    else if (e === "kena") {
      if (m.v === st.me) {
        st.lives = m.l; hudTop();
        A.cvFlash("#ef444466"); A.xShake(0.45, 0.07); AU.hit();
        $h("g4Dmg").style.opacity = 1; setTimeout(() => { if ($h("g4Dmg")) $h("g4Dmg").style.opacity = 0; }, 450);
        feed(m.why === "badai" ? `🌩 Badai data menggerus sinyalmu! <b>${m.l}</b> nyawa tersisa` : `⚡ Terkena sinyal <b>${A.esc(nameOf(m.a))}</b>! <b>${m.l}</b> nyawa tersisa`);
        TIM.heartBpm = m.l === 1 ? 118 : 0;
      } else {
        const o = st.opp.get(m.v); if (o) burst(o.cur.x, 1.1, o.cur.z, 0xf43f5e, 20, 3);
        if (m.a === st.me) { AU.ding(); const hm = $h("g4HitM"); hm.style.transition = "none"; hm.style.opacity = 1; requestAnimationFrame(() => { hm.style.transition = "opacity .35s"; hm.style.opacity = 0; }); feed(`🎯 Kamu mengenai <b>${A.esc(nameOf(m.v))}</b>`); }
      }
    }
    else if (e === "tameng") {
      if (m.v === st.me) { AU.shield(); feed("🛡 Perisai menahan tembakan!"); st.sh = m.sh; hudTop(); }
      else { const o = st.opp.get(m.v); if (o) burst(o.cur.x, 1.1, o.cur.z, 0x38bdf8, 18, 2.5); if (m.a === st.me) AU.ding(); }
    }
    else if (e === "terputus") {
      if (m.v !== st.me) { feed(`📡 <b>${A.esc(m.n || nameOf(m.v))}</b> terputus${m.why === "badai" ? " oleh badai data" : m.why === "putus" ? " (koneksi)" : ""}`); oppDrop(m.v, true); AU.out(); }
    }
    else if (e === "ambil") {
      const p = st.picks[m.i]; if (p) { p.on = false; p.g.visible = false; const [wx, wz] = toW(p.x, p.z); burst(wx, 1, wz, 0xfacc15, 16, 2); }
      if (m.v === st.me) { AU.pick(); feed(`📦 ${PICKN[m.k]} diambil`); if (st.W[m.k]) { st.w = m.k; hudW(); } }
    }
    else if (e === "muncul") { const p = st.picks[m.i]; if (p) { p.on = true; p.g.visible = true; } }
    else if (e === "zona") {
      st.phase++; AU.inten(Math.min(4, st.phase)); AU.alarm();
      st.next = { x: m.x, z: m.z, r: m.to, until: performance.now() + m.dur * 1000 };
      A.ov("⚠ BADAI DATA MENYEMPIT", `Zona aman mengecil ke radius ${m.to} m dalam ${m.dur} detik — bergeraklah ke lingkaran putih!`, 3200);
      feed("🌩 Badai data mendekat!");
    }
  }

  // ------------------------------------------------------------------
  // DETAK
  // ------------------------------------------------------------------
  function tick(dt) {
    if (!st.root || st.ended) return;
    const t = A.t, now = performance.now();
    if (P.walkTo) P.walkTo = null;
    // kirim posisi
    if ((st.pT += dt) > 0.066) { st.pT = 0; A.send({ type: "tim_p", x: Math.round(P.x * 100) / 100, z: Math.round(P.z * 100) / 100, r: Math.round((P.yaw - Math.PI) * 100) / 100, mv: P.moving > 0.3 ? 1 : 0 }); }
    if (st.fireHeld) fire();
    // bidikan
    const ai = st.started ? aim() : { lock: false };
    $h("g4Cross") && $h("g4Cross").classList.toggle("lock", !!ai.lock);
    // lawan
    const k = Math.min(1, dt * 10);
    for (const o of st.opp.values()) {
      o.cur.x += (o.tgt.x - o.cur.x) * k; o.cur.z += (o.tgt.z - o.cur.z) * k;
      o.yaw = A.lerpAngle(o.yaw, o.tyaw + Math.PI, k);
      o.av.position.set(o.cur.x, o.mv ? Math.abs(Math.sin(t * 9)) * 0.05 : 0, o.cur.z); o.av.rotation.y = o.yaw;
      o.av.userData.body.rotation.x = o.mv ? 0.12 : 0;
      o.av.visible = !o.inv || Math.sin(t * 30) > 0;
      if (o.av.userData.skinAnim) o.av.userData.skinAnim(t + o.s);
    }
    // diri sendiri: kebal = berkedip, perisai = gelembung
    if (A.avatar) { if (st.inv) A.avatar.visible = Math.sin(t * 30) > 0 && !(S.fp || P.camDist < 0.6); }
    if (st.myBub) { st.myBub.visible = st.sh > 0; st.myBub.position.set(P.x, 1.0 + P.y, P.z); st.myBub.material.opacity = 0.12 + Math.sin(t * 4) * 0.05; }
    // proyektil
    for (const [id, b] of st.bolts) {
      const d = b.sp * dt; b.x += b.dx * d; b.z += b.dz * d; b.left -= d;
      const [wx, wz] = toW(b.x, b.z); b.g.position.set(wx, 1.2, wz);
      if (b.left <= 0 || Math.abs(b.x) > 35 || Math.abs(b.z) > 35) boltDrop(id, false);
      else if (coverHit(b.x, b.z, 0.03)) boltDrop(id, true);
    }
    // percikan
    for (let i = st.fx.length - 1; i >= 0; i--) {
      const F = st.fx[i]; F.t += dt;
      if (F.flash) { F.m.material.opacity = Math.max(0, 0.9 - F.t / F.life); }
      else { const pa = F.m.geometry.attributes.position; for (let j = 0; j < F.v.length; j++) { F.v[j][1] -= dt * 5; pa.array[j * 3] += F.v[j][0] * dt; pa.array[j * 3 + 1] += F.v[j][1] * dt; pa.array[j * 3 + 2] += F.v[j][2] * dt; } pa.needsUpdate = true; F.m.material.opacity = Math.max(0, 1 - F.t / F.life); }
      if (F.t >= F.life) { A.scene.remove(F.m); A.unown(F.m); F.m.geometry?.dispose?.(); F.m.material.dispose(); st.fx.splice(i, 1); }
    }
    // item berputar
    for (const p of st.picks) if (p.on) { p.item.rotation.y = t * 1.6; p.item.position.y = 1.0 + Math.sin(t * 2 + p.x) * 0.12; }
    // zona
    const Z = st.zone;
    st.zw.scale.set(Z.r, 1, Z.r); st.zw.position.x = Z.x; st.zw.position.z = Z.z;
    st.zf.scale.set(Z.r, 1, Z.r); st.zf.position.x = Z.x; st.zf.position.z = Z.z;
    st.zoneTex.offset.x += dt * 0.05; st.zoneTex.offset.y -= dt * 0.3; st.fenceTex.offset.y -= dt * 0.2;
    if (st.next) { st.nx.visible = true; st.nx.scale.set(st.next.r, st.next.r, 1); st.nx.position.x = st.next.x; st.nx.position.z = st.next.z; if (Z.r <= st.next.r + 0.05) st.next = null; } else st.nx.visible = false;
    const [mx, mz] = myLocal(), outD = Math.hypot(mx - Z.x, mz - Z.z) - Z.r, out = outD > 0 && st.started;
    $h("g4Vig").style.opacity = out ? 0.75 + Math.sin(t * 8) * 0.2 : 0;
    const wn = $h("g4Warn"); wn.style.display = out ? "block" : "none";
    if (out) { wn.innerHTML = `⚠ DI LUAR ZONA — BADAI DATA!<br><small style="font-size:.6em">kembali ke dalam lingkaran · −1 nyawa dalam ${Math.max(0, 4 - st.stormSt).toFixed(1)} dtk</small>`; AU.storm(1); }
    $h("g4Zone").textContent = st.next ? `🌩 menyempit… r ${Math.round(Z.r)} m` : st.started ? `◎ zona r ${Math.round(Z.r)} m` : "";
    // kilat di langit
    if (Math.random() < dt * 0.25) { st.flashT = 0.12; }
    if (st.flashT > 0) { st.flashT -= dt; st.sky.material.color.setHex(0xffffff); } else st.sky.material.color.setHex(0xb8a8d8);
    radar();
    if (st.started && Math.floor(st.t) !== st.lastSec) { st.lastSec = Math.floor(st.t); const left = st.limit - st.t; if (left <= 10 && left > 0) AU.beep(left <= 5); }
  }
  function radar() {
    const c = $h("g4Radar"); if (!c) return;
    const x = c.getContext("2d"), W = c.width, s = W / 72, o = W / 2, X = (v) => o + v * s;
    x.clearRect(0, 0, W, W); x.save(); x.beginPath(); x.arc(o, o, o - 2, 0, 7); x.clip();
    x.fillStyle = "rgba(134,25,143,.45)"; x.fillRect(0, 0, W, W);
    x.globalCompositeOperation = "destination-out"; x.beginPath(); x.arc(X(st.zone.x), X(st.zone.z), st.zone.r * s, 0, 7); x.fill(); x.globalCompositeOperation = "source-over";
    x.strokeStyle = "#f0abfc"; x.lineWidth = 3; x.beginPath(); x.arc(X(st.zone.x), X(st.zone.z), st.zone.r * s, 0, 7); x.stroke();
    if (st.next) { x.setLineDash([8, 6]); x.strokeStyle = "#fff"; x.beginPath(); x.arc(X(st.next.x), X(st.next.z), st.next.r * s, 0, 7); x.stroke(); x.setLineDash([]); }
    x.fillStyle = "rgba(148,163,184,.55)"; for (const cv2 of st.map.cover) { if (cv2.t === "c") { x.beginPath(); x.arc(X(cv2.x), X(cv2.z), cv2.r * s, 0, 7); x.fill(); } else x.fillRect(X(cv2.x - cv2.w / 2), X(cv2.z - cv2.d / 2), cv2.w * s, cv2.d * s); }
    for (const p of st.picks) if (p.on) { x.fillStyle = p.k === "perisai" ? "#38bdf8" : p.k === "amunisi" ? "#facc15" : "#" + new T3.Color(WCOL[p.k]).getHexString(); x.fillRect(X(p.x) - 3, X(p.z) - 3, 6, 6); }
    const [mx, mz] = myLocal(), a = P.yaw;
    x.save(); x.translate(X(mx), X(mz)); x.rotate(-a + Math.PI); x.fillStyle = "#fde047"; x.beginPath(); x.moveTo(0, 10); x.lineTo(-6, -6); x.lineTo(6, -6); x.closePath(); x.fill(); x.restore();
    x.restore();
    x.strokeStyle = "#a21caf"; x.lineWidth = 2; x.beginPath(); x.arc(o, o, o - 2, 0, 7); x.stroke();
  }
  function zone(x, z) { const L = st.L; return !!L && x > L.x0 && x < L.x1 && z > L.z0 && z < L.z1; }
  function end() {
    if (st.ended) return; st.ended = true;
    AU.stop(); TIM.heartBpm = 0; TIM.musicOff = false;
    try { if (A.Music.xMute) A.Music.xMute(false); else { A.Music.xmuted = false; A.Music.setVol(); } } catch { /* */ }
    removeEventListener("keydown", onKey, true); removeEventListener("keyup", onKey, true); cv.removeEventListener("pointerdown", onDown); removeEventListener("pointerup", onUp);
    hud.remove(); css.remove(); document.body.classList.remove("g4");
    for (const s of [...st.opp.keys()]) oppDrop(s, false);
    for (const id of [...st.bolts.keys()]) boltDrop(id, false);
    for (const F of st.fx) { A.scene.remove(F.m); A.unown(F.m); }
    if (st.myBub) { A.scene.remove(st.myBub); A.unown(st.myBub); }
    if (st.root) { A.scene.remove(st.root); A.unown(st.root); st.root.traverse((o) => { o.geometry?.dispose?.(); }); }
    if (st.floor && A.world.floors) { const i = A.world.floors.indexOf(st.floor); if (i >= 0) A.world.floors.splice(i, 1); }
    for (const c of st.cols) { const i = A.world.colliders.indexOf(c); if (i >= 0) A.world.colliders.splice(i, 1); }
    for (const c of st.circles) { const i = A.world.circles.indexOf(c); if (i >= 0) A.world.circles.splice(i, 1); }
    for (const o of st.hidden) o.visible = true;
    delete A.XROOMS.t_g4;
    S.speed = st.speed0; if (st.cam0) P.camDist = st.cam0;
    if (A.avatar) A.avatar.visible = true;
  }
  return { onG, onS, onEv, tick, end, zone };
}
