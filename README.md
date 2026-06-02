# Resume Job Agent

Local job search by title and location. Uses public listing pages only—no paid APIs or accounts required.

## Quick start

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Use `npm run dev` for watch mode.

## Overview

Enter a job title, optional location, and a result limit (max 200). The app loads public search results in a headless browser, paginates until the limit is met or listings end, ranks matches by title and location fit, and stores them in `data/job-index.json`.

The UI lists matches with company, location, and date. Select a row to view a summary and open the source posting.

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/search` | Primary search (`targetTitle`, `location`, `maxJobs`) |
| `POST /api/index/discover` | Index jobs without the UI |
| `GET /api/index/jobs` | Query the local index |
| `POST /api/index/jobs/:id/tailor` | Resume tailoring (backend only; UI pending) |

## AI

Search is fully deterministic (fetch, parse, score). No API key required.

LLM-backed resume tailoring is planned for a later release. Supporting routes exist; set `OPENAI_API_KEY` when that feature is enabled.

## Constraints

- Listing coverage depends on publicly accessible search pages.
- No application submission, CAPTCHA bypass, or authenticated scraping.
- Resume tailoring is not available in the UI yet.

## Tests

```bash
npm test
```
