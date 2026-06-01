import express from "express";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractResumeInput } from "./resumeParser.js";
import { tailorResumeForJob } from "./tailor.js";
import { getLlmStatus, tailorResumeWithLlm } from "./llm.js";
import { loadIndexedJob, runJobDiscovery, searchIndexedJobs } from "./jobIndex/indexer.js";
import { jobIndexerSourceCatalogForClient } from "./jobIndex/adapters.js";
import { upsertJobs } from "./jobIndex/database.js";
import { fetchPageWithFallback } from "./jobIndex/pageFetcher.js";
import {
  classifyJob,
  enrichCompany,
  extractCandidateLinksFromHtml,
  extractPostedDate,
  scoreJobForQuery,
  sha1
} from "./jobIndex/utils.js";
import {
  getAgenticSession,
  resumeAgenticSession,
  startAgenticSearch,
  stopAgenticSession
} from "./agenticBrowserSearch.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, llm: getLlmStatus() });
});

app.get("/api/sources", (_req, res) => {
  res.json({ sources: jobIndexerSourceCatalogForClient() });
});

app.get("/api/index/jobs", async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();
    const location = String(req.query.location || "").trim();
    const activeOnly = parseBoolean(req.query.activeOnly, true);
    const limit = clampNumber(req.query.limit, 1, 250, 50);
    res.json({
      jobs: await searchIndexedJobs({ query, location, activeOnly, limit }),
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: "Could not search the job index.", detail: error.message });
  }
});

