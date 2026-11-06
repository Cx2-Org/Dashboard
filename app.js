// Tàu Sunny 3D (Three.js) + bảng bên. Không server, không đăng nhập: đọc status.json công khai do runner ghi.
// Thuyền trưởng Luffy = owner. 3 sếp = 3 tài khoản Claude. Băng Mũ Rơm = sub-agent (mỗi việc đang chạy 1 người, mỗi người 1 phòng).
// Thuyền con kéo sau đuôi = máy runner. Thùng hàng = việc chờ. Rương vàng = chi phí 24h. Pháo hoa = vừa xong việc.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ago = t => { if (!t) return ''; const m = Math.max(0, Math.round((Date.now() - new Date(t)) / 60000)); return m < 60 ? `${m}p` : `${Math.floor(m / 60)}g${m % 60}p`; };
const STATUS = 'https://raw.githubusercontent.com/Cx2-Org/Runner/status/status.json';
const DEMO = location.hash === '#demo';
const BOSS = { 'Captain Queenie': { short: 'Queenie', color: '#f6b26b', title: 'Vợ kiêm sếp' }, 'Iron Man': { short: 'Iron Man', color: '#e06666', title: 'Sếp' }, 'Spider Man': { short: 'Spider-Man', color: '#6fa8dc', title: 'Sếp' } };

let three = null;
function canvasTex(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, g: c.getContext('2d'), t }; }
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .75, ...o });
const glow = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4 });
function mesh(geo, m, x = 0, y = 0, z = 0, parent) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent && parent.add(o); return o; }

// Nhãn nổi: 2 dòng, viền màu theo sếp.
function label(w = 2.2) {
  const L = canvasTex(512, 128), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: L.t, depthTest: false, transparent: true }));
  sp.scale.set(w, w / 4, 1); sp.renderOrder = 10;
  sp.set = (a, b = '', color = '#5BE316', dim = false) => {
    const g = L.g; g.clearRect(0, 0, 512, 128); g.globalAlpha = dim ? .6 : 1;
    g.fillStyle = 'rgba(10,14,20,.78)'; g.beginPath(); g.roundRect(4, 4, 504, 120, 24); g.fill();
    g.fillStyle = color; g.fillRect(4, 24, 10, 80);
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '700 44px system-ui'; g.fillText(a, 262, 56, 470);
    g.fillStyle = '#cfd6df'; g.font = '32px system-ui'; g.fillText(b, 262, 100, 470); L.t.needsUpdate = true;
  };
  return sp;
}

// ---------- người chibi kiểu anime (mặt nhìn +z, chân ở y=0, đầu to) ----------
const H = 1.1, R = .27; // tâm đầu, bán kính đầu
const up = new THREE.Vector3(0, 1, 0);
function person(o) {
  const g = new THREE.Group(), skin = o.skin ?? 0xf1c9a5;
  for (const x of [-.09, .09]) mesh(new THREE.CylinderGeometry(.065, .06, .42, 10), mat(o.legs ?? o.pants ?? 0x333333), x, .21, 0, g);
  for (const x of [-.09, .09]) mesh(new THREE.BoxGeometry(.11, .06, .18), mat(o.shoes ?? 0x3e2723), x, .03, .03, g);
  mesh(new THREE.CapsuleGeometry(.18, .24, 4, 12), mat(o.shirt ?? 0xffffff), 0, .62, 0, g);
  if (o.pants) mesh(new THREE.CylinderGeometry(.19, .2, .16, 12), mat(o.pants), 0, .44, 0, g);
  const arms = [-1, 1].map(s => { const a = mesh(new THREE.CylinderGeometry(.055, .05, .4, 8), mat(o.arms ?? o.shirt ?? skin), s * .25, .62, 0, g); a.rotation.z = s * .3; return a; });
  const head = mesh(new THREE.SphereGeometry(R, 24, 18), mat(o.head ?? skin), 0, H, 0, g);
  if (o.eyes !== false) for (const s of [-1, 1]) {
    if ((s < 0 && o.eyeL === false) || (s > 0 && o.eyeR === false)) { mesh(new THREE.BoxGeometry(.012, .13, .01), mat(0x5d1a1a), s * .095, H + .02, R - .005, g); continue; }
    const w = mesh(new THREE.SphereGeometry(.068, 12, 10), mat(o.eyeWhite ?? 0xffffff), s * .095, H + .02, R - .045, g); w.scale.set(.85, 1.15, .45);
    mesh(new THREE.SphereGeometry(.036, 10, 8), mat(o.eyeColor ?? 0x111111), s * .095, H + .01, R - .01, g);
  }
  if (o.mouth !== false) mesh(new THREE.BoxGeometry(o.grin ? .16 : .07, o.grin ? .04 : .015, .01), mat(o.grin ? 0xffffff : 0x7a2b2b), 0, H - .13, R - .025, g);
  if (o.hair != null) { const h = mesh(new THREE.SphereGeometry(R + .02, 20, 12, 0, Math.PI * 2, 0, Math.PI * (o.hairCap ?? .45)), mat(o.hair), 0, H + .01, -.015, g); h.rotation.x = -.18; }
  g.userData = { head, arms };
  o.extra && o.extra(g);
  if (o.scale) g.scale.setScalar(o.scale);
  return g;
}
// tóc chĩa: n mũi nhọn quanh đỉnh đầu
function spikes(g, c, n = 9, len = .2, elev = .9) { for (let i = 0; i < n; i++) { const th = i / n * Math.PI * 2, dir = new THREE.Vector3(Math.sin(elev) * Math.cos(th), Math.cos(elev), Math.sin(elev) * Math.sin(th) - .25).normalize();
  const k = mesh(new THREE.ConeGeometry(.07, len, 6), mat(c), dir.x * R, H + dir.y * R, dir.z * R, g); k.quaternion.setFromUnitVectors(up, dir); } }
