#!/usr/bin/env python3
"""
Personal-use GSMArena archiver for AetherPhone.

Stores everything in a local SQLite database (data/aetherphone.sqlite) and a
gzip cache of raw pages (data/raw/). Nothing here is meant to be published:
the terms of use allow personal, non-commercial use only.

Commands
  brands               list brands from makers.php3
  discover [--brand]   list every device URL per brand (new phones appear here)
  fetch [--limit N]    download + parse device pages not yet fetched, or stale ones
  update               discover + fetch stale pages (the periodic refresh)
  sample URL [...]     fetch and print parsed output WITHOUT touching the database
  import --source S --file F   load a licensed/manual JSON dump (merged by priority)
  export               merge all sources, write data/export/devices.json + photos
  status               counts and last-run times

The crawler is resumable: every step is recorded in the database, so an
interrupted run continues where it stopped.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import os
import random
import re
import sqlite3
import sys
import time
import urllib.robotparser
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from merge import device_key, merge_records
from parse import DEVICE_URL_RE, find_image_url, parse_device_html

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DB_PATH = DATA / "aetherphone.sqlite"
RAW_DIR = DATA / "raw"
EXPORT_DIR = DATA / "export"
IMAGE_DIR = DATA / "images"

BASE = "https://www.gsmarena.com/"
MAKERS_URL = urljoin(BASE, "makers.php3")
BRAND_RE = re.compile(r"^([a-z0-9-]+)-phones-(\d+)\.php$")

# Politeness: never faster than this, plus jitter. GSMArena's robots.txt sets no
# crawl-delay for '*', so we choose a conservative default ourselves.
MIN_DELAY_S = max(5.0, float(os.environ.get("CRAWL_DELAY", "5")))  # 5 s is a hard floor
MAX_ERRORS_IN_A_ROW = 5
IMAGE_DELAY_S = 2.0  # images are on a CDN; still spaced out
CONTACT = os.environ.get("CRAWL_CONTACT", "personal-use")
USER_AGENT = f"AetherPhone-personal-archive/0.1 (personal, non-commercial; contact: {CONTACT})"

SCHEMA = """
CREATE TABLE IF NOT EXISTS brands (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  listed_at TEXT
);
CREATE TABLE IF NOT EXISTS devices (
  gsm_id INTEGER PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  brand_slug TEXT,
  discovered_at TEXT NOT NULL,
  fetched_at TEXT,
  content_hash TEXT,
  changed_at TEXT,
  http_status INTEGER,
  parse_ok INTEGER DEFAULT 0,
  normalized_json TEXT,
  raw_path TEXT
);
CREATE INDEX IF NOT EXISTS devices_brand ON devices(brand_slug);
CREATE TABLE IF NOT EXISTS records (
  source TEXT NOT NULL,
  source_key TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  year INTEGER,
  url TEXT,
  fetched_at TEXT,
  normalized_json TEXT NOT NULL,
  PRIMARY KEY (source, source_key)
);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  note TEXT
);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    DATA.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    # Migrations for databases created before a column existed.
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(devices)")}
    if "image_path" not in cols:
        conn.execute("ALTER TABLE devices ADD COLUMN image_path TEXT")
    return conn


