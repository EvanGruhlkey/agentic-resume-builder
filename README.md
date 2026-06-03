# Resume Job Agent

Local job search by title and location. It uses public pages and public posting endpoints only. No paid APIs or accounts are required.

## How to run

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

For development with auto-restart:

```bash
npm run dev
```

## How it works

Enter a job title, location, and result count, then press **Find jobs**.

The app uses three discovery methods:

| Method | What it does |
| --- | --- |
| Direct search | Opens the job board search page, scrolls/paginates, and parses visible job cards. |
| ATS | Uses public Greenhouse, Ashby, or Lever board/posting endpoints when discovered. |
| Public web | Searches public web results limited to a job-site domain, then fetches matching posting pages. |

After discovery, every candidate is filtered by title and location, ranked, saved to `data/job-index.json`, and shown in the UI with its source.

## Job boards scanned

### Direct search

These are searched directly:

| Board | Scanned |
| --- | --- |
| LinkedIn | Yes |
| Indeed | Yes |

### ATS sources

These are not searched like normal job boards. The app uses public ATS board/posting data when it can find matching postings:

| Source | Method |
| --- | --- |
| Greenhouse | ATS |
| Ashby | ATS |
| Lever | ATS |

### Public web discovery

These are searched through public web results, not direct board crawling:

| Site | Method |
| --- | --- |
| GitHub hiring posts | Public web |
| ZipRecruiter | Public web |
| Monster | Public web |
| CareerBuilder | Public web |
| SimplyHired | Public web |
| Getwork | Public web |
| Job.com | Public web |
| The Ladders | Public web |
| Nexxt | Public web |
| Jooble | Public web |
| Jora | Public web |
| We Work Remotely | Public web |
| Remote OK | Public web |
| Remotive | Public web |
| Remote.co | Public web |
| Working Nomads | Public web |
| Himalayas | Public web |
| NoDesk | Public web |
| JustRemote | Public web |
| Dynamite Jobs | Public web |
| RemoteHub | Public web |
| SkipTheDrive | Public web |
| Virtual Vocations | Public web |
| Pangian | Public web |
| Crossover | Public web |
| Wellfound | Public web |
| Y Combinator Jobs | Public web |
| Built In | Public web |
| Dice | Public web |
| Hacker News Who is Hiring | Public web |
| Welcome to the Jungle | Public web |
| Levels.fyi Jobs | Public web |
| TrueUp | Public web |
| Hire Tech Ladies | Public web |
| Crunchboard | Public web |
| Arc | Public web |
| Turing | Public web |
| DevITjobs | Public web |
| TechFetch | Public web |
| Authentic Jobs | Public web |
| Gun.io | Public web |
| Lemon.io | Public web |
| Dribbble Jobs | Public web |
| Behance Jobs | Public web |
| AIGA Jobs | Public web |
| Coroflot | Public web |
| Product Hunt Jobs | Public web |
| UX Jobs Board | Public web |
| SalesJobs | Public web |
| RepVue | Public web |
| MarketingHire | Public web |
| eFinancialCareers | Public web |
| Robert Half | Public web |
| USAJOBS | Public web |
| GovernmentJobs | Public web |
| Idealist | Public web |

## Not scanned

The app does not bypass login walls, CAPTCHA, paywalls, or access controls. Sources such as Glassdoor, Handshake, Simplify.jobs, Facebook, and X/Twitter are not scanned.

## Tests

```bash
npm test
```
