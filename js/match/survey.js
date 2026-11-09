// survey.js: the Lab Match survey wizard, rendered entirely from the questions data
// (model.questions, same shape as questions.json). One step per section.
//
// createSurvey(root, questions, { initialAnswers, onSubmit, onChange, textScoringNote, emailNote, emailPrompt,
//   emailOptIn: {checked, label, onChange(bool)} | null })
//   -> { getAnswers(), setAnswers(a), goTo(i), stepCount, reset(), destroy() }
//
// Answers follow the README "Answers object". Unanswered fields are omitted. The transcript is kept
// in memory only (course codes + titles); its raw text or file is dropped right after parsing.
// Data-derived text always goes into the DOM through textContent.

import { parseTranscriptFile, parseTranscriptText, suggestMath } from './transcript.js';

let instances = 0;

// Under the email box when the page doesn't pass emailNote (it does: the text depends on api/status).
// emailPrompt, when passed, replaces the email question's label for the same reason.
const EMAIL_NOTE_OFF = 'Emailing your matches is off in this preview, so nothing is sent and your address isn’t stored.';

const MSG = {
  one: 'Choose one.',
  multi: 'Pick at least one.',
  grid: 'Answer each row.',
  scale: 'Pick a point on the scale.',
  text: 'Write a sentence or two.',
  email: 'Enter an email address like name@example.com, or leave it blank.',
  emailNeeded: 'Enter your email to get your matches by email, or untick the box.',
  consent: 'Please confirm to see your matches.',
};
const NONE_YET = 'None yet';
const OTHER = 'Other';
const SLIDER_POINTS = 5;

// ---------------------------------------------------------------------------------------- helpers
function h(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const kid of kids) {
    if (kid === null || kid === undefined || kid === false) continue;
    n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

const optKey = (o) => (o && typeof o === 'object' ? String(o.key) : String(o));
const optLabel = (o) => (o && typeof o === 'object' ? String(o.label ?? o.key) : String(o));
const pad2 = (n) => String(n).padStart(2, '0');
const hasOwn = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);

function isRequired(q) {
  if (q.type === 'text_short' || q.type === 'file_client_parsed' || q.type === 'email_fsu') return false;
  if (q.id === 'stats_ml') return false;
  if (typeof q.prompt === 'string' && q.prompt.toLowerCase().includes('(optional)')) return false;
  return true;
}

function toInt(v, lo, hi) {
  if (typeof v === 'boolean' || v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
}

function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

function cleanCourses(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const c of list) {
    if (!c || typeof c.course_code !== 'string') continue;
    const code = c.course_code.replace(/\s+/g, ' ').trim().slice(0, 12);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const title = typeof c.course_title === 'string' ? c.course_title.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    out.push({ course_code: code, course_title: title });
  }
  return out;
}

// A pill option: a native radio/checkbox inside its label, styled through the sibling span.
function pillOption(type, name, value, text, id, extraClass = '') {
  const input = h('input', { type, name, value, id, class: 'lm-opt-input' });
  const label = h('label', { class: `lm-opt ${extraClass}`.trim(), for: id },
    input,
    h('span', { class: 'lm-opt-pill' },
      h('span', { class: 'lm-opt-mark', 'aria-hidden': 'true' }),
      h('span', { class: 'lm-opt-text', text })));
  return { label, input };
}

// ------------------------------------------------------------------------------------ controllers
// Each controller: { q, wrap, err, errId, required, get(), set(v), clear(), validate(), inputs(),
//                    focusTarget(), describe: [ids] }
function baseShell(q, uid, group) {
  const wrap = h(group ? 'fieldset' : 'div', {
    class: `lm-q lm-q-${q.type}`, id: `${uid}-q-${q.id}`, 'data-qid': q.id,
  });
  const errId = `${uid}-err-${q.id}`;
  const err = h('p', { class: 'lm-err', id: errId, hidden: true });
  return { wrap, err, errId };
}

function legendFor(q, uid) {
  return h('legend', { class: 'lm-prompt', id: `${uid}-p-${q.id}`, text: q.prompt || '' });
}

