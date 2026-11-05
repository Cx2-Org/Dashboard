// Đăng nhập (két token) + văn phòng 3D (Three.js) + bảng bên. Không có server: trình duyệt tự đọc GitHub.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ago = t => { if (!t) return ''; const m = Math.max(0, Math.round((Date.now() - new Date(t)) / 60000)); return m < 60 ? `${m}p` : `${Math.floor(m / 60)}g${m % 60}p`; };
const BLOB = 'dash.vault.v1', DAY = 86400e3;

// ---------- "ghi nhớ": lưu CryptoKey KHÔNG xuất được trong IndexedDB ----------
const idb = () => new Promise((ok, no) => { const r = indexedDB.open('dash', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
async function kv(op, k, v) { try { const db = await idb(); return await new Promise((ok, no) => { const tx = db.transaction('kv', op === 'get' ? 'readonly' : 'readwrite'); const s = tx.objectStore('kv'); const q = op === 'get' ? s.get(k) : op === 'put' ? s.put(v, k) : s.delete(k); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); }); } catch { return undefined; } }
const blob = () => { try { return JSON.parse(localStorage.getItem(BLOB) || 'null'); } catch { return null; } };

let token = null;
async function tryRemembered() {
  const b = blob(), m = await kv('get', 'remember');
  if (!b || !m || m.exp < Date.now()) return false;
  try { token = await Vault.openWith(b, m.key); return true; } catch { return false; }
}
function setupMode(on) { $('tokRow').hidden = !on; $('t').required = on; $('hint').textContent = on ? 'Lần đầu: đặt mật khẩu + dán token GitHub chỉ-đọc.' : 'Đăng nhập để vào văn phòng.'; $('go').textContent = on ? 'Tạo két & vào' : 'Vào văn phòng'; }
$('reset').onclick = async () => { localStorage.removeItem(BLOB); await kv('del', 'remember'); setupMode(true); };
$('logout').onclick = async () => { await kv('del', 'remember'); location.reload(); };
$('f').onsubmit = async e => {
  e.preventDefault(); $('err').textContent = ''; $('go').disabled = true;
  const u = $('u').value.trim(), p = $('p').value, rem = $('r').checked;
  try {
    let key;
    if (!blob()) { const t = $('t').value.trim(); if (!/^(github_pat_|ghp_)/.test(t)) throw new Error('Token không đúng dạng'); const s = await Vault.seal(u, t, p); localStorage.setItem(BLOB, JSON.stringify(s.blob)); token = t; key = s.key; }
    else { const o = await Vault.unlock(blob(), u, p).catch(() => { throw new Error('Sai tên đăng nhập hoặc mật khẩu'); }); token = o.token; key = o.key; }
    if (rem) await kv('put', 'remember', { key, exp: Date.now() + 30 * DAY }); else await kv('del', 'remember');
    start();
  } catch (x) { $('err').textContent = x.message; } finally { $('go').disabled = false; }
};
// #demo: dữ liệu giả để xem thử, không cần token.
const DEMO = location.hash === '#demo';
(async () => { if (DEMO || await tryRemembered()) start(); else setupMode(!blob()); })();
function demoState() {
  const t = new Date(Date.now() - 50 * 60e3).toISOString();
  return State.buildState({ runs: [{ name: 'run-cluster', display_title: 'issue-12 ubuntu-latest', status: 'in_progress', run_started_at: t },
      { name: 'run-cluster', display_title: 'issue-14 ubuntu-latest', status: 'in_progress', run_started_at: t },
      { name: 'run-cluster', display_title: 'issue-15 windows-latest', status: 'queued' }],
    open: [{ number: 12, title: 'D02 Mô hình dự án JSON + toán timeline', body: '- [x] a\n- [x] b\n- [ ] c', labels: [{ name: 'ci-run' }, { name: 'ci-running' }, { name: 'bot:ironman' }, { name: 'model:opus' }] },
      { number: 14, title: 'E05 Chuỗi dịch shader → qsb', body: '- [x] a\n- [ ] b', labels: [{ name: 'ci-run' }, { name: 'ci-running' }, { name: 'bot:spiderman' }, { name: 'model:opus' }] },
      { number: 16, title: 'D01 Hệ thiết kế QML', body: '', labels: [{ name: 'ci-run' }, { name: 'bot:queenie' }] },
      { number: 20, title: 'E02 Compositor nền', body: 'Chờ: #12', labels: [{ name: 'ci-run' }, { name: 'bot:ironman' }] }],
    lastComment: { 12: '✎ Task 2: đã code — toán timeline + speed curve', 14: '▶ Plan: 3 task — bọc GLSL 440 rồi qsb' },
    closed: [{ number: 6, title: 'D00 Khung dự án, toolchain, CI', labels: [{ name: 'bot:ironman' }], closed_at: t }],
    closedReport: { 6: 'ĐIỂM: 9/10 | TỰ TIN: 90%' } });
}

// ---------- cảnh 3D ----------
let three = null;
const COLORS = { 'Captain Queenie': 0xf6b26b, 'Iron Man': 0xe06666, 'Spider Man': 0x6fa8dc };
const LAMP = { idle: 0x666666, plan: 0x6aa8ff, code: 0x5be316, work: 0x5be316, done: 0xa666fa, stuck: 0xf08a80, restart: 0xf08a80 };
function canvasTex(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { c, g: c.getContext('2d'), t }; }
function wrap(g, text, x, y, maxW, lh, maxLines) { const words = String(text).split(' '); let line = '', n = 0; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y + n * lh); line = w; if (++n >= maxLines) return; } else line = t; } if (line && n < maxLines) g.fillText(line, x, y + n * lh); }

