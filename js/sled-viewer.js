// Lightsaber sled version explorer.
// The version picker and static renders always work; the 3D viewer is
// loaded on top (three.js from a CDN) and only takes over if it loads.

const M = '../assets/projects/lightsaber/models/';
const R = '../assets/projects/lightsaber/';
const ACCENT = 0xe0342b;

// roll (degrees about the long axis) matches the angle used for the static renders
const VERSIONS = [
  { id: 'V2', title: 'V2: two-piece sled for a Pico', len: '15.5 + 7 cm', mm: null, roll: 0,
    files: [{ src: 'v02_lower.stl' }, { src: 'v02_upper.stl', roll: 90, gap: true }],
    note: 'Two parts sized to fit inside the handle, built around a Raspberry Pi Pico with room for an accelerometer and gyroscope module. Sensing motion lets the saber play a swing sound whenever the blade moves.' },
  { id: 'V3', title: 'V3: switch to a Proffie board', len: '10.7 cm', mm: 107, roll: 270, files: [{ src: 'v03.stl' }],
    note: 'Switched to a Proffie board, which is made for lightsabers and has an accelerometer and gyroscope built in. Added a slot for a 28 mm speaker to slide into, plus holes and cutouts for routing cables.' },
  { id: 'V4', title: 'V4: back to basics (never printed)', len: '17.2 cm', mm: 172, roll: 90, files: [{ src: 'v04.stl' }], never: true,
    note: 'Stripped down to the most basic components, and added space for an illuminated crystal exposed in the handle. The speaker slot was removed, but its space was kept. I never printed it: it had no attachment points and wasn\'t stiff enough to survive being swung repeatedly.' },
  { id: 'V5', title: 'V5: structure returns', len: '16.8 cm', mm: 168, roll: 90, files: [{ src: 'v05.stl' }],
    note: 'Built on V4\'s bare layout but far more detailed. Ribs surround the crystal, and the Proffie board sits on a sunken ledge that leaves its contacts exposed, so wires can run along the inside of the sled beneath the battery slot.' },
  { id: 'V6', title: 'V6: a removable second piece', len: '16.8 cm', mm: 168, roll: 270, files: [{ src: 'v06_part1.stl' }, { src: 'v06_part2.stl', color: ACCENT }],
    note: 'Added a second piece (red) so the Proffie board could be taken out to update its software over a cable. I printed it once, then dropped the idea because I couldn\'t find a reliable way to attach and detach the second piece.' },
  { id: 'V7', title: 'V7: a cable cutout instead', len: '16.8 cm', mm: 168, roll: 270, files: [{ src: 'v07.stl' }],
    note: 'Fixed V6\'s problem by going back to the ledge design and adding a cutout, so the cable plugs in without removing the board.' },
  { id: 'V8', title: 'V8: cable management', len: '15.5 cm', mm: 155, roll: 90, files: [{ src: 'v08.stl' }],
    note: 'Structural changes to allow neat wire routing and cable management.' },
  { id: 'V9', title: 'V9: a major rework', len: '27.1 cm', mm: 271, roll: 90, files: [{ src: 'v09.stl' }],
    note: 'Removed the ribs around the crystal and added a mount for an on/off switch, hidden behind the outer casing. Moved the board from opposite the battery to above the crystal, angled so its micro-USB port is easy to reach. Added a block to mount the buttons on the sled. The sled grew from 15.5 to 27.1 cm to fit it all.' },
  { id: 'V10', title: 'V10: buttons move to the casing', len: '22.7 cm', mm: 227, roll: 90, files: [{ src: 'v10.stl' }],
    note: 'Dropped the sled-mounted buttons to save weight and length. Instead, the outer casing splits into upper and lower halves, with the buttons mounted to the upper half and cutouts below them so you can see the illuminated crystal.' },
  { id: 'V11', title: 'V11: trimmed for weight', len: '18.2 cm', mm: 182, roll: 90, files: [{ src: 'v11.stl' }],
    note: 'Shaved off as much unnecessary material as possible to save weight.' },
  { id: 'Full hilt', title: 'Final assembly', len: '30.1 cm', mm: null, roll: 270, files: [{ src: 'assembly_final.stl' }], img: 'sled-assembly.webp',
    note: 'The V11 sled inside the split outer casing, with the buttons on the upper half and the crystal viewing cutouts below them.' },
];

const $ = id => document.getElementById(id);
const stage = $('stage'), img = $('v-img'), bar = $('v-bar');
let current = 0, viewer = null;

// ---- length chart
const chart = $('lenchart');
if (chart) {
  const max = Math.max(...VERSIONS.filter(v => v.mm).map(v => v.mm));
  chart.innerHTML = VERSIONS.filter(v => v.mm).map(v =>
    `<div class="lenrow${v.id === 'V9' || v.id === 'V11' ? ' hl' : ''}"><span>${v.id}</span>` +
    `<div class="bar"><i style="width:${(v.mm / max * 100).toFixed(1)}%"></i></div><span>${(v.mm / 10).toFixed(1)} cm</span></div>`
  ).join('');
}

// ---- picker
VERSIONS.forEach((v, i) => {
  const b = document.createElement('button');
  b.textContent = v.id; b.setAttribute('role', 'tab');
  b.addEventListener('click', () => show(i));
  bar.appendChild(b);
});
$('v-prev').addEventListener('click', () => show((current - 1 + VERSIONS.length) % VERSIONS.length));
$('v-next').addEventListener('click', () => show((current + 1) % VERSIONS.length));

