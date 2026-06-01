import * as cheerio from "cheerio";
import {
  GITHUB_SEARCH_TEMPLATES,
  GENERAL_JOB_BOARD_DOMAINS,
  NICHE_BOARD_DOMAINS,
  REMOTE_BOARD_DOMAINS,
  ATS_DEFINITIONS,
  renderTemplate
} from "./sourceDefinitions.js";
import { normalizeUrl, uniqueBy, USER_AGENT } from "./utils.js";

const DUCK_URL = "https://html.duckduckgo.com/html/";
const YAHOO_URL = "https://search.yahoo.com/search";

export function planSearch({ targetTitle, location = "", searchAllSources = false, recentWindowDays = 14 }) {
  const freshPhrases = freshnessPhrases(recentWindowDays);
  const place = location || "United States";
  const base = [
    `"${targetTitle}" "${place}" careers "job description" apply`,
    `"${targetTitle}" "${place}" "posted" "apply"`,
    ...freshPhrases.map((phrase) => `"${targetTitle}" "${place}" "${phrase}" "apply"`),
    `"${targetTitle}" "${place}" "newly posted" "apply"`,
    `"${targetTitle}" "${place}" "date posted" "apply"`,
    `intitle:"${targetTitle}" "${place}" "requirements" "qualifications"`
  ];

  const atsQueries = ATS_DEFINITIONS.flatMap((source) =>
    source.domains.slice(0, 1).flatMap((domain) => [
      `"${targetTitle}" "${place}" site:${domain}`,
      ...freshPhrases.slice(0, 3).map((phrase) => `"${targetTitle}" "${place}" "${phrase}" site:${domain}`)
    ])
  );
  const boardDomains = [...GENERAL_JOB_BOARD_DOMAINS, ...REMOTE_BOARD_DOMAINS, ...NICHE_BOARD_DOMAINS];
  const boardQueries = boardDomains.flatMap((domain) => [
    `"${targetTitle}" "${place}" site:${domain}`,
    `"${targetTitle}" "${place}" "posted" site:${domain}`,
    ...freshPhrases.slice(0, 2).map((phrase) => `"${targetTitle}" "${place}" "${phrase}" site:${domain}`)
  ]);
  const githubQueries = GITHUB_SEARCH_TEMPLATES.map((template) =>
    renderTemplate(template, { targetTitle, location })
  );

  return uniqueBy(
    [...base, ...atsQueries, ...githubQueries, ...(searchAllSources ? boardQueries : boardQueries.slice(0, 60))],
    (query) => query
  ).slice(0, searchAllSources ? 360 : 100);
}

export async function searchPublicWeb(query, options = {}) {
  try {
    const duckResults = await searchDuckDuckGo(query, options);
    if (duckResults.length) return duckResults;
  } catch {
    // Yahoo's HTML results are a pragmatic fallback when DDG throttles or shifts markup.
  }
  return searchYahoo(query, options);
}

async function searchDuckDuckGo(query, options = {}) {
  const params = new URLSearchParams({ q: query });
  const df = duckDateFilter(options.recentWindowDays);
  if (df) params.set("df", df);
  const response = await fetchWithTimeout(`${DUCK_URL}?${params.toString()}`, 4200);
  if (!response.ok) throw new Error(`DuckDuckGo returned ${response.status}`);
  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  $(".result, .web-result").each((_index, element) => {
    const anchor = $(element).find("a.result__a, a.result-link").first();
    const url = decodeDuckDuckGoUrl(anchor.attr("href"));
    const title = anchor.text().replace(/\s+/g, " ").trim();
    const snippet = $(element).find(".result__snippet").text().replace(/\s+/g, " ").trim();
    if (url && title) results.push({ url: normalizeUrl(url), title, snippet });
  });

  return results.slice(0, 20);
}

async function searchYahoo(query, options = {}) {
  const params = new URLSearchParams({ p: query });
  const btf = yahooDateFilter(options.recentWindowDays);
  if (btf) params.set("btf", btf);
  const response = await fetchWithTimeout(`${YAHOO_URL}?${params.toString()}`, 4200);
  if (!response.ok) throw new Error(`Yahoo returned ${response.status}`);
  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  $("a").each((_index, element) => {
    const anchor = $(element);
    const url = decodeYahooUrl(anchor.attr("href"));
    const title = anchor.text().replace(/\s+/g, " ").trim();
    if (!url || !title) return;
    results.push({
      url: normalizeUrl(url),
      title,
      snippet: anchor.closest("li, div").text().replace(/\s+/g, " ").trim().slice(0, 500)
    });
  });

  return uniqueBy(results, (result) => result.url).slice(0, 20);
}

function freshnessPhrases(windowDays) {
  const days = Number(windowDays) || 14;
  const phrases = ["posted today", "posted yesterday", "just posted", "newly posted"];
  if (days >= 3) phrases.push("past 3 days", "last 3 days");
  if (days >= 7) phrases.push("posted this week", "past week", "last 7 days");
  if (days >= 14) phrases.push("last 14 days", "recently posted");
  if (days >= 30) phrases.push("past month", "last 30 days");
  return phrases;
}

function duckDateFilter(windowDays) {
  const days = Number(windowDays) || 14;
  if (days <= 1) return "d";
  if (days <= 7) return "w";
  if (days <= 30) return "m";
  if (days <= 365) return "y";
  return "";
}

function yahooDateFilter(windowDays) {
  const days = Number(windowDays) || 14;
  if (days <= 1) return "d";
  if (days <= 7) return "w";
  if (days <= 30) return "m";
  return "";
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
    return candidate.startsWith("http") ? candidate : "";
  } catch {
    return "";
  }
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        "accept": "text/html,application/xhtml+xml"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}
