// Renders all data-driven sections from js/site-data.js into the pages.
// Pages opt in by including elements with the ids used below; the "Next up"
// strip (#next-up) and the neuron gutter (#neuron-gutter) are on every page.
import * as D from './site-data.js';
import { CALENDAR_EVENTS } from './calendar-events.js';

const $ = (id) => document.getElementById(id);
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SITE = 'https://compneurosociety.com/';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const attr = (s) => esc(s).replace(/'/g, '&#39;');
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'event';

// --- Merge hard-coded EVENTS with the auto-synced CALENDAR_EVENTS ---
// A calendar entry is dropped if a hard-coded event on the same day shares
// most of its title words (titles differ slightly between the two sources),
// so hand-curated blurbs/images always win.
const titleWords = (t) => new Set(String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(Boolean));
function sameEvent(a, b) {
  if (String(a.date).slice(0, 10) !== String(b.date).slice(0, 10)) return false;
  const wa = titleWords(a.title), wb = titleWords(b.title);
  let shared = 0;
  wa.forEach(w => { if (wb.has(w)) shared++; });
  // Require >=2 shared words when both titles have >=2 (one generic word like
  // "python" shouldn't merge two different events on the same day).
  const min = Math.min(wa.size, wb.size);
  return shared >= Math.max(min >= 2 ? 2 : 1, Math.ceil(min / 2));
}
const ALL_EVENTS = [
  ...D.EVENTS,
  ...(CALENDAR_EVENTS || []).filter(c => !D.EVENTS.some(h => sameEvent(h, c))),
];

// --- Event kind (for the Events page filters). An explicit `kind` on the
// event wins; otherwise it is inferred from the title.
const KINDS = [
  ['journal',  /journal/i],
  ['gbm',      /\bgbm|general body|involvement fair|kick-?off|presentations/i],
  ['speaker',  /conversation|speaker|guest|\btalk\b|\bceo\b|founder|panel|fireside/i],
  ['workshop', /workshop|python|basics|intro to|ml\/ai|github|vs code|coding|tutorial/i],
  ['project',  /project|meeting/i],
  ['social',   /social|fundraiser/i],
];
const kindOf = (ev) => ev.kind || (KINDS.find(([, re]) => re.test(String(ev.title || ''))) || ['other'])[0];

// --- Location clean-up. The calendar sync puts the street address in
// `location` and the room in `blurb` ("A204"), so: keep the first segment of a
// comma-separated address and append the room when the blurb is just a room code.
const ROOM_RE = /^(?:[A-Z]{2,4}\s?\d{3,4}[A-Z]?|[A-Z]\d{3}[A-Z]?|room\s+\S+)$/i;
const isRoom = (s) => ROOM_RE.test(String(s || '').trim());
function placeOf(ev) {
  let loc = String(ev.location || '').trim();
  if (loc.includes(',')) loc = loc.split(',')[0].trim();
  const room = isRoom(ev.blurb) ? String(ev.blurb).trim() : '';
  if (room && !loc.toLowerCase().includes(room.toLowerCase())) loc = loc ? `${loc} \u00B7 ${room}` : room;
  return loc || 'Location TBA';
}

function fmt(ev) {
  const dt = new Date(ev.date);
  const now = Date.now();
  const future = dt.getTime() > now;
  const diff = Math.abs(dt.getTime() - now);
  const days = Math.floor(diff / 864e5), hours = Math.floor((diff % 864e5) / 36e5);
  const h12 = ((dt.getHours() + 11) % 12) + 1, mins = String(dt.getMinutes()).padStart(2, '0');
  const sameDay = new Date(now).toDateString() === dt.toDateString();
  return { ...ev, dt, future,
    kind: kindOf(ev),
    place: placeOf(ev),
    desc: isRoom(ev.blurb) ? '' : String(ev.blurb || '').trim(),
    image: ev.image || 'images/placeholder.jpg',
    dateShort: MON[dt.getMonth()] + ' ' + String(dt.getDate()).padStart(2, '0'),   // Oct 09
    dow: DOW[dt.getDay()],                                                         // Thu
    year: dt.getFullYear(),
    time: h12 + ':' + mins + (dt.getHours() >= 12 ? 'pm' : 'am'),
    countdown: sameDay ? 'TODAY' : days < 1 ? 'T\u2212' + hours + 'H' : 'T\u2212' + days + 'D',
    tag: ev.example ? 'EXAMPLE' : (future ? 'UPCOMING' : 'PAST') };
}

const dated = ALL_EVENTS.filter(e => !isNaN(new Date(e.date))).map(fmt);
const upcoming = dated.filter(e => e.future).sort((a, b) => a.dt - b.dt);
const past = dated.filter(e => !e.future).sort((a, b) => b.dt - a.dt);
const next = upcoming[0];

// --- Add to calendar: a downloadable .ics built from date/title/location.
// Works with Google Calendar, Outlook and Apple Calendar (no account needed).
function ics(e) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
  const text = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const fold = (line) => { const out = []; for (let i = 0; i < line.length; i += 70) out.push((i ? ' ' : '') + line.slice(i, i + 70)); return out.join('\r\n'); };
  const end = new Date(e.dt.getTime() + (Number(e.durationMinutes) || 60) * 60000);
  const desc = [e.desc, 'Details: ' + SITE + 'events.html'].filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CompNeuroSociety//compneurosociety.com//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + stamp(e.dt) + '-' + slug(e.title) + '@compneurosociety.com',
    'DTSTAMP:' + stamp(new Date()),
    'DTSTART:' + stamp(e.dt),
    'DTEND:' + stamp(end),
    'SUMMARY:' + text(e.title),
    'LOCATION:' + text(e.place),
    'DESCRIPTION:' + text(desc),
    'URL:' + SITE + 'events.html',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.map(fold).join('\r\n') + '\r\n');
}
const calLink = (e, cls, label = '+ add to calendar') =>
  `<a class="${cls}" href="${ics(e)}" download="${slug(e.title)}.ics" title="Download an .ics file (Google, Outlook or Apple Calendar)">${label}</a>`;
