// viz-cube.js: viz 1, "how close you are to each lab".
//
//   const cube = createCubeViz(container, model);
//   cube.update(results); cube.setStep(1|2|3); cube.getStep(); cube.select(labId);
//   cube.onSelect((labId) => ...); cube.destroy();
//
// Geometry: x = skills, y = interests, z = goals (the facet similarities in results.ranks[step]).
// Facets not counted yet at the current step are collapsed at 1.0 (the student's own value), so the
// on-screen distance from "You" at (1, 1, 1) is exactly what that step compares. One lower bound for
// all axes: lo = min(0.5, lowest visible lens value rounded down to 0.1); [lo, 1] -> [-1, 1].
// All data-derived text goes into the DOM through textContent (via h()).

import { createPlot3D, h, nextId, placeTip } from './plot3d.js';

const FACETS = ['skills', 'interests', 'goals'];
const TOP_N = 5;       // emphasised + labelled in the plot
const LIST_N = 8;      // rows in the ranked list
const CAMERAS = {
  1: { yaw: 0, pitch: 0, zoom: 1 },
  2: { yaw: 0, pitch: 0, zoom: 1 },
  3: { yaw: -0.65, pitch: 0.45, zoom: 1 },
};
const REASONS = {
  organism: 'Ruled out: works with organisms you said you’d rather not work with.',
};

const pct = (v) => `${Math.round(v * 100)}%`;
const floor1 = (v) => Math.floor(v * 10 + 1e-9) / 10;

