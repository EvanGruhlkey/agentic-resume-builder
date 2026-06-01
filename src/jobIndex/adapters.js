import * as cheerio from "cheerio";
import { fetchPageWithFallback } from "./pageFetcher.js";
import { searchPublicWeb } from "./searchPlanner.js";
import {
  ATS_DEFINITIONS,
  GENERAL_JOB_BOARD_DOMAINS,
  GITHUB_DISCOVERY_URLS,
  GITHUB_SEARCH_TEMPLATES,
  MAJOR_HANDOFF_JOB_SOURCES,
  NICHE_BOARD_DOMAINS,
  REMOTE_BOARD_DOMAINS,
  renderTemplate,
  sourceDefinitionForUrl
} from "./sourceDefinitions.js";
import {
  cleanText,
  classifyJob,
  enrichCompany,
  extractCandidateLinksFromHtml,
  extractJsonLdJobs,
  extractPostedDate,
  hostOf,
  isRestrictedJobSourceUrl,
  matchesQueryIntent,
  normalizeDate,
  normalizeUrl,
  promisePool,
  scoreJobForQuery,
  uniqueBy
} from "./utils.js";

export function jobIndexerSourceCatalogForClient() {
  return buildJobSourceAdapters().map((adapter) => ({
      id: adapter.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name: adapter.name,
      mode: adapter.mode || "public-fetch",
      type: adapter.type,
      sourcePageExamples: [],
      detailUrlPatterns: [],
      listingUrlPatterns: []
  }));
}

export function buildJobSourceAdapters() {
  return [
    ...ATS_DEFINITIONS.map(createAtsAdapter),
    createGeneralBoardAdapter(),
    createMajorBoardAdapter(),
    createGitHubHiringAdapter(),
    createGenericCompanyCareerAdapter(),
    createGenericNicheBoardAdapter()
  ];
}

function createMajorBoardAdapter() {
  return {
    name: "LinkedIn and Indeed public pages",
    type: "major_job_board",
    mode: "public-browser-fetch",
    canHandle(url) {
      return Boolean(majorJobSourceForUrl(url));
    },
    async discoverJobs(input) {
      const seeded = input.seeds?.length ? await discoverFromMajorSeeds(input, this) : [];
      if (input.seeds?.length && !input.searchAllSources) return seeded.slice(0, input.maxLinks || 80);

      const queries = MAJOR_HANDOFF_JOB_SOURCES.flatMap((source) =>
        source.queryTemplates.map((template) =>
          renderTemplate(template, {
            targetTitle: input.targetTitle,
            location: input.location || "United States"
          })
        )
      );
      const searched = await discoverMajorFromQueries(queries, this, input);
      const searchPages = input.searchAllSources ? await discoverFromMajorSearchPages(input, this) : [];

      return uniqueBy([...seeded, ...searched, ...searchPages], (link) => link.url)
        .slice(0, input.maxLinks || 80);
    },
    async discoverFromSeed(seed, input) {
      return discoverFromMajorSeeds({ ...input, seeds: [seed] }, this);
    },
    async extractJob(url) {
      return extractRawJob(url, {
        adapterName: this.name,
        browserFallback: true
      });
    },
    normalize(raw) {
      return normalizeRawJob(raw, { sourceType: "major_job_board", adapterName: this.name });
    }
  };
}

export function adapterForUrl(url, adapters = buildJobSourceAdapters()) {
  const selectedMatch = adapters.find((adapter) => adapter.canHandle(url));
  if (selectedMatch) return selectedMatch;

  const fullCatalog = buildJobSourceAdapters();
  return fullCatalog.find((adapter) => adapter.canHandle(url)) ||
    fullCatalog.find((adapter) => adapter.name === "Generic company career pages");
}