function choiceCtrl(q, uid, ctx) {
  const multi = q.type !== 'select_one';
  const { wrap, err, errId } = baseShell(q, uid, true);
  wrap.append(legendFor(q, uid));
  const describe = [];
  let helper = null;
  if (q.type === 'select_up_to_2') {
    helper = h('p', { class: 'lm-help', id: `${uid}-h-${q.id}`, text: 'Pick up to 2' });
    describe.push(helper.id);
    wrap.append(helper);
  }
  wrap.append(err);
  const box = h('div', { class: 'lm-opts' + (multi ? ' lm-opts-multi' : '') });
  const name = `${uid}-${q.id}`;
  const opts = (q.options || []).map((o, i) => {
    const r = pillOption(multi ? 'checkbox' : 'radio', name, optKey(o), optLabel(o), `${name}-${i}`);
    box.append(r.label);
    return r.input;
  });
  wrap.append(box);

  let otherWrap = null;
  let otherInput = null;
  const otherBox = q.type === 'select_multi_other' ? opts.find((i) => i.value === OTHER) : null;
  if (otherBox) {
    otherInput = h('input', { type: 'text', id: `${name}-other`, class: 'lm-input', maxlength: 80, autocomplete: 'off' });
    otherWrap = h('div', { class: 'lm-other', hidden: true },
      h('label', { class: 'lm-sublabel', for: otherInput.id, text: 'Tell us which' }), otherInput);
    wrap.append(otherWrap);
  }
  const noneBox = multi ? opts.find((i) => i.value === NONE_YET) : null;

  function sync() {
    if (q.type === 'select_up_to_2') {
      const n = opts.filter((i) => i.checked).length;
      for (const i of opts) i.disabled = n >= 2 && !i.checked;
      helper.textContent = n >= 2 ? 'Pick up to 2 · uncheck one to change' : 'Pick up to 2';
    }
    if (otherWrap) otherWrap.hidden = !otherBox.checked;
  }

  box.addEventListener('change', (e) => {
    const t = e.target;
    if (noneBox && t instanceof HTMLInputElement && t.checked) {
      if (t === noneBox) { for (const i of opts) if (i !== noneBox) i.checked = false; }
      else noneBox.checked = false;
    }
    const wasHidden = otherWrap ? otherWrap.hidden : true;
    sync();
    if (otherWrap && wasHidden && !otherWrap.hidden && t === otherBox) otherInput.focus();
  });

  return {
    q, wrap, err, errId, required: isRequired(q), describe,
    inputs: () => opts.concat(otherInput ? [otherInput] : []),
    focusTarget: () => opts.find((i) => i.checked) || opts.find((i) => !i.disabled) || opts[0],
    get() {
      if (!multi) {
        const c = opts.find((i) => i.checked);
        return c ? c.value : undefined;
      }
      const vals = opts.filter((i) => i.checked).map((i) => {
        if (i === otherBox) {
          const t = otherInput.value.replace(/\s+/g, ' ').trim();
          return t ? `${OTHER}: ${t}` : OTHER;
        }
        return i.value;
      });
      return vals.length ? vals : undefined;
    },
    set(v) {
      if (!multi) {
        const s = typeof v === 'string' ? v : null;
        for (const i of opts) i.checked = s !== null && i.value === s;
      } else if (Array.isArray(v)) {
        const strs = v.filter((x) => typeof x === 'string');
        for (const i of opts) i.checked = strs.includes(i.value);
        if (otherBox) {
          const known = new Set(opts.map((i) => i.value));
          const extra = strs.find((s) => s.startsWith(`${OTHER}:`)) ?? strs.find((s) => !known.has(s));
          if (extra !== undefined) {
            otherBox.checked = true;
            otherInput.value = extra.startsWith(`${OTHER}:`) ? extra.slice(OTHER.length + 1).trim() : extra;
          } else if (!otherBox.checked) otherInput.value = '';
        }
        if (q.type === 'select_up_to_2') {
          let n = 0;
          for (const i of opts) { if (i.checked && ++n > 2) i.checked = false; }
        }
        if (noneBox && noneBox.checked && opts.some((i) => i !== noneBox && i.checked)) noneBox.checked = false;
      } else return;
      sync();
    },
    clear() {
      for (const i of opts) { i.checked = false; i.disabled = false; }
      if (otherInput) otherInput.value = '';
      sync();
    },
    validate() {
      if (!this.required) return null;
      return opts.some((i) => i.checked) ? null : (multi ? MSG.multi : MSG.one);
    },
  };
}

