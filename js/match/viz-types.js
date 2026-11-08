// viz-types.js: viz 2, "what kind of researcher you are".
//
//   const viz = createTypesViz(container, model);   // builds all of its DOM inside `container`
//   viz.update(results);                             // results = computeResults(...) (README "Results object")
//   viz.destroy();
//
// A 3-D scatter of model.type_map: simulated students as a faint cloud, one prototype marker per
// named researcher type (directly labelled), soft halos for this student's top three types, and the
// student's own point at results.xyz. Next to it, a membership panel that is both the legend and the
// table view. Works for any number of types (N >= 1).
//
// Color rule (an all-pairs scatter is capped at 3 categorical colors): THIS student's top three types
// by share get --viz-1, --viz-2, --viz-3 in rank order; every other type is neutral. Everything shown
// comes from model.json; data-derived text only ever enters the DOM through textContent (via h()).

import { createPlot3D, h, nextId, placeTip } from './plot3d.js';

const LABEL = '01 — what kind of researcher you are';
const NOTE = "Each faint dot is a simulated student (not a real person), colored by the type it's closest to; your top three types are in color. Your percentages show how close you are to each type and add up to 100%.";
const HINT = 'Drag to turn the map; hover a dot or a type in the list to see it. Keyboard: arrows turn, + / − zoom, 0 resets.';
const YOU = 'you';
const CAMERA = { yaw: -0.6, pitch: 0.35, zoom: 1 };
const SVG_NS = 'http://www.w3.org/2000/svg';
const TOP_N = 3;
const COLORS = ['var(--lm-types-c1)', 'var(--lm-types-c2)', 'var(--lm-types-c3)'];
const CTX_DOT = 'var(--lm-types-ctx)';        // neutral cloud dots (context)
const CTX_MARK = 'var(--lm-types-ctx-mark)';  // neutral prototype markers, swatches, meters (>= 3:1)

const pctText = (p) => `${p}%`;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const protoKey = (tid) => `p:${tid}`;

/** Lower-case a title where natural: "Machine learning engineer" -> "machine learning engineer",
 *  but keep acronyms and mixed-case words ("BCI", "R&D", "PhD", "NeuroAI"). */
function lc(text) {
  return String(text || '').split(' ').map((w) => (/^[A-Z][a-z]+(?:-[a-z]+)*[,.]?$/.test(w) ? w.toLowerCase() : w)).join(' ');
}
/** "a" / "an" for a phrase, acronym-aware ("a BCI engineer", "an R&D lead", "an engineer"). */
function article(phrase) {
  const w = String(phrase || '').trim().split(/\s+/)[0] || '';
  if (/^[A-Z&]{2,}$/.test(w)) return /^[AEFHILMNORSX]/.test(w) ? 'an' : 'a';
  if (/^(uni|use|usu|eu|one)/i.test(w)) return 'a';
  if (/^(hour|honest|honor)/i.test(w)) return 'an';
  return /^[aeiou]/i.test(w) ? 'an' : 'a';
}
const withArticle = (phrase) => `${article(phrase)} ${phrase}`;
/** ["x", "y", "z"] -> "x, y or z" */
function orList(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

/** Shares (0..1) -> whole percentages that add up to exactly 100 (largest remainder). */
function wholePercents(ids, shares) {
  const raw = ids.map((id) => Math.max(0, isNum(shares[id]) ? shares[id] : 0));
  const total = raw.reduce((a, b) => a + b, 0);
  if (!total) return Object.fromEntries(ids.map((id) => [id, 0]));
  const exact = raw.map((v) => (v / total) * 100);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k][1]] += 1;
  return Object.fromEntries(ids.map((id, i) => [id, out[i]]));
}

/** A small round SVG swatch matching the map marker: filled for the top three, hollow when neutral. */
function swatch(color, hollow) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '-8 -8 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'lm-types-swatch');
  const c = document.createElementNS(SVG_NS, 'circle');
  c.setAttribute('r', hollow ? '4.75' : '5.5');
  c.setAttribute('style', hollow ? `fill: none; stroke: ${color}; stroke-width: 1.5px` : `fill: ${color}`);
  svg.append(c);
  return svg;
}

