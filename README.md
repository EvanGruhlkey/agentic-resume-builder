# Resume Job Agent

A local web app where a user pastes or uploads a resume, enters a target job title, and asks parallel search agents to find public job descriptions without paid job-board APIs. The app returns job links, extracted descriptions, keyword gaps, and a tailored resume draft for the selected job.

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## What It Does

- Accepts pasted resume text or `.txt`, `.md`, `.pdf`, and `.docx` uploads.
- Runs several public-web search agents in parallel.
- Searches general results, ATS-hosted roles, and company career pages.
- Includes an ATS-first job indexer inspired by the researched crawler/scraper repos in `docs/crawler-scraper-research.md`. The indexer uses source adapters, public search discovery, crawl queues, retries, static HTML extraction, Playwright-render fallback, normalization, deduplication, classification, company enrichment, and raw text snapshots.
- Expands discovered ATS listing pages into individual job detail URLs using public Greenhouse, Lever, and Ashby board endpoints before extraction.
- Treats GitHub search, GitHub topics, README lists, issues, and repo pages as discovery feeds that lead to public career/application links.
- Provides JSON-backed local storage at `data/job-index.json` plus debugging snapshots in `data/raw-job-snapshots`.
- Adds backend endpoints for indexed discovery and search:
  - `POST /api/index/discover`
  - `GET /api/index/jobs`
  - `POST /api/index/jobs/:id/tailor`
- Includes LinkedIn and Indeed as human-review handoff links with recent-sort filters, while still avoiding automated scraping of login-gated or CAPTCHA-protected pages.
- Adds an agentic browser-search mode powered by Playwright. It opens a real browser, navigates public search pages, inspects candidate jobs, and skips pages that require login or verification.
- Includes a configurable job-board directory with 100+ job boards and company career sources. These are used for public search and accessible-page discovery.
- Result count is configurable up to 200 from the UI; larger searches fan out across more boards and take longer.
- **Recent only** is enabled by default with a 14-day freshness window. You can adjust the window from the UI; dated jobs outside it are filtered out and dated fresh jobs are ranked first.
- **Search all configured boards** queries every configured board and company career domain through public search. LinkedIn and Indeed are surfaced as user-review links because they restrict automation.
- Fetches public job pages directly and extracts likely job description text.
- Scores matches against the requested title and optional location.
- Produces a tailored, editable Markdown resume with:
  - a targeted summary
  - matched skills
  - missing keywords to consider
  - the original resume content preserved for truthfulness
  - the source job description link

## Optional LLM Mode

The app works without an LLM. If you set `OPENAI_API_KEY`, it will use an LLM coordinator to add extra search queries and to generate stronger resume tailoring for extracted or user-pasted job descriptions.

```bash
$env:OPENAI_API_KEY="your-key"
$env:OPENAI_MODEL="gpt-5.2"
npm start
```

## Notes

This intentionally avoids job-board APIs and credentialed scraping. Search quality depends on public search availability and whether a job page allows direct access. The app does not submit applications, bypass CAPTCHA, or fill third-party forms.

## Backend Rewrite Notes

The job indexer follows this pipeline:

```text
Source Seeds -> Search Planner -> Crawl Queue -> Browser/MCP Crawler -> Job Link Discovery -> Job Page Extractor -> Normalizer -> Deduplicator -> Classifier -> Company Enrichment -> Job Database -> Search API -> Resume Tailoring Agent
```

The adapter contract is documented in `src/jobIndex/indexer.js` and implemented in `src/jobIndex/adapters.js`. ATS platforms, GitHub hiring discovery, general boards, company career pages, and niche boards all normalize into the same local job schema. Restricted sources are either skipped when they cannot be reviewed safely or surfaced as handoff links, so the result list stays focused on immediately accessible jobs plus major-board searches the user can open directly.

## Agentic Browser Search

Click **Run agentic browser search** to launch headed browser agents. A Chromium window opens for broad public web search. Pages that ask for login, MFA, CAPTCHA, or verification are skipped.