function gridCtrl(q, uid) {
  const { wrap, err, errId } = baseShell(q, uid, true);
  const scale = Array.isArray(q.scale) ? q.scale : [];
  const n = scale.length;
  wrap.append(q.prompt ? legendFor(q, uid) : h('legend', { class: 'sr-only', text: 'Rate each row on the scale' }));
  wrap.append(err);
  const grid = h('div', { class: 'lm-grid' });
  grid.style.setProperty('--lm-cols', String(n));
  const head = h('div', { class: 'lm-grid-head', 'aria-hidden': 'true' }, h('span', { class: 'lm-grid-corner' }));
  scale.forEach((s) => head.append(h('span', { class: 'lm-grid-col', text: s })));
  grid.append(head);
  const rows = (q.rows || []).map((row) => {
    const key = optKey(row);
    const name = `${uid}-${q.id}-${key}`;
    const labelId = `${name}-label`;
    const rg = h('div', { class: 'lm-grid-row', role: 'radiogroup', 'aria-labelledby': labelId },
      h('span', { class: 'lm-row-label', id: labelId, text: optLabel(row) }));
    const inputs = scale.map((s, i) => {
      const id = `${name}-${i + 1}`;
      const input = h('input', { type: 'radio', name, value: i + 1, id, class: 'lm-opt-input' });
      rg.append(h('label', { class: 'lm-cell', for: id }, input,
        h('span', { class: 'lm-cell-pill' },
          h('span', { class: 'lm-opt-mark', 'aria-hidden': 'true' }),
          h('span', { class: 'lm-cell-text', text: s }))));
      return input;
    });
    grid.append(rg);
    return { key, inputs, rg };
  });
  wrap.append(grid);
  return {
    q, wrap, err, errId, required: isRequired(q), describe: [],
    inputs: () => rows.flatMap((r) => r.inputs),
    focusTarget: () => {
      const r = rows.find((x) => !x.inputs.some((i) => i.checked)) || rows[0];
      return r ? r.inputs[0] : null;
    },
    get() {
      const out = {};
      let any = false;
      for (const r of rows) {
        const c = r.inputs.find((i) => i.checked);
        if (c) { out[r.key] = Number(c.value); any = true; }
      }
      return any ? out : undefined;
    },
    set(v) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return;
      for (const r of rows) {
        if (!hasOwn(v, r.key)) continue;
        const k = toInt(v[r.key], 1, n);
        r.inputs.forEach((i, idx) => { i.checked = k === idx + 1; });
      }
    },
    clear() { for (const r of rows) for (const i of r.inputs) i.checked = false; },
    validate() {
      if (!this.required) return null;
      return rows.every((r) => r.inputs.some((i) => i.checked)) ? null : MSG.grid;
    },
  };
}

function sliderCtrl(q, uid) {
  const { wrap, err, errId } = baseShell(q, uid, true);
  wrap.append(legendFor(q, uid), err);
  const name = `${uid}-${q.id}`;
  const left = String(q.left ?? '');
  const right = String(q.right ?? '');
  const seg = h('div', { class: 'lm-seg' });
  const inputs = [];
  for (let v = 1; v <= SLIDER_POINTS; v++) {
    const id = `${name}-${v}`;
    const input = h('input', { type: 'radio', name, value: v, id, class: 'lm-opt-input' });
    const sr = v === 1 ? `: ${left}` : v === SLIDER_POINTS ? `: ${right}` : ` of ${SLIDER_POINTS}`;
    seg.append(h('label', { class: 'lm-seg-opt', for: id }, input,
      h('span', { class: 'lm-seg-pill' },
        h('span', { class: 'lm-seg-num', text: String(v) }),
        h('span', { class: 'sr-only', text: sr }))));
    inputs.push(input);
  }
  wrap.append(h('div', { class: 'lm-scale' },
    h('span', { class: 'lm-anchor lm-anchor-left', 'aria-hidden': 'true', text: left }),
    seg,
    h('span', { class: 'lm-anchor lm-anchor-right', 'aria-hidden': 'true', text: right })));
  return {
    q, wrap, err, errId, required: isRequired(q), describe: [],
    inputs: () => inputs,
    focusTarget: () => inputs.find((i) => i.checked) || inputs[0],
    get() { const c = inputs.find((i) => i.checked); return c ? Number(c.value) : undefined; },
    set(v) { const k = toInt(v, 1, SLIDER_POINTS); if (k === null) return; inputs.forEach((i, idx) => { i.checked = k === idx + 1; }); },
    clear() { for (const i of inputs) i.checked = false; },
    validate() {
      if (!this.required) return null;
      return inputs.some((i) => i.checked) ? null : MSG.scale;
    },
  };
}

