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

The UI lists matches with company, location, date, and source board. Select a row to view a summary and open the source posting.

## Job board support

When you press **Find jobs**, supported boards are searched from public pages only. Results are still filtered by the requested job title and location, so a supported board may return zero jobs for a specific search.

| Job board / source | Supported | Notes |
| --- | --- | --- |
| LinkedIn | Yes | Public listing pages are opened and parsed. |
| Indeed | Yes | Public listing pages are opened and parsed. |
| Greenhouse | Yes | Public board/job endpoints are used when possible. |
| Ashby | Yes | Public posting endpoints are used when possible. |
| Lever | Yes | Public postings are used when discovered. |
| GitHub hiring posts | Yes | Searches public issues, repos, topics, and gists. |
| ZipRecruiter | Yes | Public web discovery and posting extraction. |
| Monster | Yes | Public web discovery and posting extraction. |
| CareerBuilder | Yes | Public web discovery and posting extraction. |
| SimplyHired | Yes | Public web discovery and posting extraction. |
| Getwork | Yes | Public web discovery and posting extraction. |
| Job.com | Yes | Public web discovery and posting extraction. |
| The Ladders | Yes | Public web discovery and posting extraction. |
| Nexxt | Yes | Public web discovery and posting extraction. |
| Jooble | Yes | Public web discovery and posting extraction. |
| Jora | Yes | Public web discovery and posting extraction. |
| Talent.com | Yes | Public web discovery and posting extraction. |
| Adzuna | Yes | Public web discovery and posting extraction. |
| We Work Remotely | Yes | Public web discovery and posting extraction. |
| Remote OK | Yes | Public web discovery and posting extraction. |
| Remotive | Yes | Public web discovery and posting extraction. |
| Remote.co | Yes | Public web discovery and posting extraction. |
| Working Nomads | Yes | Public web discovery and posting extraction. |
| Himalayas | Yes | Public web discovery and posting extraction. |
| NoDesk | Yes | Public web discovery and posting extraction. |
| JustRemote | Yes | Public web discovery and posting extraction. |
| Wellfound | Yes | Public web discovery only; login walls may limit coverage. |
| Y Combinator Jobs | Yes | Public web discovery and posting extraction. |
| Built In | Yes | Public web discovery and posting extraction. |
| Dice | Yes | Public web discovery and posting extraction. |
| Hacker News Who is Hiring | Yes | Public web discovery and posting extraction. |
| Welcome to the Jungle | Yes | Public web discovery and posting extraction. |
| Levels.fyi Jobs | Yes | Public web discovery and posting extraction. |
| TrueUp | Yes | Public web discovery and posting extraction. |
| Hire Tech Ladies | Yes | Public web discovery and posting extraction. |
| Crunchboard | Yes | Public web discovery and posting extraction. |
| Arc | Yes | Public web discovery and posting extraction. |
| Turing | Yes | Public web discovery and posting extraction. |
| USAJOBS | Yes | Public web discovery and posting extraction. |
| GovernmentJobs | Yes | Public web discovery and posting extraction. |
| Idealist | Yes | Public web discovery and posting extraction. |
| HigherEdJobs | Yes | Public web discovery and posting extraction. |
| Mediabistro | Yes | Public web discovery and posting extraction. |
| Poached Jobs | Yes | Public web discovery and posting extraction. |
| Craigslist jobs | Yes | Public web discovery and posting extraction. |
| Glassdoor | No | Restricted because public crawling is commonly blocked/login-gated. |
| Handshake | No | Login-gated for most useful results. |
| Simplify.jobs | No | Restricted from crawler sources. |
| Facebook jobs | No | Restricted/login-gated. |
| X / Twitter jobs | No | Restricted/login-gated. |

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
