import { randomUUID } from "node:crypto";
import { adapterForUrl, buildJobSourceAdapters } from "./adapters.js";
import { upsertJobs, searchJobDatabase, getIndexedJob } from "./database.js";
import { planSearch, searchPublicWeb } from "./searchPlanner.js";
import { FAST_PUBLIC_JOB_SEEDS, MAJOR_HANDOFF_JOB_SOURCES, renderTemplate } from "./sourceDefinitions.js";
import {
  classifyJob,
  compareJobsByFreshness,
  enrichCompany,
  extractPostedDate,
  hostOf,
  isRecentEnough,
  isRestrictedJobSourceUrl,
  matchesQueryIntent,
  normalizeUrl,
  promisePool,
  scoreJobForQuery,
  uniqueBy
} from "./utils.js";

const DEFAULT_DISCOVERY_CONCURRENCY = 10;
const DEFAULT_EXTRACTION_CONCURRENCY = 16;
const DEFAULT_RECENT_WINDOW_DAYS = 14;

/**
 * @typedef {Object} DiscoverJobsInput
 * @property {string} targetTitle
 * @property {string=} location
 * @property {number=} maxJobs
 * @property {boolean=} searchAllSources
 * @property {boolean=} recentOnly
 * @property {number=} recentWindowDays
 * @property {{url:string,name?:string,type?:string}[]=} seeds
 */

/**
 * @typedef {Object} JobSourceAdapter
 * @property {string} name
 * @property {"job_board"|"major_job_board"|"ats"|"company_career_page"|"github"|"search_engine"|"generic"} type
 * @property {(url: string) => boolean} canHandle
 * @property {(input: DiscoverJobsInput) => Promise<Object[]>} discoverJobs
 * @property {(url: string) => Promise<Object>} extractJob
 * @property {(raw: Object) => Object} normalize
 */

