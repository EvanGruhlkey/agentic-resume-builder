import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJobKey, compareJobsByFreshness, matchesQueryIntent, normalizeUrl, sha1 } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const SNAPSHOT_DIR = path.join(DATA_DIR, "raw-job-snapshots");
const DB_PATH = path.join(DATA_DIR, "job-index.json");

export async function loadJobDatabase() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    return JSON.parse(await fs.readFile(DB_PATH, "utf8"));
  } catch {
    return { version: 1, jobs: [], runs: [] };
  }
}

export async function saveJobDatabase(database) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_PATH, `${JSON.stringify(database, null, 2)}\n`, "utf8");
}

export async function upsertJobs(jobs, { runId, sourceNames = [], searchKey = "" } = {}) {
  const database = await loadJobDatabase();
  const now = new Date().toISOString();
  const seenKeys = new Set();
  const byKey = new Map(database.jobs.map((job) => [job.canonicalKey, job]));
  const saved = [];

  for (const job of jobs) {
    const canonicalKey = canonicalJobKey(job);
    seenKeys.add(canonicalKey);
    const existing = byKey.get(canonicalKey);
    const rawSnapshotPath = await saveRawSnapshot(job, { runId, canonicalKey });
    const next = {
      ...(existing || {}),
      ...job,
      id: existing?.id || sha1(canonicalKey).slice(0, 16),
      canonicalKey,
      url: normalizeUrl(job.url),
      active: true,
      firstSeen: existing?.firstSeen || now,
      lastSeen: now,
      seenRunIds: uniqueStrings([...(existing?.seenRunIds || []), runId].filter(Boolean)).slice(-30),
      searchKeys: uniqueStrings([...(existing?.searchKeys || []), searchKey].filter(Boolean)).slice(-20),
      rawSnapshotPath,
      sourceHistory: uniqueStrings([...(existing?.sourceHistory || []), job.source || job.adapterName || ""].filter(Boolean))
    };
    byKey.set(canonicalKey, next);
    saved.push(next);
  }

  for (const job of byKey.values()) {
    const sameSource = sourceNames.length && sourceNames.some((name) => job.sourceHistory?.includes(name) || job.source === name);
    const sameSearch = searchKey && job.searchKeys?.includes(searchKey);
    if (sameSource && sameSearch && !seenKeys.has(job.canonicalKey) && job.active) {
      job.active = false;
      job.inactivatedAt = now;
    }
  }

  database.jobs = [...byKey.values()].sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)));
  database.runs = [
    ...(database.runs || []),
    {
      id: runId,
      at: now,
      sourceNames,
      indexed: saved.length,
      activeTotal: database.jobs.filter((job) => job.active).length
    }
  ].slice(-50);

  await saveJobDatabase(database);
  return saved;
}

export async function searchJobDatabase({ query = "", location = "", activeOnly = true, limit = 50 } = {}) {
  const database = await loadJobDatabase();
  const terms = String(query || "").toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  const locationTerms = String(location || "").toLowerCase().split(/\W+/).filter((term) => term.length > 2);

  return database.jobs
    .filter((job) => !activeOnly || job.active)
    .filter((job) => !query || matchesQueryIntent(job, { targetTitle: query, location }))
    .map((job) => ({ job, score: scoreIndexedJob(job, terms, locationTerms) }))
    .filter(({ score }) => !terms.length || score > 0)
    .sort((a, b) => compareJobsByFreshness(a.job, b.job) || b.score - a.score || String(b.job.lastSeen).localeCompare(String(a.job.lastSeen)))
    .slice(0, limit)
    .map(({ job, score }) => ({ ...job, score: Math.max(job.score || 0, score) }));
}

export async function getIndexedJob(id) {
  const database = await loadJobDatabase();
  return database.jobs.find((job) => job.id === id || job.canonicalKey === id || normalizeUrl(job.url) === normalizeUrl(id)) || null;
}

async function saveRawSnapshot(job, { runId, canonicalKey }) {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
  const fileName = `${new Date().toISOString().replace(/[:.]/g, "-")}-${sha1(`${runId}-${canonicalKey}`).slice(0, 12)}.txt`;
  const filePath = path.join(SNAPSHOT_DIR, fileName);
  const snapshot = [
    `URL: ${job.url || ""}`,
    `Title: ${job.title || ""}`,
    `Company: ${job.company || ""}`,
    `Source: ${job.source || job.adapterName || ""}`,
    "",
    job.rawText || job.description || ""
  ].join("\n");
  await fs.writeFile(filePath, snapshot, "utf8");
  return filePath;
}

function scoreIndexedJob(job, terms, locationTerms) {
  const text = `${job.title || ""} ${job.company || ""} ${job.location || ""} ${job.description || ""} ${(job.classification || []).join(" ")}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (String(job.title || "").toLowerCase().includes(term)) score += 14;
    else if (text.includes(term)) score += 5;
  }
  for (const term of locationTerms) {
    if (text.includes(term)) score += 4;
  }
  if (job.active) score += 6;
  return score;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}
