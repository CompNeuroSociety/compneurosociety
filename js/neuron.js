// Neuron chain: real Allen Institute reconstructions (neuron/*.swc) drawn with
// three.js into a fixed, full-viewport canvas that sits BEHIND the page content,
// joined end to end into a chain: each cell's axon terminal touches a dendrite
// tip of the next cell (a bouton marks the synapse). Scrolling pushes one
// action potential down the chain: synaptic input sums along the first cell's
// dendrites (distal first), its soma reaches threshold, the spike runs down its
// axon, crosses the synapse into the next cell's dendrites, and so on until the
// last cell. Each cell is turned so its axon points toward where the next cell
// goes, the next cell is placed so its chosen dendrite tip lands on that axon
// terminal, and the finished chain is scaled to fit the viewport.
// Loaded lazily by js/site.js only on screens wider than 900px.
//
// To add a cell: download its SWC from the Allen Cell Types database
// (celltypes.brain-map.org -> specimen -> "Download morphology"), drop it in
// neuron/, add an entry to NEURONS (chain order = list order) and a slot to
// LAYOUT. Colors come from CSS custom properties (--neuron-rest, --neuron-soma,
// --gold) so the light/dark switch in js/theme.js repaints the chain too.

export const NEURONS = [
  { file: 'Scnn1a_473845048_m.swc', line: 'Scnn1a-Tg3-Cre', id: '473845048' },
  { file: 'Rorb_325404214_m.swc',   line: 'Rorb-IRES2-Cre', id: '325404214' },
  { file: 'Nr5a1_471087815_m.swc',  line: 'Nr5a1-Cre',      id: '471087815' },
  { file: 'Pvalb_470522102_m.swc',  line: 'Pvalb-IRES-Cre', id: '470522102' },
  { file: 'Pvalb_469628681_m.swc',  line: 'Pvalb-IRES-Cre', id: '469628681' },
];
const SWC_DIR = 'neuron/';
const SWC_FALLBACK = 'https://raw.githubusercontent.com/AllenInstitute/bmtk/develop/examples/bio_components/morphologies/';

// Chain order with, per cell, the direction the chain should head next (x/y as
// fractions of the viewport, only their relative positions matter), the size as
// a fraction of the viewport height, and the lean [tiltX, tiltZ] (radians). The
// yaw and a roll about the view axis are solved automatically so the axon points
// toward the next cell and the dendrites face the previous one; the cells are
// then placed end to end and the whole chain is fitted to the viewport.
const LAYOUT = [
  { x: 0.06, y: 0.50, size: 0.60, tilt: [0.95, -0.35] },
  { x: 0.30, y: 0.30, size: 0.46, tilt: [0.60,  0.20] },
  { x: 0.54, y: 0.62, size: 0.48, tilt: [1.00,  0.10] },
  { x: 0.76, y: 0.32, size: 0.52, tilt: [0.80, -0.20] },
  { x: 0.96, y: 0.58, size: 0.42, tilt: [0.50,  0.30] },
];
const GAP = 0.035;              // share of the scroll range each synapse takes
const FIT = { left: 0.015, right: 0.985, top: 0.03, bottom: 0.97 };   // viewport box the chain is fitted into
const PULSE_W = 0.07;           // width of the travelling pulse, in a cell's local progress
const SWAY = 0.05, DRIFT = 0.04;   // idle sway (rad) and shared vertical parallax (of viewport height)
const MAX_DPR = 1.5, IDLE_FPS = 30;