class Polite:
    """HTTP session that honours robots.txt, spaces requests, and backs off on errors."""

    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "en"})
        self.last_request = 0.0
        self.errors_in_a_row = 0
        self.robots = urllib.robotparser.RobotFileParser()
        self.robots.set_url(urljoin(BASE, "robots.txt"))
        self.robots.read()

    def allowed(self, url: str) -> bool:
        return self.robots.can_fetch(USER_AGENT, url) or self.robots.can_fetch("*", url)

    def _space(self, min_delay: float) -> None:
        wait = min_delay + random.uniform(0, 2) - (time.monotonic() - self.last_request)
        if wait > 0:
            time.sleep(wait)
        self.last_request = time.monotonic()

    def get_bytes(self, url: str) -> bytes | None:
        """Binary download (images). Spaced like page requests; None if unavailable."""
        self._space(IMAGE_DELAY_S)
        try:
            res = self.session.get(url, timeout=30)
        except requests.RequestException:
            return None
        return res.content if res.status_code == 200 else None

    def get(self, url: str) -> tuple[int, str]:
        if not self.allowed(url):
            raise PermissionError(f"robots.txt disallows {url}")
        for attempt in range(4):
            self._space(MIN_DELAY_S)
            try:
                res = self.session.get(url, timeout=30)
            except requests.RequestException as exc:
                self._note_error(f"network error on {url}: {exc}")
                time.sleep(30 * (attempt + 1))
                continue
            if res.status_code in (429, 503):
                self._note_error(f"HTTP {res.status_code} on {url}; backing off")
                time.sleep(120 * (attempt + 1))
                continue
            self.errors_in_a_row = 0
            return res.status_code, res.text
        raise RuntimeError(f"giving up on {url} after repeated throttling")

    def _note_error(self, msg: str) -> None:
        self.errors_in_a_row += 1
        print(f"  ! {msg}", file=sys.stderr)
        if self.errors_in_a_row >= MAX_ERRORS_IN_A_ROW:
            raise RuntimeError("too many consecutive errors; stopping to be polite. Re-run later.")


def save_raw(gsm_id: int, html: str) -> str:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / f"{gsm_id}.html.gz"
    with gzip.open(path, "wt", encoding="utf-8") as fh:
        fh.write(html)
    return str(path.relative_to(DATA))


def save_image(gsm_id: int, data: bytes) -> str | None:
    """Convert a photo to a small WebP (personal archive size); return its path under data/."""
    from PIL import Image  # lazy: the rest of the tool works without Pillow

    try:
        im = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:  # not an image we can read
        return None
    im.thumbnail((640, 640))
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    path = IMAGE_DIR / f"{gsm_id}.webp"
    im.save(path, "WEBP", quality=82, method=4)
    return str(path.relative_to(DATA))


def gsm_id_from_url(url: str) -> int | None:
    m = re.search(r"-(\d+)\.php$", urlparse(url).path)
    return int(m.group(1)) if m else None


# ---------------------------------------------------------------- commands

def cmd_brands(conn: sqlite3.Connection, http: Polite, _args) -> None:
    status, html = http.get(MAKERS_URL)
    soup = BeautifulSoup(html, "html.parser")
    found = 0
    for a in soup.find_all("a", href=True):
        href = a["href"].split("/")[-1]
        m = BRAND_RE.match(href)
        if not m:
            continue
        slug = m.group(1)
        name = a.get_text(" ", strip=True) or slug.replace("-", " ").title()
        conn.execute(
            "INSERT INTO brands(slug, name, url) VALUES(?,?,?) "
            "ON CONFLICT(slug) DO UPDATE SET name=excluded.name, url=excluded.url",
            (slug, name, urljoin(BASE, href)),
        )
        found += 1
    conn.commit()
    print(f"brands: {found} listed (HTTP {status})")


def _brand_pages(soup: BeautifulSoup, slug: str, first_url: str) -> list[str]:
    urls = {first_url}
    for a in soup.find_all("a", href=True):
        href = a["href"].split("/")[-1]
        if re.match(rf"^{re.escape(slug)}-phones-\d+-p\d+\.php$", href):
            urls.add(urljoin(BASE, href))
    return sorted(urls)