const hatStraw = g => { mesh(new THREE.CylinderGeometry(.52, .52, .03, 28), mat(0xe9c46a), 0, H + .17, 0, g); mesh(new THREE.CylinderGeometry(.26, .29, .2, 22), mat(0xe9c46a), 0, H + .28, 0, g); mesh(new THREE.CylinderGeometry(.295, .295, .065, 22), mat(0xc0392b), 0, H + .22, 0, g); };
const longHair = (c, len = .62) => g => mesh(new THREE.BoxGeometry(.5, len, .12), mat(c), 0, H - .2 - (len - .62) / 2, -.2, g);
const skirt = c => g => mesh(new THREE.ConeGeometry(.34, .5, 16, 1, true), mat(c, { side: THREE.DoubleSide }), 0, .38, 0, g);

const CREW = [
  { name: 'Zoro', room: '🏋️ Tháp canh', o: { shirt: 0xf2f2f2, pants: 0x1b1b1b, shoes: 0x111111, hair: 0x43a047, hairCap: .32, eyeL: false, extra: g => {
    spikes(g, 0x43a047, 11, .12, .75);
    mesh(new THREE.CylinderGeometry(.2, .2, .13, 14), mat(0x2e7d32), 0, .5, 0, g);                                       // haramaki
    for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(.018, 6, 6), mat(0xffc107, { metalness: .8 }), -R - .005, H - .06 - i * .04, -.02, g); // 3 khuyên tai
    mesh(new THREE.CylinderGeometry(.065, .065, .08, 8), mat(0x111111), -.29, .66, 0, g);                                // khăn đen buộc tay
    [0xffffff, 0x111111, 0xb71c1c].forEach((c, i) => { const s = mesh(new THREE.BoxGeometry(.035, .75, .035), mat(0x9aa0a6, { metalness: .8, roughness: .3 }), .24, .45, -.06 + i * .06, g); s.rotation.z = .9; mesh(new THREE.BoxGeometry(.05, .18, .05), mat(c), .52, .64, -.06 + i * .06, g).rotation.z = .9; }); } } },
  { name: 'Sanji', room: '🍳 Bếp', o: { shirt: 0x1d1d22, pants: 0x1d1d22, shoes: 0x111111, hair: 0xf5d76e, eyeL: false, extra: g => {
    mesh(new THREE.SphereGeometry(.15, 12, 10), mat(0xf5d76e), -.1, H + .04, R - .1, g).scale.set(1, 1.3, .6);         // mái che mắt trái
    mesh(new THREE.TorusGeometry(.03, .008, 6, 12), mat(0x8d6e00), .1, H + .11, R - .01, g);                               // lông mày xoắn
    mesh(new THREE.BoxGeometry(.12, .2, .02), mat(0x1e88e5), 0, .7, .18, g); mesh(new THREE.BoxGeometry(.04, .16, .02), mat(0x111111), 0, .68, .195, g); // sơ mi xanh + cà vạt
    mesh(new THREE.CylinderGeometry(.012, .012, .16, 6), mat(0xffffff), .07, H - .13, R + .05, g).rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(.016, 6, 6), glow(0xff7043), .07, H - .13, R + .13, g);
    for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(.04 + i * .02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: .45 - i * .1 }), .16 + i * .04, H + .05 + i * .14, R + .1, g); } } },
  { name: 'Nami', room: '🗺 Hải đồ', o: { shirt: 0x8fc3f0, pants: 0x2d4f8a, shoes: 0xc58b3c, hair: 0xf28b2c, eyeColor: 0x6d3b0b, extra: g => {
    longHair(0xf28b2c, .8)(g); mesh(new THREE.CylinderGeometry(.022, .022, 1, 8), mat(0x1e88e5, { metalness: .5 }), .32, .55, .12, g); } } },
  { name: 'Usopp', room: '🎯 Kho súng', o: { skin: 0x8d5a3b, shirt: 0xd7b98e, pants: 0x6d5a3b, hair: 0x111111, hairCap: .55, grin: true, extra: g => {
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; mesh(new THREE.SphereGeometry(.09, 8, 6), mat(0x111111), Math.cos(a) * (R + .03), H + .02 + Math.abs(Math.sin(a)) * .05, Math.sin(a) * (R + .03) - .04, g); }
    mesh(new THREE.ConeGeometry(.045, .48, 8), mat(0x8d5a3b), 0, H - .03, R + .22, g).rotation.x = Math.PI / 2;             // mũi dài
    for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(.07, .07, .05, 12), mat(0xffc107, { metalness: .6 }), s * .1, H + .2, R - .06, g).rotation.x = 1.2; // kính bảo hộ
    mesh(new THREE.BoxGeometry(.38, .05, .02), mat(0x7b5b3a), 0, H + .2, R - .1, g); } } },
  { name: 'Franky', room: '🔧 Xưởng', o: { shirt: 0xe63946, pants: 0x1565c0, legs: 0xf1c9a5, hair: 0x29b6f6, hairCap: .3, scale: 1.12, extra: g => {
    const pomp = mesh(new THREE.BoxGeometry(.26, .2, .4), mat(0x29b6f6), 0, H + .26, .08, g); pomp.rotation.x = -.5;      // tóc vuốt dựng
    mesh(new THREE.BoxGeometry(.32, .08, .04), mat(0x111111, { metalness: .6 }), 0, H + .03, R - .01, g);               // kính đen
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(.02, 6, 6), mat(0xffffff), s * .1 + .04, .7, .19, g);         // hoa áo
    g.userData.arms.forEach(a => a.scale.set(2.2, 1, 2.2)); for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(.03, .03, .01, 5), mat(0x1565c0), s * .31, .52, .1, g); } } },
  { name: 'Chopper', room: '🩺 Phòng y tế', o: { scale: .7, skin: 0x8b5a2b, shirt: 0x8b5a2b, pants: 0x1e88e5, legs: 0x8b5a2b, hair: null, mouth: false, extra: g => {
    mesh(new THREE.SphereGeometry(.05, 8, 6), mat(0x1e88e5), 0, H - .07, R, g);                                          // mũi xanh
    mesh(new THREE.CylinderGeometry(.38, .38, .03, 22), mat(0xf48fb1), 0, H + .2, 0, g); const hat = mesh(new THREE.CylinderGeometry(.25, .26, .38, 22), mat(0xf48fb1), 0, H + .4, 0, g); hat.rotation.x = -.15;
    [1, -1].forEach(s => { mesh(new THREE.BoxGeometry(.2, .04, .01), mat(0xffffff), 0, H + .4, .26, g).rotation.z = s * .78;
      const ant = mesh(new THREE.CylinderGeometry(.022, .03, .3, 6), mat(0x6d4c2b), s * .3, H + .32, 0, g); ant.rotation.z = -s * 1.0;
      mesh(new THREE.CylinderGeometry(.015, .02, .14, 6), mat(0x6d4c2b), s * .38, H + .44, 0, g); }); } } },
  { name: 'Robin', room: '📚 Thư viện', o: { shirt: 0x6a3d9a, pants: 0x3a2a4a, shoes: 0x111111, hair: 0x14142a, eyeColor: 0x1a237e, extra: g => {
    longHair(0x14142a, .85)(g); skirt(0x6a3d9a)(g); mesh(new THREE.BoxGeometry(.42, .08, .1), mat(0x14142a), 0, H + .17, R - .1, g); // tóc mái
    for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(.06, .06, .02, 12), mat(0x222222), s * .1, H + .26, R - .12, g).rotation.x = 1.2; } } }, // kính râm cài đầu
  { name: 'Brook', room: '🎻 Phòng nhạc', o: { skin: 0xf5f5ef, shirt: 0x1b1b1f, pants: 0x1b1b1f, shoes: 0x111111, eyeWhite: 0x111111, eyeColor: 0x111111, hair: null, mouth: false, extra: g => {
    mesh(new THREE.BoxGeometry(.16, .05, .01), mat(0xffffff), 0, H - .14, R - .02, g); for (let i = -2; i <= 2; i++) mesh(new THREE.BoxGeometry(.005, .05, .012), mat(0x333333), i * .03, H - .14, R - .01, g); // răng
    mesh(new THREE.SphereGeometry(.42, 18, 14), mat(0x111111), 0, H + .12, -.07, g);                                     // afro
    mesh(new THREE.CylinderGeometry(.19, .19, .34, 18), mat(0x111111), 0, H + .62, 0, g); mesh(new THREE.CylinderGeometry(.3, .3, .02, 18), mat(0x111111), 0, H + .46, 0, g);
    mesh(new THREE.BoxGeometry(.16, .04, .02), mat(0xffffff), 0, .86, .17, g); mesh(new THREE.CylinderGeometry(.015, .015, 1, 6), mat(0x5d4037), .34, .45, .1, g); } } },
  { name: 'Jinbe', room: '☸️ Bánh lái', o: { skin: 0x4f83cc, shirt: 0xe07b39, pants: 0xe07b39, legs: 0x4f83cc, hair: 0x111111, hairCap: .3, scale: 1.25, extra: g => {
    skirt(0xe07b39)(g); mesh(new THREE.CylinderGeometry(.1, .12, .12, 12), mat(0x111111), 0, H + .3, -.05, g);           // búi tóc
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(.035, 8, 6), mat(0xe8eef7), s * .06, H - .13, R - .01, g);   // môi cá
    mesh(new THREE.TorusGeometry(.2, .02, 6, 16), mat(0x3e2723), 0, .44, 0, g).rotation.x = Math.PI / 2; } } },
];
// Chỗ của từng người trên tàu (toạ độ trong group tàu, boong ở y=1).
const SPOT = { Zoro: [.5, 7.35, 0], Sanji: [-1.6, 1, 1.1], Nami: [-1.6, 1, -1.1], Usopp: [4.2, 1, -.9], Franky: [4.2, 1, .9], Chopper: [2.7, 1, 1.15], Robin: [2.7, 1, -1.15], Brook: [-3.9, 2.6, .8], Jinbe: [-2.75, 2.6, 0] };

