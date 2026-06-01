import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { RESTRICTED_JOB_SOURCE_DOMAINS } from "./sourceDefinitions.js";

const ROLE_TERM_ALIASES = new Map([
  ["engineer", ["engineer", "developer"]],
  ["developer", ["developer", "engineer"]],
  ["manager", ["manager", "lead", "owner"]],
  ["designer", ["designer"]],
  ["analyst", ["analyst", "analytics"]],
  ["scientist", ["scientist"]],
  ["architect", ["architect"]],
  ["associate", ["associate"]],
  ["specialist", ["specialist"]],
  ["director", ["director", "head"]],
  ["sales", ["sales", "account executive", "sdr", "bdr"]],
  ["marketing", ["marketing", "growth"]],
  ["nurse", ["nurse", "rn"]],
  ["teacher", ["teacher", "educator", "instructor"]],
  ["attorney", ["attorney", "lawyer", "counsel"]],
  ["writer", ["writer", "content"]],
  ["editor", ["editor"]]
]);

const DESCRIPTOR_TERM_ALIASES = new Map([
  ["software", ["software", "frontend", "front-end", "backend", "back-end", "full stack", "full-stack", "fullstack", "web", "mobile", "ios", "android"]],
  ["frontend", ["frontend", "front-end", "web"]],
  ["backend", ["backend", "back-end", "server"]],
  ["fullstack", ["fullstack", "full-stack", "full stack"]],
  ["data", ["data", "analytics", "bi"]],
  ["machine", ["machine", "ml"]],
  ["learning", ["learning", "ml"]],
  ["artificial", ["artificial", "ai"]],
  ["intelligence", ["intelligence", "ai"]],
  ["security", ["security", "cybersecurity", "cyber"]],
  ["new", ["new"]],
  ["grad", ["grad", "graduate"]],
  ["intern", ["intern", "internship", "co-op", "coop"]],
  ["internship", ["internship", "intern", "co-op", "coop"]],
  ["remote", ["remote", "distributed"]]
]);

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 ResumeJobAgent/2.0";

export function sha1(value) {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex");
}

export function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_|fbclid|gclid|trk|ref|source|campaign|session/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return String(url || "");
  }
}

export function canonicalJobKey(job) {
  const company = normalizeKey(job.company);
  const title = normalizeKey(job.title);
  const location = normalizeKey(job.location);
  const url = normalizeUrl(job.url);
  if (company && title) return sha1(`${company}|${title}|${location}`);
  return sha1(url);
}

export function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function cleanText(value) {
  return htmlToText(value)
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export function htmlToText(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\s{2,}/g, " ");
}

