# Crawler And Scraper Research Notes

These notes capture the architecture references used for the backend rewrite. The implementation in this repo is original and intentionally avoids paid APIs, credentialed scraping, application submission, and copying upstream code.

## References Studied

- JobSpy: broad job-board aggregation, concurrent source execution, unified job fields, and source-specific caveats for blocking and recency.
- ts-jobspy: TypeScript-style typed source modules for LinkedIn, Indeed, Glassdoor, Google Jobs, ZipRecruiter, and related board adapters.
- ats-scrapers: small ATS scraper interface, company slug inputs, ATS-specific fetchers, provider test coverage, and a model-first schema.
- Ever Jobs: broad ATS coverage, plugin/source architecture, dedupe and store abstractions, health/circuit-breaker concepts, and adapter packaging.
- job-seek: generic company page extraction using anchors, JSON-LD, repeated blocks, pagination normalization, JS-render fallback, and scrape health tracking.
- job-scraper-ts: focused TypeScript/Bun modules for Workday, Greenhouse, Lever, and Ashby with source-specific URL discovery.
- Internio and related internship scrapers: GitHub-sourced internship/new-grad list watching, notification-oriented freshness, and early-career metadata.
- Feashliaa job-board-aggregator: daily runs, company/ATS slug fan-out, title tier classification, URL-level dedupe, and pruning jobs not seen for 30+ days.
- job-seek custom adapters: listing-page expansion, rendered fallback only when needed, canonical URLs, per-page scrape health, retry backoff, and conservative merge-on-failure behavior.
- Workday references: Workday listing pages need rendered link extraction and detail canonicalization; detail pages expose structured posting metadata such as posted labels and requisition IDs.
- Job application tracker references: pasted URL extraction should load a single job URL, normalize company/title/location, and hand the result directly to the tailoring workflow.
- Crawlee, Playwright, Playwright MCP, Crawl4AI, Browser Use, Firecrawl MCP, and small MCP scraper references: queue/retry concepts, browser fallback, rendered page inspection, screenshots, and markdown/text extraction patterns.

## Architecture Decisions For This Repo

- ATS-first discovery: Greenhouse, Lever, Ashby, Workday, iCIMS, SmartRecruiters, Jobvite, BambooHR, Workable, Zoho Recruit, Recruitee, Teamtailor, BreezyHR, JazzHR, Paylocity, Paycom, UKG, ADP, Taleo, SuccessFactors, Dayforce, Rippling, Personio, Pinpoint, Fountain, Recruiterflow, and Comeet are modeled as first-class adapter definitions.
- Public search planner: the crawler uses search-result discovery and source seed URLs instead of job-board APIs, paid scraping APIs, or login-gated flows.
- Clean adapter contract: each source exposes `name`, `type`, `canHandle`, `discoverJobs`, `extractJob`, and `normalize`.
- Generic fallback: company career pages and niche job boards use JSON-LD, visible anchors, repeated job-like links, detail-page text, and rendered-page fallback for JS shells.
- GitHub as discovery: GitHub is treated as a hiring signal source. It discovers README, issue, discussion, gist, and repo pages that may point to career pages or public application links.
- Resilience: one source failure is logged at source level and does not stop the run. Fetches use timeouts, retries with backoff, blocked-page detection, and raw snapshots.
- Storage: indexed jobs are normalized into one JSON-backed schema for this local app, with raw text snapshots saved for debugging and jobs marked inactive when a source no longer sees them.
- Resume tailoring: indexed jobs can be loaded from the database and passed to the existing truthfulness-first resume tailoring flow.
- Freshness-first behavior: public ATS board APIs are preferred when available because they return full boards and posted/updated timestamps quickly. Search results that point to listing pages are expanded into detail URLs before extraction.
- No handoff results: login/CAPTCHA/user-review sources are skipped from the job list so users only see immediately actionable public postings.

## Pipeline

Source Seeds -> Search Planner -> Crawl Queue -> Browser/HTML Crawler -> Job Link Discovery -> Job Page Extractor -> Normalizer -> Deduplicator -> Classifier -> Company Enrichment -> Job Database -> Search API -> Resume Tailoring Agent
