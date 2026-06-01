import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { tailorResumeForJob } from "./tailor.js";
import { tailorResumeWithLlm } from "./llm.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sessions = new Map();

const DEFAULT_BROWSER_AGENTS = [
  {
    id: "web",
    name: "Web browser agent",
    startUrl: ({ targetTitle, location }) =>
      `https://www.bing.com/search?q=${encodeURIComponent(`"${targetTitle}" "${location}" careers job description apply`)}`,
    extractLinks: true
  }
];

export function startAgenticSearch({ resumeText, targetTitle, location = "", maxJobs = 6, recentWindowDays = 14 }) {
  const id = randomUUID();
  const session = {
    id,
    status: "starting",
    targetTitle,
    location: location || "United States",
    maxJobs,
    recentWindowDays,
    resumeText,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobs: [],
    logs: [],
    waitingForUser: null,
    browserOpen: false,
    error: null,
    _resumeResolvers: [],
    _stopRequested: false,
    _context: null
  };

  sessions.set(id, session);
  runSession(session).catch((error) => {
    session.status = "error";
    session.error = error.message;
    addLog(session, "error", error.message);
    cleanupSession(session);
  });

  return serializeSession(session);
}

export function getAgenticSession(id) {
  const session = sessions.get(id);
  return session ? serializeSession(session) : null;
}

export function resumeAgenticSession(id) {
  const session = sessions.get(id);
  if (!session) return null;

  session.waitingForUser = null;
  session.status = "running";
  addLog(session, "info", "User resumed the browser agent.");
  for (const resolve of session._resumeResolvers.splice(0)) resolve();
  return serializeSession(session);
}

export async function stopAgenticSession(id) {
  const session = sessions.get(id);
  if (!session) return null;

  session._stopRequested = true;
  session.status = "stopped";
  addLog(session, "info", "Stopped by user.");
  for (const resolve of session._resumeResolvers.splice(0)) resolve();
  await cleanupSession(session);
  return serializeSession(session);
}

async function runSession(session) {
  addLog(session, "info", "Launching headed browser agents.");
  session.status = "running";
  session.browserOpen = true;

  const userDataDir = path.join(__dirname, "..", ".agent-browser-profile");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: "en-US"
  });
  session._context = context;

  try {
    const plannedAgents = await planBrowserAgents(session);
    addLog(session, "info", `Running ${plannedAgents.length} browser agents in parallel.`);

    await Promise.all(
      plannedAgents.map((agent) => runBrowserAgent({ session, context, agent }))
    );

    session.jobs = dedupeJobs(session.jobs)
      .filter((job) => isFreshEnough(job, session.recentWindowDays))
      .sort(compareBrowserJobs)
      .slice(0, session.maxJobs);

    session.status = session._stopRequested ? "stopped" : "complete";
    addLog(session, "info", `Agentic search complete with ${session.jobs.length} jobs.`);
  } finally {
    await cleanupSession(session);
  }
}

async function planBrowserAgents(session) {
  if (!process.env.OPENAI_API_KEY) return DEFAULT_BROWSER_AGENTS;

  addLog(session, "info", "LLM planning is enabled; using default browser agents plus LLM-aware extraction.");
  return DEFAULT_BROWSER_AGENTS;
}

async function runBrowserAgent({ session, context, agent }) {
  if (session._stopRequested) return;

  const page = await context.newPage();
  addLog(session, "agent", `${agent.name} opening ${agent.startUrl(session)}`);

  try {
    await page.goto(agent.startUrl(session), { waitUntil: "domcontentloaded", timeout: 30000 });
    await settle(page);

    if (await needsHuman(page)) {
      addLog(session, "skip", `${agent.name} skipped ${page.url()} because it requires login, CAPTCHA, or verification.`);
      return;
    }

    const links = await extractCandidateLinks(page, agent);
    addLog(session, "agent", `${agent.name} found ${links.length} candidate links.`);

    const rankedLinks = rankBrowserLinks(links, session.targetTitle).slice(0, browserCandidateLimit(session.maxJobs));
    await promisePool(rankedLinks, browserConcurrency(session.maxJobs), async (link) => {
      if (session._stopRequested || session.jobs.length >= session.maxJobs + browserConcurrency(session.maxJobs)) return;
      await inspectCandidate({ session, context, agent, link });
    });
  } catch (error) {
    addLog(session, "warn", `${agent.name} failed: ${error.message}`);
  } finally {
    await page.close().catch(() => {});
  }
}

