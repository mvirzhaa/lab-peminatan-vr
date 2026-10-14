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

const PORT = +process.env.PORT || 8080;
const MAX_CLIENTS = +process.env.MAX_CLIENTS || 150;     // total koneksi
const MAX_PER_ROOM = +process.env.MAX_PER_ROOM || 60;    // per ruang (?room=kelas-a)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean); // kosong = semua
const MAX_MSG = 8 * 1024;            // byte per pesan
const RATE = 40;                     // pesan per detik per klien
const PUBLIC = path.join(__dirname, 'public');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const secHeaders = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN', 'Permissions-Policy': 'microphone=(self), xr-spatial-tracking=(self), autoplay=(self "https://www.youtube-nocookie.com" "https://www.youtube.com" "https://drive.google.com"), fullscreen=(self "https://www.youtube-nocookie.com" "https://www.youtube.com" "https://drive.google.com")' };
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, secHeaders); return res.end(); }
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400, secHeaders); return res.end(); }
  if (p === '/health') { res.writeHead(200, { ...secHeaders, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, clients: wss.clients.size })); }
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

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG });
const rooms = new Map(); // nama → Set klien

server.on('upgrade', (req, socket, head) => {
  let url; try { url = new URL(req.url, 'http://x'); } catch { return socket.destroy(); }
  if (url.pathname !== '/ws') return socket.destroy();
  if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(req.headers.origin)) return socket.destroy();
  if (wss.clients.size >= MAX_CLIENTS) return socket.destroy();
  const room = (url.searchParams.get('room') || 'lobi').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32) || 'lobi';
  if ((rooms.get(room)?.size || 0) >= MAX_PER_ROOM) return socket.destroy();
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, room));
});

const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const isPlainObj = v => v && typeof v === 'object' && !Array.isArray(v);

wss.on('connection', (ws, room) => {
  ws.id = crypto.randomBytes(8).toString('hex');
  ws.room = room; ws.presence = {}; ws.alive = true; ws.tokens = RATE; ws.last = Date.now();
  if (!rooms.has(room)) rooms.set(room, new Set());
  const members = rooms.get(room);
  send(ws, { type: 'welcome', id: ws.id, peers: [...members].map(c => ({ id: c.id, data: c.presence })) });
  members.add(ws);

  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (buf, isBinary) => {
    // token bucket: batasi banjir pesan
    const now = Date.now(); ws.tokens = Math.min(RATE, ws.tokens + (now - ws.last) / 1000 * RATE); ws.last = now;
    if (ws.tokens < 1) return; ws.tokens -= 1;
    if (isBinary || buf.length > MAX_MSG) return;
    let m; try { m = JSON.parse(buf.toString('utf8')); } catch { return; }
    if (!isPlainObj(m)) return;
    if (m.type === 'presence' && isPlainObj(m.data)) {
      ws.presence = m.data;
      for (const c of members) if (c !== ws) send(c, { type: 'presence', id: ws.id, data: ws.presence });
    } else if (m.type === 'signal' && typeof m.to === 'string' && isPlainObj(m.data)) {
      for (const c of members) if (c.id === m.to) { send(c, { type: 'signal', from: ws.id, data: m.data }); break; }
    }
  });
  ws.on('close', () => {
    members.delete(ws); if (!members.size) rooms.delete(room);
    for (const c of members) send(c, { type: 'leave', id: ws.id });
  });
  ws.on('error', () => {});
});

// detak jantung: putuskan koneksi mati
setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 25000);

server.listen(PORT, () => console.log(`Galeri Media Imersif berjalan di http://localhost:${PORT}  (WebSocket: /ws)`));
