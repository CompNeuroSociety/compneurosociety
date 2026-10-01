# compneurosociety.com — webmaster guide

Static site for CompNeuroSociety at FSU. No build step, no framework: plain HTML/CSS/JS served by **GitHub Pages** at the custom domain **compneurosociety.com** (set via `CNAME`). Pushing to the default branch deploys the site — that's the whole release process.

> **The one file you edit day-to-day is `js/site-data.js`.** Events, people, projects, and every external link live there. Most updates never touch HTML.

---

## 1. Repo map

| Path | What it is |
|---|---|
| `index.html` | Home — hero + 3D EEG brain (iframe), what's on, how a semester works, this semester's project, who runs it |
| `about.html` | Mission, what is comp-neuro, FAQ accordion, constitution, links to People / Sponsors / Chapters |
| `people.html` | Leadership, grad council, mentors, team (rendered from site-data; reached from About + footer) |
| `events.html` | Up-next spotlight + filter chips + full timeline (auto-merged with Google Calendar) |
| `projects.html` | Current + past project teams |
| `mini-project.html` | This semester's project hub (`js/mini-project.js` + `js/mini-project-data.js`) |
| `join.html` | 3-step join flow (form → FSU HQ → Discord) + "then show up" (next event) |
| `sponsors.html` | Sponsors + become-a-sponsor CTA (reached from About + footer) |
| `chapters.html` | FSU×FIU chapters + start-a-chapter CTA (reached from About + footer) |
| `brain-viz.html` | The 3D brain iframe (three.js; loads `brain_model.glb` + `white.jpg`) |
| `css/warm-lab.css` | Entire design system — the 2026 "Air" look (light + dark tokens at the top) |
| `js/site-data.js` | ★ All content + links. Edit this. Instructions in its header comment |
| `js/site.js` | Renders site-data into pages (next-up strip, home, events, people, projects, join), GA4 conversion events, loads the neuron field |
| `js/theme.js` | Light/dark theme by the visitor's clock + the toggle in the nav (see §2a) |
| `js/neuron.js` | The field of Allen Institute neurons behind every page (see §2b) |
| `js/vendor/` | three.js r160 + the addons the brain and neurons need (vendored, no CDN) |
| `neuron/` | The neuron reconstructions (SWC) + where they came from |
| `js/calendar-events.js` | **Generated — do not edit.** Auto-synced from Google Calendar |
| `scripts/fetch_calendar_events.py` | Generator for the above (stdlib-only Python) |
| `scripts/optimize_images.py` | Resizes/recompresses `images/` in place — **run after adding photos** (see §7) |
| `.github/workflows/refresh-events.yml` | Runs the sync every 6h + on demand |
| `robots.txt`, `sitemap.xml` | Crawler config — **add new pages to the sitemap** |
| `images/` | All images (member photos in `images/members/`) |

`README-REDESIGN.md` is a historical note from the 2025 (dark "Warm Lab") redesign; this file supersedes it. The current look is the 2026 "Air" redesign: white by default with an automatic dark theme, Montserrat + IBM Plex Mono, hairline rules, a persistent "Next up" strip, and a field of real neurons behind every page.

## 2. Routine updates (all in `js/site-data.js`)

**Add an event:** add an object to the top of `EVENTS` (`title`, `date` as `"YYYY-MM-DDTHH:MM"`, `location`, `blurb`, optional `image`). Home + events pages sort, count down, and archive automatically, and the **"Next up" strip under the nav on every page** always names the soonest upcoming event, with an "add to calendar" link that downloads an `.ics` file (works with Google, Outlook and Apple Calendar) and a "remind me on Discord" link (`LINKS.discord`). Two optional fields: `kind` (`workshop` / `journal` / `speaker` / `gbm` / `project` / `social`) pins which filter chip an event shows under on the events page — otherwise it is guessed from the title — and `durationMinutes` sets the length written into the `.ics` (default 60). Events also flow in from the club's public Google Calendar every 6 hours (see §3) — entries here win over calendar duplicates on the same day, so use this list for curated blurbs/photos.

