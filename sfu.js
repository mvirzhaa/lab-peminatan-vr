// =====================================================================
//  SFU (Selective Forwarding Unit) suara & berbagi layar — mediasoup
//  Dipakai di Kelas 1, Kelas 2, dan Ruang Rapat: tiap pemain cukup mengirim
//  SATU aliran ke server, lalu server meneruskannya ke peserta lain di ruangan.
//  Tanpa mediasoup (paket opsional) atau bila dimatikan (SFU=0), galeri
//  kembali memakai suara peer-to-peer seperti sebelumnya.
//
//  Variabel lingkungan:
//    SFU=0                  matikan SFU
//    SFU_PORT=44444         port UDP+TCP media (buka di firewall!)
//    SFU_LISTEN_IP=0.0.0.0  alamat dengar
//    SFU_ANNOUNCED_IP=…     IP publik server (WAJIB untuk server online)
// =====================================================================
'use strict';
const os = require('os');

const CODECS = [
  { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
  { kind: 'video', mimeType: 'video/VP8', clockRate: 90000, parameters: { 'x-google-start-bitrate': 800 } },
  { kind: 'video', mimeType: 'video/H264', clockRate: 90000, parameters: { 'packetization-mode': 1, 'profile-level-id': '42e01f', 'level-asymmetry-allowed': 1 } }
];

function localIp() {
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) return a.address;
  return '127.0.0.1';
}

