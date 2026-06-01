# Python Job Crawler

Discovery-only async crawler for recent public job postings. It searches major job boards, stores new jobs in SQLite, deduplicates by `(platform, platform_job_id)`, and exports each run to CSV/JSON.

## Important Boundary

This crawler does not bypass login walls, CAPTCHA, anti-bot systems, paywalls, or site access controls. Platforms such as LinkedIn, Indeed, Glassdoor, Wellfound, and Handshake often restrict automated access. The adapters attempt public discovery and log blocked pages instead of evading them.

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m playwright install chromium
python crawler.py --config config.yaml
```

## Configuration

Edit `config.yaml`:

- `search.keywords`: one or more keyword or Boolean-style searches.
- `search.locations`: one or more locations.
- `search.freshness`: `past_24h` or `past_week`.
- `platforms.enabled`: platform keys to run.
- `platforms.max_jobs_per_platform`: per-platform cap.
- `filters.blacklisted_companies`: companies to skip.
- `storage.sqlite_path`: SQLite location.
- `storage.export_dir`: CSV/JSON output folder.
- `browser.proxy`: optional single proxy for approved network routing.

## Layout

```text
crawler.py                 main async orchestrator
database.py                SQLite storage and dedupe
config.yaml                crawl configuration
platforms/
  linkedin.py              platform adapters
  indeed.py
  glassdoor.py
  ziprecruiter.py
  monster.py
  dice.py
  builtin.py
  wellfound.py
  handshake.py
  careerbuilder.py
  usajobs.py
utils/
  browser.py               Playwright browser lifecycle, pacing, scroll behavior
  exporters.py             CSV/JSON exports
  helpers.py               parsing and normalization helpers
```

## Extending

Add a file in `platforms/`, subclass `GenericSearchPlatform`, define selectors and `build_search_url`, then register it in `platforms/__init__.py`.

For highly structured sources, override `crawl()` like `USAJobsPlatform` does for its official API.