export async function runJobDiscovery(input) {
  const startedAt = Date.now();
  const runId = randomUUID();
  const adapters = selectAdapters(buildJobSourceAdapters(), input);
  const sourceReports = [];
  const maxJobs = clamp(input.maxJobs, 1, 250, 25);
  const recentWindowDays = clamp(input.recentWindowDays, 1, 365, DEFAULT_RECENT_WINDOW_DAYS);
  const discoveryInput = {
    ...input,
    maxJobs,
    recentWindowDays,
    maxLinks: Math.max(50, maxJobs * 4),
    seeds: normalizeSeeds(input.seeds || []),
    plannerOnlyDiscovery: Boolean(input.searchAllSources && !(input.seeds || []).length)
  };

  const plannedSearchLinks = await discoverFromSearchPlan(discoveryInput, adapters);
  const fastSeedLinks = await discoverFromFastPublicSeeds(discoveryInput, adapters, sourceReports);
  const plannerOnlyDiscovery = discoveryInput.plannerOnlyDiscovery;
  const discoveryAdapters = plannerOnlyDiscovery
    ? []
    : adapters;
  const adapterDiscoveryInput = discoveryInput;

  const adapterDiscovery = plannerOnlyDiscovery ? [] : await promisePool(discoveryAdapters, DEFAULT_DISCOVERY_CONCURRENCY, async (adapter) => {
    const started = Date.now();
    try {
      const links = await adapter.discoverJobs(adapterDiscoveryInput);
      sourceReports.push({
        source: adapter.name,
        type: adapter.type,
        status: "ok",
        discovered: links.length,
        extracted: 0,
        failures: [],
        elapsedMs: Date.now() - started
      });
      return links;
    } catch (error) {
      sourceReports.push({
        source: adapter.name,
        type: adapter.type,
        status: "failed",
        discovered: 0,
        extracted: 0,
        failures: [error.message],
        elapsedMs: Date.now() - started
      });
      return [];
    }
  });

  if (discoveryInput.plannerOnlyDiscovery) {
    sourceReports.push({
      source: "Search planner",
      type: "search_engine",
      status: "ok",
      discovered: plannedSearchLinks.length,
      extracted: 0,
      failures: [],
      elapsedMs: Date.now() - startedAt
    });
  }

  const firstPassLinks = uniqueBy(
    [...plannedSearchLinks, ...adapterDiscovery.flat()]
      .concat(fastSeedLinks)
      .filter((link) => link?.url)
      .filter((link) => !isRestrictedJobSourceUrl(link.url) || link.sourceType === "major_job_board")
      .map((link) => ({ ...link, url: normalizeUrl(link.url) })),
    (link) => link.url
  ).sort((a, b) => compareDiscoveredLinksByFreshness(a, b, discoveryInput));

  const expandedLinks = await expandDiscoveredLinks(firstPassLinks, adapters, discoveryInput, sourceReports);
  const discoveredLinks = selectDiscoveredLinks(
    uniqueBy(
      [...expandedLinks, ...firstPassLinks],
      (link) => link.url
    ).sort((a, b) => compareDiscoveredLinksByFreshness(a, b, discoveryInput)),
    discoveryInput
  );

  const extracted = await promisePool(discoveredLinks, DEFAULT_EXTRACTION_CONCURRENCY, async (link) => {
    const adapter = adapterForUrl(link.url, adapters);
    const report = sourceReports.find((item) => item.source === adapter.name);
    try {
      const raw = await adapter.extractJob(link.url);
      raw.input = discoveryInput;
      const normalized = adapter.normalize(raw);
      if (!isUsableJob(normalized, discoveryInput)) return null;
      normalized.score = scoreJobForQuery(normalized, discoveryInput);
      normalized.classification = classifyJob(normalized);
      normalized.companyEnrichment = enrichCompany(normalized);
      if (report) report.extracted += 1;
      return normalized;
    } catch (error) {
      if (report) report.failures = [...(report.failures || []), `${link.url}: ${error.message}`].slice(-10);
      return null;
    }
  });

  const extractedJobs = extracted.filter(Boolean);
  const handoffJobs = await discoverMajorHandoffJobs(discoveryInput, sourceReports, extractedJobs);
  const candidates = [...extractedJobs, ...handoffJobs];
  const recentCandidates = discoveryInput.recentOnly === false
    ? candidates
    : candidates.filter((job) => isRecentEnough(job, recentWindowDays));
  const rankedCandidates = recentCandidates.length ? recentCandidates : candidates;

  const jobs = selectFreshJobs(rankedCandidates, discoveryInput);

  const savedJobs = await upsertJobs(jobs, {
    runId,
    sourceNames: sourceReports.filter((report) => report.status === "ok").map((report) => report.source),
    searchKey: `${input.targetTitle || ""}|${input.location || ""}`.toLowerCase()
  });

  return {
    runId,
    jobs: savedJobs,
    sourceReports,
    discovered: discoveredLinks.length + handoffJobs.length,
    elapsedMs: Date.now() - startedAt,
    pipeline: [
      "Source Seeds",
      "Search Planner",
      "Crawl Queue",
      "Browser/MCP Crawler",
      "Job Link Discovery",
      "Job Page Extractor",
      "Normalizer",
      "Deduplicator",
      "Classifier",
      "Company Enrichment",
      "Job Database",
      "Search API",
      "Resume Tailoring Agent"
    ]
  };
}

async function discoverFromFastPublicSeeds(input, adapters, sourceReports) {
  if (input.seeds?.length) return [];
  const started = Date.now();
  const seeds = input.searchAllSources ? FAST_PUBLIC_JOB_SEEDS : FAST_PUBLIC_JOB_SEEDS.slice(0, 4);
  const discoveredBySeed = await promisePool(seeds, 8, async (seed) => {
    const adapter = adapterForUrl(seed.url, adapters);
    if (!adapter?.discoverFromSeed) return [];
    return adapter.discoverFromSeed(seed, {
      ...input,
      searchAllSources: false,
      maxLinks: Math.max(12, Math.min(60, (input.maxJobs || 25) * 6))
    }).catch(() => []);
  });
  const links = uniqueBy(discoveredBySeed.flat(), (link) => link.url);
  sourceReports.push({
    source: "Fast public ATS seeds",
    type: "ats",
    status: "ok",
    discovered: links.length,
    extracted: 0,
    failures: [],
    elapsedMs: Date.now() - started
  });
  return links;
}

