// Renders workshop.html from js/workshop-data.js.
// Self-contained on purpose: this page shares no code or data with the rest of
// the site, so nothing else on the site references it.
//
// Imported as a namespace and read with fallbacks, so deleting a whole block
// from workshop-data.js just drops that section from the page instead of
// throwing and leaving it blank.
import * as D from './workshop-data.js';

const META = D.META || {};
const ORGS = D.ORGS || [];
const TAGS = D.TAGS || [];
const MATERIALS = D.MATERIALS || [];
const OPPORTUNITIES = D.OPPORTUNITIES || [];
const SUMMER_PROGRAMS = D.SUMMER_PROGRAMS || [];
const CS_INTERNSHIPS = D.CS_INTERNSHIPS || [];
const BSA_PROGRAMS = D.BSA_PROGRAMS || [];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const show = (el, on) => { if (el) el.hidden = !on; };

const byOrg = Object.fromEntries(ORGS.map(o => [o.key, o]));
const org = (key) => byOrg[key] || { name: key, short: key, accent: 'teal', blurb: '', url: '' };
const tagLabel = Object.fromEntries(TAGS.map(t => [t.key, t.label]));

// Only listings are filterable. Programs default to CNS, since the comp-neuro
// list is CompNeuroSociety's; every other list carries its own org key, and an
// entry keeps that key wherever it is printed.
const LISTINGS = [...OPPORTUNITIES, ...SUMMER_PROGRAMS, ...CS_INTERNSHIPS, ...BSA_PROGRAMS];
const orgOf = (x) => x.org || 'cns';
const hits = (o, t) => LISTINGS.filter(x =>
  (o === 'all' || orgOf(x) === o) &&
  (t === 'all' || (x.tags || []).includes(t))).length;

// Space-padded so `data-tags` can be matched without a false hit on a tag key
// that is a substring of another ("ml" inside "umbrella").
const tagAttr = (tags) => ' ' + (tags || []).join(' ') + ' ';
const tagPills = (tags) => (tags || [])
  .map(t => `<span class="ws-pill" data-tag-pill="${esc(t)}">${esc(tagLabel[t] || t)}</span>`).join('');

// A deadline is either a real date, free text ("not yet announced"), or absent.
const due = (v) => {
  if (!v) return { kind: 'none' };
  const d = new Date(v + 'T23:59');
  return isNaN(d) ? { kind: 'text', text: v } : { kind: 'date', d };
};
const withDue = (x) => {
  const u = due(x.deadline);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return { ...x, due: u,
    closed: u.kind === 'date' && u.d < today,
    days: u.kind === 'date' ? Math.ceil((u.d - today) / 864e5) : null };
};
// Dated first (soonest first), then everything without a date.
const byDeadline = (a, b) => (a.closed - b.closed) ||
  ((a.due.kind === 'date' ? a.due.d.getTime() : 8.64e15) -
   (b.due.kind === 'date' ? b.due.d.getTime() : 8.64e15));
const dateStr = (d) => MONTHS[d.getMonth()] + ' ' + String(d.getDate()).padStart(2, '0') + ' ' + d.getFullYear();

// --- Header ---
if ($('ws-kicker')) $('ws-kicker').textContent = '// ' + (META.kicker || 'workshop');
if ($('ws-title')) $('ws-title').innerHTML = esc(META.title || 'Workshop').replace(/(\S+)\s*$/, '<span class="grad">$1</span>');
if ($('ws-blurb')) $('ws-blurb').textContent = META.blurb || '';
if ($('ws-meta')) {
  const d = new Date(META.date);
  const when = isNaN(d) ? '' :
    MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' - ' +
    (((d.getHours() + 11) % 12) + 1) + ':' + String(d.getMinutes()).padStart(2, '0') +
    (d.getHours() >= 12 ? 'pm' : 'am');
  $('ws-meta').innerHTML = [when, META.location].filter(Boolean)
    .map(s => `<span class="chan">${esc(s)}</span>`).join('');
}
if ($('ws-footnote')) $('ws-footnote').textContent = META.footNote || '';

