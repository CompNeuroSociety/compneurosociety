// Lab Match page controller: the entry module that match.html loads.
//
//   document.body.dataset.lmState   "loading" -> "survey" | "error" -> "results"  (tests watch it)
//   window.__labmatch               { ready, model, answers, results, textScores }
//
// 1. Loads data/model.json and checks api/status at the configured API. If it is unavailable,
//    structured matching still works; written-answer scoring is off.
// 2. Mounts the survey with the saved draft and saves the draft as you go: localStorage
//    "cns-labmatch-draft-v1", never the email, the transcript or the consent box.
// 3. On submit: computeResults() and render right away. Then, only when scoring is on and something
//    was written, POST ONLY {question_text, origin_text, bring_text} to api/score-text and re-render.
// The two charts load on their own: if one fails, its mount point says so and the rest keeps working.

import { renderMatches, renderExcluded, renderWritten, renderHowItWorks, highlightCard } from './results.js';

const DRAFT_KEY = 'cns-labmatch-draft-v1';
const NEVER_SAVED = ['email', 'transcript', 'consent'];   // not in the draft
const NEVER_DOWNLOADED = ['email', 'transcript'];         // not in the downloaded file
const FALLBACK_TEXT_FIELDS = ['question_text', 'origin_text', 'bring_text'];
const STATUS_TIMEOUT_MS = 4000;
const SCORE_TIMEOUT_MS = 45000;
const DEV = new URLSearchParams(location.search).get('dev') === '1';
// An empty lm-api-base uses same-origin endpoints; GitHub Pages uses the separate Worker.
const API_BASE = (document.querySelector('meta[name="lm-api-base"]')?.getAttribute('content') || '').trim();
const apiUrl = (path) => (API_BASE ? new URL(path, API_BASE).href : path);
const IS_LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);

