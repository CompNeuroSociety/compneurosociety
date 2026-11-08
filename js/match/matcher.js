// matcher.js: the browser twin of matcher.py (pure functions, no DOM, no network).
//
// Runs unchanged in a browser, in node, and in a Cloudflare Worker. It is a line-for-line port: every
// loop walks object keys in JSON insertion order, sums left to right, and rounds only at output, so it
// reproduces matcher.py's numbers bit for bit. tests/parity.test.mjs checks exactly that against
// fixtures written by tests/parity_cases.py. Change one file, change both, rerun the parity test.
//
// Python semantics reproduced here on purpose:
//   - float() parsing in num() (whitespace, underscores, "1e0"; booleans rejected; "", "0x10" rejected)
//   - str(value).strip() and dict.get() misses in toKey() (no prototype lookups: "constructor" is a miss)
//   - truthiness where matcher.py relies on it ("" -> None, [] -> False, 0/1 flags, NaN is truthy)
//   - round(x, 4): round-half-to-even on the exact binary value (round4)
//   - stable sort with the same key as rank_labs()
//
// score_text() is NOT ported: written-answer scoring needs an API key, so it lives server-side
// (serve.py locally, a Worker in production). The page posts to /api/score-text instead.

export const AXES = ['computational', 'cognitive', 'organism', 'clinical'];
export const ORGANISMS = ['human', 'rodent', 'invertebrate', 'in_silico_only'];
export const TEXT_FIELDS = ['question_text', 'origin_text', 'bring_text'];
export const LENSES = ['skills', 'interests', 'goals'];

// ----------------------------------------------------------------------------- python helpers
const hasOwn = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
const isDict = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNone = (v) => v === null || v === undefined;

/** dict.get(key, fallback) with no prototype lookups and None keys always missing. */
function get(o, k, fallback = null) {
  if (isNone(k) || !hasOwn(o, k)) return fallback;
  const v = o[k];
  return v === undefined ? fallback : v;
}