export function createCubeViz(container, model) {
  if (!container) throw new Error('createCubeViz: no container');
  if (!model || !Array.isArray(model.labs)) throw new Error('createCubeViz: model.labs missing');

  const meta = (model.meta && Array.isArray(model.meta.lenses) && model.meta.lenses.length) ? model.meta.lenses
    : FACETS.map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1), help: '' }));
  const lensById = new Map(meta.map((l) => [l.id, l]));
  const facetLabel = (f) => (lensById.get(f) && lensById.get(f).label) || f;
  const labs = new Map(model.labs.map((l) => [l.id, l]));
  const sc = model.score || { comp_bias: 0, openings_bonus: 0 };
  const compLevels = (model.meta && model.meta.comp_levels) || [];

  let results = null;
  let step = 3;
  let prevStep = null;
  let showExcluded = false;
  let selected = null;
  let tipId = null;
  const listeners = [];
  const uid = nextId('lm-cube');

  // ------------------------------------------------------------------ DOM
  container.replaceChildren();
  const root = h('section', { class: 'lm-viz lm-cube', 'aria-labelledby': `${uid}-title` });

  const head = h('div', { class: 'lm-viz-head' },
    h('p', { class: 'label', text: '02 — how close you are to each lab' }),
    h('h2', { class: 'h2 lm-viz-title', id: `${uid}-title`, text: 'Skills first, then everything you care about.' }),
    h('p', { class: 'lm-viz-intro', text: 'You sit in the corner where every facet is a perfect match. Each dot is a lab: the closer it is to you, the better it fits what has been counted so far. Step through to add one facet at a time.' }),
  );

  const stepBtns = [];
  const stepper = h('div', { class: 'lm-viz-stepper', role: 'group', 'aria-label': 'What to count' });
  for (let s = 1; s <= 3; s++) {
    const l = lensById.get(FACETS[s - 1]) || { label: FACETS[s - 1], help: '' };
    const descId = `${uid}-d${s}`;
    const btn = h('button', { type: 'button', class: 'fchip', 'aria-pressed': 'false', 'data-step': String(s),
      'aria-describedby': descId, title: l.help || null, text: `${s} · ${s === 1 ? '' : '+ '}${l.label}` });
    btn.addEventListener('click', () => setStep(s));
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const n = Math.min(3, Math.max(1, s + (e.key === 'ArrowRight' ? 1 : -1)));
      setStep(n);
      stepBtns[n - 1].focus();
    });
    stepBtns.push(btn);
    stepper.append(btn, h('span', { class: 'sr-only', id: descId, text: l.help || '' }));
  }
  const exclBox = h('input', { type: 'checkbox' });
  exclBox.addEventListener('change', () => { showExcluded = exclBox.checked; renderAll(false); });
  const exclLabel = h('label', { class: 'lm-viz-check' }, exclBox, 'Show labs you ruled out');

  const zoomIn = h('button', { type: 'button', class: 'lm-viz-btn', 'aria-label': 'Zoom in', title: 'Zoom in', text: '+' });
  const zoomOut = h('button', { type: 'button', class: 'lm-viz-btn', 'aria-label': 'Zoom out', title: 'Zoom out', text: '−' });
  const zoomReset = h('button', { type: 'button', class: 'lm-viz-btn text', 'aria-label': 'Reset the view', title: 'Reset the view', text: 'reset' });
  const tools = h('div', { class: 'lm-viz-tools' }, zoomIn, zoomOut, zoomReset);
  const bar = h('div', { class: 'lm-viz-bar' }, stepper, exclLabel, tools);
  const help = h('p', { class: 'lm-viz-help' });

  const canvas = h('canvas', { class: 'lm-viz-canvas', role: 'img', tabindex: '0' });
  const tip = h('div', { class: 'lm-viz-tip', 'aria-hidden': 'true', hidden: true });
  const stage = h('div', { class: 'lm-viz-stage' }, canvas, tip);
  const hint = h('p', { class: 'lm-viz-hint', text: 'Drag or use the arrow keys to turn the cube. Hover or tap a dot for details.' });

  const list = h('ol', { class: 'lm-cube-list' });
  const listEmpty = h('p', { class: 'lm-cube-empty', hidden: true, text: 'No labs to show yet.' });
  const listLabel = h('p', { class: 'label', text: 'ranked at this step (fit + boost) · fit' });
  const side = h('div', { class: 'lm-cube-side' }, listLabel, list, listEmpty);
  const live = h('p', { class: 'lm-viz-live', 'aria-live': 'polite' });

  const table = h('table');
  const tableBox = h('details', { class: 'lm-viz-table' },
    h('summary', { text: 'All labs as a table' }), h('div', { class: 'lm-viz-scroll' }, table));

  root.append(head, bar, help, h('div', { class: 'lm-cube-grid' }, h('div', {}, stage, hint), side), live, tableBox);
  container.append(root);

  // ------------------------------------------------------------------ plot
  const plot = createPlot3D(canvas, {
    camera: CAMERAS[step],
    fit: 'box',
    perspective: 0.08,
    hitRadius: 24,
    padding: (w) => (w < 520
      ? { top: 34, right: 58, bottom: 52, left: 46 }
      : { top: 40, right: 120, bottom: 58, left: 64 }),
    ariaLabel: 'Labs placed by how well they match your skills, interests and goals',
    onHover: (item, info) => {
      if (!item) { hideTip(); return; }
      showTipFor(resolveHit(item, info), info);
    },
    onSelect: (item) => {
      if (!item) { hideTip(); return; }
      const it = resolveHit(item, { stack: [] });
      if (it.id === 'you') return;
      choose(it.id, true);
    },
  });
  zoomIn.addEventListener('click', () => plot.zoomBy(1.25));
  zoomOut.addEventListener('click', () => plot.zoomBy(1 / 1.25));
  zoomReset.addEventListener('click', () => plot.reset());

  // a hit on "You" with labs at the very same spot shows the best-ranked of those labs
  function resolveHit(item, info) {
    if (item.id !== 'you' || !info || !info.stack || !info.stack.length) return item;
    const labsHere = info.stack.filter((s) => s.id !== 'you' && labs.has(s.id));
    if (!labsHere.length) return item;
    labsHere.sort((a, b) => (b.labelPriority || 0) - (a.labelPriority || 0));
    return labsHere[0];
  }

  // ------------------------------------------------------------------ data helpers
  const counted = (s) => FACETS.slice(0, s);
  function rowsAt(s) {
    if (!results || !results.ranks) return [];
    const r = results.ranks[s] || results.ranks[String(s)];
    return Array.isArray(r) ? r : [];
  }
  const included = (rows) => rows.filter((r) => !r.excluded);
  function visibleRows(s) {
    const rows = rowsAt(s);
    return showExcluded ? rows : included(rows);
  }
  function lowerBound(s) {
    let m = 1;
    for (const r of visibleRows(s)) {
      for (const f of counted(s)) {
        const v = r.lenses && r.lenses[f];
        if (typeof v === 'number' && v < m) m = v;
      }
    }
    return Math.min(0.5, floor1(m));
  }
  function boostParts(lab) {
    const parts = [];
    if (!lab) return parts;
    const lvl = Number(lab.comp_neuro_level) || 0;
    const c = (Number(sc.comp_bias) || 0) * lvl / 3;
    if (c > 0) parts.push(`+${Math.round(c * 100)}% ${String(compLevels[lvl] || 'modeling').toLowerCase()}`);
    if (lab.openings === 'posted' && Number(sc.openings_bonus) > 0) parts.push(`+${Math.round(sc.openings_bonus * 100)}% posted openings`);
    return parts;
  }
  const nameOf = (id) => (labs.get(id) && labs.get(id).name) || String(id);

  // ------------------------------------------------------------------ scene
  function buildScene(s) {
    const lo = lowerBound(s);
    const map = (v) => ((v - lo) / (1 - lo)) * 2 - 1;
    const cnt = counted(s);
    const points = [];
    const segments = [];
    const labels = [];

    const rows = rowsAt(s);
    const inc = included(rows);
    const top = new Set(inc.slice(0, TOP_N).map((r) => r.id));
    const rankOf = new Map(inc.map((r, i) => [r.id, i]));

    for (const r of rows) {
      if (r.excluded && !showExcluded) continue;
      let hasNull = false;
      const pos = FACETS.map((f) => {
        if (!cnt.includes(f)) return 1;
        const v = r.lenses ? r.lenses[f] : null;
        if (typeof v !== 'number') { hasNull = true; return -1; }
        return map(v);
      });
      const isTop = top.has(r.id);
      const p = { id: r.id, pos, data: r, labelPriority: isTop ? 50 - rankOf.get(r.id) : 0 };
      if (r.excluded) Object.assign(p, { r: 4, fill: 'var(--faint)', hollow: true, alpha: 0.5, z: -1, labelPriority: -1 });
      else if (isTop) Object.assign(p, { r: 6, fill: 'var(--viz-accent)', hollow: hasNull, z: 2, label: nameOf(r.id),
        labelSize: 12, labelColor: 'var(--ink)', labelLeader: true });
      else Object.assign(p, { r: 4, fill: 'var(--viz-context)', hollow: hasNull, z: 1 });
      points.push(p);
      if (isTop) segments.push({ id: `hl-${r.id}`, a: 'you', b: r.id, color: 'var(--teal-line)', width: 1 });
    }
    points.push({ id: 'you', pos: [1, 1, 1], r: 7, fill: 'var(--ink)', ring: 2, z: 10, label: 'You',
      labelPriority: 100, labelSize: 13, labelWeight: 700, labelPlacement: ['upper-right', 'right', 'above', 'upper-left', 'left', 'below'] });

    // box wireframe: front face always, the rest only once goals are counted (3-D view)
    const C = (x, y, z) => [x, y, z];
    const edges = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      edges.push(['x', C(-1, a, b), C(1, a, b)]);
      edges.push(['y', C(a, -1, b), C(a, 1, b)]);
      edges.push(['z', C(a, b, -1), C(a, b, 1)]);
    }
    for (const [axis, a, b] of edges) {
      const front = a[2] === 1 && b[2] === 1;
      segments.push({ id: `box-${axis}-${a.join()}-${b.join()}`, a, b, color: 'var(--line)', width: 1, alpha: front || s === 3 ? 1 : 0 });
    }

    // axes: names + a few % ticks, in mono text tokens
    const ticks = [lo, (lo + 1) / 2, 1];
    const axisDefs = [
      { f: 'skills', name: { pos: [0, -1, 1], align: 'center', valign: 'top', offset: [0, 24] },
        tick: (t) => ({ pos: [t, -1, 1], align: 'center', valign: 'top', offset: [0, 6] }) },
      { f: 'interests', name: { pos: [-1, 1, 1], align: 'left', valign: 'bottom', offset: [-4, -12] },
        tick: (t) => ({ pos: [-1, t, 1], align: 'right', valign: 'middle', offset: [-8, 0] }) },
      { f: 'goals', name: s === 3 ? { pos: [1, -1, 0], away: [0, 0, 0], align: 'auto', gap: 26 }
        : { pos: [1, -1, 1], align: 'right', valign: 'top', offset: [0, 24] },
        tick: (t) => ({ pos: [1, -1, t], away: [0, -1, t], align: 'auto', gap: 8 }) },
    ];
    for (const ax of axisDefs) {
      const on = cnt.includes(ax.f);
      labels.push({ id: `name-${ax.f}`, text: on ? facetLabel(ax.f) : `${facetLabel(ax.f)} (not counted yet)`,
        font: 'mono', size: 12, weight: on ? 600 : 400, color: on ? 'var(--muted)' : 'var(--faint)', priority: 80, ...ax.name });
      ticks.forEach((t, i) => {
        labels.push({ id: `tick-${ax.f}-${i}`, text: pct(t), font: 'mono', size: 11, color: 'var(--faint)', priority: 60 - i,
          alpha: on ? 1 : 0, ...ax.tick(map(t)) });
      });
    }
    if (s < 3) {
      const nxt = facetLabel(FACETS[s]).toLowerCase();
      labels.push({ id: 'note', pos: [0, s === 1 ? 0 : -0.82, 1], align: 'center', valign: 'middle', font: 'mono', size: 12,
        color: 'var(--faint)', priority: 10, alpha: s === 1 ? 1 : 0,
        text: `Only ${counted(s).map((f) => facetLabel(f).toLowerCase()).join(' + ')} counted so far,\nso every lab sits on the top edge.\nAdd ${nxt} to spread them out.` });
    } else labels.push({ id: 'note', pos: [0, 0, 1], text: ' ', alpha: 0 });
    return { points, segments, labels };
  }

  // ------------------------------------------------------------------ tooltip
  function hideTip() { tip.hidden = true; tipId = null; }
  function showTipFor(item, info) {
    if (!item || !info) { hideTip(); return; }
    tipId = item.id;
    const kids = [];
    if (item.id === 'you') {
      kids.push(h('div', { class: 'lm-viz-tip-value', text: 'You' }),
        h('p', { class: 'lm-viz-tip-meta', text: 'Your own answers: a perfect match with yourself on every facet.' }));
    } else {
      const r = item.data || {};
      const lab = labs.get(item.id) || {};
      const cnt = counted(step);
      kids.push(h('div', { class: 'lm-viz-tip-value' }, typeof r.fit === 'number' ? pct(r.fit) : '—',
        h('span', { class: 'lm-viz-tip-unit', text: 'fit at this step' })));
      kids.push(h('div', { class: 'lm-viz-tip-name', text: lab.name || item.id }));
      const who = [lab.pi, lab.dept].filter(Boolean).join(' · ');
      if (who) kids.push(h('p', { class: 'lm-viz-tip-meta', text: who }));
      const dl = h('dl', { class: 'lm-viz-tip-rows' });
      for (const f of FACETS) {
        const v = r.lenses ? r.lenses[f] : null;
        let txt, off = false;
        if (!cnt.includes(f)) { txt = 'not counted yet'; off = true; }
        else if (typeof v !== 'number') { txt = 'no data'; off = true; }
        else txt = pct(v);
        dl.append(h('dt', { text: facetLabel(f) }), h('dd', { class: off ? 'is-off' : null, text: txt }));
      }
      kids.push(dl);
      const parts = boostParts(lab);
      kids.push(h('p', { class: 'lm-viz-tip-note', text: parts.length ? `Boost: ${parts.join(', ')}` : 'No boost' }));
      if (r.excluded) kids.push(h('p', { class: 'lm-viz-tip-note warn', text: REASONS[r.excluded] || `Ruled out (${r.excluded}).` }));
      const others = (info.stack || []).filter((s) => s.id !== item.id && s.id !== 'you').length;
      if (others) kids.push(h('p', { class: 'lm-viz-tip-note', text: `${others} other lab${others === 1 ? '' : 's'} at this same spot.` }));
    }
    tip.replaceChildren(...kids);
    placeTip(tip, stage, info.x, info.y);
  }
  function tipAt(id) {
    const p = plot.screenOf(id);
    const pts = canvas.__plot ? canvas.__plot.screenPoints() : [];
    if (!p) { hideTip(); return; }
    const item = pointsById.get(id);
    if (!item) { hideTip(); return; }
    const stack = pts.filter((q) => q.id !== id && Math.hypot(q.x - p.x, q.y - p.y) < 2).map((q) => ({ id: q.id }));
    showTipFor(item, { x: p.x, y: p.y, stack });
  }

  // ------------------------------------------------------------------ list, table, live text
  function renderList() {
    const rows = included(rowsAt(step)).slice(0, LIST_N);
    const prev = step > 1 ? included(rowsAt(step - 1)) : null;
    const prevIdx = prev ? new Map(prev.map((r, i) => [r.id, i])) : null;
    list.replaceChildren();
    rows.forEach((r, i) => {
      let move = '';
      let cls = '';
      if (prevIdx) {
        const j = prevIdx.get(r.id);
        if (j == null || j >= LIST_N) { move = 'new'; cls = 'up'; }
        else if (j > i) { move = `up ${j - i}`; cls = 'up'; }
        else if (j < i) move = `down ${i - j}`;
        else move = 'same rank';
      }
      const btn = h('button', { type: 'button', class: `lm-cube-item${i < TOP_N ? ' is-top' : ''}${r.id === selected ? ' is-selected' : ''}`,
        'data-id': r.id, 'aria-current': r.id === selected ? 'true' : null },
      h('span', { class: 'lm-cube-name', text: nameOf(r.id) }),
      (move || r.boost > 1) ? h('span', { class: `lm-cube-move ${cls}`,
        title: move ? `Rank change since step ${step - 1}` : null,
        text: [move, r.boost > 1 ? `+${Math.round((r.boost - 1) * 100)}% boost` : ''].filter(Boolean).join(' · ') }) : null,
      h('span', { class: 'lm-cube-val', text: pct(r.fit) }));
      btn.addEventListener('click', () => choose(r.id, true));
      btn.addEventListener('mouseenter', () => tipAt(r.id));
      btn.addEventListener('focus', () => tipAt(r.id));
      btn.addEventListener('mouseleave', () => { if (tipId === r.id) hideTip(); });
      btn.addEventListener('blur', () => { if (tipId === r.id) hideTip(); });
      list.append(h('li', {}, btn));
    });
    listEmpty.hidden = rows.length > 0;
  }

  function renderTable() {
    const cnt = counted(step);
    const thead = h('thead', {}, h('tr', {},
      h('th', { scope: 'col', text: 'Lab' }),
      ...FACETS.map((f) => h('th', { scope: 'col' }, facetLabel(f), cnt.includes(f) ? null : h('small', { text: 'not counted yet' }))),
      h('th', { scope: 'col', text: `Fit at step ${step}` }),
      h('th', { scope: 'col', text: 'Boost' }),
      h('th', { scope: 'col', text: 'Score' })));
    const tbody = h('tbody');
    for (const r of visibleRows(step)) {
      const cells = FACETS.map((f) => {
        const v = r.lenses ? r.lenses[f] : null;
        return h('td', { class: cnt.includes(f) && typeof v === 'number' ? null : 'is-off', text: typeof v === 'number' ? pct(v) : 'no data' });
      });
      const b = typeof r.boost === 'number' ? r.boost : 1;
      tbody.append(h('tr', { class: r.excluded ? 'is-excluded' : null, 'data-id': r.id },
        h('td', {}, nameOf(r.id), r.excluded ? h('span', { class: 'lm-viz-reason', text: REASONS[r.excluded] || `Ruled out (${r.excluded})` }) : null),
        ...cells,
        h('td', { text: typeof r.fit === 'number' ? pct(r.fit) : '—' }),
        h('td', { text: b > 1 ? `+${Math.round((b - 1) * 1000) / 10}%` : '—' }),
        h('td', { text: typeof r.score === 'number' ? r.score.toFixed(3) : '—' })));
    }
    table.replaceChildren(
      h('caption', { class: 'sr-only', text: `Every lab at step ${step}: facet matches, fit, boost and score` }), thead, tbody);
  }

  function liveText() {
    const cnt = counted(step);
    const what = cnt.map((f) => facetLabel(f).toLowerCase()).join(' + ');
    const rows = included(rowsAt(step));
    if (!rows.length) return `Counting ${what}: no labs to compare yet.`;
    const anyData = rows.some((r) => cnt.some((f) => r.lenses && typeof r.lenses[f] === 'number'));
    if (!anyData) return `Counting ${what}: you skipped those questions, so there is nothing to compare yet. Try the next step.`;
    const [a, b, c] = rows;
    let t = `Counting ${what}: ${nameOf(a.id)} ranks first at ${pct(a.fit)} fit`;
    if (b) t += `, then ${nameOf(b.id)} (${pct(b.fit)})`;
    if (c) t += ` and ${nameOf(c.id)} (${pct(c.fit)})`;
    return `${t}.`;
  }

  // ------------------------------------------------------------------ render
  let pointsById = new Map();
  function renderAll(animate) {
    stepBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i + 1 === step)));
    const l = lensById.get(FACETS[step - 1]);
    help.textContent = l && l.help ? `Step ${step} ${step === 1 ? 'counts' : 'adds'} ${l.label.toLowerCase()}: ${l.help}` : '';
    const scene = buildScene(step);
    pointsById = new Map(scene.points.map((p) => [p.id, p]));
    plot.setScene(scene, { animate });
    plot.setHighlight(selected && pointsById.has(selected) ? selected : null);
    hideTip();
    renderList();
    renderTable();
    live.textContent = results ? liveText() : '';
  }

  // ------------------------------------------------------------------ public
  function setStep(s) {
    const n = Number(s);
    if (![1, 2, 3].includes(n)) return;
    if (n === step) { renderAll(false); return; }
    prevStep = step;
    step = n;
    plot.setCamera(CAMERAS[n], { animate: true });
    renderAll(true);
  }
  function choose(id, fire) {
    selected = id == null ? null : String(id);
    plot.setHighlight(selected && pointsById.has(selected) ? selected : null);
    for (const b of list.querySelectorAll('.lm-cube-item')) {
      const on = b.getAttribute('data-id') === selected;
      b.classList.toggle('is-selected', on);
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    }
    if (fire && selected) {
      for (const fn of listeners) { try { fn(selected); } catch (e) { console.error(e); } }
    }
  }

  renderAll(false);

  return {
    update(r) { results = r || null; renderAll(true); },
    setStep,
    getStep: () => step,
    select(labId) {
      choose(labId, false);
      // a ruled-out lab is only visible with the checkbox on
      const row = rowsAt(step).find((r) => r.id === selected);
      if (row && row.excluded && !showExcluded) { exclBox.checked = true; showExcluded = true; renderAll(false); }
      requestAnimationFrame(() => requestAnimationFrame(() => { if (selected) tipAt(selected); }));
    },
    onSelect(fn) { if (typeof fn === 'function') listeners.push(fn); },
    destroy() {
      listeners.length = 0;
      plot.destroy();
      container.replaceChildren();
    },
    // for tests
    _debug: { plot, canvas, prevStep: () => prevStep },
  };
}
