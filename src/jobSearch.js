import * as cheerio from "cheerio";
import { planSearchQueries } from "./llm.js";
import {
  buildSearchAgents,
  isBlockedSourceUrl,
  isKnownDetailUrl,
  isKnownListingUrl,
  isRestrictedSourceUrl,
  sourceForUrl,
  externalBoardSourceForUrl
} from "./jobSourceConfig.js";

const SEARCH_URL = "https://html.duckduckgo.com/html/";
const YAHOO_SEARCH_URL = "https://search.yahoo.com/search";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 ResumeJobAgent/1.0";
const robotsCache = new Map();
const SEARCH_TIMEOUT_MS = 4500;
const PAGE_TIMEOUT_MS = 4500;
const AGENTS = buildSearchAgents();
const RECENT_WINDOW_DAYS = 14;

export async function findJobs({
  targetTitle,
  location = "",
  maxJobs = 6,
  searchAllSources = false,
  recentOnly = true,
  resumeText = ""
}) {
  const cleanLocation = location || "United States";
  const startedAt = Date.now();
  const llmPlan = await planSearchQueries({
    targetTitle,
    location: cleanLocation,
    resumeText,
    agents: AGENTS
  });
  const plannedAgents = mergeAgentPlan(AGENTS, llmPlan);

  const reports = await Promise.all(
    plannedAgents.map((agent) => runAgent(agent, {
      targetTitle,
      location: cleanLocation,
      maxJobs,
      searchAllSources,
      recentOnly
    }))
  );

  const jobsByUrl = new Map();
  for (const report of reports) {
    for (const job of report.jobs) {
      const key = normalizeUrl(job.url);
      const existing = jobsByUrl.get(key);
      if (!existing || existing.score < job.score) {
        jobsByUrl.set(key, job);
      }
    }
  }

  const jobs = selectTopJobs([...jobsByUrl.values()], maxJobs, { recentOnly });

  return {
    jobs,
    agentReports: reports.map(({ jobs, ...report }) => ({
      ...report,
      results: jobs.length
    })),
    coordinator: {
      mode: llmPlan.enabled ? "llm" : "deterministic",
      model: llmPlan.model || null,
      notes: llmPlan.notes || []
    },
    elapsedMs: Date.now() - startedAt
  };
}

async function runAgent(agent, params) {
  const startedAt = Date.now();
  const foundUrls = new Set();
  const foundResultsByUrl = new Map();
  const errors = [];

  const queries = agent.queries(params);
  const searchResults = await promisePool(queries, searchConcurrencyForAgent(agent, params), async (query) => {
    try {
      return await searchPublicWeb(query, { allowRestrictedSources: agent.mode === "handoff" });
    } catch (error) {
      errors.push(`${query}: ${error.message}`);
      return [];
    }
  });

  for (const results of searchResults) {
    for (const result of results) {
      if (shouldSkipUrl(result.url, { allowRestrictedSources: agent.mode === "handoff" })) continue;
      const key = normalizeUrl(result.url);
      foundUrls.add(result.url);
      if (!foundResultsByUrl.has(key)) {
        foundResultsByUrl.set(key, {
          url: result.url,
          title: result.title || "",
          snippet: result.snippet || ""
        });
      }
    }
  }

  if (agent.mode === "handoff") {
    const jobs = buildHandoffJobs({
      agent,
      params,
      results: [...foundResultsByUrl.values()]
    });

    return {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      mode: agent.mode,
      searched: foundUrls.size,
      elapsedMs: Date.now() - startedAt,
      errors,
      jobs
    };
  }

  const candidates = rankCandidateUrls([...foundUrls], params).slice(0, candidateLimitForResults(params));
  const fetched = await promisePool(candidates, fetchConcurrencyForResults(params.maxJobs), async (url) => {
    try {
      const page = await fetchJobPage(url);
      if (!page.description || page.description.length < 500) return null;
      if (looksLikeNonJobResult(page.title, url)) return null;

      const score = scoreJob({
        title: page.title,
        description: page.description,
        url,
        targetTitle: params.targetTitle,
        location: params.location,
        datePosted: page.datePosted
      });

      if (score < 35) return null;

      return {
        ...page,
        url,
        agent: agent.name,
        sourceType: "extracted",
        score
      };
    } catch {
      return null;
    }
  });

  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    mode: agent.mode,
    searched: foundUrls.size,
    elapsedMs: Date.now() - startedAt,
    errors,
    jobs: fetched.filter(Boolean)
  };
}

