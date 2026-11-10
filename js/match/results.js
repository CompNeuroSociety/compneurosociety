// Lab Match results components: the lab cards, why some labs were left out, what the written answers
// added, and the "how this works" FAQ.
//
// Rules this file keeps (site/README.md): every data-derived string goes into the DOM with textContent
// (createElement + append, never innerHTML), links are kept only when they are absolute http(s) URLs,
// and every number shown comes from model.json or the Results rows (lab count, facet mix, boosts, k).

const MORE_STEP = 5;          // "Show 5 more matches"
const FLASH_MS = 1800;        // how long highlightCard's highlight stays on

// Friendlier names for the lab's project_fit keys; unknown keys are shown as they are.
const PROJECT_LABELS = { DIS: 'DIS', thesis: 'Honors thesis', UROP: 'UROP' };

// Short organism names for the "left out" sentence. Unknown keys fall back to the survey's own option label.
// Written with "and" inside each name so the list itself can use "or" without reading twice.
const ORGANISM_SHORT = {
  human: 'human participants',
  rodent: 'rats and mice',
  other_vertebrate: 'fish and birds',
  invertebrate: 'flies and worms',
};

const listState = new WeakMap();   // <ol class="lm-cards"> -> { revealThrough(index) }
const flashTimers = new WeakMap(); // node -> timeout id

// ------------------------------------------------------------------------------------------ helpers
function el(tag, props, ...kids) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = String(v);
      else if (k === 'hidden') node.hidden = Boolean(v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

const hasText = (s) => typeof s === 'string' && s.trim() !== '';
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const pct = (x) => Math.round(x * 100);

/** Absolute http(s) URL or null (relative, javascript:, data:, mailto: ... are all dropped). */
function safeUrl(u) {
  if (!hasText(u)) return null;
  try {
    const url = new URL(u.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** ["A", "B", "C"] -> ["A", ", ", "B", " and ", "C"] (works for strings and nodes). */
function joinList(items, last = ' and ', sep = ', ') {
  const out = [];
  items.forEach((it, i) => {
    if (i > 0) out.push(i === items.length - 1 ? last : sep);
    out.push(it);
  });
  return out;
}
const joinAnd = (items) => joinList(items).join('');

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const numberWord = (n) => (Number.isInteger(n) && n >= 0 && n < WORDS.length ? WORDS[n] : String(n));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const plural = (n, one, many) => (n === 1 ? one : many);

function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function labMap(model) {
  const m = new Map();
  for (const lab of (model && Array.isArray(model.labs) ? model.labs : [])) if (lab && lab.id != null) m.set(String(lab.id), lab);
  return m;
}

function lensList(model) {
  const l = model && model.meta && model.meta.lenses;
  if (Array.isArray(l) && l.length) return l.filter((x) => x && x.id);
  return ['skills', 'interests', 'goals'].map((id) => ({ id, label: cap(id), help: '' }));
}

function allQuestions(model) {
  const sections = model && model.questions && Array.isArray(model.questions.sections) ? model.questions.sections : [];
  return sections.flatMap((s) => (Array.isArray(s.questions) ? s.questions : []));
}

/** A survey option's label for a key, e.g. organism_comfort "rodent" -> "Rats or mice". */
function optionLabel(model, qid, key) {
  const q = allQuestions(model).find((x) => x.id === qid);
  const opt = q && Array.isArray(q.options) ? q.options.find((o) => o && typeof o === 'object' && o.key === key) : null;
  return opt && hasText(opt.label) ? opt.label : null;
}

function organismName(model, key) {
  if (Object.hasOwn(ORGANISM_SHORT, key)) return ORGANISM_SHORT[key];
  const label = optionLabel(model, 'organism_comfort', key);
  return label ? lowerFirst(label.replace(/\s*\(.*\)\s*$/, '')) : String(key).replace(/_/g, ' ');
}

/** Percent strings for a mix like {skills: .3333, ...} in lens order: ["skills 33%", ...]. */
function mixParts(model) {
  const mix = (model && model.weights && model.weights.lens_mix) || {};
  return lensList(model)
    .filter((l) => isNum(mix[l.id]))
    .map((l) => `${lowerFirst(l.label)} ${pct(mix[l.id])}%`);
}

function flash(node) {
  clearTimeout(flashTimers.get(node));
  node.classList.remove('lm-flash');
  void node.offsetWidth; // restart the highlight if it is already on
  node.classList.add('lm-flash');
  flashTimers.set(node, setTimeout(() => node.classList.remove('lm-flash'), FLASH_MS));
}

// --------------------------------------------------------------------------------------- lab cards
function meter(lens, value) {
  const has = isNum(value);
  const fill = el('span', { class: 'lm-meter-fill' });
  if (has) fill.style.width = `${Math.max(0, Math.min(100, value * 100))}%`;
  return el('div', { class: has ? 'lm-meter' : 'lm-meter is-na', title: hasText(lens.help) ? lens.help : null },
    el('span', { class: 'lm-meter-name', text: lens.label || cap(lens.id) }),
    el('span', { class: 'lm-meter-track', 'aria-hidden': 'true' }, fill),
    has
      ? el('span', { class: 'lm-meter-val', text: `${pct(value)}%` })
      : el('span', { class: 'lm-meter-val' },
        el('span', { 'aria-hidden': 'true', text: '—' }),
        el('span', { class: 'sr-only', text: 'not enough answers to compare' })));
}

function extLink(href, text, labName) {
  return el('a', { class: 'mono-link', href, target: '_blank', rel: 'noopener' },
    text, el('span', { 'aria-hidden': 'true', text: ' ↗' }),
    el('span', { class: 'sr-only', text: ` for ${labName} (opens in a new tab)` }));
}

/** A card's feedback choices. Each is saved (and, if the student agrees, shared) as the star value it replaced,
 *  so the re-ranking (matcher.applyRatings) needs no change; api/rate v2 accepts only these three values:
 *  👎 "Not for me" = 1 (−35%), 👍 "Looks right" = 4 (+17.5%), "I'm gonna apply!" = 5 (+35%, includes 👍). */
export const FEEDBACK = Object.freeze({ down: 1, up: 4, apply: 5 });
const FEEDBACK_NOTES = {
  [FEEDBACK.down]: 'Marked not for you.',
  [FEEDBACK.up]: 'Marked as a good match.',
  [FEEDBACK.apply]: 'You’re planning to apply. Good luck! “How to reach out” above says how.',
};

/** Thumbs up / down and "I'm gonna apply!" toggle buttons (aria-pressed) in a fieldset with a short note.
 *  Pressing the active choice again takes it back; "apply" also presses 👍, and un-pressing 👍 drops "apply".
 *  onRate(labId, 1 | 4 | 5 | null) is called on every change; the card itself never re-sorts. While "Not for me"
 *  is pressed, an optional row of reason buttons (REASONS) shows; onReason(labId, key | null) on every change. */
// Thumb outlines (Feather icons, MIT), drawn as inline SVG so they look the same on every device: an emoji
// needs an emoji font, which some systems (and headless test browsers) don't have.
const THUMB_PATHS = {
  up: 'M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3',
  down: 'M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17',
};
function thumbIcon(which) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ class: 'lm-vote-icon', viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none',
    stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
    focusable: 'false' })) svg.setAttribute(k, v);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', THUMB_PATHS[which]);
  svg.append(path);
  return svg;
}

