// Neuron field: real Allen Institute reconstructions (neuron/*.swc) drawn with
// three.js into a fixed, full-viewport canvas that sits BEHIND the page content.
// Scrolling drives an action potential through every cell, each on its own
// slightly staggered schedule: synaptic input sums along the dendrites (distal
// first), the soma reaches threshold, and the spike travels down the axon.
// Loaded lazily by js/site.js only on screens wider than 900px.
//
// To add a cell: download its SWC from the Allen Cell Types database
// (celltypes.brain-map.org -> specimen -> "Download morphology"), drop it in
// neuron/, add an entry to NEURONS and a slot to LAYOUT (or let it reuse one).
// Colors come from CSS custom properties (--neuron-rest, --neuron-soma, --gold)
// so the light/dark switch in js/theme.js repaints the field too.

export const NEURONS = [
  { file: 'Scnn1a_473845048_m.swc', line: 'Scnn1a-Tg3-Cre', id: '473845048' },
  { file: 'Rorb_325404214_m.swc',   line: 'Rorb-IRES2-Cre', id: '325404214' },
  { file: 'Nr5a1_471087815_m.swc',  line: 'Nr5a1-Cre',      id: '471087815' },
  { file: 'Pvalb_470522102_m.swc',  line: 'Pvalb-IRES-Cre', id: '470522102' },
  { file: 'Pvalb_469628681_m.swc',  line: 'Pvalb-IRES-Cre', id: '469628681' },
];
const SWC_DIR = 'neuron/';
const SWC_FALLBACK = 'https://raw.githubusercontent.com/AllenInstitute/bmtk/develop/examples/bio_components/morphologies/';

// Where each cell sits: x/y as fractions of the viewport, size as a fraction of
// the viewport height, base pose [tiltX, yaw, tiltZ] (radians), the direction
// it turns while scrolling, how far it drifts vertically over the page, and
// when its action potential starts (fraction of the scroll range; each cell
// fires over FIRE_WINDOW of the range, so the wave cascades across the field).
const LAYOUT = [
  { x: 0.11, y: 0.52, size: 0.80, pose: [0.95, 0.60, -0.35], dir:  1, drift:  0.06, start: 0.00 },
  { x: 0.86, y: 0.58, size: 0.62, pose: [0.80, 2.60, -0.20], dir: -1, drift: -0.08, start: 0.10 },
  { x: 0.60, y: 0.20, size: 0.48, pose: [1.10, 3.40,  0.10], dir:  1, drift:  0.10, start: 0.20 },
  { x: 0.38, y: 0.84, size: 0.44, pose: [0.60, 1.80,  0.20], dir: -1, drift: -0.05, start: 0.30 },
  { x: 0.52, y: 0.50, size: 0.36, pose: [0.50, 0.90,  0.40], dir:  1, drift:  0.08, start: 0.40 },
];
const FIRE_WINDOW = 0.6;
const PULSE_W = 0.07;           // width of the travelling pulse, in local progress
const MAX_DPR = 1.5, IDLE_FPS = 30;

const PHASES = [
  [0.05, 'resting potential · −70 mV'],
  [0.44, 'dendrites · synaptic input summing'],
  [0.54, 'soma · threshold reached, spike'],
  [0.98, 'axon · action potential propagating'],
  [Infinity, 'axon terminals · neurotransmitter release'],
];
const phaseFor = (q) => PHASES.find(([lim]) => q < lim)[1];
const clamp01 = (v) => Math.min(1, Math.max(0, v));

async function loadSWC(file) {
  for (const base of [SWC_DIR, SWC_FALLBACK]) {
    try {
      const r = await fetch(base + file);
      if (r.ok) { const t = await r.text(); if (/^\s*\d+\s+1\s/m.test(t)) return t; }
    } catch (e) { /* try the next source */ }
  }
  throw new Error('no swc: ' + file);
}

// SWC: one node per line "id type x y z r parent"; type 1 soma, 2 axon, 3 basal
// dendrite, 4 apical dendrite.
function parse(txt) {
  const map = new Map(), list = [];
  for (const raw of txt.split('\n')) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const p = line.split(/\s+/);
    if (p.length < 7) continue;
    const n = { id: +p[0], type: +p[1], x: +p[2], y: +p[3], z: +p[4], r: +p[5], parent: +p[6], dist: 0 };
    map.set(n.id, n); list.push(n);
  }
  if (!list.length) throw new Error('empty swc');
  const soma = list.find(n => n.type === 1) || list[0];
  const sx = soma.x, sy = soma.y, sz = soma.z;
  for (const n of list) { n.x -= sx; n.y = -(n.y - sy); n.z -= sz; }     // soma at origin, y up
  for (const n of list) {                                                  // path distance from soma
    const par = map.get(n.parent);
    if (par) { const dx = n.x - par.x, dy = n.y - par.y, dz = n.z - par.z; n.dist = par.dist + Math.sqrt(dx * dx + dy * dy + dz * dz); }
  }
  return { list, map, soma };
}

