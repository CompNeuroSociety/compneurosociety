// Renders mini-project.html from js/mini-project-data.js. Workshops are the
// hand-listed WORKSHOPS plus any "workshop" event from the calendar sync since
// META.termStart; a hand-listed entry on the same day wins.
import { META, LINKS, WORKSHOPS, PAPERS, NEWS } from './mini-project-data.js';
import { CALENDAR_EVENTS } from './calendar-events.js';

const $ = (id) => document.getElementById(id);
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const day = (d) => String(d || '').slice(0, 10);
const empty = (msg) => `<div class="mp-empty">${msg}</div>`;

function when(dt) {
  const h12 = ((dt.getHours() + 11) % 12) + 1, mins = String(dt.getMinutes()).padStart(2, '0');
  return { dateStr: MONTHS[dt.getMonth()] + ' ' + String(dt.getDate()).padStart(2, '0'),
    time: h12 + ':' + mins + (dt.getHours() >= 12 ? 'pm' : 'am') };
}
function countdown(dt) {
  const diff = Math.max(0, dt.getTime() - Date.now());
  const days = Math.floor(diff / 864e5), hours = Math.floor((diff % 864e5) / 36e5);
  return days ? `in ${days}d ${hours}h` : `in ${hours}h`;
}

// --- Hero ---
$('mp-kicker').textContent = '// projects / ' + META.term.toLowerCase();
$('mp-title').innerHTML = esc(META.title).replace(/(\S+)$/, '<span class="grad">$1</span>');
$('mp-blurb').textContent = META.blurb;
$('mp-links').innerHTML = Object.values(LINKS).filter(l => l && l.url).map((l, i) =>
  `<a class="${i ? 'btn-ghost' : 'btn teal'}" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('');

// --- Workshops ---
const listed = WORKSHOPS.filter(w => !isNaN(new Date(w.date)));
const fromCal = (CALENDAR_EVENTS || [])
  .filter(e => /workshop/i.test(e.title) && day(e.date) >= META.termStart)
  .filter(e => !listed.some(w => day(w.date) === day(e.date)))
  // The calendar puts the room in the description and the street address in
  // location, so show the room.
  .map(e => ({ date: e.date, title: e.title, location: e.blurb || e.location }));
const sessions = [...listed, ...fromCal]
  .map(w => ({ ...w, dt: new Date(w.date) }))
  .sort((a, b) => a.dt - b.dt);
const now = Date.now();
const upcoming = sessions.filter(w => w.dt.getTime() > now);
// A session listed without a date has already happened (we only leave the
// date off when it is not known), so it goes below the dated past sessions,
// newest first, i.e. in reverse of the order it is listed in.
const undated = WORKSHOPS.filter(w => isNaN(new Date(w.date))).reverse();
const past = [...sessions.filter(w => w.dt.getTime() <= now).reverse(), ...undated];

const extra = (w) => [
  w.slides ? `<a href="${esc(w.slides)}" target="_blank" rel="noopener">slides</a>` : '',
  w.code ? `<a href="${esc(w.code)}" target="_blank" rel="noopener">code</a>` : '',
  ...(w.links || []).filter(l => l && l.url).map(l =>
    `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`),
].join('');

const nextHead = (title) => `<h3><span class="mp-pink">Next Workshop:</span> ${esc(title)}</h3>`;
if (upcoming[0]) {
  const w = upcoming[0], t = when(w.dt);
  $('mp-next').innerHTML = `<div class="panel panel-glow mp-next">
    <div><span class="tag solid">STARTS ${countdown(w.dt).toUpperCase()}</span>
      <div class="mp-next-date">${t.dateStr}</div>
      <div class="mono mp-sub">${t.time}${w.location ? ' - ' + esc(w.location) : ''}</div></div>
    <div>${nextHead(w.title)}${w.blurb ? `<p>${esc(w.blurb)}</p>` : `<p>Details and any prep go out on <a href="${esc(LINKS.discord.url)}" target="_blank" rel="noopener">Discord</a> before the session.</p>`}
      ${extra(w) ? `<div class="mp-extra">${extra(w)}</div>` : ''}</div></div>`;
} else {
  $('mp-next').innerHTML = `<div class="panel mp-next mp-next-tba"><div>${nextHead('TBA')}
    <p>The date is not posted yet - announcements go out on <a href="${esc(LINKS.discord.url)}" target="_blank" rel="noopener">Discord</a>.</p></div></div>`;
}

const row = (w, isPast) => {
  const t = w.dt ? when(w.dt) : { dateStr: 'PAST', time: 'date tba' };
  const action = isPast
    ? (w.recording
        ? `<a class="mp-play" href="${esc(w.recording)}" target="_blank" rel="noopener">&#9654; Watch recording</a>`
        : `<span class="mp-soon">recording soon</span>`)
    : `<span class="tag teal">UPCOMING</span>`;
  return `<div class="mp-row${isPast ? '' : ' is-next'}">
    <div class="mp-d">${t.dateStr}<small>${t.time}</small></div>
    <div class="mp-main"><h3>${esc(w.title)}</h3>
      ${w.blurb ? `<p>${esc(w.blurb)}</p>` : ''}
      ${w.location ? `<div class="mono mp-sub">${esc(w.location)}</div>` : ''}</div>
    <div class="mp-side">${action}${extra(w) ? `<div class="mp-extra">${extra(w)}</div>` : ''}</div></div>`;
};
$('mp-schedule').innerHTML = upcoming.length + past.length
  ? [...upcoming.map(w => row(w, false)), ...past.map(w => row(w, true))].join('')
  : empty('no workshops scheduled yet');