def cmd_discover(conn: sqlite3.Connection, http: Polite, args) -> None:
    query = "SELECT slug, url FROM brands"
    params: tuple = ()
    if args.brand:
        query += " WHERE slug = ?"
        params = (args.brand,)
    brands = conn.execute(query + " ORDER BY slug", params).fetchall()
    if not brands:
        raise SystemExit("No brands yet. Run: python crawl.py brands")
    total_new = 0
    for b in brands:
        pages = [b["url"]]
        seen_pages = set()
        new_here = 0
        while pages:
            page = pages.pop(0)
            if page in seen_pages:
                continue
            seen_pages.add(page)
            status, html = http.get(page)
            if status != 200:
                print(f"  {b['slug']}: HTTP {status} on {page}", file=sys.stderr)
                continue
            soup = BeautifulSoup(html, "html.parser")
            scope = soup.select_one(".makers") or soup
            for a in scope.find_all("a", href=True):
                name = a["href"].split("/")[-1]
                if "-phones-" in name or not DEVICE_URL_RE.match(name):
                    continue
                url = urljoin(BASE, name)
                gid = gsm_id_from_url(url)
                if gid is None:
                    continue
                cur = conn.execute(
                    "INSERT OR IGNORE INTO devices(gsm_id, url, brand_slug, discovered_at) VALUES(?,?,?,?)",
                    (gid, url, b["slug"], now_iso()),
                )
                new_here += cur.rowcount
            for nxt in _brand_pages(soup, b["slug"], b["url"]):
                if nxt not in seen_pages and nxt not in pages:
                    pages.append(nxt)
            conn.commit()
        conn.execute("UPDATE brands SET listed_at=? WHERE slug=?", (now_iso(), b["slug"]))
        conn.commit()
        total_new += new_here
        print(f"  {b['slug']}: {new_here} new device URLs")
    print(f"discover: {total_new} new device URLs in total")


def cmd_fetch(conn: sqlite3.Connection, http: Polite, args) -> None:
    max_age = timedelta(days=args.max_age_days)
    cutoff = (datetime.now(timezone.utc) - max_age).isoformat(timespec="seconds")
    rows = conn.execute(
        "SELECT gsm_id, url, brand_slug FROM devices "
        "WHERE fetched_at IS NULL OR fetched_at < ? OR http_status IS NULL "
        "ORDER BY fetched_at IS NOT NULL, gsm_id LIMIT ?",
        (cutoff, args.limit),
    ).fetchall()
    if not rows:
        print("fetch: nothing to do")
        return
    print(f"fetch: {len(rows)} page(s); about {len(rows) * MIN_DELAY_S / 3600:.1f} h at {MIN_DELAY_S:.0f}s spacing")
    ok = changed = 0
    for i, row in enumerate(rows, 1):
        brand = _brand_name(conn, row["brand_slug"])
        try:
            status, html = http.get(row["url"])
        except RuntimeError as exc:
            print(f"stopping: {exc}", file=sys.stderr)
            break
        fetched = now_iso()
        if status != 200:
            conn.execute("UPDATE devices SET http_status=?, fetched_at=? WHERE gsm_id=?", (status, fetched, row["gsm_id"]))
            conn.commit()
            continue
        parsed = parse_device_html(html, row["url"], brand=brand)
        normalized = parsed.normalized
        normalized["source_url"] = row["url"]
        image_path = None
        img_url = find_image_url(html, row["url"])
        if img_url and not args.no_images:
            data = http.get_bytes(img_url)
            image_path = save_image(row["gsm_id"], data) if data else None
        if image_path:
            normalized["image_url"] = img_url
        digest = hashlib.sha256(json.dumps(normalized, sort_keys=True).encode()).hexdigest()
        prev = conn.execute("SELECT content_hash FROM devices WHERE gsm_id=?", (row["gsm_id"],)).fetchone()
        is_change = prev is None or prev["content_hash"] != digest
        raw_path = save_raw(row["gsm_id"], html)
        conn.execute(
            "UPDATE devices SET http_status=200, fetched_at=?, content_hash=?, "
            "changed_at = CASE WHEN ? THEN ? ELSE changed_at END, parse_ok=?, normalized_json=?, raw_path=?, "
            "image_path=COALESCE(?, image_path) WHERE gsm_id=?",
            (
                fetched, digest, int(is_change), fetched, int(bool(parsed.name and normalized.get("year"))),
                json.dumps({"name": parsed.name, "raw": [r.__dict__ for r in parsed.raw], "device": normalized}, ensure_ascii=False),
                raw_path, image_path, row["gsm_id"],
            ),
        )
        conn.commit()
        ok += 1
        changed += int(is_change)
        if i % 25 == 0:
            print(f"  {i}/{len(rows)} done ({changed} new or changed)")
    print(f"fetch: {ok} stored, {changed} new or changed")