function textCtrl(q, uid, ctx) {
  const { wrap, err, errId } = baseShell(q, uid, false);
  const id = `${uid}-in-${q.id}`;
  const describe = [];
  const prompt = q.type === 'email_fsu' && ctx.emailPrompt ? ctx.emailPrompt : q.prompt;
  const label = h('label', { class: 'lm-prompt', for: id, text: prompt || '' });
  let input;
  let counter = null;
  let note = null;
  let optIn = null;
  if (q.type === 'free_text') {
    const max = Number.isInteger(q.max_chars) && q.max_chars > 0 ? q.max_chars : 600;
    input = h('textarea', { id, class: 'lm-textarea', maxlength: max, rows: 4 });
    counter = h('p', { class: 'lm-count', id: `${id}-count`, 'aria-live': 'off', text: `0 / ${max}` });
    input.addEventListener('input', () => { counter.textContent = `${input.value.length} / ${max}`; });
    if (ctx.textScoringNote) {
      note = h('p', { class: 'lm-note', id: `${id}-note`, text: ctx.textScoringNote });
      describe.push(note.id);
    }
    wrap.append(label, err, input, h('div', { class: 'lm-under' }, note || h('span'), counter));
  } else if (q.type === 'email_fsu') {
    input = h('input', { id, class: 'lm-input', type: 'email', autocomplete: 'email', inputmode: 'email', spellcheck: 'false', maxlength: 120 });
    note = h('p', { class: 'lm-note', id: `${id}-note`, text: ctx.emailNote || EMAIL_NOTE_OFF });
    describe.push(note.id);
    wrap.append(label, err, input);
    // "Email me my matches" opt-in, only when the page offers emailing. Kept out of the answers (and so out of
    // the draft and the download): the page hears about it through ctx.emailOptIn.onChange.
    if (ctx.emailOptIn) {
      optIn = h('input', { type: 'checkbox', id: `${id}-send`, class: 'lm-check-input' });
      optIn.checked = Boolean(ctx.emailOptIn.checked);
      optIn.addEventListener('change', () => ctx.emailOptIn.onChange(optIn.checked));
      wrap.append(h('label', { class: 'lm-consent lm-email-optin', for: optIn.id }, optIn,
        h('span', { class: 'lm-consent-text', text: ctx.emailOptIn.label || 'Email me my matches when they’re ready' })));
    }
    wrap.append(note);
  } else {
    input = h('input', { id, class: 'lm-input', type: 'text', maxlength: 160, autocomplete: 'off' });
    wrap.append(label, err, input);
  }
  let re = null;
  if (q.type === 'email_fsu') {
    // any address now (not only @fsu.edu, which questions.json's older `validate` still says); the page checks
    // the stricter plain-address rule before sending
    re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  }
  const refresh = () => {
    if (counter) counter.textContent = `${input.value.length} / ${input.maxLength}`;
  };
  return {
    q, wrap, err, errId, required: isRequired(q), describe,
    inputs: () => [input],
    focusTarget: () => input,
    get() { const t = input.value.trim(); return t ? t : undefined; },
    set(v) { if (typeof v !== 'string') return; input.value = v.slice(0, input.maxLength > 0 ? input.maxLength : undefined); refresh(); },
    clear() {
      input.value = '';
      refresh();
      if (optIn && optIn.checked) { optIn.checked = false; ctx.emailOptIn.onChange(false); }
    },
    validate() {
      const t = input.value.trim();
      if (optIn && optIn.checked && !t) return MSG.emailNeeded;
      if (re) return t && !re.test(t) ? MSG.email : null;
      if (!this.required) return null;
      return t ? null : MSG.text;
    },
  };
}

function consentCtrl(q, uid) {
  const { wrap, err, errId } = baseShell(q, uid, false);
  const id = `${uid}-in-${q.id}`;
  const input = h('input', { type: 'checkbox', id, class: 'lm-check-input' });
  wrap.append(err, h('label', { class: 'lm-consent', for: id }, input,
    h('span', { class: 'lm-consent-text', text: q.prompt || '' })));
  return {
    q, wrap, err, errId, required: isRequired(q), describe: [],
    inputs: () => [input],
    focusTarget: () => input,
    get() { return input.checked ? true : undefined; },
    set(v) { if (typeof v === 'boolean') input.checked = v; },
    clear() { input.checked = false; },
    validate() { return this.required && !input.checked ? MSG.consent : null; },
  };
}