// --- Registration CTA: one button in the hero, one in the closing band. The
// --- whole thing drops out if META.register is missing or has no url. ---
const reg = META.register || {};
if (reg.url) {
  const label = esc(reg.label || 'Register');
  const btn = (cls) => `<a class="${cls}" href="${esc(reg.url)}" target="_blank" rel="noopener">${label}</a>`;
  if ($('ws-register')) {
    $('ws-register').innerHTML = btn('btn') +
      (reg.note ? `<p class="mono" style="font-size:12px;color:var(--muted);margin:10px 0 0">${esc(reg.note)}</p>` : '');
  }
  if ($('ws-register-foot')) $('ws-register-foot').innerHTML = btn('btn teal');
} else {
  show($('ws-register'), false);
  show($('ws-register-foot'), false);
}

// --- Co-hosting orgs ---
if ($('ws-orgs')) {
  $('ws-orgs').innerHTML = ORGS.map(o => `
    <div class="ws-org ws-${esc(o.accent)}">
      <div class="ws-org-name">${esc(o.name)}</div>
      <p>${esc(o.blurb)}</p>
      ${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.linkLabel || o.short + ' site')}</a>` : ''}
    </div>`).join('');
}

// --- Materials: the workshop's own, unattributed and unfiltered. The whole
// --- section drops out when there are none. ---
show($('materials-section'), MATERIALS.length > 0);
if ($('ws-materials') && MATERIALS.length) {
  $('ws-materials').innerHTML = MATERIALS.map(m => {
    const link = m.url
      ? `<a class="ws-open" href="${esc(m.url)}" target="_blank" rel="noopener">Open</a>`
      : `<span class="ws-soon">link coming soon</span>`;
    return `<div class="ws-card">
      <div class="ws-card-top"><span class="tag dim">${esc(m.type)}</span></div>
      <h3>${esc(m.title)}</h3>
      <p>${esc(m.note)}</p>
      ${link}
    </div>`;
  }).join('');
}

// --- Filters: org, then tags grouped into rows. All combine with AND. ---
let activeOrg = 'all';
let activeTag = 'all';

if ($('ws-filters')) {
  $('ws-filters').innerHTML =
    `<button class="ws-chip active" data-org="all">all orgs</button>` +
    ORGS.map(o => `<button class="ws-chip ws-${esc(o.accent)}" data-org="${esc(o.key)}" data-label="${esc(o.short)}"></button>`).join('');
}

// Only offer tags something actually carries, so no chip starts out empty.
const tagCounts = {};
LISTINGS.forEach(x => (x.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
const chipHTML = (t) => `<button class="ws-chip ws-tag" data-tag="${esc(t.key)}" data-label="${esc(t.label)}"></button>`;
const liveTags = (group) => TAGS.filter(t => tagCounts[t.key] && (!group || (t.group || 'fit') === group));

if ($('ws-tagfilters')) {
  $('ws-tagfilters').innerHTML =
    `<button class="ws-chip ws-tag active" data-tag="all">all tags</button>` +
    liveTags('field').map(chipHTML).join('');
}
if ($('ws-fitfilters')) {
  $('ws-fitfilters').innerHTML = liveTags('fit').map(chipHTML).join('');
}

function selectTag(value) {
  [$('ws-tagfilters'), $('ws-fitfilters')].forEach(bar => {
    if (bar) bar.querySelectorAll('.ws-chip').forEach(b => b.classList.toggle('active', b.dataset.tag === value));
  });
}

document.addEventListener('click', (e) => {
  const chip = e.target.closest('.ws-chip');
  if (chip) {
    if (chip.dataset.org !== undefined) {
      activeOrg = chip.dataset.org;
      $('ws-filters').querySelectorAll('.ws-chip').forEach(b => b.classList.toggle('active', b === chip));
    } else if (chip.dataset.tag !== undefined) {
      activeTag = chip.dataset.tag;
      selectTag(activeTag);
    }
    apply();
    return;
  }
  // A tag pill on a card is also a filter - click it to narrow to that tag.
  const pill = e.target.closest('[data-tag-pill]');
  if (pill) {
    activeTag = activeTag === pill.dataset.tagPill ? 'all' : pill.dataset.tagPill;
    selectTag(activeTag);
    apply();
    if ($('filters')) $('filters').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

function apply() {
  document.querySelectorAll('[data-row]').forEach(el => {
    const okOrg = activeOrg === 'all' || el.dataset.org === activeOrg;
    const okTag = activeTag === 'all' || (el.dataset.tags || '').includes(' ' + activeTag + ' ');
    el.hidden = !(okOrg && okTag);
  });
  // A section hides whenever nothing inside it survived the filters. That
  // already covers the org filter, because a row only survives when its own
  // org matches - which is what lets a section carry a listing from another
  // org (ACM's research programs sit on the comp-neuro list) without that
  // listing disappearing when you filter to the org that owns it.
  document.querySelectorAll('[data-section-org]').forEach(el => {
    const anyRow = [...el.querySelectorAll('[data-row]')].some(r => !r.hidden);
    el.hidden = !anyRow;
  });
  document.querySelectorAll('[data-tag-pill]').forEach(p => {
    p.classList.toggle('on', p.dataset.tagPill === activeTag);
  });
  // Stripe each program list over its visible rows, so hidden ones don't
  // leave two same-colored programs next to each other.
  ['ws-programs', 'ws-cs-programs', 'ws-bsa-programs'].forEach(id => {
    let i = 0;
    $(id)?.querySelectorAll('.ws-prog').forEach(el => {
      if (!el.hidden) el.classList.toggle('alt', i++ % 2 === 1);
    });
  });
  // Empty states sit directly after the list they describe.
  document.querySelectorAll('[data-empty]').forEach(el => {
    const list = el.previousElementSibling;
    el.hidden = !list || [...list.children].some(c => !c.hidden);
  });
  // Each chip row counts against the OTHER filter, so a chip always says what
  // you would actually get - and a combination with nothing behind it goes
  // dead rather than leading to an empty page.
  const recount = (bar, attr, count) => {
    if (!bar) return;
    bar.querySelectorAll('.ws-chip').forEach(b => {
      const key = b.dataset[attr];
      if (key === 'all' || !b.dataset.label) return;
      const n = count(key);
      b.textContent = b.dataset.label + ' (' + n + ')';
      const dead = n === 0 && !b.classList.contains('active');
      b.classList.toggle('dead', dead);
      b.disabled = dead;
    });
  };
  recount($('ws-filters'), 'org', (k) => hits(k, activeTag));
  recount($('ws-tagfilters'), 'tag', (k) => hits(activeOrg, k));
  recount($('ws-fitfilters'), 'tag', (k) => hits(activeOrg, k));

  if ($('ws-count')) {
    const shown = [...document.querySelectorAll('[data-row]')].filter(el => !el.hidden).length;
    $('ws-count').textContent = shown === LISTINGS.length
      ? `showing all ${shown} listings`
      : `showing ${shown} of ${LISTINGS.length} listings`;
  }
}

// --- Opportunities the orgs share with each other's members ---
show($('opps-section'), OPPORTUNITIES.length > 0);
if ($('ws-opps')) {
  $('ws-opps').innerHTML = OPPORTUNITIES.map(withDue).sort(byDeadline).map(op => {
    const o = org(op.org);
    const when = op.closed ? `<span class="tag dim">CLOSED</span>`
      : op.due.kind === 'date' ? `<span class="tag teal">${op.days} day${op.days === 1 ? '' : 's'} left</span>`
      : op.due.kind === 'text' ? `<span class="tag dim">${esc(op.due.text)}</span>`
      : `<span class="tag teal">ROLLING</span>`;
    const cta = op.url && !op.closed
      ? `<a class="ws-open" href="${esc(op.url)}" target="_blank" rel="noopener">${esc(op.cta || 'Details')}</a>`
      : op.closed ? '' : `<span class="ws-soon">details at the table</span>`;
    return `<div class="ws-opp ws-${esc(o.accent)}${op.closed ? ' is-closed' : ''}"
      data-row data-org="${esc(op.org)}" data-tags="${esc(tagAttr(op.tags))}">
      <div class="ws-opp-main">
        <div class="ws-card-top"><span class="ws-by">${esc(o.short)}</span><span class="tag purple">${esc(op.kind)}</span>${when}</div>
        <h3>${esc(op.title)}</h3>
        <p>${esc(op.blurb)}</p>
        <div class="ws-pills">${tagPills(op.tags)}</div>
      </div>
      <div class="ws-opp-side">${cta}</div>
    </div>`;
  }).join('');
}

// --- Program lists (comp neuro + CS share one renderer) ---
function renderPrograms(el, items, defaultOrg) {
  if (!el) return;
  el.innerHTML = items.map(withDue).sort(byDeadline).map(p => {
    const when = p.closed ? `<span class="tag dim">CLOSED</span>`
      : p.due.kind === 'date' ? `<span class="tag teal">${p.estimated ? 'est. ' : ''}${dateStr(p.due.d)}</span>`
      : p.due.kind === 'text' ? `<span class="tag dim">${esc(p.due.text)}</span>`
      : `<span class="tag dim">${esc(p.when || 'no fixed date')}</span>`;
    const soon = !p.closed && p.days !== null && p.days <= 60
      ? `<span class="tag gold">${p.days}d left</span>` : '';
    return `<div class="ws-prog${p.closed ? ' is-closed' : ''}"
      data-row data-org="${esc(p.org || defaultOrg)}" data-tags="${esc(tagAttr(p.tags))}">
      <div class="ws-prog-head">${when}${soon}<span class="ws-host">${esc(p.host)}</span></div>
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.focus)}</p>
      <div class="ws-prog-foot">
        <span class="ws-elig">${esc(p.eligibility)}</span>
        ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">Program page</a>` : ''}
      </div>
      <div class="ws-pills">${tagPills(p.tags)}</div>
    </div>`;
  }).join('');
}

function renderResources(el, items) {
  if (!el) return;
  el.innerHTML = (items || []).map(r => `
    <div class="ws-res">
      <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)}</a>
      <p>${esc(r.note)}</p>
    </div>`).join('');
}

renderPrograms($('ws-programs'), SUMMER_PROGRAMS, 'cns');
renderResources($('ws-resources'), D.PROGRAM_RESOURCES);
if ($('ws-prognote')) $('ws-prognote').textContent = D.PROGRAM_NOTE || '';

// --- Application-help form for the comp-neuro / NeuroAI / comp-psychiatry
// --- programs. Drops out if PROGRAM_HELP is missing or has no url. ---
const help = D.PROGRAM_HELP || {};
if ($('ws-proghelp')) {
  if (help.url) {
    $('ws-proghelp').innerHTML = `
      <div>
        <div class="mono" style="font-size:11px;color:var(--teal);margin-bottom:6px">// need a second pair of eyes?</div>
        <p>${esc(help.blurb || '')}</p>
      </div>
      <a class="ws-open" href="${esc(help.url)}" target="_blank" rel="noopener">${esc(help.label || 'Request application help')}</a>`;
  }
  show($('ws-proghelp'), !!help.url);
}

renderPrograms($('ws-cs-programs'), CS_INTERNSHIPS, 'acm');
renderResources($('ws-cs-resources'), D.CS_RESOURCES);
if ($('ws-csnote')) $('ws-csnote').textContent = D.CS_NOTE || '';

renderPrograms($('ws-bsa-programs'), BSA_PROGRAMS, 'bsa');
renderResources($('ws-bsa-resources'), D.BSA_RESOURCES);
if ($('ws-bsanote')) $('ws-bsanote').textContent = D.BSA_NOTE || '';

apply();