const cssColor = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name) || fallback).trim() || fallback;

export async function mountNeuron({ canvas, phaseEl, statusEl, listEl, mainEl }) {
  const THREE = await import('./vendor/three.module.min.js');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) { throw new Error('no webgl'); }
  renderer.setPixelRatio(Math.min(MAX_DPR, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd8de, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2, 3, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, .6); fill.position.set(-3, -1, -2); scene.add(fill);

  // Camera looks straight at the z=0 plane; everything is placed in that plane's
  // units, so viewport fractions map to world positions in layout().
  const CAM_DIST = 1000;
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 10000);
  camera.position.set(0, 0, CAM_DIST);
  const visibleH = 2 * CAM_DIST * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  const colors = { rest: new THREE.Color(), somaRest: new THREE.Color(), pulse: new THREE.Color(), done: new THREE.Color() };
  const c = new THREE.Color();
  function readTheme() {
    colors.rest.set(cssColor('--neuron-rest', '#a9b5bf'));
    colors.somaRest.set(cssColor('--neuron-soma', '#97a4af'));
    colors.pulse.set(cssColor('--gold', '#B6862C'));
    colors.done.copy(colors.pulse).lerp(colors.rest, 0.35);
  }
  readTheme();

  const geo = new THREE.CylinderGeometry(1, 1, 1, 7, 1, true);
  const mat = new THREE.MeshStandardMaterial({ roughness: .55, metalness: 0 });
  const somaMat = new THREE.MeshStandardMaterial({ roughness: .5 });
  const cells = [];                       // { outer, mesh, somaMesh, segs, L, slot, lastQ }
  let points = 0;

  function buildCell(parsed, slot) {
    const { list, map, soma } = parsed;
    const segs = list.filter(n => n.parent > 0 && map.has(n.parent) && n.type !== 1);
    let maxD = 0, maxA = 0;
    for (const n of segs) { if (n.type === 2) maxA = Math.max(maxA, n.dist); else maxD = Math.max(maxD, n.dist); }
    // Firing schedule: distal dendrites first (synaptic input) -> soma at .46 -> axon outward.
    for (const n of segs) n.t = n.type === 2 ? 0.52 + 0.48 * n.dist / (maxA || 1) : 0.46 * (1 - n.dist / (maxD || 1));

    const mesh = new THREE.InstancedMesh(geo, mat, segs.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
    segs.forEach((n, i) => {
      const p = map.get(n.parent);
      dir.set(n.x - p.x, n.y - p.y, n.z - p.z);
      const len = dir.length() || 0.01; dir.normalize();
      q.setFromUnitVectors(up, dir);
      pos.set((n.x + p.x) / 2, (n.y + p.y) / 2, (n.z + p.z) / 2);
      const r = Math.max(n.type === 2 ? 0.9 : 1.4, Math.min(n.r, p.r) * 2.4);
      scl.set(r, len * 1.05, r);
      m.compose(pos, q, scl); mesh.setMatrixAt(i, m);
    });
    const somaMesh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(soma.r, 5) * 1.1, 24, 18), somaMat.clone());

    const inner = new THREE.Group(); inner.add(mesh); inner.add(somaMesh);
    const box = new THREE.Box3();
    for (const n of list) box.expandByPoint(new THREE.Vector3(n.x, n.y, n.z));
    const size = box.getSize(new THREE.Vector3());
    inner.position.sub(box.getCenter(new THREE.Vector3()));
    const outer = new THREE.Group(); outer.add(inner); scene.add(outer);

    const cell = { outer, mesh, somaMesh, segs, L: Math.max(size.x, size.y, size.z) || 1, slot, lastQ: -1 };
    cells.push(cell);
    points += list.length;
    return cell;
  }

  // Place every cell for the current viewport (called on resize and when a cell arrives).
  let visibleW = visibleH;
  function layout() {
    for (const cell of cells) {
      const s = cell.slot;
      cell.outer.scale.setScalar((s.size * visibleH) / cell.L);
      cell.outer.position.z = (cells.indexOf(cell) % 2 ? -1 : 1) * 40;
      cell.baseX = (s.x - 0.5) * visibleW;
      cell.baseY = (0.5 - s.y) * visibleH;
    }
  }

  // The content column starts right of the "gutter"; behind it the field is dimmed by a CSS mask
  // (see .field canvas in warm-lab.css), aligned here to the column's real left edge.
  function syncEdge() {
    if (!mainEl) return;
    const r = mainEl.getBoundingClientRect(), pl = parseFloat(getComputedStyle(mainEl).paddingLeft) || 0;
    canvas.style.setProperty('--field-edge', Math.round(r.left + pl) + 'px');
  }

  let dirty = true, dead = false, raf = 0, lastP = -1, lastPhase = '', lastFrame = 0;
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    visibleW = visibleH * camera.aspect;
    layout(); syncEdge();
    dirty = true;
  }

  function paintCell(cell, q) {
    const { mesh, segs, somaMesh } = cell;
    for (let i = 0; i < segs.length; i++) {
      const d = q - segs[i].t;
      if (d >= 0 && d < PULSE_W) c.copy(colors.done).lerp(colors.pulse, 1 - d / PULSE_W);
      else if (d >= PULSE_W) c.copy(colors.done);
      else c.copy(colors.rest);
      mesh.setColorAt(i, c);
    }
    mesh.instanceColor.needsUpdate = true;
    const sd = q - 0.46;
    somaMesh.material.color.copy(sd >= 0 && sd < 0.08 ? colors.pulse : sd >= 0.08 ? colors.done : colors.somaRest);
    cell.lastQ = q;
  }
  function progress() {
    const se = document.scrollingElement || document.documentElement;
    const max = se.scrollHeight - se.clientHeight;
    return max > 0 ? clamp01(se.scrollTop / max) : 0;
  }
  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function frame(now) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const p = progress();
    const changed = p !== lastP || dirty;
    if (!changed && (reducedMotion || now - lastFrame < 1000 / IDLE_FPS)) return;
    lastFrame = now; lastP = p;
    cells.forEach((cell, i) => {
      const s = cell.slot;
      const q = clamp01((p - s.start) / FIRE_WINDOW);
      if (q !== cell.lastQ || dirty) paintCell(cell, q);
      const idle = reducedMotion ? 0 : now * 0.00006 * s.dir;
      cell.outer.rotation.set(s.pose[0], s.pose[1] + s.dir * p * Math.PI * 0.9 + idle, s.pose[2], 'ZXY');
      cell.outer.position.x = cell.baseX;
      cell.outer.position.y = cell.baseY + (p - 0.5) * s.drift * visibleH;
      if (i === 0 && phaseEl) { const ph = phaseFor(q); if (ph !== lastPhase) { phaseEl.textContent = ph; lastPhase = ph; } }
    });
    renderer.render(scene, camera);
    dirty = false;
  }
  function start() { if (!raf && !dead) raf = requestAnimationFrame(frame); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  resize();
  window.addEventListener('resize', resize);
  const ro = ('ResizeObserver' in window && mainEl) ? new ResizeObserver(syncEdge) : null;
  if (ro) ro.observe(mainEl);
  const mo = new MutationObserver(() => { readTheme(); dirty = true; });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else { dirty = true; start(); } });
  start();

  // Load every morphology in parallel and add each one as it arrives.
  const loaded = [];
  await Promise.all(NEURONS.map(async (info, i) => {
    try {
      const parsed = parse(await loadSWC(info.file));
      if (dead) return;
      buildCell(parsed, LAYOUT[i % LAYOUT.length]);
      loaded.push(info);
      layout(); dirty = true;
      if (statusEl) statusEl.textContent = `Allen Cell Types · ${cells.length} cell${cells.length === 1 ? '' : 's'} · ${points.toLocaleString()} points`;
      if (listEl) listEl.textContent = NEURONS.filter(n => loaded.includes(n)).map(n => `${n.line} ${n.id}`).join(' · ');
    } catch (e) { /* that cell stays out; the others still render */ }
  }));
  if (!cells.length) throw new Error('no morphologies');

  return function destroy() {
    dead = true; stop();
    if (ro) ro.disconnect(); mo.disconnect();
    window.removeEventListener('resize', resize);
    renderer.dispose(); geo.dispose(); mat.dispose();
  };
}