function mergeAgentPlan(agents, plan) {
  if (!plan.enabled || !plan.extraQueriesByAgent) return agents;

  return agents.map((agent) => {
    const extraQueries = plan.extraQueriesByAgent[agent.id] || [];
    if (!extraQueries.length) return agent;

    return {
      ...agent,
      queries: (params) => [
        ...agent.queries(params),
        ...extraQueries
          .filter((query) => typeof query === "string" && query.length < 220)
          .slice(0, 3)
      ]
    };
  });
}

function selectTopJobs(jobs, maxJobs, { recentOnly = true } = {}) {
  const sorted = filterRecentJobs(jobs, maxJobs, recentOnly).sort(compareJobsByRecencyThenScore);
  const selected = sorted.slice(0, maxJobs);

  for (const source of ["LinkedIn", "Simplify"]) {
    if (selected.some((job) => job.company === source)) continue;
    const handoff = sorted.find((job) => job.company === source && job.sourceType === "handoff");
    if (!handoff) continue;
    if (recentOnly && !isRecentDatedJob(handoff) && !hasFreshnessSignals(handoff)) continue;

    let replaceIndex = selected.findLastIndex((job) => looksLikeDirectoryOrArticle(job.url, job.title));
    if (replaceIndex < 0 && selected.length >= maxJobs) {
      replaceIndex = selected.findLastIndex((job) => job.sourceType === "extracted");
    }
    if (replaceIndex >= 0) selected[replaceIndex] = handoff;
    else if (selected.length < maxJobs) selected.push(handoff);
    else selected[selected.length - 1] = handoff;
  }

  return selected.sort(compareJobsByRecencyThenScore);
}

function filterRecentJobs(jobs, maxJobs, recentOnly) {
  if (!recentOnly) return jobs;

  const recentDated = jobs.filter(isRecentDatedJob);
  const undatedFresh = jobs.filter((job) => !datePostedTime(job.datePosted) && hasFreshnessSignals(job));
  const candidates = [...recentDated, ...undatedFresh];

  return candidates.length ? candidates : jobs;
}

function isRecentDatedJob(job) {
  const time = datePostedTime(job.datePosted);
  if (!time) return false;
  const daysOld = (Date.now() - time) / 86_400_000;
  return daysOld >= -1 && daysOld <= RECENT_WINDOW_DAYS;
}

function hasFreshnessSignals(job) {
  if (isRecentDatedJob(job)) return true;
  const currentYear = new Date().getFullYear();
  const text = `${job.title || ""} ${job.description || ""} ${job.excerpt || ""} ${job.url || ""}`.toLowerCase();

  return (
    text.includes(String(currentYear)) ||
    /\b(posted|recent|today|yesterday|this week|this month|date posted|newly posted|new grad|internship)\b/i.test(text)
  );
}

function compareJobsByRecencyThenScore(a, b) {
  const aTime = datePostedTime(a.datePosted);
  const bTime = datePostedTime(b.datePosted);

  if (aTime && bTime && aTime !== bTime) return bTime - aTime;
  if (aTime && !bTime) return -1;
  if (!aTime && bTime) return 1;

  return (b.score || 0) - (a.score || 0);
}

