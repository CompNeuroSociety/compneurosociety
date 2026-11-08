// plot3d.js: a tiny dependency-free canvas 3-D engine shared by both Lab Match charts
// (viz-cube.js, viz-types.js). Plain 2-D canvas, no WebGL.
//
//   const plot = createPlot3D(canvas, {camera, fit, padding, onHover, onSelect, ...});
//   plot.setScene({points, segments, labels, halos}, {animate: true});
//   plot.setCamera({yaw, pitch, zoom}, {animate: true});
//
// Scene items all carry a stable `id`, so setScene() can tween from the old scene to the new one
// (about 600 ms, ease-in-out; skipped under prefers-reduced-motion).
//   point   {id, pos:[x,y,z] in [-1,1]^3, r, fill, hollow, alpha, ring, outline, shape, z,
//            label, labelPriority, labelColor, labelFont, labelSize, labelWeight, labelPlacement,
//            labelLeader (true: if no free spot next to the dot, put the label in a column beside the
//            cluster with a 1px leader line; labelLeaderColor, default var(--rule-dark)), pickable, data}
//   segment {id, a, b, color, width, alpha}         a / b: [x,y,z] or the id of a point
//   label   {id, pos, text, font "sans"|"mono", size, weight, color, align, priority,
//            offset:[dx,dy], away:[x,y,z], gap, nudge}
//   halo    {id, points:[[x,y,z],...], color, alpha}  soft 2-sigma ellipse, drawn behind everything
// Colors may be any CSS color or "var(--token)"; they are resolved with getComputedStyle and
// re-resolved when <html data-theme> changes. A fill may also be {mix: [[color, weight], ...]}:
// the weighted blend in OKLab (used for the student's point in viz 2).
//
// Camera {yaw, pitch, zoom}: rotate about the vertical axis by yaw, then about the horizontal axis
// by pitch; orthographic with a slight perspective; fitted to the canvas ("box": the [-1,1]^3 cube,
// "sphere": a ball around the scene, steady while rotating; "cylinder": steady while turning about
// the vertical axis, re-fitted as the pitch changes, so a flat wide scene fills the frame). Renders on demand only: an rAF loop
// runs only while a tween or the optional, time-limited auto-rotate is active.

const DUR = 600;
const TAU = Math.PI * 2;
export const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'triangle-down', 'pentagon', 'hexagon'];

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const isVec = (v) => Array.isArray(v) && v.length === 3;
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

