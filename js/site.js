// Renders all data-driven sections from js/site-data.js.
// Pages opt in by including elements with the ids used below.
import * as D from './site-data.js';

const $ = (id) => document.getElementById(id);
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function fmt(ev) {
  const dt = new Date(ev.date);
  const future = dt.getTime() > Date.now();
  const diff = Math.abs(dt.getTime() - Date.now());
  const days = Math.floor(diff / 864e5), hours = Math.floor((diff % 864e5) / 36e5);
  const h12 = ((dt.getHours() + 11) % 12) + 1, mins = String(dt.getMinutes()).padStart(2, '0');
  return { ...ev, dt, future,
    dateStr: MONTHS[dt.getMonth()] + ' ' + String(dt.getDate()).padStart(2, '0'),
    year: dt.getFullYear(),
    time: h12 + ':' + mins + (dt.getHours() >= 12 ? 'pm' : 'am'),
    countdown: 't\u2212' + days + 'd ' + String(hours).padStart(2, '0') + 'h',
    tag: ev.example ? 'EXAMPLE' : (future ? 'UPCOMING' : 'PAST') };
}

const dated = D.EVENTS.filter(e => !isNaN(new Date(e.date))).map(fmt);
const upcoming = dated.filter(e => e.future).sort((a, b) => a.dt - b.dt);
const past = dated.filter(e => !e.future).sort((a, b) => b.dt - a.dt);

// --- Home: event cards ---
if ($('home-events')) {
  const cards = [];
  if (upcoming[0]) {
    const e = upcoming[0];
    cards.push(`<div class="event-card panel-glow">
      <div class="row"><span class="tag solid">UP NEXT · ${e.countdown}</span><span class="mono" style="font-size:11px;color:var(--faint)">${e.time}</span></div>
      <div class="date teal">${e.dateStr}</div><h3>${esc(e.title)}</h3><p>${esc(e.blurb)}</p>
      <a class="btn teal" style="padding:10px 20px;font-size:12.5px" href="events.html">Details</a></div>`);
  }
  if (upcoming[1]) {
    const e = upcoming[1];
    cards.push(`<div class="event-card">
      <div class="row"><span class="tag teal">UPCOMING · ${e.countdown}</span><span class="mono" style="font-size:11px;color:var(--faint)">${e.time}</span></div>
      <div class="date">${e.dateStr}</div><h3>${esc(e.title)}</h3><p>${esc(e.blurb)}</p>
      <a class="btn-ghost" style="padding:9px 18px;font-size:12.5px" href="events.html">Details</a></div>`);
  }
  if (!upcoming.length) {
    cards.push(`<div class="event-card" style="grid-column:span 2;border-style:dashed;display:flex;align-items:center;justify-content:center;text-align:center">
      <span class="mono" style="font-size:12.5px;color:var(--faint);line-height:1.8">no upcoming events posted yet -<br>join the <a href="${D.LINKS.groupme}" target="_blank">GroupMe</a> to hear first</span></div>`);
  }
  if (past[0]) {
    const e = past[0];
    cards.push(`<div class="event-card past"><img src="${e.image}" alt="${esc(e.title)}">
      <div class="pad"><span class="tag dim">PAST · RECAP</span><h3 style="margin-top:8px">${esc(e.title)}</h3>
      <p class="small-meta">${e.dateStr.toLowerCase()} ${e.year} · ${esc(e.location)}</p>
      <a href="${D.LINKS.instagram}" target="_blank" style="font-size:12.5px;font-weight:700">Photos on Instagram →</a></div></div>`);
  }
  $('home-events').innerHTML = cards.join('');
}

// --- Events page: spotlight + timeline ---
if ($('event-spotlight') && upcoming[0]) {
  const e = upcoming[0];
  $('event-spotlight').innerHTML = `<div class="panel panel-glow spotlight">
    <div><span class="tag solid">UP NEXT · ${e.countdown}</span><div class="date">${e.dateStr}</div>
      <div class="mono" style="font-size:12px;color:var(--faint);margin-top:4px">${e.time} · ${esc(e.location)}</div></div>
    <div><h3>${esc(e.title)}</h3><p>${esc(e.blurb)}</p></div>
    <a class="btn teal" href="${D.LINKS.groupme}" target="_blank">Get reminders</a></div>`;
}
if ($('event-timeline')) {
  $('event-timeline').innerHTML = [...dated].sort((a, b) => b.dt - a.dt).map(e => `
    <div class="timeline-row ${e.future ? '' : 'past'}">
      <div class="d" style="color:${e.future ? 'var(--teal)' : 'var(--faint)'}">${e.dateStr}<small>${e.year} · ${e.time}</small></div>
      <img src="${e.image}" alt="${esc(e.title)}">
      <div><h3>${esc(e.title)}</h3><p>${esc(e.blurb)}</p></div>
      <div class="side"><span class="tag ${e.example ? 'purple' : (e.future ? 'teal' : 'dim')}">${e.tag}</span>
        <span class="loc">${esc(e.location)}</span></div>
    </div>`).join('');
}