function datePostedTime(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function searchConcurrencyForAgent(agent, params) {
  if (agent.id === "external" && params.searchAllSources) return 32;
  if (agent.id === "external") return Math.min(20, Math.max(8, Math.ceil((params.maxJobs || 25) / 3)));
  return Math.min(10, Math.max(5, Math.ceil((params.maxJobs || 25) / 12)));
}

function fetchConcurrencyForResults(maxJobs) {
  return Math.min(20, Math.max(10, Math.ceil((maxJobs || 25) / 5)));
}

function candidateLimitForResults(params) {
  const maxJobs = params.maxJobs || 25;
  const upper = params.searchAllSources ? 320 : 160;
  const multiplier = params.searchAllSources ? 3.5 : 2.5;
  return Math.min(upper, Math.max(24, Math.ceil(maxJobs * multiplier)));
}

function handoffLimitForResults(maxJobs) {
  return Math.min(240, Math.max(12, Math.ceil((maxJobs || 25) * 1.5)));
}

function buildHandoffJobs({ agent, params, results }) {
  const matchedResults = results
    .filter((result) => matchesHandoffSource(agent.id, result.url))
    .slice(0, handoffLimitForResults(params.maxJobs));
  const sourceResults = matchedResults.length
    ? matchedResults
    : [{ url: agent.searchUrl(params), title: "", snippet: "" }];

  return sourceResults.map((result, index) => {
    const url = result.url;
    const source = sourceForUrl(url);
    const snippet = cleanSearchSnippet(result.snippet);
    const datePosted = extractPostedDate(`${result.title || ""} ${snippet}`);
    return {
    title: cleanTitle(result.title || inferTitleFromUrlOrAgent(url, agent, params, index)),
    company: source?.name || agent.name.replace(" handoff", ""),
    location: params.location,
    description:
      `${agent.name} found a candidate link, but this source needs user-controlled review.\n\n` +
      (snippet ? `Search snippet: ${snippet}\n\n` : "") +
      `${agent.handoffReason}\n\n` +
      `After opening the source, paste the visible job description into the tailoring box to generate the final resume.`,
    excerpt: snippet || `${agent.handoffReason} Open this source, complete any human steps yourself, then paste the job description here.`,
    url,
    agent: agent.name,
    sourceType: "handoff",
    datePosted,
    score: 42 - index,
    handoff: {
      needsUser: true,
      reason: agent.handoffReason,
      actionLabel: `Open ${agent.name.replace(" handoff", "")}`,
      searchUrl: agent.searchUrl(params)
    }
    };
  });
}

function cleanSearchSnippet(snippet = "") {
  return String(snippet)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

function inferTitleFromUrlOrAgent(url, agent, params, index) {
  if (index === 0 && url === agent.searchUrl(params)) {
    return `${params.targetTitle} search on ${agent.name.replace(" handoff", "")}`;
  }

  const source = sourceForUrl(url);
  return `${params.targetTitle} ${source?.name || agent.name.replace(" handoff", "")} result`;
}

function matchesHandoffSource(agentId, url) {
  if (agentId === "external") return Boolean(externalBoardSourceForUrl(url));
  const source = sourceForUrl(url);
  return source?.id === agentId;
}

async function searchPublicWeb(query, options = {}) {
  try {
    const duckResults = await searchDuckDuckGo(query);
    if (duckResults.length) return duckResults;
  } catch {
    // Fall back to a second public HTML source when DDG throttles or changes markup.
  }

  return searchYahoo(query, options);
}

async function searchDuckDuckGo(query) {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      "user-agent": USER_AGENT,
      "accept": "text/html,application/xhtml+xml"
    }
  }, SEARCH_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(`Search failed with ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  $(".result, .web-result").each((_index, element) => {
    const anchor = $(element).find("a.result__a, a.result-link").first();
    const rawHref = anchor.attr("href");
    const title = anchor.text().replace(/\s+/g, " ").trim();
    const snippet = $(element).find(".result__snippet").text().replace(/\s+/g, " ").trim();
    const url = decodeDuckDuckGoUrl(rawHref);

    if (url && title) {
      results.push({ title, snippet, url });
    }
  });

  return results.slice(0, 20);
}

async function searchYahoo(query, options = {}) {
  const url = `${YAHOO_SEARCH_URL}?p=${encodeURIComponent(query)}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      "user-agent": USER_AGENT,
      "accept": "text/html,application/xhtml+xml"
    }
  }, SEARCH_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(`Fallback search failed with ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  $("a").each((_index, element) => {
    const anchor = $(element);
    const title = anchor.text().replace(/\s+/g, " ").trim();
    const url = decodeYahooUrl(anchor.attr("href"));
    if (!url || shouldSkipUrl(url, options) || !title) return;

    const resultText = title.replace(/^.*?https?:\/\/\S+\s*/i, "").trim() || title;
    results.push({
      title: resultText,
      snippet: anchor.closest("li, div").text().replace(/\s+/g, " ").trim(),
      url
    });
  });

  return uniqueByUrl(results).slice(0, 20);
}

async function fetchJobPage(url) {
  if (!(await canFetchByRobots(url))) {
    throw new Error("Blocked by robots.txt");
  }

  const response = await fetchWithTimeout(url, {
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      "accept": "text/html,application/xhtml+xml"
    }
  }, PAGE_TIMEOUT_MS);

  if (!response.ok || !contentLooksHtml(response)) {
    throw new Error(`Page fetch failed with ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const metadataDate = extractMetadataDate($, html);
  $("script, style, noscript, svg, iframe, nav, footer, header").remove();

  const jsonLdJob = extractJsonLdJob($);
  const pageTitle = $("title").first().text().trim();
  const inferred = inferPostingMeta($, url, pageTitle);
  const title =
    jsonLdJob.title ||
    inferred.title ||
    $("h1").first().text().trim() ||
    pageTitle ||
    "Untitled role";
  const company = jsonLdJob.company || inferred.company || extractCompany($, url, pageTitle);
  const location = jsonLdJob.location || extractLocation($);
  const description = cleanPageText(
    jsonLdJob.description ||
      $("main").text() ||
      $("[role='main']").text() ||
      $("body").text()
  );

  return {
    title: cleanTitle(title),
    company,
    location,
    datePosted: normalizeDate(jsonLdJob.datePosted) || metadataDate || extractPostedDate(description),
    description: description.slice(0, 12000),
    excerpt: description.slice(0, 700)
  };
}