async function inspectCandidate({ session, context, agent, link }) {
  const page = await context.newPage();

  try {
    addLog(session, "agent", `${agent.name} inspecting ${link}`);
    await page.goto(link, { waitUntil: "domcontentloaded", timeout: 30000 });
    await settle(page);

    if (await needsHuman(page)) {
      addLog(session, "skip", `${agent.name} skipped ${page.url()} because it requires login, CAPTCHA, or verification.`);
      return;
    }

    const job = await extractVisibleJob(page, agent, session);
    if (!job || job.description.length < 350) return;

    const fallbackTailoring = tailorResumeForJob({
      resumeText: session.resumeText,
      targetTitle: session.targetTitle,
      job
    });
    job.tailoring = await tailorResumeWithLlm({
      resumeText: session.resumeText,
      targetTitle: session.targetTitle,
      job,
      fallbackTailoring
    });

    session.jobs.push(job);
    addLog(session, "job", `Captured ${job.title} at ${job.company}.`);
  } catch (error) {
    addLog(session, "warn", `Skipped ${link}: ${error.message}`);
  } finally {
    await page.close().catch(() => {});
  }
}

async function extractCandidateLinks(page, agent) {
  const currentHost = safeHost(page.url());
  const links = await page.evaluate(() => {
    return [...document.querySelectorAll("a[href]")]
      .map((anchor) => ({
        href: anchor.href,
        text: anchor.textContent?.replace(/\s+/g, " ").trim() || ""
      }))
      .filter((item) => item.href.startsWith("http"));
  });

  return [...new Set(
    links
      .map((item) => ({ ...item, href: decodeSearchRedirect(item.href) }))
      .filter((item) => looksLikeJobLink(item.href, item.text, agent.id, currentHost))
      .map((item) => stripTracking(item.href))
  )].slice(0, browserCandidateLimit(24));
}

async function extractVisibleJob(page, agent, session) {
  const pageText = await page.locator("body").innerText({ timeout: 8000 });
  const title = await bestTitle(page, session.targetTitle);
  const company = await bestCompany(page, agent);
  const location = inferLocation(pageText, session.location);
  const description = cleanText(pageText).slice(0, 14000);
  const datePosted = extractPostedDate(description);
  const score = scoreVisibleJob({ title, description, url: page.url(), targetTitle: session.targetTitle });

  if (score < 25) return null;

  return {
    title,
    company,
    location,
    datePosted,
    description,
    excerpt: description.slice(0, 700),
    url: page.url(),
    agent: agent.name,
    sourceType: "agentic-browser",
    score,
    browserAgent: {
      id: agent.id,
      name: agent.name
    }
  };
}

async function bestTitle(page, targetTitle) {
  const headings = await page.locator("h1,h2").evaluateAll((elements) =>
    elements.map((element) => element.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean)
  ).catch(() => []);
  const title = headings.find((heading) => includesAnyTitleTerm(heading, targetTitle)) || headings[0];
  return cleanText(title || await page.title() || targetTitle).slice(0, 120);
}

async function bestCompany(page, agent) {
  const hostname = safeHost(page.url()).replace(/^www\./, "");
  const metaSite = await page.locator("meta[property='og:site_name']").first().getAttribute("content").catch(() => "");
  if (metaSite) return cleanText(metaSite).slice(0, 80);
  if (hostname.includes("linkedin")) return "LinkedIn source";
  return agent.name.replace(" browser agent", "") || hostname;
}

async function needsHuman(page) {
  const url = page.url().toLowerCase();
  const text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  const lower = text.toLowerCase();

  return (
    /login|signin|checkpoint|captcha|challenge|verify|authwall/.test(url) ||
    /captcha|verify you are human|sign in|log in|security check|unusual traffic|please verify/i.test(lower)
  );
}

async function pauseForHuman(session, agent, url) {
  session.status = "waiting_for_user";
  session.waitingForUser = {
    agent: agent.name,
    url,
    message:
      `${agent.name} needs you to complete login, MFA, CAPTCHA, or another human verification in the opened browser. ` +
      "When the page is ready, click Resume in this app."
  };
  addLog(session, "handoff", session.waitingForUser.message);

  await new Promise((resolve) => {
    session._resumeResolvers.push(resolve);
  });
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1600);
}

async function cleanupSession(session) {
  if (session._context) {
    const context = session._context;
    session._context = null;
    await context.close().catch(() => {});
  }
  session.browserOpen = false;
  session.updatedAt = new Date().toISOString();
}

function addLog(session, type, message) {
  session.logs.push({
    type,
    message,
    at: new Date().toISOString()
  });
  session.logs = session.logs.slice(-80);
  session.updatedAt = new Date().toISOString();
}

function serializeSession(session) {
  return {
    id: session.id,
    status: session.status,
    targetTitle: session.targetTitle,
    location: session.location,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    recentWindowDays: session.recentWindowDays,
    jobs: session.jobs,
    logs: session.logs,
    waitingForUser: session.waitingForUser,
    browserOpen: session.browserOpen,
    error: session.error
  };
}

function compareBrowserJobs(a, b) {
  const aTime = datePostedTime(a.datePosted);
  const bTime = datePostedTime(b.datePosted);
  if (aTime && bTime && aTime !== bTime) return bTime - aTime;
  if (aTime && !bTime) return -1;
  if (!aTime && bTime) return 1;
  return (b.score || 0) - (a.score || 0);
}