app.post("/api/index/discover", async (req, res) => {
  try {
    const targetTitle = String(req.body.targetTitle || "").trim();
    const location = String(req.body.location || "").trim();
    const maxJobs = clampNumber(req.body.maxJobs, 1, 250, 25);
    const searchAllSources = parseBoolean(req.body.searchAllSources, false);
    const recentOnly = parseBoolean(req.body.recentOnly, true);
    const recentWindowDays = clampNumber(req.body.recentWindowDays, 1, 365, 14);
    const seeds = Array.isArray(req.body.seeds) ? req.body.seeds : [];

    if (!targetTitle) {
      return res.status(400).json({ error: "Enter the job title to index." });
    }

    const discovery = await runJobDiscovery({
      targetTitle,
      location,
      maxJobs,
      searchAllSources,
      recentOnly,
      recentWindowDays,
      seeds
    });

    res.json({ ...discovery, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Job discovery failed.", detail: error.message });
  }
});

app.post("/api/search", upload.single("resumeFile"), async (req, res) => {
  try {
    const targetTitle = String(req.body.targetTitle || "").trim();
    const location = String(req.body.location || "").trim();
    const resumeText = String(req.body.resumeText || "").trim();
    const maxJobs = clampNumber(req.body.maxJobs, 1, 200, 25);
    const searchAllSources = parseBoolean(req.body.searchAllSources, false);
    const recentOnly = parseBoolean(req.body.recentOnly, true);
    const recentWindowDays = clampNumber(req.body.recentWindowDays, 1, 365, 14);

    if (!targetTitle) {
      return res.status(400).json({ error: "Enter the job title you want." });
    }

    const extractedResume = await extractResumeInput({
      typedText: resumeText,
      file: req.file
    });

    if (!extractedResume.text || extractedResume.text.length < 80) {
      return res.status(400).json({
        error: "Add a longer resume by pasting text or uploading a supported file."
      });
    }

    const search = await runJobDiscovery({
      targetTitle,
      location,
      maxJobs,
      searchAllSources,
      recentOnly,
      recentWindowDays
    });

    const jobs = await mapWithConcurrency(search.jobs, 8, async (job) => {
      const fallbackTailoring = tailorResumeForJob({
        resumeText: extractedResume.text,
        job,
        targetTitle
      });

      return {
        ...job,
        tailoring: await tailorResumeWithLlm({
          resumeText: extractedResume.text,
          job,
          targetTitle,
          fallbackTailoring
        })
      };
    });

    res.json({
      resume: {
        source: extractedResume.source,
        characters: extractedResume.text.length,
        text: extractedResume.text
      },
      targetTitle,
      location,
      jobs,
      agentReports: search.sourceReports.map((report) => ({
        id: report.source,
        name: report.source,
        description: `${report.type} adapter`,
        mode: report.status,
        searched: report.discovered,
        elapsedMs: report.elapsedMs,
        errors: report.failures,
        results: report.extracted
      })),
      coordinator: {
        mode: "indexer",
        model: null,
        notes: [
          `Indexed ${search.jobs.length} public jobs through the adapter pipeline.`,
          "LinkedIn and Indeed are included as human-review handoff links because they restrict automated scraping.",
          `Pipeline: ${search.pipeline.join(" -> ")}`
        ]
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "The search failed. Try again with a narrower title or location.",
      detail: error.message
    });
  }
});

app.post("/api/index/jobs/:id/tailor", upload.single("resumeFile"), async (req, res) => {
  try {
    const resumeText = String(req.body.resumeText || "").trim();
    const targetTitle = String(req.body.targetTitle || "").trim();
    const extractedResume = await extractResumeInput({
      typedText: resumeText,
      file: req.file
    });
    const job = await loadIndexedJob(req.params.id);

    if (!job) return res.status(404).json({ error: "Indexed job not found." });
    if (!extractedResume.text || extractedResume.text.length < 80) {
      return res.status(400).json({ error: "Add a longer resume by pasting text or uploading a supported file." });
    }

    const fallbackTailoring = tailorResumeForJob({
      resumeText: extractedResume.text,
      targetTitle: targetTitle || job.title,
      job
    });

    res.json({
      job,
      tailoring: await tailorResumeWithLlm({
        resumeText: extractedResume.text,
        targetTitle: targetTitle || job.title,
        job,
        fallbackTailoring
      })
    });
  } catch (error) {
    res.status(500).json({ error: "Could not tailor the indexed job.", detail: error.message });
  }
});

app.post("/api/agentic/start", upload.single("resumeFile"), async (req, res) => {
  try {
    const targetTitle = String(req.body.targetTitle || "").trim();
    const location = String(req.body.location || "").trim();
    const resumeText = String(req.body.resumeText || "").trim();
    const maxJobs = clampNumber(req.body.maxJobs, 1, 200, 25);
    const recentWindowDays = clampNumber(req.body.recentWindowDays, 1, 365, 14);

    if (!targetTitle) {
      return res.status(400).json({ error: "Enter the job title you want." });
    }

    const extractedResume = await extractResumeInput({
      typedText: resumeText,
      file: req.file
    });

    if (!extractedResume.text || extractedResume.text.length < 80) {
      return res.status(400).json({
        error: "Add a longer resume by pasting text or uploading a supported file."
      });
    }

    const session = startAgenticSearch({
      resumeText: extractedResume.text,
      targetTitle,
      location,
      maxJobs,
      recentWindowDays
    });

    res.json({
      resume: {
        source: extractedResume.source,
        characters: extractedResume.text.length,
        text: extractedResume.text
      },
      session
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "The browser-agent search could not start.",
      detail: error.message
    });
  }
});

app.get("/api/agentic/:id", (req, res) => {
  const session = getAgenticSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Agentic search session not found." });
  res.json({ session });
});

app.post("/api/agentic/:id/resume", (req, res) => {
  const session = resumeAgenticSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Agentic search session not found." });
  res.json({ session });
});

app.post("/api/agentic/:id/stop", async (req, res) => {
  const session = await stopAgenticSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Agentic search session not found." });
  res.json({ session });
});

app.post("/api/major-board/snapshot", express.json({ limit: "1mb" }), async (req, res) => {
  try {
    const url = String(req.body.url || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "A valid LinkedIn or Indeed URL is required." });
    }
    if (!isLinkedInOrIndeedUrl(url)) {
      return res.status(400).json({ error: "Only LinkedIn and Indeed snapshot URLs are supported here." });
    }

    const page = await fetchPageWithFallback(url, {
      browserFallback: true,
      minTextLength: 250,
      timeoutMs: 15000,
      attempts: 1
    });
    const snapshotPath = await saveMajorBoardHtmlSnapshot(page);
    const links = extractCandidateLinksFromHtml(page.html || "", page.url || url)
      .filter((link) => isLinkedInOrIndeedUrl(link.url))
      .slice(0, 60);

    res.json({
      requestedUrl: url,
      url: page.url || url,
      status: page.status,
      blocked: Boolean(page.blocked),
      rendered: Boolean(page.rendered),
      htmlLength: (page.html || "").length,
      textLength: (page.text || "").length,
      html: page.html || "",
      snapshotPath,
      screenshotPath: page.screenshotPath || "",
      links,
      errors: page.errors || []
    });
  } catch (error) {
    res.status(500).json({ error: "Could not capture the recent-search HTML.", detail: error.message });
  }
});

app.post("/api/import/jobs", express.json({ limit: "4mb" }), async (req, res) => {
  try {
    const runId = randomUUID();
    const targetTitle = String(req.body.targetTitle || "").trim();
    const location = String(req.body.location || "").trim();
    const resumeText = String(req.body.resumeText || "").trim();
    const importedJobs = Array.isArray(req.body.jobs) ? req.body.jobs : [];

    if (!importedJobs.length) {
      return res.status(400).json({ error: "No jobs were provided to import." });
    }

    const jobs = importedJobs
      .map((job) => normalizeImportedJob(job, { targetTitle, location }))
      .filter((job) => job.title && job.url);

    const savedJobs = await upsertJobs(jobs, {
      runId,
      sourceNames: ["Browser LinkedIn import"],
      searchKey: `${targetTitle}|${location}`.toLowerCase()
    });

    const jobsWithTailoring = await mapWithConcurrency(savedJobs, 6, async (job) => {
      if (!resumeText || resumeText.length < 80 || !targetTitle) return job;
      const fallbackTailoring = tailorResumeForJob({ resumeText, targetTitle, job });
      return {
        ...job,
        tailoring: await tailorResumeWithLlm({
          resumeText,
          targetTitle,
          job,
          fallbackTailoring
        })
      };
    });

    await saveImportRun(runId, {
      runId,
      targetTitle,
      location,
      resumeText,
      jobs: jobsWithTailoring,
      generatedAt: new Date().toISOString()
    });

    res.json({
      runId,
      imported: jobsWithTailoring.length,
      jobs: jobsWithTailoring
    });
  } catch (error) {
    res.status(500).json({ error: "Could not import scraped jobs.", detail: error.message });
  }
});

app.get("/api/import/runs/:id", async (req, res) => {
  try {
    const run = await loadImportRun(req.params.id);
    if (!run) return res.status(404).json({ error: "Import run not found." });
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: "Could not load import run.", detail: error.message });
  }
});

