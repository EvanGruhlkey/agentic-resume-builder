import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  blockedPageSignal,
  cleanText,
  jsShellSignal,
  sha1,
  USER_AGENT
} from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, "..", "..", "data", "crawler-screenshots");
const DEFAULT_TIMEOUT_MS = 9000;

export async function fetchPageWithFallback(url, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const staticPage = await retry(() => fetchStaticPage(url, timeoutMs), {
    attempts: options.attempts || 2,
    label: url
  });

  if (
    !staticPage.blocked &&
    !jsShellSignal(staticPage.html) &&
    cleanText(staticPage.html).length >= (options.minTextLength || 500)
  ) {
    return staticPage;
  }

  if (options.browserFallback === false) return staticPage;

  try {
    return await fetchRenderedPage(url, timeoutMs);
  } catch (error) {
    return {
      ...staticPage,
      errors: [...(staticPage.errors || []), `rendered fallback failed: ${error.message}`]
    };
  }
}

export async function captureCrawlerScreenshot(page, url, label = "blocked") {
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  const filePath = path.join(SCREENSHOT_DIR, `${Date.now()}-${label}-${sha1(url).slice(0, 10)}.png`);
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => {});
  return filePath;
}

async function fetchStaticPage(url, timeoutMs) {
  const response = await fetchWithTimeout(url, {
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      "accept": "text/html,application/xhtml+xml"
    }
  }, timeoutMs);

  const contentType = response.headers.get("content-type") || "";
  const html = contentType.includes("html") || contentType.includes("xhtml") ? await response.text() : "";
  const blocked = !response.ok || blockedPageSignal(html);

  return {
    url: response.url || url,
    status: response.status,
    html,
    text: cleanText(html),
    rendered: false,
    blocked,
    screenshotPath: "",
    errors: response.ok ? [] : [`HTTP ${response.status}`]
  };
}

async function fetchRenderedPage(url, timeoutMs) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 900 }
  });

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 6000) }).catch(() => {});
    await page.waitForTimeout(800);

    const html = await page.content();
    const text = cleanText(await page.locator("body").innerText({ timeout: 3000 }).catch(() => html));
    const blocked = blockedPageSignal(text) || blockedPageSignal(html);
    const screenshotPath = blocked || text.length < 350
      ? await captureCrawlerScreenshot(page, url, blocked ? "blocked" : "empty")
      : "";

    return {
      url: page.url(),
      status: response?.status() || 0,
      html,
      text,
      rendered: true,
      blocked,
      screenshotPath,
      errors: response?.ok() === false ? [`HTTP ${response.status()}`] : []
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function retry(task, { attempts = 2, label = "task" } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastError.message}`);
}