// --- People page ---
function personCard(p, roleColor) {
  const links = (p.links || []).map(l => `<a href="${l.url}" target="_blank">${esc(l.label)} →</a>`).join('');
  return `<div class="person-card"><img src="${p.photo}" alt="${esc(p.name)}">
    <div class="pad"><h3>${esc(p.name)}</h3><div class="role" style="color:${roleColor}">${esc(p.role)}</div>
    <p>${esc(p.bio)}</p>${links ? `<div class="links">${links}</div>` : ''}</div></div>`;
}
if ($('grid-leadership')) $('grid-leadership').innerHTML = D.LEADERSHIP.map(p => personCard(p, 'var(--teal)')).join('');
if ($('grid-gradcouncil')) $('grid-gradcouncil').innerHTML = D.GRAD_COUNCIL.map(p => personCard(p, 'var(--purple)')).join('');
if ($('grid-mentors')) {
  $('grid-mentors').innerHTML = D.MENTORS.map(p => personCard(p, 'var(--teal)')).join('') +
    `<div style="border:1px dashed #263241;border-radius:16px;padding:24px;display:flex;flex-direction:column;justify-content:center;gap:10px">
      <div class="mono" style="font-size:11px;color:var(--faint)">// open seat</div>
      <h3 style="font-size:16px;font-weight:800;color:#fff;margin:0">Mentor a project team</h3>
      <p style="font-size:12.5px;line-height:1.6;color:var(--muted);margin:0">Experience in computational neuroscience or a related field? Roughly 2–4 hours a month - you choose how to contribute.</p>
      <a class="btn-ghost" style="width:fit-content;padding:10px 18px;font-size:12px" href="${D.LINKS.mentorForm}" target="_blank">become a mentor →</a></div>`;
}
if ($('grid-team')) $('grid-team').innerHTML = D.TEAM.map(p => personCard(p, 'var(--pink)')).join('');

// --- Projects page ---
if ($('current-project')) {
  const P = D.CURRENT_PROJECT, A = D.APPLICATIONS;
  if (P) {
    const apply = A.open
      ? `<a class="btn" href="${A.formUrl}" target="_blank">Apply to join this team →</a>
         <span style="font-size:12px;color:var(--muted)">Meetings have started - sign up ASAP.</span>`
      : `<span class="btn-ghost" style="color:var(--faint) !important">Applications closed</span>
         <span class="mono" style="font-size:12px;color:var(--faint)">${esc(A.closedNote)}</span>`;
    $('current-project').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <span class="tag solid">${esc(P.term).toUpperCase()} · ACTIVE</span>
        <span class="mono" style="font-size:12px;color:var(--faint)">${esc(P.meeting)}</span></div>
      <h2 style="font-size:28px;font-weight:900;color:#fff;margin:16px 0 8px">${esc(P.name)}</h2>
      <p style="font-size:14.5px;line-height:1.7;color:var(--muted);max-width:78ch;margin:0">${esc(P.summary)}</p>
      <div class="two-col" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:22px">
        <div style="border:1px solid var(--line);border-radius:14px;padding:18px 20px">
          <div class="mono" style="font-size:11px;color:var(--teal);margin-bottom:10px">// weekly cadence</div>
          ${P.cadence.map(c => `<div style="display:flex;gap:10px;align-items:baseline;padding:5px 0">
            <span class="mono" style="color:var(--teal);font-size:11px;flex:none">⦿</span>
            <span style="font-size:13px;line-height:1.55">${esc(c)}</span></div>`).join('')}
        </div>
        <div style="border:1px solid var(--line);border-radius:14px;padding:18px 20px;display:flex;flex-direction:column;gap:12px">
          <div><div class="mono" style="font-size:11px;color:var(--purple);margin-bottom:6px">// mentorship</div>
            <div style="font-size:13px;line-height:1.6">${esc(P.mentors)}</div></div>
          <div><div class="mono" style="font-size:11px;color:var(--pink);margin-bottom:6px">// the paper</div>
            <a class="mono" style="font-size:12px;word-break:break-all;line-height:1.6" href="${P.paperUrl}" target="_blank">eneuro.org → ENEURO.0423-18.2019 (pdf) ↗</a></div>
        </div></div>
      <div style="display:flex;align-items:center;gap:16px;margin-top:24px;flex-wrap:wrap">${apply}</div>`;
  } else {
    const apply = A.open
      ? `<a class="btn" href="${A.formUrl}" target="_blank">Apply for the next project team →</a>`
      : `<span class="btn-ghost" style="color:var(--faint) !important">Applications closed</span>
         <span class="mono" style="font-size:12px;color:var(--faint)">${esc(A.closedNote)}</span>`;
    $('current-project').innerHTML = `
      <span class="tag dim">NO ACTIVE PROJECT</span>
      <h2 style="font-size:28px;font-weight:900;color:#fff;margin:16px 0 8px">Next project team forming soon</h2>
      <p style="font-size:14.5px;line-height:1.7;color:var(--muted);max-width:78ch;margin:0">We're between project cycles right now - check out past projects below, or apply to be first in line when the next team kicks off.</p>
      <div style="display:flex;align-items:center;gap:16px;margin-top:24px;flex-wrap:wrap">${apply}</div>`;
  }
}
if ($('past-projects')) {
  $('past-projects').innerHTML = D.PAST_PROJECTS.map(p => `
    <div class="person-card"><img src="${p.image}" alt="${esc(p.name)}" style="height:200px;filter:grayscale(.35)">
      <div class="pad"><span class="tag dim">COMPLETED</span>
      <h3 style="margin:10px 0 6px">${esc(p.name)}</h3><p style="font-size:13px">${esc(p.summary)}</p></div></div>`).join('');
}

// --- Link hydration (any element with data-link="key") ---
document.querySelectorAll('[data-link]').forEach(a => {
  const url = D.LINKS[a.dataset.link];
  if (url) a.href = a.dataset.link === 'email' ? 'mailto:' + url : url;
  if (a.dataset.linkText !== undefined) a.textContent = url;
});

// --- Mobile menu ---
const burger = document.querySelector('.hamburger'), menu = document.querySelector('.mobile-menu');
if (burger && menu) {
  burger.addEventListener('click', () => menu.classList.add('open'));
  menu.querySelector('.mm-close').addEventListener('click', () => menu.classList.remove('open'));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));
}