const remindLink = (cls, label = 'remind me on discord \u2192') =>
  `<a class="${cls}" href="${attr(D.LINKS.discord)}" target="_blank" rel="noopener">${label}</a>`;

// --- "Next up" strip (every page) ---
if ($('next-up')) {
  $('next-up').innerHTML = next
    ? `<span class="strip-label">NEXT UP</span>
       <span class="strip-date">${next.dow} ${next.dateShort} \u00B7 ${next.time}</span>
       <span class="strip-title"><b>${esc(next.title)}</b> <span class="loc">\u00B7 ${esc(next.place)}</span></span>
       <span class="strip-spacer"></span>
       ${calLink(next, 'strip-link')}
       ${remindLink('strip-link teal')}
       <a class="strip-go" href="events.html" aria-label="Event details">\u2192</a>`
    : `<span class="strip-label">NEXT UP</span>
       <span class="strip-note">nothing on the calendar yet \u2014 new dates are announced first on Discord</span>
       <span class="strip-spacer"></span>
       <a class="strip-link" href="events.html">past events \u2192</a>
       ${remindLink('strip-link teal', 'join the discord \u2192')}
       <a class="strip-go" href="events.html" aria-label="Events">\u2192</a>`;
}

// --- Home ---
if ($('hero-next')) {
  const a = $('hero-next');
  if (next) a.textContent = 'next event \u2192 ' + next.dateShort.toLowerCase();
  else { a.textContent = 'browse past events \u2192'; }
}
if ($('home-events')) {
  const rows = [];
  if (upcoming[0]) {
    const e = upcoming[0];
    rows.push(`<div class="ev-row next">
      <div><div class="ev-date">${e.dateShort}</div><div class="ev-meta">${e.dow.toLowerCase()} \u00B7 ${e.time} \u00B7 ${esc(e.place)}</div><div class="ev-tag">UP NEXT \u00B7 ${e.countdown}</div></div>
      <div><h3 class="ev-title">${esc(e.title)}</h3>${e.desc ? `<p class="ev-blurb">${esc(e.desc)}</p>` : ''}</div>
      <div class="ev-side">${calLink(e, 'pill teal sm')}<a class="mono-link sm" href="events.html">details \u2192</a></div>
    </div>`);
  }
  if (upcoming[1]) {
    const e = upcoming[1];
    rows.push(`<div class="ev-row">
      <div><div class="ev-date">${e.dateShort}</div><div class="ev-meta">${e.dow.toLowerCase()} \u00B7 ${e.time} \u00B7 ${esc(e.place)}</div></div>
      <div><h3 class="ev-title">${esc(e.title)}</h3>${e.desc ? `<p class="ev-blurb">${esc(e.desc)}</p>` : ''}</div>
      <div class="ev-side"><a class="mono-link sm" href="events.html">details \u2192</a></div>
    </div>`);
  }
  if (!upcoming.length) {
<<<<<<< HEAD
    rows.push(`<div class="ev-empty">no upcoming events are posted yet, but updates go out first on
      <a href="${attr(D.LINKS.discord)}" target="_blank" rel="noopener">Discord</a>.</div>`);
=======
    cards.push(`<div class="event-card" style="grid-column:span 2;border-style:dashed;display:flex;align-items:center;justify-content:center;text-align:center">
      <span class="mono" style="font-size:12.5px;color:var(--faint);line-height:1.8">no upcoming events are posted yet,<br>but updates go out on <a href="${D.LINKS.discord}" target="_blank">Discord</a></span></div>`);
<<<<<<< HEAD
>>>>>>> 52bd95d (rewrite)
=======
>>>>>>> 99e21a6 (rewrite)
  }
  if (past[0]) {
    const e = past[0];
    rows.push(`<div class="ev-row past end">
      <div><div class="ev-date">${e.dateShort}</div><div class="ev-meta">past \u00B7 recap</div></div>
      <div class="ev-past-body"><img class="ev-thumb" src="${attr(e.image)}" alt="" loading="lazy" decoding="async">
        <div><h3 class="ev-title">${esc(e.title)}</h3><p class="ev-blurb">${esc(e.place)}</p></div></div>
      <div class="ev-side"><a class="mono-link sm" href="${attr(D.LINKS.instagram)}" target="_blank" rel="noopener">photos \u2192</a></div>
    </div>`);
  }
  $('home-events').innerHTML = rows.join('');
}
if ($('home-project')) {
  const P = D.CURRENT_PROJECT;
  const img = (P && P.image) || (D.PAST_PROJECTS && D.PAST_PROJECTS[0] && D.PAST_PROJECTS[0].image) || 'images/placeholder.jpg';
  $('home-project').innerHTML = P
    ? `<img class="feature-img" src="${attr(img)}" alt="" loading="lazy" decoding="async">
       <div class="feature"><div class="eyebrow">${esc(P.term).toUpperCase()} \u00B7 ACTIVE</div>
         <h3>${esc(P.name)}</h3><p>${esc(P.summary)}</p>
         <div class="cta-row">${P.hubUrl ? `<a class="pill md" href="${attr(P.hubUrl)}">Open the project hub</a>` : `<a class="pill md" href="projects.html">About this project</a>`}<a class="mono-link sm" href="projects.html">all projects \u2192</a></div></div>`
    : `<img class="feature-img" src="${attr(img)}" alt="" loading="lazy" decoding="async">
       <div class="feature"><div class="eyebrow dim">BETWEEN PROJECT CYCLES</div>
         <h3>Next project team forming soon</h3><p>We are between project cycles right now. Have a look at the past teams, or apply and we will contact you when the next team starts.</p>
         <div class="cta-row"><a class="pill md" href="projects.html">See past projects</a>${D.APPLICATIONS && D.APPLICATIONS.open ? `<a class="mono-link sm" href="${attr(D.APPLICATIONS.formUrl)}" target="_blank" rel="noopener">apply for the next team \u2192</a>` : ''}</div></div>`;
}
const avatarStack = (people) => people.filter(p => p && p.photo).slice(0, 4)
  .map(p => `<img src="${attr(p.photo)}" alt="${attr(p.name)}" loading="lazy" decoding="async" width="60" height="60">`).join('');