/** Python bool(x) for JSON-shaped values. */
function truthy(v) {
  if (isNone(v)) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;          // NaN !== 0, and bool(nan) is True in Python
  if (typeof v === 'string' || Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

// Python's str.isspace() set (JS \s also matches ﻿, which Python does not strip).
const PY_WS = '\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const PY_STRIP = new RegExp(`^[${PY_WS}]+|[${PY_WS}]+$`, 'g');
const pyStrip = (s) => s.replace(PY_STRIP, '');

/** Python repr() of a float, from JS's shortest round-trip digits. */
function pyFloatRepr(x) {
  if (Number.isNaN(x)) return 'nan';
  if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
  if (Object.is(x, -0)) return '-0.0';
  const [mant, expStr] = x.toExponential().split('e');      // shortest digits that round-trip
  const exp = Number(expStr);
  const neg = mant.startsWith('-');
  const digits = mant.replace('-', '').replace('.', '');
  if (exp < -4 || exp >= 16) {
    const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    return `${neg ? '-' : ''}${m}e${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`;
  }
  let s;
  if (exp >= 0) {
    const intPart = digits.slice(0, exp + 1).padEnd(exp + 1, '0');
    s = `${intPart}.${digits.slice(exp + 1) || '0'}`;
  } else {
    s = `0.${'0'.repeat(-exp - 1)}${digits}`;
  }
  return (neg ? '-' : '') + s;
}

/** Python str(value) for JSON-shaped values. A JSON number with no fraction is treated as a Python int
 *  (JS cannot tell 3 from 3.0). Lists and dicts never match a vocab key in either language; their exact
 *  text only shows up in the debug vector. */
function pyStr(v) {
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (isNone(v)) return 'None';
  if (typeof v === 'number') return Number.isInteger(v) && Math.abs(v) < 1e16 ? String(v) : pyFloatRepr(v);
  if (Array.isArray(v)) return `[${v.map(pyRepr).join(', ')}]`;
  if (typeof v === 'object') return `{${Object.entries(v).map(([k, x]) => `${pyRepr(k)}: ${pyRepr(x)}`).join(', ')}}`;
  return String(v);
}
function pyRepr(v) {
  if (typeof v !== 'string') return pyStr(v);
  const q = v.includes("'") && !v.includes('"') ? '"' : "'";
  const body = v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
    .split(q).join(`\\${q}`);
  return q + body + q;
}

// float() accepts: optional sign, digits with single underscores between them, an optional fraction,
// an optional exponent; or inf / infinity / nan (which our range checks then reject).
const PY_FLOAT = /^[+-]?(?:(?:\d(?:_?\d)*)(?:\.(?:\d(?:_?\d)*)?)?|\.\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?$/;
const PY_SPECIAL = /^[+-]?(?:inf|infinity|nan)$/i;

/** Python float(v), or null where float() would raise. */
function pyFloat(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return null;
  const s = pyStrip(v);
  if (PY_FLOAT.test(s)) return Number(s.replace(/_/g, ''));
  if (PY_SPECIAL.test(s)) return /nan/i.test(s) ? NaN : (s.startsWith('-') ? -Infinity : Infinity);
  return null;
}

/** Python round(x, 4): the double nearest the decimal rounded half-to-even on x's EXACT binary value.
 *  An exact tie at the 5th decimal needs x * 10^4 = n + 0.5 with x dyadic, i.e. x = odd / 32. */
export function round4(x) {
  if (isNone(x)) return null;
  if (!Number.isFinite(x)) return x;
  const y = x * 32;                                   // exact: scaling by a power of two
  if (Number.isInteger(y) && Math.abs(y) % 2 === 1 && Math.abs(x) < 2 ** 40) {
    const t = Math.abs(x) * 10000;                    // exact: q + 0.5
    const q = t - 0.5;
    const n = q % 2 === 0 ? q : q + 1;                // half to even
    const r = n / 10000;
    return x < 0 ? -r : r;
  }
  return Number(x.toFixed(4));                        // not a tie: toFixed rounds the exact value correctly
}

// ----------------------------------------------------------------------------- helpers (as in matcher.py)
/** Option label or key -> option key (the form may send either). */
export function toKey(model, qid, value) {
  if (isNone(value)) return null;
  const s = pyStrip(pyStr(value));
  const table = get(model.vocab, qid, {});
  return get(table, s.toLowerCase(), s);
}

/** Number within [lo, hi], else null. Accepts numeric strings; rejects booleans. */
export function num(v, lo, hi) {
  if (isNone(v) || typeof v === 'boolean') return null;
  const x = pyFloat(v);
  if (x === null) return null;
  return lo <= x && x <= hi ? x : null;
}

// ----------------------------------------------------------------------------- featurize
export function featurizeStudent(ans, model, textScores = null) {
  const cfg = model.featurize;
  const vec = {};

  const likert = isDict(get(ans, 'likert_axes')) ? ans.likert_axes : {};
  const pullRaw = get(ans, 'pull');
  const pulls = Array.isArray(pullRaw) ? pullRaw.map((p) => toKey(model, 'pull', p)) : [];
  const useText = isDict(textScores) && truthy(textScores);
  for (const ax of AXES) {
    const parts = [];                                 // [weight, value] from each source that has evidence
    let v = num(get(likert, ax), 1, 5);
    if (v !== null) parts.push([cfg.w_likert, v]);
    if (pulls.length) {
      let strength = -Infinity;
      for (const p of pulls) {
        const s = get(get(cfg.pull_axes, p, {}), ax, 0.0);
        if (s > strength) strength = s;
      }
      parts.push([cfg.w_pull, cfg.pull_base + (5 - cfg.pull_base) * strength]);
    }
    if (useText) {
      v = num(get(textScores, 'axis_' + ax), 1, 5);
      if (v !== null) parts.push([cfg.w_text, v]);
    }
    if (parts.length) {
      let numer = 0, denom = 0;
      for (const [w, x] of parts) numer += w * x;
      for (const [w] of parts) denom += w;
      vec['axis_' + ax] = numer / denom;
    } else {
      vec['axis_' + ax] = null;
    }
  }

  const oc = get(ans, 'organism_comfort');
  const keys = Array.isArray(oc) ? new Set(oc.map((o) => toKey(model, 'organism_comfort', o))) : null;
  for (const o of ORGANISMS) vec['org_' + o] = keys === null ? null : (keys.has(o) ? 1 : 0);

  vec.wet_dry = num(get(ans, 'wet_dry'), 1, 5);

  const grid = isDict(get(ans, 'coding')) ? ans.coding : {};
  const levels = Object.values(grid).map((v) => num(v, 1, 4)).filter((x) => x !== null);
  vec.coding_level = levels.length ? Math.max(...levels) - 1 : null;   // 0 none .. 3 considerable

  const mRaw = get(ans, 'math_reached');
  const m = pyStrip(truthy(mRaw) ? pyStr(mRaw) : '').toLowerCase();
  const ladder = cfg.math_levels.map((x) => x.toLowerCase());
  const mi = ladder.indexOf(m);
  vec.math_level = mi >= 0 ? mi : null;                                 // 0 pre-calc .. 6 beyond

  const proj = toKey(model, 'project', get(ans, 'project'));
  vec.project = proj;
  const kind = get(cfg.project_kind, proj);                             // volunteer_first -> null: any lab
  vec.project_kind = truthy(kind) ? [kind] : null;

  const career = toKey(model, 'career', get(ans, 'career'));
  vec.career = truthy(career) ? [career] : null;
  for (const s of ['structure', 'independence', 'ambiguity']) vec[s] = num(get(ans, s), 1, 5);
  const ls = toKey(model, 'lab_size', get(ans, 'lab_size'));
  vec.lab_size = ls === null ? null : (ls === 'either' ? ['small', 'large'] : [ls]);

  // commitment: the most hours/week the student offers, and the semesters their project type implies
  const hRaw = get(ans, 'hours');
  const hours = pyStrip(truthy(hRaw) ? pyStr(hRaw) : '');
  vec.hours = get(get(cfg, 'hours_max', {}), hours);            // absent in models built before v0.4
  vec.semesters = get(get(cfg, 'project_semesters', {}), proj);
  return vec;
}

// ----------------------------------------------------------------------------- gower
/** Weighted Gower similarity over the features in `weights`; unknown (null) features are skipped and
 *  the remaining weights renormalised. Returns `empty` when nothing is comparable. */
export function gower(a, b, weights, spec, empty = 0) {
  let numer = 0, denom = 0;
  const aLab = truthy(get(a, '_lab')), bLab = truthy(get(b, '_lab'));
  for (const name of Object.keys(weights)) {
    const w = weights[name];
    if (w <= 0) continue;
    const va = get(a, name), vb = get(b, name);
    if (va === null || vb === null) continue;
    const f = spec[name];
    const kind = f.kind;
    let s;
    if (kind === 'numeric' || (kind === 'threshold' && aLab === bLab)) {
      s = 1.0 - Math.abs(va - vb) / (f.hi - f.lo);
    } else if (kind === 'threshold') {                // exactly one side is a lab: its value is the minimum
      const [need, have] = aLab ? [va, vb] : [vb, va];
      s = have >= need ? 1.0 : 1.0 - (need - have) / (f.hi - f.lo);
    } else if (kind === 'binary') {
      if (!truthy(va) && !truthy(vb)) continue;       // asymmetric: a shared absence says nothing
      s = truthy(va) === truthy(vb) ? 1.0 : 0.0;
    } else if (kind === 'category') {
      s = va === vb ? 1.0 : 0.0;
    } else if (kind === 'set') {
      const B = new Set(vb);
      s = [...new Set(va)].some((x) => B.has(x)) ? 1.0 : 0.0;
    } else if (kind === 'affinity') {
      if (aLab !== bLab) {                            // lab side: {key: 0..1}; student side: list of keys
        const [table, keys] = aLab ? [va, vb] : [vb, va];
        s = 0.0;
        let first = true;
        for (const k of keys) {                       // max(..., default=0.0)
          const x = get(table, k, 0.0);
          if (first || x > s) { s = x; first = false; }
        }
      } else {                                        // two students, or a student and a type profile
        const B = new Set(vb);
        s = [...new Set(va)].some((x) => B.has(x)) ? 1.0 : 0.0;
      }
    } else {
      throw new Error(`unknown feature kind ${kind}`);
    }
    numer += w * s;
    denom += w;
  }
  return denom !== 0 ? numer / denom : empty;
}

// ----------------------------------------------------------------------------- matching (viz 1)
/** Reason string if the lab fails a hard constraint, else null. */
export function hardExclusion(vec, lab) {
  const orgs = new Set(get(lab, 'organisms') || []);
  if (orgs.size && get(vec, 'org_human') !== null) {     // student answered the organism question
    const comfort = new Set(ORGANISMS.filter((o) => get(vec, 'org_' + o) === 1));
    const overlap = [...comfort].some((o) => orgs.has(o));
    if (!overlap && !(comfort.has('in_silico_only') && lab.comp_neuro_level >= 2)) return 'organism';
  }
  return null;
}

/** Unrounded similarity on each facet (null when nothing is comparable). */
export function lensSims(vec, labVec, model) {
  const out = {};
  for (const name of LENSES) out[name] = gower(vec, labVec, model.weights.lens[name], model.spec, null);
  return out;
}

/** Weighted mean of the first `upto` facets (skills -> interests -> goals) that have data. */
export function fit(lenses, mix, upto = 3) {
  let numer = 0, denom = 0;
  for (const name of LENSES.slice(0, upto)) {
    const s = lenses[name];
    if (s === null || s === undefined) continue;
    numer += mix[name] * s;
    denom += mix[name];
  }
  return denom !== 0 ? numer / denom : 0.0;
}

/** The Society's tilt: modeling-heavy labs and labs with a posted undergrad process rank a bit higher. */
export function boost(lab, model) {
  const sc = model.score;
  return (1.0 + sc.comp_bias * lab.comp_neuro_level / 3.0) *
         (1.0 + (lab.openings === 'posted' ? sc.openings_bonus : 0.0));
}

/** Labs best first: not-excluded before excluded, then by unrounded score; ties keep model order. */
export function rankLabs(vec, model, upto = 3) {
  const mix = model.weights.lens_mix;
  const rows = model.labs.map((lab) => {
    const lenses = lensSims(vec, lab.vector, model);
    const f = fit(lenses, mix, upto);
    const b = boost(lab, model);
    const score = f * b;
    const rounded = {};
    for (const k of Object.keys(lenses)) rounded[k] = round4(lenses[k]);
    return [score, { id: lab.id, fit: round4(f), boost: round4(b), score: round4(score),
                     lenses: rounded, excluded: hardExclusion(vec, lab) }];
  });
  rows.sort((x, y) => {
    const ex = x[1].excluded !== null, ey = y[1].excluded !== null;
    if (ex !== ey) return ex ? 1 : -1;
    if (x[0] > y[0]) return -1;
    if (x[0] < y[0]) return 1;
    return 0;                                          // Array.prototype.sort is stable (ES2019)
  });
  return rows.map((r) => r[1]);
}

// ----------------------------------------------------------------------------- typing (viz 2)
/** Fuzzy c-means membership from distance to each researcher-type profile (u_t ∝ d_t^(-2/(m-1)), d² = 1 - sim). */
export function typeMembership(vec, model) {
  const w = model.weights.type, spec = model.spec, m = model.typing.fuzzifier;
  const e = -1.0 / (m - 1.0);
  const raw = {};
  for (const t of model.types) {
    const d2 = Math.max(1e-9, 1.0 - gower(vec, t.profile, w, spec));
    // libm pow() is correctly rounded, so pow(d2, -1) == 1/d2 exactly; V8's pow is not guaranteed to be
    raw[t.id] = e === -1 ? 1 / d2 : Math.pow(d2, e);
  }
  let z = 0;
  for (const k of Object.keys(raw)) z += raw[k];
  const u = {};
  let top = null;
  for (const k of Object.keys(raw)) {
    u[k] = round4(raw[k] / z);
    if (top === null || u[k] > u[top]) top = k;       // first maximum wins, like max(u, key=u.get)
  }
  return { memberships: u, top };
}

/** Gower's add-a-point formula for classical MDS: x = P (b - d²), d² = 1 - similarity to each anchor. */
export function project(vec, model) {
  const tm = model.type_map, w = model.weights.type, spec = model.spec;
  const d2 = tm.anchors.map((a) => 1.0 - gower(vec, a.vector, w, spec));
  return tm.proj.map((row) => {
    let s = 0;
    for (let i = 0; i < row.length; i++) s += row[i] * (tm.b[i] - d2[i]);
    return round4(s);
  });
}

// ----------------------------------------------------------------------------- everything the page needs
/** The README's Results object: vector, fuzzy type membership, type-map position, and the lab ranking
 *  for each step of viz 1 (1 = skills, 2 = + interests, 3 = + goals). */
export function computeResults(answers, model, textScores = null) {
  const vector = featurizeStudent(answers, model, textScores);
  return {
    vector,
    membership: typeMembership(vector, model),
    xyz: project(vector, model),
    ranks: { 1: rankLabs(vector, model, 1), 2: rankLabs(vector, model, 2), 3: rankLabs(vector, model, 3) },
    textScores: textScores || null,
  };
}
