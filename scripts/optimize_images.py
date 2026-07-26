#!/usr/bin/env python3
"""Resize and recompress the images in images/ so pages stop shipping megabytes.

Why this exists: photos come off phones and cameras at 4000px / 10+ MB, but the
site never displays anything larger than ~1600px. Before this script ran,
people.html shipped about 25 MB (one headshot alone was 13 MB).

What it does, in place, keeping the same filenames and formats so no HTML/JS
references need to change:
  * downscales anything wider/taller than the limit for its folder (below)
  * recompresses (JPEG quality 82 progressive, PNG optimized)
  * strips camera EXIF
  * backs the original up to images/_originals/ the first time it touches a file,
    so re-running is safe and nothing is lost
  * keeps the original if "optimizing" would somehow make the file bigger

Limits are ~2x the largest size each image is actually displayed at, which
covers high-DPI screens. Sources: css/warm-lab.css.

Usage:
    pip install Pillow
    python3 scripts/optimize_images.py --dry-run   # report only, change nothing
    python3 scripts/optimize_images.py             # do it

Originals stay in images/_originals/ (git-ignored below). Delete that folder
once you are happy with the results, or keep it as an archive of the full-size
photos - just don't reference it from the site.
"""
import argparse
import shutil
import sys
from fnmatch import fnmatch
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "images"
BACKUP = IMAGES / "_originals"

# (glob relative to images/, max pixels on the longest side)
# First match wins, so most specific patterns go first.
RULES = [
    ("logo.jpeg", 400),      # 40px in the nav, but also the og:image social preview
    ("ORCA.png", 400),       # 180px on sponsors.html
    ("projects/*", 1600),    # opened full-screen in the project photo viewer
    ("members/*", 600),      # 190-240px tall cards
    ("*", 900),              # headshots and event flyers
]

SKIP_SUFFIXES = {".svg", ".ico", ".obj", ".webmanifest"}
JPEG_QUALITY = 82


def limit_for(rel: Path) -> int:
    posix = rel.as_posix()
    for pattern, limit in RULES:
        if fnmatch(posix, pattern) or fnmatch(rel.name, pattern):
            return limit
    return 900


def human(n: int) -> str:
    return f"{n / 1048576:.2f} MB" if n >= 1048576 else f"{n / 1024:.0f} KB"


def process(path: Path, dry_run: bool) -> tuple[int, int]:
    """Returns (bytes_before, bytes_after)."""
    rel = path.relative_to(IMAGES)
    before = path.stat().st_size
    limit = limit_for(rel)

    with Image.open(path) as im:
        im.load()
        w, h = im.size
        fmt = (im.format or "").upper()
        scale = min(1.0, limit / max(w, h))
        new_size = (max(1, round(w * scale)), max(1, round(h * scale)))

        if dry_run:
            note = f"{w}x{h} -> {new_size[0]}x{new_size[1]}" if scale < 1 else f"{w}x{h} (recompress)"
            print(f"  {rel.as_posix():<38} {human(before):>9}   {note}")
            return before, before

        out = im.resize(new_size, Image.LANCZOS) if scale < 1 else im.copy()

        # Back the original up once, before the first overwrite.
        dest = BACKUP / rel
        if not dest.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, dest)

        tmp = path.with_suffix(path.suffix + ".tmp")
        if fmt in ("JPEG", "MPO"):
            out.convert("RGB").save(tmp, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
        elif fmt == "PNG":
            # Palette-ise flat graphics (logos) but keep transparency intact.
            out.save(tmp, "PNG", optimize=True)
        else:
            out.save(tmp, fmt or path.suffix.lstrip(".").upper())

    after = tmp.stat().st_size
    if after < before:
        tmp.replace(path)
    else:
        tmp.unlink()
        after = before
        print(f"  {rel.as_posix():<38} kept original (already small)")
    return before, after


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="report sizes without changing files")
    args = ap.parse_args()

    if not IMAGES.is_dir():
        sys.exit(f"no images/ directory at {IMAGES}")

    files = sorted(
        p for p in IMAGES.rglob("*")
        if p.is_file()
        and BACKUP not in p.parents
        and p.suffix.lower() not in SKIP_SUFFIXES
    )
    if not files:
        sys.exit("no images found")

    print(f"{'DRY RUN - ' if args.dry_run else ''}{len(files)} images in {IMAGES}\n")
    total_before = total_after = 0
    for path in files:
        try:
            before, after = process(path, args.dry_run)
        except Exception as exc:  # a corrupt or unsupported file shouldn't stop the run
            print(f"  {path.relative_to(IMAGES).as_posix():<38} SKIPPED ({exc})")
            continue
        total_before += before
        total_after += after
        if not args.dry_run and after < before:
            print(f"  {path.relative_to(IMAGES).as_posix():<38} {human(before):>9} -> {human(after):>9}")

    print(f"\ntotal: {human(total_before)} -> {human(total_after)}", end="")
    if total_before:
        print(f"  ({100 * (total_before - total_after) / total_before:.0f}% smaller)")
    if not args.dry_run:
        print(f"originals backed up in {BACKUP.relative_to(ROOT).as_posix()}/")


if __name__ == "__main__":
    main()
