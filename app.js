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

// ---------- người chibi (mặt nhìn +z, chân ở y=0, cao ~1.3) ----------
function person(o) {
  const g = new THREE.Group(), skin = o.skin ?? 0xf1c9a5;
  for (const x of [-.09, .09]) mesh(new THREE.CylinderGeometry(.065, .06, .42, 10), mat(o.legs ?? o.pants ?? 0x333333), x, .21, 0, g);
  mesh(new THREE.CapsuleGeometry(.18, .24, 4, 12), mat(o.shirt ?? 0xffffff), 0, .62, 0, g);
  if (o.pants) mesh(new THREE.CylinderGeometry(.19, .2, .16, 12), mat(o.pants), 0, .44, 0, g);
  const arms = [-1, 1].map(s => { const a = mesh(new THREE.CylinderGeometry(.055, .05, .4, 8), mat(o.arms ?? o.shirt ?? skin), s * .25, .62, 0, g); a.rotation.z = s * .3; return a; });
  const head = mesh(new THREE.SphereGeometry(.23, 20, 16), mat(o.head ?? skin), 0, 1.06, 0, g);
  if (o.eyes !== false) for (const x of [-.08, .08]) mesh(new THREE.SphereGeometry(.03, 8, 6), mat(o.eyeColor ?? 0x111111), x, 1.08, .21, g);
  if (o.hair != null) { const h = mesh(new THREE.SphereGeometry(.245, 18, 12, 0, Math.PI * 2, 0, Math.PI * (o.hairCap ?? .5)), mat(o.hair), 0, 1.07, -.01, g); h.rotation.x = -.15; }
  g.userData = { head, arms };
  o.extra && o.extra(g);
  if (o.scale) g.scale.setScalar(o.scale);
  return g;
}
const hatStraw = g => { mesh(new THREE.CylinderGeometry(.42, .42, .03, 24), mat(0xe9c46a), 0, 1.22, 0, g); mesh(new THREE.CylinderGeometry(.21, .23, .17, 20), mat(0xe9c46a), 0, 1.31, 0, g); mesh(new THREE.CylinderGeometry(.235, .235, .055, 20), mat(0xc0392b), 0, 1.26, 0, g); };
const longHair = c => g => mesh(new THREE.BoxGeometry(.44, .62, .12), mat(c), 0, .86, -.17, g);

const CREW = [
  { name: 'Zoro', room: '🏋️ Tháp canh', o: { shirt: 0xf2f2f2, pants: 0x2f3b2c, hair: 0x4caf50, hairCap: .42, extra: g => {
    mesh(new THREE.CylinderGeometry(.2, .2, .12, 14), mat(0x3e7d3a), 0, .5, 0, g);
    [0xffffff, 0x111111, 0xb71c1c].forEach((c, i) => { const s = mesh(new THREE.BoxGeometry(.035, .7, .035), mat(0x9aa0a6, { metalness: .8, roughness: .3 }), .24, .45, -.05 + i * .06, g); s.rotation.z = .9; mesh(new THREE.BoxGeometry(.05, .16, .05), mat(c), .5, .63, -.05 + i * .06, g).rotation.z = .9; }); } } },
  { name: 'Sanji', room: '🍳 Bếp', o: { shirt: 0x1d1d22, pants: 0x1d1d22, hair: 0xf5d76e, extra: g => { mesh(new THREE.SphereGeometry(.11, 10, 8), mat(0xf5d76e), .09, 1.1, .16, g); mesh(new THREE.CylinderGeometry(.012, .012, .14, 6), mat(0xffffff), -.07, 1.0, .25, g).rotation.x = Math.PI / 2; mesh(new THREE.SphereGeometry(.015, 6, 6), glow(0xff7043), -.07, 1.0, .32, g); } } },
  { name: 'Nami', room: '🗺 Hải đồ', o: { shirt: 0x5aa0e6, pants: 0x2d4f8a, hair: 0xf28b2c, extra: longHair(0xf28b2c) } },
  { name: 'Usopp', room: '🎯 Kho súng', o: { skin: 0x8d5a3b, shirt: 0xc9a46b, pants: 0x6d5a3b, hair: 0x111111, hairCap: .62, extra: g => { mesh(new THREE.ConeGeometry(.04, .32, 8), mat(0x8d5a3b), 0, 1.05, .36, g).rotation.x = Math.PI / 2; } } },
  { name: 'Franky', room: '🔧 Xưởng', o: { shirt: 0xe63946, pants: 0x1565c0, hair: 0x3fa9f5, hairCap: .35, scale: 1.12, extra: g => {
    for (let i = -1; i <= 1; i++) { const c = mesh(new THREE.ConeGeometry(.08, .3, 6), mat(0x3fa9f5), i * .1, 1.32, 0, g); c.rotation.z = -i * .3; }
    mesh(new THREE.BoxGeometry(.3, .07, .04), mat(0x111111, { metalness: .6 }), 0, 1.1, .21, g);
    g.userData.arms.forEach(a => a.scale.set(1.9, 1, 1.9)); } } },
  { name: 'Chopper', room: '🩺 Phòng y tế', o: { scale: .72, skin: 0x8b5a2b, shirt: 0x8b5a2b, legs: 0x8b5a2b, hair: null, extra: g => {
    mesh(new THREE.SphereGeometry(.04, 8, 6), mat(0x1e88e5), 0, 1.02, .23, g);
    mesh(new THREE.CylinderGeometry(.32, .32, .03, 20), mat(0xf48fb1), 0, 1.24, 0, g); mesh(new THREE.CylinderGeometry(.2, .2, .32, 20), mat(0xf48fb1), 0, 1.4, 0, g);
    [1, -1].forEach(s => { mesh(new THREE.BoxGeometry(.18, .035, .01), mat(0xffffff), 0, 1.4, .2, g).rotation.z = s * .78; mesh(new THREE.CylinderGeometry(.02, .025, .22, 6), mat(0x6d4c2b), s * .26, 1.32, 0, g).rotation.z = -s * .9; }); } } },
  { name: 'Robin', room: '📚 Thư viện', o: { shirt: 0x7b4fa0, pants: 0x3a2a4a, hair: 0x1a1a2e, extra: longHair(0x1a1a2e) } },
  { name: 'Brook', room: '🎻 Phòng nhạc', o: { skin: 0xf5f5ef, shirt: 0x1b1b1f, pants: 0x1b1b1f, eyeColor: 0x000000, hair: null, extra: g => {
    mesh(new THREE.SphereGeometry(.34, 16, 12), mat(0x111111), 0, 1.2, -.05, g); mesh(new THREE.CylinderGeometry(.17, .17, .3, 16), mat(0x111111), 0, 1.55, 0, g); mesh(new THREE.CylinderGeometry(.27, .27, .02, 16), mat(0x111111), 0, 1.41, 0, g);
    mesh(new THREE.CylinderGeometry(.015, .015, .9, 6), mat(0x5d4037), .32, .45, .1, g); } } },
  { name: 'Jinbe', room: '☸️ Bánh lái', o: { skin: 0x5c8fd6, shirt: 0xe07b39, pants: 0x3e2723, hair: 0x111111, hairCap: .35, scale: 1.2 } },
];
// Chỗ của từng người trên tàu (toạ độ trong group tàu, boong ở y=1).
const SPOT = { Zoro: [.5, 7.35, 0], Sanji: [-1.6, 1, 1.1], Nami: [-1.6, 1, -1.1], Usopp: [4.2, 1, -.9], Franky: [4.2, 1, .9], Chopper: [2.7, 1, 1.15], Robin: [2.7, 1, -1.15], Brook: [-3.9, 2.6, .8], Jinbe: [-2.75, 2.6, 0] };