function isFreshEnough(job, windowDays = 14) {
  const time = datePostedTime(job.datePosted);
  if (!time) {
    const text = `${job.title || ""} ${job.description || ""} ${job.excerpt || ""} ${job.url || ""}`;
    return /\b(today|yesterday|just posted|newly posted|posted this week|recently posted)\b/i.test(text);
  }
  const daysOld = (Date.now() - time) / 86_400_000;
  return daysOld >= -1 && daysOld <= windowDays;
}

function datePostedTime(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function dedupeJobs(jobs) {
  const seen = new Map();
  for (const job of jobs) {
    const key = stripTracking(job.url);
    const existing = seen.get(key);
    if (!existing || existing.score < job.score) seen.set(key, job);
  }
  return [...seen.values()];
}

function browserCandidateLimit(maxJobs) {
  return Math.min(120, Math.max(16, Math.ceil((maxJobs || 25) * 2)));
}

function browserConcurrency(maxJobs) {
  return Math.min(8, Math.max(4, Math.ceil((maxJobs || 25) / 15)));
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

function rankBrowserLinks(links, targetTitle) {
  const terms = targetTitle.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  return [...links].sort((a, b) => browserLinkScore(b, terms) - browserLinkScore(a, terms));
}

function browserLinkScore(url, terms) {
  const lower = url.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (lower.includes(term)) score += 5;
  }
  if (/lever|greenhouse|ashby|workable|smartrecruiters|jobs\./i.test(url)) score += 10;
  if (/2026|new|recent|intern|early-career/i.test(url)) score += 4;
  if (/search\?|\/jobs\/?$|\/careers\/?$|guide|blog/i.test(url)) score -= 18;
  return score;
}

function looksLikeJobLink(href, text, agentId, currentHost) {
  const host = safeHost(href);
  const lower = `${href} ${text}`.toLowerCase();

  if (/google\.com|bing\.com|yahoo\.com|facebook\.com|x\.com|twitter\.com|youtube\.com/.test(host)) return false;
  if (/\.(pdf|png|jpg|jpeg|gif|zip)(\?|$)/i.test(href)) return false;

  if (agentId === "linkedin") return host.includes("linkedin.com") && /\/jobs\/view|currentjobid|jobs/.test(lower);

  return (
    /job|career|opening|position|greenhouse|lever|ashby|workable|smartrecruiters|apply/i.test(lower) &&
    (!currentHost || safeHost(href) !== currentHost || /\/jobs?|\/careers?|\/apply/i.test(href))
  );
}

function scoreVisibleJob({ title, description, url, targetTitle }) {
  const haystack = `${title} ${description} ${url}`.toLowerCase();
  const titleTerms = targetTitle.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  let score = 0;

  for (const term of new Set(titleTerms)) {
    if (title.toLowerCase().includes(term)) score += 16;
    else if (haystack.includes(term)) score += 6;
  }

  for (const signal of ["responsibilities", "requirements", "qualifications", "apply", "benefits", "salary"]) {
    if (haystack.includes(signal)) score += 3;
  }

  if (/linkedin|lever|greenhouse|ashby|workable|smartrecruiters|careers|jobs/i.test(url)) score += 10;
  if (/search\?|\/jobs\/?$|\/careers\/?$/i.test(url)) score -= 18;
  if (description.length > 1200) score += 8;
  return score;
}

function includesAnyTitleTerm(value, targetTitle) {
  const lower = String(value || "").toLowerCase();
  return targetTitle.toLowerCase().split(/\W+/).some((term) => term.length > 2 && lower.includes(term));
}

function inferLocation(text, fallback) {
  const patterns = [
    /\b(Remote|Hybrid)\b/i,
    /\b[A-Z][a-z]+,\s+[A-Z]{2}\b/,
    /\b[A-Z][a-z]+,\s+[A-Z][a-z]+\b/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  return fallback || "See job description";
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

function normalizeDate(value) {
  if (!value) return "";
  let candidate = String(value).trim();
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

function stripTracking(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_|fbclid|gclid|trk|refId|trackingId/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function decodeSearchRedirect(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;

    if (host.includes("bing.com")) {
      const encoded = parsed.searchParams.get("u");
      if (encoded) {
        const cleaned = encoded.replace(/^a1/, "").replace(/-/g, "+").replace(/_/g, "/");
        const decoded = Buffer.from(cleaned, "base64").toString("utf8");
        if (decoded.startsWith("http")) return decoded;
      }
    }

    if (host.includes("yahoo.com")) {
      const match = url.match(/\/RU=([^/]+)/);
      if (match) return decodeURIComponent(match[1]);
    }

    return url;
  } catch {
    return url;
  }
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function cleanText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
