// transcript.js: reads an unofficial FSU transcript entirely in the browser.
//
// Only course codes and course titles survive parsing. Grades, credits, GPAs, names, student IDs
// and every other line of the transcript are dropped on the spot, and the raw text is never stored
// or sent anywhere. The one network request this module can make is the lazy load of pdf.js from
// cdnjs, and only when the student picks a PDF.

const PDFJS_VERSION = '3.11.174';
const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

// FSU course code: 3 capitals, optional space, 4 digits, optional 1-2 letter suffix (MAC 2311,
// PSB3004C, BSC 2010L). The lookarounds keep it from matching inside longer words or numbers.
const CODE_RE = /(?<![A-Za-z0-9])([A-Z]{3}) ?(\d{4})([A-Z]{1,2})?(?![A-Za-z0-9])/g;
// Three-letter words that look like a prefix but are term names on transcripts ("SPR 2024").
const NOT_A_PREFIX = new Set(['SPR', 'SUM', 'FAL', 'WIN', 'TRM', 'GPA', 'TOT', 'PAG']);

const GRADES = new Set(['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F',
  'S', 'U', 'P', 'W', 'I', 'NG', 'IP', 'T']);
const NUMERIC = /^\d+(?:\.\d+)?$/;      // credits, quality points, years (3.000, 12, 2024)
const LONG_DIGITS = /\d{5,}/;           // IDs or other long numbers
const MAX_TITLE = 90;

const MATH_LEVELS = [   // ported from gen_synthetic.py (order = low to high)
  ['Pre-calculus', /^MAC 1(105|114|140|147)/],
  ['Calculus 1', /^MAC 2(311|233|241)/],
  ['Calculus 2', /^MAC 2(312|234|242)/],
  ['Calculus 3', /^MAC 2313/],
  ['Linear algebra or ODE', /^(MAS 3105|MAS 3114|MAP 2302|MAP 3305)/],
  ['Probability / statistics beyond intro', /^STA (3|4)\d{3}/],
  ['Beyond these', /^(MAA|MAS|MAP|MAD) 4\d{3}/],
];

const PASTE_INSTEAD = "We couldn't read that file. Try pasting the transcript text instead.";
const NONE_FOUND = "We didn't find any course codes (like MAC 2311) in that text. Check it, or paste the text instead.";

function isGrade(tok) {
  return GRADES.has(tok.replace(/[*#]+$/, ''));
}

function isStop(tok) {
  return NUMERIC.test(tok) || LONG_DIGITS.test(tok);
}

// Title = the words after the code, up to the first credit- or grade-like token.
// "I" is never treated as a grade (it is the roman numeral in "Chemistry I"; an Incomplete grade
// sits after the credits, which stop the title first). Other grade letters stop the title only
// when they are followed by a number, another grade, or the end of the line, so "General Physics A
// with Lab" keeps its "A" while "Calculus I A 4.0" loses its grade.
function titleFrom(segment) {
  const toks = segment.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (isStop(t)) break;
    if (t !== 'I' && isGrade(t)) {
      const next = toks[i + 1];
      if (next === undefined || isStop(next) || isGrade(next)) break;
    }
    out.push(t);
  }
  let title = out.join(' ').replace(/^[\s\-–—:|,.]+|[\s\-–—:|,]+$/g, '');
  if (title.length > MAX_TITLE) title = title.slice(0, MAX_TITLE).replace(/\s+\S*$/, '');
  return title;
}

export function parseTranscriptText(text) {
  const courses = [];
  const warnings = [];
  const seen = new Set();
  const src = typeof text === 'string' ? text : '';
  for (const rawLine of src.split(/\r?\n/)) {
    const line = rawLine.replace(/[\u0000-\u001f\u007f]/g, ' ');
    const hits = [...line.matchAll(CODE_RE)].filter((m) => !NOT_A_PREFIX.has(m[1]));
    hits.forEach((m, i) => {
      const code = `${m[1]} ${m[2]}${m[3] || ''}`;
      if (seen.has(code)) return;
      seen.add(code);
      const end = i + 1 < hits.length ? hits[i + 1].index : line.length;
      courses.push({ course_code: code, course_title: titleFrom(line.slice(m.index + m[0].length, end)) });
    });
  }
  if (!courses.length) warnings.push(NONE_FOUND);
  return { courses, warnings };
}

// ------------------------------------------------------------------------------------- pdf.js
let pdfjsPromise = null;

function loadPdfJs() {
  if (globalThis.pdfjsLib) return Promise.resolve(globalThis.pdfjsLib);
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PDFJS_URL;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.referrerPolicy = 'no-referrer';
    s.onload = () => {
      const lib = globalThis.pdfjsLib;
      if (!lib) { reject(new Error('pdf.js did not load')); return; }
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      resolve(lib);
    };
    s.onerror = () => reject(new Error('pdf.js could not be downloaded'));
    document.head.appendChild(s);
  }).catch((e) => { pdfjsPromise = null; throw e; });
  return pdfjsPromise;
}

async function pdfToText(file) {
  const lib = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await lib.getDocument({ data, isEvalSupported: false }).promise;
  const lines = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const rows = [];   // [{y, items: [{x, s}]}], items on the same baseline (±2pt) share a row
      for (const it of content.items) {
        if (typeof it.str !== 'string' || !it.str.trim() || !it.transform) continue;
        const x = it.transform[4];
        const y = it.transform[5];
        let row = rows.find((r) => Math.abs(r.y - y) <= 2);
        if (!row) { row = { y, items: [] }; rows.push(row); }
        row.items.push({ x, s: it.str });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) lines.push(r.items.sort((a, b) => a.x - b.x).map((i) => i.s).join(' '));
      page.cleanup();
    }
  } finally {
    doc.destroy();
  }
  return lines.join('\n');
}

export async function parseTranscriptFile(file) {
  try {
    if (!file || typeof file.name !== 'string') throw new Error('no file');
    const name = file.name.toLowerCase();
    const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf';
    const isTxt = name.endsWith('.txt') || file.type === 'text/plain';
    if (!isPdf && !isTxt) {
      return { courses: [], warnings: ['That file type isn’t supported. Choose a .pdf or .txt file, or paste the text instead.'] };
    }
    let text = isPdf ? await pdfToText(file) : await file.text();
    const result = parseTranscriptText(text);
    text = null;   // drop the raw text right away
    if (!result.courses.length && isPdf) {
      return { courses: [], warnings: ["We couldn't find course codes in that PDF (scanned PDFs have no text). Try pasting the text instead."] };
    }
    return result;
  } catch (e) {
    return { courses: [], warnings: [PASTE_INSTEAD] };
  }
}

export function suggestMath(courses) {
  if (!Array.isArray(courses)) return null;
  let best = -1;
  let code = null;
  for (const c of courses) {
    const cc = c && typeof c.course_code === 'string' ? c.course_code : '';
    MATH_LEVELS.forEach(([, re], i) => {
      if (i > best && re.test(cc)) { best = i; code = cc; }
    });
  }
  return best >= 0 ? { level: MATH_LEVELS[best][0], code } : null;
}