export function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    try {
      return JSON.parse(String(value).replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}

export function extractJsonLdJobs(html) {
  const $ = cheerio.load(html || "");
  const jobs = [];

  $("script[type='application/ld+json']").each((_index, element) => {
    const parsed = safeJsonParse($(element).contents().text());
    if (!parsed) return;
    for (const entry of flattenJsonLd(parsed)) {
      const types = Array.isArray(entry?.["@type"]) ? entry["@type"] : [entry?.["@type"]];
      if (!types.some((type) => String(type).toLowerCase() === "jobposting")) continue;
      jobs.push({
        title: entry.title || "",
        company: entry.hiringOrganization?.name || entry.organization?.name || "",
        location: formatJobLocation(entry.jobLocation),
        datePosted: normalizeDate(entry.datePosted || entry.validThrough || ""),
        description: cleanText(entry.description || ""),
        employmentType: Array.isArray(entry.employmentType) ? entry.employmentType.join(", ") : entry.employmentType || "",
        applyUrl: entry.url || entry.sameAs || ""
      });
    }
  });

  return jobs;
}

export function extractCandidateLinksFromHtml(html, baseUrl, { includeSameHost = true } = {}) {
  const $ = cheerio.load(html || "");
  const links = [];
  const baseHost = hostOf(baseUrl);

  $("a[href]").each((_index, element) => {
    const anchor = $(element);
    const href = resolveUrl(anchor.attr("href"), baseUrl);
    if (!href || !/^https?:\/\//i.test(href)) return;
    if (!includeSameHost && hostOf(href) === baseHost) return;

    const text = cleanText(anchor.text()).slice(0, 180);
    const lower = `${href} ${text}`.toLowerCase();
    if (/jobs powered by|job seeker support|privacy policy|terms of use|cookie/i.test(text)) return;
    if (!/job|career|opening|position|apply|intern|new-grad|greenhouse|lever|ashby|workday|smartrecruiters|workable/.test(lower)) return;
    if (/\.(pdf|doc|docx|png|jpg|jpeg|gif|zip)(\?|$)/i.test(href)) return;
    links.push({
      url: normalizeUrl(href),
      title: text,
      sourceUrl: baseUrl,
      discoveredAt: new Date().toISOString()
    });
  });

  return uniqueBy(links, (link) => link.url).slice(0, 80);
}

export function matchesQueryIntent(job, { targetTitle = "", location = "" } = {}) {
  const titleTerms = importantTerms(targetTitle);
  const locationTerms = importantTerms(location);
  const titleLower = normalizeComparableText(job.title);
  const locationText = normalizeComparableText(`${job.location || ""} ${job.description || ""}`);
  const roleTerms = titleTerms.filter((term) => ROLE_TERM_ALIASES.has(term));
  const descriptorTerms = titleTerms.filter((term) => !roleTerms.includes(term));
  const allTitleTermsOk = titleTerms.every((term) => hasTitleAlias(titleLower, term));
  const compactTitleOk = hasCompactTitleMatch(titleLower, titleTerms);

  const titleOk =
    !titleTerms.length ||
    (allTitleTermsOk && compactTitleOk) ||
    (
      roleTerms.length > 0 &&
      roleTerms.every((term) => hasTitleAlias(titleLower, term, ROLE_TERM_ALIASES)) &&
      descriptorTerms.every((term) => hasTitleAlias(titleLower, term, DESCRIPTOR_TERM_ALIASES)) &&
      compactTitleOk
    );
  const locationOk =
    !locationTerms.length ||
    /remote|united states|usa|us\b/i.test(location || "") ||
    locationTerms.some((term) => locationText.includes(term));

  return titleOk && locationOk;
}

export function blockedPageSignal(textOrHtml = "") {
  return /captcha|verify you are human|access denied|blocked|unusual traffic|forbidden|sign in to continue|login required/i.test(textOrHtml);
}

export function jsShellSignal(html = "") {
  const text = cleanText(html);
  return text.length < 400 && /<script/i.test(html) && /root|__next|app|bundle|webpack|vite/i.test(html);
}

export function normalizeDate(value) {
  if (!value) return "";
  let candidate = String(value).trim();
  if (/^\d{13}$/.test(candidate)) candidate = new Date(Number(candidate)).toISOString();
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

export function extractPostedDate(text = "") {
  const contextual = extractContextualDate(text);
  if (contextual) return contextual;

  const relative = String(text).match(/\b(posted\s+)?(\d{1,2})\s+(day|week|month)s?\s+ago\b/i);
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

export function isRestrictedJobSourceUrl(url) {
  const hostname = hostOf(url);
  return RESTRICTED_JOB_SOURCE_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function datePostedTime(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function freshnessScore(job) {
  const posted = datePostedTime(job.datePosted);
  if (posted) {
    const daysOld = (Date.now() - posted) / 86_400_000;
    if (daysOld <= 1) return 100;
    if (daysOld <= 3) return 85;
    if (daysOld <= 7) return 70;
    if (daysOld <= 14) return 50;
    if (daysOld <= 30) return 30;
    if (daysOld <= 60) return 12;
    return -20;
  }

  const text = `${job.title || ""} ${job.description || ""} ${job.excerpt || ""} ${job.url || ""}`.toLowerCase();
  if (/\b(today|yesterday|just posted|newly posted|posted this week|posted recently)\b/.test(text)) return 20;
  if (text.includes(String(new Date().getFullYear()))) return 8;
  return 0;
}

export function isRecentEnough(job, windowDays = 45) {
  const posted = datePostedTime(job.datePosted);
  if (!posted) return freshnessScore(job) >= (windowDays <= 30 ? 20 : 8);
  const daysOld = (Date.now() - posted) / 86_400_000;
  return daysOld >= -1 && daysOld <= windowDays;
}

export function compareJobsByFreshness(a, b) {
  const aTime = datePostedTime(a.datePosted);
  const bTime = datePostedTime(b.datePosted);
  if (aTime && bTime && aTime !== bTime) return bTime - aTime;
  if (aTime && !bTime) return -1;
  if (!aTime && bTime) return 1;
  return (freshnessScore(b) - freshnessScore(a)) || ((b.score || 0) - (a.score || 0));
}

export function scoreJobForQuery(job, { targetTitle = "", location = "" } = {}) {
  const haystack = `${job.title || ""} ${job.company || ""} ${job.location || ""} ${job.description || ""} ${job.url || ""}`.toLowerCase();
  const title = normalizeComparableText(job.title);
  const terms = targetTitle.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  const locationTerms = location.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  let score = 0;

  for (const term of new Set(terms)) {
    if (hasTitleAlias(title, term)) score += 18;
    else if (hasTerm(haystack, term)) score += 7;
  }
  for (const term of locationTerms.slice(0, 4)) {
    if (haystack.includes(term)) score += 4;
  }
  for (const signal of ["responsibilities", "requirements", "qualifications", "benefits", "salary", "apply", "internship", "new grad"]) {
    if (haystack.includes(signal)) score += 3;
  }
  score += freshnessScore(job);
  if (/greenhouse|lever|ashby|workday|smartrecruiters|workable|jobs|careers/i.test(job.url || "")) score += 8;
  if ((job.description || "").length > 1200) score += 8;
  if (!job.title || /^jobs|careers|search/i.test(job.title)) score -= 24;
  if (targetTitle && !matchesQueryIntent(job, { targetTitle, location })) score -= 80;
  return score;
}

function importantTerms(value) {
  const stop = new Set(["the", "and", "with", "for", "job", "jobs", "role", "remote", "united", "states", "usa"]);
  return String(value || "")
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2 && !stop.has(term));
}

function hasTerm(text, term) {
  const escaped = String(term || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i").test(String(text || ""));
}

function hasTitleAlias(title, term, aliases = DESCRIPTOR_TERM_ALIASES) {
  const candidates = titleAliasesForTerm(term, aliases);
  return candidates.some((candidate) => hasTerm(title, candidate));
}

function normalizeComparableText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[/_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasCompactTitleMatch(title, terms) {
  if (terms.length < 2) return true;
  const tokens = normalizeComparableText(title).split(/\W+/).filter(Boolean);
  const positions = terms.map((term) => conceptPositions(tokens, term));
  if (positions.some((matches) => !matches.length)) return false;

  let compact = false;
  walkPositions(positions, 0, [], (picked) => {
    const min = Math.min(...picked);
    const max = Math.max(...picked);
    if ((max - min + 1) <= terms.length) compact = true;
  });
  return compact;
}

function conceptPositions(tokens, term) {
  const aliases = [
    ...titleAliasesForTerm(term, DESCRIPTOR_TERM_ALIASES),
    ...titleAliasesForTerm(term, ROLE_TERM_ALIASES)
  ];
  const positions = [];
  for (const alias of new Set(aliases)) {
    const aliasTokens = normalizeComparableText(alias).split(/\W+/).filter(Boolean);
    if (!aliasTokens.length) continue;
    for (let index = 0; index <= tokens.length - aliasTokens.length; index += 1) {
      if (aliasTokens.every((token, offset) => tokens[index + offset] === token)) {
        positions.push(index);
      }
    }
  }
  return positions;
}

function titleAliasesForTerm(term, aliases) {
  return aliases.get(term) || [term];
}

function walkPositions(positions, depth, picked, visit) {
  if (depth === positions.length) {
    visit(picked);
    return;
  }
  for (const position of positions[depth]) {
    walkPositions(positions, depth + 1, [...picked, position], visit);
  }
}

export function classifyJob(job) {
  const text = `${job.title || ""} ${job.description || ""}`.toLowerCase();
  const categories = [];
  if (/intern|internship|co-?op|student|new grad|early career/.test(text)) categories.push("early-career");
  if (/remote|distributed|work from home/.test(text)) categories.push("remote");
  if (/software|developer|engineer|devops|data|security|machine learning|ai/.test(text)) categories.push("engineering");
  if (/designer|product design|ux|ui|creative/.test(text)) categories.push("design");
  if (/product manager|product owner/.test(text)) categories.push("product");
  if (/sales|account executive|sdr|business development/.test(text)) categories.push("sales");
  if (/marketing|growth|seo|content/.test(text)) categories.push("marketing");
  return categories.length ? categories : ["general"];
}

export function enrichCompany(job) {
  return {
    company: job.company || companyFromUrl(job.url),
    companyDomain: companyDomainFromUrl(job.url),
    sourceDomain: hostOf(job.url),
    ats: job.ats || ""
  };
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function resolveUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return "";
  }
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function promisePool(items, concurrency, worker) {
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

function flattenJsonLd(value) {
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry) => [entry, ...(Array.isArray(entry?.["@graph"]) ? entry["@graph"] : [])]).filter(Boolean);
}

function formatJobLocation(location) {
  if (!location) return "";
  const locations = Array.isArray(location) ? location : [location];
  return locations
    .map((entry) => {
      const address = entry?.address || entry;
      if (typeof address === "string") return address;
      return [address?.addressLocality, address?.addressRegion, address?.addressCountry]
        .filter(Boolean)
        .join(", ");
    })
    .filter(Boolean)
    .join(" / ");
}

function extractContextualDate(text) {
  const dateToken =
    "(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|[A-Z][a-z]{2,8}\\.?\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+[A-Z][a-z]{2,8}\\.?\\s+\\d{4})";
  const patterns = [
    new RegExp(`\\b(posted|date posted|published|listed|opened|created|updated)\\b[^\\n]{0,80}?${dateToken}`, "i"),
    new RegExp(`${dateToken}[^\\n]{0,80}?\\b(posted|published|listed|opened|created|updated)\\b`, "i")
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const token = match.find((part) => normalizeDate(part));
    const normalized = normalizeDate(token);
    if (normalized) return normalized;
  }
  return "";
}

function companyFromUrl(url) {
  const host = hostOf(url);
  return host ? host.split(".").slice(-2, -1)[0]?.replace(/[-_]+/g, " ") || "Company" : "Company";
}

function companyDomainFromUrl(url) {
  const host = hostOf(url);
  const parts = host.split(".");
  return parts.length >= 2 ? parts.slice(-2).join(".") : host;
}