function show(i) {
  current = i; const v = VERSIONS[i];
  [...bar.children].forEach((b, k) => { b.classList.toggle('active', k === i); b.setAttribute('aria-selected', k === i); });
  img.src = R + v.img;
  img.alt = 'Render of ' + v.title;
  $('v-tag').textContent = v.never ? v.id + ' · never printed' : v.id;
  $('v-tag').classList.toggle('never', !!v.never);
  $('v-title').textContent = v.title;
  $('v-note').textContent = v.note;
  $('v-len').innerHTML = `<b>${v.len}</b>long`;
  if (viewer) viewer.load(v);
}
// static image names: sled-v02.webp ... sled-v11.webp
VERSIONS.forEach(v => { if (!v.img) v.img = 'sled-v' + v.id.slice(1).padStart(2, '0') + '.webp'; });
show(0);

// ---- 3D viewer (progressive enhancement)
(async () => {
  try {
    const THREE = await import('three');
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
    const canvas = $('v-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
    camera.up.set(0, 0, 1);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-1, -1.2, 1.6); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(1.5, 0.5, 0.4); scene.add(fill);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
    const loader = new STLLoader();
    const cache = new Map();
    const group = new THREE.Group(); scene.add(group);
    const VIEW = new THREE.Vector3(0.435, -0.819, 0.375).normalize();   // same angle as the static renders

    const loadOnce = src => new Promise((res, rej) => loader.load(M + src, res, undefined, rej));
    const fetchGeom = src => {
      if (!cache.has(src)) {
        const p = loadOnce(src).catch(() => loadOnce(src)).catch(() => loadOnce(src));   // retry flaky connections
        p.catch(() => cache.delete(src));
        cache.set(src, p);
      }
      return cache.get(src);
    };
    const longAxisToX = (g, roll) => {
      g.computeBoundingBox(); const s = new THREE.Vector3(); g.boundingBox.getSize(s);
      const k = s.x >= s.y && s.x >= s.z ? 0 : s.y >= s.z ? 1 : 2;
      if (k === 1) g.rotateZ(-Math.PI / 2);
      if (k === 2) g.rotateY(Math.PI / 2);
      g.rotateX(THREE.MathUtils.degToRad(roll));
    };

    let token = 0;
    async function load(v) {
      const my = ++token;
      let geoms;
      stage.dataset.v3d = 'loading ' + v.id;
      stage.classList.remove('live');   // show this version's static render until its 3D model is ready
      try { geoms = await Promise.all(v.files.map(f => fetchGeom(f.src))); }
      catch (e) { stage.dataset.v3d = 'fetch failed: ' + (e && (e.message || e.type) || e); if (my === token) stage.classList.remove('live'); return; }   // fall back to the static render
      if (my !== token) return;
      group.clear(); group.position.set(0, 0, 0);
      let offset = 0;
      const meshes = v.files.map((f, i) => {
        const g = geoms[i].clone();
        if (f.gap) {                       // separate piece: orient on its own, place beside the first
          longAxisToX(g, f.roll || 0);
        }
        const mat = new THREE.MeshStandardMaterial({ color: f.color || 0xc5c9d1, metalness: 0.05, roughness: 0.55, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(g, mat);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g, 35), new THREE.LineBasicMaterial({ color: 0x343c4c, transparent: true, opacity: 0.55 }));
        const o = new THREE.Group(); o.add(mesh, edges); o.userData.gap = f.gap;
        return o;
      });
      const main = new THREE.Group();
      meshes.filter(m => !m.userData.gap).forEach(m => main.add(m));
      // orient the joined (non-separate) parts together, like the static renders
      const tmp = new THREE.Box3().setFromObject(main); const sz = new THREE.Vector3(); tmp.getSize(sz);
      const k = sz.x >= sz.y && sz.x >= sz.z ? 0 : sz.y >= sz.z ? 1 : 2;
      if (k === 1) main.rotateZ(-Math.PI / 2);
      if (k === 2) main.rotateY(Math.PI / 2);
      const rollG = new THREE.Group(); rollG.add(main); rollG.rotateX(THREE.MathUtils.degToRad(v.roll || 0));
      group.add(rollG);
      rollG.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(rollG);
      meshes.filter(m => m.userData.gap).forEach(m => {
        const b = new THREE.Box3().setFromObject(m);
        m.position.x += box.max.x - b.min.x + 25;
        group.add(m);
        box = new THREE.Box3().setFromObject(group);
      });
      // center and frame
      box = new THREE.Box3().setFromObject(group);
      const c = new THREE.Vector3(); box.getCenter(c); group.position.copy(c).negate();
      const r = box.getBoundingSphere(new THREE.Sphere()).radius;
      const dist = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.5;
      camera.position.copy(VIEW).multiplyScalar(dist);
      camera.near = dist / 50; camera.far = dist * 10; camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0); controls.minDistance = dist * 0.3; controls.maxDistance = dist * 2.5; controls.update();
      stage.classList.add('live'); stage.dataset.v3d = 'ok ' + v.id;
    }

    const resize = () => {
      const w = stage.clientWidth, h = stage.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(stage); resize();
    (function tick() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(tick); })();
    viewer = { load: v => load(v).catch(e => { console.error('sled viewer:', e); stage.classList.remove('live'); }) };
    viewer.load(VERSIONS[current]);
  } catch (e) {
    // no WebGL or the CDN is blocked: the static renders stay visible
    stage.dataset.v3d = 'unavailable: ' + (e && e.message);
    console.warn('3D viewer unavailable, showing static renders.', e);
  }
})();