function extractJsonLdJob($) {
  const scripts = $("script[type='application/ld+json']")
    .map((_index, element) => $(element).contents().text())
    .get();

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script);
      const entries = Array.isArray(parsed) ? parsed : [parsed, ...(parsed["@graph"] || [])];
      const posting = entries.find((entry) => entry?.["@type"] === "JobPosting");
      if (!posting) continue;

      return {
        title: posting.title,
        company: posting.hiringOrganization?.name,
        location: formatJobLocation(posting.jobLocation),
        datePosted: posting.datePosted || "",
        description: htmlToText(posting.description || "")
      };
    } catch {
      continue;
    }
  }

  return {};
}

function extractMetadataDate($, html) {
  const selectors = [
    "meta[property='article:published_time']",
    "meta[name='date']",
    "meta[name='dateposted']",
    "meta[name='datePosted']",
    "meta[itemprop='datePosted']",
    "time[datetime]"
  ];

  for (const selector of selectors) {
    const value = $(selector).first().attr("content") || $(selector).first().attr("datetime");
    const normalized = normalizeDate(value);
    if (normalized) return normalized;
  }

  const nextDataDate = extractDateFromEmbeddedJson(html);
  if (nextDataDate) return nextDataDate;

  return "";
}

function scoreJob({ title, description, url, targetTitle, location, datePosted = "" }) {
  const haystack = `${title} ${description} ${url} ${datePosted}`.toLowerCase();
  const titleTerms = targetTitle.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  const uniqueTitleTerms = [...new Set(titleTerms)];
  const locationTerms = location.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  const titleLower = title.toLowerCase();
  const titleHasTargetTerm = uniqueTitleTerms.some((term) => titleLower.includes(term));

  let score = 0;
  for (const term of uniqueTitleTerms) {
    if (titleLower.includes(term)) score += 14;
    else if (haystack.includes(term)) score += 6;
  }

  for (const term of locationTerms.slice(0, 4)) {
    if (haystack.includes(term)) score += 4;
  }

  const jobSignals = [
    "responsibilities",
    "requirements",
    "qualifications",
    "apply",
    "employment",
    "salary",
    "benefits",
    "job"
  ];
  for (const signal of jobSignals) {
    if (haystack.includes(signal)) score += 3;
  }

  if (isKnownDetailUrl(url)) score += 16;
  else if (/greenhouse|lever|ashby|workable|smartrecruiters|careers|jobs/i.test(url)) score += 12;
  if (/\b(posted|today|week|new|recent|hiring|2026)\b/i.test(haystack)) score += 8;
  score += recencyScore(datePosted);
  score += yearFreshnessScore(haystack);
  if (datePosted) score += yearFreshnessScore(datePosted);
  if (/linkedin\.com|simplify\.jobs|indeed\.com|glassdoor\.com/i.test(url)) score -= 10;
  if (/^(career center|job board|jobs|careers|current openings|open positions)/i.test(title.trim()) && !titleHasTargetTerm) {
    score -= 40;
  }
  if (/\bjobs\b/i.test(title) && !/\bengineer|developer|manager|designer|analyst|specialist|associate\b/i.test(title)) {
    score -= 28;
  }
  if (/\bjob search\b|\bremote job search\b/i.test(title)) score -= 30;
  if (/^(apply|apply now|submit application)$/i.test(title.trim())) score -= 35;
  if (isKnownListingUrl(url) || /\/remote-[^/]*-jobs\/?$|\/jobs\/?$|\/careers\/?$/i.test(url)) score -= 18;
  if (looksLikeDirectoryOrArticle(url, title)) score -= 36;
  if (description.length > 1500) score += 8;

  return score;
}