// ---------------------------------------------------------------------------------- colors
let probe = null;
/** Any CSS color -> [r, g, b, a] (0..255, alpha 0..1), via a 1x1 canvas. */
export function rgbaOf(color) {
  if (!probe) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    probe = c.getContext('2d', { willReadFrequently: true });
  }
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = '#000';
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
}
const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const toSrgb = (c) => Math.round(clamp(c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055, 0, 1) * 255);
function rgbToOklab(rgb) {
  const r = toLin(rgb[0]), g = toLin(rgb[1]), b = toLin(rgb[2]);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function oklabToRgb(lab) {
  const [L, a, b] = lab;
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
}
/** Weighted blend of CSS colors (already resolved) in OKLab -> "rgb(r, g, b)". */
export function blendOklab(pairs) {
  let w = 0;
  const acc = [0, 0, 0];
  for (const [color, weight] of pairs) {
    const k = Math.max(0, num(weight, 0));
    if (!k) continue;
    const lab = rgbToOklab(rgbaOf(color));
    acc[0] += lab[0] * k; acc[1] += lab[1] * k; acc[2] += lab[2] * k;
    w += k;
  }
  if (!w) return 'rgb(128, 128, 128)';
  const rgb = oklabToRgb([acc[0] / w, acc[1] / w, acc[2] / w]);
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}
const rgbaStr = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${clamp(a, 0, 1).toFixed(3)})`;

// ---------------------------------------------------------------------------------- shapes
function shapePath(ctx, shape, x, y, r) {
  ctx.beginPath();
  switch (shape) {
    case 'square': { const h = r * 0.886; ctx.rect(x - h, y - h, 2 * h, 2 * h); break; }
    case 'diamond': { const d = r * 1.25; ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y); ctx.closePath(); break; }
    case 'triangle': case 'triangle-down': {
      const R = r * 1.42, s = shape === 'triangle' ? -1 : 1;
      for (let i = 0; i < 3; i++) {
        const a = s * Math.PI / 2 + i * TAU / 3;
        const px = x + R * Math.cos(a), py = y + R * Math.sin(a);
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'pentagon': case 'hexagon': {
      const n = shape === 'pentagon' ? 5 : 6, R = r * (n === 5 ? 1.12 : 1.08);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + i * TAU / n;
        const px = x + R * Math.cos(a), py = y + R * Math.sin(a);
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      break;
    }
    default: ctx.arc(x, y, Math.max(0.5, r), 0, TAU);
  }
}

// ---------------------------------------------------------------------------------- normalize
function normPoint(p) {
  return {
    ...p,
    pos: isVec(p.pos) ? p.pos.map((v) => num(v, 0)) : [0, 0, 0],
    r: Math.max(0.5, num(p.r, 5)),
    alpha: clamp(num(p.alpha, 1), 0, 1),
    fill: p.fill == null ? 'var(--ink)' : p.fill,
    shape: p.shape || 'circle',
    labelPriority: num(p.labelPriority, 0),
    z: num(p.z, 0),
  };
}
const normSegment = (s) => ({ ...s, width: num(s.width, 1), alpha: clamp(num(s.alpha, 1), 0, 1), color: s.color || 'var(--line)' });
const normLabel = (l) => ({ ...l, pos: isVec(l.pos) ? l.pos.map((v) => num(v, 0)) : [0, 0, 0], alpha: clamp(num(l.alpha, 1), 0, 1),
  size: num(l.size, 12), priority: num(l.priority, 0), text: String(l.text ?? '') });
const normHalo = (h) => ({ ...h, points: (h.points || []).filter(isVec), alpha: clamp(num(h.alpha, 0.1), 0, 1) });
const NORM = { points: normPoint, segments: normSegment, labels: normLabel, halos: normHalo };

function interp(kind, from, to, t) {
  if (t >= 1 || from === to) return to;
  const out = { ...to, alpha: lerp(from.alpha, to.alpha, t) };
  if (kind === 'points') { out.pos = lerp3(from.pos, to.pos, t); out.r = lerp(from.r, to.r, t); }
  else if (kind === 'labels') out.pos = lerp3(from.pos, to.pos, t);
  else if (kind === 'segments') {
    if (isVec(from.a) && isVec(to.a)) out.a = lerp3(from.a, to.a, t);
    if (isVec(from.b) && isVec(to.b)) out.b = lerp3(from.b, to.b, t);
    out.width = lerp(from.width, to.width, t);
  } else if (kind === 'halos' && from.points.length === to.points.length) {
    out.points = to.points.map((p, i) => lerp3(from.points[i], p, t));
  }
  return out;
}

// ---------------------------------------------------------------------------------- engine
export function createPlot3D(canvas, opts = {}) {
  const o = {
    camera: { yaw: 0, pitch: 0, zoom: 1 },
    fit: 'box',              // "box" | "sphere"
    radius: null,            // sphere fit radius (default: furthest point from the origin)
    padding: 16,             // number | {top,right,bottom,left} | (w, h) => either
    perspective: 0.08,       // 0 = orthographic
    pitchLimit: 1.35,
    zoomMin: 0.5,
    zoomMax: 4,
    hitRadius: 24,
    autoRotate: null,        // {speed: rad/s, duration: ms}
    ariaLabel: null,
    onHover: null,
    onSelect: null,
    onInteract: null,
    ...opts,
  };
  const ctx = canvas.getContext('2d');
  const reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduced = () => !!reduceMQ.matches;

  if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
  canvas.style.touchAction = 'pan-y';
  if (o.ariaLabel) canvas.setAttribute('aria-label', o.ariaLabel);

  let W = 0, H = 0, dpr = 1;
  let destroyed = false, raf = 0, rendered = false, fontsReady = false;
  const normCam = (c, base) => ({
    yaw: num(c && c.yaw, base.yaw),
    pitch: clamp(num(c && c.pitch, base.pitch), -o.pitchLimit, o.pitchLimit),
    zoom: clamp(num(c && c.zoom, base.zoom), o.zoomMin, o.zoomMax),
  });
  let cam = normCam(o.camera, { yaw: 0, pitch: 0, zoom: 1 });
  let home = { ...cam };
  let camAnim = null;          // {from, to, t0}
  const items = { points: new Map(), segments: new Map(), labels: new Map(), halos: new Map() };
  let sceneAnim = null;        // {t0}
  let sceneRadius = 1;
  let sceneCyl = [];   // [|y|, horizontal radius] per point/label, for fit: 'cylinder'
  let highlight = null, hoverId = null;
  let lastPts = [], placed = [];
  let lastFit = null;
  // optional, time-limited auto-rotate (paused offscreen, stopped by any interaction)
  const auto = { running: false, stopped: !o.autoRotate, left: o.autoRotate ? num(o.autoRotate.duration, 10000) : 0,
    speed: o.autoRotate ? num(o.autoRotate.speed, 0.12) : 0, last: 0, visible: false };

  // ---------------------------------------------------------------- color + font resolution
  let cs = null;
  let colorCache = new Map();
  const style = () => cs || (cs = getComputedStyle(canvas));
  function resolve(c) {
    if (c == null || c === false) return 'transparent';
    if (typeof c === 'object' && Array.isArray(c.mix)) {
      const key = JSON.stringify(c.mix);
      let v = colorCache.get(key);
      if (v === undefined) {
        v = blendOklab(c.mix.map(([col, w]) => [resolve(col), w]));
        colorCache.set(key, v);
      }
      return v;
    }
    const s = String(c);
    let v = colorCache.get(s);
    if (v !== undefined) return v;
    v = s;
    for (let guard = 0; guard < 6 && v.includes('var('); guard++) {
      v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g,
        (_, name, fb) => style().getPropertyValue(name).trim() || (fb ? fb.trim() : 'transparent'));
    }
    colorCache.set(s, v);
    return v;
  }
  const rgbCache = new Map();
  function rgbOf(c) {
    const s = resolve(c);
    let v = rgbCache.get(s);
    if (!v) { v = rgbaOf(s); rgbCache.set(s, v); }
    return v;
  }
  function family(kind) {
    const v = style().getPropertyValue(kind === 'mono' ? '--mono' : '--sans').trim();
    return v || (kind === 'mono' ? 'ui-monospace, monospace' : 'system-ui, sans-serif');
  }
  const fontOf = (l) => `${l.weight || (l.font === 'mono' ? 400 : 600)} ${l.size}px ${family(l.font === 'mono' ? 'mono' : 'sans')}`;
  const measureCache = new Map();
  function measure(font, text) {
    const k = font + '\u0000' + text;
    let w = measureCache.get(k);
    if (w === undefined) { ctx.font = font; w = ctx.measureText(text).width; measureCache.set(k, w); }
    return w;
  }
  function invalidateStyle() { cs = null; colorCache = new Map(); rgbCache.clear(); measureCache.clear(); }

  // ---------------------------------------------------------------- projection + fit
  function projector(c) {
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const k = o.perspective;
    return (p) => {
      const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy;
      const y2 = p[1] * cp - z1 * sp, z2 = p[1] * sp + z1 * cp;
      const f = 1 / Math.max(0.25, 1 - k * z2);
      return [x1 * f, y2 * f, z2, f];
    };
  }
  function padding() {
    let p = typeof o.padding === 'function' ? o.padding(W, H) : o.padding;
    if (typeof p === 'number') p = { top: p, right: p, bottom: p, left: p };
    return { top: num(p && p.top, 16), right: num(p && p.right, 16), bottom: num(p && p.bottom, 16), left: num(p && p.left, 16) };
  }
  const CUBE = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) CUBE.push([x, y, z]);
  function fitter(proj, c) {
    const pad = padding();
    const vw = Math.max(20, W - pad.left - pad.right), vh = Math.max(20, H - pad.top - pad.bottom);
    let x0, x1, y0, y1;
    if (o.fit === 'sphere') {
      const R = num(o.radius, sceneRadius);
      const e = R / Math.max(0.25, 1 - o.perspective * R);
      x0 = y0 = -e; x1 = y1 = e;
    } else if (o.fit === 'cylinder') {
      // steady while turning about the vertical axis (auto-rotate, sideways drags) and never
      // clipping: width from the scene's largest horizontal radius, height from its tallest extent
      // over every yaw at the current pitch. Tighter than 'sphere' for a flat, wide cloud.
      const f = 1 / Math.max(0.25, 1 - o.perspective * sceneRadius);
      const sp = Math.abs(Math.sin(c.pitch)), cp = Math.abs(Math.cos(c.pitch));
      let ex = 0, ey = 0;
      for (const [ay, rh] of sceneCyl) { ex = Math.max(ex, rh); ey = Math.max(ey, ay * cp + rh * sp); }
      ex = (ex || 1) * f; ey = (ey || 1) * f;
      x0 = -ex; x1 = ex; y0 = -ey; y1 = ey;
    } else {
      x0 = y0 = Infinity; x1 = y1 = -Infinity;
      for (const q of CUBE) {
        const u = proj(q);
        x0 = Math.min(x0, u[0]); x1 = Math.max(x1, u[0]); y0 = Math.min(y0, u[1]); y1 = Math.max(y1, u[1]);
      }
    }
    const s = Math.min(vw / Math.max(1e-6, x1 - x0), vh / Math.max(1e-6, y1 - y0)) * c.zoom;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ox = pad.left + vw / 2, oy = pad.top + vh / 2;
    return { s, toScreen: (u) => [ox + (u[0] - cx) * s, oy - (u[1] - cy) * s] };
  }

  // ---------------------------------------------------------------- scene state
  function sceneT(now) {
    if (!sceneAnim) return 1;
    const t = (now - sceneAnim.t0) / DUR;
    return t >= 1 ? 1 : ease(Math.max(0, t));
  }
  function finishScene() {
    for (const kind of Object.keys(items)) {
      for (const [id, e] of items[kind]) {
        if (e.dying) items[kind].delete(id);
        else e.from = e.to;
      }
    }
    sceneAnim = null;
  }
  function computeRadius() {
    let R = 0;
    sceneCyl = [];
    for (const kind of ['points', 'labels']) {
      for (const e of items[kind].values()) {
        if (e.dying) continue;
        const [x, y, z] = e.to.pos;
        R = Math.max(R, Math.hypot(x, y, z));
        sceneCyl.push([Math.abs(y), Math.hypot(x, z)]);
      }
    }
    sceneRadius = R > 0 ? R : 1;
  }

  function setScene(scene, { animate = false } = {}) {
    const now = performance.now();
    const t = sceneT(now);
    const anim = animate && !reduced() && rendered;
    for (const kind of Object.keys(items)) {
      const prev = items[kind];
      const next = new Map();
      for (const raw of (scene && scene[kind]) || []) {
        if (!raw || raw.id == null) continue;
        const to = NORM[kind](raw);
        const old = prev.get(raw.id);
        if (anim) {
          const from = old ? interp(kind, old.from, old.to, t) : { ...to, alpha: 0 };
          next.set(raw.id, { from, to });
        } else next.set(raw.id, { from: to, to });
      }
      if (anim) {
        for (const [id, old] of prev) {
          if (next.has(id)) continue;
          const cur = interp(kind, old.from, old.to, t);
          if (cur.alpha > 0.01) next.set(id, { from: cur, to: { ...cur, alpha: 0 }, dying: true });
        }
      }
      items[kind] = next;
    }
    sceneAnim = anim ? { t0: now } : null;
    computeRadius();
    if (hoverId != null && !items.points.has(hoverId)) setHover(null);
    requestRender();
  }

  function setCamera(c, { animate = false, home: setHome = true } = {}) {
    const to = normCam(c, cam);
    if (setHome) home = { ...to };
    if (animate && !reduced() && rendered) {
      const from = { ...cam, yaw: to.yaw + wrapPi(cam.yaw - to.yaw) };
      camAnim = { from, to, t0: performance.now() };
    } else {
      cam = to;
      camAnim = null;
    }
    requestRender();
  }

  // ---------------------------------------------------------------- render
  function requestRender() {
    if (destroyed || raf) return;
    raf = requestAnimationFrame(draw);
  }
  function render() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    draw();
  }

  function draw() {
    raf = 0;
    if (destroyed || !fontsReady || !W || !H) return;
    const now = performance.now();
    if (camAnim) {
      const t = (now - camAnim.t0) / DUR;
      if (t >= 1) { cam = { ...camAnim.to }; camAnim = null; }
      else {
        const e = ease(Math.max(0, t)), f = camAnim.from, g = camAnim.to;
        cam = { yaw: lerp(f.yaw, g.yaw, e), pitch: lerp(f.pitch, g.pitch, e), zoom: lerp(f.zoom, g.zoom, e) };
      }
    }
    if (auto.running) {
      const dt = auto.last ? Math.min(64, now - auto.last) : 0;
      auto.last = now;
      cam.yaw += (auto.speed * dt) / 1000;
      auto.left -= dt;
      if (auto.left <= 0) stopAutoRotate();
    }
    const st = sceneT(now);
    const proj = projector(cam);
    const fit = fitter(proj, cam);
    lastFit = fit;
    const bg = resolve('var(--bg)');

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // points first (state only), so segments can attach to them
    const pts = [];
    const posById = new Map();
    for (const [id, e] of items.points) {
      const s = interp('points', e.from, e.to, st);
      posById.set(id, s.pos);
      if (s.alpha <= 0.01) continue;
      const u = proj(s.pos);
      const [x, y] = fit.toScreen(u);
      const pf = clamp(1 + (u[3] - 1) * 0.6, 0.9, 1.12);
      const r = s.r >= 4 ? Math.max(4, s.r * pf) : s.r * pf;
      pts.push({ id, item: e.to, s, x, y, r, depth: u[2], alpha: s.alpha });
    }

    // 1. halos
    for (const e of items.halos.values()) {
      const h = interp('halos', e.from, e.to, st);
      if (h.points.length < 3 || h.alpha <= 0.002) continue;
      let mx = 0, my = 0;
      const sp = h.points.map((p) => fit.toScreen(proj(p)));
      for (const q of sp) { mx += q[0]; my += q[1]; }
      mx /= sp.length; my /= sp.length;
      let sxx = 0, syy = 0, sxy = 0;
      for (const q of sp) { const dx = q[0] - mx, dy = q[1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
      sxx /= sp.length; syy /= sp.length; sxy /= sp.length;
      const tr = (sxx + syy) / 2, disc = Math.sqrt(Math.max(0, tr * tr - (sxx * syy - sxy * sxy)));
      const rx = 2 * Math.sqrt(Math.max(1, tr + disc)), ry = 2 * Math.sqrt(Math.max(1, tr - disc));
      const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
      const c = rgbOf(h.color);
      ctx.save();
      ctx.translate(mx, my); ctx.rotate(ang); ctx.scale(rx, ry);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, rgbaStr(c, h.alpha * 1.15));
      g.addColorStop(0.6, rgbaStr(c, h.alpha * 0.85));
      g.addColorStop(1, rgbaStr(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // 2. segments, far to near
    const segs = [];
    for (const e of items.segments.values()) {
      const s = interp('segments', e.from, e.to, st);
      const a = typeof s.a === 'string' ? posById.get(s.a) : s.a;
      const b = typeof s.b === 'string' ? posById.get(s.b) : s.b;
      if (!isVec(a) || !isVec(b) || s.alpha <= 0.01) continue;
      const ua = proj(a), ub = proj(b);
      segs.push({ s, pa: fit.toScreen(ua), pb: fit.toScreen(ub), depth: (ua[2] + ub[2]) / 2 });
    }
    segs.sort((p, q) => p.depth - q.depth);
    const snap = (v, w) => (w % 2 > 0.5 || w < 1.5 ? (Math.floor(v * dpr) + 0.5) / dpr : Math.round(v * dpr) / dpr);
    ctx.lineCap = 'round';
    for (const g of segs) {
      ctx.globalAlpha = g.s.alpha;
      ctx.strokeStyle = resolve(g.s.color);
      ctx.lineWidth = g.s.width;
      ctx.beginPath();
      ctx.moveTo(snap(g.pa[0], g.s.width), snap(g.pa[1], g.s.width));
      ctx.lineTo(snap(g.pb[0], g.s.width), snap(g.pb[1], g.s.width));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 3. points, far to near (ties: higher z, then the highlighted point, on top)
    const rank = (p) => (p.id === highlight ? 1e6 : 0) + p.item.z;
    pts.sort((p, q) => (Math.round(p.depth * 40) - Math.round(q.depth * 40)) || (rank(p) - rank(q)) || (p.depth - q.depth));
    for (const p of pts) drawPoint(p, bg);
    lastPts = pts;

    // 4. labels by priority, greedy, never clipped (skipped instead)
    placed = layoutLabels(pts, proj, fit, st);
    for (const l of placed) drawLabel(l, bg);

    // 5. hover + highlight rings
    const ink = resolve('var(--ink)');
    for (const p of pts) {
      if (p.id !== hoverId && p.id !== highlight) continue;
      const sel = p.id === highlight;
      ctx.globalAlpha = sel ? 1 : 0.55;
      ctx.strokeStyle = ink;
      ctx.lineWidth = sel ? 2 : 1.5;
      shapePath(ctx, p.item.shape, p.x, p.y, p.r + ringWidth(p.item) + (p.item.outline ? num(p.item.outline.width, 1.5) : 0) + (sel ? 3 : 2.5));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (!rendered && pts.length) {
      rendered = true;
      canvas.setAttribute('data-rendered', '1');
    }
    if (st >= 1 && sceneAnim) finishScene();
    if (camAnim || sceneAnim || auto.running) raf = requestAnimationFrame(draw);
  }

  function ringWidth(it) {
    if (it.ring === false || it.ring === 0) return 0;
    if (typeof it.ring === 'number') return it.ring;
    if (it.ring && typeof it.ring === 'object') return num(it.ring.width, 2);
    return 2;
  }

  function drawPoint(p, bg) {
    const it = p.item;
    const rw = ringWidth(it);
    const ringColor = it.ring && typeof it.ring === 'object' && it.ring.color ? resolve(it.ring.color) : bg;
    const fill = resolve(it.fill);
    ctx.globalAlpha = p.alpha;
    ctx.lineJoin = 'round';
    if (it.outline) {
      const ow = num(it.outline.width, 1.5);
      shapePath(ctx, it.shape, p.x, p.y, p.r + rw + ow / 2);
      ctx.lineWidth = ow;
      ctx.strokeStyle = resolve(it.outline.color || 'var(--ink)');
      ctx.stroke();
    }
    if (rw > 0) {
      shapePath(ctx, it.shape, p.x, p.y, p.r);
      ctx.lineWidth = rw * 2;
      ctx.strokeStyle = ringColor;
      ctx.stroke();
    }
    shapePath(ctx, it.shape, p.x, p.y, p.r);
    if (it.hollow) {
      ctx.fillStyle = bg;
      ctx.fill();
      shapePath(ctx, it.shape, p.x, p.y, Math.max(1, p.r - 0.75));
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = fill;
      ctx.stroke();
    } else {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- labels
  const LINE = 1.25;
  function boxFor(x, y, w, h, align, valign) {
    const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    const y0 = valign === 'top' ? y : valign === 'bottom' ? y - h : y - h / 2;
    return { x0, y0, x1: x0 + w, y1: y0 + h };
  }
  const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  // two labels must also keep a small gap, so neighbours never read as one string ("YouComputational")
  const LGAP = 4;
  const crowds = (a, b) => a.x0 < b.x1 + LGAP && b.x0 < a.x1 + LGAP && a.y0 < b.y1 + 1 && b.y0 < a.y1 + 1;

  function layoutLabels(pts, proj, fit, st) {
    const M = 2;
    const inside = (b) => b.x0 >= M && b.y0 >= M && b.x1 <= W - M && b.y1 <= H - M;
    const obstacles = pts.filter((p) => p.item.label || p.item.z > 0 || p.id === highlight)
      .map((p) => { const r = p.r + ringWidth(p.item) + 1; return { id: p.id, x0: p.x - r, y0: p.y - r, x1: p.x + r, y1: p.y + r }; });
    const cands = [];
    if (!(sceneAnim && st < 1)) {
      for (const p of pts) {
        const it = p.item;
        if (!it.label || p.alpha < 0.35) continue;
        cands.push({ kind: 'point', p, id: it.id, text: String(it.label), font: it.labelFont || 'sans',
          size: num(it.labelSize, 12), weight: it.labelWeight, color: it.labelColor || 'var(--ink)',
          priority: it.labelPriority + (it.id === highlight ? 1000 : 0), alpha: p.alpha, order: it.labelPlacement,
          leaderColor: it.labelLeaderColor });
      }
    }
    for (const e of items.labels.values()) {
      const l = interp('labels', e.from, e.to, st);
      if (!l.text || l.alpha <= 0.05) continue;
      const u = proj(l.pos);
      let [x, y] = fit.toScreen(u);
      let align = l.align || 'left', valign = l.valign || 'middle';
      if (isVec(l.away)) {
        const [ax, ay] = fit.toScreen(proj(l.away));
        let dx = x - ax, dy = y - ay;
        const d = Math.hypot(dx, dy);
        if (d > 1e-6) { dx /= d; dy /= d; } else { dx = 0; dy = 0; }
        const gap = num(l.gap, 8);
        x += dx * gap; y += dy * gap;
        if (align === 'auto') align = dx > 0.38 ? 'left' : dx < -0.38 ? 'right' : 'center';
        if (l.valign == null || l.valign === 'auto') valign = dy > 0.38 ? 'top' : dy < -0.38 ? 'bottom' : 'middle';
      } else if (align === 'auto') align = 'center';
      if (Array.isArray(l.offset)) { x += num(l.offset[0], 0); y += num(l.offset[1], 0); }
      cands.push({ kind: 'free', id: l.id, text: l.text, font: l.font || 'sans', size: l.size, weight: l.weight,
        color: l.color || 'var(--muted)', priority: l.priority, alpha: l.alpha, x, y, align, valign, nudge: l.nudge !== false });
    }
    cands.sort((a, b) => b.priority - a.priority);

    const out = [];
    for (const c of cands) {
      const font = fontOf(c);
      const lines = c.text.split('\n');
      const w = Math.max(...lines.map((s) => measure(font, s)));
      const h = lines.length * c.size * LINE;
      const tries = [];
      if (c.kind === 'point') {
        const p = c.p, g = 5 + ringWidth(p.item), r = p.r + g;
        const all = {
          right: [p.x + r, p.y, 'left', 'middle'], left: [p.x - r, p.y, 'right', 'middle'],
          above: [p.x, p.y - r + 2, 'center', 'bottom'], below: [p.x, p.y + r - 2, 'center', 'top'],
          'upper-right': [p.x + r * 0.75, p.y - r * 0.75, 'left', 'bottom'], 'lower-right': [p.x + r * 0.75, p.y + r * 0.75, 'left', 'top'],
          'upper-left': [p.x - r * 0.75, p.y - r * 0.75, 'right', 'bottom'], 'lower-left': [p.x - r * 0.75, p.y + r * 0.75, 'right', 'top'],
        };
        const order = Array.isArray(c.order) && c.order.length ? c.order : Object.keys(all);
        for (const k of order) if (all[k]) tries.push(all[k]);
      } else {
        tries.push([c.x, c.y, c.align, c.valign]);
      }
      let got = null;
      for (const [x, y, align, valign] of tries) {
        let b = boxFor(x, y, w, h, align, valign);
        let nx = x, ny = y;
        if (!inside(b) && c.kind === 'free' && c.nudge) {
          const sx = b.x0 < M ? M - b.x0 : b.x1 > W - M ? W - M - b.x1 : 0;
          const sy = b.y0 < M ? M - b.y0 : b.y1 > H - M ? H - M - b.y1 : 0;
          nx += sx; ny += sy;
          b = { x0: b.x0 + sx, y0: b.y0 + sy, x1: b.x1 + sx, y1: b.y1 + sy };
        }
        if (!inside(b)) continue;
        if (out.some((q) => crowds(b, q.box))) continue;
        if (obstacles.some((q) => q.id !== c.id && overlaps(b, q))) continue;
        got = { ...c, x: nx, y: ny, align, valign, box: b, w, h, lines, fontStr: font };
        break;
      }
      if (got) out.push(got);
    }
    // point labels that opt in with `labelLeader` but found no free spot next to their dot go into
    // a column beside the cluster, each joined to its dot by a 1px solid leader line
    const missed = cands.filter((c) => c.kind === 'point' && c.p.item.labelLeader && !out.some((q) => q.id === c.id));
    if (missed.length) placeColumn(missed, out, obstacles, inside, M);
    return out;
  }

  // 2-D helpers for the leader column
  const segHitsBox = (x1, y1, x2, y2, b) => {
    // Liang-Barsky clip of the segment against the box
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dy = y2 - y1;
    for (const [pp, q] of [[-dx, x1 - b.x0], [dx, b.x1 - x1], [-dy, y1 - b.y0], [dy, b.y1 - y1]]) {
      if (pp === 0) { if (q < 0) return false; continue; }
      const r = q / pp;
      if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return t0 <= t1;
  };
  const segsCross = (a, b) => {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a[0], a[1], b[0]) !== o(a[0], a[1], b[1]) && o(b[0], b[1], a[0]) !== o(b[0], b[1], a[1]);
  };
  const shrink = (b, d) => ({ x0: b.x0 + d, y0: b.y0 + d, x1: b.x1 - d, y1: b.y1 - d });

  // Returns true when every label in `missed` was placed. `only` (1 | -1) limits the column to the
  // right / left side; `drop` (default true) lets it give up the lowest-priority label as a last resort.
  function placeColumn(missed, out, obstacles, inside, M, only = 0, drop = true) {
    const GAP = 4, OFF = 22;
    const its = missed.map((c) => {
      const fontStr = fontOf(c);
      const lines = c.text.split('\n');
      return { c, fontStr, lines, w: Math.max(...lines.map((t) => measure(fontStr, t))), h: lines.length * c.size * LINE };
    }).sort((a, b) => a.c.p.y - b.c.p.y || b.c.priority - a.c.priority);
    // stack the boxes near their dots' heights, then keep the stack inside the canvas
    let y = -Infinity;
    const ys = its.map((it) => { y = Math.max(it.c.p.y - it.h / 2, y + GAP); const top = y; y += it.h; return top; });
    const over = ys[ys.length - 1] + its[its.length - 1].h - (H - M);
    if (over > 0) for (let i = 0; i < ys.length; i++) ys[i] -= over;
    if (ys[0] < M) { const d = M - ys[0]; for (let i = 0; i < ys.length; i++) ys[i] += d; }
    const maxW = Math.max(...its.map((it) => it.w));
    const cx = its.reduce((a, it) => a + it.c.p.x, 0) / its.length;
    const right = { dir: 1, base: Math.max(...its.map((it) => it.c.p.x + it.c.p.r)) + OFF };
    const left = { dir: -1, base: Math.min(...its.map((it) => it.c.p.x - it.c.p.r)) - OFF };
    const sides = (W - cx >= cx ? [right, left] : [left, right]).filter((sd) => !only || sd.dir === only);
    const own = new Set(its.map((it) => it.c.id));
    const tryAt = (side, x, dy, strict) => {
      const boxes = its.map((it, i) => (side.dir > 0
        ? { x0: x, y0: ys[i] + dy, x1: x + it.w, y1: ys[i] + dy + it.h }
        : { x0: x - it.w, y0: ys[i] + dy, x1: x, y1: ys[i] + dy + it.h }));
      const leads = its.map((it, i) => {
        const p = it.c.p, b = boxes[i], ty = (b.y0 + b.y1) / 2, tx = side.dir > 0 ? b.x0 - 3 : b.x1 + 3;
        const d = Math.hypot(tx - p.x, ty - p.y) || 1, rr = p.r + ringWidth(p.item) + 1.5;
        return [[p.x + ((tx - p.x) / d) * rr, p.y + ((ty - p.y) / d) * rr], [tx, ty]];
      });
      for (let i = 0; i < its.length; i++) {
        const b = boxes[i];
        if (!inside(b) || out.some((q) => crowds(b, q.box))) return null;
        if (strict && obstacles.some((q) => !own.has(q.id) && overlaps(b, q))) return null;
        const [[x1, y1], [x2, y2]] = leads[i];
        if (out.some((q) => segHitsBox(x1, y1, x2, y2, shrink(q.box, 1)))) return null;
        for (let j = 0; j < its.length; j++) {
          if (j !== i && segHitsBox(x1, y1, x2, y2, shrink(boxes[j], 1))) return null;
          if (j > i && segsCross(leads[i], leads[j])) return null;
        }
      }
      return { boxes, leads };
    };
    // candidate spots, nearest first: slide the column away from the cluster and, if needed, up or down
    const tries = [];
    // vertical shifts: 0, ±18, ±36 … up to a third of the canvas height (at least ±72)
    const DYS = [0];
    for (let d = 18; d <= Math.max(72, H / 3); d += 18) DYS.push(d, -d);
    for (const side of sides) {
      const limit = side.dir > 0 ? W - M - maxW : M + maxW;
      for (let k = 0, x = side.base; side.dir > 0 ? x <= limit : x >= limit; k++, x += 6 * side.dir) {
        for (const dy of DYS) tries.push({ side, x, dy, cost: k * 6 + Math.abs(dy) * 1.5 + (side === sides[0] ? 0 : 40) });
      }
    }
    tries.sort((a, b) => a.cost - b.cost);
    for (const strict of [true, false]) {
      for (const t of tries) {
        const got = tryAt(t.side, t.x, t.dy, strict);
        if (!got) continue;
        const side = t.side;
        its.forEach((it, i) => out.push({ ...it.c, x: side.dir > 0 ? got.boxes[i].x0 : got.boxes[i].x1, y: got.boxes[i].y0 + it.h / 2,
          align: side.dir > 0 ? 'left' : 'right', valign: 'middle', box: got.boxes[i], w: it.w, h: it.h, lines: it.lines,
          fontStr: it.fontStr, leader: got.leads[i] }));
        return true;
      }
    }
    // no clean single column: split the labels into a left and a right column (by their dots' x)
    if (!only && missed.length > 1) {
      const byX = missed.slice().sort((a, b) => a.p.x - b.p.x);
      for (let k = 1; k < byX.length; k++) {
        const trial = out.slice();
        if (placeColumn(byX.slice(0, k), trial, obstacles, inside, M, -1, false)
          && placeColumn(byX.slice(k), trial, obstacles, inside, M, 1, false)) {
          out.splice(0, out.length, ...trial);
          return true;
        }
      }
    }
    // still nothing: give each label its own little column, highest priority first; a label that
    // finds no clean spot even then is left out (never overlap text)
    if (drop && missed.length > 1) {
      let all = true;
      for (const c of missed.slice().sort((a, b) => b.priority - a.priority)) {
        if (!placeColumn([c], out, obstacles, inside, M, 0, false)) all = false;
      }
      return all;
    }
    return false;
  }

  function drawLabel(l, bg) {
    ctx.font = l.fontStr;
    ctx.textAlign = l.align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = l.alpha;
    const lh = l.size * LINE;
    const x = l.align === 'right' ? l.box.x1 : l.align === 'center' ? (l.box.x0 + l.box.x1) / 2 : l.box.x0;
    if (l.leader) {
      const [[x1, y1], [x2, y2]] = l.leader;
      ctx.strokeStyle = resolve(l.leaderColor || 'var(--rule-dark)');
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    l.lines.forEach((s, i) => {
      const y = l.box.y0 + lh * (i + 0.5);
      ctx.lineWidth = 3;
      ctx.strokeStyle = bg;
      ctx.strokeText(s, x, y);
      ctx.fillStyle = resolve(l.color);
      ctx.fillText(s, x, y);
    });
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- picking
  function hitAll(x, y) {
    const R = o.hitRadius;
    let best = null, bestD = Infinity;
    const near = [];
    for (const p of lastPts) {
      if (p.item.pickable === false || p.alpha < 0.2) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= Math.max(R, p.r + 4)) near.push({ p, d });
    }
    if (!near.length) return null;
    const dmin = Math.min(...near.map((n) => n.d));
    for (const n of near) {
      if (n.d > dmin + 1.5) continue;
      const pr = n.p.item.labelPriority, bp = best && best.item.labelPriority;
      if (!best || pr > bp || (pr === bp && (n.p.depth > best.depth + 1e-9 || (Math.abs(n.p.depth - best.depth) <= 1e-9 && n.d < bestD)))) {
        best = n.p; bestD = n.d;
      }
    }
    const stack = lastPts.filter((p) => p !== best && p.item.pickable !== false && p.alpha >= 0.2 && Math.hypot(p.x - best.x, p.y - best.y) < 2).map((p) => p.item);
    return { item: best.item, x: best.x, y: best.y, stack };
  }
  function pick(x, y) { const h = hitAll(x, y); return h ? h.item : null; }

  function setHover(hit, pointer) {
    const id = hit ? hit.item.id : null;
    if (id === hoverId && !hit) return;
    const changed = id !== hoverId;
    hoverId = id;
    canvas.style.cursor = hit ? 'pointer' : '';
    if (changed) requestRender();
    if (o.onHover) o.onHover(hit ? hit.item : null, hit ? { x: hit.x, y: hit.y, stack: hit.stack, pointer } : null);
  }

  // ---------------------------------------------------------------- interaction
  const pointers = new Map();
  let drag = null, pinch = null;
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function interacted() {
    stopAutoRotate();
    if (o.onInteract) o.onInteract();
  }
  function setZoom(z) {
    camAnim = null;
    cam = { ...cam, zoom: clamp(z, o.zoomMin, o.zoomMax) };
    requestRender();
  }
  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === 'touch' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: cam.zoom };
      drag = null;
      return;
    }
    if (pointers.size === 1) {
      drag = { id: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, yaw0: cam.yaw, pitch0: cam.pitch, moved: false };
      if (e.pointerType === 'mouse') { try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } }
    }
  }
  function onPointerMove(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      setZoom(pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0);
      interacted();
      return;
    }
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) > 4) {
        drag.moved = true;
        canvas.classList.add('is-dragging');
        setHover(null);
        interacted();
      }
      if (drag.moved) {
        camAnim = null;
        cam = { ...cam, yaw: drag.yaw0 + dx * 0.01, pitch: drag.type === 'touch' ? cam.pitch : clamp(drag.pitch0 + dy * 0.01, -o.pitchLimit, o.pitchLimit) };
        requestRender();
      }
      return;
    }
    if (e.pointerType === 'mouse' && !drag) {
      const [x, y] = local(e);
      setHover(hitAll(x, y), { x, y });
    }
  }
  function onPointerUp(e) {
    const d = drag;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!d || e.pointerId !== d.id) return;
    drag = null;
    canvas.classList.remove('is-dragging');
    if (d.moved) return;
    const [x, y] = local(e);
    const hit = hitAll(x, y);
    if (d.type !== 'mouse') setHover(hit, { x, y });
    if (o.onSelect) o.onSelect(hit ? hit.item : null);
  }
  function onPointerCancel(e) {
    pointers.delete(e.pointerId);
    if (drag && drag.id === e.pointerId) { drag = null; canvas.classList.remove('is-dragging'); }
    if (pointers.size < 2) pinch = null;
  }
  function onPointerLeave(e) { if (e.pointerType === 'mouse' && !drag) setHover(null); }
  function onWheel(e) {
    if (!(e.ctrlKey || e.metaKey)) return;  // plain wheel scrolls the page
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    setZoom(cam.zoom * Math.exp(-e.deltaY * k * 0.0025));
    interacted();
  }
  function onKey(e) {
    if (e.altKey) return;
    let handled = true;
    const step = 0.12;
    if (e.key === 'ArrowLeft') rotateBy(-step, 0);
    else if (e.key === 'ArrowRight') rotateBy(step, 0);
    else if (e.key === 'ArrowUp') rotateBy(0, -step);
    else if (e.key === 'ArrowDown') rotateBy(0, step);
    else if (e.key === '+' || e.key === '=') zoomBy(1.2);
    else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.2);
    else if (e.key === '0') reset();
    else handled = false;
    if (handled) { e.preventDefault(); interacted(); }
  }
  function rotateBy(dyaw, dpitch) {
    camAnim = null;
    cam = { ...cam, yaw: cam.yaw + dyaw, pitch: clamp(cam.pitch + dpitch, -o.pitchLimit, o.pitchLimit) };
    requestRender();
  }
  function zoomBy(f) { setZoom(cam.zoom * f); }
  function reset() { setCamera(home, { animate: true, home: false }); }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- size, theme, motion, fonts
  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height), d = window.devicePixelRatio || 1;
    if (w === W && h === H && d === dpr) return;
    W = w; H = h; dpr = d;
    canvas.width = Math.max(1, Math.round(w * d));
    canvas.height = Math.max(1, Math.round(h * d));
    render();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  if (ro) ro.observe(canvas); else window.addEventListener('resize', resize);
  const mo = new MutationObserver(() => { invalidateStyle(); render(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const onMotion = () => { if (reduced()) { stopAutoRotate(); camAnim = null; if (sceneAnim) finishScene(); render(); } };
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', onMotion);
  const onFonts = () => { measureCache.clear(); requestRender(); };
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', onFonts);

  (async () => {
    try {
      if (document.fonts && document.fonts.load) {
        const loads = [`600 12px ${family('sans')}`, `700 13px ${family('sans')}`, `400 12px ${family('mono')}`]
          .map((f) => document.fonts.load(f).catch(() => null));
        await Promise.race([Promise.all(loads).then(() => document.fonts.ready), new Promise((r) => setTimeout(r, 2500))]);
      }
    } catch (_) { /* fall back to whatever font is there */ }
    fontsReady = true;
    measureCache.clear();
    if (!destroyed) { resize(); render(); maybeAutoRotate(); }
  })();

  // ---------------------------------------------------------------- auto-rotate (opt-in)
  function maybeAutoRotate() {
    if (auto.stopped || auto.running || reduced() || !auto.visible || !fontsReady || document.hidden) return;
    auto.running = true;
    auto.last = 0;
    requestRender();
  }
  function pauseAutoRotate() { auto.running = false; }
  function stopAutoRotate() { auto.running = false; auto.stopped = true; }
  const io = typeof IntersectionObserver !== 'undefined' && o.autoRotate
    ? new IntersectionObserver((es) => {
      for (const en of es) auto.visible = en.isIntersecting && en.intersectionRatio >= 0.25;
      if (auto.visible) maybeAutoRotate(); else pauseAutoRotate();
    }, { threshold: [0, 0.25, 0.5] })
    : null;
  if (io) io.observe(canvas);
  const onVis = () => { if (document.hidden) pauseAutoRotate(); else maybeAutoRotate(); };
  document.addEventListener('visibilitychange', onVis);

  // ---------------------------------------------------------------- public
  canvas.__plot = {
    screenPoints: () => lastPts.map((p) => ({ id: p.id, x: p.x, y: p.y, r: p.r })),
    labels: () => placed.map((l) => ({ id: l.id, text: l.text, x0: l.box.x0, y0: l.box.y0, x1: l.box.x1, y1: l.box.y1 })),
    camera: () => ({ ...cam }),
    size: () => ({ width: W, height: H, dpr }),
    autoRotating: () => auto.running,
    highlight: () => highlight,
  };

  function setHighlight(id) {
    highlight = id == null ? null : id;
    requestRender();
  }
  function screenOf(id) {
    const p = lastPts.find((q) => q.id === id);
    return p ? { x: p.x, y: p.y, r: p.r } : null;
  }
  function destroy() {
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
    mo.disconnect();
    if (io) io.disconnect();
    if (reduceMQ.removeEventListener) reduceMQ.removeEventListener('change', onMotion);
    if (document.fonts && document.fonts.removeEventListener) document.fonts.removeEventListener('loadingdone', onFonts);
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('keydown', onKey);
    delete canvas.__plot;
  }

  return {
    setScene, setCamera, render, resize, pick, setHighlight, destroy,
    // extras used by the charts
    getCamera: () => ({ ...cam }), zoomBy, reset, rotateBy, screenOf, stopAutoRotate,
    isRendered: () => rendered,
  };
}

// ---------------------------------------------------------------------------------- DOM helpers
// Shared by viz-cube.js and viz-types.js. Text only ever goes in through text nodes (never HTML).
export function h(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = String(v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'hidden') n.hidden = !!v;
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}

let uid = 0;
export const nextId = (prefix) => `${prefix}-${++uid}`;

/** Position an absolutely positioned tooltip inside `stage`, next to the stage point (x, y),
 *  flipping sides so it stays inside the stage and does not cover the point when there is room. */
export function placeTip(tip, stage, x, y, gap = 14) {
  tip.hidden = false;
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const tw = tip.offsetWidth, th = tip.offsetHeight, m = 4;
  let left = x + gap, top = y - th - gap / 2;
  if (left + tw > sw - m) left = x - gap - tw;
  if (left < m) left = Math.max(m, Math.min(sw - tw - m, x - tw / 2));
  if (top < m) top = y + gap;
  if (top + th > sh - m) top = Math.max(m, sh - th - m);
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}