// Dev panel examples (?dev=1). A is the first answers object in test.jsonl minus the email (its transcript
// stays: it lives in page memory only, like a parsed one); B and C are hand-written. All three are complete,
// valid answers objects (exact option keys/strings, checked against model.questions). `mock` is what
// "Mock written-answer scores" uses after that example was filled.
const EXAMPLES = {
  "A": {
    "label": "BCI engineer, test.jsonl row 1",
    "answers": {
      "major": [
        "Electrical/Computer Engineering",
        "Computational Science"
      ],
      "minor": "Chemistry",
      "year": "Junior",
      "in_lab": "No, never been in one",
      "pull": [
        "devices",
        "ai"
      ],
      "likert_axes": {
        "computational": 4,
        "cognitive": 3,
        "organism": 1,
        "clinical": 1
      },
      "question_text": "how do you decode what someone intends from neural signals fast enough that a BCI actually feels responsive? idk maybe also how the decoder keeps working when the signal drifts over days",
      "origin_text": "EEL 4746 micro based design was fun and then I went to a BCI talk and got hooked. not sure if thats the right path tho",
      "organism_comfort": [
        "human"
      ],
      "wet_dry": 4,
      "coding": {
        "python": 2,
        "r": 1,
        "matlab": 2,
        "cpp_java": 2,
        "ml_frameworks": 1
      },
      "math_reached": "Linear algebra or ODE",
      "stats_ml": [
        "A programming course"
      ],
      "transcript": [
        {
          "course_code": "ENC 1101",
          "course_title": "Freshman Composition"
        },
        {
          "course_code": "CHM 1045",
          "course_title": "General Chemistry I"
        },
        {
          "course_code": "MAC 2311",
          "course_title": "Calculus with Analytic Geometry I"
        },
        {
          "course_code": "EGN 1004L",
          "course_title": "First Year Engineering Lab"
        },
        {
          "course_code": "ENC 2135",
          "course_title": "Research, Genre, and Context"
        },
        {
          "course_code": "MAC 2312",
          "course_title": "Calculus with Analytic Geometry II"
        },
        {
          "course_code": "PHY 2048C",
          "course_title": "General Physics A with Lab"
        },
        {
          "course_code": "COP 3363",
          "course_title": "Introduction to Programming in C++ for Majors"
        },
        {
          "course_code": "MAC 2313",
          "course_title": "Calculus with Analytic Geometry III"
        },
        {
          "course_code": "PHY 2049C",
          "course_title": "General Physics B with Lab"
        },
        {
          "course_code": "EEL 3002L",
          "course_title": "ECE Engineering Tools Lab"
        },
        {
          "course_code": "EEL 3111",
          "course_title": "Introduction to Circuit Analysis"
        },
        {
          "course_code": "MAP 2302",
          "course_title": "Differential Equations"
        },
        {
          "course_code": "MAS 3105",
          "course_title": "Applied Linear Algebra I"
        },
        {
          "course_code": "EEL 3112",
          "course_title": "Advanced Circuit Analysis with Computers"
        },
        {
          "course_code": "EEL 3112L",
          "course_title": "Advanced Circuits Lab"
        },
        {
          "course_code": "EEL 3705",
          "course_title": "Digital Logic Design"
        },
        {
          "course_code": "EEL 3705L",
          "course_title": "Digital Logic Lab"
        },
        {
          "course_code": "EEE 4301",
          "course_title": "Electronic Circuits and Systems Design (with EEE 4301L lab)"
        },
        {
          "course_code": "EEE 3300",
          "course_title": "Electronics"
        },
        {
          "course_code": "EEE 3300L",
          "course_title": "Electronics Lab"
        },
        {
          "course_code": "EEL 3135",
          "course_title": "Signal & Linear Systems Analysis"
        },
        {
          "course_code": "EEL 4746",
          "course_title": "Micro. Based System Design"
        },
        {
          "course_code": "EEL 4746L",
          "course_title": "Micro. Based System Design Lab"
        },
        {
          "course_code": "COP 3014",
          "course_title": "Programming I"
        },
        {
          "course_code": "CHM 1045L",
          "course_title": "General Chemistry I Lab"
        },
        {
          "course_code": "CHM 1046",
          "course_title": "General Chemistry II"
        },
        {
          "course_code": "CHM 1046L",
          "course_title": "General Chemistry II Lab"
        },
        {
          "course_code": "ISC 4933",
          "course_title": "Data Science Meets Health Science"
        }
      ],
      "career": "industry_ml",
      "project": "dis_multi_semester",
      "hours": "6-9",
      "start": "Next semester",
      "structure": 3,
      "lab_size": "either",
      "independence": 3,
      "ambiguity": 4,
      "bring_text": "a closed loop thing where a small decoder adjusts stimulation based on eeg in real time, kinda like the epilepsy devices but for attention",
      "consent": true
    },
    "mock": {
      "axis_computational": 4,
      "axis_cognitive": 2,
      "axis_organism": 1,
      "axis_clinical": 3,
      "topics": [
        "brain-computer interfaces",
        "neural decoding",
        "signal drift",
        "closed-loop stimulation"
      ],
      "evidence": "how do you decode what someone intends from neural signals fast enough that a BCI actually feels responsive?"
    }
  },
  "B": {
    "label": "pre-med, concussion recovery",
    "answers": {
      "major": [
        "Biological Science"
      ],
      "minor": "Psychology",
      "year": "First-year",
      "in_lab": "No, never been in one",
      "pull": [
        "disorders",
        "animals"
      ],
      "likert_axes": {
        "computational": 2,
        "cognitive": 3,
        "organism": 4,
        "clinical": 5
      },
      "question_text": "Why do some people bounce back from a concussion in a week while others have symptoms for months? I'd love to know what is different in their brains.",
      "origin_text": "My younger brother had a bad concussion playing soccer and I sat in on a lot of his appointments.",
      "organism_comfort": [
        "human",
        "rodent"
      ],
      "wet_dry": 2,
      "coding": {
        "python": 2,
        "r": 1,
        "matlab": 1,
        "cpp_java": 1,
        "ml_frameworks": 1
      },
      "math_reached": "Calculus 1",
      "stats_ml": [
        "None yet"
      ],
      "career": "md",
      "project": "urop",
      "hours": "6-9",
      "start": "Next semester",
      "structure": 2,
      "lab_size": "large",
      "independence": 2,
      "ambiguity": 2,
      "bring_text": "Test whether a quick balance and memory check after a head injury can predict who needs extra follow-up care.",
      "consent": true
    },
    "mock": {
      "axis_computational": 2,
      "axis_cognitive": 3,
      "axis_organism": 3,
      "axis_clinical": 5,
      "topics": [
        "concussion",
        "recovery",
        "brain injury",
        "clinical screening"
      ],
      "evidence": "Why do some people bounce back from a concussion in a week while others have symptoms for months?"
    }
  },
  "C": {
    "label": "math major, attractor networks",
    "answers": {
      "major": [
        "Mathematics",
        "Computational Science"
      ],
      "minor": "Physics",
      "year": "Junior",
      "in_lab": "No, but I have been before",
      "pull": [
        "circuits",
        "ai"
      ],
      "likert_axes": {
        "computational": 5,
        "cognitive": 2,
        "organism": 1,
        "clinical": 1
      },
      "question_text": "How can a network of slow, noisy neurons keep a memory stable for years? I want to know which kinds of dynamics make that possible, maybe attractor networks.",
      "origin_text": "A dynamical systems course used a Hopfield network as an example and I haven't stopped thinking about it.",
      "organism_comfort": [
        "in_silico_only"
      ],
      "wet_dry": 5,
      "coding": {
        "python": 4,
        "r": 2,
        "matlab": 4,
        "cpp_java": 3,
        "ml_frameworks": 3
      },
      "math_reached": "Beyond these",
      "stats_ml": [
        "Applied statistics / regression",
        "Machine learning course",
        "A programming course"
      ],
      "career": "phd",
      "project": "honors_thesis",
      "hours": "10-14",
      "start": "This semester",
      "structure": 5,
      "lab_size": "small",
      "independence": 5,
      "ambiguity": 5,
      "bring_text": "Fit a low-dimensional dynamical model to population recordings, then check whether the same model predicts behavior on the next day.",
      "consent": true
    },
    "mock": {
      "axis_computational": 5,
      "axis_cognitive": 2,
      "axis_organism": 1,
      "axis_clinical": 1,
      "topics": [
        "attractor networks",
        "memory stability",
        "dynamical systems",
        "population recordings"
      ],
      "evidence": "How can a network of slow, noisy neurons keep a memory stable for years?"
    }
  }
};