function build() {
  const host = $('scene'), renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x8ec9ff, 30, 90);
  const cam = new THREE.PerspectiveCamera(45, 1, .1, 300); cam.position.set(11, 9, 15);
  const ctl = new OrbitControls(cam, renderer.domElement); ctl.target.set(0, 3, 0); ctl.enableDamping = true;
  ctl.maxPolarAngle = Math.PI * .49; ctl.minDistance = 6; ctl.maxDistance = 45;
  const hemi = new THREE.HemisphereLight(0xdfefff, 0x1d3b52, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(12, 20, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 }); scene.add(sun);

  // biển
  const seaGeo = new THREE.PlaneGeometry(220, 220, 110, 110); seaGeo.rotateX(-Math.PI / 2);
  const seaPos = seaGeo.attributes.position, base = Float32Array.from(seaPos.array);
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: 0x1e88c7, roughness: .35, metalness: .1, flatShading: true })); sea.receiveShadow = true; scene.add(sea);

  // tàu
  const ship = new THREE.Group(); scene.add(ship);
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
  const luffy = person({ shirt: 0xd62f2f, pants: 0x3d6fb6, legs: 0xf1c9a5, hair: 0x111111, extra: hatStraw }); luffy.position.set(6.1, 2.65, 0); luffy.rotation.y = Math.PI / 2; ship.add(luffy);
  const luffyLb = label(2.2); luffyLb.position.set(6.1, 4.6, 0); ship.add(luffyLb); luffyLb.set('👒 Thuyền trưởng Luffy', 'Percy · giám đốc CutCut', '#e9c46a');
  // 3 sếp
  const queenie = person({ shirt: 0xb3202a, pants: 0xb3202a, legs: 0x222222, hair: 0x5a3825, extra: g => {
    longHair(0x5a3825)(g); mesh(new THREE.ConeGeometry(.33, .45, 16, 1, true), mat(0xb3202a, { side: THREE.DoubleSide }), 0, .4, 0, g);
    const hat = mesh(new THREE.CylinderGeometry(.08, .08, .7, 3), mat(0x151515), 0, 1.34, 0, g); hat.rotation.z = Math.PI / 2; hat.scale.set(1, 1, 2.6);
    mesh(new THREE.SphereGeometry(.05, 8, 6), mat(0xffffff), 0, 1.36, .14, g); for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.14, .04, .12), mat(0xffc107, { metalness: .7 }), s * .2, .83, 0, g); } });
  queenie.position.set(-3.9, 2.65, -.75); queenie.rotation.y = Math.PI / 2; queenie.scale.setScalar(1.1); ship.add(queenie);
  const iron = person({ skin: 0xb3151b, shirt: 0xb3151b, pants: 0xb3151b, legs: 0xb3151b, arms: 0xb3151b, eyes: false, hair: null, extra: g => {
    mesh(new THREE.SphereGeometry(.2, 16, 12, -Math.PI / 2, Math.PI, 0, Math.PI), mat(0xe0b13a, { metalness: .8, roughness: .3 }), 0, 1.04, .05, g);
    for (const x of [-.08, .08]) mesh(new THREE.BoxGeometry(.08, .025, .02), glow(0xe0ffff), x, 1.09, .24, g);
    mesh(new THREE.CircleGeometry(.06, 16), glow(0x7df9ff), 0, .7, .19, g);
    for (const x of [-.09, .09]) mesh(new THREE.ConeGeometry(.06, .3, 8), new THREE.MeshBasicMaterial({ color: 0x9ff6ff, transparent: true, opacity: .8 }), x, -.15, 0, g).rotation.x = Math.PI; } });
  iron.scale.setScalar(1.25); scene.add(iron);
  const webT = canvasTex(256, 128); { const g = webT.g; g.fillStyle = '#c62828'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#222'; g.lineWidth = 2; for (let i = 0; i < 16; i++) { g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(i / 8 * Math.PI) * 200, 64 + Math.sin(i / 8 * Math.PI) * 200); g.stroke(); } for (let r = 12; r < 200; r += 16) { g.beginPath(); g.arc(64, 64, r, 0, 7); g.stroke(); } webT.t.needsUpdate = true; }
  const spidey = person({ head: 0xc62828, skin: 0xc62828, shirt: 0xc62828, pants: 0x1f4fb3, legs: 0x1f4fb3, arms: 0xc62828, eyes: false, hair: null, extra: g => {
    g.userData.head.material = new THREE.MeshStandardMaterial({ map: webT.t, roughness: .6 });
    for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(.07, 12, 8), mat(0xffffff), s * .09, 1.1, .19, g); e.scale.set(1, 1.4, .4); e.rotation.z = s * .5; }
    mesh(new THREE.SphereGeometry(.05, 8, 6), mat(0x111111), 0, .72, .19, g); } });
  const spiderRig = new THREE.Group(); spiderRig.position.set(.5, 6.2, 1.9); ship.add(spiderRig);
  spidey.rotation.x = Math.PI; spidey.position.y = -.4; spiderRig.add(spidey); spidey.scale.setScalar(1.1);
  mesh(new THREE.CylinderGeometry(.008, .008, .5, 4), mat(0xffffff), 0, -.2, 0, spiderRig);
  const bossLb = {}; for (const n of ['Captain Queenie', 'Iron Man', 'Spider Man']) { const lb = label(2.5); bossLb[n] = lb; (n === 'Spider Man' ? spiderRig : n === 'Iron Man' ? scene : ship).add(lb); }
  bossLb['Captain Queenie'].position.set(-3.9, 4.75, -.75); bossLb['Spider Man'].position.set(0, .45, 0);

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
    iron.position.set(Math.cos(t * .35) * 9, 7 + Math.sin(t * 1.3) * .5, Math.sin(t * .35) * 9); iron.rotation.y = -t * .35; iron.rotation.z = .25;
    bossLb['Iron Man'].position.copy(iron.position).add(new THREE.Vector3(0, 2.2, 0));
    spiderRig.rotation.x = .18 * Math.sin(t * 1.2); queenie.rotation.y = Math.PI / 2 + .3 * Math.sin(t * .5);
    ship.localToWorld(stern.set(-5.3, .6, 0));
    boats.forEach((b, i) => { if (!b.g.visible) { b.rope.visible = false; return; } const x = -8.5 - b.row * 2.2, z = b.col * 1.5, y = .25 + .22 * Math.sin(x * .22 + t * 1.1) + .14 * Math.sin(z * .31 + t * 1.5);
      b.g.position.set(x, y, z); b.g.rotation.z = .08 * Math.sin(t * 1.3 + i); b.rope.visible = true; b.rope.geometry.setFromPoints([stern, b.g.position.clone().add(new THREE.Vector3(.55, .2, 0))]);
      if (b.on) b.lamp.material.emissiveIntensity = 1 + .8 * Math.sin(t * 5 + i); });
    for (let i = fireworks.length - 1; i >= 0; i--) { const f = fireworks[i]; f.t += dt; const a = f.p.geometry.attributes.position;
      f.vel.forEach((v, k) => { v.y -= 1.5 * dt; a.array[k * 3] += v.x * dt; a.array[k * 3 + 1] += v.y * dt; a.array[k * 3 + 2] += v.z * dt; }); a.needsUpdate = true; f.p.material.opacity = Math.max(0, 1 - f.t / 2.2);
      if (f.t > 2.2) { scene.remove(f.p); f.p.geometry.dispose(); fireworks.splice(i, 1); } }
    ctl.update(); renderer.render(scene, cam);
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