app.post("/api/tailor", express.json({ limit: "4mb" }), async (req, res) => {
  try {
    const resumeText = String(req.body.resumeText || "").trim();
    const targetTitle = String(req.body.targetTitle || "").trim();
    const job = req.body.job;

    if (!resumeText || !targetTitle || !job?.description) {
      return res.status(400).json({ error: "Resume text, target title, and job description are required." });
    }

    const jobForTailoring = { ...job, sourceType: "manual" };
    const fallbackTailoring = tailorResumeForJob({ resumeText, targetTitle, job: jobForTailoring });

    res.json({
      tailoring: await tailorResumeWithLlm({
        resumeText,
        targetTitle,
        job: jobForTailoring,
        fallbackTailoring
      })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Resume Job Agent running on http://localhost:${port}`);
});

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "on", "yes"].includes(String(value).toLowerCase());
}

function isLinkedInOrIndeedUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com") ||
      hostname === "indeed.com" || hostname.endsWith(".indeed.com");
  } catch {
    return false;
  }
}

async function saveMajorBoardHtmlSnapshot(page) {
  const dir = path.join(__dirname, "..", "data", "major-board-html");
  await fs.mkdir(dir, { recursive: true });
  const host = new URL(page.url).hostname.replace(/[^a-z0-9.-]+/gi, "_");
  const fileName = `${new Date().toISOString().replace(/[:.]/g, "-")}-${host}-${sha1(page.url).slice(0, 10)}.html`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, page.html || "", "utf8");
  return filePath;
}

function normalizeImportedJob(job, { targetTitle, location }) {
  const normalized = {
    title: String(job.title || "").trim(),
    company: String(job.company || "LinkedIn").trim(),
    location: String(job.location || location || "See job description").trim(),
    datePosted: String(job.datePosted || extractPostedDate(`${job.postedText || ""} ${job.description || ""}`) || "").trim(),
    description: String(job.description || job.excerpt || "").trim(),
    excerpt: String(job.excerpt || job.description || "").trim().slice(0, 700),
    url: String(job.url || "").trim(),
    source: String(job.source || "LinkedIn browser import").trim(),
    adapterName: "Browser LinkedIn import",
    sourceType: "browser-import",
    rawText: String(job.rawText || job.description || job.excerpt || "").trim(),
    easyApply: Boolean(job.easyApply),
    browserImport: {
      importedAt: new Date().toISOString(),
      platformJobId: String(job.platformJobId || "")
    },
    blocked: false,
    rendered: true,
    screenshotPath: "",
    extractionErrors: []
  };
  normalized.score = scoreJobForQuery(normalized, { targetTitle, location });
  normalized.classification = classifyJob(normalized);
  normalized.companyEnrichment = enrichCompany(normalized);
  return normalized;
}

async function importRunPath(runId) {
  const dir = path.join(__dirname, "..", "data", "import-runs");
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, `${runId}.json`);
}

async function saveImportRun(runId, payload) {
  const filePath = await importRunPath(runId);
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function loadImportRun(runId) {
  if (!/^[a-f0-9-]{20,}$/i.test(runId)) return null;
  try {
    return JSON.parse(await fs.readFile(await importRunPath(runId), "utf8"));
  } catch {
    return null;
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
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