function yearFreshnessScore(text) {
  const years = [...String(text).matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  if (!years.length) return 0;
  const newest = Math.max(...years);
  const current = new Date().getFullYear();
  if (newest >= current) return 10;
  if (newest === current - 1) return -8;
  return -28;
}

function recencyScore(datePosted) {
  if (!datePosted) return 0;
  const parsed = new Date(datePosted);
  if (Number.isNaN(parsed.getTime())) return 0;
  const daysOld = (Date.now() - parsed.getTime()) / 86_400_000;
  if (daysOld <= 7) return 20;
  if (daysOld <= 30) return 12;
  if (daysOld <= 90) return 5;
  return 0;
}

function extractPostedDate(text) {
  const contextualDate = extractContextualDate(text);
  if (contextualDate) return contextualDate;

  const relative = text.match(/\b(posted\s+)?(\d{1,2})\s+(day|week|month)s?\s+ago\b/i);
  if (relative) {
    const amount = Number(relative[2]);
    const unit = relative[3].toLowerCase();
    const date = new Date();
    const days = unit === "day" ? amount : unit === "week" ? amount * 7 : amount * 30;
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  }

  if (/\bposted\s+today\b/i.test(text)) return new Date().toISOString().slice(0, 10);
  if (/\bposted\s+yesterday\b/i.test(text)) {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  }
  return "";
}

function extractContextualDate(text) {
  const dateToken =
    "(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|[A-Z][a-z]{2,8}\\.?\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+[A-Z][a-z]{2,8}\\.?\\s+\\d{4})";
  const before = new RegExp(`\\b(posted|date posted|published|listed|opened|created|updated)\\b[^\\n]{0,80}?${dateToken}`, "i");
  const after = new RegExp(`${dateToken}[^\\n]{0,80}?\\b(posted|published|listed|opened|created|updated)\\b`, "i");

  for (const pattern of [before, after]) {
    const match = text.match(pattern);
    if (!match) continue;
    const token = match.find((part) => normalizeDate(part));
    const normalized = normalizeDate(token);
    if (normalized) return normalized;
  }

  return "";
}

function extractDateFromEmbeddedJson(html) {
  const patterns = [
    /"datePosted"\s*:\s*"([^"]+)"/i,
    /"postedAt"\s*:\s*"([^"]+)"/i,
    /"publishedAt"\s*:\s*"([^"]+)"/i,
    /"published_at"\s*:\s*"([^"]+)"/i,
    /"date_posted"\s*:\s*"([^"]+)"/i,
    /"posted_date"\s*:\s*"([^"]+)"/i,
    /"posting_date"\s*:\s*"([^"]+)"/i,
    /"created_at"\s*:\s*"([^"]+)"/i,
    /"createdAt"\s*:\s*"([^"]+)"/i,
    /"firstPublished"\s*:\s*"([^"]+)"/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const normalized = normalizeDate(match?.[1]);
    if (normalized) return normalized;
  }

  const epochPatterns = [
    /"datePosted"\s*:\s*(\d{13})/i,
    /"postedAt"\s*:\s*(\d{13})/i,
    /"publishedAt"\s*:\s*(\d{13})/i,
    /"published_at"\s*:\s*(\d{13})/i
  ];

  for (const pattern of epochPatterns) {
    const match = html.match(pattern);
    const normalized = normalizeDate(match?.[1]);
    if (normalized) return normalized;
  }

  return "";
}

