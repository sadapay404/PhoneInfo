# GSMArena archiver (personal use)

Builds a local SQLite database of phone specs for your own offline AetherPhone app.

## Read this first

- GSMArena's [Terms of Use](https://www.gsmarena.com/terms.php3) allow viewing and copying
  **for personal, informational, non-commercial purposes only**, and prohibit redistributing
  their information without written permission.
- So: keep the database and anything generated from it **private**. Do not publish it, host it
  for other people, or commit it to git. `data/` is git-ignored for this reason.
- The crawler honours `robots.txt`, waits at least 5 seconds between requests (plus jitter),
  backs off on HTTP 429/503, and stops after repeated errors.

## Run in Google Cloud Shell

Cloud Shell has internet access and a persistent 5 GB home directory, which is enough for
the raw page cache. Sessions can disconnect, so run the crawl inside `tmux`.

```bash
# 1. Get the code (use your own branch/fork)
git clone https://github.com/sadapay404/PhoneInfo.git && cd PhoneInfo
git checkout arena/af213546-phoneinfo

# 2. Python environment (keep it out of the repo)
python3 -m venv ~/.venvs/aether && source ~/.venvs/aether/bin/activate
pip install -r scraper/requirements.txt

# 3. Identify yourself to GSMArena (optional but polite)
export CRAWL_CONTACT="your-email-or-name"
export CRAWL_DELAY=6          # seconds between requests; never below 5 is enforced

# 4. Run the test that proves the parser works on this machine (offline, no network)
cd scraper && PYTHONPATH=. python -m unittest discover -s tests -p "test_*.py" && cd ..

# 5. Check one live page before the long run
python scraper/crawl.py sample https://www.gsmarena.com/apple_iphone_15_pro_max-12548.php --brand Apple

# 6. Discover every brand and device URL, then fetch in batches
tmux new -s archive
python scraper/crawl.py brands
python scraper/crawl.py discover
python scraper/crawl.py fetch --limit 1000      # repeat until "nothing to do"
#   Ctrl-b d to detach; `tmux attach -t archive` to return.

# 7. Check progress and build the app catalog
python scraper/crawl.py status
python scraper/crawl.py export
CATALOG_SOURCE=data/export/devices.json npm run catalog:build
```

Resuming: every command is safe to re-run. Pages already fetched are skipped, so an
interrupted run continues where it stopped.

## Keeping it up to date

```bash
python scraper/crawl.py update --max-age-days 30   # new phones + pages older than 30 days
python scraper/crawl.py export && CATALOG_SOURCE=data/export/devices.json npm run catalog:build
```

Run `update` on a schedule (for example a weekly Cloud Scheduler job or a cron entry in
Cloud Shell). Unchanged pages keep the same content hash, so the app only downloads
chunks whose data actually changed.

## Timing

Each page takes about 6 seconds at the default spacing, so 1,000 pages take roughly 1.7 hours.
`status` shows how many are left. A full first run is many hours long; plan it for overnight.

## What is stored

| Where | What |
| --- | --- |
| `data/aetherphone.sqlite` | Brands, device URLs, fetch times, content hashes, parsed JSON, run log |
| `data/raw/<gsm_id>.html.gz` | Gzipped original page (so you can re-parse without re-downloading) |
| `data/export/devices.json` | Normalized devices, consumed by the app's catalog build |

Re-parsing after a parser fix needs no network: the raw pages are local. Make the change
in `parse.py`, then run `export` again. (A `reparse` command is a sensible next step.)

## Limits (be honest about these)

- The parser is written against GSMArena's table layout. Labels and units can change, so
  check `sample` output for a few devices of each brand before a full run.
- Not every spec maps to the app schema. Anything unmapped is kept in the `raw` rows, not discarded.
- GSMArena's listed "Price" is not a reliable MSRP, so it is not exported as `price_usd`.
- Multi-variant devices (different RAM/storage bundles) are normalized to the first variant's
  values where the schema needs one value.

## Photos

`fetch` also downloads each phone's main photo (from the device page), converts it to WebP
(640 px max side), and stores it in `data/images/`. Photos are spaced like pages. Pass
`--no-images` to skip them. `export` copies them into `data/export/img/`, and the catalog
build copies them into the app. This is a personal archive: keep it private.

## Other sources (licensed or manual)

Only merge data you are allowed to use. Write a JSON array of devices in the app schema
(each entry needs `brand`, `model`, and `year`), then:

```bash
python scraper/crawl.py import --source licensed-phonedb --file dump.json
python scraper/crawl.py export                       # merges by priority
```

Merge order defaults to `gsmarena, manufacturer, licensed`. Override it with
`export --priority licensed,gsmarena`. For each field, the highest-priority source that has
a value wins. A lower-priority source only fills gaps. Each field's source is recorded
in the exported `source_note`.

Sources checked (see the root README for the reasons): GSMArena (personal use), PhoneDB
(licensed only), NanoReview (no terms found, not crawled), GizmoChina (terms prohibit copying
and databases, excluded).