function createSfu({ onSpeak, onProducer }) {
  if (process.env.SFU === '0') { console.log('SFU dimatikan (SFU=0) — suara kelas memakai peer-to-peer.'); return null; }
  let ms;
  try { ms = require('mediasoup'); } catch (err) { console.log('SFU tidak aktif: ' + (err && err.message ? err.message : 'paket "mediasoup" belum terpasang') + '. Suara kelas memakai peer-to-peer.'); return null; }
  const PORT = +process.env.SFU_PORT || 44444;
  const LISTEN = process.env.SFU_LISTEN_IP || '0.0.0.0';
  const ANNOUNCED = process.env.SFU_ANNOUNCED_IP || localIp();
  let worker = null, server = null, ready = null, failed = false;
  const rooms = new Map(); // key → { router, alo, peers: Map(ws → peer) }

  async function start() {
    worker = await ms.createWorker({ logLevel: 'warn' });
    worker.on('died', () => { console.error('SFU: worker mediasoup mati — suara kelas kembali peer-to-peer sampai server di-restart.'); failed = true; });
    server = await worker.createWebRtcServer({ listenInfos: [
      { protocol: 'udp', ip: LISTEN, announcedAddress: ANNOUNCED, port: PORT },
      { protocol: 'tcp', ip: LISTEN, announcedAddress: ANNOUNCED, port: PORT }
    ] });
    console.log(`SFU aktif: media di ${ANNOUNCED}:${PORT} (UDP & TCP). Pastikan port ini dibuka di firewall.`);
  }
  ready = start().catch((e) => { failed = true; console.error('SFU gagal dijalankan — suara kelas memakai peer-to-peer:', e.message); });

  async function room(key) {
    let R = rooms.get(key);
    if (R) return R;
    const router = await worker.createRouter({ mediaCodecs: CODECS });
    const alo = await router.createAudioLevelObserver({ maxEntries: 8, threshold: -60, interval: 400 });
    R = { router, alo, peers: new Map() };
    alo.on('volumes', (v) => onSpeak && onSpeak(key, [...new Set(v.map((x) => x.producer.appData.peer))]));
    alo.on('silence', () => onSpeak && onSpeak(key, []));
    rooms.set(key, R);
    return R;
  }
  const peerOf = (R, ws) => { let p = R.peers.get(ws); if (!p) { p = { transports: new Map(), producers: new Map(), consumers: new Map() }; R.peers.set(ws, p); } return p; };
  const others = (R, ws) => [...R.peers.keys()].filter((c) => c !== ws);
  const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };

  function closeProducer(key, R, ws, pid) {
    const p = R.peers.get(ws); if (!p) return;
    const pr = p.producers.get(pid); if (!pr) return;
    p.producers.delete(pid);
    try { pr.close(); } catch { }
    for (const c of others(R, ws)) send(c, { type: 'sfu_closed', pid });
    if (onProducer) onProducer(key, ws, pr.appData.src, false);
  }

  // permintaan dari klien → jawaban { ok, data | err }
  async function request(ws, key, m, allow) {
    if (failed) throw new Error('SFU tidak tersedia');
    await ready;
    if (failed || !server) throw new Error('SFU tidak tersedia');
    const R = await room(key), P = peerOf(R, ws);
    switch (m.type) {
      case 'sfu_caps': return { caps: R.router.rtpCapabilities };
      case 'sfu_tr': {
        if (P.transports.size >= 2) for (const t of P.transports.values()) if (t.appData.dir === m.dir) { try { t.close(); } catch { } P.transports.delete(t.id); }
        const t = await R.router.createWebRtcTransport({ webRtcServer: server, enableUdp: true, enableTcp: true, preferUdp: true, initialAvailableOutgoingBitrate: 800000, appData: { dir: m.dir === 'send' ? 'send' : 'recv' } });
        P.transports.set(t.id, t);
        return { id: t.id, iceParameters: t.iceParameters, iceCandidates: t.iceCandidates, dtlsParameters: t.dtlsParameters };
      }
      case 'sfu_conn': { const t = P.transports.get(m.tid); if (!t) throw new Error('transport'); await t.connect({ dtlsParameters: m.dtls }); return {}; }
      case 'sfu_prod': {
        const t = P.transports.get(m.tid); if (!t || t.appData.dir !== 'send') throw new Error('transport');
        const src = m.src === 'screen' ? 'screen' : 'mic';
        if ((src === 'mic') !== (m.kind === 'audio')) throw new Error('jenis media');
        const why = allow(ws, src); if (why) throw new Error(why);
        // satu mikrofon per pemain
        for (const [pid, pr] of P.producers) if (pr.appData.src === src && src === 'mic') closeProducer(key, R, ws, pid);
        const pr = await t.produce({ kind: m.kind, rtpParameters: m.rtp, appData: { peer: ws.id, src } });
        P.producers.set(pr.id, pr);
        if (pr.kind === 'audio') R.alo.addProducer({ producerId: pr.id }).catch(() => {});
        for (const c of others(R, ws)) send(c, { type: 'sfu_new', pid: pr.id, peer: ws.id, kind: pr.kind, src });
        if (onProducer) onProducer(key, ws, src, true, pr);
        return { id: pr.id };
      }
      case 'sfu_list': {
        const out = [];
        for (const [c, p] of R.peers) if (c !== ws) for (const pr of p.producers.values()) out.push({ pid: pr.id, peer: c.id, kind: pr.kind, src: pr.appData.src });
        return { list: out };
      }
      case 'sfu_cons': {
        const t = [...P.transports.values()].find((x) => x.appData.dir === 'recv'); if (!t) throw new Error('transport');
        if (!R.router.canConsume({ producerId: m.pid, rtpCapabilities: m.caps })) throw new Error('codec');
        const c = await t.consume({ producerId: m.pid, rtpCapabilities: m.caps, paused: true });
        P.consumers.set(c.id, c);
        c.on('producerclose', () => { P.consumers.delete(c.id); });
        return { id: c.id, pid: m.pid, kind: c.kind, rtp: c.rtpParameters };
      }
      case 'sfu_resume': {
        const c = P.consumers.get(m.cid);
        if (c) {
          await c.resume();
          if (c.kind === 'video') {
            c.requestKeyFrame().catch(() => {});
            setTimeout(() => { if (!c.closed) c.requestKeyFrame().catch(() => {}); }, 600);
          }
        }
        return {};
      }
      case 'sfu_pause': { const pr = P.producers.get(m.pid); if (pr) { if (m.on) await pr.pause(); else { const why = allow(ws, pr.appData.src, true); if (why) throw new Error(why); await pr.resume(); } } return {}; }
      case 'sfu_stop': { closeProducer(key, R, ws, m.pid); return {}; }
    }
    throw new Error('perintah tidak dikenal');
  }
  function leave(ws, key) {
    const R = rooms.get(key); if (!R) return;
    const P = R.peers.get(ws); if (!P) return;
    for (const pid of [...P.producers.keys()]) closeProducer(key, R, ws, pid);
    for (const t of P.transports.values()) { try { t.close(); } catch { } }
    R.peers.delete(ws);
    if (!R.peers.size) { try { R.router.close(); } catch { } rooms.delete(key); }
  }
  // jeda/lanjutkan mikrofon pemain (dipakai pengajar: bisukan semua / beri giliran)
  function setMic(ws, key, paused) {
    const R = rooms.get(key), P = R && R.peers.get(ws); if (!P) return;
    for (const pr of P.producers.values()) if (pr.appData.src === 'mic') { (paused ? pr.pause() : pr.resume()).catch(() => {}); }
  }
  function stopScreen(ws, key) {
    const R = rooms.get(key), P = R && R.peers.get(ws); if (!P) return;
    for (const [pid, pr] of [...P.producers]) if (pr.appData.src === 'screen') closeProducer(key, R, ws, pid);
  }
  return { request, leave, setMic, stopScreen, ok: () => !failed, info: () => ({ port: PORT, ip: ANNOUNCED }) };
}
module.exports = { createSfu };