/** The optional "Not for me" reasons (matcher.REASONS): fixed choices, never free text. */
export const REASONS = Object.freeze([
  ['topic', 'Topic'], ['organism', 'Organisms'], ['skills', 'Skills'], ['time', 'Time'],
  ['lab_info_wrong', 'Lab info is wrong'], ['other', 'Other'],
]);

function feedbackControl(id, name, value, onRate, reason = null, onReason = null) {
  const note = el('span', { class: 'lm-rate-note', 'aria-live': 'polite' });
  // "Why not? (optional)": one choice or none, shown only while "Not for me" is pressed
  let why = null;
  let whyButtons = [];
  let currentReason = REASONS.some(([k]) => k === reason) ? reason : null;
  const showReason = (r) => {
    currentReason = r;
    for (const b of whyButtons) b.setAttribute('aria-pressed', String(b.getAttribute('data-reason') === r));
  };
  if (typeof onReason === 'function') {
    whyButtons = REASONS.map(([key, label]) => {
      const b = el('button', { type: 'button', class: 'lm-reason', 'data-reason': key, 'aria-pressed': 'false' },
        label, el('span', { class: 'sr-only', text: ` (${name})` }));
      b.addEventListener('click', () => {
        const next = currentReason === key ? null : key;
        showReason(next);
        onReason(id, next);
      });
      return b;
    });
    why = el('div', { class: 'lm-why', role: 'group', 'aria-label': `Why not? (optional) ${name}`, hidden: true },
      el('span', { class: 'lm-why-q', 'aria-hidden': 'true', text: 'Why not? (optional)' }), whyButtons);
  }
  const button = (vote, label) => el('button',
    { type: 'button', class: `lm-vote lm-vote-${vote}`, 'data-vote': vote, 'aria-pressed': 'false' },
    THUMB_PATHS[vote] ? thumbIcon(vote) : null,
    el('span', { text: label }),
    el('span', { class: 'sr-only', text: ` (${name})` }));
  const up = button('up', 'Looks right');
  const down = button('down', 'Not for me');
  const apply = button('apply', 'I’m gonna apply!');
  let current = null;
  const show = (v) => {
    current = v;
    up.setAttribute('aria-pressed', String(v === FEEDBACK.up || v === FEEDBACK.apply));
    down.setAttribute('aria-pressed', String(v === FEEDBACK.down));
    apply.setAttribute('aria-pressed', String(v === FEEDBACK.apply));
    note.textContent = v ? FEEDBACK_NOTES[v] : '';
    if (why) {
      why.hidden = v !== FEEDBACK.down;
      if (v !== FEEDBACK.down) showReason(null);
    }
  };
  const choose = (v) => {
    show(v);
    onRate(id, v);
  };
  up.addEventListener('click', () => choose(current === FEEDBACK.up || current === FEEDBACK.apply ? null : FEEDBACK.up));
  down.addEventListener('click', () => choose(current === FEEDBACK.down ? null : FEEDBACK.down));
  apply.addEventListener('click', () => choose(current === FEEDBACK.apply ? FEEDBACK.up : FEEDBACK.apply));
  const start = Object.values(FEEDBACK).includes(value) ? value : null;
  show(start);
  if (start === FEEDBACK.down) showReason(currentReason);
  return el('fieldset', { class: 'lm-rate', 'data-lab-id': id },
    el('legend', { class: 'lm-rate-q' }, 'Does this match look right?', el('span', { class: 'sr-only', text: ` (${name})` })),
    el('div', { class: 'lm-rate-row' }, el('div', { class: 'lm-votes' }, up, down), apply, note), why);
}