function build() {
  const host = $('scene'), renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x8ec9ff, 40, 140);
  const cam = new THREE.PerspectiveCamera(45, 1, .1, 300); cam.position.set(18, 14, 24);
  const ctl = new OrbitControls(cam, renderer.domElement); ctl.target.set(0, 5, 0); ctl.enableDamping = true;
  { const c = new URLSearchParams(location.search).get('cam'); if (c) { const v = c.split(',').map(Number); cam.position.set(v[0], v[1], v[2]); ctl.target.set(v[3], v[4], v[5]); } } // ?cam=x,y,z,tx,ty,tz để chụp cận
  ctl.maxPolarAngle = Math.PI * .49; ctl.minDistance = 6; ctl.maxDistance = 70;
  const hemi = new THREE.HemisphereLight(0xdfefff, 0x1d3b52, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(12, 20, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24 }); scene.add(sun);

  // biển
  const seaGeo = new THREE.PlaneGeometry(220, 220, 110, 110); seaGeo.rotateX(-Math.PI / 2);
  const seaPos = seaGeo.attributes.position, base = Float32Array.from(seaPos.array);
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: 0x1e88c7, roughness: .35, metalness: .1, flatShading: true })); sea.receiveShadow = true; scene.add(sea);

  // tàu
  const SHIP = 1.7; // tàu to gấp 1.7 (mọi thứ trên boong to theo)
  const ship = new THREE.Group(); ship.scale.setScalar(SHIP); scene.add(ship);
  const hullShape = new THREE.Shape(); hullShape.moveTo(-4.7, -1.65); hullShape.lineTo(2.6, -1.85); hullShape.quadraticCurveTo(5.1, -1.3, 6, 0); hullShape.quadraticCurveTo(5.1, 1.3, 2.6, 1.85); hullShape.lineTo(-4.7, 1.65); hullShape.quadraticCurveTo(-5.5, 0, -4.7, -1.65);
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 1.95, bevelEnabled: true, bevelThickness: .15, bevelSize: .12, bevelSegments: 3 }); hullGeo.rotateX(-Math.PI / 2);
  mesh(hullGeo, mat(0xd99a3e), 0, -.7, 0, ship);
  const deckGeo = new THREE.ShapeGeometry(hullShape); deckGeo.rotateX(-Math.PI / 2); const deck = mesh(deckGeo, mat(0x6dbf4b), 0, 1, 0, ship); deck.scale.set(.95, 1, .9);
  // đầu sư tử
  const lion = new THREE.Group(); lion.position.set(6.1, 2, 0); ship.add(lion);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, p = mesh(new THREE.ConeGeometry(.28, .7, 6), mat(0xe8742a), 0, Math.sin(a) * .75, Math.cos(a) * .75, lion); p.rotation.x = a; }
  mesh(new THREE.SphereGeometry(.72, 24, 18), mat(0xf6d04d), 0, 0, 0, lion);
  for (const z of [-.25, .25]) mesh(new THREE.SphereGeometry(.09, 8, 8), mat(0x111111), .62, .18, z, lion);
  mesh(new THREE.SphereGeometry(.12, 8, 8), mat(0x8d4b1f), .72, -.05, 0, lion);
  // cột buồm, buồm, cờ, tháp canh
  mesh(new THREE.CylinderGeometry(.16, .22, 8, 12), mat(0x8d5a2b), .5, 5, 0, ship);
  mesh(new THREE.CylinderGeometry(.06, .06, 4.2, 8), mat(0x8d5a2b), .5, 6.2, 0, ship).rotation.x = Math.PI / 2;
  const sailGeo = new THREE.PlaneGeometry(4, 2.8, 12, 6); { const p = sailGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, .45 * Math.cos(p.getX(i) / 2 * Math.PI / 2)); sailGeo.computeVertexNormals(); }
  const sail = mesh(sailGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: .9 }), .75, 4.7, 0, ship); sail.rotation.y = Math.PI / 2;
  const flagT = canvasTex(256, 160); { const g = flagT.g; g.fillStyle = '#111'; g.fillRect(0, 0, 256, 160); g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 86, 34, 0, 7); g.fill(); g.fillRect(108, 106, 40, 22);
    g.strokeStyle = '#fff'; g.lineWidth = 12; g.beginPath(); g.moveTo(70, 50); g.lineTo(186, 140); g.moveTo(186, 50); g.lineTo(70, 140); g.stroke(); g.fillStyle = '#111'; g.beginPath(); g.arc(116, 84, 8, 0, 7); g.arc(140, 84, 8, 0, 7); g.fill();
    g.fillStyle = '#e9c46a'; g.beginPath(); g.ellipse(128, 58, 58, 10, 0, 0, 7); g.fill(); g.fillRect(100, 32, 56, 26); g.fillStyle = '#c0392b'; g.fillRect(100, 48, 56, 9); flagT.t.needsUpdate = true; }
  const flag = mesh(new THREE.PlaneGeometry(1.4, .88, 8, 1), new THREE.MeshStandardMaterial({ map: flagT.t, side: THREE.DoubleSide }), 1.25, 8.6, 0, ship);
  mesh(new THREE.CylinderGeometry(.75, .65, .5, 16, 1, true), mat(0x8d5a2b, { side: THREE.DoubleSide }), .5, 7.3, 0, ship);
  mesh(new THREE.CylinderGeometry(.7, .7, .06, 16), mat(0x6d4520), .5, 7.08, 0, ship);
  // cabin đuôi + boong lái + bánh lái
  mesh(new THREE.BoxGeometry(2.3, 1.6, 3.1), mat(0xfaf3e0), -3.65, 1.8, 0, ship); mesh(new THREE.BoxGeometry(2.5, .1, 3.3), mat(0x8d5a2b), -3.65, 2.6, 0, ship);
  for (const z of [-.7, .7]) mesh(new THREE.CircleGeometry(.22, 16), mat(0x7ec8e3), -2.49, 1.9, z, ship).rotation.y = Math.PI / 2;
  const wheel = mesh(new THREE.TorusGeometry(.38, .05, 8, 20), mat(0x6d4520), -2.55, 3.15, 0, ship); wheel.rotation.y = Math.PI / 2;
  // đồ đạc các phòng
  mesh(new THREE.BoxGeometry(.6, .5, .5), mat(0x555555, { metalness: .6 }), -1.6, 1.25, 1.55, ship);             // bếp
  mesh(new THREE.BoxGeometry(.8, .06, .6), mat(0xf5e6c8), -1.6, 1.55, -1.45, ship);                               // bàn hải đồ
  mesh(new THREE.BoxGeometry(.9, 1, .25), mat(0x6d4520), 2.7, 1.5, -1.6, ship);                                  // giá sách
  mesh(new THREE.BoxGeometry(.6, .5, .4), mat(0xffffff), 2.7, 1.25, 1.6, ship);                                   // tủ thuốc
  mesh(new THREE.BoxGeometry(.6, .4, .5), mat(0x37474f, { metalness: .5 }), 4.4, 1.2, 1.4, ship);               // xưởng
  // rương vàng (chi phí)
  const chest = new THREE.Group(); chest.position.set(-4.35, 2.65, 0); ship.add(chest);
  mesh(new THREE.BoxGeometry(.6, .35, .4), mat(0x6d4520), 0, .18, 0, chest); const gold = mesh(new THREE.SphereGeometry(.25, 12, 8, 0, 7, 0, 1.6), mat(0xffc107, { metalness: .8, roughness: .25 }), 0, .35, 0, chest);
  const chestLbl = label(1.4); chestLbl.position.set(0, 1, 0); chest.add(chestLbl);

  // thuyền viên = sub-agent
  const crew = CREW.map(c => { const g = person(c.o); const [x, y, z] = SPOT[c.name]; g.position.set(x, y, z); g.rotation.y = x > 3 ? Math.PI / 2 : z > 0 ? 0 : z < 0 ? Math.PI : -Math.PI / 2; ship.add(g);
    const lb = label(2.3); lb.position.set(x, y + 2.1, z); ship.add(lb); return { ...c, g, lb, jobs: [] }; });
  crew.find(c => c.name === 'Zoro').g.rotation.y = 0;
  // thuyền trưởng Luffy (owner) ngồi trên đầu sư tử
  const luffy = person({ shirt: 0xf1c9a5, pants: 0x3d6fb6, legs: 0xf1c9a5, shoes: 0xc58b3c, hair: 0x111111, hairCap: .4, grin: true, extra: g => { spikes(g, 0x111111, 10, .14, 1.0); hatStraw(g);
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.13, .34, .37), mat(0xd62f2f), s * .12, .66, 0, g);                 // áo gile đỏ mở
    mesh(new THREE.CylinderGeometry(.2, .2, .08, 14), mat(0xf6c344), 0, .5, 0, g);                                        // đai vàng
    mesh(new THREE.BoxGeometry(.06, .012, .01), mat(0x7a2b2b), -.1, H - .07, R - .02, g); } });                         // sẹo dưới mắt luffy.position.set(6.1, 2.65, 0); luffy.rotation.y = Math.PI / 2; ship.add(luffy);
  const luffyLb = label(2.2); luffyLb.position.set(6.1, 4.6, 0); ship.add(luffyLb); luffyLb.set('👒 Thuyền trưởng Luffy', 'Percy · giám đốc CutCut', '#e9c46a');
  // 3 sếp
  const queenie = person({ shirt: 0xb3202a, pants: 0xb3202a, legs: 0x222222, hair: 0x5a3825, extra: g => {
    longHair(0x5a3825)(g); mesh(new THREE.ConeGeometry(.33, .45, 16, 1, true), mat(0xb3202a, { side: THREE.DoubleSide }), 0, .4, 0, g);
    const hat = mesh(new THREE.CylinderGeometry(.08, .08, .7, 3), mat(0x151515), 0, H + .3, 0, g); hat.rotation.z = Math.PI / 2; hat.scale.set(1, 1, 2.6);
    mesh(new THREE.SphereGeometry(.05, 8, 6), mat(0xffffff), 0, H + .32, .16, g); for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.14, .04, .12), mat(0xffc107, { metalness: .7 }), s * .2, .83, 0, g); } });
  queenie.position.set(-3.9, 2.65, -.75); queenie.rotation.y = Math.PI / 2; queenie.scale.setScalar(1.1); ship.add(queenie);
  const iron = person({ skin: 0xb3151b, shirt: 0xb3151b, pants: 0xb3151b, legs: 0xb3151b, arms: 0xb3151b, eyes: false, hair: null, extra: g => {
    const face = mesh(new THREE.SphereGeometry(R * .82, 16, 12), mat(0xe0b13a, { metalness: .8, roughness: .3 }), 0, H - .02, R * .5, g); face.scale.set(1, 1.1, .55);
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(.12, 12, 10), mat(0xb3151b, { metalness: .6, roughness: .35 }), s * .27, .82, 0, g);
    for (const x of [-.08, .08]) mesh(new THREE.BoxGeometry(.08, .025, .02), glow(0xe0ffff), x, H + .03, R + .01, g);
    mesh(new THREE.CircleGeometry(.06, 16), glow(0x7df9ff), 0, .7, .19, g);
    for (const x of [-.09, .09]) mesh(new THREE.ConeGeometry(.06, .3, 8), new THREE.MeshBasicMaterial({ color: 0x9ff6ff, transparent: true, opacity: .8 }), x, -.15, 0, g).rotation.x = Math.PI; } });
  iron.scale.setScalar(1.25); scene.add(iron);
  const webT = canvasTex(256, 128); { const g = webT.g; g.fillStyle = '#c62828'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#222'; g.lineWidth = 2; for (let i = 0; i < 16; i++) { g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(i / 8 * Math.PI) * 200, 64 + Math.sin(i / 8 * Math.PI) * 200); g.stroke(); } for (let r = 12; r < 200; r += 16) { g.beginPath(); g.arc(64, 64, r, 0, 7); g.stroke(); } webT.t.needsUpdate = true; }
  const spidey = person({ head: 0xc62828, skin: 0xc62828, shirt: 0xc62828, pants: 0x1f4fb3, legs: 0x1f4fb3, arms: 0xc62828, eyes: false, hair: null, extra: g => {
    g.userData.head.material = new THREE.MeshStandardMaterial({ map: webT.t, roughness: .6 });
    for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(.07, 12, 8), mat(0xffffff), s * .1, H + .03, R - .04, g); e.scale.set(1.1, 1.5, .4); e.rotation.z = s * .5; const o = mesh(new THREE.SphereGeometry(.082, 12, 8), mat(0x111111), s * .1, H + .03, R - .055, g); o.scale.set(1.1, 1.5, .4); o.rotation.z = s * .5; }
    mesh(new THREE.SphereGeometry(.05, 8, 6), mat(0x111111), 0, .72, .19, g); } });
  const spiderRig = new THREE.Group(); spiderRig.position.set(.5, 6.2, 1.9); ship.add(spiderRig);
  spidey.rotation.x = Math.PI; spidey.position.y = -.4; spiderRig.add(spidey); spidey.scale.setScalar(1.1);
  mesh(new THREE.CylinderGeometry(.008, .008, .5, 4), mat(0xffffff), 0, -.2, 0, spiderRig);
  const bossLb = {}; for (const n of ['Captain Queenie', 'Iron Man', 'Spider Man']) { const lb = label(2.5); bossLb[n] = lb; (n === 'Spider Man' ? spiderRig : n === 'Iron Man' ? scene : ship).add(lb); }
  bossLb['Captain Queenie'].position.set(-3.9, 4.75, -.75); bossLb['Spider Man'].position.set(0, .45, 0);

  // ---------- đảo, tàu khác, thuỷ quái ----------
  const palm = (p, x, z, h) => { const tr = new THREE.Group(); tr.position.set(x, 0, z); p.add(tr);
    for (let i = 0; i < 5; i++) { const s = mesh(new THREE.CylinderGeometry(.13 - i * .015, .15 - i * .015, h / 5, 7), mat(0x8d6e63), i * .12, h / 10 + i * h / 5, 0, tr); s.rotation.z = -.12; }
    for (let i = 0; i < 6; i++) { const lf = mesh(new THREE.BoxGeometry(1.6, .04, .38), mat(0x2e7d32), .6, h, 0, tr); lf.geometry.translate(.8, 0, 0); lf.position.x = .6; lf.rotation.set(0, i / 6 * Math.PI * 2, -.35); } };
  const island = (x, z, r, kind) => { const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const sand = mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf2d49b), 0, -.4, 0, g); sand.scale.y = .25;
    if (kind === 'skull') { const sk = mesh(new THREE.SphereGeometry(r * .55, 18, 14), mat(0xd7ccc8), 0, r * .55, 0, g); for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(r * .14, 10, 8), mat(0x212121), s * r * .2, r * .62, r * .45, g); mesh(new THREE.BoxGeometry(r * .5, r * .2, r * .4), mat(0xd7ccc8), 0, r * .15, r * .25, g); }
    else if (kind === 'volcano') { mesh(new THREE.ConeGeometry(r * .7, r * 1.1, 10), mat(0x5d4037, { flatShading: true }), 0, r * .5, 0, g); mesh(new THREE.SphereGeometry(r * .18, 10, 8), glow(0xff5722), 0, r * 1.02, 0, g); }
    else { mesh(new THREE.DodecahedronGeometry(r * .55), mat(0x43a047, { flatShading: true }), 0, r * .2, 0, g).scale.y = .7; for (let i = 0; i < 4; i++) palm(g, Math.cos(i * 1.7) * r * .55, Math.sin(i * 1.7) * r * .55, 3 + i % 2); } };
  island(-34, -26, 7, 'palm'); island(38, -32, 9, 'volcano'); island(30, 34, 6, 'palm'); island(-46, 28, 8, 'skull'); island(4, -55, 10, 'palm');

  const otherShip = (hull, sailC, flagDraw) => { const g = new THREE.Group(); scene.add(g);
    mesh(new THREE.BoxGeometry(6, 1.4, 2), mat(hull), 0, .2, 0, g); mesh(new THREE.ConeGeometry(1, 1.8, 4), mat(hull), 3.6, .2, 0, g).rotation.z = -Math.PI / 2;
    for (const x of [-1.3, 1.2]) { mesh(new THREE.CylinderGeometry(.1, .12, 5, 8), mat(0x6d4c41), x, 3, 0, g); const sl = canvasTex(256, 192); flagDraw(sl.g, sailC); sl.t.needsUpdate = true;
      mesh(new THREE.PlaneGeometry(2.4, 1.9), new THREE.MeshStandardMaterial({ map: sl.t, side: THREE.DoubleSide }), x + .1, 3.1, 0, g).rotation.y = Math.PI / 2; }
    return g; };
  const marine = otherShip(0xf5f5f5, '#ffffff', (g, c) => { g.fillStyle = c; g.fillRect(0, 0, 256, 192); g.fillStyle = '#1565c0'; g.fillRect(0, 150, 256, 20); g.font = '700 34px system-ui'; g.textAlign = 'center'; g.fillText('MARINE', 128, 130);
    g.strokeStyle = '#1565c0'; g.lineWidth = 8; g.beginPath(); g.moveTo(70, 70); g.quadraticCurveTo(100, 30, 128, 70); g.quadraticCurveTo(156, 30, 186, 70); g.stroke(); });
  const rival = otherShip(0x3e2723, '#1b1b1b', (g, c) => { g.fillStyle = c; g.fillRect(0, 0, 256, 192); g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 90, 34, 0, 7); g.fill();
    g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(115, 86, 8, 0, 7); g.arc(141, 86, 8, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.moveTo(80, 150); g.lineTo(176, 40); g.stroke(); });

  // thuỷ quái (Hải Vương): chuỗi đốt nhô lên khỏi mặt nước
  const seaKing = new THREE.Group(); scene.add(seaKing);
  const segs = []; for (let i = 0; i < 14; i++) { const r = .95 - i * .045; const s = mesh(new THREE.SphereGeometry(r, 14, 10), mat(i % 2 ? 0x8e44ad : 0x9b59b6), 0, 0, 0, seaKing);
    if (i > 0) mesh(new THREE.ConeGeometry(.18, .7, 5), mat(0xf39c12), 0, r * .9, 0, s); segs.push(s); }
  const kHead = segs[0];
  for (const s of [-1, 1]) { mesh(new THREE.SphereGeometry(.2, 10, 8), mat(0xfff59d), .55, .35, s * .5, kHead); mesh(new THREE.SphereGeometry(.09, 8, 6), mat(0x111111), .7, .37, s * .55, kHead); }
  const jaw = mesh(new THREE.BoxGeometry(1.1, .2, .8), mat(0x6c3483), .7, -.35, 0, kHead);
  for (let i = 0; i < 4; i++) mesh(new THREE.ConeGeometry(.05, .2, 4), mat(0xffffff), .5 + i * .18, -.15, .3 - (i % 2) * .6, kHead).rotation.x = Math.PI;
  const world = t => {
    marine.position.set(Math.cos(t * .03) * 30, .2 + .2 * Math.sin(t * 1.1), Math.sin(t * .03) * 30); marine.rotation.y = -t * .03 - Math.PI / 2; marine.rotation.z = .04 * Math.sin(t);
    rival.position.set(Math.cos(-t * .022 + 2) * 40, .2 + .2 * Math.sin(t * .9), Math.sin(-t * .022 + 2) * 40); rival.rotation.y = t * .022 - 2 + Math.PI / 2;
    const a = t * .06, cx = Math.cos(a) * 22, cz = Math.sin(a) * 22, dir = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), side = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    segs.forEach((s, i) => { const k = i * 1.05; s.position.set(cx - dir.x * k + side.x * Math.sin(t * 1.4 - i * .45) * .6, 1.6 * Math.sin(t * 1.2 - i * .55) - .2, cz - dir.z * k + side.z * Math.sin(t * 1.4 - i * .45) * .6); });
    kHead.rotation.y = -a - Math.PI / 2; kHead.position.y += .6; jaw.rotation.z = -.25 - .25 * Math.sin(t * 3); };

  // thùng hàng = việc chờ
  const crates = []; for (let i = 0; i < 24; i++) { const c = mesh(new THREE.BoxGeometry(.42, .42, .42), mat(0xa0723c), 1.35 + (i % 3) * .45, 1.21 + Math.floor(i / 6) * .43, -.45 + (Math.floor(i / 3) % 2) * .9, ship); c.rotation.y = (i * 37 % 10) / 40; crates.push(c); }
  // thuyền con = máy runner
  const boats = []; for (let i = 0; i < 15; i++) { const b = new THREE.Group(); scene.add(b);
    mesh(new THREE.BoxGeometry(1.1, .3, .55), mat(0xc58b3c), 0, .1, 0, b); const lamp = mesh(new THREE.SphereGeometry(.09, 10, 8), glow(0x5be316), .3, .45, 0, b);
    mesh(new THREE.CylinderGeometry(.02, .02, .35, 6), mat(0x333333), .3, .28, 0, b); const lb = label(1.2); lb.position.set(0, 1, 0); b.add(lb);
    const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xe0d2b4 })); scene.add(rope);
    boats.push({ g: b, lamp, lb, rope, row: Math.floor(i / 3), col: i % 3 - 1 }); }
  // pháo hoa
  const fireworks = [];
  const burst = () => { const n = 160, pos = new Float32Array(n * 3), vel = []; for (let i = 0; i < n; i++) { const a = Math.random() * 7, b = Math.acos(2 * Math.random() - 1), sp = 2 + Math.random() * 2; vel.push(new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)).multiplyScalar(sp)); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color().setHSL(Math.random(), 1, .6), size: .18, transparent: true })); p.position.set((Math.random() - .5) * 8, 11 + Math.random() * 3, (Math.random() - .5) * 6); scene.add(p); fireworks.push({ p, vel, t: 0 }); };

  const resize = () => { const r = host.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(host); resize();

  // trời theo giờ thật: sáng / hoàng hôn / đêm
  const sky = () => { const h = new Date().getHours() + new Date().getMinutes() / 60;
    const [bg, seaC, li] = h >= 6 && h < 17 ? [0x8ec9ff, 0x1e88c7, 1.6] : h >= 17 && h < 19 ? [0xf4a261, 0x2a6f97, 1] : h >= 5 && h < 6 ? [0xf6bd60, 0x2a6f97, .9] : [0x0b1d3a, 0x0a2a4a, .35];
    scene.background = new THREE.Color(bg); scene.fog.color.setHex(bg); sea.material.color.setHex(seaC); sun.intensity = li; hemi.intensity = li > .5 ? 1 : .45; };
  sky(); setInterval(sky, 60000);

  const clk = new THREE.Clock(), stern = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clk.getDelta(), .05), t = clk.elapsedTime;
    for (let i = 0; i < seaPos.count; i++) { const x = base[i * 3], z = base[i * 3 + 2]; seaPos.array[i * 3 + 1] = .22 * Math.sin(x * .22 + t * 1.1) + .14 * Math.sin(z * .31 + t * 1.5) + .06 * Math.sin((x + z) * .7 + t * 2); }
    seaPos.needsUpdate = true;
    ship.position.y = .12 * Math.sin(t * 1.1); ship.rotation.z = .035 * Math.sin(t * .8); ship.rotation.x = .025 * Math.sin(t * .6);
    flag.rotation.y = .25 * Math.sin(t * 3); wheel.rotation.x = .4 * Math.sin(t * .4);
    crew.forEach((c, i) => { if (c.jobs.length) { c.g.position.y = SPOT[c.name][1] + Math.abs(Math.sin(t * 4 + i)) * .07; c.g.userData.arms.forEach((a, k) => a.rotation.x = Math.sin(t * 6 + i + k * 3) * .6); } });
    luffy.userData.arms[1].rotation.z = 2.6 + .3 * Math.sin(t * 2);
    iron.position.set(Math.cos(t * .35) * 15, 12 + Math.sin(t * 1.3) * .5, Math.sin(t * .35) * 15); iron.rotation.y = -t * .35; iron.rotation.z = .25;
    bossLb['Iron Man'].position.copy(iron.position).add(new THREE.Vector3(0, 2.2, 0));
    spiderRig.rotation.x = .18 * Math.sin(t * 1.2); queenie.rotation.y = Math.PI / 2 + .3 * Math.sin(t * .5);
    ship.localToWorld(stern.set(-5.3, .6, 0));
    boats.forEach((b, i) => { if (!b.g.visible) { b.rope.visible = false; return; } const x = -12.5 - b.row * 2.2, z = b.col * 1.5, y = .25 + .22 * Math.sin(x * .22 + t * 1.1) + .14 * Math.sin(z * .31 + t * 1.5);
      b.g.position.set(x, y, z); b.g.rotation.z = .08 * Math.sin(t * 1.3 + i); b.rope.visible = true; b.rope.geometry.setFromPoints([stern, b.g.position.clone().add(new THREE.Vector3(.55, .2, 0))]);
      if (b.on) b.lamp.material.emissiveIntensity = 1 + .8 * Math.sin(t * 5 + i); });
    for (let i = fireworks.length - 1; i >= 0; i--) { const f = fireworks[i]; f.t += dt; const a = f.p.geometry.attributes.position;
      f.vel.forEach((v, k) => { v.y -= 1.5 * dt; a.array[k * 3] += v.x * dt; a.array[k * 3 + 1] += v.y * dt; a.array[k * 3 + 2] += v.z * dt; }); a.needsUpdate = true; f.p.material.opacity = Math.max(0, 1 - f.t / 2.2);
      if (f.t > 2.2) { scene.remove(f.p); f.p.geometry.dispose(); fireworks.splice(i, 1); } }
    world(t); ctl.update(); renderer.render(scene, cam);
  });
  return { crew, bossLb, crates, boats, gold, chestLbl, burst };
}

