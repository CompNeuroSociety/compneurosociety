#!/usr/bin/env python3
"""Sync events from the club's public Google Calendar into js/calendar-events.js.

Fetches the public ICS feed (no API key needed), converts each event to the
site's EVENTS shape ({title, date "YYYY-MM-DDTHH:MM" ET, location, blurb, image})
and writes js/calendar-events.js. Hard-coded events in js/site-data.js always
stay; js/site.js merges the two lists and drops calendar entries that duplicate
a hard-coded one (same day + similar title).

Images: calendars have no image field. Put a tag like  #img:python  anywhere in
the event's description in Google Calendar; it maps through IMG_MAP below to a
file in images/. No tag (or unknown key) -> images/placeholder.png.

Run locally or in CI (stdlib only):  python3 scripts/fetch_calendar_events.py
"""
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

# --- Config -----------------------------------------------------------------
FEED_URL = ("https://calendar.google.com/calendar/ical/"
            "compneurosociety%40outlook.com/public/basic.ics")
LOCAL_TZ = ZoneInfo("America/New_York")
OUT_PATH = Path(__file__).resolve().parent.parent / "js" / "calendar-events.js"
IMAGES_DIR = Path(__file__).resolve().parent.parent / "images"

# Calendar entries whose title matches any of these are not club events
# (academic-calendar markers) and are skipped. Case-insensitive.
EXCLUDE_TITLES = [
    r"^no class(es)?\b",
    r"^fsu classes (begin|end)\b",
]

# #img:<key> -> local image. Add keys here as the club adds flyers to images/.
IMG_MAP = {
    "gbm": "images/gbm.png",
    "python": "images/python_coded.jpg",
    "ml": "images/mlworkshop.jpg",
    "pena": "images/PenaWorkshopWebsiteFlyer.png",
    "devon": "images/devonworkshop.jpg",
}
PLACEHOLDER = "images/placeholder.png"

ALL_DAY_DEFAULT_TIME = "18:00"   # site needs a time; club events are evenings
PAST_WINDOW_DAYS = 400           # keep up to ~1 academic year of history
FETCH_ATTEMPTS = 3

# --- Minimal RFC 5545 parsing (only what Google's basic.ics uses) ------------

def unfold(text):
    """Join folded lines: CRLF followed by a space/tab continues the line."""
    lines, out = text.replace("\r\n", "\n").split("\n"), []
    for line in lines:
        if line[:1] in (" ", "\t") and out:
            out[-1] += line[1:]
        else:
            out.append(line)
    return out


def split_unquoted(text, sep):
    """Split on sep, ignoring separators inside double-quoted spans."""
    parts, buf, in_quotes = [], [], False
    for ch in text:
        if ch == '"':
            in_quotes = not in_quotes
        if ch == sep and not in_quotes:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    parts.append("".join(buf))
    return parts


def parse_prop(line):
    """'DTSTART;TZID=America/New_York:20260209T180000' -> (name, params, value)."""
    i, in_quotes = 0, False
    for i, ch in enumerate(line):
        if ch == '"':
            in_quotes = not in_quotes
        elif ch == ":" and not in_quotes:
            break
    else:
        return None
    head, value = line[:i], line[i + 1:]
    parts = split_unquoted(head, ";")
    name, params = parts[0].upper(), {}
    for p in parts[1:]:
        if "=" in p:
            k, v = p.split("=", 1)
            params[k.upper()] = v.strip('"')
    return name, params, value


def unescape_text(value):
    """RFC 5545 TEXT: \\n newline, \\, comma, \\; semicolon, \\\\ backslash."""
    out, i = [], 0
    while i < len(value):
        if value[i] == "\\" and i + 1 < len(value):
            nxt = value[i + 1]
            out.append("\n" if nxt in "nN" else nxt)
            i += 2
        else:
            out.append(value[i])
            i += 1
    return "".join(out)


def parse_events(ics_text):
    """Return a list of {name: (params, value)} dicts, one per VEVENT."""
    events, cur = [], None
    for line in unfold(ics_text):
        if line == "BEGIN:VEVENT":
            cur = {}
        elif line == "END:VEVENT":
            if cur is not None:
                events.append(cur)
            cur = None
        elif cur is not None:
            prop = parse_prop(line)
            if prop:
                name, params, value = prop
                if name == "EXDATE":  # can repeat; each may hold several dates
                    cur.setdefault("EXDATE", []).append((params, value))
                else:
                    cur.setdefault(name, (params, value))
    return events


def drop_overridden_masters(vevents):
    """A recurring master contributes only its first occurrence (its DTSTART).
    If that occurrence was edited in Google Calendar, the feed also carries a
    RECURRENCE-ID override VEVENT for it — drop the master so the stale
    original slot and the edited event don't both publish."""
    overrides = {}
    for v in vevents:
        if "RECURRENCE-ID" in v and "UID" in v:
            parsed = parse_start(*v["RECURRENCE-ID"])
            if parsed:
                overrides.setdefault(v["UID"][1], set()).add(parsed[0])
    kept = []
    for v in vevents:
        if "RRULE" in v and "RECURRENCE-ID" not in v and "UID" in v and "DTSTART" in v:
            parsed = parse_start(*v["DTSTART"])
            if parsed and parsed[0] in overrides.get(v["UID"][1], set()):
                continue
        kept.append(v)
    return kept