def _brand_name(conn: sqlite3.Connection, slug: str | None) -> str | None:
    if not slug:
        return None
    row = conn.execute("SELECT name FROM brands WHERE slug=?", (slug,)).fetchone()
    return row["name"] if row else None


def cmd_update(conn: sqlite3.Connection, http: Polite, args) -> None:
    cmd_discover(conn, http, argparse.Namespace(brand=None))
    cmd_fetch(conn, http, argparse.Namespace(limit=args.limit, max_age_days=args.max_age_days, no_images=args.no_images))


def cmd_sample(conn: sqlite3.Connection, http: Polite, args) -> None:
    for url in args.urls:
        if args.file:
            html = Path(url).read_text(encoding="utf-8")
        else:
            status, html = http.get(url)
            print(f"# HTTP {status} {url}")
        brand = args.brand
        parsed = parse_device_html(html, url, brand=brand)
        print(json.dumps(parsed.normalized, indent=2, ensure_ascii=False))
        print(f"# {len(parsed.raw)} raw spec rows")


def cmd_import(conn: sqlite3.Connection, _http, args) -> None:
    """Load a licensed or hand-made dump: a JSON array of devices in the app schema."""
    entries = json.loads(Path(args.file).read_text(encoding="utf-8"))
    n = 0
    for e in entries:
        if not (e.get("brand") and e.get("model") and e.get("year")):
            print(f"  skipped (needs brand, model, year): {e.get('model')}", file=sys.stderr)
            continue
        key = device_key(e["brand"], e["model"])
        conn.execute(
            "INSERT INTO records(source, source_key, brand, model, year, url, fetched_at, normalized_json) "
            "VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(source, source_key) DO UPDATE SET "
            "brand=excluded.brand, model=excluded.model, year=excluded.year, url=excluded.url, "
            "fetched_at=excluded.fetched_at, normalized_json=excluded.normalized_json",
            (args.source, key, e["brand"], e["model"], e["year"], e.get("source_url"), now_iso(), json.dumps(e, ensure_ascii=False)),
        )
        n += 1
    conn.commit()
    print(f"import: {n} record(s) from source '{args.source}'")


def cmd_export(conn: sqlite3.Connection, _http, args) -> None:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    img_out = EXPORT_DIR / "img"
    img_out.mkdir(parents=True, exist_ok=True)

    groups: dict[str, list[tuple[str, dict]]] = {}
    gsm_info: dict[str, dict] = {}
    for r in conn.execute("SELECT gsm_id, url, fetched_at, normalized_json, image_path FROM devices WHERE parse_ok=1"):
        dev = json.loads(r["normalized_json"])["device"]
        brand, model = dev.get("brand"), dev.get("model")
        if not (brand and model and dev.get("year")):
            continue
        key = device_key(brand, model)
        gsm_url = dev.pop("source_url", None)
        dev.pop("image_url", None)
        groups.setdefault(key, []).append(("gsmarena", dev))
        gsm_info[key] = {"gid": r["gsm_id"], "url": gsm_url, "fetched": r["fetched_at"], "image": r["image_path"]}

    for r in conn.execute("SELECT source, source_key, normalized_json FROM records"):
        groups.setdefault(r["source_key"], []).append((r["source"], json.loads(r["normalized_json"])))

    priority = args.priority.split(",") if args.priority else None
    devices = []
    for key, records in groups.items():
        merged, prov = merge_records(records, priority=priority)
        info = gsm_info.get(key, {})
        gid = info.get("gid")
        out = {"id": f"{key}-{gid}" if gid else key, **merged}
        out.setdefault("status", "released")
        if info.get("url"):
            out["source_url"] = info["url"]
        if info.get("image"):
            src_img = DATA / info["image"]
            if src_img.exists():
                (img_out / f"{gid}.webp").write_bytes(src_img.read_bytes())
                out["image"] = f"img/{gid}.webp"
        sources = ", ".join(sorted(set(prov.values())))
        fetched = (info.get("fetched") or now_iso())[:10]
        out["source_note"] = f"Sources: {sources} (fetched {fetched}). Personal use only; do not redistribute."
        devices.append(out)

    devices.sort(key=lambda d: d["id"])
    out_file = EXPORT_DIR / "devices.json"
    out_file.write_text(json.dumps(devices, ensure_ascii=False, indent=1), encoding="utf-8")
    with_img = sum(1 for d in devices if d.get("image"))
    print(f"export: {len(devices)} devices ({with_img} with photos) -> {out_file}")
    print("next: CATALOG_SOURCE=data/export/devices.json npm run catalog:build")