function normalizeDate(value) {
  if (!value) return "";
  let candidate = String(value).trim();
  if (/^\d{13}$/.test(candidate)) {
    candidate = new Date(Number(candidate)).toISOString();
  }
  const numeric = candidate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numeric) {
    const year = Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]);
    candidate = `${year}-${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}`;
  }
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return "";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (parsed > tomorrow) return "";
  return parsed.toISOString().slice(0, 10);
}

function rankCandidateUrls(urls, params) {
  const terms = params.targetTitle.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  return urls.sort((a, b) => candidateUrlScore(b, terms) - candidateUrlScore(a, terms));
}

function candidateUrlScore(url, terms) {
  const lower = url.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (lower.includes(term)) score += 5;
  }
  if (/lever|greenhouse|ashby|workable|smartrecruiters|amazon\.jobs|jobs\./i.test(url)) score += 10;
  if (isKnownDetailUrl(url)) score += 12;
  if (/2026|new|recent|intern|early-career/i.test(url)) score += 4;
  score += yearFreshnessScore(url);
  if (isKnownListingUrl(url) || /search\?|\/jobs\/?$|\/careers\/?$|simplyhired|dailyremote|guide/i.test(url)) score -= 20;
  return score;
}

function looksLikeDirectoryOrArticle(url, title = "") {
  return (
    /simplyhired\.com\/search|dailyremote\.com\/remote-|weworkremotely\.com\/?$|\/search\?|\/guide\/?$/i.test(url) ||
    /\bguide\b|\bjob search\b|\bremote jobs\b/i.test(title)
  );
}

function looksLikeNonJobResult(title = "", url = "") {
  const clean = title.trim();
  return (
    /^(career center|current openings|open positions|job board|jobs at|jobs|careers|dice\.com)(\b|$)/i.test(clean) ||
    /\b(companies hiring|still open|hiring now|top \d+|best .*jobs|job search|remote jobs|career center)\b/i.test(clean) ||
    (isKnownListingUrl(url) && !isKnownDetailUrl(url)) ||
    looksLikeDirectoryOrArticle(url, clean)
  );
}

function decodeDuckDuckGoUrl(rawHref) {
  if (!rawHref) return "";
  try {
    const resolved = new URL(rawHref, "https://duckduckgo.com");
    const encoded = resolved.searchParams.get("uddg");
    return encoded ? decodeURIComponent(encoded) : resolved.href;
  } catch {
    return "";
  }
}

function decodeYahooUrl(rawHref) {
  if (!rawHref) return "";
  try {
    const resolved = new URL(rawHref, "https://search.yahoo.com").href;
    const redirectMatch = resolved.match(/\/RU=([^/]+)/);
    if (!redirectMatch && /(^|\.)yahoo\.com$/i.test(new URL(resolved).hostname)) return "";
    const candidate = redirectMatch ? decodeURIComponent(redirectMatch[1]) : resolved;
    if (!candidate.startsWith("http")) return "";
    return candidate;
  } catch {
    return "";
  }
}