function createAtsAdapter(definition) {
  return {
    name: definition.name,
    type: "ats",
    canHandle(url) {
      const hostname = hostOf(url);
      const pathname = safePath(url);
      return definition.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) &&
        [...definition.detailPathPatterns, ...definition.listingPathPatterns].some((pattern) => pattern.test(pathname));
    },
    async discoverJobs(input) {
      const seeded = await discoverFromSeeds(input, this, definition);
      if (input.seeds?.length && !input.searchAllSources) return seeded.slice(0, input.maxLinks || 80);
      const queries = definition.domains.slice(0, 2).map((domain) =>
        `"${input.targetTitle}" "${input.location || "United States"}" site:${domain}`
      );
      const searched = await discoverFromQueries(queries, this);
      return uniqueBy([...seeded, ...searched], (link) => link.url).slice(0, input.maxLinks || 80);
    },
    async discoverFromSeed(seed, input) {
      return discoverFromSeeds({ ...input, seeds: [seed] }, this, definition);
    },
    async extractJob(url) {
      const apiJob = await extractAtsApiJob(url, definition).catch(() => null);
      if (apiJob) return apiJob;
      return extractRawJob(url, {
        adapterName: definition.name,
        ats: definition.id,
        browserFallback: definition.id === "workday"
      });
    },
    normalize(raw) {
      return normalizeRawJob(raw, { sourceType: "ats", adapterName: definition.name });
    }
  };
}

async function extractAtsApiJob(url, definition) {
  if (definition.id === "greenhouse") return extractGreenhouseApiJob(url, definition);
  if (definition.id === "lever") return extractLeverApiJob(url, definition);
  if (definition.id === "ashby") return extractAshbyApiJob(url, definition);
  return null;
}

async function extractGreenhouseApiJob(url, definition) {
  const parsed = safeUrl(url);
  const match = parsed?.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/i);
  if (!match) return null;
  const [, boardToken, jobId] = match;
  const job = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}`);
  if (!job?.id) return null;
  return greenhouseApiRawJob(job, boardToken, definition, url);
}

async function extractLeverApiJob(url, definition) {
  const parsed = safeUrl(url);
  const parts = parsed?.pathname.split("/").filter(Boolean) || [];
  if (parts.length < 2) return null;
  const [company, postingId] = parts;
  const job = await fetchJson(`https://api.lever.co/v0/postings/${company}/${postingId}`);
  if (!job?.id) return null;
  return leverApiRawJob(job, company, definition, url);
}