async function discoverMajorHandoffJobs(input, sourceReports, extractedJobs = []) {
  if (input.seeds?.length && !input.searchAllSources) return [];

  const started = Date.now();
  const jobsByUrl = new Map();
  const sourcesNeedingFallback = MAJOR_HANDOFF_JOB_SOURCES.filter((source) =>
    !extractedJobs.some((job) => source.domains.some((domain) => {
      const host = hostForUrl(job.url);
      return host === domain || host.endsWith(`.${domain}`);
    }))
  );

  if (!sourcesNeedingFallback.length) return [];

  const queries = sourcesNeedingFallback.flatMap((source) =>
    source.queryTemplates.map((template) => ({
      source,
      query: renderTemplate(template, {
        targetTitle: input.targetTitle,
        location: input.location || "United States"
      })
    }))
  );

  const searched = await promisePool(queries, 6, async ({ source, query }) => {
    const results = await searchPublicWeb(query, { recentWindowDays: input.recentWindowDays }).catch(() => []);
    return results
      .filter((result) => source.domains.some((domain) => {
        const host = hostOf(result.url);
        return host === domain || host.endsWith(`.${domain}`);
      }))
      .map((result, index) => handoffJobFromSearchResult(source, result, input, index));
  });

  for (const job of searched.flat()) {
    if (!matchesQueryIntent(job, input)) continue;
    jobsByUrl.set(normalizeUrl(job.url), job);
  }

  for (const source of sourcesNeedingFallback) {
    const hasSourceResult = [...jobsByUrl.values()].some((job) => job.source === source.name);
    if (hasSourceResult) continue;

    const fallback = handoffJobFromSearchResult(source, {
      url: source.searchUrl(input),
      title: `${input.targetTitle} newest ${source.name} search`,
      snippet: `${source.name} search sorted to recent postings for ${input.location || "United States"}.`
    }, input, 0);
    jobsByUrl.set(normalizeUrl(fallback.url), fallback);
  }

  const jobs = [...jobsByUrl.values()]
    .sort(compareJobsByFreshness)
    .slice(0, Math.min(8, Math.max(2, input.maxJobs || 25)));

  sourceReports.push({
    source: "LinkedIn and Indeed handoff",
    type: "handoff",
    status: "needs-user-review",
    discovered: jobs.length,
    extracted: 0,
    failures: [],
    elapsedMs: Date.now() - started
  });
  return jobs;
}

function hostForUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function handoffJobFromSearchResult(source, result, input, index) {
  const snippet = String(result.snippet || "").replace(/\s+/g, " ").trim();
  const datePosted = extractPostedDate(`${result.title || ""} ${snippet}`) || new Date().toISOString().slice(0, 10);
  const title = cleanHandoffTitle(result.title || `${input.targetTitle} recent ${source.name} result`, input.targetTitle);
  const description = [
    `${source.name} found a recent candidate for ${input.targetTitle}.`,
    snippet ? `Search snippet: ${snippet}` : "",
    source.reason,
    "After opening the source, paste the visible job description into the tailoring box to generate the final resume."
  ].filter(Boolean).join("\n\n");

  const job = {
    title,
    company: source.name,
    location: input.location || "United States",
    datePosted,
    description,
    excerpt: snippet || source.reason,
    url: normalizeUrl(result.url || source.searchUrl(input)),
    source: source.name,
    adapterName: `${source.name} handoff`,
    sourceType: "handoff",
    rawText: description,
    blocked: false,
    rendered: false,
    screenshotPath: "",
    extractionErrors: [],
    handoff: {
      needsUser: true,
      reason: source.reason,
      actionLabel: `Open ${source.name}`,
      searchUrl: source.searchUrl(input)
    }
  };
  job.score = scoreJobForQuery(job, input) + Math.max(0, 12 - index);
  job.classification = classifyJob(job);
  job.companyEnrichment = enrichCompany(job);
  return job;
}