const $ = (id) => document.getElementById(id);
const settle = (p) => p.then((m) => ({ ok: true, m }), (e) => ({ ok: false, e }));

// Start every module download now, in parallel with the data; a failure is handled where it is used.
const mods = {
  matcher: settle(import('./matcher.js')),
  survey: settle(import('./survey.js')),
  types: settle(import('./viz-types.js')),
  cube: settle(import('./viz-cube.js')),
};

const state = {
  model: null,
  answers: null,
  results: null,
  textScores: null,
  scoring: { on: false, reason: 'not checked yet' },
  matcher: null,
  survey: null,
  viz: { types: null, cube: null },
  vizReady: null,
  cubeStepped: false,
  cubeFailed: false,
  scoreSeq: 0,
  scoreCtrl: null,
  cardSelect: null,
  draftMode: 'fresh',
  devExample: null,
};

let resolveReady;
let rejectReady;
const ready = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; });
ready.catch(() => {}); // a failed start is shown on the page; awaiting code still sees the rejection

const api = {
  ready,
  get model() { return state.model; },
  get answers() { return state.answers; },
  get results() { return state.results; },
  get textScores() { return state.textScores; },
};
window.__labmatch = api;

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

const setState = (s) => { document.body.dataset.lmState = s; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const numberWord = (n) => (Number.isInteger(n) && n >= 0 && n < WORDS.length ? WORDS[n] : String(n));

function scrollBehavior() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  } catch {
    return 'auto';
  }
}

function questions(model) {
  const sections = model && model.questions && Array.isArray(model.questions.sections) ? model.questions.sections : [];
  return sections.flatMap((s) => (Array.isArray(s.questions) ? s.questions : []));
}

function textFields() {
  const f = state.matcher && Array.isArray(state.matcher.TEXT_FIELDS) ? state.matcher.TEXT_FIELDS : FALLBACK_TEXT_FIELDS;
  return [...f];
}

