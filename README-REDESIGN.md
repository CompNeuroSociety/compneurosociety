# CompNeuroSociety — "Warm Lab" redesign

Drop-in redesign of the site. Dark, data-true, friendly to newcomers.
Same GitHub Pages setup, no build step, analytics tags kept.

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | New home — hero, live 3D EEG brain, ticker, stats, auto-updating events |
| `about.html` | Mission, "what is comp neuro", constitution, FSU×FIU |
| `people.html` | **New page** — merges Leadership, Grad Council, Mentors, The Team |
| `events.html` | Up-next spotlight + full timeline + lead-an-event |
| `projects.html` | Current project (Pena Lab), past projects, FIU banner |
| `join.html` | 3-step join flow (form → Nole Central → GroupMe) |
| `sponsors.html` | ORCA + sponsor CTA |
| `css/warm-lab.css` | The whole design system (tokens at top) |
| `js/site-data.js` | **☆ The only file you edit day-to-day** — events, people, projects, links |
| `js/site.js` | Renders data into the pages; mobile menu |
| `brain-viz.html` | The 3D brain (iframe on home). Same model/shader as before; EEG lights are now synthesized so visitors don't download the 30 MB JSON |
| `images/…` | Only images the new pages reference (all already in your repo — identical copies) |

## How to update content (webmaster)

Everything routine lives in **`js/site-data.js`** — instructions are at the top
of that file. Add an event there and the home page + events page update
themselves (upcoming/past sorting and countdowns are automatic). The two
future events currently in it are **examples — replace them**.

## How to commit

From your repo root:

```bash
git checkout -b redesign
# copy the contents of this folder over the repo root (keeps old pages intact)
cp -r /path/to/repo-redesign/* .
git add .
git commit -m "Warm Lab redesign: new home/about/people/events/projects/join/sponsors"
git push -u origin redesign
```

Then open a pull request and preview before merging to `main`.

## Notes

- Old pages (`leadership.html`, `team.html`, `gradcouncil.html`, `mentors.html`,
  `leadevent.html`, `projectsold.html`, `setup.html`, …) are untouched; old links
  keep working. Retire them whenever you like — their content now lives in
  `people.html`, `events.html`, and `projects.html`.
- `navbar.js`, `darkmode.js`, `styles.css` are not used by the new pages
  (the redesign is dark-only by design; delete the toggle later if you retire the old pages).
- Paid-role/stipend advertisements were intentionally removed per the redesign brief.
- `eeg_data_10ex.json` is no longer needed by the home page.