/** "→ a + b · ← c" from model.type_map.axes[i]. */
function axisText(axis) {
  const pos = Array.isArray(axis && axis.positive) ? axis.positive.filter(Boolean) : [];
  const neg = Array.isArray(axis && axis.negative) ? axis.negative.filter(Boolean) : [];
  const name = String((axis && axis.name) || '').trim();
  if (name.toLowerCase() === 'mixed' || (!pos.length && !neg.length)) {
    return 'mixed: no single answer drives it; it blends many small differences.';
  }
  const parts = [];
  if (pos.length) parts.push(`→ ${pos.join(' + ')}`);
  if (neg.length) parts.push(`← ${neg.join(' + ')}`);
  return parts.join(' · ');
}

export function createTypesViz(container, model) {
  if (!container) throw new Error('createTypesViz: no container');
  const types = Array.isArray(model && model.types) ? model.types.filter((t) => t && t.id != null) : [];
  const tmap = (model && model.type_map) || {};
  const anchors = Array.isArray(tmap.anchors) ? tmap.anchors : [];
  const axes = Array.isArray(tmap.axes) ? tmap.axes : [];
  const explained = Array.isArray(tmap.explained) ? tmap.explained : [];

  const typeById = new Map(types.map((t) => [t.id, t]));
  const labelOf = (id) => String((typeById.get(id) && typeById.get(id).label) || id);
  const jobsOf = (id) => {
    const j = typeById.get(id) && typeById.get(id).jobs;
    return Array.isArray(j) ? j.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()) : [];
  };
  // the separator stays on the line of the job before it (no line starting with "·")
  const leadsText = (id) => (jobsOf(id).length ? `Leads to: ${jobsOf(id).join('\u00a0· ')}` : '');

  // ---------------------------------------------------------------- state
  let results = null;
  let shares = null;     // {type_id: 0..1}
  let percents = null;   // {type_id: whole %}
  let order = types.map((t) => t.id);   // by share, descending (stable: model order on ties)
  let rankOf = new Map();               // type id -> 0..2 for this student's top three
  let focusType = null;                 // type highlighted from the panel or the map

  const colorOf = (id) => (rankOf.has(id) ? COLORS[rankOf.get(id)] : CTX_DOT);
  const markOf = (id) => (rankOf.has(id) ? COLORS[rankOf.get(id)] : CTX_MARK);

  // scale: the largest absolute anchor coordinate maps to 1
  let scale = 0;
  for (const a of anchors) for (const v of a.xyz || []) if (isNum(v)) scale = Math.max(scale, Math.abs(v));
  if (!scale) scale = 1;
  // each axis line spans the data along that axis (a little past it), not the whole [-1, 1]
  const extent = [0, 1, 2].map((k) => {
    let m = 0;
    for (const a of anchors) if (Array.isArray(a.xyz) && isNum(a.xyz[k])) m = Math.max(m, Math.abs(a.xyz[k]) / scale);
    return Math.min(1, Math.max(0.35, m * 1.08));
  });
  const toPos = (xyz) => [0, 1, 2].map((k) => {
    const v = Array.isArray(xyz) && isNum(xyz[k]) ? xyz[k] / scale : 0;
    return Math.max(-1, Math.min(1, v));
  });

  // ---------------------------------------------------------------- DOM
  const ids = { hint: nextId('lm-types-hint'), note: nextId('lm-types-note'), head: nextId('lm-types-head') };
  const headline = h('h3', { class: 'h3 lm-types-headline', id: ids.head, text: 'Where you sit among the researcher types' });
  const jobsLine = h('p', { class: 'lm-types-jobs', hidden: true });
  const canvas = h('canvas', { class: 'lm-types-canvas', role: 'img', 'aria-describedby': `${ids.hint} ${ids.note}` });
  const tip = h('div', { class: 'lm-types-tip', hidden: true, 'aria-hidden': 'true' });
  const stage = h('div', { class: 'lm-types-stage' }, canvas, tip);
  const resetBtn = h('button', { type: 'button', class: 'lm-types-reset', text: 'Reset view' });
  const hint = h('p', { class: 'lm-types-hint', id: ids.hint, text: HINT });
  const axisList = h('ul', { class: 'lm-types-axes', 'aria-label': 'What the three axes mean' });
  axes.slice(0, 3).forEach((ax, i) => {
    const pct = isNum(explained[i]) ? Math.round(explained[i] * 100) : null;
    const lead = pct == null ? `Axis ${i + 1}` : `Axis ${i + 1} · ${pct}% of the spread`;
    axisList.append(h('li', {}, h('span', { class: 'lm-types-axis-n', text: `${lead}: ` }), h('span', { text: axisText(ax) })));
  });
  const topList = h('ol', { class: 'lm-types-rows' });
  const otherHead = h('p', { class: 'lm-types-sub', text: 'other types', hidden: true });
  const otherList = h('ol', { class: 'lm-types-rows lm-types-rows-compact', hidden: true });
  const panel = h('div', { class: 'lm-types-panel' },
    h('p', { class: 'lm-types-panel-label', text: 'your mix of types' }),
    topList, otherHead, otherList);
  const chartCol = h('div', { class: 'lm-types-chart' },
    stage,
    h('div', { class: 'lm-types-toolbar' }, hint, resetBtn),
    axisList);
  const note = h('p', { class: 'lm-types-note', id: ids.note, text: NOTE });
  const root = h('div', { class: 'lm-types' },
    h('p', { class: 'label lm-types-label', text: LABEL }),
    headline,
    jobsLine,
    note,
    h('div', { class: 'lm-types-grid' }, chartCol, panel));
  container.replaceChildren(root);

  // ---------------------------------------------------------------- focus (panel row <-> map)
  const protoOf = new Map();
  for (const a of anchors) if (a && a.kind === 'prototype' && a.id != null && !protoOf.has(a.type)) protoOf.set(a.type, a.id);

  function setFocus(tid) {
    const next = tid != null && typeById.has(tid) ? tid : null;
    if (next === focusType) return;
    focusType = next;
    for (const row of panel.querySelectorAll('.lm-types-row')) row.classList.toggle('is-focus', row.dataset.type === focusType);
    plot.setHighlight(focusType != null && protoOf.has(focusType) ? protoKey(focusType) : null);
    plot.setScene(scene());   // no tween: re-weights the cloud for the focused type
  }

  // ---------------------------------------------------------------- membership panel
  function row(id, full) {
    const t = typeById.get(id) || { id, label: String(id) };
    const p = percents ? percents[id] : null;
    const color = markOf(id);
    const fill = h('span', { class: 'lm-types-meter-fill' });
    fill.style.width = `${p == null ? 0 : p}%`;
    fill.style.background = color;
    const leads = leadsText(id);
    const li = h('li', { class: `lm-types-row${full ? '' : ' is-compact'}${rankOf.has(id) ? ' is-top' : ''}`, 'data-type': id, tabindex: '0' },
      h('div', { class: 'lm-types-row-head' },
        swatch(color, !rankOf.has(id)),
        h('span', { class: 'lm-types-name', text: t.label || id }),
        h('span', { class: 'lm-types-pct', text: p == null ? '—' : pctText(p) })),
      h('div', { class: 'lm-types-meter', 'aria-hidden': 'true' }, fill),
      full && t.blurb ? h('p', { class: 'lm-types-blurb', text: t.blurb }) : null,
      leads ? h('p', { class: 'lm-types-leads', text: leads }) : null);
    li.addEventListener('mouseenter', () => setFocus(id));
    li.addEventListener('mouseleave', () => { if (!li.contains(document.activeElement)) setFocus(null); });
    li.addEventListener('focus', () => setFocus(id));
    li.addEventListener('blur', () => setFocus(null));
    return li;
  }

  function renderPanel() {
    const nTop = shares ? Math.min(TOP_N, order.length) : order.length;
    topList.replaceChildren(...order.slice(0, nTop).map((id) => row(id, true)));
    const rest = order.slice(nTop);
    otherList.replaceChildren(...rest.map((id) => row(id, false)));
    otherList.setAttribute('start', String(nTop + 1));
    otherHead.hidden = otherList.hidden = !rest.length;
    if (focusType != null) for (const r of panel.querySelectorAll('.lm-types-row')) r.classList.toggle('is-focus', r.dataset.type === focusType);
  }

  // ---------------------------------------------------------------- scene
  function scene() {
    const points = [];
    const halos = [];
    const segments = [];
    const labels = [];
    const byType = new Map();
    const focusing = focusType != null;
    const narrow = (canvas.clientWidth || 600) < 480;
    for (const a of anchors) {
      if (!a || a.id == null) continue;
      const pos = toPos(a.xyz);
      const top = rankOf.has(a.type);
      if (a.kind === 'prototype') {
        const on = focusing && a.type === focusType;
        // top three: filled in their color; the rest: hollow neutral rings (lighter than "You")
        points.push({ id: protoKey(a.type), pos, r: top ? 7 : 6, fill: markOf(a.type), hollow: !top, ring: 2, shape: 'circle', z: 1,
          alpha: focusing && !on ? 0.55 : 1,
          label: labelOf(a.type), labelLeader: true, labelLeaderColor: 'var(--faint)',
          labelPriority: on ? 90 : top ? 60 - rankOf.get(a.type) : 40,
          labelColor: top || on ? 'var(--ink)' : 'var(--muted)', labelSize: narrow ? 11 : 12, labelWeight: top ? 700 : 600,
          data: { kind: 'prototype', type: a.type } });
      } else {
        const on = focusing && a.type === focusType;
        points.push({ id: `s:${a.id}`, pos, r: on ? 4.5 : 4, fill: on ? markOf(a.type) : colorOf(a.type),
          alpha: focusing ? (on ? 0.85 : 0.18) : 0.45, ring: 1, shape: 'circle', z: on ? 0.5 : 0,
          data: { kind: 'student', type: a.type } });
        if (!byType.has(a.type)) byType.set(a.type, []);
        byType.get(a.type).push(pos);
      }
    }
    // halos only for this student's top three types (10% fill); the focused type gets one too
    for (const [tid, pts] of byType) {
      const show = rankOf.has(tid) || tid === focusType;
      if (show && pts.length >= 3) {
        halos.push({ id: `h:${tid}`, points: pts, color: markOf(tid), alpha: focusing && tid !== focusType ? 0.05 : 0.1 });
      }
    }
    const O = [0, 0, 0];
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((unit, i) => {
      const e = unit.map((v) => v * extent[i]);
      segments.push({ id: `ax${i}`, a: e.map((v) => -v), b: e, color: 'var(--line)', width: 1 });
      labels.push({ id: `axl${i}`, pos: e, text: String(i + 1), font: 'mono', size: 12, weight: 400,
        color: 'var(--faint)', align: 'auto', away: O, gap: 8, priority: 5 });
    });
    if (results && Array.isArray(results.xyz)) {
      const mix = order.filter((id) => rankOf.has(id)).map((id) => [COLORS[rankOf.get(id)], shares[id] || 0]);
      points.push({ id: YOU, pos: toPos(results.xyz), r: 8,
        fill: mix.some(([, w]) => w > 0) ? { mix } : 'var(--ink)',
        ring: 2, outline: { width: 1.5, color: 'var(--ink)' }, shape: 'circle', z: 2,
        label: 'You', labelLeader: true, labelLeaderColor: 'var(--faint)', labelPriority: 100, labelColor: 'var(--ink)', labelSize: narrow ? 12 : 13, labelWeight: 700,
        data: { kind: 'you' } });
    }
    return { points, halos, segments, labels };
  }

  // ---------------------------------------------------------------- tooltip
  function fillTip(item) {
    const d = item.data || {};
    const kids = [];
    if (d.kind === 'you') {
      kids.push(h('strong', { class: 'lm-types-tip-title', text: 'You' }));
      for (const id of order.slice(0, TOP_N)) {
        kids.push(h('span', { class: 'lm-types-tip-row' },
          h('span', { text: labelOf(id) }),
          h('span', { class: 'lm-types-tip-val', text: percents ? pctText(percents[id]) : '—' })));
      }
    } else if (d.kind === 'prototype') {
      kids.push(h('strong', { class: 'lm-types-tip-title', text: labelOf(d.type) }));
      const blurb = typeById.get(d.type) && typeById.get(d.type).blurb;
      if (blurb) kids.push(h('span', { class: 'lm-types-tip-text', text: blurb }));
      const leads = leadsText(d.type);
      if (leads) kids.push(h('span', { class: 'lm-types-tip-meta', text: leads }));
    } else {
      kids.push(h('strong', { class: 'lm-types-tip-title', text: 'Simulated student' }));
      kids.push(h('span', { class: 'lm-types-tip-text', text: `closest to ${lc(labelOf(d.type))}` }));
    }
    tip.replaceChildren(...kids);
  }
  let mapFocus = false;   // focus set by hovering a prototype on the map (not the panel)
  function onHover(item, info) {
    const d = item && item.data;
    if (d && d.kind === 'prototype') { mapFocus = true; markRow(d.type); } else if (mapFocus) { mapFocus = false; markRow(null); }
    if (!item || !info) { tip.hidden = true; return; }
    fillTip(item);
    placeTip(tip, stage, info.x, info.y);
  }
  /** Hovering a prototype on the map marks its panel row (no scene change, so no flicker). */
  function markRow(tid) {
    for (const r of panel.querySelectorAll('.lm-types-row')) r.classList.toggle('is-mapped', tid != null && r.dataset.type === tid);
  }

  // ---------------------------------------------------------------- plot
  const plot = createPlot3D(canvas, {
    camera: CAMERA,
    fit: 'cylinder',
    padding: (w) => (w < 420 ? 12 : 24),
    hitRadius: 24,
    autoRotate: { speed: 0.12, duration: 10000 },
    ariaLabel: 'Map of researcher types',
    onHover,
    onSelect: (item) => { if (!item) tip.hidden = true; },
    onInteract: () => { tip.hidden = true; },
  });
  const onReset = () => { plot.stopAutoRotate(); tip.hidden = true; plot.reset(); };
  resetBtn.addEventListener('click', onReset);
  const onLeave = () => { tip.hidden = true; if (mapFocus) { mapFocus = false; markRow(null); } };
  stage.addEventListener('pointerleave', onLeave);
  const onKey = (e) => { if (e.key === 'Escape') tip.hidden = true; };
  canvas.addEventListener('keydown', onKey);

  function describe() {
    const n = types.length;
    if (!shares || !percents) {
      canvas.setAttribute('aria-label', `3-D map of ${n} researcher types made from simulated students. Your mix is listed next to the map.`);
      return;
    }
    const parts = order.map((id) => `${labelOf(id)} ${percents[id]}%`).join(', ');
    canvas.setAttribute('aria-label', `3-D map of ${n} researcher types made from simulated students, with your point marked "You". Your mix: ${parts}.`);
  }

  function setHeadline() {
    if (!shares || !order.length) {
      headline.textContent = 'Where you sit among the researcher types';
      jobsLine.hidden = true;
      return;
    }
    const top = order[0];
    const second = order[1];
    const topLabel = lc(labelOf(top));
    let text = `You're mostly ${withArticle(topLabel)}`;
    if (second != null && (shares[second] || 0) >= 0.2) text += ` with a strong ${lc(labelOf(second))} side`;
    headline.textContent = `${text}.`;
    const jobs = jobsOf(top).slice(0, 3).map((j) => withArticle(lc(j)));
    jobsLine.textContent = jobs.length ? `People on this path often work as ${orList(jobs)}.` : '';
    jobsLine.hidden = !jobs.length;
  }

  renderPanel();
  describe();
  plot.setScene(scene());

  // ---------------------------------------------------------------- public
  function update(r) {
    results = r || null;
    const m = results && results.membership && results.membership.memberships;
    shares = m && typeof m === 'object' ? Object.fromEntries(types.map((t) => [t.id, isNum(m[t.id]) ? m[t.id] : 0])) : null;
    percents = shares ? wholePercents(types.map((t) => t.id), shares) : null;
    order = types.map((t) => t.id);
    if (shares) order.sort((a, b) => shares[b] - shares[a]);
    rankOf = new Map(shares ? order.slice(0, TOP_N).map((id, i) => [id, i]) : []);
    tip.hidden = true;
    setHeadline();
    renderPanel();
    describe();
    plot.setScene(scene(), { animate: true });
  }

  function destroy() {
    resetBtn.removeEventListener('click', onReset);
    stage.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('keydown', onKey);
    plot.destroy();
    root.remove();
  }

  return { update, destroy };
}