function without(obj, keys) {
  const out = {};
  if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) if (!keys.includes(k)) out[k] = v;
  return out;
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// --------------------------------------------------------------------------------------- loading
async function loadModel() {
  const r = await fetch('data/model.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`data/model.json answered HTTP ${r.status}`);
  const m = await r.json();
  if (!m || !Array.isArray(m.labs) || !m.questions) throw new Error('data/model.json has no labs or questions');
  return m;
}

async function loadStatus() {
  const off = { on: false, reason: API_BASE ? 'the scoring service is unreachable' : 'no local server' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), STATUS_TIMEOUT_MS);
  try {
    const r = await fetch(apiUrl('api/status'), { cache: 'no-store', signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return off;
    const s = await r.json();
    if (!s || typeof s.text_scoring !== 'boolean') return off;
    return { on: s.text_scoring, reason: typeof s.reason === 'string' ? s.reason : '' };
  } catch {
    return off;
  } finally {
    clearTimeout(timer);
  }
}

function fillModelNote() {
  const m = state.model;
  const n = m.labs.length;
  const v = m.labs.filter((l) => l && l.verified === true).length;
  const verified = v === 0 ? 'none verified yet' : v === n ? 'all verified' : `${v} verified`;
  const note = $('lm-model-note');
  note.textContent = [IS_LOCAL ? 'Local preview' : 'Preview', `model v${m.version}, built ${m.built}`,
    `${n} labs, ${verified}`, `free-text scoring ${state.scoring.on ? 'on' : 'off'}`].join(' · ');
  note.title = state.scoring.on
    ? `Written answers are read by Claude Haiku through ${API_BASE ? 'the Lab Match API' : 'the local server'}.`
    : `Free-text scoring is off (${state.scoring.reason || 'not available'}).`;
}

function scoringNote() {
  const n = questions(state.model).filter((q) => q.type === 'free_text').length || 3;
  return state.scoring.on
    ? `Your ${numberWord(n)} written answers are sent to Claude Haiku (Anthropic) only to read your interests; nothing else you enter leaves this page.`
    : 'Written-answer scoring is off in this preview, so these answers stay on this page.';
}

function errorCard(kind, err) {
  const detail = err && err.message ? err.message : err ? String(err) : '';
  const card = el('div', { class: 'card dashed lm-error', role: 'alert' },
    el('p', { class: 'label', text: 'lab match · couldn’t start' }));
  card.append(
    el('h2', { class: 'h3', text: kind === 'model' ? 'The lab data didn’t load.'
      : kind === 'survey' ? 'The questions couldn’t be shown.' : 'Part of this page didn’t load.' }),
    el('p', { text: 'Check your connection and reload the page. If it still won’t load, try again later.' }),
    el('div', { class: 'cta-row' },
      el('button', { type: 'button', class: 'pill sm', text: 'Reload Lab Match', onclick: () => location.reload() }),
      el('a', { class: 'mono-link', href: 'projects.html', text: 'Back to projects' })),
  );
  if (detail) card.append(el('p', { class: 'lm-error-detail', text: `Details: ${detail}` }));
  return card;
}

function fail(kind, err) {
  console.error('[lab match] could not start:', err);
  setState('error');
  $('lm-results').hidden = true;
  $('lm-survey-section').hidden = false;
  $('lm-draft-line').hidden = true;
  $('lm-survey').replaceChildren(errorCard(kind, err));
  $('lm-model-note').textContent = 'Preview · Lab Match couldn’t load';
  rejectReady(err instanceof Error ? err : new Error(String(err)));
}

// ----------------------------------------------------------------------------------------- draft
const DRAFT_TEXT = {
  fresh: 'Your answers are saved in this browser as you go (never your email or transcript).',
  restored: 'Welcome back: your answers saved in this browser are filled in (never your email or transcript).',
  cleared: 'Removed your saved answers from this browser. Anything you change from now on is saved again.',
  blocked: 'This browser isn’t letting the page save, so your answers last only until you leave.',
};

function setDraftMode(mode) {
  state.draftMode = mode;
  for (const n of document.querySelectorAll('[data-lm-draft-text]')) n.textContent = DRAFT_TEXT[mode];
}

function saveDraft(answers) {
  const d = without(answers, NEVER_SAVED);
  try {
    if (Object.keys(d).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
    if (state.draftMode === 'blocked' || state.draftMode === 'cleared') setDraftMode('fresh');
  } catch {
    if (state.draftMode !== 'blocked') setDraftMode('blocked');
  }
}

function loadDraft() {
  let raw = null;
  try {
    raw = localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
    const clean = without(d, NEVER_SAVED);
    return Object.keys(clean).length ? clean : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage blocked: nothing was saved */
  }
}

function onSurveyChange(answers) {
  if (!answers || typeof answers !== 'object') return;
  state.answers = answers;
  saveDraft(answers);
}

// ---------------------------------------------------------------------------------------- results
function setStatus(text, { busy = false, retry = false } = {}) {
  const p = $('lm-status');
  p.textContent = text;
  p.classList.toggle('is-busy', busy);
  $('lm-retry').hidden = !retry;
}

function compute() {
  try {
    const r = state.matcher.computeResults(state.answers, state.model, state.textScores);
    if (!r || !r.ranks || !Array.isArray(r.ranks[3])) throw new Error('computeResults returned no ranking');
    state.results = r;
    return r;
  } catch (e) {
    console.error('[lab match] computeResults failed:', e);
    return null;
  }
}

function renderCards({ keepView = false } = {}) {
  const r = state.results;
  if (!r) return;
  const rows = r.ranks[3];
  const box = $('lm-matches');
  let limit = 5;
  let focusId = null;
  if (keepView) {
    limit = Math.max(5, box.querySelectorAll('.lm-card-item:not([hidden])').length);
    const a = document.activeElement;
    const card = a && box.contains(a) ? a.closest('.lm-card') : null;
    focusId = card ? card.getAttribute('data-lab-id') : null;
  }
  renderMatches(box, state.model, rows, { limit, onSelect: state.cubeFailed ? undefined : showInChart });
  renderExcluded($('lm-excluded'), state.model, rows, r.vector);
  renderWritten($('lm-written'), r.textScores !== undefined ? r.textScores : state.textScores);
  if (focusId) {
    const again = [...box.querySelectorAll('.lm-card')].find((n) => n.getAttribute('data-lab-id') === focusId);
    if (again) again.focus({ preventScroll: true });
  }
  renderDev();
}

function showResults() {
  $('lm-survey-section').hidden = true;
  $('lm-results').hidden = false;
}

function showSurvey() {
  $('lm-results').hidden = true;
  $('lm-survey-section').hidden = false;
  setState('survey');
}

function scrollToResults() {
  $('lm-results').scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  $('lm-results-title').focus({ preventScroll: true });
}

async function submit(answers) {
  if (!answers || typeof answers !== 'object' || !state.matcher) return;
  cancelScoring();
  state.answers = answers;
  state.textScores = null;
  saveDraft(answers);
  if (!compute()) {
    $('lm-draft-text').textContent = 'Something went wrong while working out your matches. Reload the page and try again.';
    return;
  }
  showResults();
  renderCards();
  setStatus('');
  setState('results');
  scrollToResults();
  await ensureCharts();
  updateCharts();
  scoreWrittenAnswers(answers);
}

// --------------------------------------------------------------------------------------- charts
const CHART_LABELS = {
  types: '01 — what kind of researcher you are',
  cube: '02 — how close you are to each lab',
};

function chartFailed(which, err) {
  console.warn(`[lab match] the ${which} chart failed; the rest of the page still works.`, err);
  const inst = state.viz[which];
  state.viz[which] = null;
  if (inst && typeof inst.destroy === 'function') {
    try { inst.destroy(); } catch { /* already broken */ }
  }
  const mount = $(which === 'types' ? 'lm-types' : 'lm-cube');
  mount.replaceChildren(
    el('p', { class: 'label', text: CHART_LABELS[which] }),
    el('p', { class: 'lm-chart-error', text: 'This chart didn’t load, so it’s skipped. Your matches below don’t depend on it.' }),
  );
  if (DEV && err) mount.append(el('p', { class: 'lm-error-detail', text: String((err && err.message) || err) }));
  if (which === 'cube' && !state.cubeFailed) {
    state.cubeFailed = true;
    if (state.results && !$('lm-results').hidden) renderCards({ keepView: true });
  }
}

function ensureCharts() {
  if (state.vizReady) return state.vizReady;
  state.vizReady = (async () => {
    const [tm, cm] = await Promise.all([mods.types, mods.cube]);
    if (tm.ok && typeof tm.m.createTypesViz === 'function') {
      try {
        state.viz.types = tm.m.createTypesViz($('lm-types'), state.model);
      } catch (e) {
        chartFailed('types', e);
      }
    } else {
      chartFailed('types', tm.ok ? new Error('viz-types.js has no createTypesViz') : tm.e);
    }
    if (cm.ok && typeof cm.m.createCubeViz === 'function') {
      try {
        const cube = cm.m.createCubeViz($('lm-cube'), state.model);
        state.viz.cube = cube;
        if (cube && typeof cube.onSelect === 'function') cube.onSelect(onChartSelect);
      } catch (e) {
        chartFailed('cube', e);
      }
    } else {
      chartFailed('cube', cm.ok ? new Error('viz-cube.js has no createCubeViz') : cm.e);
    }
  })();
  return state.vizReady;
}

function updateCharts() {
  const r = state.results;
  if (!r) return;
  const { types, cube } = state.viz;
  if (types) {
    try {
      types.update(r);
    } catch (e) {
      chartFailed('types', e);
    }
  }
  if (cube) {
    try {
      cube.update(r);
      if (!state.cubeStepped) {
        state.cubeStepped = true; // start at step 3 once; after that keep the step the student chose
        if (typeof cube.getStep !== 'function' || cube.getStep() !== 3) cube.setStep(3);
      }
    } catch (e) {
      chartFailed('cube', e);
    }
  }
}

function onChartSelect(labId) {
  const c = state.cardSelect;
  if (c && c.id === String(labId) && performance.now() - c.t < 800) return; // echo of our own select()
  highlightCard(labId);
}

function showInChart(labId) {
  const cube = state.viz.cube;
  if (!cube) return;
  state.cardSelect = { id: String(labId), t: performance.now() };
  try {
    cube.select(labId);
  } catch (e) {
    chartFailed('cube', e);
    return;
  }
  const mount = $('lm-cube');
  mount.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  const target = mount.querySelector('canvas[tabindex="0"]') || mount;
  target.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------- written-answer scores
const SCORE_ERRORS = {
  no_key: 'Written-answer scoring isn’t set up on this server (no API key), so these matches use your structured answers only.',
  no_sdk: 'The server is missing the anthropic package, so these matches use your structured answers only.',
  offline: 'The server couldn’t reach Claude, so these matches use your structured answers only.',
  rate_limited: 'Too many requests right now, so these matches use your structured answers only; try again in a minute.',
  api_error: 'Claude returned an error while reading your answers, so these matches use your structured answers only.',
  bad_request: 'The server couldn’t accept your written answers (one may be too long), so these matches use your structured answers only.',
};
const RETRYABLE = new Set(['offline', 'rate_limited', 'api_error', 'network', 'timeout']);
const NETWORK_MSG = 'The scoring service didn’t answer, so these matches use your structured answers only.';
const TIMEOUT_MSG = 'Reading your written answers took too long, so these matches use your structured answers only.';

function cancelScoring() {
  state.scoreSeq += 1;
  if (state.scoreCtrl) {
    try { state.scoreCtrl.abort(); } catch { /* ignore */ }
  }
  state.scoreCtrl = null;
}

/** ONLY the written answers, trimmed to each question's max_chars; null when nothing was written. */
function writtenPayload(answers) {
  const max = Object.fromEntries(questions(state.model).filter((q) => q.type === 'free_text').map((q) => [q.id, q.max_chars]));
  const out = {};
  for (const k of textFields()) {
    const v = answers && answers[k];
    if (typeof v === 'string' && v.trim()) out[k] = Number.isInteger(max[k]) ? v.slice(0, max[k]) : v;
  }
  return Object.keys(out).length ? out : null;
}

async function scoreWrittenAnswers(answers) {
  if (!state.scoring.on) {
    setStatus('These matches use your structured answers only; written-answer scoring is off in this preview.');
    return;
  }
  const payload = writtenPayload(answers);
  if (!payload) {
    setStatus('These matches use your structured answers only, since the written questions were left blank.');
    return;
  }
  cancelScoring();
  const seq = state.scoreSeq;
  const ctrl = new AbortController();
  state.scoreCtrl = ctrl;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, SCORE_TIMEOUT_MS);
  setStatus('Reading your written answers…', { busy: true });
  let res = null;
  let data = null;
  let failure = null;
  try {
    res = await fetch(apiUrl('api/score-text'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: ctrl.signal,
    });
    data = await res.json().catch(() => null);
  } catch {
    failure = timedOut ? 'timeout' : 'network';
  } finally {
    clearTimeout(timer);
  }
  if (seq !== state.scoreSeq) return; // superseded: edited, resubmitted or started over
  state.scoreCtrl = null;
  if (failure) {
    setStatus(failure === 'timeout' ? TIMEOUT_MSG : NETWORK_MSG, { retry: true });
    return;
  }
  if (!res.ok) {
    const code = data && typeof data.code === 'string' ? data.code : '';
    setStatus(Object.hasOwn(SCORE_ERRORS, code) ? SCORE_ERRORS[code]
      : `The server answered HTTP ${res.status}, so these matches use your structured answers only.`, { retry: RETRYABLE.has(code) });
    return;
  }
  const scores = data && data.scores;
  if (!scores || typeof scores !== 'object') {
    setStatus('Your written answers didn’t give a clear signal, so these matches use your structured answers only.');
    return;
  }
  state.textScores = scores;
  if (!compute()) {
    state.textScores = null;
    compute();
    setStatus('Your written answers came back in a shape this page can’t use, so these matches use your structured answers only.');
    return;
  }
  renderCards({ keepView: true });
  updateCharts();
  setStatus('Updated with your written answers.');
}

// ------------------------------------------------------------------------------------- actions
function editAnswers() {
  cancelScoring();
  showSurvey();
  if (state.survey) {
    try {
      state.survey.goTo(state.survey.stepCount - 1);
    } catch (e) {
      console.warn('[lab match] survey.goTo failed:', e);
    }
  }
  const sec = $('lm-survey-section');
  sec.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  sec.focus({ preventScroll: true });
}

/** One row per researcher type in model order: {id, label, jobs, share} (share 0..1, 4 dp, from the results). */
function typeShares() {
  const types = state.model && Array.isArray(state.model.types) ? state.model.types : [];
  const m = (state.results && state.results.membership && state.results.membership.memberships) || {};
  return types.map((t) => ({
    id: t.id,
    label: t.label,
    jobs: Array.isArray(t.jobs) ? t.jobs.slice() : [],
    share: Object.hasOwn(m, t.id) && typeof m[t.id] === 'number' ? m[t.id] : null,
  }));
}

function download() {
  if (!state.results || !state.model) return;
  const payload = {
    version: state.model.version,
    built: state.model.built,
    answers: without(state.answers, NEVER_DOWNLOADED),
    types: typeShares(),
    results: state.results,
    textScores: state.textScores,
  };
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' }));
  const a = el('a', { href: url, download: `lab-match-results-${today()}.json`, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function startOver() {
  let ok = true;
  try {
    ok = window.confirm('Start over? This clears your answers on this page and the copy saved in this browser.');
  } catch {
    ok = true;
  }
  if (!ok) return;
  cancelScoring();
  clearDraft();
  try {
    if (state.survey) state.survey.reset();
  } catch (e) {
    console.warn('[lab match] survey.reset failed:', e);
  }
  state.answers = null;
  state.results = null;
  state.textScores = null;
  state.devExample = null;
  $('lm-matches').replaceChildren();
  renderExcluded($('lm-excluded'), state.model, [], null);
  renderWritten($('lm-written'), null);
  setStatus('');
  showSurvey();
  setDraftMode('fresh');
  renderDev();
  const top = $('main');
  top.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  $('lm-survey-section').focus({ preventScroll: true });
}

function wireActions() {
  document.addEventListener('click', (e) => {
    const t = e.target instanceof Element ? e.target.closest('[data-lm-action]') : null;
    if (!t) return;
    const action = t.getAttribute('data-lm-action');
    if (action === 'edit') editAnswers();
    else if (action === 'download') download();
    else if (action === 'start-over') startOver();
    else if (action === 'retry') scoreWrittenAnswers(state.answers);
    else if (action === 'clear-draft') {
      clearDraft();
      setDraftMode('cleared');
    }
  });
}

// ------------------------------------------------------------------------------------- dev panel
function mockScoresFor(answers) {
  const ex = state.devExample && EXAMPLES[state.devExample];
  if (ex && ex.mock) return clone(ex.mock);
  const first = textFields().map((k) => answers && answers[k]).find((v) => typeof v === 'string' && v.trim());
  const evidence = first ? (first.trim().split(/(?<=[.?!])\s/)[0] || first).slice(0, 160) : 'mock evidence';
  return {
    axis_computational: 3, axis_cognitive: 4, axis_organism: 2, axis_clinical: 2,
    topics: ['mock topic', 'decision making', 'memory'], evidence,
  };
}

function fillExample(key, msg) {
  const ex = EXAMPLES[key];
  if (!ex || !state.survey) return;
  const answers = clone(ex.answers);
  cancelScoring();
  if (!$('lm-results').hidden) showSurvey();
  try {
    state.survey.setAnswers(answers);
    state.survey.goTo(state.survey.stepCount - 1);
  } catch (e) {
    msg.textContent = `Couldn’t fill the survey: ${(e && e.message) || e}`;
    return;
  }
  state.devExample = key;
  state.answers = answers;
  saveDraft(answers);
  $('lm-survey-section').scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  msg.textContent = `Filled example ${key} (${ex.label}). Submit it from the last step.`;
}

function mockScores(msg) {
  if (!state.results || !state.answers) {
    msg.textContent = 'Submit the survey first, then mock the written-answer scores.';
    return;
  }
  cancelScoring();
  state.textScores = mockScoresFor(state.answers);
  if (!compute()) {
    msg.textContent = 'computeResults failed with the mock scores (see the console).';
    return;
  }
  if ($('lm-results').hidden) {
    showResults();
    setState('results');
  }
  renderCards({ keepView: true });
  updateCharts();
  setStatus('Updated with your written answers (mock scores from the dev panel).');
  msg.textContent = 'Re-rendered with mock written-answer scores.';
}

const fmt4 = (x) => (typeof x === 'number' && Number.isFinite(x) ? x.toFixed(4) : '—');

function renderDev() {
  if (!DEV) return;
  const pre = $('lm-dev-vector');
  const box = $('lm-dev-table');
  if (!pre || !box) return;
  const r = state.results;
  if (!r) {
    pre.textContent = 'Submit the survey to see the vector.';
    box.replaceChildren();
    return;
  }
  pre.textContent = JSON.stringify({ vector: r.vector, membership: r.membership, xyz: r.xyz, textScores: state.textScores }, null, 1);
  const names = new Map(state.model.labs.map((l) => [l.id, l.name]));
  const lenses = (state.model.meta && state.model.meta.lenses) || [];
  const head = ['#', 'lab', 'score', 'fit', 'boost', ...lenses.map((l) => l.label), 'excluded'];
  const table = el('table', { class: 'lm-dev-table' },
    el('caption', { class: 'sr-only', text: 'Top 10 labs with their facet similarities' }),
    el('thead', null, el('tr', null, head.map((h) => el('th', { scope: 'col', text: h })))),
    el('tbody', null, r.ranks[3].slice(0, 10).map((row, i) => el('tr', null,
      el('td', { text: String(i + 1) }),
      el('td', { class: 'lm-dev-name', text: names.get(row.id) || row.id }),
      el('td', { text: fmt4(row.score) }),
      el('td', { text: fmt4(row.fit) }),
      el('td', { text: fmt4(row.boost) }),
      lenses.map((l) => el('td', { text: fmt4(row.lenses ? row.lenses[l.id] : null) })),
      el('td', { text: row.excluded || '' })))));
  const top = r.membership && r.membership.top;
  const shares = typeShares();
  const sum = shares.reduce((acc, t) => acc + (t.share || 0), 0);
  const typeTable = el('table', { class: 'lm-dev-table' },
    el('caption', { class: 'sr-only', text: 'Researcher type shares' }),
    el('thead', null, el('tr', null, ['type', 'label', 'share', 'jobs'].map((h) => el('th', { scope: 'col', text: h })))),
    el('tbody', null, shares.map((t) => el('tr', null,
      el('td', { text: t.id === top ? `${t.id} (top)` : String(t.id) }),
      el('td', { class: 'lm-dev-name', text: t.label || '' }),
      el('td', { text: fmt4(t.share) }),
      el('td', { text: t.jobs.join('; ') })))),
    el('tfoot', null, el('tr', null, el('td', { text: `${shares.length} types` }), el('td', { text: 'sum' }), el('td', { text: fmt4(sum) }), el('td'))));
  box.replaceChildren(table, typeTable);
}

function mountDev() {
  const aside = $('lm-dev');
  const msg = el('p', { class: 'lm-dev-msg', 'aria-live': 'polite' });
  const row = el('div', { class: 'lm-dev-row' });
  for (const [key, ex] of Object.entries(EXAMPLES)) {
    row.append(el('button', {
      type: 'button', class: 'fchip', 'data-lm-example': key, text: `${key} · ${ex.label}`, onclick: () => fillExample(key, msg),
    }));
  }
  row.append(el('button', { type: 'button', class: 'fchip', 'data-lm-mock': '', text: 'Mock written-answer scores', onclick: () => mockScores(msg) }));
  aside.replaceChildren(
    el('h2', { class: 'label lm-label-h', id: 'lm-dev-title', text: 'dev panel · ?dev=1' }),
    el('p', {
      class: 'lm-dev-note',
      text: `Free-text scoring: ${state.scoring.on ? 'on' : 'off'}${state.scoring.reason ? ` (${state.scoring.reason})` : ''}. ` +
        'An example fills the survey and jumps to its last step.',
    }),
    row,
    msg,
    el('details', { class: 'lm-dev-details' },
      el('summary', { text: 'Vector, lens table (top 10 labs) and type shares' }),
      el('pre', { class: 'lm-dev-pre', id: 'lm-dev-vector' }),
      el('div', { class: 'lm-dev-scroll', id: 'lm-dev-table' })),
  );
  aside.hidden = false;
  renderDev();
}

// ------------------------------------------------------------------------------------------ start
async function init() {
  setState('loading');
  const header = $('site-head');
  const measureHeader = () => {
    document.documentElement.style.setProperty('--lm-head-clear', `${Math.ceil(header.getBoundingClientRect().height) + 16}px`);
  };
  measureHeader();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measureHeader).observe(header);
  else window.addEventListener('resize', measureHeader);
  const statusP = loadStatus();
  let model;
  try {
    model = await loadModel();
  } catch (e) {
    fail('model', e);
    return;
  }
  state.model = model;
  state.scoring = await statusP;
  fillModelNote();

  const [mm, sm] = await Promise.all([mods.matcher, mods.survey]);
  if (!mm.ok || typeof mm.m.computeResults !== 'function') {
    fail('scripts', mm.ok ? new Error('matcher.js has no computeResults') : mm.e);
    return;
  }
  if (!sm.ok || typeof sm.m.createSurvey !== 'function') {
    fail('scripts', sm.ok ? new Error('survey.js has no createSurvey') : sm.e);
    return;
  }
  state.matcher = mm.m;

  const draft = loadDraft();
  const mount = $('lm-survey');
  mount.replaceChildren();
  try {
    state.survey = sm.m.createSurvey(mount, model.questions, {
      initialAnswers: draft ? clone(draft) : {},
      onChange: onSurveyChange,
      onSubmit: (answers) => { submit(answers); },
      textScoringNote: scoringNote(),
    });
  } catch (e) {
    fail('survey', e);
    return;
  }
  state.answers = draft;
  setDraftMode(draft ? 'restored' : 'fresh');
  $('lm-draft-line').hidden = false;

  try {
    renderHowItWorks($('lm-how'), model, { textScoring: state.scoring.on });
  } catch (e) {
    console.warn('[lab match] the FAQ failed to render:', e);
  }
  wireActions();
  if (DEV) mountDev();
  setState('survey');
  resolveReady(api);
}

init().catch((e) => fail('scripts', e));