function transcriptCtrl(q, uid, ctx) {
  const { wrap, err, errId } = baseShell(q, uid, false);
  const id = `${uid}-tr`;
  let confirmed = [];
  let found = [];

  const note = h('p', { class: 'lm-prompt lm-privacy', id: `${id}-note`, text: q.prompt || '' });
  const fileInput = h('input', { type: 'file', id: `${id}-file`, class: 'lm-file', accept: '.pdf,.txt,application/pdf,text/plain', 'aria-describedby': note.id });
  const fileRow = h('div', { class: 'lm-file-row' },
    h('label', { class: 'lm-sublabel', for: fileInput.id, text: 'Choose a transcript file (.pdf or .txt)' }), fileInput);
  const toggle = h('button', { type: 'button', class: 'mono-link lm-paste-toggle', 'aria-expanded': 'false', 'aria-controls': `${id}-paste`, text: 'or paste the text instead' });
  const pasteArea = h('textarea', { id: `${id}-text`, class: 'lm-textarea', rows: 6, spellcheck: 'false', autocomplete: 'off' });
  const findBtn = h('button', { type: 'button', class: 'pill sm teal lm-find', text: 'Find courses' });
  const paste = h('div', { class: 'lm-paste', id: `${id}-paste`, hidden: true },
    h('label', { class: 'lm-sublabel', for: pasteArea.id, text: 'Transcript text' }), pasteArea, findBtn);
  const status = h('p', { class: 'lm-status', id: `${id}-status`, role: 'status', 'aria-live': 'polite' });
  const pick = h('div', { class: 'lm-tr-pick' }, fileRow, toggle, paste);

  const reviewList = h('div', { class: 'lm-courses' });
  const reviewCount = h('p', { class: 'lm-help', id: `${id}-count` });
  const useBtn = h('button', { type: 'button', class: 'pill sm teal' });
  const cancelBtn = h('button', { type: 'button', class: 'mono-link', text: 'Start over' });
  const review = h('fieldset', { class: 'lm-tr-review', hidden: true },
    h('legend', { class: 'lm-sublabel', text: 'Courses we found. Uncheck any that are wrong.' }),
    reviewCount, reviewList, h('div', { class: 'lm-row-actions' }, useBtn, cancelBtn));

  const doneText = h('p', { class: 'lm-done-text' });
  const doneList = h('ul', { class: 'lm-course-tags', 'aria-label': 'Courses in use' });
  const mathText = h('p', { class: 'lm-math-text' });
  const mathBtn = h('button', { type: 'button', class: 'pill sm', text: 'Use it' });
  const mathOffer = h('div', { class: 'lm-math', hidden: true }, mathText, mathBtn);
  const removeBtn = h('button', { type: 'button', class: 'mono-link', text: 'Remove transcript' });
  const done = h('div', { class: 'lm-tr-done', hidden: true }, doneText, doneList, mathOffer, removeBtn);

  wrap.append(note, err, pick, status, review, done);

  function view(which) {
    pick.hidden = which !== 'pick';
    review.hidden = which !== 'review';
    done.hidden = which !== 'done';
  }
  function updateUse() {
    const n = reviewList.querySelectorAll('input:checked').length;
    useBtn.textContent = `Use these ${n} course${n === 1 ? '' : 's'}`;
    useBtn.disabled = n === 0;
    useBtn.setAttribute('aria-disabled', n === 0 ? 'true' : 'false');
  }
  function showFound(result) {
    found = cleanCourses(result.courses);
    status.textContent = '';
    if (!found.length) {
      status.textContent = (result.warnings && result.warnings[0]) || 'No courses found. Try pasting the text instead.';
      view('pick');
      return;
    }
    reviewList.replaceChildren();
    found.forEach((c, i) => {
      const cid = `${id}-c-${i}`;
      const input = h('input', { type: 'checkbox', id: cid, class: 'lm-check-input', checked: true, 'data-i': i });
      reviewList.append(h('label', { class: 'lm-course', for: cid }, input,
        h('span', { class: 'lm-course-code', text: c.course_code }),
        h('span', { class: 'lm-course-title', text: c.course_title })));
    });
    reviewCount.textContent = `We found ${found.length} course${found.length === 1 ? '' : 's'}.`;
    updateUse();
    view('review');
    useBtn.focus();
  }
  function renderDone(focus) {
    doneList.replaceChildren();
    for (const c of confirmed) {
      const li = h('li', { class: 'tag dim', text: c.course_code });
      if (c.course_title) li.title = c.course_title;
      doneList.append(li);
    }
    doneText.textContent = `Using ${confirmed.length} course${confirmed.length === 1 ? '' : 's'} from your transcript. They stay in this tab only.`;
    const m = suggestMath(confirmed);
    if (m && ctx.getAnswer('math_reached') !== m.level && ctx.hasQuestion('math_reached')) {
      mathText.textContent = `Your highest math course looks like ${m.code} (${m.level}). Use it for your highest math?`;
      mathBtn.hidden = false;
      mathOffer.hidden = false;
      mathBtn.onclick = () => {
        ctx.setAnswer('math_reached', m.level);
        mathText.textContent = `Highest math set to ${m.level}.`;
        mathBtn.hidden = true;
        ctx.changed();
        mathText.setAttribute('tabindex', '-1');
        mathText.focus();
      };
    } else {
      mathOffer.hidden = true;
    }
    view(confirmed.length ? 'done' : 'pick');
    if (focus) { doneText.setAttribute('tabindex', '-1'); doneText.focus(); }
  }

  toggle.addEventListener('click', () => {
    const open = paste.hidden;
    paste.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) pasteArea.focus();
  });
  findBtn.addEventListener('click', () => {
    const result = parseTranscriptText(pasteArea.value);
    pasteArea.value = '';     // discard the raw text immediately
    showFound(result);
  });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    status.textContent = 'Reading your transcript in this browser…';
    const result = await parseTranscriptFile(f);
    fileInput.value = '';     // drop the file reference
    showFound(result);
  });
  reviewList.addEventListener('change', updateUse);
  useBtn.addEventListener('click', () => {
    if (useBtn.disabled) return;
    const keep = [...reviewList.querySelectorAll('input:checked')].map((i) => found[Number(i.dataset.i)]).filter(Boolean);
    confirmed = cleanCourses(keep);
    found = [];
    reviewList.replaceChildren();
    renderDone(true);
    ctx.changed();
  });
  cancelBtn.addEventListener('click', () => {
    found = [];
    reviewList.replaceChildren();
    view('pick');
    fileInput.focus();
  });
  removeBtn.addEventListener('click', () => {
    confirmed = [];
    status.textContent = 'Transcript removed.';
    view('pick');
    ctx.changed();
    fileInput.focus();
  });

  return {
    q, wrap, err, errId, required: false, describe: [],
    inputs: () => [fileInput],
    focusTarget: () => fileInput,
    get() { return confirmed.length ? confirmed.map((c) => ({ course_code: c.course_code, course_title: c.course_title })) : undefined; },
    set(v) { if (!Array.isArray(v)) return; confirmed = cleanCourses(v); found = []; status.textContent = ''; renderDone(false); },
    clear() {
      confirmed = []; found = []; pasteArea.value = ''; fileInput.value = ''; status.textContent = '';
      reviewList.replaceChildren(); paste.hidden = true; toggle.setAttribute('aria-expanded', 'false'); view('pick');
    },
    validate() { return null; },
  };
}