function buildCard(model, lab, row, rank, onSelect, rating = null) {
  const id = String(lab.id);
  const name = hasText(lab.name) ? lab.name : id;
  const nameId = `lm-card-${id}-name`;
  const card = el('article', {
    class: rank === 1 ? 'card glow lm-card' : 'card lm-card',
    id: `lm-card-${id}`, tabindex: '-1', 'aria-labelledby': nameId, 'data-lab-id': id,
  });
  const meta = (model && model.meta) || {};
  const levels = Array.isArray(meta.comp_levels) ? meta.comp_levels : [];
  const work = Array.isArray(meta.compute_levels) ? meta.compute_levels : [];

  // ---- Always visible (built to be scanned): rank, name, who | fit, then one sentence and three quick facts
  const who = [lab.pi, lab.dept].filter(hasText).join(' · ');
  const title = el('div', { class: 'lm-card-title' },
    el('p', { class: 'lm-rank' }, el('span', { class: 'sr-only', text: 'Match ' }), String(rank)),
    el('h3', { class: 'lm-card-name', id: nameId, text: name }),
    who ? el('p', { class: 'lm-card-who', text: who }) : null);
  const fit = el('div', { class: 'lm-fit' },
    el('p', { class: 'lm-fit-line' },
      el('span', { class: 'lm-fit-num', text: isNum(row.fit) ? `${pct(row.fit)}%` : '—' }), ' ',
      el('span', { class: 'lm-fit-word', text: 'fit' })));
  if (isNum(row.personal) && Math.round((row.personal - 1) * 100) !== 0) {
    const d = Math.round((row.personal - 1) * 100);
    fit.append(el('p', { class: 'lm-fit-personal', text: `${d > 0 ? '+' : '−'}${Math.abs(d)}% from your ratings` }));
  }
  card.append(el('div', { class: 'lm-card-head' }, title, fit));
  if (hasText(lab.focus)) card.append(el('p', { class: 'lm-focus', text: lab.focus }));

  const quick = el('ul', { class: 'lm-quick' });
  const fact = (label, value) => el('li', null, el('span', { class: 'lm-quick-label', text: `${label}: ` }), value);
  if (lab.openings === 'posted') quick.append(el('li', { class: 'lm-quick-open' }, el('span', { class: 'tag gold', text: 'Openings posted' })));
  const kinds = (Array.isArray(lab.project_fit) ? lab.project_fit : []).filter(hasText)
    .map((p) => (Object.hasOwn(PROJECT_LABELS, p) ? PROJECT_LABELS[p] : p));
  if (kinds.length) quick.append(fact('Takes students for', kinds.join(', ')));
  // what the day-to-day work is like (any field)
  if (Number.isInteger(lab.compute_level) && hasText(work[lab.compute_level])) {
    quick.append(fact('Day to day', lowerFirst(work[lab.compute_level])));
  }
  // the lab's way-of-working family (any field): the same three families the student's headline uses
  const fams = Array.isArray(model && model.families) ? model.families : [];
  const famLabel = (fid) => { const f = fams.find((x) => x && x.id === fid); return f && hasText(f.label) ? f.label : null; };
  if (famLabel(lab.family)) {
    const also = famLabel(lab.family_also);
    quick.append(fact('Way of working', also ? `${famLabel(lab.family)} (also ${lowerFirst(also)})` : famLabel(lab.family)));
  }
  if (quick.childElementCount) card.append(quick);

  // the three facets behind the fit, in one row
  const meters = el('div', { class: 'lm-meters' });
  for (const lens of lensList(model)) meters.append(meter(lens, row.lenses ? row.lenses[lens.id] : null));
  card.append(meters);

  const links = el('div', { class: 'lm-card-links' });
  const labUrl = safeUrl(lab.lab_url);
  const listUrl = safeUrl(lab.listing_url);
  if (labUrl) links.append(extLink(labUrl, 'Lab page', name));
  if (listUrl) links.append(extLink(listUrl, 'Listing for students', name));

  // ---- Behind "How to reach out and more": the practical lines, the ranking note, provenance
  const more = el('div', { class: 'lm-details-body' });
  for (const [label, value] of [
    ['How to reach out', lab.how_to_apply],
    ['What they expect', lab.expectations],
    ['Start here', lab.entry_point],
    ['Stepping stone', lab.bridge],
  ]) {
    if (hasText(value)) more.append(el('p', { class: 'lm-fact' }, el('strong', { text: `${label}:` }), ' ', value.trim()));
  }
  // how much of the work is neuroscience modeling, when it is any
  if (Number.isInteger(lab.comp_neuro_level) && hasText(levels[lab.comp_neuro_level]) &&
      (lab.comp_neuro_level > 0 || !work.length)) {
    more.append(el('p', { class: 'lm-fact' }, el('strong', { text: 'Neuroscience modeling:' }), ' ', levels[lab.comp_neuro_level]));
  }
  if (isNum(row.boost) && Math.round((row.boost - 1) * 100) > 0) {
    more.append(el('p', { class: 'lm-fact lm-fit-boost' }, el('strong', { text: 'Ranking:' }), ' ',
      `+${Math.round((row.boost - 1) * 100)}% ranking boost`, ' (explained under “How this works”).'));
  }
  if (typeof onSelect === 'function') {
    more.append(el('p', { class: 'lm-fact' }, el('button', { type: 'button', class: 'mono-link teal lm-linkbtn', onclick: () => onSelect(id) },
      'Show in chart', el('span', { class: 'sr-only', text: `: ${name}` }))));
  }
  const checked = hasText(lab.last_checked) ? ` · last checked ${lab.last_checked}` : '';
  more.append(el('p', {
    class: 'lm-card-note',
    text: lab.verified === true ? `Verified by a person${checked}` : `Not yet verified by a person${checked}`,
  }));
  const details = el('details', { class: 'lm-details' },
    el('summary', { class: 'lm-details-sum' }, 'How to reach out and more',
      el('span', { class: 'sr-only', text: `: ${name}` })),
    more);
  card.append(el('div', { class: 'lm-card-foot' }, details, links.childElementCount ? links : null));

  if (rating && typeof rating.onRate === 'function') {
    card.append(feedbackControl(id, name, rating.stars, rating.onRate, rating.reason, rating.onReason));
  }
  return card;
}