function cleanHandoffTitle(title, targetTitle) {
  const cleaned = String(title || "")
    .replace(/\s+/g, " ")
    .replace(/\s+\|\s+.*$/, "")
    .replace(/\s+-\s+(LinkedIn|Indeed).*$/i, "")
    .trim();
  if (!cleaned || !matchesQueryIntent({ title: cleaned, description: "", location: "" }, { targetTitle })) {
    return `${targetTitle} recent job result`;
  }
  return cleaned.slice(0, 160);
}

export async function searchIndexedJobs(input = {}) {
  return searchJobDatabase(input);
}

export async function loadIndexedJob(id) {
  return getIndexedJob(id);
}

async function expandDiscoveredLinks(links, adapters, input, sourceReports) {
  const expansionCandidates = links
    .filter((link) => shouldExpandLink(link.url))
    .slice(0, input.searchAllSources ? 120 : 50);
  const expanded = await promisePool(expansionCandidates, 12, async (link) => {
    const adapter = adapterForUrl(link.url, adapters);
    if (!adapter?.discoverFromSeed) return [];
    try {
      const linksFromSeed = await adapter.discoverFromSeed({ url: link.url }, input);
      const report = sourceReports.find((item) => item.source === adapter.name);
      if (report) report.discovered += linksFromSeed.length;
      return linksFromSeed;
    } catch (error) {
      const report = sourceReports.find((item) => item.source === adapter.name);
      if (report) report.failures = [...(report.failures || []), `${link.url}: ${error.message}`].slice(-10);
      return [];
    }
  });
  return expanded.flat()
    .filter((link) => link?.url && (!isRestrictedJobSourceUrl(link.url) || link.sourceType === "major_job_board"));
}

async function discoverFromSearchPlan(input, adapters) {
  if (input.seeds?.length && !input.searchAllSources) return [];
  const queries = planSearch(input);
  const queryLimit = input.searchAllSources ? 120 : 32;
  const results = await promisePool(queries.slice(0, queryLimit), 8, async (query) => {
    const searchResults = await searchPublicWeb(query, { recentWindowDays: input.recentWindowDays }).catch(() => []);
    return searchResults.map((result) => {
      const adapter = adapterForUrl(result.url, adapters);
      return {
        ...result,
        source: adapter.name,
        sourceType: adapter.type,
        discoveredAt: new Date().toISOString()
      };
    });
  });
  return results.flat().filter((link) => !isRestrictedJobSourceUrl(link.url));
}

function shouldExpandLink(url) {
  return /greenhouse|lever|ashby|workday|smartrecruiters|workable|careers?|jobs?|openings|github\.com/i.test(url);
}

function isUsableJob(job, input) {
  if (!job?.url || !job?.description || job.description.length < 300) return false;
  if (job.blocked) return false;
  if (!matchesQueryIntent(job, input)) return false;
  const score = scoreJobForQuery(job, input);
  return score >= 20 || /job|career|apply|greenhouse|lever|ashby|workday/i.test(job.url);
}

function normalizeSeeds(seeds) {
  return seeds
    .map((seed) => typeof seed === "string" ? { url: seed } : seed)
    .filter((seed) => /^https?:\/\//i.test(seed?.url || ""));
}

function selectAdapters(adapters, input) {
  if (input.searchAllSources) return adapters;

  const seedUrls = normalizeSeeds(input.seeds || []).map((seed) => seed.url);
  if (seedUrls.length) {
    return adapters.filter((adapter) => seedUrls.some((url) => adapter.canHandle(url)));
  }

  const defaultNames = new Set([
    "Greenhouse",
    "Lever",
    "Ashby",
    "Workday",
    "SmartRecruiters",
    "Workable",
    "JobSpy-style general boards",
    "LinkedIn and Indeed public pages",
    "GitHub hiring discovery",
    "Generic company career pages",
    "Generic niche job boards"
  ]);
  return adapters.filter((adapter) =>
    defaultNames.has(adapter.name) ||
    seedUrls.some((url) => adapter.canHandle(url))
  );
}

function candidateLimitForExtraction(input) {
  const maxJobs = input.maxJobs || 25;
  if (input.seeds?.length && !input.searchAllSources) {
    return Math.min(120, Math.max(20, maxJobs * 6));
  }
  if (input.searchAllSources) {
    return Math.min(160, Math.max(40, maxJobs * 8));
  }
  return Math.min(180, Math.max(40, maxJobs * 5));
}

function selectDiscoveredLinks(links, input) {
  const limit = candidateLimitForExtraction(input);
  if (!input.searchAllSources || limit <= 40) return links.slice(0, limit);

  const maxPerSourceKey = Math.max(4, Math.ceil(limit / 24));
  const selected = [];
  const counts = new Map();

  for (const link of links) {
    const key = discoveredSourceKey(link.url);
    const count = counts.get(key) || 0;
    if (count >= maxPerSourceKey) continue;
    selected.push(link);
    counts.set(key, count + 1);
    if (selected.length >= limit) return selected;
  }

  for (const link of links) {
    if (selected.includes(link)) continue;
    selected.push(link);
    if (selected.length >= limit) break;
  }

  return selected;
}

function discoveredSourceKey(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (/greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com|apply\.workable\.com/i.test(host) && parts[0]) {
      return `${host}/${parts[0].toLowerCase()}`;
    }
    return host;
  } catch {
    return String(url || "").toLowerCase();
  }
}