def cmd_status(conn: sqlite3.Connection, _http, _args) -> None:
    q = lambda sql: conn.execute(sql).fetchone()[0]  # noqa: E731
    print(f"brands:           {q('SELECT COUNT(*) FROM brands')}")
    print(f"device URLs:      {q('SELECT COUNT(*) FROM devices')}")
    print(f"fetched:          {q('SELECT COUNT(*) FROM devices WHERE fetched_at IS NOT NULL')}")
    print(f"parsed OK:        {q('SELECT COUNT(*) FROM devices WHERE parse_ok=1')}")
    print(f"still to fetch:   {q('SELECT COUNT(*) FROM devices WHERE fetched_at IS NULL')}")
    print(f"last fetch:       {q('SELECT MAX(fetched_at) FROM devices') or '—'}")


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("brands")
    d = sub.add_parser("discover")
    d.add_argument("--brand")
    f = sub.add_parser("fetch")
    f.add_argument("--limit", type=int, default=500, help="max pages this run")
    f.add_argument("--max-age-days", type=int, default=30, help="re-fetch pages older than this")
    f.add_argument("--no-images", action="store_true", help="skip photo downloads (faster)")
    u = sub.add_parser("update")
    u.add_argument("--no-images", action="store_true")
    u.add_argument("--limit", type=int, default=500)
    u.add_argument("--max-age-days", type=int, default=30)
    s = sub.add_parser("sample")
    s.add_argument("urls", nargs="+")
    s.add_argument("--brand", default=None)
    s.add_argument("--file", action="store_true", help="treat arguments as local HTML files")
    im = sub.add_parser("import", help="load a licensed/manual JSON dump as a named source")
    im.add_argument("--source", required=True, help="e.g. licensed-phonedb, manufacturer-samsung")
    im.add_argument("--file", required=True)
    ex = sub.add_parser("export")
    ex.add_argument("--priority", default="", help="comma list, highest first (default: gsmarena,manufacturer,licensed)")
    sub.add_parser("status")
    args = p.parse_args(argv)

    conn = connect()
    handlers = {
        "brands": cmd_brands, "discover": cmd_discover, "fetch": cmd_fetch, "update": cmd_update,
        "sample": cmd_sample, "export": cmd_export, "status": cmd_status, "import": cmd_import,
    }
    needs_network = args.cmd not in ("export", "status", "import") and not (args.cmd == "sample" and args.file)
    http = Polite() if needs_network else None
    run_id = conn.execute("INSERT INTO runs(command, started_at) VALUES(?,?)", (args.cmd, now_iso())).lastrowid
    conn.commit()
    try:
        handlers[args.cmd](conn, http, args)
    finally:
        conn.execute("UPDATE runs SET finished_at=? WHERE id=?", (now_iso(), run_id))
        conn.commit()
        conn.close()


if __name__ == "__main__":
    main()