/**
 * Lab cards for the top non-excluded rows (rows = results.ranks[3]), `limit` shown at first and a
 * "Show 5 more matches" button for the rest (never the whole list at once). onSelect(labId), when given, adds a "Show in chart" button.
 */
export function renderMatches(container, model, rows, { limit = 5, onSelect, ratings, onRate, reasons, onReason } = {}) {
  if (!container) return;
  const labs = labMap(model);
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && !r.excluded && labs.has(String(r.id)));
  const lensNames = lensList(model).map((l) => lowerFirst(l.label || l.id));

  container.replaceChildren();
  container.append(
    el('p', { class: 'label', text: '03 — your top matches' }),
    el('h2', { class: 'h2 lm-h2', id: 'lm-matches-title', text: list.length ? 'Labs that fit you right now.' : 'No lab passed your filters.' }),
  );
  if (!list.length) {
    container.append(el('p', { class: 'lm-sub', text: 'Every lab was left out by a hard filter; the note below says which and why. Editing that answer brings them back.' }));
    return;
  }
  container.append(el('p', {
    class: 'lm-sub',
    text: `Your best matches come first. Fit shows how well your answers line up with each lab on ${joinAnd(lensNames)}.` +
      (typeof onRate === 'function' ? ' Tell us what you think of each match and we’ll reorder your list.' : ''),
  }));

  const ol = el('ol', { class: 'lm-cards', 'aria-labelledby': 'lm-matches-title' });
  const first = Math.max(1, Math.min(list.length, Number.isFinite(limit) ? Math.floor(limit) : MORE_STEP));
  const items = list.map((row, i) => el('li', { class: 'lm-card-item', hidden: i >= first },
    buildCard(model, labs.get(String(row.id)), row, i + 1, onSelect,
      typeof onRate === 'function' ? {
        stars: ratings && Object.hasOwn(ratings, String(row.id)) ? ratings[String(row.id)] : null, onRate,
        reason: reasons && Object.hasOwn(reasons, String(row.id)) ? reasons[String(row.id)] : null, onReason,
      } : null)));
  ol.append(...items);
  container.append(ol);

  let shown = first;
  const more = el('button', { type: 'button', class: 'lm-ghost lm-more' });
  const count = el('p', { class: 'lm-more-count', 'aria-live': 'polite' });
  const sync = () => {
    const left = items.length - shown;
    more.hidden = left <= 0;
    more.textContent = `Show ${Math.min(MORE_STEP, left)} more ${plural(Math.min(MORE_STEP, left), 'match', 'matches')}`;
    count.textContent = `Showing ${shown} of ${items.length} matching ${plural(items.length, 'lab', 'labs')}`;
  };
  const revealTo = (n) => {
    const from = shown;
    shown = Math.min(items.length, Math.max(shown, n));
    for (let i = from; i < shown; i++) items[i].hidden = false;
    sync();
    return shown > from ? items[from] : null;
  };
  more.addEventListener('click', () => {
    const firstNew = revealTo(shown + MORE_STEP);
    const card = firstNew && firstNew.querySelector('.lm-card');
    if (card) card.focus({ preventScroll: true });
  });
  listState.set(ol, { revealThrough: (index) => revealTo(index + 1) });
  sync();
  container.append(el('div', { class: 'lm-more-row' }, more, count));
}