// --- Deadline ---
const due = META.due ? new Date(META.due) : null;
if (due && !isNaN(due)) {
  const t = when(due), over = due.getTime() <= now;
  $('mp-due').innerHTML = `<span class="tag ${over ? 'dim' : 'gold'}">${esc(META.dueLabel).toUpperCase()}</span>
    <span class="mono mp-sub">${t.dateStr} ${due.getFullYear()} - ${over ? 'closed' : countdown(due)}</span>`;
}

// --- Papers ---
const STATUS = { picked: 'dim', 'in progress': 'teal', replicated: 'purple' };
// A card with a url is one big link to the paper, with an explicit
// "Open paper" button at the bottom so it is obvious it can be clicked.
$('mp-papers').innerHTML = PAPERS.length ? PAPERS.map((p, i) => {
  const tag = p.url ? 'a' : 'div';
  const href = p.url ? ` href="${esc(p.url)}" target="_blank" rel="noopener"` : '';
  return `<${tag} class="mp-paper${i % 2 ? ' alt' : ''}"${href}>
    <div class="mp-paper-top">${p.label ? `<span class="tag ${i % 2 ? 'purple' : 'teal'}">${esc(p.label).toUpperCase()}</span>` : ''}
      ${p.figure ? `<span class="tag gold">${esc(p.figure)}</span>` : ''}
      ${p.status ? `<span class="tag ${STATUS[p.status] || 'dim'}">${esc(p.status).toUpperCase()}</span>` : ''}</div>
    <h3>${esc(p.title)}</h3>
    <div class="mono mp-sub">${[p.authors, p.year, p.venue].filter(Boolean).map(esc).join(' - ')}</div>
    ${p.note ? `<p class="mp-note">${esc(p.note)}</p>` : ''}
    ${p.who ? `<div class="mp-who">${esc(p.who)}</div>` : ''}
    ${p.url ? `<div class="mp-open-row"><span class="mp-open">Open paper &#8599;</span></div>` : ''}
  </${tag}>`;
}).join('')
  : empty('no papers posted yet - once you pick one, send it in and it will show up here');

// --- News ---
$('mp-news').innerHTML = NEWS.length ? NEWS.map(n => {
  const d = new Date(n.date + 'T12:00');
  const ds = isNaN(d) ? '' : MONTHS[d.getMonth()] + ' ' + String(d.getDate()).padStart(2, '0');
  return `<div class="mp-news">
    <div class="mono mp-news-d">${ds}</div>
    <div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p>
      ${n.link && n.link.url ? `<a class="mono" href="${esc(n.link.url)}" target="_blank" rel="noopener">${esc(n.link.label || 'link')} -></a>` : ''}</div></div>`;
}).join('') : empty('no announcements yet');