const PHASES = [
  [0.05, 'resting potential · −70 mV'],
  [0.44, 'dendrites · synaptic input summing'],
  [0.54, 'soma · threshold reached, spike'],
  [0.98, 'axon · action potential propagating'],
  [Infinity, 'axon terminal · neurotransmitter release'],
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
    const n = { id: +p[0], type: +p[1], x: +p[2], y: +p[3], z: +p[4], r: +p[5], parent: +p[6], dist: 0, kids: 0 };
    map.set(n.id, n); list.push(n);
  }
  if (!list.length) throw new Error('empty swc');
  const soma = list.find(n => n.type === 1) || list[0];
  const sx = soma.x, sy = soma.y, sz = soma.z;
  for (const n of list) { n.x -= sx; n.y = -(n.y - sy); n.z -= sz; }     // soma at origin, y up
  for (const n of list) {                                                  // path distance from soma
    const par = map.get(n.parent);
    if (par) { par.kids++; const dx = n.x - par.x, dy = n.y - par.y, dz = n.z - par.z; n.dist = par.dist + Math.sqrt(dx * dx + dy * dy + dz * dz); }
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

  // Orthographic camera looking straight at the z=0 plane: the viewport is
  // visibleW x visibleH world units, so screen fractions map straight to world
  // positions, and two points with the same x/y meet on screen whatever their depth
  // (the joined axon/dendrite tips sit at different depths after the cells are posed).
  const visibleH = 536;
  let visibleW = visibleH;
  const camera = new THREE.OrthographicCamera(-visibleH / 2, visibleH / 2, visibleH / 2, -visibleH / 2, 1, 10000);
  camera.position.set(0, 0, 1000);

  const colors = { rest: new THREE.Color(), somaRest: new THREE.Color(), pulse: new THREE.Color(), done: new THREE.Color() };
  const c = new THREE.Color();
  function readTheme() {
    colors.rest.set(cssColor('--neuron-rest', '#a9b5bf'));
    colors.somaRest.set(cssColor('--neuron-soma', '#97a4af'));
    colors.pulse.set(cssColor('--gold', '#B6862C'));
    colors.done.copy(colors.pulse).lerp(colors.rest, 0.35);
  }
  readTheme();

  const tubeGeo = new THREE.CylinderGeometry(1, 1, 1, 7, 1, true);
  const mat = new THREE.MeshStandardMaterial({ roughness: .55, metalness: 0 });
  const somaMat = new THREE.MeshStandardMaterial({ roughness: .5 });
  const slots = [];                       // slots[i] = cell i of NEURONS once it has loaded
  let chain = [], links = [], points = 0;

  function buildCell(parsed, i) {
    const { list, map, soma } = parsed;
    const segs = list.filter(n => n.parent > 0 && map.has(n.parent) && n.type !== 1);
    let maxD = 0, maxA = 0;
    for (const n of segs) { if (n.type === 2) maxA = Math.max(maxA, n.dist); else maxD = Math.max(maxD, n.dist); }
    // Firing schedule inside the cell: distal dendrites first (synaptic input) -> soma at .46 -> axon outward.
    for (const n of segs) n.t = n.type === 2 ? 0.52 + 0.48 * n.dist / (maxA || 1) : 0.46 * (1 - n.dist / (maxD || 1));

    const mesh = new THREE.InstancedMesh(tubeGeo, mat, segs.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
    segs.forEach((n, k) => {
      const p = map.get(n.parent);
      dir.set(n.x - p.x, n.y - p.y, n.z - p.z);
      const len = dir.length() || 0.01; dir.normalize();
      q.setFromUnitVectors(up, dir);
      pos.set((n.x + p.x) / 2, (n.y + p.y) / 2, (n.z + p.z) / 2);
      const r = Math.max(n.type === 2 ? 0.9 : 1.4, Math.min(n.r, p.r) * 2.4);
      scl.set(r, len * 1.05, r);
      m.compose(pos, q, scl); mesh.setMatrixAt(k, m);
    });
    const somaMesh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(soma.r, 5) * 1.1, 24, 18), somaMat.clone());

    // inner: the morphology centered on its bounding box; outer: the designed lean + solved yaw;
    // spin: the solved roll about the view axis, plus the cell's position and scale.
    const inner = new THREE.Group(); inner.add(mesh); inner.add(somaMesh);
    const box = new THREE.Box3();
    for (const n of list) box.expandByPoint(new THREE.Vector3(n.x, n.y, n.z));
    const size = box.getSize(new THREE.Vector3());
    inner.position.sub(box.getCenter(new THREE.Vector3()));
    const outer = new THREE.Group(); outer.add(inner);
    const spin = new THREE.Group(); spin.add(outer); scene.add(spin);

    // Where the signal leaves (axon terminal = farthest axon node) and where it can arrive (dendrite tips).
    const axon = segs.filter(n => n.type === 2);
    const tipOf = (n) => new THREE.Vector3(n.x, n.y, n.z);
    const farthest = (arr) => arr.reduce((a, b) => (b.dist > a.dist ? b : a));
    const axonTip = tipOf(farthest(axon.length ? axon : segs));
    const dendTips = segs.filter(n => n.type !== 2 && n.kids === 0).map(tipOf);
    if (!dendTips.length) dendTips.push(tipOf(farthest(segs)));

    slots[i] = { index: i, slot: LAYOUT[i % LAYOUT.length], spin, outer, inner, mesh, somaMesh, segs, axonTip, dendTips,
      inputTip: dendTips[0], yaw: 0, roll: 0, L: Math.max(size.x, size.y, size.z) || 1, lastQ: -1 };
    points += list.length;
  }

  // Chain timing: cell k fires during [start_k, start_k + W]; the synapse to the next cell takes GAP.
  let W = 1;
  const startOf = (k) => k * (W + GAP);

  // --- Geometry of the chain ---------------------------------------------------------------
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), eul = new THREE.Euler();
  let driftY = 0;
  function placeCells() {
    for (const cell of chain) {
      const s = cell.slot;
      cell.scaleBase = (s.size * visibleH) / cell.L;
      cell.spin.scale.setScalar(cell.scaleBase);
      cell.baseX = (s.x - 0.5) * visibleW; cell.baseY = (0.5 - s.y) * visibleH; cell.baseZ = (cell.index % 2 ? -1 : 1) * 30;
      cell.spin.position.set(cell.baseX, cell.baseY, cell.baseZ);
    }
  }
  // Screen-plane offset of a local point from the cell's centre under the lean + a given yaw (before the roll).
  function screenVec(cell, local, yaw, out) {
    out.copy(local).add(cell.inner.position);
    eul.set(cell.slot.tilt[0], yaw, cell.slot.tilt[1], 'ZXY');
    out.applyEuler(eul); out.z = 0;
    return out;
  }
  const angle = (v) => Math.atan2(v.y, v.x);
  // Pose every cell: the yaw (about the cell's own up axis) and a roll about the view
  // axis are searched together so the axon points toward the next cell AND the dendrites
  // face the previous one; the first cell only aims its axon, the last only its dendrites.
  function aimCells() {
    const toNext = new THREE.Vector3(), toPrev = new THREE.Vector3(), dendCentroid = new THREE.Vector3();
    const STEPS = 72, TWO_PI = Math.PI * 2;
    chain.forEach((cell, k) => {
      const next = chain[k + 1], prev = chain[k - 1];
      if (next) toNext.subVectors(next.spin.position, cell.spin.position).setZ(0).normalize();
      if (prev) toPrev.subVectors(prev.spin.position, cell.spin.position).setZ(0).normalize();
      dendCentroid.set(0, 0, 0);
      for (const t of cell.dendTips) dendCentroid.add(t);
      dendCentroid.divideScalar(cell.dendTips.length || 1);
      const axonLen = tmp.copy(cell.axonTip).add(cell.inner.position).length() || 1;
      const dendLen = tmp.copy(dendCentroid).add(cell.inner.position).length() || 1;
      let best = -Infinity, bestYaw = 0, bestRoll = 0;
      for (let i = 0; i < STEPS; i++) {
        const yaw = (i / STEPS) * TWO_PI;
        const ax = screenVec(cell, cell.axonTip, yaw, tmp), dd = screenVec(cell, dendCentroid, yaw, tmp2);
        const axL = ax.length() || 1e-6, ddL = dd.length() || 1e-6;
        const axA = angle(ax), ddA = angle(dd);
        // candidate rolls: aim the axon exactly, aim the dendrites exactly, or sweep
        const rolls = [];
        if (next) rolls.push(angle(toNext) - axA);
        if (prev) rolls.push(angle(toPrev) - ddA);
        for (let j = 0; j < STEPS; j++) rolls.push((j / STEPS) * TWO_PI);
        for (const roll of rolls) {
          let score = 0;
          if (next) score += Math.cos(axA + roll - angle(toNext)) * 1.0 + 0.3 * (axL / axonLen);
          if (prev) score += Math.cos(ddA + roll - angle(toPrev)) * 1.0 + 0.3 * (ddL / dendLen);
          if (score > best) { best = score; bestYaw = yaw; bestRoll = roll; }
        }
      }
      cell.yaw = bestYaw; cell.roll = bestRoll;
      cell.outer.rotation.set(cell.slot.tilt[0], bestYaw, cell.slot.tilt[1], 'ZXY');
      cell.spin.rotation.z = bestRoll;
      // The synapse lands on the dendrite tip that reaches farthest toward the previous cell.
      if (prev) {
        const ca = Math.cos(bestRoll), sa = Math.sin(bestRoll);
        let bestTip = -Infinity;
        for (const t of cell.dendTips) {
          const v = screenVec(cell, t, bestYaw, tmp);
          const sc = (v.x * ca - v.y * sa) * toPrev.x + (v.x * sa + v.y * ca) * toPrev.y;
          if (sc > bestTip) { bestTip = sc; cell.inputTip = t; }
        }
      }
    });
    scene.updateMatrixWorld(true);
  }
  // Put the cells end to end: cell k+1 is moved so its input dendrite tip sits on cell k's axon terminal.
  function chainCells() {
    for (let k = 0; k < chain.length; k++) {
      const cell = chain[k];
      if (k === 0) { cell.spin.position.set(cell.baseX, cell.baseY + driftY, cell.baseZ); cell.spin.updateMatrixWorld(true); continue; }
      const prev = chain[k - 1];
      prev.inner.localToWorld(a.copy(prev.axonTip));
      cell.spin.position.set(0, 0, 0); cell.spin.updateMatrixWorld(true);
      cell.inner.localToWorld(b.copy(cell.inputTip));          // the tip's offset from the cell's origin
      cell.spin.position.subVectors(a, b).setZ(cell.baseZ);
      cell.spin.updateMatrixWorld(true);
    }
  }
  // Scale and shift the assembled chain so it fits the viewport (FIT box), keeping the ends joined.
  function fitChain() {
    if (!chain.length) return;
    driftY = 0;
    const bbox = () => {
      const box = new THREE.Box3();
      for (const cell of chain) {
        box.expandByPoint(cell.inner.localToWorld(tmp.copy(cell.axonTip)));
        for (const t of cell.dendTips) box.expandByPoint(cell.inner.localToWorld(tmp.copy(t)));
      }
      return box;
    };
    chainCells();
    let box = bbox();
    const boxW = (FIT.right - FIT.left) * visibleW, boxH = (FIT.bottom - FIT.top) * visibleH;
    const sz = box.getSize(tmp2);
    const f = Math.min(1.6, boxW / (sz.x || 1), boxH / (sz.y || 1));   // grow (up to 1.6x) or shrink to fill the box
    for (const cell of chain) cell.spin.scale.setScalar(cell.scaleBase * f);
    chainCells(); box = bbox();
    const lead = chain[0];
    lead.baseX += (FIT.left - 0.5) * visibleW - box.min.x;
    lead.baseY += (0.5 - (FIT.top + FIT.bottom) / 2) * visibleH - (box.min.y + box.max.y) / 2;
    chainCells();
  }
  function buildLinks() {
    for (const l of links) { scene.remove(l.bouton, l.spark); l.bouton.material.dispose(); l.spark.material.dispose(); }
    links = [];
    for (let k = 0; k + 1 < chain.length; k++) {
      const bouton = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ roughness: .5 }));
      const spark = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ roughness: .3, transparent: true, opacity: .85 }));
      spark.visible = false;
      scene.add(bouton, spark);
      links.push({ from: chain[k], to: chain[k + 1], bouton, spark, lastG: null });
    }
  }
  function assemble() {
    chain = slots.filter(Boolean);
    W = chain.length ? (1 - GAP * (chain.length - 1)) / chain.length : 1;
    placeCells(); aimCells(); fitChain(); buildLinks();
    const p = progress();
    chain.forEach((cell, k) => { if (cell.lastQ < 0) paintCell(cell, clamp01((p - startOf(k)) / W)); });
    dirty = true;
  }

  // The content column starts right of the "gutter"; behind it the canvas is dimmed by a CSS mask
  // (see .field canvas in warm-lab.css), aligned here to the column's real left edge.
  function syncEdge() {
    if (!mainEl) return;
    const r = mainEl.getBoundingClientRect(), pl = parseFloat(getComputedStyle(mainEl).paddingLeft) || 0;
    canvas.style.setProperty('--field-edge', Math.round(r.left + pl) + 'px');
  }

  let dirty = true, dead = false, raf = 0, lastP = -1, lastLabel = '', lastFrame = 0;
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    visibleW = visibleH * (w / h);
    camera.left = -visibleW / 2; camera.right = visibleW / 2; camera.updateProjectionMatrix();
    if (chain.length) { placeCells(); aimCells(); fitChain(); }
    syncEdge();
    dirty = true;
  }

  // --- Painting --------------------------------------------------------------------------------
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
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  function paintLink(l, g) {
    // g < 0: not yet; 0..1: the signal is crossing the synapse; > 1: done
    const crossing = g >= 0 && g <= 1;
    l.bouton.material.color.copy(g < 0 ? colors.somaRest : crossing ? colors.pulse : colors.done);
    l.spark.visible = crossing;
    l.spark.material.color.copy(colors.pulse);
    l.lastG = g;
  }
  function updateLinks(p) {
    for (let k = 0; k < links.length; k++) {
      const l = links[k];
      l.from.inner.localToWorld(a.copy(l.from.axonTip));            // the junction: axon terminal == next dendrite tip
      const r = 2.2 * Math.max(0.6, l.from.spin.scale.x / (l.from.scaleBase || 1));
      l.bouton.position.copy(a); l.bouton.scale.setScalar(r * 1.3);
      const g = (p - (startOf(k) + W)) / GAP;
      if (g >= 0 && g <= 1) { l.spark.position.copy(a); l.spark.scale.setScalar(r * (1.6 + 2.2 * Math.sin(Math.PI * g))); }
      if (g !== l.lastG || dirty) paintLink(l, g);
    }
  }
  function labelFor(p) {
    const N = chain.length;
    if (!N || p < 0.015) return 'resting potential · −70 mV';
    for (let k = 0; k < N; k++) {
      const s = startOf(k);
      if (p <= s + W || k === N - 1) return `neuron ${k + 1}/${N} · ${phaseFor(clamp01((p - s) / W))}`;
      if (p < s + W + GAP) return `synapse ${k + 1}→${k + 2} · neurotransmitter release`;
    }
    return '';
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
    chain.forEach((cell, k) => {
      const q = clamp01((p - startOf(k)) / W);
      if (q !== cell.lastQ || dirty) paintCell(cell, q);
      const sway = reducedMotion ? 0 : SWAY * Math.sin(now * 0.0004 + k * 1.7);
      cell.outer.rotation.set(cell.slot.tilt[0], cell.yaw + sway, cell.slot.tilt[1], 'ZXY');
    });
    driftY = (p - 0.5) * DRIFT * visibleH;
    chainCells();                       // keeps the ends joined while the cells sway
    updateLinks(p);
    if (phaseEl) { const t = labelFor(p); if (t !== lastLabel) { phaseEl.textContent = t; lastLabel = t; } }
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

  // Load every morphology in parallel; the chain is (re)assembled as each one arrives.
  const loaded = new Set();
  await Promise.all(NEURONS.map(async (info, i) => {
    try {
      const parsed = parse(await loadSWC(info.file));
      if (dead) return;
      buildCell(parsed, i);
      loaded.add(i);
      assemble();
      if (statusEl) statusEl.textContent = `Allen Cell Types · ${chain.length} cell${chain.length === 1 ? '' : 's'} · ${points.toLocaleString()} points`;
      if (listEl) listEl.textContent = 'signal path ' + NEURONS.filter((n, k) => loaded.has(k)).map(n => `${n.line} ${n.id}`).join(' → ');
    } catch (e) { /* that cell stays out of the chain; the others still link up */ }
  }));
  if (!chain.length) throw new Error('no morphologies');

  return function destroy() {
    dead = true; stop();
    if (ro) ro.disconnect(); mo.disconnect();
    window.removeEventListener('resize', resize);
    renderer.dispose(); tubeGeo.dispose(); mat.dispose();
  };
}