// ---------------------------------------------------------------------------------- left-out labs
function organismSentence(model, labsOut, vector) {
  const order = Object.keys(ORGANISM_SHORT);
  const rank = (o) => (order.includes(o) ? order.indexOf(o) : order.length);
  const seen = new Set();
  for (const lab of labsOut) for (const o of Array.isArray(lab.organisms) ? lab.organisms : []) seen.add(o);
  const names = [...seen].sort((a, b) => rank(a) - rank(b)).map((o) => organismName(model, o));
  const n = labsOut.length;
  const one = n === 1;
  // one group:    "with rats and mice, which you didn’t pick"
  // two groups:   "with rats and mice or with flies and worms, and you didn’t pick either"
  // three groups: "with human participants, rats and mice, or flies and worms, and you didn’t pick any of them"
  let what;
  let picked;
  if (names.length <= 1) {
    what = names[0] || 'organisms';
    picked = names.length ? 'which you didn’t pick' : 'none of which you picked';
  } else if (names.length === 2) {
    what = `${names[0]} or with ${names[1]}`;
    picked = 'and you didn’t pick either';
  } else {
    what = joinList(names, ', or ').join('');
    picked = 'and you didn’t pick any of them';
  }
  const inSilico = vector && vector.org_in_silico_only === 1;
  const head = `${n} ${one ? 'lab is' : 'labs are'} hidden because ${one ? 'it only works' : 'they only work'} with ${what}`;
  if (inSilico) {
    // "...only work with rats and mice (you didn’t pick them), and coding isn’t a regular part of their day-to-day
    // work, so they don’t fit a computer-only role: " (matcher: compute_level < 2)
    const note = names.length <= 1 ? 'you didn’t pick them' : names.length === 2 ? 'you didn’t pick either' : 'you didn’t pick any of them';
    return `${head} (${note}), and coding isn’t a regular part of ${one ? 'its' : 'their'} day-to-day work, ` +
      `so ${one ? 'it doesn’t' : 'they don’t'} fit a computer-only role: `;
  }
  return `${head}, ${picked}: `;
}

/** One plain sentence per exclusion reason, naming the labs; hides itself when nothing was left out. */
export function renderExcluded(container, model, rows, vector) {
  if (!container) return;
  container.replaceChildren();
  const labs = labMap(model);
  const out = (Array.isArray(rows) ? rows : []).filter((r) => r && r.excluded && labs.has(String(r.id)));
  if (!out.length) {
    container.hidden = true;
    return;
  }
  const byReason = new Map();
  for (const r of out) {
    const key = String(r.excluded);
    if (!byReason.has(key)) byReason.set(key, []);
    byReason.get(key).push(labs.get(String(r.id)));
  }
  // One short line; the reasons and the lab names open on request, so a long list never crowds the page.
  const body = el('div', { class: 'lm-excl-body' });
  for (const [reason, group] of byReason) {
    const lead = reason === 'organism'
      ? organismSentence(model, group, vector)
      : `${group.length} ${group.length === 1 ? 'lab is' : 'labs are'} hidden by a filter (${reason}): `;
    const names = group.map((lab) => el('span', {
      class: 'lm-excl-name', 'data-lab-id': String(lab.id), tabindex: '-1', text: hasText(lab.name) ? lab.name : String(lab.id),
    }));
    body.append(el('p', { class: 'lm-excl-line' }, lead, joinList(names), '.'));
  }
  const n = out.length;
  container.append(el('details', { class: 'lm-excl-details' },
    el('summary', { class: 'lm-details-sum' },
      `${n} ${plural(n, 'lab is', 'labs are')} not shown because of your answers. See which and why`),
    body));
  container.hidden = false;
}

// --------------------------------------------------------------------------------- written answers
/** Topics, the evidence quote and a one-line reading of the axes the text scored; hidden when null. */
export function renderWritten(container, textScores) {
  if (!container) return;
  container.replaceChildren();
  if (!textScores || typeof textScores !== 'object') {
    container.hidden = true;
    return;
  }
  container.append(el('h2', { class: 'label lm-label-h', id: 'lm-written-title', text: '04 — from what you wrote' }));

  const topics = (Array.isArray(textScores.topics) ? textScores.topics : []).filter(hasText).slice(0, 12);
  if (topics.length) {
    container.append(el('ul', { class: 'chips lm-topics', 'aria-label': 'Topics in your writing' },
      topics.map((t) => el('li', { class: 'chip', text: t.trim() }))));
  }
  if (hasText(textScores.evidence)) {
    container.append(el('blockquote', { class: 'lm-quote' }, el('p', { text: textScores.evidence.trim() })));
  }

  // Axes the text scored, highest first ("axis_computational" -> "computational").
  const scored = Object.keys(textScores)
    .filter((k) => k.startsWith('axis_') && isNum(textScores[k]))
    .map((k, i) => ({ name: k.slice(5).replace(/_/g, ' '), v: textScores[k], i }))
    .sort((a, b) => b.v - a.v || a.i - b.i);
  const fmt = (a) => `${a.name} (${a.v}/5)`;
  const hi = scored.filter((a) => a.v >= 3);
  const lo = scored.filter((a) => a.v < 3);
  let reading;
  if (hi.length) {
    reading = `Your writing leaned ${joinAnd(hi.map(fmt))}` + (lo.length ? `, and less ${joinAnd(lo.map(fmt))}.` : '.');
  } else if (lo.length) {
    reading = `Your writing didn’t lean strongly toward any area: ${joinAnd(lo.map(fmt))}.`;
  } else {
    reading = 'Your writing didn’t point clearly to any interest area, so it didn’t change your scores.';
  }
  container.append(el('p', { class: 'lm-reading', text: reading }));
  container.hidden = false;
}