def parse_start(params, value):
    """DTSTART -> (aware datetime in ET, is_all_day). None if unparseable."""
    value = value.strip()
    try:
        if params.get("VALUE") == "DATE" or re.fullmatch(r"\d{8}", value):
            d = datetime.strptime(value, "%Y%m%d")
            return d.replace(tzinfo=LOCAL_TZ), True
        if value.endswith("Z"):
            d = datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
            return d.astimezone(LOCAL_TZ), False
        d = datetime.strptime(value, "%Y%m%dT%H%M%S")
        try:
            tz = ZoneInfo(params.get("TZID", "America/New_York"))
        except Exception:
            tz = LOCAL_TZ
        return d.replace(tzinfo=tz).astimezone(LOCAL_TZ), False
    except ValueError:
        return None


# --- Transform to the site's EVENTS shape ------------------------------------

TAG_RE = re.compile(r"#img:([a-z0-9_-]+)", re.IGNORECASE)
HTML_RE = re.compile(r"<[^>]+>")


def clean_text(s):
    # NOTE: no HTML stripping here — SUMMARY/LOCATION are plain text and may
    # legitimately contain '<'/'>' (e.g. "p < 0.05"); only descriptions carry
    # HTML, stripped explicitly on the blurb path below.
    return re.sub(r"\s+", " ", s or "").strip()


def pick_image(description):
    m = TAG_RE.search(description or "")
    path = IMG_MAP.get(m.group(1).lower()) if m else None
    if path is None:
        return PLACEHOLDER
    # image is interpolated unescaped into HTML downstream: whitelist the path,
    # and fall back if the mapped file was removed from the repo.
    if not re.fullmatch(r"images/[A-Za-z0-9_.-]+", path):
        return PLACEHOLDER
    if not (IMAGES_DIR / Path(path).name).exists():
        print(f"warning: {path} not found in images/, using placeholder", file=sys.stderr)
        return PLACEHOLDER
    return path


def to_site_event(vevent):
    params, status = vevent.get("STATUS", ({}, ""))
    if status.upper() == "CANCELLED":
        return None
    title = clean_text(unescape_text(vevent.get("SUMMARY", ({}, ""))[1]))
    if not title:
        return None
    for pat in EXCLUDE_TITLES:
        if re.search(pat, title, re.IGNORECASE):
            return None
    if "DTSTART" not in vevent:
        return None
    parsed = parse_start(*vevent["DTSTART"])
    if parsed is None:
        return None
    start, all_day = parsed
    # A deleted single occurrence of a recurring series arrives as an EXDATE on
    # the master; suppress the first occurrence if it's the one deleted.
    for ex_params, ex_value in vevent.get("EXDATE", []):
        for one in ex_value.split(","):
            parsed_ex = parse_start(ex_params, one)
            if parsed_ex and parsed_ex[0] == start:
                return None
    date = start.strftime(f"%Y-%m-%dT{ALL_DAY_DEFAULT_TIME}" if all_day else "%Y-%m-%dT%H:%M")

    description = unescape_text(vevent.get("DESCRIPTION", ({}, ""))[1])
    blurb = clean_text(TAG_RE.sub("", HTML_RE.sub(" ", description)))
    location = clean_text(unescape_text(vevent.get("LOCATION", ({}, ""))[1])) or "TBA"
    return {
        "title": title,
        "date": date,
        "location": location,
        "blurb": blurb,
        "image": pick_image(description),
    }


# --- Main ---------------------------------------------------------------------

def fetch(url):
    last_err = None
    for attempt in range(1, FETCH_ATTEMPTS + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "compneurosociety-site-sync/1.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except Exception as e:  # noqa: BLE001 - retry any transport error
            last_err = e
            if attempt < FETCH_ATTEMPTS:
                time.sleep(5 * attempt)
    raise SystemExit(f"error: could not fetch calendar feed after {FETCH_ATTEMPTS} attempts: {last_err}")


def main():
    ics = fetch(FEED_URL)
    if "BEGIN:VCALENDAR" not in ics:
        raise SystemExit("error: response is not an ICS feed; refusing to write")
    vevents = parse_events(ics)
    if not vevents:
        raise SystemExit("error: feed parsed to 0 VEVENTs; refusing to write")

    # NOTE on recurring events: the master VEVENT contributes its first
    # occurrence (DTSTART) and each edited occurrence arrives as its own
    # VEVENT (RECURRENCE-ID override). Unedited later occurrences are not
    # expanded — edit an occurrence in Google Calendar to surface it here.
    events = [e for e in (to_site_event(v) for v in drop_overridden_masters(vevents)) if e]

    cutoff = (datetime.now(LOCAL_TZ) - timedelta(days=PAST_WINDOW_DAYS)).strftime("%Y-%m-%dT%H:%M")
    # Composite key: Google's feed order is unstable between fetches, so ties
    # must break deterministically or the cron commits spurious reorders.
    events = sorted((e for e in events if e["date"] >= cutoff),
                    key=lambda e: (e["date"], e["title"], e["location"]), reverse=True)
    if not events:
        print("warning: no events left after filtering; writing empty list", file=sys.stderr)

    body = ",\n".join("  " + json.dumps(e, ensure_ascii=True) for e in events)
    OUT_PATH.write_text(
        "// AUTO-GENERATED by scripts/fetch_calendar_events.py — do not edit by hand.\n"
        "// Synced from the club's public Google Calendar; merged with the\n"
        "// hard-coded EVENTS in site-data.js by js/site.js (hard-coded wins).\n"
        f"export const CALENDAR_EVENTS = [\n{body}\n];\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT_PATH.relative_to(Path.cwd()) if OUT_PATH.is_relative_to(Path.cwd()) else OUT_PATH} "
          f"({len(events)} events from {len(vevents)} calendar entries)")


if __name__ == "__main__":
    main()
