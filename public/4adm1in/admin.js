// Halaman admin peminatan — Lab Peminatan VR · Teknik Informatika UIKA
'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const LABS = { keris: ['KERIS', '#8b5cf6'], git: ['GIT', '#d946ef'], se: ['SE', '#4f46e5'], csn: ['CSN', '#0ea5e9'] };
  const IDS = Object.keys(LABS);
  let S = null, tab = 'daftar', pollT = null;

  const fmt = (t) => (t ? new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
  function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200); }
  async function api(path, opt = {}) {
    const r = await fetch(path, { credentials: 'same-origin', ...opt, headers: { 'X-Pem': '1', ...(opt.body && !(opt.body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...(opt.headers || {}) } });
    let j = {};
    try { j = await r.json(); } catch { /* kosong */ }
    if (r.status === 401 && path !== '/api/admin/login') { showLogin(); throw new Error(j.err || 'Sesi berakhir.'); }
    if (!r.ok || j.ok === false) { const e = new Error(j.err || `Gagal (${r.status})`); e.data = j; throw e; }
    return j;
  }
  const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body || {}) });
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const labTag = (id) => { const s = el('span', 'lab ' + (LABS[id] ? id : ''), LABS[id] ? LABS[id][0] : (id || '-')); return s; };

  // ---------- login ----------
  function showLogin() { clearInterval(pollT); $('app').hidden = true; $('login').hidden = false; setTimeout(() => $('lu').focus(), 30); }
  $('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    $('lerr').textContent = '';
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ user: $('lu').value, pass: $('lp').value }) });
      $('lp').value = '';
      await load();
    } catch (err) { $('lerr').textContent = err.message; }
  };
  $('logout').onclick = async () => { try { await post('/api/admin/logout'); } catch { /* abaikan */ } showLogin(); };

  // ---------- muat & tampilkan ----------
  async function load(quiet) {
    try {
      S = await api('/api/admin/state');
    } catch (e) { if (!quiet) toast(e.message); return; }
    $('login').hidden = true; $('app').hidden = false;
    render();
    clearInterval(pollT);
    pollT = setInterval(() => { if (!document.hidden) load(true); }, 20000);
  }
  function render() {
    $('hPeriod').textContent = S.period;
    $('openSw').checked = S.open;
    $('openTxt').textContent = S.open ? 'Pendaftaran dibuka' : 'Pendaftaran ditutup';
    $('sTotal').textContent = S.entries.length;
    $('sUpd').textContent = 'Diperbarui ' + fmt(S.stats.updated);
    drawPie($('pie'), S.stats.counts);
    const lg = $('legend'); lg.textContent = '';
    const tot = S.entries.length;
    for (const id of IDS) {
      const li = el('li'), i = el('i'); i.style.background = LABS[id][1];
      const d = el('div'), b = el('b', '', `${LABS[id][0]} · ${S.stats.counts[id]}`);
      d.append(b, el('span', '', `${tot ? (S.stats.counts[id] / tot * 100).toFixed(1) : '0.0'}% pilihan 1 · ${S.stats.counts2[id]} pilihan 2`));
      li.append(i, d); lg.appendChild(li);
    }
    renderRows(); renderFinal(); renderArchives();
    if (!$('period').value || document.activeElement !== $('period')) $('period').value = S.period;
  }
  function drawPie(c, counts) {
    const x = c.getContext('2d'), W = c.width, cx = W / 2, cy = W / 2, R = W / 2 - 10;
    x.clearRect(0, 0, W, W);
    const tot = IDS.reduce((a, k) => a + counts[k], 0);
    if (!tot) { x.fillStyle = '#e6e1f0'; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill(); }
    let a = -Math.PI / 2;
    for (const id of IDS) {
      if (!counts[id]) continue;
      const da = counts[id] / tot * Math.PI * 2;
      x.fillStyle = LABS[id][1]; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R, a, a + da); x.closePath(); x.fill();
      a += da;
    }
    x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(cx, cy, R * 0.58, 0, 7); x.fill(); x.globalCompositeOperation = 'source-over';
    x.fillStyle = getComputedStyle(document.body).color; x.textAlign = 'center';
    x.font = '700 64px Poppins, sans-serif'; x.fillText(String(tot), cx, cy + 14);
    x.font = '500 22px Poppins, sans-serif'; x.fillStyle = '#8a83a0'; x.fillText('pendaftar', cx, cy + 48);
  }
  function renderRows() {
    const q = $('q').value.trim().toLowerCase(), f = $('fLab').value, tb = $('rows');
    tb.textContent = '';
    const list = S.entries.filter((e) => (!f || e.p1 === f) && (!q || [e.nim, e.nama, e.email, e.hp, LABS[e.p1]?.[0], LABS[e.p2]?.[0], e.alasan].join(' ').toLowerCase().includes(q)));
    list.forEach((e, i) => {
      const tr = el('tr');
      tr.append(el('td', '', String(i + 1)), el('td', 'nw', fmt(e.t)), el('td', 'nw', e.nim), el('td', '', e.nama), el('td', '', e.angkatan));
      const k = el('td', 'nw'); k.append(el('div', '', e.hp || ''), el('div', 'mut', e.email || '')); tr.appendChild(k);
      const t1 = el('td'); t1.appendChild(labTag(e.p1)); const t2 = el('td'); t2.appendChild(labTag(e.p2));
      tr.append(t1, t2, el('td', 'al', e.alasan || ''));
      const td = el('td'), b = el('button', 'del', 'Hapus');
      b.onclick = async () => {
        if (b.dataset.arm !== '1') { b.dataset.arm = '1'; b.textContent = 'Yakin?'; setTimeout(() => { b.dataset.arm = ''; b.textContent = 'Hapus'; }, 2500); return; }
        try { await post('/api/admin/entry/delete', { id: e.id }); toast(`Data ${e.nim} dihapus.`); load(true); } catch (err) { toast(err.message); }
      };
      td.appendChild(b); tr.appendChild(td);
      tb.appendChild(tr);
    });
    $('empty').hidden = list.length > 0;
    $('empty').textContent = S.entries.length ? 'Tidak ada data yang cocok dengan pencarian.' : 'Belum ada pendaftar.';
  }
  function renderFinal() {
    const F = S.final, tb = $('frows');
    tb.textContent = '';
    $('fEmpty').hidden = !!(F && F.rows.length);
    $('fCount').textContent = F ? `${F.rows.length} mahasiswa` : '';
    const ch = $('fCounts'); ch.textContent = '';
    if (F) for (const id of IDS) { const s = labTag(id); s.textContent = `${LABS[id][0]} · ${F.counts[id]}`; ch.appendChild(s); }
    (F ? F.rows : []).forEach((r, i) => { const tr = el('tr'); const tl = el('td'); tl.appendChild(labTag(r.lab)); tr.append(el('td', '', String(i + 1)), el('td', 'nw', r.nim), el('td', '', r.nama), tl); tb.appendChild(tr); });
    if (document.activeElement !== $('fTitle')) $('fTitle').value = F ? F.title || '' : '';
    if (document.activeElement !== $('fNote')) $('fNote').value = F ? F.note || '' : '';
    $('pubBtn').disabled = !F; $('clearFinal').disabled = !F; $('saveMeta').disabled = !F;
    $('pubState').textContent = !F ? 'Belum ada data hasil final.' : F.published ? `✅ Sedang diumumkan sejak ${fmt(F.publishedAt)} — tampil di papan pengumuman Atrium.` : `Draf dari "${F.source || 'unggahan'}" (${fmt(F.uploadedAt)}) — belum diumumkan.`;
    $('pubBtn').textContent = F && F.published ? '⏸ Tarik pengumuman' : '📢 Umumkan sekarang';
    $('pubBtn').className = F && F.published ? 'ghost' : 'btn';
  }
  function renderArchives() {
    const tb = $('arows'); tb.textContent = '';
    $('aEmpty').hidden = S.archives.length > 0;
    for (const a of S.archives) {
      const tr = el('tr');
      tr.append(el('td', '', a.label || '-'), el('td', '', a.period || '-'), el('td', 'nw', fmt(a.at)), el('td', '', String(a.total)), el('td', '', a.final ? `${a.final} mahasiswa` : '-'));
      const td = el('td', 'nw'), dl = el('a', 'ghost', '⬇ Excel'); dl.href = '/api/admin/export.xlsx?arsip=' + encodeURIComponent(a.id);
      const del = el('button', 'del', 'Hapus');
      del.onclick = async () => {
        if (del.dataset.arm !== '1') { del.dataset.arm = '1'; del.textContent = 'Hapus permanen?'; setTimeout(() => { del.dataset.arm = ''; del.textContent = 'Hapus'; }, 3000); return; }
        try { await post('/api/admin/archive/delete', { id: a.id }); toast('Arsip dihapus.'); load(true); } catch (err) { toast(err.message); }
      };
      td.append(dl, del); tr.appendChild(td); tb.appendChild(tr);
    }
  }

  // ---------- kontrol ----------
  document.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => {
    tab = b.dataset.t;
    document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
    for (const t of ['daftar', 'final', 'arsip', 'buku', 'pesan', 'kartu']) $('t-' + t).hidden = t !== tab;
    if (tab === 'kartu') loadCards();
    if (tab === 'buku') loadBooks();
    if (tab === 'pesan') loadNotes();
  });
  $('q').oninput = renderRows; $('fLab').onchange = renderRows;
  $('openSw').onchange = async () => {
    try { const r = await post('/api/admin/open', { open: $('openSw').checked }); toast(r.open ? 'Pendaftaran dibuka.' : 'Pendaftaran ditutup.'); load(true); } catch (e) { toast(e.message); $('openSw').checked = !$('openSw').checked; }
  };
  $('savePeriod').onclick = async () => { try { await post('/api/admin/period', { period: $('period').value }); toast('Label periode disimpan.'); load(true); } catch (e) { toast(e.message); } };
  $('saveMeta').onclick = async () => { try { await post('/api/admin/final/meta', { title: $('fTitle').value, note: $('fNote').value }); toast('Judul & catatan disimpan.'); load(true); } catch (e) { toast(e.message); } };
  $('pubBtn').onclick = async () => {
    const pub = !(S.final && S.final.published);
    try {
      if (pub) await post('/api/admin/final/meta', { title: $('fTitle').value, note: $('fNote').value });
      await post('/api/admin/final/publish', { publish: pub });
      toast(pub ? '📢 Hasil final diumumkan di papan Atrium.' : 'Pengumuman ditarik.'); load(true);
    } catch (e) { toast(e.message); }
  };
  $('clearFinal').onclick = async () => {
    const b = $('clearFinal');
    if (b.dataset.arm !== '1') { b.dataset.arm = '1'; b.textContent = 'Yakin hapus?'; setTimeout(() => { b.dataset.arm = ''; b.textContent = 'Hapus data final'; }, 3000); return; }
    try { await post('/api/admin/final/clear'); toast('Data hasil final dihapus.'); load(true); } catch (e) { toast(e.message); }
  };
  async function upload(file) {
    const m = $('upMsg'); m.className = 'msg'; m.textContent = `Mengunggah ${file.name}…`;
    if (file.size > 5 * 1024 * 1024) { m.className = 'msg bad'; m.textContent = 'Berkas terlalu besar (maks. 5 MB).'; return; }
    try {
      const r = await api('/api/admin/final/upload', { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) } });
      m.className = 'msg ok';
      m.textContent = `✅ ${r.count} baris terbaca dan disimpan sebagai draf.` + (r.nErr ? `\n⚠ ${r.nErr} baris dilewati:\n• ` + r.errors.join('\n• ') : '') + '\nPeriksa pratinjau di bawah, lalu klik "Umumkan sekarang".';
      load(true);
    } catch (e) {
      m.className = 'msg bad';
      m.textContent = '❌ ' + e.message + (e.data && e.data.errors && e.data.errors.length ? '\n• ' + e.data.errors.join('\n• ') : '');
    }
    $('file').value = '';
  }
  $('file').onchange = () => { const f = $('file').files[0]; if (f) upload(f); };
  const dr = $('drop');
  dr.addEventListener('dragover', (e) => { e.preventDefault(); dr.classList.add('over'); });
  dr.addEventListener('dragleave', () => dr.classList.remove('over'));
  dr.addEventListener('drop', (e) => { e.preventDefault(); dr.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) upload(f); });
  $('archiveBtn').onclick = async () => {
    const m = $('aMsg'); m.className = 'msg';
    if ($('aConfirm').value.trim().toUpperCase() !== 'RESET') { m.className = 'msg bad'; m.textContent = 'Ketik RESET pada kolom konfirmasi.'; return; }
    try {
      await post('/api/admin/archive', { label: $('aLabel').value || ('Peminatan ' + S.period), next: $('aNext').value, open: $('aOpen').checked });
      m.className = 'msg ok'; m.textContent = '✅ Data diarsipkan dan direset. Galeri siap untuk periode baru.';
      $('aConfirm').value = ''; $('aLabel').value = ''; $('aNext').value = '';
      load(true);
    } catch (e) { m.className = 'msg bad'; m.textContent = '❌ ' + e.message; }
  };

  // ---------- Rak Buku ----------
  // pindahkan panel tambahan ke dalam #app
  for (const id of ['t-buku', 't-pesan', 't-kartu']) $('app').appendChild($(id));
  // ---------- Explorer Card ----------
  let cards = [];
  async function loadCards() {
    try { cards = (await api('/api/admin/kartu')).kartu; } catch (e) { toast(e.message); return; }
    renderCards();
  }
  function renderCards() {
    const q = $('xcQ').value.trim().toLowerCase(), tb = $('xcRows'); tb.textContent = '';
    const list = cards.filter((k) => !q || (k.no + ' ' + k.nama).toLowerCase().includes(q)).sort((a, b) => b.t - a.t);
    $('xcEmpty').hidden = list.length > 0; $('xcCount').textContent = cards.length ? cards.length + ' kartu' : '';
    for (const k of list) {
      const tr = el('tr'), td = el('td', 'nw'), b = el('button', k.cabut ? 'ghost' : 'del', k.cabut ? 'Aktifkan' : 'Cabut');
      b.onclick = async () => { try { await post('/api/admin/kartu/status', { no: k.no, cabut: !k.cabut }); toast(k.cabut ? 'Kartu diaktifkan kembali.' : 'Kartu dicabut — Nan tidak akan membuka gerbang untuknya.'); loadCards(); } catch (e) { toast(e.message); } };
      td.appendChild(b);
      tr.append(el('td', 'nw', k.no), el('td', '', k.nama), el('td', 'nw', fmt(k.t)), el('td', 'nw', k.ver ? k.ver + '× · ' + fmt(k.lv) : '-'), el('td', 'nw', k.cabut ? '⛔ dicabut' : '✅ aktif'), td);
      tb.appendChild(tr);
    }
  }
  $('xcQ').oninput = renderCards;
  const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const ST = { siap: '✅ siap', proses: '⏳ membaca…', 'tanpa-teks': '⚠ tanpa teks', gagal: '❌ gagal dibaca' };
  let books = [], bkPoll = null;
  async function loadBooks() {
    try { books = (await api('/api/admin/buku')).books; } catch (e) { toast(e.message); return; }
    const tb = $('bkRows'); tb.textContent = '';
    $('bkEmpty').hidden = books.length > 0; $('bkCount').textContent = books.length ? books.length + ' buku' : '';
    for (const b of books) {
      const tr = el('tr'), t1 = el('td'), a = el('a', '', b.judul); a.href = '#'; a.onclick = (e) => { e.preventDefault(); editBook(b); };
      t1.append(a, el('div', 'mut', [b.penulis, b.kategori].filter(Boolean).join(' · ')));
      tr.append(t1, el('td', '', b.hal ? String(b.hal) : '-'), el('td', 'nw', fmtSize(b.ukuran)), el('td', 'nw', ST[b.status] || b.status));
      const td = el('td', 'nw'), dl = el('a', 'ghost', '⬇'); dl.href = '/buku/' + b.id + '.pdf'; dl.title = 'Unduh';
      const del = el('button', 'del', 'Hapus');
      del.onclick = async () => {
        if (del.dataset.arm !== '1') { del.dataset.arm = '1'; del.textContent = 'Yakin?'; setTimeout(() => { del.dataset.arm = ''; del.textContent = 'Hapus'; }, 2500); return; }
        try { await post('/api/admin/buku/delete', { id: b.id }); toast('Buku dihapus dari rak.'); loadBooks(); } catch (err) { toast(err.message); }
      };
      td.append(dl, del); tr.appendChild(td); tb.appendChild(tr);
    }
    clearTimeout(bkPoll);
    if (books.some((b) => b.status === 'proses') && tab === 'buku') bkPoll = setTimeout(loadBooks, 3000);
  }
  let editing = null;
  function editBook(b) {
    editing = b;
    $('bkJ').value = b.judul; $('bkP').value = b.penulis || ''; $('bkK').value = b.kategori || ''; $('bkR').value = b.ringkasan || '';
    $('bkUp').textContent = '💾 Simpan perubahan'; $('bkFn').textContent = 'Mengubah data “' + b.judul + '” (file PDF tidak diganti)';
    $('bkJ').focus();
  }
  const resetForm = () => { editing = null; for (const id of ['bkJ', 'bkP', 'bkK', 'bkR']) $(id).value = ''; $('bkF').value = ''; $('bkUp').textContent = '⬆ Unggah ke rak'; $('bkFn').textContent = 'Klik atau seret file PDF ke sini'; };
  let pickedFile = null;
  $('bkF').onchange = () => { pickedFile = $('bkF').files[0] || null; if (pickedFile) $('bkFn').textContent = pickedFile.name + ' · ' + fmtSize(pickedFile.size); };
  const bd = $('bkDrop');
  bd.addEventListener('dragover', (e) => { e.preventDefault(); bd.classList.add('over'); });
  bd.addEventListener('dragleave', () => bd.classList.remove('over'));
  bd.addEventListener('drop', (e) => { e.preventDefault(); bd.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) { pickedFile = f; $('bkFn').textContent = f.name + ' · ' + fmtSize(f.size); } });
  $('bkUp').onclick = async () => {
    const m = $('bkMsg'); m.className = 'msg';
    const meta = { judul: $('bkJ').value.trim(), penulis: $('bkP').value.trim(), kategori: $('bkK').value.trim(), ringkasan: $('bkR').value.trim() };
    if (meta.judul.length < 2) { m.className = 'msg bad'; m.textContent = 'Isi judul buku.'; return; }
    try {
      if (editing) { await post('/api/admin/buku/update', { id: editing.id, ...meta }); m.className = 'msg ok'; m.textContent = '✅ Data buku diperbarui.'; resetForm(); loadBooks(); return; }
      const f = pickedFile;
      if (!f) { m.className = 'msg bad'; m.textContent = 'Pilih file PDF.'; return; }
      if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { m.className = 'msg bad'; m.textContent = 'Hanya file PDF yang diterima.'; return; }
      if (f.size > 40 * 1024 * 1024) { m.className = 'msg bad'; m.textContent = 'File terlalu besar (maks. 40 MB).'; return; }
      m.textContent = 'Mengunggah ' + f.name + '…';
      await api('/api/admin/buku/upload', { method: 'POST', body: f, headers: { 'Content-Type': 'application/pdf', 'X-Filename': encodeURIComponent(f.name), 'X-Meta': encodeURIComponent(JSON.stringify(meta)) } });
      m.className = 'msg ok'; m.textContent = '✅ Buku masuk rak. Server sedang membaca isi PDF untuk Ivy…';
      pickedFile = null; resetForm(); loadBooks();
    } catch (e) { m.className = 'msg bad'; m.textContent = '❌ ' + e.message; }
  };
  // ---------- Papan Pesan ----------
  let notes = [], ntRoom = 'lobi';
  async function loadNotes() {
    let r; try { r = await api('/api/admin/notes?room=' + encodeURIComponent(ntRoom)); } catch (e) { toast(e.message); return; }
    notes = r.notes;
    const sel = $('ntRoom'); sel.textContent = '';
    for (const k of r.rooms.length ? r.rooms : ['lobi']) { const o = el('option', '', 'Ruang: ' + k); o.value = k; if (k === r.room) o.selected = true; sel.appendChild(o); }
    renderNotes();
  }
  function renderNotes() {
    const q = $('ntQ').value.trim().toLowerCase(), tb = $('ntRows'); tb.textContent = '';
    const list = notes.filter((n) => !q || (n.n + ' ' + n.t).toLowerCase().includes(q)).slice().reverse();
    $('ntCount').textContent = notes.length + ' catatan';
    for (const n of list) {
      const tr = el('tr'), c = el('td'), cb = el('input'); cb.type = 'checkbox'; cb.value = n.id; c.appendChild(cb);
      const td = el('td'), b = el('button', 'del', 'Hapus');
      b.onclick = async () => { try { await post('/api/admin/notes/delete?room=' + encodeURIComponent(ntRoom), { id: n.id }); toast('Catatan dihapus.'); loadNotes(); } catch (e) { toast(e.message); } };
      td.appendChild(b);
      tr.append(c, el('td', 'nw', fmt(n.time)), el('td', '', n.n || '-'), el('td', 'al', n.t), td); tb.appendChild(tr);
    }
  }
  $('ntQ').oninput = renderNotes;
  $('ntRoom').onchange = () => { ntRoom = $('ntRoom').value; loadNotes(); };
  $('ntAll').onchange = () => document.querySelectorAll('#ntRows input[type=checkbox]').forEach((x) => { x.checked = $('ntAll').checked; });
  $('ntDelSel').onclick = async () => {
    const ids = [...document.querySelectorAll('#ntRows input:checked')].map((x) => x.value);
    if (!ids.length) { toast('Centang catatan yang akan dihapus.'); return; }
    const b = $('ntDelSel');
    if (b.dataset.arm !== '1') { b.dataset.arm = '1'; b.textContent = `Yakin hapus ${ids.length}?`; setTimeout(() => { b.dataset.arm = ''; b.textContent = 'Hapus yang dicentang'; }, 3000); return; }
    try { const r = await post('/api/admin/notes/delete?room=' + encodeURIComponent(ntRoom), { ids }); toast(r.deleted + ' catatan dihapus.'); $('ntAll').checked = false; loadNotes(); } catch (e) { toast(e.message); }
  };

  // mulai: coba sesi yang ada
  (async () => { try { S = await api('/api/admin/state'); $('login').hidden = true; $('app').hidden = false; render(); pollT = setInterval(() => { if (!document.hidden) load(true); }, 20000); } catch { showLogin(); } })();
})();
