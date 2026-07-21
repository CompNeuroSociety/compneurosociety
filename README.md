# compneurosociety.com — webmaster guide

Static site for CompNeuroSociety at FSU. No build step, no framework: plain HTML/CSS/JS served by **GitHub Pages** at the custom domain **compneurosociety.com** (set via `CNAME`). Pushing to the default branch deploys the site — that's the whole release process.

> **The one file you edit day-to-day is `js/site-data.js`.** Events, people, projects, and every external link live there. Most updates never touch HTML.

---

## 1. Repo map

| Path | What it is |
|---|---|
| `index.html` | Home — hero, 3D EEG brain (iframe), stats, auto-updating event cards |
| `about.html` | Mission, what is comp-neuro, constitution panel, FSU×FIU panel |
| `people.html` | Leadership, grad council, mentors, team (rendered from site-data) |
| `events.html` | Spotlight + full timeline (auto-merged with Google Calendar) |
| `projects.html` | Current + past project teams |
| `join.html` | 3-step join flow (form → FSU HQ → Discord) |
| `sponsors.html` | Sponsors + become-a-sponsor CTA |
| `chapters.html` | FSU×FIU chapter partnership + start-a-chapter CTA |
| `brain-viz.html` | The 3D brain iframe (three.js; loads `brain_model.obj` + `white.jpg`) |
| `css/warm-lab.css` | Entire design system (design tokens at the top) |
| `js/site-data.js` | ★ All content + links. Edit this. Instructions in its header comment |
| `js/site.js` | Renders site-data into pages, mobile menu, GA4 conversion events |
| `js/calendar-events.js` | **Generated — do not edit.** Auto-synced from Google Calendar |
| `scripts/fetch_calendar_events.py` | Generator for the above (stdlib-only Python) |
| `.github/workflows/refresh-events.yml` | Runs the sync every 6h + on demand |
| `robots.txt`, `sitemap.xml` | Crawler config — **add new pages to the sitemap** |
| `images/` | All images (member photos in `images/members/`) |

`README-REDESIGN.md` is a historical note from the 2025 redesign; this file supersedes it.

## 2. Routine updates (all in `js/site-data.js`)

**Add an event:** add an object to the top of `EVENTS` (`title`, `date` as `"YYYY-MM-DDTHH:MM"`, `location`, `blurb`, optional `image`). Home + events pages sort, count down, and archive automatically. Events also flow in from the club's public Google Calendar every 6 hours (see §3) — entries here win over calendar duplicates on the same day, so use this list for curated blurbs/photos.

**Add/edit people:** edit `LEADERSHIP`, `GRAD_COUNCIL` (currently commented out — uncomment to show the section), `MENTORS`, or `TEAM`. Put photos in `images/` first. Team-form responses can be converted to paste-ready card objects automatically — see `generateTeamCards()` in §5.

**Projects:** set `CURRENT_PROJECT` to an object to feature an active team, or `null` to show the "forming soon" placeholder. `APPLICATIONS.open` (true/false) flips the apply button; `closedNote` is the message shown when closed. Past teams go in `PAST_PROJECTS`.

**Links:** every form/social/external URL is a key in `LINKS`. HTML elements use `data-link="key"` and get hydrated by `site.js` — change the URL once in `LINKS` and every page updates. (Exception: the footer Contact link is hardcoded in each HTML file's footer — update all 8 if it ever changes.)

**Deploy:** commit → push to the default branch → GitHub Pages rebuilds (usually <1 min).

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
- **Keep important text in static HTML.** People/events/projects cards are JS-rendered (fine for Google, invisible to some crawlers/scrapers) — that's why each page has a static intro paragraph. Don't remove those.
- **Analytics:** GA4 (`G-2QT79J734H`) + GTM (`GTM-KGLRCKXQ`) load on every page. `site.js` fires a `cta_click` event (with `cta_id`) on every `data-link` CTA and footer link — mark it as a key event in GA4 to track signups from search.
- **Search Console:** the sitemap is at `https://compneurosociety.com/sitemap.xml` — submit it once under the club's Search Console property.

## 7. New webmaster access checklist

GitHub repo admin (CompNeuroSociety org) · club Google account (compneurosociety@outlook.com — owns forms, spreadsheet, Apps Script, calendar) · club Outlook inbox (same address — receives alerts/digests) · GA4 property + Search Console · domain DNS (CNAME for compneurosociety.com) · Discord server admin · Instagram/LinkedIn credentials.

## 8. Known issues / TODO

- `about.html` links to `constitution.pdf`, which is **not in the repo** (404) — add the PDF or remove the panel.
- Old Microsoft Forms are still open — close them in the club Microsoft account so responses don't split.
- `GRAD_COUNCIL` is commented out in `site-data.js` (section auto-hides).
- Nice-to-have: pre-render people/projects/events cards into static HTML at build time for non-Google crawlers.