// ------------------------------------------------------------------------------------ how it works
function faqItem(question, ...body) {
  return el('details', null, el('summary', { text: question }), ...body);
}

function ratioWords(r) {
  if (!isNum(r)) return null;
  if (Math.abs(r - 1) < 1e-9) return 'as much as';
  if (Math.abs(r - 0.5) < 1e-9) return 'half as much as';
  if (Math.abs(r - 0.25) < 1e-9) return 'a quarter as much as';
  if (Math.abs(r - 2) < 1e-9) return 'twice as much as';
  return `${Math.round(r * 100) / 100}× as much as`;
}

/**
 * The FAQ, built from model numbers. opts.textScoring (true/false) makes the privacy and AI answers
 * exact for this session; when it is not given they describe both cases. opts.emailOn: api/status said
 * emailing is set up, so the privacy answer explains "Email me my matches" instead of saying it is off.
 */
export function renderHowItWorks(container, model, opts = {}) {
  if (!container || !model) return;
  const scoring = typeof opts.textScoring === 'boolean' ? opts.textScoring : null;
  const sharing = opts.ratingsShared === true;
  const emailOn = opts.emailOn === true;
  const labs = Array.isArray(model.labs) ? model.labs : [];
  const nLabs = labs.length;
  const lenses = lensList(model);
  const score = model.score || {};
  const levels = model.meta && Array.isArray(model.meta.comp_levels) ? model.meta.comp_levels : [];
  const types = Array.isArray(model.types) ? model.types : [];
  const k = types.length;
  const nVerified = labs.filter((l) => l && l.verified === true).length;
  const nPosted = labs.filter((l) => l && l.openings === 'posted').length;
  const dates = labs.map((l) => l && l.last_checked).filter(hasText).sort();
  const nWritten = allQuestions(model).filter((q) => q.type === 'free_text').length;
  const writtenWord = nWritten ? `${numberWord(nWritten)} written answers` : 'written answers';
  const textModel = model.text && hasText(model.text.model) ? model.text.model : null;
  const fz = model.featurize || {};
  const textWeight = ratioWords(isNum(fz.w_text) && isNum(fz.w_likert) && fz.w_likert ? fz.w_text / fz.w_likert : null);
  const axisSpec = model.spec && model.spec.axis_computational;
  const axisRange = axisSpec && isNum(axisSpec.lo) && isNum(axisSpec.hi) ? `${axisSpec.lo}–${axisSpec.hi}` : '1–5';

  container.replaceChildren();
  container.append(el('h2', { class: 'label lm-label-h', id: 'lm-how-title', text: '05 — how this works' }));
  const faq = el('div', { class: 'faq lm-faq' });

  // 1. What kind of researcher (viz 1 on the page, so it comes first)
  const anchors = model.type_map && Array.isArray(model.type_map.anchors) ? model.type_map.anchors : [];
  const nDots = anchors.filter((a) => a && a.kind === 'student').length;
  const typeList = el('ul', { class: 'lm-faq-list' },
    types.filter((t) => t && hasText(t.label)).map((t) => {
      const jobs = Array.isArray(t.jobs) ? t.jobs.filter(hasText) : [];
      return el('li', null, el('strong', { text: t.label }), jobs.length ? ` — ${jobs.join(', ')}` : '');
    }));
  faq.append(faqItem('What does “what kind of researcher” mean?',
    el('p', {
      text: `We describe ${numberWord(k)} researcher ${plural(k, 'type', 'types')}. Each one is a profile of interests, skills and goals ` +
        'that we wrote down ourselves and tied to jobs people in that direction often hold:',
    }),
    typeList,
    el('p', {
      text: 'Your percentages show how close your answers are to each profile, and they add up to 100%. Most people are a blend.',
    }),
    ...(Array.isArray(model.families) && model.families.length ? [el('p', {
      text: `Each type belongs to a broader way of working: ${model.families.map((f) => f.label).filter(hasText).join(', ')}. ` +
        'Every lab, in any field, has one too (it is on each card). Your share of a way of working is the sum of the shares of its types. ' +
        'If your interest answers do not point at brain, mind or animal research, we show your way of working only.',
    })] : []),
    el('p', {
      text: (nDots ? `The faint dots on the map are ${nDots} simulated students` : 'The faint dots on the map are simulated students') +
        ' we made up to test the tool, not real people.',
    }),
    el('p', {
      text: 'The types are a way to think about directions you could take, not a verdict. None is better than another, ' +
        'and your mix will change as your answers do.',
    }),
  ));

  // 2. How the match works
  const facetList = el('ul', { class: 'lm-faq-list' },
    lenses.map((l) => el('li', null, el('strong', { text: l.label || cap(l.id) }), hasText(l.help) ? ` — ${l.help}` : '')));
  const mix = mixParts(model);
  const bias = isNum(score.comp_bias) ? score.comp_bias : 0;
  const bonus = isNum(score.openings_bonus) ? score.openings_bonus : 0;
  // matcher: boost = (1 + comp_bias * comp_neuro_level / 3) x (1 + openings_bonus if openings are posted)
  const steps = levels.map((name, i) => `“${name}” +${Math.round(bias * (i / 3) * 100)}%`);
  const exampleOrg = organismName(model, 'rodent');
  // Project kinds labs offer, in first-seen order; labs that state hours or semesters (both may be null).
  const projectKinds = [...new Set(labs.flatMap((l) => (l && Array.isArray(l.project_fit) ? l.project_fit : [])))]
    .map((key) => (Object.hasOwn(PROJECT_LABELS, key) ? PROJECT_LABELS[key] : String(key)));
  const nStates = labs.filter((l) => l && l.vector && (l.vector.hours != null || l.vector.semesters != null)).length;
  const goals = lenses.find((l) => l.id === 'goals');
  const goalsName = goals ? (goals.label || cap(goals.id)) : 'Goals';
  faq.append(faqItem('How does the match work?',
    el('p', { text: `We compare your answers with each of the ${nLabs} labs on ${numberWord(lenses.length)} facets:` }),
    facetList,
    el('p', {
      text: `Your fit is a weighted average of the ${numberWord(lenses.length)}` + (mix.length ? `: ${joinAnd(mix)}. ` : '. ') +
        'If you skipped every question in a facet, that facet is left out and the others share its weight.',
    }),
    el('p', {
      text: `${goalsName} looks at how relevant each lab is to the career you picked (a PhD, medical school, industry and so on), ` +
        'whether it offers the kind of project you want' + (projectKinds.length ? ` (${joinList(projectKinds, ' or ').join('')})` : '') +
        ', and the weekly hours or number of semesters it asks for, where the lab states them' +
        (nLabs ? ` (${nStates} of ${nLabs} labs do).` : '.'),
    }),
    el('p', {
      text: `Labs are then ranked by fit times two small boosts that reflect what CompNeuroSociety is about: up to +${pct(bias)}% ` +
        'the more modeling a lab does' + (steps.length ? ` (${steps.join(', ')})` : '') +
        `, and +${pct(bonus)}% for labs that post a way for undergraduates to apply. That is why a lab with a slightly lower fit can rank higher.`,
    }),
    el('p', {
      text: `There is one hard filter. If a lab only works with organisms you didn’t pick (say, ${exampleOrg}), it is left out instead of ranked lower. ` +
        'If you’d rather stay on the computer, labs where coding is a regular part of the work stay in.',
    }),
  ));
  // 2b. Feedback buttons
  faq.append(faqItem('What do “Looks right”, “Not for me” and “I’m gonna apply!” do?',
    el('p', {
      text: 'Each card asks whether the match looks right. Your answers stay in this browser and, when you press “Update my ' +
        'ranking”, move that lab up or down your list; labs that look like it (similar skills and interests) move a little the ' +
        'same way. “Not for me” moves a lab down by up to 35%, “Looks right” moves it up by up to 17.5%, and “I’m gonna apply!” ' +
        '(which counts as “Looks right” too) ' +
        'moves it up by up to 35%. Press a button again to take it back. After “Not for me” you can pick why (optional). ' +
        'One “Not for me” helps your ranking most, because it tells the list what to move down.',
    }),
    el('p', {
      text: (sharing
        ? 'The first time you press one of these buttons, we ask whether you want to share your ratings to help improve Lab Match. '
        : 'When the server accepts shared ratings, the first time you press one of these buttons we ask whether you want to share them. ') +
        'Nothing is shared unless you say yes, and the answer lasts only until you leave the page. A shared rating is the button ' +
        'you pressed (and the reason, if you picked one), which labs you were shown and where they were in your list, and a rounded ' +
        'version of your multiple-choice answers, with the week only. Never your name, email, written answers or transcript.',
    }),
    el('p', {
      text: 'We use shared ratings only to improve Lab Match: to tune how much skills, interests and goals count for everyone, and ' +
        'to find lab details that need fixing. They are never used for research or publications, never for reports about a lab, ' +
        'a PI or FSU, and they never score a lab. Only the club officer who runs Lab Match can see them. They are kept for up to ' +
        '13 months. “Delete what I shared” removes them; Cloudflare, which runs our server, keeps short-lived request logs, and ' +
        'its database backups can restore deleted rows for up to 30 days, so deleting isn’t instant everywhere. Lab Match has few ' +
        'users, so someone who already knows your answers could recognise your ratings.',
    }),
  ));

  // 3. Are these labs taking students?
  const when = !dates.length ? '' : dates[0] === dates[dates.length - 1] ? ` on ${dates[0]}` : ` between ${dates[0]} and ${dates[dates.length - 1]}`;
  const verifiedText = nVerified === 0
    ? `None of the ${nLabs} labs has been verified by a person yet, so each card says so.`
    : nVerified === nLabs ? `All ${nLabs} labs have been verified by a person.`
      : `${nVerified} of the ${nLabs} labs have been verified by a person; the others say “Not yet verified” on their card.`;
  faq.append(faqItem('Are these labs taking students?',
    el('p', { text: `Lab details were collected from each lab’s official FSU pages and last checked${when}. ${verifiedText}` }),
    el('p', {
      text: `“Openings posted” (${nPosted} of ${nLabs} labs) means the lab posts a way for undergraduates to apply. ` +
        'It is not a promise of a spot, and labs without it may still take students.',
    }),
    el('p', {
      text: 'Always check the lab’s own page before you reach out, and write your own message: a short note about their work ' +
        'and why it interests you goes further than a template.',
    }),
  ));

  // 4. What happens to my answers
  const unless = emailOn
    ? 'unless you choose to share your ratings or to email yourself your matches.'
    : 'unless you choose to share your ratings.';
  const sent = scoring === true
    ? `Your ${writtenWord} are sent to Claude Haiku (Anthropic) only to read your interests. Nothing else you enter leaves this page, ${unless}`
    : scoring === false
      ? `Written-answer scoring is off in this preview, so your ${writtenWord} stay on this page too. Nothing you enter leaves this page, ${unless}`
      : `When written-answer scoring is on, your ${writtenWord} are sent to Claude Haiku (Anthropic) only to read your interests. Nothing else you enter leaves this page, ${unless}`;
  const emailText = emailOn
    ? 'Your email is sent only if you tick “Email me my matches” under the email box or press “Email me my matches” on ' +
      'your results. Then the Lab Match server gets your ' +
      'address and the IDs of your top five labs and your top researcher type (nothing else you entered), writes one email from its ' +
      'own lab details and sends it to you through Resend, the email service it uses. Lab Match doesn’t store or log the ' +
      'address; Resend keeps a delivery log, which includes it, for a limited time. ' +
      'To stop repeat sends, the server counts each day’s emails with a one-way code made from the address and the date, ' +
      'not the address itself.'
    : 'Emailing your matches is off in this preview, so your email is not sent or stored.';
  faq.append(faqItem('What happens to my answers?',
    el('p', {
      text: 'Your answers stay in this browser. While you work they are saved in this browser’s storage so you can come back later; ' +
        '“Clear my saved answers” removes them. Your email and transcript are never saved there.',
    }),
    el('p', {
      text: 'If you add a transcript, it is read inside your browser. Only course codes and titles are kept; grades, your name and ' +
        'ID numbers are dropped, and the transcript is never sent anywhere.',
    }),
    el('p', { text: emailText }),
    el('p', { text: sent }),
    el('p', {
      text: '“Download my results” saves a file to your device; there is no copy on a server. Your “Looks right”, “Not for me” and “apply” choices stay in this browser ' +
        'unless you say yes when we ask to share them. This page has no analytics or tracking cookies; our server only adds one ' +
        'to a count of how many times the page was opened that day, with nothing about who opened it. It loads its ' +
        'fonts from Google Fonts, and pdf.js from cdnjs only if you upload a PDF transcript; neither gets your answers.',
    }),
  ));

  // 5. Is this AI?
  const aiStep = scoring === false
    ? 'The only AI step would be reading your written answers with Claude Haiku, and that is off in this preview, so everything here came from your clicks and sliders.'
    : `The only AI step is reading your written answers${scoring === null ? ' (when it is on)' : ''}: Claude Haiku${textModel ? ` (${textModel})` : ''} turns them into ` +
      `the same ${axisRange} interest scores as the sliders` + (textWeight ? `, and each one counts ${textWeight} your slider answer.` : '.');
  faq.append(faqItem('Is this AI?',
    el('p', {
      text: 'The matching is plain arithmetic: similarity scores, a weighted average and the two boosts above, worked out in your browser ' +
        'the same way every time. The only thing that learns is the weighting of skills, interests and goals, which we retune from ' +
        'ratings people chose to share, and only when that makes the rankings agree with those ratings better than before.',
    }),
    el('p', { text: aiStep }),
  ));

  container.append(faq);
}