async function extractAshbyApiJob(url, definition) {
  const parsed = safeUrl(url);
  const parts = parsed?.pathname.split("/").filter(Boolean) || [];
  if (parts.length < 2) return null;
  const [company, jobId] = parts;
  const job = await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${company}/${jobId}`);
  const posting = job?.job || job;
  if (!posting?.id && !posting?.title) return null;
  return ashbyApiRawJob(posting, company, definition, url);
}

function greenhouseApiRawJob(job, boardToken, definition, fallbackUrl) {
  return {
    url: job.absolute_url || fallbackUrl,
    title: job.title || "",
    company: boardToken,
    location: formatGreenhouseLocation(job),
    datePosted: normalizeDate(job.first_published || job.updated_at || ""),
    description: cleanText(job.content || ""),
    rawText: cleanText(job.content || JSON.stringify(job)),
    html: job.content || "",
    blocked: false,
    rendered: false,
    screenshotPath: "",
    errors: [],
    adapterName: definition.name,
    ats: definition.id
  };
}

function leverApiRawJob(posting, company, definition, fallbackUrl) {
  return {
    url: posting.hostedUrl || posting.applyUrl || fallbackUrl,
    title: posting.text || "",
    company,
    location: formatLeverLocation(posting),
    datePosted: normalizeDate(posting.createdAt || ""),
    description: cleanText([
      posting.descriptionPlain || posting.description || "",
      ...(posting.lists || []).map((list) => `${list.text || ""}\n${cleanText(list.content || "")}`),
      posting.additionalPlain || posting.additional || ""
    ].join("\n\n")),
    rawText: cleanText(JSON.stringify(posting)),
    html: "",
    blocked: false,
    rendered: false,
    screenshotPath: "",
    errors: [],
    adapterName: definition.name,
    ats: definition.id
  };
}

function ashbyApiRawJob(posting, company, definition, fallbackUrl) {
  return {
    url: posting.jobUrl || posting.applyUrl || fallbackUrl,
    title: posting.title || "",
    company,
    location: formatAshbyLocation(posting.location, posting.secondaryLocations),
    datePosted: normalizeDate(posting.publishedAt || posting.updatedAt || ""),
    description: cleanText(posting.descriptionPlain || posting.descriptionHtml || posting.description || ""),
    rawText: cleanText(JSON.stringify(posting)),
    html: posting.descriptionHtml || "",
    blocked: false,
    rendered: false,
    screenshotPath: "",
    errors: [],
    adapterName: definition.name,
    ats: definition.id
  };
}

function createGeneralBoardAdapter() {
  const domains = GENERAL_JOB_BOARD_DOMAINS;
  return {
    name: "JobSpy-style general boards",
    type: "job_board",
    canHandle(url) {
      const hostname = hostOf(url);
      return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    },
    async discoverJobs(input) {
      if (input.seeds?.length && !input.searchAllSources) {
        return discoverFromSeeds(input, this);
      }
      const domainsToSearch = input.searchAllSources ? domains : domains.slice(0, 10);
      const queries = domainsToSearch.map((domain) =>
        `"${input.targetTitle}" "${input.location || "United States"}" "posted" "apply" site:${domain}`
      );
      return discoverFromQueries(queries, this);
    },
    async discoverFromSeed(seed, input) {
      return discoverFromSeeds({ ...input, seeds: [seed] }, this);
    },
    async extractJob(url) {
      return extractRawJob(url, { adapterName: this.name, browserFallback: false });
    },
    normalize(raw) {
      return normalizeRawJob(raw, { sourceType: "job_board", adapterName: this.name });
    }
  };
}

function createGitHubHiringAdapter() {
  return {
    name: "GitHub hiring discovery",
    type: "github",
    canHandle(url) {
      return /(^|\.)github\.com$|(^|\.)gist\.github\.com$/i.test(hostOf(url));
    },
    async discoverJobs(input) {
      if (input.seeds?.length && !input.searchAllSources) {
        return discoverFromSeeds(input, this);
      }
      const targeted = [
        `"${input.targetTitle}" "${input.location || "remote"}" site:github.com "apply"`,
        `"${input.targetTitle}" "${new Date().getFullYear()}" site:github.com "internship"`,
        `"${input.targetTitle}" site:github.com "new grad"`,
        `"${input.targetTitle}" site:github.com "posted today"`,
        `"${input.targetTitle}" site:github.com "newly posted"`
      ];
      const internalGitHubPages = await discoverFromSeeds({
        ...input,
        seeds: GITHUB_DISCOVERY_URLS.map((url) => ({ url }))
      }, this);
      const githubTemplates = GITHUB_SEARCH_TEMPLATES.map((template) => renderTemplate(template, input));
      const githubPages = await discoverFromQueries([...targeted, ...githubTemplates], this);
      const expanded = await promisePool(
        [...internalGitHubPages, ...githubPages].slice(0, input.searchAllSources ? 60 : 26),
        10,
        async (link) => {
        try {
          const raw = await extractRawJob(link.url, { adapterName: this.name, browserFallback: false });
          return extractHiringLinks(raw.html || "", raw.url)
            .filter((hiringLink) => !isRestrictedJobSourceUrl(hiringLink.url))
            .map((hiringLink) => ({
              ...hiringLink,
              title: hiringLink.title || link.title,
              snippet: link.snippet,
              source: this.name,
              sourceType: this.type,
              githubSourceUrl: link.url
            }));
        } catch {
          return [];
        }
      });
      return uniqueBy(expanded.flat(), (link) => link.url).slice(0, input.maxLinks || 80);
    },
    async discoverFromSeed(seed, input) {
      return discoverFromSeeds({ ...input, seeds: [seed] }, this);
    },
    async extractJob(url) {
      const raw = await extractRawJob(url, { adapterName: this.name, browserFallback: false });
      raw.hiringLinks = extractHiringLinks(raw.html || "", raw.url);
      raw.githubDiscovery = true;
      return raw;
    },
    normalize(raw) {
      const normalized = normalizeRawJob(raw, { sourceType: "github", adapterName: this.name });
      normalized.description = [
        normalized.description,
        raw.hiringLinks?.length ? `\n\nDiscovered hiring links:\n${raw.hiringLinks.map((link) => `- ${link.url}`).join("\n")}` : ""
      ].join("").trim();
      normalized.excerpt = normalized.description.slice(0, 700);
      return normalized;
    }
  };
}

function createGenericCompanyCareerAdapter() {
  return {
    name: "Generic company career pages",
    type: "company_career_page",
    canHandle(url) {
      return /career|careers|jobs|openings|positions|join-us|apply/i.test(url) && !sourceDefinitionForUrl(url);
    },
    async discoverJobs(input) {
      const seeded = await discoverFromSeeds(input, this);
      if (input.seeds?.length && !input.searchAllSources) return seeded;
      const queries = [
        `"${input.targetTitle}" "${input.location || "United States"}" careers "job description" "apply"`,
        `"${input.targetTitle}" "${input.location || "United States"}" "posted today" careers "apply"`,
        `"${input.targetTitle}" "${input.location || "United States"}" "posted this week" careers "apply"`,
        `intitle:"${input.targetTitle}" "${input.location || "United States"}" "careers" "qualifications"`,
        `"${input.targetTitle}" "${input.location || "United States"}" "open positions" "apply"`
      ];
      const searched = await discoverFromQueries(queries, this);
      return uniqueBy([...seeded, ...searched], (link) => link.url);
    },
    async discoverFromSeed(seed, input) {
      return discoverFromSeeds({ ...input, seeds: [seed] }, this);
    },
    async extractJob(url) {
      return extractRawJob(url, { adapterName: this.name, browserFallback: false });
    },
    normalize(raw) {
      return normalizeRawJob(raw, { sourceType: "company_career_page", adapterName: this.name });
    }
  };
}

function createGenericNicheBoardAdapter() {
  const domains = [...REMOTE_BOARD_DOMAINS, ...NICHE_BOARD_DOMAINS];
  return {
    name: "Generic niche job boards",
    type: "generic",
    canHandle(url) {
      const hostname = hostOf(url);
      return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    },
    async discoverJobs(input) {
      if (input.seeds?.length && !input.searchAllSources) {
        return discoverFromSeeds(input, this);
      }
      const domainsToSearch = input.searchAllSources ? domains : domains.slice(0, 45);
      const queries = domainsToSearch.map((domain) =>
        `"${input.targetTitle}" "${input.location || "United States"}" "posted" site:${domain}`
      );
      return discoverFromQueries(queries, this);
    },
    async discoverFromSeed(seed, input) {
      return discoverFromSeeds({ ...input, seeds: [seed] }, this);
    },
    async extractJob(url) {
      return extractRawJob(url, { adapterName: this.name, browserFallback: false });
    },
    normalize(raw) {
      return normalizeRawJob(raw, { sourceType: "generic", adapterName: this.name });
    }
  };
}

async function discoverFromSeeds(input, adapter, atsDefinition = null) {
  const seeds = (input.seeds || []).filter((seed) => adapter.canHandle(seed.url || seed));
  const discovered = [];

  for (const seed of seeds.slice(0, 20)) {
    const url = seed.url || seed;
    try {
      if (atsDefinition) {
        const atsLinks = await discoverAtsBoardLinks(url, atsDefinition, input);
        if (atsLinks.length) {
          discovered.push(...atsLinks);
          continue;
        }
      }
      const page = await fetchPageWithFallback(url, { browserFallback: true, minTextLength: 250 });
      discovered.push(...extractCandidateLinksFromHtml(page.html, page.url));
    } catch {
      // Source-level reporting happens in the crawler; discovery continues.
    }
  }

  return discovered;
}

async function discoverFromQueries(queries, adapter, options = {}) {
  const resultsByQuery = await promisePool(queries.slice(0, options.limit || 24), 8, async (query) => {
    const links = [];
    const results = await searchPublicWeb(query).catch(() => []);
    for (const result of results) {
      if (isRestrictedJobSourceUrl(result.url)) continue;
      if (!adapter.canHandle(result.url) && adapter.type !== "generic" && adapter.type !== "company_career_page") continue;
      links.push({
        url: normalizeUrl(result.url),
        title: result.title,
        snippet: result.snippet,
        source: adapter.name,
        sourceType: adapter.type,
        discoveredAt: new Date().toISOString()
      });
    }
    return links;
  });
  return uniqueBy(resultsByQuery.flat(), (link) => link.url);
}

async function discoverMajorFromQueries(queries, adapter, input, options = {}) {
  const resultsByQuery = await promisePool(queries.slice(0, options.limit || 32), 6, async (query) => {
    const results = await searchPublicWeb(query, { recentWindowDays: input.recentWindowDays }).catch(() => []);
    return results
      .filter((result) => adapter.canHandle(result.url))
      .map((result) => ({
        url: normalizeUrl(result.url),
        title: result.title,
        snippet: result.snippet,
        datePosted: extractPostedDate(`${result.title || ""} ${result.snippet || ""}`),
        source: adapter.name,
        sourceType: adapter.type,
        discoveredAt: new Date().toISOString()
      }));
  });
  return uniqueBy(resultsByQuery.flat(), (link) => link.url);
}

async function discoverFromMajorSearchPages(input, adapter) {
  const pages = await promisePool(MAJOR_HANDOFF_JOB_SOURCES, 2, async (source) => {
    const searchUrl = source.searchUrl(input);
    try {
      const page = await fetchPageWithFallback(searchUrl, {
        browserFallback: true,
        minTextLength: 250,
        timeoutMs: 12000,
        attempts: 1
      });
      if (page.blocked) return [];
      return extractCandidateLinksFromHtml(page.html, page.url)
        .filter((link) => adapter.canHandle(link.url))
        .map((link) => ({
          ...link,
          source: adapter.name,
          sourceType: adapter.type,
          discoveredAt: new Date().toISOString()
        }));
    } catch {
      return [];
    }
  });
  return uniqueBy(pages.flat(), (link) => link.url);
}

async function discoverFromMajorSeeds(input, adapter) {
  const seeds = (input.seeds || []).filter((seed) => adapter.canHandle(seed.url || seed));
  const discovered = [];

  for (const seed of seeds.slice(0, 12)) {
    const url = seed.url || seed;
    try {
      const page = await fetchPageWithFallback(url, {
        browserFallback: true,
        minTextLength: 250,
        timeoutMs: 12000,
        attempts: 1
      });
      if (page.blocked) {
        discovered.push({
          url: normalizeUrl(page.url || url),
          title: seed.name || "",
          snippet: "Major job board page needs user review.",
          source: adapter.name,
          sourceType: adapter.type,
          discoveredAt: new Date().toISOString()
        });
        continue;
      }
      discovered.push(...extractCandidateLinksFromHtml(page.html, page.url)
        .filter((link) => adapter.canHandle(link.url))
        .map((link) => ({
          ...link,
          source: adapter.name,
          sourceType: adapter.type,
          discoveredAt: new Date().toISOString()
        })));
    } catch {
      // Keep discovery moving when a major board blocks or throttles the crawler.
    }
  }

  return uniqueBy(discovered, (link) => link.url);
}

async function extractRawJob(url, { adapterName, ats = "", browserFallback = true } = {}) {
  const page = await fetchPageWithFallback(url, { browserFallback, minTextLength: 500 });
  const $ = cheerio.load(page.html || "");
  const jsonLdJob = extractJsonLdJobs(page.html || "")[0] || {};
  $("script, style, noscript, svg, nav, footer, header").remove();

  const title =
    jsonLdJob.title ||
    $("h1").first().text().trim() ||
    $("meta[property='og:title']").attr("content") ||
    $("title").first().text().trim() ||
    "Untitled role";
  const company =
    jsonLdJob.company ||
    $("[data-qa='company-name'], .company-name, .app-company, [class*='company']").first().text().trim() ||
    $("meta[property='og:site_name']").attr("content") ||
    companyFromTitleOrHost(title, page.url);
  const visibleText = page.text || cleanText($("main").text() || $("[role='main']").text() || $("body").text());
  const description = cleanText(jsonLdJob.description || visibleText);

  return {
    url: page.url || url,
    title: cleanTitle(title),
    company: cleanText(company).slice(0, 100) || companyFromTitleOrHost(title, page.url),
    location: jsonLdJob.location || extractLocation(visibleText),
    datePosted: normalizeDate(jsonLdJob.datePosted) || extractPostedDate(visibleText),
    description: description.slice(0, 18000),
    rawText: visibleText.slice(0, 24000),
    html: page.html || "",
    blocked: page.blocked,
    rendered: page.rendered,
    screenshotPath: page.screenshotPath,
    errors: page.errors || [],
    adapterName,
    ats
  };
}

async function discoverAtsBoardLinks(url, definition, input) {
  if (definition.id === "greenhouse") return discoverGreenhouseJobs(url, definition, input);
  if (definition.id === "lever") return discoverLeverJobs(url, definition, input);
  if (definition.id === "ashby") return discoverAshbyJobs(url, definition, input);
  return [];
}

async function discoverGreenhouseJobs(url, definition, input) {
  const token = greenhouseBoardToken(url);
  if (!token) return [];
  const data = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`);
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return sortRawJobsByFreshness(jobs
    .map((job) => greenhouseApiRawJob(job, token, definition, job.absolute_url || url))
    .filter((job) => matchesQueryIntent(job, input)))
    .slice(0, input.maxLinks || 80)
    .map((job) => rawJobToDiscoveredLink(job, input));
}