function makeCtrl(q, uid, ctx) {
  switch (q.type) {
    case 'select_one':
    case 'select_multi':
    case 'select_up_to_2':
    case 'select_multi_other':
      return choiceCtrl(q, uid, ctx);
    case 'likert_grid': return gridCtrl(q, uid);
    case 'slider': return sliderCtrl(q, uid);
    case 'free_text':
    case 'text_short':
    case 'email_fsu':
      return textCtrl(q, uid, ctx);
    case 'checkbox': return consentCtrl(q, uid);
    case 'file_client_parsed': return transcriptCtrl(q, uid, ctx);
    default:
      console.warn('[lab match] unknown question type, skipped:', q.type);
      return null;
  }
}

// ------------------------------------------------------------------------------------------ wizard
export function createSurvey(root, questions, opts = {}) {
  if (!root) throw new Error('createSurvey: no root element');
  const { initialAnswers = {}, onSubmit, onChange, textScoringNote = '', emailNote = '', emailPrompt = '',
    emailOptIn = null } = opts || {};
  const sections = questions && Array.isArray(questions.sections) ? questions.sections : [];
  if (!sections.length) throw new Error('createSurvey: questions.sections is empty');

  const uid = `lm${++instances}`;
  let current = 0;
  let maxVisited = 0;
  let timer = null;
  let destroyed = false;
  const byId = new Map();

  const ctx = {
    textScoringNote: typeof textScoringNote === 'string' ? textScoringNote : '',
    emailNote: typeof emailNote === 'string' ? emailNote : '',
    emailPrompt: typeof emailPrompt === 'string' ? emailPrompt : '',
    emailOptIn: emailOptIn && typeof emailOptIn.onChange === 'function' ? emailOptIn : null,
    getAnswer: (qid) => (byId.has(qid) ? byId.get(qid).get() : undefined),
    setAnswer: (qid, v) => { if (byId.has(qid)) { byId.get(qid).set(v); recheck(byId.get(qid)); } },
    hasQuestion: (qid) => byId.has(qid),
    changed: () => schedule(),
  };

  // --- skeleton
  const shell = h('div', { class: 'lm-survey', id: `${uid}-top` });
  const progress = h('p', { class: 'lm-progress' });
  const stepList = h('ol', { class: 'lm-steps' });
  const stepper = h('nav', { class: 'lm-stepper', 'aria-label': 'Survey steps' }, stepList);
  const body = h('div', { class: 'lm-body' });
  const backBtn = h('button', { type: 'button', class: 'mono-link lm-back', text: 'Back' });
  const nextBtn = h('button', { type: 'button', class: 'pill md teal lm-next' });
  const nav = h('div', { class: 'lm-nav' }, backBtn, nextBtn);
  shell.append(h('div', { class: 'lm-head' }, progress, stepper), body, nav);

  const steps = sections.map((sec, si) => {
    const headId = `${uid}-s${si}-h`;
    const heading = h('h2', { class: 'lm-step-title', id: headId, tabindex: '-1', text: sec.title || `Step ${si + 1}` });
    const section = h('section', { class: 'lm-step', 'aria-labelledby': headId, hidden: true });
    section.append(heading);
    if (sec.intro) section.append(h('p', { class: 'lm-intro', text: sec.intro }));
    const summary = h('div', { class: 'lm-errsum', role: 'alert', tabindex: '-1', hidden: true });
    section.append(summary);
    const ctrls = [];
    for (const q of sec.questions || []) {
      if (!q || typeof q.id !== 'string' || byId.has(q.id)) continue;
      const c = makeCtrl(q, uid, ctx);
      if (!c) continue;
      for (const inp of c.inputs()) {
        const base = [inp.getAttribute('aria-describedby'), ...c.describe].filter(Boolean).join(' ');
        inp.dataset.lmDesc = base;
        if (base) inp.setAttribute('aria-describedby', base);
      }
      byId.set(q.id, c);
      ctrls.push(c);
      section.append(c.wrap);
    }
    body.append(section);
    const btn = h('button', { type: 'button', class: 'lm-stepbtn', 'data-step': si },
      h('span', { class: 'lm-stepbar', 'aria-hidden': 'true' }),
      h('span', { class: 'sr-only', text: `Step ${si + 1} of ${sections.length}: ${sec.title || ''}` }));
    btn.title = sec.title || '';
    stepList.append(h('li', null, btn));
    return { sec, section, heading, summary, ctrls, btn };
  });

  root.append(shell);

  // --- errors
  function setError(c, msg) {
    c.err.textContent = msg || '';
    c.err.hidden = !msg;
    const targets = c.inputs();
    for (const inp of targets) {
      const base = inp.dataset.lmDesc || '';
      if (msg) {
        inp.setAttribute('aria-invalid', 'true');
        inp.setAttribute('aria-describedby', `${base} ${c.errId}`.trim());
      } else {
        inp.removeAttribute('aria-invalid');
        if (base) inp.setAttribute('aria-describedby', base); else inp.removeAttribute('aria-describedby');
      }
    }
    if (c.wrap.tagName === 'FIELDSET') {
      if (msg) c.wrap.setAttribute('aria-describedby', c.errId); else c.wrap.removeAttribute('aria-describedby');
    }
    c.wrap.classList.toggle('lm-invalid', !!msg);
  }

  function renderSummary(step, bad) {
    step.summary.replaceChildren();
    if (!bad.length) { step.summary.hidden = true; return; }
    const list = h('ul', { class: 'lm-errsum-list' });
    for (const [c, msg] of bad) {
      const a = h('a', { href: `#${c.wrap.id}`, class: 'lm-errsum-link' });
      a.textContent = c.q.prompt ? `${c.q.prompt.replace(/\s*\(optional\)\s*/i, ' ').trim()} — ${msg}` : msg;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const t = c.focusTarget();
        if (t) {
          t.focus({ preventScroll: true });
          c.wrap.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
        }
      });
      a.dataset.qid = c.q.id;
      list.append(h('li', null, a));
    }
    step.summary.append(
      h('p', { class: 'lm-errsum-title', text: bad.length === 1 ? 'One answer needs a look:' : `${bad.length} answers need a look:` }),
      list);
    step.summary.hidden = false;
  }

  function validateStep(si, show) {
    const step = steps[si];
    const bad = [];
    for (const c of step.ctrls) {
      const msg = c.validate();
      if (show) setError(c, msg);
      if (msg) bad.push([c, msg]);
    }
    if (show) renderSummary(step, bad);
    return bad.length === 0;
  }

  // After an answer changes, clear its error as soon as it is fixed.
  function recheck(c) {
    if (!c || c.err.hidden) return;
    const msg = c.validate();
    if (msg) { if (msg !== c.err.textContent) setError(c, msg); return; }
    setError(c, null);
    const step = steps.find((s) => s.ctrls.includes(c));
    if (!step) return;
    const link = step.summary.querySelector(`a[data-qid="${CSS.escape(c.q.id)}"]`);
    if (link) link.parentElement.remove();
    const left = step.summary.querySelectorAll('li').length;
    if (!left) { step.summary.hidden = true; step.summary.replaceChildren(); } else {
      const t = step.summary.querySelector('.lm-errsum-title');
      if (t) t.textContent = left === 1 ? 'One answer needs a look:' : `${left} answers need a look:`;
    }
  }

  function clearErrors() {
    for (const s of steps) {
      for (const c of s.ctrls) setError(c, null);
      s.summary.hidden = true;
      s.summary.replaceChildren();
    }
  }

  // --- navigation
  function render() {
    const n = steps.length;
    steps.forEach((s, i) => {
      s.section.hidden = i !== current;
      s.btn.disabled = i > maxVisited;
      if (i === current) s.btn.setAttribute('aria-current', 'step'); else s.btn.removeAttribute('aria-current');
      s.btn.classList.toggle('lm-done', i < current || (i <= maxVisited && i !== current));
    });
    progress.textContent = `${pad2(current + 1)} / ${pad2(n)} · ${steps[current].sec.title || ''}`;
    backBtn.hidden = current === 0;
    const last = current === n - 1;
    nextBtn.textContent = last ? 'See my matches' : 'Next';
    nextBtn.classList.toggle('teal', !last);
    nextBtn.classList.toggle('pink', last);
  }

  function show(i, focus) {
    current = Math.max(0, Math.min(steps.length - 1, i));
    maxVisited = Math.max(maxVisited, current);
    render();
    if (focus) {
      try { shell.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' }); } catch (e) { /* ignore */ }
      steps[current].heading.focus({ preventScroll: true });
    }
  }

  function next() {
    if (!validateStep(current, true)) {
      steps[current].summary.focus();
      return;
    }
    if (current < steps.length - 1) { show(current + 1, true); return; }
    // Last step: every step must be complete before submitting.
    for (let i = 0; i < steps.length; i++) {
      if (!validateStep(i, true)) {
        show(i, true);
        steps[i].summary.focus();
        return;
      }
    }
    clearTimeout(timer);
    const answers = getAnswers();
    if (typeof onChange === 'function') { try { onChange(answers); } catch (e) { console.warn(e); } }
    if (typeof onSubmit === 'function') onSubmit(getAnswers());
  }

  function getAnswers() {
    const out = {};
    for (const s of steps) {
      for (const c of s.ctrls) {
        const v = c.get();
        if (v !== undefined) out[c.q.id] = v;
      }
    }
    return out;
  }

  function setAnswers(a) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return;
    for (const [qid, c] of byId) {
      if (hasOwn(a, qid)) {
        try { c.set(a[qid]); } catch (e) { console.warn('[lab match] could not restore', qid, e); }
        recheck(c);
      }
    }
  }

  function schedule() {
    if (destroyed || typeof onChange !== 'function') return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (destroyed) return;
      try { onChange(getAnswers()); } catch (e) { console.warn('[lab match] onChange failed:', e); }
    }, 300);
  }

  // --- events
  const onInput = (e) => {
    const wrap = e.target instanceof Element ? e.target.closest('.lm-q') : null;
    if (wrap && byId.has(wrap.dataset.qid)) recheck(byId.get(wrap.dataset.qid));
    if (e.target instanceof Element && e.target.closest('.lm-tr-pick, .lm-tr-review')) return;  // transcript drafts are not answers
    schedule();
  };
  const onKey = (e) => {
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (t instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'file'].includes(t.type)) e.preventDefault();
  };
  const onStep = (e) => {
    const b = e.target instanceof Element ? e.target.closest('.lm-stepbtn') : null;
    if (!b || b.disabled) return;
    const i = Number(b.dataset.step);
    if (i === current) return;
    if (i > current && !validateStep(current, true)) { steps[current].summary.focus(); return; }
    show(i, true);
  };
  const onBack = () => { if (current > 0) show(current - 1, true); };
  shell.addEventListener('input', onInput);
  shell.addEventListener('change', onInput);
  shell.addEventListener('keydown', onKey);
  stepList.addEventListener('click', onStep);
  backBtn.addEventListener('click', onBack);
  nextBtn.addEventListener('click', next);

  setAnswers(initialAnswers);
  clearErrors();
  show(0, false);

  return {
    getAnswers,
    setAnswers,
    goTo(i) {
      const k = Number(i);
      if (!Number.isInteger(k)) return;
      const t = Math.max(0, Math.min(steps.length - 1, k));
      maxVisited = Math.max(maxVisited, t);
      show(t, true);
    },
    stepCount: steps.length,
    reset() {
      clearTimeout(timer);
      for (const c of byId.values()) c.clear();
      clearErrors();
      maxVisited = 0;
      show(0, false);
    },
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      shell.removeEventListener('input', onInput);
      shell.removeEventListener('change', onInput);
      shell.removeEventListener('keydown', onKey);
      stepList.removeEventListener('click', onStep);
      backBtn.removeEventListener('click', onBack);
      nextBtn.removeEventListener('click', next);
      shell.remove();
      byId.clear();
    },
  };
}