**Add/edit people:** edit `LEADERSHIP`, `GRAD_COUNCIL` (currently commented out — uncomment to show the section), `MENTORS`, or `TEAM`. Put photos in `images/` first. Team-form responses can be converted to paste-ready card objects automatically — see `generateTeamCards()` in §5.

**Projects:** set `CURRENT_PROJECT` to an object to feature an active team, or `null` to show the "forming soon" placeholder. `APPLICATIONS.open` (true/false) flips the apply button; `closedNote` is the message shown when closed. Past teams go in `PAST_PROJECTS`, newest first. Each entry renders as a **clickable card** on projects.html that opens a detail view; only `name`, `summary`, and `image` are required. Optional fields — `term`, `subtitle`, `paper`, `funding`, `mentors`, `tools`, `repo`, `mission[]`, `outcome[]`, `members[{name, major, role}]`, `gallery[]` — each render as their own section, and **anything empty or `[]` is skipped**, so it's safe to publish a project with sections still unwritten. Gallery images that don't exist yet hide themselves, so you can list a filename before adding the photo.

**Links:** every form/social/external URL is a key in `LINKS`. HTML elements use `data-link="key"` and get hydrated by `site.js` — change the URL once in `LINKS` and every page updates. (Exception: the footer Contact link is hardcoded in each HTML file's footer — update all 8 if it ever changes.)

**Deploy:** commit → push to the default branch → GitHub Pages rebuilds (usually <1 min).

### 2a. Light / dark theme

The site is white by default. `js/theme.js` (a tiny blocking script in every page's `<head>`, so there is no flash) switches the `data-theme` attribute on `<html>`:

- An explicit choice from the ☀/☾ toggle in the nav wins. It is stored in `localStorage` under `cns-theme` (`light` or `dark`); nothing is sent anywhere.
- Otherwise **auto**: dark from 7pm to 7am by the visitor's own clock (`new Date().getHours()`, i.e. their device's local time zone — no geolocation and no permission prompt). Auto re-checks every minute and when the tab comes back into view, so a page left open flips at 7pm. Change the hours at the top of `js/theme.js` (`DARK_FROM`, `DARK_UNTIL`).
- If storage or the clock can't be read, or JavaScript is off, the site stays white.

The toggle cycles auto → light → dark → auto. All colors are tokens at the top of `css/warm-lab.css` (`:root` = light, `:root[data-theme="dark"]` = dark); every text color passes WCAG AA on its background in both themes, so keep new colors in that list. The brain iframe follows the parent's theme (`data-theme-sync` on the iframe).

### 2b. The neurons behind the page

Every page draws a field of five real neuron reconstructions from the Allen Cell Types database (`neuron/*.swc`, credited bottom-left) behind the content; scrolling sends an action potential through each cell. It is `js/neuron.js` + the vendored three.js, loaded only on screens wider than 900px (phones never download it), rendered at ≤30fps, paused in background tabs, and the idle rotation is off under `prefers-reduced-motion`. Behind the text column the canvas is dimmed by a CSS mask so copy stays readable. To add or swap a cell see `neuron/README.md`; to move one, edit `LAYOUT` at the top of `js/neuron.js`.

## 3. Event auto-sync (GitHub Action)

`.github/workflows/refresh-events.yml` runs every 6 hours (and via the manual "Run workflow" button). It executes `scripts/fetch_calendar_events.py`, which reads the club's public Google Calendar (`compneurosociety@gmail.com`, display name "CompNeuroSociety Events") and regenerates `js/calendar-events.js`. **That calendar must be set to "Make available to public"** (Google Calendar → Settings → the calendar → Access permissions) or the unauthenticated fetch 404s. (The old `compneurosociety@outlook.com` feed was dead and replaced in July 2026 — if you ever see stale events, first confirm the calendar is still public.) The `LINKS.calendar` "Google Calendar" button on the events page points at the same calendar. If the fetch fails, the last good data stays live. To give a calendar event a photo, put `#img:<key>` in its description (keys defined in the Python script). Public-repo crons pause after 60 days of inactivity — the workflow re-enables itself (keepalive step), but if events stop updating, check the Actions tab first.

## 4. Google Forms (replaced Microsoft Forms, July 2026)

All six forms are Google Forms owned by the club Google account (**compneurosociety@outlook.com**). Respondent links live in `LINKS` in `site-data.js`; edit links below (must be signed into the club account):

| Form | site-data key | Edit URL |
|---|---|---|
| Membership | `joinForm` | https://docs.google.com/forms/d/1VxOjXcDUwhOaIQC8X9dOZ7PugeFxzMGcO9FnAB9fWUk/edit |
| Team profile | `teamForm` | https://docs.google.com/forms/d/1NZNhKbnuMiy-LcH3GSGCuj9KLKWLudNgcwrCHFE8vN0/edit |
| Project application | `projectForm` + `APPLICATIONS.formUrl` | https://docs.google.com/forms/d/1UOAz5G_RWUvC1qFvwrrfntdT6JQ36zbLiNfH0mJC8t0/edit |
| Mentor interest | `mentorForm` | https://docs.google.com/forms/d/1pNgVDRXsVJA0p4UHoMOaMSMOb1T6z_sX0a-o-hu0w-o/edit |
| Lead an event | `leadEventForm` | https://docs.google.com/forms/d/1ft2jnSgxRGM3_whA-svkl9tDk-EyERtqFxbEClGrhXo/edit |
| Contact | `contactForm` + footer link on all 8 pages | https://docs.google.com/forms/d/1E-x2IsJn9wA6n6PKm35VpYrPzOsKvdJiIz6tx2W7Et4/edit |

Editing questions in the Forms editor is safe — respondent URLs don't change. If you ever **recreate** a form, its URL changes: update `LINKS` (and footers for Contact).

## 5. Response spreadsheet + automations (Apps Script)

All form responses land in one spreadsheet in the club Drive: **"CompNeuroSociety Form Responses"** (tabs: Membership, Team, Project, Mentor, LeadEvent, Contact) — https://docs.google.com/spreadsheets/d/1R9f-qaKS7uED8O9oEP1ISmuJuuXyFB_Rp2acdS5RHYw/edit

Automations run from an **Apps Script project in the club Google account** (script.google.com while signed in as the club → suggest renaming it "CNS Automations"). **Do not delete this project — the triggers live in it.** Installed triggers:

- `onMembershipSubmit` — sends the **welcome email** to every new member (Discord invite + events + projects links). Edit the copy in the `welcomeBody()` function. The email is HTML with the club logo embedded inline via the top-level `logoBlob()` helper — **keep `logoBlob()` and `LOGO_FILE_ID` at the top level of the script.** If they get nested inside another function, `onMembershipSubmit` throws `logoBlob is not defined` and new members silently stop receiving the welcome email. Sending quota: 100/day. Emails send **from compneurosociety@gmail.com** (Gmail was enabled on the club Google account in July 2026 — before that, Apps Script mail bounced through maestro.bounces.google.com and failed safe-sender lists); replies go to the official Outlook inbox via reply-to.
- `onContactSubmit` — forwards contact-form submissions to compneurosociety@outlook.com with reply-to set to the sender.
- `weeklyDigest` — Monday 9:00 AM email summarizing the week's new responses per form.
- `generateTeamCards()` — run manually from the editor: converts Team-tab rows into paste-ready `TEAM` card objects for `site-data.js` (add the photo yourself).
- `setupIntegration()` — one-time setup; safe to re-run (it detects existing triggers and runs a self-test + cleanup instead of duplicating anything).

**Welcome email — "coming up next" teaser.** `onMembershipSubmit` calls `nextEvent_()`, which reads the club's Google Calendar **directly via `CalendarApp`** (the account's own calendars, skipping the "Holidays"/"Birthdays"/etc. defaults) and populates the global `NEXT_EVENT` with the soonest upcoming event before the email is built. So the teaser auto-updates from the calendar — no manual editing of `NEXT_EVENT` needed, and no dependency on a public feed (unlike the website sync, `CalendarApp` reads the calendar with the account's own permission). If there are no upcoming events (or the read fails), `NEXT_EVENT` stays empty and the teaser block is omitted. To feature something, just add it to the club Google Calendar. (`testNextEvent()` in the editor logs the accessible calendars + what it currently resolves to.)

**Unsubscribe (web app).** The script is also deployed as a **web app** (Deploy → Manage deployments) that powers email unsubscribes. Every welcome-email footer carries a signed unsubscribe link (`?e=<email>&t=<HMAC token>` so nobody can unsubscribe someone else). Clicking it runs `doGet`, which records the address on a new **Unsubscribed** tab of the response spreadsheet and shows a branded confirmation page with a re-subscribe link. `onMembershipSubmit` calls `isUnsubscribed(email)` and skips anyone on that list, so opt-outs are honored for all future sends (use the same `isUnsubscribed()` guard + `withUnsub()`/`withUnsubText()` footer helpers for any new bulk email you add). **Required one-time step — set `WEBAPP_URL`.** The unsubscribe link must point at the *published* web-app URL. Do **not** rely on `ScriptApp.getService().getUrl()` alone — in this project it returns the HEAD/dev URL, which 404s for recipients. Fix: Deploy → Manage deployments → copy the **Web app URL** (looks like `https://script.google.com/macros/s/AKfycb…/exec`) and paste it into the `WEBAPP_URL` constant at the top of the unsubscribe section, then Save and redeploy (New version). `webappUrl_()` returns `WEBAPP_URL` when set, so this pins every unsubscribe link to the working endpoint.

- **Web-app code changes need a redeploy** to take effect: Deploy → Manage deployments → edit (pencil) → Version: **New version** → Deploy. (Trigger/email changes take effect on save; only the unsubscribe *page/endpoint* behavior needs the redeploy.)
- **Testing the unsubscribe link:** click Unsubscribe in a welcome email from a browser where the club Google account is the *only* one signed in, or an Incognito window signed in as the club. With multiple Google accounts signed into one browser, Apps Script `/exec` links can show a Google "file does not exist" page — that's an account-routing quirk, not a broken link. A successful click shows the branded page and adds a row to the Unsubscribed tab.

If automations misbehave: script editor → left sidebar → **Executions** shows every trigger run and its error, and failure emails go to the club inbox.

## 6. SEO & analytics

- **Every page's `<head>`** carries a unique `<title>`, `<meta name="description">`, canonical URL, and Open Graph/Twitter tags. When adding a page, copy the head block from `chapters.html` and edit all of these — then **add the page to `sitemap.xml`**.
- **Keep important text in static HTML.** People/events/projects cards, the next-up strip and the home event rows are JS-rendered (fine for Google, invisible to some crawlers/scrapers) — that's why each page has a static intro paragraph. Don't remove those.
- **Nav:** only About / Events / Projects / Join are in the nav (the 2026 redesign). People, Sponsors and Chapters are linked from the About page and the footer of every page; keep it that way rather than growing the nav again.
- **Analytics (GA4 `G-2QT79J734H`).** `site.js` sends well-named GA4 events on the actions that matter (both `data-link` CTAs and plain links): `generate_lead` (any form opened — `form` param says which: membership/team_profile/project_application/mentor_interest/lead_event/contact), `join_group` (Discord), `outbound_click` (Instagram/LinkedIn/FSU HQ), `select_content` (Google Calendar), `contact` (mailto). **In GA4 → Admin → Events, toggle `generate_lead` and `join_group` to "Mark as key event"** — those are your signup/community conversions. Optionally register `form`, `target`, and `cta_id` as custom dimensions (Admin → Custom definitions) to segment by which form/link. Also confirm **Enhanced Measurement** is ON (Admin → Data streams → the web stream) — it auto-tracks scrolls, outbound clicks, and site search with no code.
- **Duplicate-tracking warning — resolve this.** Every page loads **both** a direct GA4 tag (`gtag.js` for `G-2QT79J734H`) **and** Google Tag Manager (`GTM-KGLRCKXQ`). If that GTM container also has a GA4 configuration tag for the same property, page views and events are **counted twice**. Check GTM (tagmanager.google.com → the container → Tags): if its only tag is GA4 for `G-2QT79J734H`, remove the GTM `<script>`/`<noscript>` snippets from the eight pages' `<head>`/`<body>` and keep the direct `gtag.js` (which is what `site.js` events use). If GTM holds *other* tags you rely on, instead delete the direct `gtag.js` config and move GA4 into GTM. Either way, load GA4 **once**.
- **Search Console:** the sitemap is at `https://compneurosociety.com/sitemap.xml` — submit it once under the club's Search Console property.

## 7. Photos — always run the optimizer

Phone and camera photos are 3–13 MB each; nothing on this site is ever displayed larger than ~1600px. Before this was fixed, `people.html` shipped **25.7 MB** (one headshot was 13 MB on its own) — on a phone at the involvement fair, that page effectively doesn't load.

**Whenever you add or replace anything in `images/`:**

```bash
pip install Pillow                              # first time only
python3 scripts/optimize_images.py --dry-run    # see what it would do
python3 scripts/optimize_images.py              # do it
```

It downscales, recompresses, strips EXIF, and keeps the same filenames and formats, so no HTML or JS references change. Full-size originals are copied to `images/_originals/` (git-ignored) the first time each file is touched, so it's safe to re-run and nothing is lost. Size limits live in the `RULES` list at the top of the script — roughly 2x the largest displayed size, per folder:

| Path | Limit | Why |
|---|---|---|
| `images/logo.jpeg` | 400px | 40px in the nav, but also the `og:image` social preview |
| `images/ORCA.png` | 400px | 180px on sponsors.html |
| `images/projects/*` | 1600px | opened full-screen in the project photo viewer |
| `images/members/*` | 600px | 190–240px tall cards |
| everything else | 900px | headshots and event flyers |

All JS-rendered images (people, events, projects, gallery thumbs) plus the ORCA logo carry `loading="lazy"` so they only download when scrolled into view. Layout shift is already handled — `warm-lab.css` fixes explicit dimensions on every image.

**Still outstanding:** `brain_model.glb` is **1.7 MB** and loads on the homepage (the hero iframe is in the viewport, so `loading="lazy"` doesn't defer it). The optimizer doesn't touch 3D models. Options if you want the homepage faster: decimate the mesh, Draco-compress the glTF, or gate the viewer behind a tap on mobile. (The three largest headshots were run through the optimizer in Oct 2026 — 4.5 MB, 5.7 MB and 1.1 MB files are now under 150 KB each — because the home page now shows them as avatars.)

## 8. New webmaster access checklist

GitHub repo admin (CompNeuroSociety org) · club Google account (compneurosociety@outlook.com — owns forms, spreadsheet, Apps Script, calendar) · club Outlook inbox (same address — receives alerts/digests) · GA4 property + Search Console · domain DNS (CNAME for compneurosociety.com) · Discord server admin · Instagram/LinkedIn credentials.

## 9. Known issues / TODO

- `about.html` links to `constitution.pdf` (the "Constitution" tab from the redesign wireframes), which is **not in the repo** (404) — add the PDF, or delete the `#constitution` section in `about.html` and the tab link above it.
- Old Microsoft Forms are still open — close them in the club Microsoft account so responses don't split.
- `GRAD_COUNCIL` is commented out in `site-data.js` (section auto-hides).
- Nice-to-have: pre-render people/projects/events cards into static HTML at build time for non-Google crawlers.
- `brain_model.glb` (1.7 MB) still loads on the homepage — see the note at the end of §7.
- No custom `404.html`.
- The footer's Discord link and the JSON-LD on the home page now use `LINKS.discord` (`discord.gg/sfm2RPd3gH`); the old hard-coded footers pointed at a different invite (`6ujAmEEChC`). If that older invite is the one you want, change `LINKS.discord` once.