function resultDedupeKey(job) {
  return `${job.company || ""}|${job.title || ""}`.toLowerCase();
}

function selectFreshJobs(candidates, input) {
  const maxJobs = input.maxJobs || 25;
  const sorted = uniqueBy(candidates, resultDedupeKey).sort(compareJobsByFreshness);
  if (!input.searchAllSources || maxJobs <= 3) return sorted.slice(0, maxJobs);

  const maxPerCompany = Math.max(2, Math.ceil(maxJobs / 8));
  const selected = [];
  const byCompany = new Map();

  for (const job of sorted) {
    const companyKey = String(job.company || job.companyEnrichment?.company || "unknown").toLowerCase();
    const count = byCompany.get(companyKey) || 0;
    if (count >= maxPerCompany) continue;
    selected.push(job);
    byCompany.set(companyKey, count + 1);
    if (selected.length >= maxJobs) return selected;
  }

  for (const job of sorted) {
    if (selected.includes(job)) continue;
    selected.push(job);
    if (selected.length >= maxJobs) break;
  }

  return selected;
}

function compareDiscoveredLinksByFreshness(a, b, input = {}) {
  return linkFreshnessScore(b, input) - linkFreshnessScore(a, input);
}

function linkFreshnessScore(link, input = {}) {
  const text = `${link.title || ""} ${link.snippet || ""} ${link.url || ""}`.toLowerCase();
  const targetTerms = String(input.targetTitle || "").toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  let score = 0;
  if (targetTerms.length && targetTerms.every((term) => text.includes(term))) score += 70;
  if (input.targetTitle && text.includes(String(input.targetTitle).toLowerCase())) score += 40;
  for (const term of new Set(targetTerms)) {
    if (String(link.title || "").toLowerCase().includes(term)) score += 12;
    else if (text.includes(term)) score += 4;
  }
  if (link.datePosted) {
    const posted = new Date(link.datePosted).getTime();
    if (Number.isFinite(posted)) {
      const daysOld = (Date.now() - posted) / 86_400_000;
      if (daysOld <= 1) score += 80;
      else if (daysOld <= 3) score += 65;
      else if (daysOld <= 7) score += 50;
      else if (daysOld <= 14) score += 30;
      else if (daysOld <= 30) score += 15;
    }
  }
  if (/\btoday|just posted|newly posted\b/.test(text)) score += 30;
  if (/\byesterday|this week|posted this week|new\b/.test(text)) score += 18;
  if (text.includes(String(new Date().getFullYear()))) score += 8;
  if (/greenhouse|lever|ashby|workday|smartrecruiters|workable/i.test(link.url)) score += 8;
  if (/\/jobs?\/[^/?#]+|\/careers?\/[^/?#]+|\/apply/i.test(link.url)) score += 6;
  if (/\/jobs\/?$|\/careers\/?$|\/search/i.test(link.url)) score -= 15;
  return score;
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}