if ($('home-avatars')) $('home-avatars').innerHTML = avatarStack([...(D.LEADERSHIP || []).slice(0, 3), ...(D.MENTORS || []).slice(0, 1)]);
if ($('about-avatars')) $('about-avatars').innerHTML = avatarStack([...(D.LEADERSHIP || []).slice(0, 3), ...(D.MENTORS || []).slice(0, 1)]);

// --- Events page: spotlight + filters + timeline ---
if ($('event-spotlight')) {
  const e = next;
  $('event-spotlight').innerHTML = e
    ? `<div class="card glow spot">
        <div><div class="ev-tag" style="margin:0 0 14px">UP NEXT \u00B7 ${e.countdown}</div><div class="ev-date">${e.dateShort}</div>
          <div class="ev-meta">${e.dow.toLowerCase()} \u00B7 ${e.time} \u00B7 ${esc(e.place)}</div></div>
        <div><h3 class="ev-title">${esc(e.title)}</h3>${e.desc ? `<p class="ev-blurb">${esc(e.desc)}</p>` : ''}</div>
        <div class="ev-side">${calLink(e, 'pill teal sm')}${remindLink('mono-link sm teal')}</div></div>`
    : `<div class="card dashed"><div class="label" style="margin-bottom:10px">// up next</div>
        <h3>Nothing is on the calendar yet.</h3><p>New dates are announced first on ${remindLink('', 'Discord')}, and the Google Calendar above updates as soon as something is scheduled.</p></div>`;
}
if ($('event-timeline')) {
  const SHOW_PAST = 8;
  const row = (e) => `
    <div class="ev-row ${e.future ? (e === next ? 'next' : '') : 'past'}" data-kind="${e.kind}" data-past="${e.future ? 0 : 1}">
      <div><div class="ev-date">${e.dateShort}</div>
        <div class="ev-meta">${e.dow.toLowerCase()} \u00B7 ${e.year} \u00B7 ${e.time}${e.future ? ' \u00B7 ' + esc(e.place) : ''}</div>
        ${e.future ? `<div class="ev-tag">${e === next ? 'UP NEXT \u00B7 ' + e.countdown : 'UPCOMING'}</div>` : (e.example ? '<div class="ev-tag dim">EXAMPLE</div>' : '')}</div>
      ${e.future
        ? `<div><h3 class="ev-title">${esc(e.title)}</h3>${e.desc ? `<p class="ev-blurb">${esc(e.desc)}</p>` : ''}</div>
           <div class="ev-side">${e === next ? calLink(e, 'pill teal sm') : calLink(e, 'mono-link sm')}</div>`
        : `<div class="ev-past-body"><img class="ev-thumb" src="${attr(e.image)}" alt="" loading="lazy" decoding="async">
             <div><h3 class="ev-title">${esc(e.title)}</h3><p class="ev-blurb">${esc(e.place)}${e.desc ? ' \u00B7 ' + esc(e.desc) : ''}</p></div></div>
           <div class="ev-side"><span class="ev-tag dim" style="margin:0">PAST</span></div>`}
    </div>`;
  const tl = $('event-timeline');
  tl.innerHTML = [...upcoming, ...past].map(row).join('')
    + `<div class="ev-empty" id="tl-empty" hidden>nothing in this category yet.</div>`
    + `<div style="display:flex;justify-content:center;padding:28px 0 0"><button class="fchip" type="button" id="tl-more" hidden></button></div>`;
  const rows = Array.from(tl.querySelectorAll('.ev-row'));
  const more = $('tl-more'), empty = $('tl-empty');
  let filter = 'all', expanded = false;

  function applyFilter() {
    let shown = 0, pastShown = 0, hiddenOlder = 0;
    rows.forEach(r => {
      const isPast = r.dataset.past === '1', kind = r.dataset.kind;
      let ok = filter === 'all' ? true : filter === 'past' ? isPast : kind === filter;
      if (ok && isPast) { pastShown++; if (!expanded && pastShown > SHOW_PAST) { ok = false; hiddenOlder++; } }
      r.hidden = !ok;
      if (ok) shown++;
    });
    // the last visible row carries the closing rule
    rows.forEach(r => r.classList.remove('end'));
    const vis = rows.filter(r => !r.hidden); if (vis.length) vis[vis.length - 1].classList.add('end');
    empty.hidden = shown > 0;
    more.hidden = !(hiddenOlder > 0 || (expanded && pastShown > SHOW_PAST));
    more.textContent = expanded ? 'show fewer' : `show ${hiddenOlder} older event${hiddenOlder === 1 ? '' : 's'}`;
  }
  more.addEventListener('click', () => { expanded = !expanded; applyFilter(); if (!expanded) more.scrollIntoView({ block: 'center' }); });

  if ($('event-filters')) {
    const FILTERS = [['all', 'all'], ['workshop', 'workshops'], ['journal', 'journal clubs'], ['speaker', 'speakers'], ['gbm', 'gbms'], ['past', 'past only']];
    const present = new Set(dated.map(e => e.kind));
    $('event-filters').innerHTML = FILTERS
      .filter(([k]) => k === 'all' || k === 'past' || present.has(k))
      .map(([k, label]) => `<button class="fchip" type="button" data-filter="${k}" aria-pressed="${k === 'all'}">${label}</button>`).join('');
    $('event-filters').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-filter]'); if (!b) return;
      filter = b.dataset.filter; expanded = false;
      $('event-filters').querySelectorAll('[data-filter]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      applyFilter();
    });
  }
  applyFilter();
}