// ------------------------------------------------------------------------------------- highlight
/**
 * Scroll a lab's card into view (smooth unless reduced motion), reveal it if it is behind "Show more",
 * flash a highlight and move focus to it. Falls back to the lab's name in the "left out" note.
 * Returns true when something was highlighted.
 */
export function highlightCard(labId) {
  if (labId == null) return false;
  const id = String(labId);
  let target = [...document.querySelectorAll('.lm-card[data-lab-id]')].find((n) => n.getAttribute('data-lab-id') === id) || null;
  if (target) {
    const li = target.closest('.lm-card-item');
    if (li && li.hidden) {
      const ol = li.closest('.lm-cards');
      const st = ol ? listState.get(ol) : null;
      if (st) st.revealThrough([...ol.children].indexOf(li));
      else li.hidden = false;
    }
  } else {
    target = [...document.querySelectorAll('.lm-excl-name[data-lab-id]')].find((n) => n.getAttribute('data-lab-id') === id) || null;
    const closed = target ? target.closest('details:not([open])') : null;
    if (closed) closed.open = true;   // the left-out names sit behind "See which and why"
  }
  if (!target || !target.isConnected || target.closest('[hidden]')) return false;
  const card = target.classList.contains('lm-card');
  target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: card ? 'start' : 'center' });
  flash(target);
  target.focus({ preventScroll: true });
  return true;
}
