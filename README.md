# Resume Job Agent

A local CLI that finds public job listings, saves them to `data/jobs.md`, and can tailor a resume to a saved job.

## Setup

```bash
npm install
```

## Search

```bash
npm start -- search "Software Engineer"
```

Add a location or change the number of jobs:

```bash
npm start -- search "Software Engineer" --location "Remote" --max 25
```

You can also omit `search`:

```bash
npm start -- "Software Engineer"
```

Search updates `data/job-index.json` and writes a readable report to `data/jobs.md`.

## List Saved Jobs

```bash
npm start -- list "Software Engineer"
```

This reads from the local index instead of searching the web again.

## Tailor A Resume

Use a job id or job URL from `data/jobs.md`:

```bash
npm start -- tailor <job-id-or-url> ./resume.pdf
```

The tailored resume is saved to `data/tailored-resume.md`.

## Options

Only three options are usually needed:

```bash
--location "Remote"
--max 25
--output data/jobs.md
```

The output format is inferred from the file name. Use `.md` for Markdown or `.txt` for plain text.

## Checks

```bash
npm run check
npm test
```

The tool uses public job pages and APIs. It does not bypass login walls, CAPTCHAs, paywalls, or access controls.