function uniqueByUrl(results) {
  const seen = new Set();
  return results.filter((result) => {
    const key = normalizeUrl(result.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shouldSkipUrl(url, { allowRestrictedSources = false } = {}) {
  const restrictedSource = isRestrictedSourceUrl(url);
  return (
    !/^https?:\/\//i.test(url) ||
    /duckduckgo\.com|google\.com|bing\.com|(^|\/\/)([^/]+\.)?yahoo\.com|facebook\.com|twitter\.com|x\.com|youtube\.com/i.test(url) ||
    isBlockedSourceUrl(url) ||
    (restrictedSource && !allowRestrictedSources) ||
    /\.(pdf|doc|docx|png|jpg|jpeg|gif|zip)(\?|$)/i.test(url)
  );
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_|fbclid|gclid|lever-source|source/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function contentLooksHtml(response) {
  const type = response.headers.get("content-type") || "";
  return type.includes("text/html") || type.includes("application/xhtml");
}

async function canFetchByRobots(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const origin = parsed.origin;
  if (!robotsCache.has(origin)) {
    robotsCache.set(origin, fetchRobotsRules(origin));
  }

  const rules = await robotsCache.get(origin);
  if (!rules.length) return true;

  const path = `${parsed.pathname}${parsed.search}`;
  const matching = rules
    .filter((rule) => path.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length);

  if (!matching.length) return true;
  return matching[0].type === "allow";
}

async function fetchRobotsRules(origin) {
  try {
    const response = await fetchWithTimeout(`${origin}/robots.txt`, {
      headers: { "user-agent": USER_AGENT, "accept": "text/plain,*/*" }
    }, 3000);
    if (!response.ok) return [];
    return parseRobots(await response.text());
  } catch {
    return [];
  }
}

function parseRobots(text) {
  const rules = [];
  let active = false;

  for (const rawLine of text.split(/\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;

    const [rawKey, ...rawValue] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rawValue.join(":").trim();

    if (key === "user-agent") {
      const agent = value.toLowerCase();
      active = agent === "*" || agent.includes("resumejobagent");
      continue;
    }

    if (!active || (key !== "allow" && key !== "disallow")) continue;
    if (!value) continue;

    rules.push({
      type: key,
      path: value.replace(/\*.*$/, "")
    });
  }

  return rules;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function promisePool(items, concurrency, worker) {
  const results = [];
  let index = 0;

  async function runNext() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

function inferPostingMeta($, url, pageTitle) {
  const hostname = safeHostname(url);
  const titleParts = pageTitle.split(/\s[-|–]\s/).map((part) => part.trim()).filter(Boolean);

  if (hostname.includes("jobs.lever.co")) {
    return {
      title: $("h2").first().text().trim() || titleParts.slice(1).join(" - "),
      company: titleParts[0] || humanizeSlug(new URL(url).pathname.split("/").filter(Boolean)[0])
    };
  }

  if (hostname.includes("greenhouse.io")) {
    return {
      title: $("#header h1, .app-title, h1").first().text().trim() || titleParts[0],
      company:
        $(".company-name, #header .company, .app-company").first().text().trim() ||
        titleParts.at(-1)
    };
  }

  if (hostname.includes("ashbyhq.com")) {
    return {
      title: $("h1").first().text().trim() || titleParts[0],
      company: titleParts.at(-1)
    };
  }

  if (titleParts.length >= 2) {
    return {
      title: titleParts[0].match(/job|career|opening/i) ? titleParts.slice(1).join(" - ") : titleParts[0],
      company: titleParts.at(-1)
    };
  }

  return {};
}

function extractCompany($, url, pageTitle) {
  const meta =
    $("meta[property='og:site_name']").attr("content") ||
    $("meta[name='author']").attr("content") ||
    "";
  if (meta.trim()) return meta.trim();

  const titleParts = pageTitle.split(/\s[-|–]\s/).map((part) => part.trim()).filter(Boolean);
  if (titleParts.length > 1) return titleParts.at(-1);

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Company";
  }
}

function extractLocation($) {
  const text = cleanPageText($("body").text()).slice(0, 3500);
  const patterns = [
    /\b(Remote|Hybrid)\b/i,
    /\b[A-Z][a-z]+,\s+[A-Z]{2}\b/,
    /\b[A-Z][a-z]+,\s+[A-Z][a-z]+\b/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  return "See job description";
}

function formatJobLocation(location) {
  if (!location) return "";
  const locations = Array.isArray(location) ? location : [location];
  return locations
    .map((entry) => {
      const address = entry?.address || entry;
      return [address?.addressLocality, address?.addressRegion, address?.addressCountry]
        .filter(Boolean)
        .join(", ");
    })
    .filter(Boolean)
    .join(" / ");
}

function cleanTitle(title) {
  return title
    .replace(/\s+/g, " ")
    .replace(/\s+\|\s+.*$/, "")
    .replace(/\s+-\s+Lever$/, "")
    .trim();
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function humanizeSlug(slug = "") {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .trim();
}

function cleanPageText(text) {
  return htmlToText(text)
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

function htmlToText(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\s{2,}/g, " ");
}