function build() {
  const host = $('scene'), renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101114); scene.fog = new THREE.Fog(0x101114, 18, 34);
  const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100); cam.position.set(0, 7.5, 12.5);
  const ctl = new OrbitControls(cam, renderer.domElement); ctl.target.set(0, 1.2, 0); ctl.enableDamping = true;
  ctl.maxPolarAngle = Math.PI * 0.47; ctl.minDistance = 5; ctl.maxDistance = 22;
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2018, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(5, 10, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 }); scene.add(sun);
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, ...o });
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; scene.add(b); return b; };
  // sàn gỗ + 2 tường
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), mat(0x3a2c20)); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  box(22, 6, .2, mat(0x23262c), 0, 3, -5.5); box(.2, 6, 14, mat(0x1d2025), -11, 3, 1.5);
  box(22, .05, .02, mat(0x5be316, { emissive: 0x5be316, emissiveIntensity: .6 }), 0, 5.6, -5.38); // dải đèn brand
  // bảng việc trên tường
  const board = canvasTex(1024, 512); const bm = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ map: board.t }));
  bm.position.set(-2.2, 3.3, -5.38); scene.add(bm); box(6.3, 3.3, .08, mat(0x4a3a2a), -2.2, 3.3, -5.44);
  // đồng hồ
  const clock = canvasTex(256, 128); const cm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .8), new THREE.MeshBasicMaterial({ map: clock.t })); cm.position.set(3.2, 4.4, -5.38); scene.add(cm);
  // dàn máy
  box(1.6, 3.4, 1.2, mat(0x15161a, { metalness: .4 }), 8.6, 1.7, -3.8);
  const leds = []; for (let i = 0; i < 8; i++) { const l = box(1.2, .22, .05, mat(0x111111), 8.6, .55 + i * .38, -3.18); leds.push(l); }
  // 3 bàn + 3 bot
  const desks = Object.keys(COLORS).map((name, i) => {
    const x = (i - 1) * 4.6, g = new THREE.Group(); g.position.set(x, 0, 0); scene.add(g);
    const add = (o, px, py, pz) => { o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    add(new THREE.Mesh(new THREE.BoxGeometry(3, .14, 1.5), mat(0x6b4a2f)), 0, 1.05, 0);
    for (const [lx, lz] of [[-1.35, -.6], [1.35, -.6], [-1.35, .6], [1.35, .6]]) add(new THREE.Mesh(new THREE.BoxGeometry(.1, 1, .1), mat(0x2b2b2b)), lx, .5, lz);
    const scr = canvasTex(640, 400);
    const mon = add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.2, .08), [mat(0x222222), mat(0x222222), mat(0x222222), mat(0x222222), new THREE.MeshBasicMaterial({ map: scr.t }), mat(0x222222)]), 0, 1.85, -.35);
    add(new THREE.Mesh(new THREE.BoxGeometry(.12, .5, .12), mat(0x222222)), 0, 1.3, -.4);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.2, .05, .4), mat(0x303030)), 0, 1.14, .25); // bàn phím
    add(new THREE.Mesh(new THREE.BoxGeometry(1.1, .12, 1), mat(0x24262b)), 0, .62, 1.35); // ghế
    const bot = new THREE.Group(); bot.position.set(0, 0, 1.35); g.add(bot);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.38, .6, 6, 16), mat(COLORS[name], { roughness: .5 })); body.position.y = 1.2; body.castShadow = true; bot.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.34, 24, 16), mat(0xf1d3b3, { roughness: .6 })); head.position.y = 1.95; head.castShadow = true; bot.add(head);
    for (const ex of [-.12, .12]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 8), mat(0x111111)); e.position.set(ex, 2, -.3); bot.add(e); }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 12), new THREE.MeshStandardMaterial({ color: 0x666666, emissive: 0x666666, emissiveIntensity: .8 })); lamp.position.set(1.25, 1.22, -.5); g.add(lamp);
    const bub = canvasTex(512, 160); const bs = new THREE.Sprite(new THREE.SpriteMaterial({ map: bub.t, depthTest: false })); bs.scale.set(2.4, .75, 1); bs.position.set(0, 2.95, 1.35); g.add(bs);
    const tag = canvasTex(512, 96); const ts = new THREE.Sprite(new THREE.SpriteMaterial({ map: tag.t, depthTest: false })); ts.scale.set(2, .38, 1); ts.position.set(0, .2, 2.4); g.add(ts);
    tag.g.fillStyle = 'rgba(0,0,0,.55)'; tag.g.fillRect(0, 0, 512, 96); tag.g.fillStyle = '#fff'; tag.g.font = '700 46px system-ui'; tag.g.textAlign = 'center'; tag.g.fillText(name, 256, 64); tag.t.needsUpdate = true;
    return { name, scr, mon, bot, head, lamp, bub, url: null, busy: false };
  });
  const resize = () => { const r = host.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(host); resize();
  // bấm màn hình → mở issue
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  renderer.domElement.addEventListener('click', e => { const r = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, cam); const hit = ray.intersectObjects(desks.map(d => d.mon))[0]; const d = hit && desks.find(x => x.mon === hit.object); if (d && d.url) window.open(d.url, '_blank', 'noopener'); });
  const clk = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = clk.getElapsedTime();
    desks.forEach((d, i) => { d.bot.position.y = d.busy ? Math.abs(Math.sin(t * 3 + i)) * .06 : 0; d.head.rotation.y = d.busy ? Math.sin(t * 1.5 + i) * .15 : .5; });
    leds.forEach((l, i) => { if (l.userData.on) l.material.emissiveIntensity = .6 + .6 * (Math.sin(t * 6 + i * 1.7) > 0); });
    ctl.update(); renderer.render(scene, cam);
  });
  setInterval(() => { const g = clock.g; g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#cfd3da'; g.font = '600 64px ui-monospace,Menlo,monospace'; g.textAlign = 'center'; g.fillText(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), 128, 86); clock.t.needsUpdate = true; }, 1000);
  return { desks, board, leds };
}

function paint(s) {
  const { desks, board, leds } = three;
  s.bots.forEach(b => {
    const d = desks.find(x => x.name === b.name), j = b.jobs[0], g = d.scr.g;
    d.busy = !!j; d.url = j ? j.url : null;
    g.fillStyle = '#0a0c0e'; g.fillRect(0, 0, 640, 400);
    if (j) {
      const pct = j.progress.total ? j.progress.done / j.progress.total : 0;
      g.fillStyle = '#5BE316'; g.font = '700 40px system-ui'; g.fillText(`#${j.number}`, 28, 60);
      g.fillStyle = '#e8ffe0'; g.font = '600 32px system-ui'; wrap(g, j.title, 28, 110, 584, 40, 3);
      g.fillStyle = '#8a8a94'; g.font = '24px system-ui'; wrap(g, j.note || '', 28, 250, 584, 30, 2);
      g.fillStyle = '#22252b'; g.fillRect(28, 330, 584, 18); g.fillStyle = '#5BE316'; g.fillRect(28, 330, 584 * pct, 18);
      g.fillStyle = '#cfd3da'; g.font = '22px system-ui'; g.fillText(`${j.progress.done}/${j.progress.total} task · ${j.model || ''}${j.machine ? ' · ' + j.machine.os : ''}`, 28, 382);
    } else { g.fillStyle = '#3a3d44'; g.font = '600 40px system-ui'; g.textAlign = 'center'; g.fillText('Chưa có việc', 320, 215); g.textAlign = 'left'; }
    d.scr.t.needsUpdate = true;
    const c = LAMP[b.state] ?? 0x5be316; d.lamp.material.color.setHex(c); d.lamp.material.emissive.setHex(c);
    const bg = d.bub.g; bg.clearRect(0, 0, 512, 160); bg.fillStyle = '#fff'; bg.beginPath(); bg.roundRect(8, 8, 496, 112, 28); bg.fill();
    bg.beginPath(); bg.moveTo(236, 118); bg.lineTo(256, 150); bg.lineTo(276, 118); bg.fill();
    bg.fillStyle = '#111'; bg.font = '700 44px system-ui'; bg.textAlign = 'center'; bg.fillText(j ? j.phase.text : 'Đang rảnh', 256, 80); d.bub.t.needsUpdate = true;
  });
  const g = board.g; g.fillStyle = '#0f1a12'; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = '#cfe9c4'; g.font = '700 40px system-ui'; g.fillText('BẢNG VIỆC', 36, 62);
  [[s.machines.length, 'máy chạy'], [s.queue.ready, 'sẵn sàng'], [s.queue.blocked, 'chờ việc khác']].forEach(([n, l], i) => { g.fillStyle = '#fff'; g.font = '700 64px system-ui'; g.fillText(n, 36 + i * 300, 150); g.fillStyle = '#9db897'; g.font = '26px system-ui'; g.fillText(l, 36 + i * 300, 186); });
  g.fillStyle = '#d7ecd0'; g.font = '28px system-ui';
  (s.queue.next.length ? s.queue.next.slice(0, 7) : [{ number: '', title: 'Trống — giao thêm bằng /giao', bot: '' }]).forEach((it, i) => wrap(g, `${it.number ? '#' + it.number + ' ' : ''}${it.title}${it.bot ? ' — ' + it.bot : ''}`, 36, 240 + i * 38, 950, 38, 1));
  board.t.needsUpdate = true;
  leds.forEach((l, i) => { const m = s.machines[i]; l.userData.on = !!m; l.material.color.setHex(m ? (m.status === 'queued' ? 0xf0b54a : 0x5be316) : 0x111111); l.material.emissive = new THREE.Color(m ? (m.status === 'queued' ? 0xf0b54a : 0x5be316) : 0); l.material.emissiveIntensity = m ? 1 : 0; });
  // bảng bên
  $('staff').innerHTML = s.bots.map(b => { const j = b.jobs[0]; const p = j && j.progress.total ? Math.round(j.progress.done / j.progress.total * 100) : 0;
    return `<div class="card"><b>${esc(b.name)}</b><span class="s">${j ? `<a href="${esc(j.url)}" target="_blank" rel="noopener">#${j.number} ${esc(j.title)}</a> · ${esc(j.phase.text)}` : 'Đang rảnh'}</span>${j ? `<div class="bar"><i style="width:${p}%"></i></div>` : ''}</div>`; }).join('');
  $('queue').innerHTML = `<b>${s.machines.length} máy chạy · ${s.queue.ready} sẵn sàng · ${s.queue.blocked} chờ</b>` + s.machines.map(m => `<div class="s">#${m.issue ?? '?'} · ${esc(m.os)} · ${m.status === 'queued' ? 'xếp hàng' : ago(m.startedAt)}</div>`).join('');
  $('done').innerHTML = s.done.map(d => `<tr><td><a href="${esc(d.url)}" target="_blank" rel="noopener" style="color:inherit">#${d.number}</a> ${esc(d.title)}<div class="s" style="color:var(--muted)">${esc(d.bot)} · ${ago(d.closedAt)} trước</div></td><td class="${d.score >= 8 ? 'hi' : d.score >= 6 ? 'mid' : 'lo'}">${d.score != null ? d.score + '/10' : '–'}</td><td>${d.confidence != null ? d.confidence + '%' : ''}</td></tr>`).join('') || '<tr><td>Chưa có</td></tr>';
}

async function refresh() {
  try { const s = DEMO ? demoState() : await Data.load(token); paint(s); $('live').className = 'dot'; $('upd').textContent = 'cập nhật ' + new Date().toLocaleTimeString('vi-VN'); }
  catch (e) { $('live').className = 'dot off'; $('upd').textContent = e.message; if (e.auth) { await kv('del', 'remember'); setTimeout(() => location.reload(), 2500); } }
}
function start() { $('gate').style.display = 'none'; $('app').style.display = 'grid'; three = three || build(); refresh(); setInterval(refresh, 15000); }