async function discoverLeverJobs(url, definition, input) {
  const parsed = safeUrl(url);
  const parts = parsed?.pathname.split("/").filter(Boolean) || [];
  const company = parts[0];
  if (!company) return [];
  const hosts = parsed.hostname.includes("jobs.eu.lever.co")
    ? ["api.eu.lever.co", "api.lever.co"]
    : ["api.lever.co", "api.eu.lever.co"];
  for (const host of hosts) {
    const data = await fetchJson(`https://${host}/v0/postings/${company}?mode=json`);
    const postings = Array.isArray(data) ? data : data?.data;
    if (!Array.isArray(postings)) continue;
    return sortRawJobsByFreshness(postings
      .map((posting) => leverApiRawJob(posting, company, definition, posting.hostedUrl || url))
      .filter((job) => matchesQueryIntent(job, input)))
      .slice(0, input.maxLinks || 80)
      .map((job) => rawJobToDiscoveredLink(job, input));
  }
  return [];
}

async function discoverAshbyJobs(url, definition, input) {
  const parsed = safeUrl(url);
  const company = parsed?.pathname.split("/").filter(Boolean)[0];
  if (!company) return [];
  const data = await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${company}`);
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return sortRawJobsByFreshness(jobs
    .map((job) => ashbyApiRawJob(job, company, definition, job.jobUrl || url))
    .filter((job) => matchesQueryIntent(job, input)))
    .slice(0, input.maxLinks || 80)
    .map((job) => rawJobToDiscoveredLink(job, input));
}

function normalizeRawJob(raw, { sourceType, adapterName }) {
  const normalized = {
    title: cleanTitle(raw.title || "Untitled role"),
    company: cleanText(raw.company || "").slice(0, 100) || "Company",
    location: cleanText(raw.location || "See job description").slice(0, 160),
    datePosted: normalizeDate(raw.datePosted),
    description: cleanText(raw.description || raw.rawText || "").slice(0, 18000),
    excerpt: cleanText(raw.description || raw.rawText || "").slice(0, 700),
    url: normalizeUrl(raw.url),
    source: adapterName,
    adapterName,
    sourceType,
    ats: raw.ats || "",
    rawText: raw.rawText || raw.description || "",
    blocked: Boolean(raw.blocked),
    rendered: Boolean(raw.rendered),
    screenshotPath: raw.screenshotPath || "",
    extractionErrors: raw.errors || []
  };
  normalized.score = scoreJobForQuery(normalized, raw.input || {});
  normalized.classification = classifyJob(normalized);
  normalized.companyEnrichment = enrichCompany(normalized);
  return normalized;
}

function extractHiringLinks(html, baseUrl) {
  return extractCandidateLinksFromHtml(html, baseUrl, { includeSameHost: false })
    .filter((link) => /career|jobs|greenhouse|lever|ashby|workday|apply/i.test(link.url))
    .slice(0, 20);
}

function extractLocation(text) {
  const patterns = [
    /\b(Remote|Hybrid)\b/i,
    /\b[A-Z][a-z]+,\s+[A-Z]{2}\b/,
    /\b[A-Z][a-z]+,\s+[A-Z][a-z]+\b/
  ];
  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match) return match[0];
  }
  return "See job description";
}

function cleanTitle(title) {
  return cleanText(title)
    .replace(/\s+\|\s+.*$/, "")
    .replace(/\s+-\s+(Lever|Greenhouse|Ashby|Workable)$/i, "")
    .trim()
    .slice(0, 160);
}

function companyFromTitleOrHost(title, url) {
  const parts = String(title || "").split(/\s[-|]\s/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) return parts.at(-1);
  const host = hostOf(url);
  return host ? host.replace(/\.(com|org|net|io|co).*$/i, "").replace(/[-_]+/g, " ") : "Company";
}

function safePath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

function majorJobSourceForUrl(url) {
  const hostname = hostOf(url);
  return MAJOR_HANDOFF_JOB_SOURCES.find((source) =>
    source.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  );
}

function safeUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function greenhouseBoardToken(url) {
  const parsed = safeUrl(url);
  const parts = parsed?.pathname.split("/").filter(Boolean) || [];
  return parts[0] || "";
}

function rawJobToDiscoveredLink(job, input) {
  return {
    url: normalizeUrl(job.url),
    title: job.title,
    snippet: [job.company, job.location, job.datePosted].filter(Boolean).join(" - "),
    datePosted: job.datePosted,
    source: job.adapterName,
    sourceType: "ats",
    discoveredAt: new Date().toISOString(),
    score: scoreJobForQuery(job, input)
  };
}

function sortRawJobsByFreshness(jobs) {
  return [...jobs].sort((a, b) => {
    const aTime = new Date(a.datePosted || 0).getTime();
    const bTime = new Date(b.datePosted || 0).getTime();
    const safeATime = Number.isFinite(aTime) ? aTime : 0;
    const safeBTime = Number.isFinite(bTime) ? bTime : 0;
    return safeBTime - safeATime;
  });
}

function formatGreenhouseLocation(job) {
  const values = [
    job.location?.name,
    ...(job.offices || []).flatMap((office) => [office.name, office.location])
  ].filter(Boolean);
  return [...new Set(values)].join(" / ");
}

function formatLeverLocation(posting) {
  const values = [
    posting.categories?.location,
    ...(posting.categories?.allLocations || []),
    posting.country,
    posting.workplaceType === "remote" ? "Remote" : ""
  ].filter(Boolean);
  return [...new Set(values)].join(" / ");
}

function formatAshbyLocation(location, secondaryLocations = []) {
  if (!location) return "";
  if (typeof location === "string") return location;
  const primary = [location.name, location.city, location.region, location.country]
    .filter(Boolean)
    .join(", ");
  const secondary = secondaryLocations
    .map((entry) => entry?.location || entry?.name || "")
    .filter(Boolean);
  return [primary, ...secondary].filter(Boolean).join(" / ");
}

async function fetchJson(url, timeoutMs = 6500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "accept": "application/json",
        "user-agent": "ResumeJobAgent/2.0 public-job-indexer"
      }
    });
    if (!response.ok) return null;
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