// --- Join page: "then show up" ---
if ($('join-next')) {
  const e = next;
  $('join-next').innerHTML = e
    ? `<div class="card glow spot">
        <div><div class="ev-tag" style="margin:0 0 14px">THEN SHOW UP \u00B7 ${e.countdown}</div><div class="ev-date">${e.dateShort}</div>
          <div class="ev-meta">${e.dow.toLowerCase()} \u00B7 ${e.time} \u00B7 ${esc(e.place)}</div></div>
        <div><h3 class="ev-title">${esc(e.title)}</h3><p class="ev-blurb">${e.desc ? esc(e.desc) + ' ' : ''}No sign-up needed: the first meeting you come to is the one that counts.</p></div>
        <div class="ev-side">${calLink(e, 'pill teal sm')}${remindLink('mono-link sm teal')}</div></div>`
    : `<div class="card dashed"><div class="label" style="margin-bottom:10px">// then show up</div>
        <h3>The next date is not posted yet.</h3><p>New events are announced first on ${remindLink('', 'Discord')} and appear on the <a href="events.html">events page</a> as soon as they are scheduled.</p></div>`;
}

// --- People page ---
function personCard(p, roleClass) {
  const links = (p.links || []).filter(l => l && l.url).map(l => `<a href="${attr(String(l.url).trim())}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('');
  return `<article class="person"><img src="${attr(p.photo)}" alt="${attr(p.name)}" loading="lazy" decoding="async" width="400" height="500">
    <h3>${esc(p.name)}</h3><div class="role ${roleClass}">${esc(p.role)}</div>
    <p>${esc(p.bio)}</p>${links ? `<div class="plinks">${links}</div>` : ''}</article>`;
}
if ($('grid-leadership')) $('grid-leadership').innerHTML = (D.LEADERSHIP || []).map(p => personCard(p, 'teal')).join('');
if ($('grid-gradcouncil')) {
  const gc = D.GRAD_COUNCIL || [];
  if (gc.length) {
    $('grid-gradcouncil').innerHTML = gc.map(p => personCard(p, 'purple')).join('');
  } else {
    // No grad council listed right now (GRAD_COUNCIL commented out) — hide the empty section + its jump link.
    const sec = $('gradcouncil'); if (sec) sec.hidden = true;
    document.querySelectorAll('a[href="#gradcouncil"]').forEach(a => { a.hidden = true; });
  }
}
if ($('grid-mentors')) {
<<<<<<< HEAD
  $('grid-mentors').innerHTML = (D.MENTORS || []).map(p => personCard(p, 'teal')).join('') +
    `<div class="card dashed open-seat">
      <div class="label" style="margin:0">// open seat</div>
      <h3>Mentor a project team</h3>
      <p>For anyone with experience in computational neuroscience or a related field. It takes about 2\u20134 hours a month.</p>
      <a class="mono-link sm teal" href="${attr(D.LINKS.mentorForm)}" target="_blank" rel="noopener">become a mentor \u2192</a></div>`;
=======
  $('grid-mentors').innerHTML = (D.MENTORS || []).map(p => personCard(p, 'var(--teal)')).join('') +
    `<div style="border:1px dashed #263241;border-radius:16px;padding:24px;display:flex;flex-direction:column;justify-content:center;gap:10px">
      <div class="mono" style="font-size:11px;color:var(--faint)">// open seat</div>
      <h3 style="font-size:16px;font-weight:800;color:#fff;margin:0">Mentor a project team</h3>
      <p style="font-size:12.5px;line-height:1.6;color:var(--muted);margin:0">This is for anyone with experience in computational neuroscience or a related field, and it takes about 2-4 hours a month.</p>
      <a class="btn-ghost" style="width:fit-content;padding:10px 18px;font-size:12px" href="${D.LINKS.mentorForm}" target="_blank">Become a mentor</a></div>`;
>>>>>>> 52bd95d (rewrite)
}
if ($('grid-team')) $('grid-team').innerHTML = (D.TEAM || []).map(p => personCard(p, 'pink')).join('');

// --- Projects page ---
if ($('current-project')) {
  const P = D.CURRENT_PROJECT, A = D.APPLICATIONS || {};
  const applyBtn = A.open
    ? `<a class="pill pink md" href="${attr(A.formUrl)}" target="_blank" rel="noopener">${P ? 'Apply to join this team' : 'Apply for the next project team'}</a>
       ${P ? '<span class="small">Meetings have already started, so apply soon.</span>' : ''}`
    : `<span class="pill md disabled" aria-disabled="true">Applications closed</span>
       <span class="small mono" style="font-size:13px">${esc(A.closedNote || '')}</span>`;
  if (P) {
<<<<<<< HEAD
=======
    const apply = A.open
      ? `<a class="btn" href="${A.formUrl}" target="_blank">Apply to join this team</a>
         <span style="font-size:12px;color:var(--muted)">Meetings have already started, so apply soon.</span>`
      : `<span class="btn-ghost" style="color:var(--faint) !important">Applications closed</span>
         <span class="mono" style="font-size:12px;color:var(--faint)">${esc(A.closedNote)}</span>`;
>>>>>>> 52bd95d (rewrite)
    $('current-project').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <span class="eyebrow">${esc(P.term).toUpperCase()} \u00B7 ACTIVE</span>
        <span class="mono small" style="font-size:13px">${esc(P.meeting || '')}</span></div>
      <h2 class="h2" style="font-size:clamp(28px,3vw,40px);margin:18px 0 12px">${esc(P.name)}</h2>
      <p class="body-copy" style="max-width:70ch">${esc(P.summary)}</p>
      <div class="proj-cols">
        <div class="proj-box">
          <div class="label c-teal">// weekly cadence</div>
          ${(P.cadence || []).map(c => `<div class="line"><span class="mono">&gt;</span><span>${esc(c)}</span></div>`).join('')}
        </div>
<<<<<<< HEAD
        <div class="proj-box" style="display:flex;flex-direction:column;gap:16px">
          ${P.mentors ? `<div><div class="label c-purple" style="margin-bottom:6px">// mentorship</div><div class="txt">${esc(P.mentors)}</div></div>` : ''}
          ${P.paperUrl ? `<div><div class="label c-pink" style="margin-bottom:6px">// the paper</div><a class="mono txt" style="font-size:13px" href="${attr(P.paperUrl)}" target="_blank" rel="noopener">${esc(P.paperLabel || P.paperUrl)}</a></div>` : ''}
          ${P.hubUrl ? `<div><div class="label c-pink" style="margin-bottom:6px">// participants</div><div class="txt">All of the workshop recordings, paper links, dates, and news for participants are on the project hub.</div></div>` : ''}
=======
        <div style="border:1px solid var(--line);border-radius:14px;padding:18px 20px;display:flex;flex-direction:column;gap:12px">
          ${P.mentors ? `<div><div class="mono" style="font-size:11px;color:var(--purple);margin-bottom:6px">// mentorship</div>
            <div style="font-size:13px;line-height:1.6">${esc(P.mentors)}</div></div>` : ''}
          ${P.paperUrl ? `<div><div class="mono" style="font-size:11px;color:var(--pink);margin-bottom:6px">// the paper</div>
            <a class="mono" style="font-size:12px;word-break:break-all;line-height:1.6" href="${P.paperUrl}" target="_blank">${esc(P.paperLabel || P.paperUrl)}</a></div>` : ''}
          ${P.hubUrl ? `<div><div class="mono" style="font-size:11px;color:var(--pink);margin-bottom:6px">// participants</div>
            <div style="font-size:13px;line-height:1.6">All of the workshop recordings, paper links, dates, and news for participants are on the project hub.</div></div>` : ''}
<<<<<<< HEAD
>>>>>>> 52bd95d (rewrite)
=======
>>>>>>> 99e21a6 (rewrite)
        </div></div>
      <div class="cta-row" style="margin-top:28px;gap:16px 24px">
        ${P.hubUrl ? `<a class="pill md" href="${attr(P.hubUrl)}">Open the project hub</a>` : ''}${applyBtn}</div>`;
  } else {
    $('current-project').innerHTML = `
<<<<<<< HEAD
      <span class="eyebrow dim">NO ACTIVE PROJECT</span>
      <h2 class="h2" style="font-size:clamp(28px,3vw,40px);margin:18px 0 12px">Next project team forming soon</h2>
      <p class="body-copy" style="max-width:70ch">We are between project cycles right now, so take a look at our past projects below, or apply now and we will contact you when the next team starts.</p>
      <div class="cta-row" style="margin-top:28px;gap:16px 24px">${applyBtn}</div>`;
=======
      <span class="tag dim">NO ACTIVE PROJECT</span>
      <h2 style="font-size:28px;font-weight:900;color:#fff;margin:16px 0 8px">Next project team forming soon</h2>
      <p style="font-size:14.5px;line-height:1.7;color:var(--muted);max-width:78ch;margin:0">We are between project cycles right now, so take a look at our past projects below, or apply now and we will contact you when the next team starts.</p>
      <div style="display:flex;align-items:center;gap:16px;margin-top:24px;flex-wrap:wrap">${apply}</div>`;
>>>>>>> 52bd95d (rewrite)
  }
}
// Past projects: clickable cards that open a detail view. Every section of the
// detail view is optional - empty fields in PAST_PROJECTS are simply not shown.
if ($('past-projects')) {
  const PP = D.PAST_PROJECTS || [];
  $('past-projects').innerHTML = PP.map((p, i) => `
    <button class="project-card" type="button" data-project="${i}" aria-haspopup="dialog">
      <img src="${attr(p.image)}" alt="" loading="lazy" decoding="async">
      <div class="pad"><span class="eyebrow dim">${esc((p.term || 'COMPLETED').toUpperCase())}</span>
      <h3>${esc(p.name)}</h3><p>${esc(p.summary)}</p>
      <span class="more">view details \u2192</span></div>
    </button>`).join('');

  const overlay = document.createElement('div');
  overlay.className = 'pm-overlay';
  overlay.innerHTML = '<div class="pm-sheet" role="dialog" aria-modal="true" aria-label="Project details"></div>';
  document.body.appendChild(overlay);
  const sheet = overlay.querySelector('.pm-sheet');
  let lastFocus = null;

  const bullets = (items) => (items || []).filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('');
  const closeProject = () => {
    overlay.classList.remove('open');
    document.body.classList.remove('pm-open');
    if (lastFocus) lastFocus.focus();
  };

  function openProject(i) {
    const p = PP[i];
    if (!p) return;
    lastFocus = document.activeElement;
    const meta = [
      p.paper ? `<div><b>Paper:</b> ${esc(p.paper)}</div>` : '',
      p.funding ? `<div><b>Funding:</b> ${esc(p.funding)}</div>` : '',
      p.mentors ? `<div><b>Mentors:</b> ${esc(p.mentors)}</div>` : '',
      p.tools ? `<div><b>Tools:</b> ${esc(p.tools)}</div>` : '',
      p.repo ? `<div><b>Code:</b> <a href="${attr(p.repo)}" target="_blank" rel="noopener">GitHub repository</a></div>` : '',
    ].join('');
    const mission = bullets(p.mission), outcome = bullets(p.outcome);
    const members = (p.members || []).map(m => `<li><b>${esc(m.name)}</b>${m.major ? ' - ' + esc(m.major) : ''}${m.role ? ` <span class="c-faint">(${esc(m.role)})</span>` : ''}</li>`).join('');
    const gallery = (p.gallery || []).map((src, n) => `<button class="lb-thumb" type="button" aria-label="View photo ${n + 1} larger"><img src="${attr(src)}" alt="${attr(p.name)} photo ${n + 1}" loading="lazy" decoding="async" onerror="this.closest('.lb-thumb').style.display='none'"></button>`).join('');
    sheet.innerHTML = `
      <div class="pm-head">
        <div><span class="eyebrow dim">${esc((p.term || 'COMPLETED').toUpperCase())}</span>
          <h3>${esc(p.name)}</h3>
          ${p.subtitle ? `<div class="mono c-faint" style="font-size:13px">${esc(p.subtitle)}</div>` : ''}</div>
        <button class="pm-close" type="button" aria-label="Close">\u00D7</button>
      </div>
      ${meta ? `<div class="pm-meta">${meta}</div>` : ''}
      ${mission ? `<h4>// mission</h4><ul>${mission}</ul>` : ''}
      ${outcome ? `<h4>// outcome</h4><ul>${outcome}</ul>` : ''}
      ${members ? `<h4>// team</h4><ul class="pm-members">${members}</ul>` : ''}
      ${gallery ? `<h4>// photos</h4><div class="pm-gallery">${gallery}</div>` : ''}`;
    overlay.classList.add('open');
    document.body.classList.add('pm-open');
    sheet.querySelector('.pm-close').focus();
  }

  // Fullscreen photo viewer for the project galleries
  const lb = document.createElement('div');
  lb.className = 'lb-overlay';
  lb.innerHTML = '<button class="lb-close" type="button" aria-label="Close photo">\u00D7</button>'
    + '<button class="lb-nav lb-prev" type="button" aria-label="Previous photo">&#8249;</button>'
    + '<img alt="">'
    + '<button class="lb-nav lb-next" type="button" aria-label="Next photo">&#8250;</button>'
    + '<div class="lb-count"></div>';
  document.body.appendChild(lb);
  const lbImg = lb.querySelector('img'), lbCount = lb.querySelector('.lb-count');
  let lbList = [], lbAt = 0;

  function showPhoto(n) {
    if (!lbList.length) return;
    lbAt = (n + lbList.length) % lbList.length;
    lbImg.src = lbList[lbAt];
    lbCount.textContent = lbList.length > 1 ? (lbAt + 1) + ' / ' + lbList.length : '';
    lb.querySelectorAll('.lb-nav').forEach(b => { b.style.display = lbList.length > 1 ? 'block' : 'none'; });
  }
  function openPhoto(src) {
    // only photos that actually loaded (broken ones hide themselves)
    lbList = Array.from(sheet.querySelectorAll('.pm-gallery .lb-thumb'))
      .filter(b => b.style.display !== 'none')
      .map(b => b.querySelector('img').getAttribute('src'));
    showPhoto(Math.max(lbList.indexOf(src), 0));
    lb.classList.add('open');
    lb.querySelector('.lb-close').focus();
  }
  const closePhoto = () => lb.classList.remove('open');

  $('past-projects').addEventListener('click', (e) => {
    const card = e.target.closest('[data-project]');
    if (card) openProject(Number(card.dataset.project));
  });
  sheet.addEventListener('click', (e) => {
    const thumb = e.target.closest('.lb-thumb');
    if (thumb) openPhoto(thumb.querySelector('img').getAttribute('src'));
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('.pm-close')) closeProject();
  });
  lb.addEventListener('click', (e) => {
    if (e.target.closest('.lb-prev')) return showPhoto(lbAt - 1);
    if (e.target.closest('.lb-next')) return showPhoto(lbAt + 1);
    if (e.target === lb || e.target.closest('.lb-close')) closePhoto();
  });
  document.addEventListener('keydown', (e) => {
    if (lb.classList.contains('open')) {
      if (e.key === 'Escape') closePhoto();
      else if (e.key === 'ArrowLeft') showPhoto(lbAt - 1);
      else if (e.key === 'ArrowRight') showPhoto(lbAt + 1);
      return;
    }
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeProject();
  });
}

// --- Link hydration (any element with data-link="key") ---
document.querySelectorAll('[data-link]').forEach(a => {
  const url = D.LINKS[a.dataset.link];
  if (url) a.href = a.dataset.link === 'email' ? 'mailto:' + url : url;
  if (a.dataset.linkText !== undefined) a.textContent = url;
});

// --- Current page in the nav ---
{
  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav-links a[href]').forEach(a => {
    if ((a.getAttribute('href') || '').toLowerCase() === here) a.classList.add('active');
  });
}

// --- Neuron field: load three.js + the morphologies only on screens wider than 900px ---
{
  const field = $('neuron-field');
  if (field && 'matchMedia' in window) {
    const mq = window.matchMedia('(min-width: 901px)');
    let started = false;
    const start = () => {
      if (started || !mq.matches) return;
      started = true;
      import('./neuron.js')
        .then(m => m.mountNeuron({ canvas: $('neuron-canvas'), phaseEl: $('neuron-phase'), statusEl: $('neuron-status'), listEl: $('neuron-list'), mainEl: $('main') }))
        .catch(() => { const s = $('neuron-status'); if (s) s.textContent = 'Allen Cell Types \u00B7 morphologies unavailable'; field.classList.add('is-off'); });
    };
    start();
    if (mq.addEventListener) mq.addEventListener('change', start); else if (mq.addListener) mq.addListener(start);
  }
}

// --- Google Analytics (GA4) event tracking ---
// Sends meaningful, well-named GA4 events on the actions that matter, so
// conversions show up cleanly (works for both data-link CTAs and plain links).
// Recommended GA4 event names are used where they fit:
//   generate_lead  - a form was opened (membership / project / team / mentor / lead-event / contact)
//   join_group     - Discord invite clicked
//   outbound_click - social / external link (Instagram, LinkedIn, FSU HQ)
//   select_content - Google Calendar opened, or an .ics "add to calendar" download
//   contact        - mailto: clicked
// In GA4 (Admin -> Events), mark generate_lead and join_group as KEY EVENTS
// to measure signups and community joins. cta_id/form params let you segment.
const track = (name, params) => { if (typeof window.gtag === 'function') window.gtag('event', name, params); };
const FORM_BY_KEY = { joinForm: 'membership', teamForm: 'team_profile', projectForm: 'project_application', mentorForm: 'mentor_interest', leadEventForm: 'lead_event', contactForm: 'contact' };
const FORM_BY_ID = { LSeqCh: 'membership', 'LSfd-v': 'team_profile', LScRBf: 'project_application', LSemPS: 'mentor_interest', LSfA6z: 'lead_event', LScl6m: 'contact' };
const formName = (key, href) => {
  if (key && FORM_BY_KEY[key]) return FORM_BY_KEY[key];
  for (const frag in FORM_BY_ID) if (href.indexOf(frag) >= 0) return FORM_BY_ID[frag];
  return 'form';
};
document.addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a) return;
  const href = a.href || '';
  const key = (a.dataset && a.dataset.link) || '';
  const base = { link_url: href.slice(0, 200), link_text: (a.textContent || '').trim().slice(0, 80), cta_id: key };
  if (/docs\.google\.com\/forms/.test(href))   track('generate_lead',  { ...base, form: formName(key, href) });
  else if (/discord\.(gg|com)/.test(href))      track('join_group',     { ...base, group: 'discord' });
  else if (/instagram\.com/.test(href))         track('outbound_click', { ...base, target: 'instagram' });
  else if (/linkedin\.com/.test(href))          track('outbound_click', { ...base, target: 'linkedin' });
  else if (/hq\.fsu\.edu/.test(href))           track('outbound_click', { ...base, target: 'fsu_hq' });
  else if (/calendar\.google\.com/.test(href))  track('select_content', { ...base, content_type: 'calendar' });
  else if (href.indexOf('data:text/calendar') === 0) track('select_content', { ...base, link_url: 'ics', content_type: 'calendar_ics' });
  else if (href.indexOf('mailto:') === 0)       track('contact',        { ...base, method: 'email' });
  else if (key)                                 track('cta_click',      base);
});