let seenDone = null;
function paint(s) {
  const { crew, bossLb, crates, boats, gold, chestLbl, burst } = three;
  // việc đang chạy → chia cho băng Mũ Rơm theo thứ tự số issue (ổn định giữa các lần tải)
  const jobs = s.bots.flatMap(b => b.jobs.map(j => ({ ...j, boss: b.name }))).sort((a, b) => a.number - b.number);
  crew.forEach(c => { c.jobs = []; }); jobs.forEach((j, i) => crew[i % crew.length].jobs.push(j));
  crew.forEach(c => {
    const j = c.jobs[0], busy = !!j;
    c.g.rotation.z = busy || c.name === 'Zoro' ? 0 : 1.35; c.g.position.y = SPOT[c.name][1] + (busy ? 0 : .15);
    if (!busy) return c.lb.set(`${c.name} · ${c.room}`, '💤 nghỉ', '#666', true);
    const more = c.jobs.length > 1 ? ` +${c.jobs.length - 1}` : '';
    c.lb.set(`${c.name} · ${c.room}`, `#${j.number} ${j.code || ''} · ${j.phase.text}${more}`, BOSS[j.boss]?.color);
  });
  s.bots.forEach(b => { const m = BOSS[b.name] || { short: b.name, color: '#5BE316', title: '' };
    bossLb[b.name]?.set(`${b.name === 'Captain Queenie' ? '👑 ' : ''}${m.short} · ${m.title}`, b.jobs.length ? `${b.jobs.length} việc đang làm` : 'Đang rảnh', m.color); });
  const wait = s.queue.waiting ?? (s.queue.ready + s.queue.blocked); crates.forEach((c, i) => { c.visible = i < wait; });
  const cost = s.costs?.total24 ?? 0; gold.scale.setScalar(.5 + Math.min(1, cost / 500)); chestLbl.set(`💰 $${cost.toFixed(0)}`, '24 giờ qua', '#ffc107');
  const OS = { 'ubuntu-latest': '🐧 Linux', 'windows-latest': '🪟 Win', 'macos-15-intel': '🍎 Mac' };
  boats.forEach((b, i) => { const m = s.machines[i]; b.g.visible = !!m; if (!m) return; const q = m.status === 'queued'; b.on = !q;
    b.lamp.material.color.setHex(q ? 0xf0b54a : 0x5be316); b.lamp.material.emissive.setHex(q ? 0xf0b54a : 0x5be316); b.lb.set(OS[m.os] || m.os, `#${m.issue ?? '?'} · ${q ? 'xếp hàng' : ago(m.startedAt)}`, q ? '#f0b54a' : '#5BE316'); });
  const ids = new Set(s.done.map(d => d.number)); if (seenDone) { const fresh = [...ids].filter(n => !seenDone.has(n)).length; for (let i = 0; i < Math.min(5, fresh * 2); i++) setTimeout(burst, i * 350); } seenDone = ids;
  // bảng bên
  $('staff').innerHTML = s.bots.map(b => { const m = BOSS[b.name] || {}; return `<div class="card"><b style="color:${m.color || '#fff'}">${esc(b.name)}</b><span class="s">${esc(m.title || '')} · ${b.jobs.length ? b.jobs.map(j => `#${j.number} ${esc(j.code)}`).join(', ') : 'Đang rảnh'}</span></div>`; }).join('')
    + `<div class="card"><span class="s">${crew.filter(c => c.jobs.length).map(c => `${c.name}: #${c.jobs.map(j => j.number).join(', #')}`).join(' · ') || 'Cả băng đang nghỉ'}</span></div>`;
  $('queue').innerHTML = `<b>${s.machines.length} thuyền con · ${s.queue.ready} sẵn sàng · ${s.queue.blocked} chờ việc khác</b>`;
  $('done').innerHTML = s.done.map(d => `<tr><td>#${d.number} ${esc(d.code || '')}<div class="s" style="color:var(--muted)">${esc(d.bot)} · ${ago(d.closedAt)} trước</div></td><td class="${d.score >= 8 ? 'hi' : d.score >= 6 ? 'mid' : 'lo'}">${d.score != null ? d.score + '/10' : '–'}</td><td>${d.confidence != null ? d.confidence + '%' : ''}</td></tr>`).join('') || '<tr><td>Chưa có</td></tr>';
}

async function refresh() {
  try { const s = DEMO ? demoState() : await (await fetch(STATUS + '?t=' + Date.now(), { cache: 'no-store' })).json(); if (three) paint(s); const ag = s.bots.reduce((n, b) => n + b.jobs.length, 0), mc = s.machines.filter(m => m.status !== 'queued').length, qd = s.machines.length - mc;
    $('cnt').textContent = `${mc} thuyền con đang chạy${qd ? ` (+${qd} xếp hàng)` : ''} · ${ag} thuyền viên đang làm · ` + s.bots.map(b => `${BOSS[b.name]?.short || b.name} ${b.jobs.length}`).join(' / '); $('live').className = 'dot'; $('upd').textContent = 'dữ liệu lúc ' + new Date(s.at).toLocaleTimeString('vi-VN'); }
  catch (e) { $('live').className = 'dot off'; $('upd').textContent = 'chưa đọc được trạng thái'; }
}
function start() { try { three = three || build(); } catch (e) { $('upd').textContent = 'Lỗi 3D: ' + e.message; } refresh(); setInterval(refresh, 30000); }
start();

// #demo: dữ liệu giả để xem thử.
function demoState() {
  const t = new Date(Date.now() - 50 * 60e3).toISOString(), job = (number, code, key, text, os) => ({ number, code, phase: { key, text }, progress: { done: 1, total: 3 }, model: 'opus', machine: os ? { os, startedAt: t, status: 'in_progress' } : null });
  return { at: new Date().toISOString(),
    bots: [{ name: 'Captain Queenie', state: 'code', jobs: [job(23, 'E06', 'code', 'Đang code', 'ubuntu-latest'), job(68, 'G09', 'plan', 'Đang lên plan', 'windows-latest')] },
      { name: 'Iron Man', state: 'work', jobs: [job(79, 'MF1', 'work', 'Đang làm', 'macos-15-intel'), job(85, 'WA1', 'work', 'Đang làm', 'ubuntu-latest'), job(39, 'X01', 'plan', 'Đang lên plan', 'windows-latest')] },
      { name: 'Spider Man', state: 'work', jobs: [job(7, 'D01', 'code', 'Đang code', 'ubuntu-latest')] }],
    machines: [{ issue: 23, os: 'ubuntu-latest', status: 'in_progress', startedAt: t }, { issue: 68, os: 'windows-latest', status: 'in_progress', startedAt: t }, { issue: 79, os: 'macos-15-intel', status: 'in_progress', startedAt: t }, { issue: 85, os: 'ubuntu-latest', status: 'in_progress', startedAt: t }, { issue: 39, os: 'windows-latest', status: 'queued', startedAt: t }, { issue: 7, os: 'ubuntu-latest', status: 'in_progress', startedAt: t }],
    queue: { waiting: 14, ready: 3, blocked: 11, next: [] }, costs: { total24: 451.26 },
    done: [{ number: 45, code: 'U13', bot: 'Iron Man', closedAt: t, score: 9, confidence: 88 }, { number: 33, code: 'E17', bot: 'Iron Man', closedAt: t, score: 10, confidence: 97 }] };
}
