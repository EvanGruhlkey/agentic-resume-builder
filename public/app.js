const form = document.querySelector("#searchForm");
const statusStrip = document.querySelector("#statusStrip");
const statusDot = document.querySelector(".status-dot");
const jobsList = document.querySelector("#jobsList");
const jobCount = document.querySelector("#jobCount");
const jobDetail = document.querySelector("#jobDetail");
const agentGrid = document.querySelector("#agentGrid");
const copyBtn = document.querySelector("#copyBtn");
const downloadBtn = document.querySelector("#downloadBtn");
const jobLink = document.querySelector("#jobLink");
const agenticBtn = document.querySelector("#agenticBtn");
const browserAgentPanel = document.querySelector("#browserAgentPanel");
const browserAgentStatus = document.querySelector("#browserAgentStatus");
const browserAgentLogs = document.querySelector("#browserAgentLogs");
const resumeAgentBtn = document.querySelector("#resumeAgentBtn");
const stopAgentBtn = document.querySelector("#stopAgentBtn");
const sourceConfigList = document.querySelector("#sourceConfigList");

let currentJobs = [];
let selectedJob = null;
let currentResumeText = "";
let agenticSessionId = null;
let agenticPollTimer = null;

loadSourceConfig();
loadImportRunFromUrl();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearResults();

  const formData = new FormData(form);
  const allSources = form.querySelector("#searchAllSources").checked;
  const recentOnly = form.querySelector("#recentOnly").checked;
  const recentWindowDays = form.querySelector("#recentWindowDays").value || "14";
  formData.set("searchAllSources", String(allSources));
  formData.set("recentOnly", String(recentOnly));
  formData.set("recentWindowDays", recentWindowDays);
  setBusy(
    true,
    allSources
      ? `Searching every configured board for jobs posted in the last ${recentWindowDays} days. This can take a bit...`
      : recentOnly
        ? `Agents are searching for jobs posted in the last ${recentWindowDays} days...`
        : "Agents are searching public job pages..."
  );

  try {
    const response = await fetch("/api/search", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Search failed.");
    }

    currentResumeText = payload.resume?.text || String(formData.get("resumeText") || "");
    currentJobs = payload.jobs || [];
    renderAgentReports(payload.agentReports || [], payload.coordinator);
    renderJobs(currentJobs);

    if (currentJobs.length) {
      selectJob(currentJobs[0].url);
      setBusy(false, `Found ${currentJobs.length} recent public job matches for ${payload.targetTitle}.`);
    } else {
      setBusy(false, "No strong public matches found. Try a broader title or location.");
    }
  } catch (error) {
    setBusy(false, error.message, true);
  }
});

copyBtn.addEventListener("click", async () => {
  if (!selectedJob) return;
  await navigator.clipboard.writeText(selectedJob.tailoring.tailoredResumeMarkdown);
  setBusy(false, "Tailored resume copied.");
});

downloadBtn.addEventListener("click", () => {
  if (!selectedJob) return;
  const filename = `${slugify(selectedJob.company)}-${slugify(selectedJob.title)}-tailored-resume.md`;
  const blob = new Blob([selectedJob.tailoring.tailoredResumeMarkdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
});

agenticBtn.addEventListener("click", startAgenticSearch);
resumeAgentBtn.addEventListener("click", resumeAgenticSearch);
stopAgentBtn.addEventListener("click", stopAgenticSearch);

async function loadSourceConfig() {
  try {
    const response = await fetch("/api/sources");
    const payload = await response.json();
    sourceConfigList.innerHTML = (payload.sources || [])
      .map((source) => `
        <div class="source-row">
          <strong>${escapeHtml(source.name)}</strong>
          <span>${escapeHtml(source.mode)} · ${escapeHtml(source.type || "adapter")}</span>
        </div>
      `)
      .join("");
  } catch {
    sourceConfigList.textContent = "Source config unavailable.";
  }
}

async function loadImportRunFromUrl() {
  const runId = new URLSearchParams(window.location.search).get("importRun");
  if (!runId) return;

  clearResults();
  setBusy(true, "Loading imported LinkedIn jobs...");

  try {
    const response = await fetch(`/api/import/runs/${encodeURIComponent(runId)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load imported jobs.");

    currentResumeText = payload.resumeText || "";
    currentJobs = payload.jobs || [];
    renderJobs(currentJobs);
    if (currentJobs.length) {
      selectJob(currentJobs[0].url);
      setBusy(false, `Loaded ${currentJobs.length} imported LinkedIn jobs.`);
    } else {
      setBusy(false, "The import run did not include any jobs.", true);
    }
  } catch (error) {
    setBusy(false, error.message, true);
  }
}

async function startAgenticSearch() {
  setBusy(true, "Launching browser agents for public pages. Login and verification pages will be skipped.");
  clearResults();
  browserAgentPanel.hidden = false;
  browserAgentStatus.textContent = "Starting headed browser agents...";
  browserAgentLogs.innerHTML = "";

  const formData = new FormData(form);

  try {
    const response = await fetch("/api/agentic/start", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not start browser agents.");

    currentResumeText = payload.resume?.text || String(formData.get("resumeText") || "");
    agenticSessionId = payload.session.id;
    renderAgenticSession(payload.session);
    startAgenticPolling();
  } catch (error) {
    setBusy(false, error.message, true);
  }
}

function startAgenticPolling() {
  clearInterval(agenticPollTimer);
  agenticPollTimer = setInterval(pollAgenticSession, 1800);
  pollAgenticSession();
}

async function pollAgenticSession() {
  if (!agenticSessionId) return;

  try {
    const response = await fetch(`/api/agentic/${agenticSessionId}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Browser-agent session not found.");
    renderAgenticSession(payload.session);
  } catch (error) {
    clearInterval(agenticPollTimer);
    setBusy(false, error.message, true);
  }
}

async function resumeAgenticSearch() {
  if (!agenticSessionId) return;
  await fetch(`/api/agentic/${agenticSessionId}/resume`, { method: "POST" });
  await pollAgenticSession();
}

async function stopAgenticSearch() {
  if (!agenticSessionId) return;
  await fetch(`/api/agentic/${agenticSessionId}/stop`, { method: "POST" });
  await pollAgenticSession();
}

function renderAgenticSession(session) {
  browserAgentPanel.hidden = false;
  resumeAgentBtn.hidden = session.status !== "waiting_for_user";
  currentJobs = session.jobs || [];
  renderJobs(currentJobs);
  if (currentJobs.length && !selectedJob) selectJob(currentJobs[0].url);

  const waiting = session.waitingForUser;
  browserAgentStatus.innerHTML = waiting
    ? `
        <strong>Waiting for you</strong>
        <p>${escapeHtml(waiting.message)}</p>
        <a href="${escapeAttr(waiting.url)}" target="_blank" rel="noreferrer">Open current page</a>
      `
    : `
        <strong>${escapeHtml(titleCaseStatus(session.status))}</strong>
        <p>${session.browserOpen ? "A Playwright browser is checking public pages and skipping restricted pages." : "Browser agents are not currently active."}</p>
      `;

  browserAgentLogs.innerHTML = (session.logs || [])
    .slice(-18)
    .map((entry) => `<div class="log-line log-${escapeAttr(entry.type)}"><span>${new Date(entry.at).toLocaleTimeString()}</span>${escapeHtml(entry.message)}</div>`)
    .join("");

  if (["complete", "error", "stopped"].includes(session.status)) {
    clearInterval(agenticPollTimer);
    setBusy(false, session.error || `Browser-agent search ${session.status}.`);
  } else if (session.status === "waiting_for_user") {
    setBusy(false, "Browser agent is waiting for you to complete a human step.");
  } else {
    setBusy(true, "Browser agents are searching like a user...");
  }
}

function renderAgentReports(reports, coordinator) {
  const coordinatorCard = coordinator
    ? `
        <div class="agent-card coordinator-card">
          <strong>${coordinator.mode === "llm" ? "LLM coordinator" : "Rule coordinator"}</strong>
          <span>${coordinator.model ? escapeHtml(coordinator.model) : "no API key"} - ${escapeHtml((coordinator.notes || []).join(" "))}</span>
        </div>
      `
    : "";

  agentGrid.innerHTML = reports
    .map(
      (report) => `
        <div class="agent-card">
          <strong>${escapeHtml(report.name)}</strong>
          <span>${escapeHtml(report.mode || "fetch")} - ${report.results} matches from ${report.searched} links - ${(report.elapsedMs / 1000).toFixed(1)}s</span>
        </div>
      `
    )
    .join("") + coordinatorCard;
}

function renderJobs(jobs) {
  jobCount.textContent = `${jobs.length} found`;

  if (!jobs.length) {
    jobsList.className = "jobs-list empty-state";
    jobsList.textContent = "No matches yet.";
    return;
  }

  jobsList.className = "jobs-list";
  jobsList.innerHTML = jobs
    .map(
      (job) => `
        <button class="job-card" type="button" data-url="${escapeAttr(job.url)}">
          <h3>${escapeHtml(job.title)}</h3>
          <div class="job-meta">
            <span>${escapeHtml(job.company)}</span>
            <span>${escapeHtml(job.location)}</span>
            <span>${escapeHtml(formatPostedDate(job.datePosted))}</span>
          </div>
          <div class="job-meta">
            <span class="badge">${escapeHtml(job.source || job.adapterName || job.sourceType || "public source")}</span>
            <span class="badge">score ${job.score}</span>
          </div>
        </button>
      `
    )
    .join("");

  jobsList.querySelectorAll(".job-card").forEach((button) => {
    button.addEventListener("click", () => selectJob(button.dataset.url));
  });
}

function selectJob(url) {
  selectedJob = currentJobs.find((job) => job.url === url);
  if (!selectedJob) return;

  jobsList.querySelectorAll(".job-card").forEach((button) => {
    button.classList.toggle("active", button.dataset.url === url);
  });

  if (selectedJob.sourceType === "handoff" || selectedJob.handoff?.needsUser) {
    renderHandoffJobDetail();
    return;
  }

  const tailoring = selectedJob.tailoring;
  const matchedSkills = tailoring?.matchedSkills || [];
  const transferableKeywords = tailoring?.transferableKeywords || [];
  const missingKeywords = tailoring?.missingKeywords || [];
  const methodBadge = tailoring?.method === "llm"
    ? `<span class="badge">LLM tailored</span>`
    : `<span class="badge">rule tailored</span>`;
  jobDetail.className = "job-detail";
  jobDetail.innerHTML = `
    <div class="detail-header">
      <h3>${escapeHtml(selectedJob.title)}</h3>
      <div class="job-meta">
        <span>${escapeHtml(selectedJob.company)}</span>
        <span>${escapeHtml(selectedJob.location)}</span>
        <span>${escapeHtml(formatPostedDate(selectedJob.datePosted))}</span>
        ${methodBadge}
      </div>
      <p>${escapeHtml(selectedJob.excerpt)}...</p>
    </div>

    <div>
      <h2>Matched Skills</h2>
      <div class="keyword-row">
        ${renderBadges(matchedSkills.length ? matchedSkills : transferableKeywords)}
      </div>
    </div>

    <div>
      <h2>Keywords To Review</h2>
      <div class="keyword-row missing">
        ${renderBadges(missingKeywords)}
      </div>
    </div>

    <textarea class="resume-output" spellcheck="true">${escapeTextarea(tailoring?.tailoredResumeMarkdown || selectedJob.description || "")}</textarea>
  `;

  const textarea = jobDetail.querySelector(".resume-output");
  textarea.addEventListener("input", () => {
    if (!selectedJob.tailoring) selectedJob.tailoring = {};
    selectedJob.tailoring.tailoredResumeMarkdown = textarea.value;
  });

  copyBtn.disabled = false;
  downloadBtn.disabled = false;
  jobLink.href = selectedJob.url;
  jobLink.classList.remove("disabled");
}

function renderHandoffJobDetail() {
  const openUrl = selectedJob.handoff?.searchUrl || selectedJob.url;
  jobDetail.className = "job-detail";
  jobDetail.innerHTML = `
    <div class="detail-header">
      <h3>${escapeHtml(selectedJob.title)}</h3>
      <div class="job-meta">
        <span>${escapeHtml(selectedJob.company)}</span>
        <span>${escapeHtml(selectedJob.location)}</span>
        <span>${escapeHtml(formatPostedDate(selectedJob.datePosted))}</span>
        <span class="badge handoff-badge">review on site</span>
      </div>
      <p>${escapeHtml(selectedJob.excerpt)}...</p>
    </div>

    <div class="handoff-notice">
      <strong>${escapeHtml(selectedJob.handoff?.actionLabel || "Open source")}</strong>
      <p>${escapeHtml(selectedJob.handoff?.reason || "This job board needs user-controlled review before tailoring.")}</p>
      <a href="${escapeAttr(openUrl)}" target="_blank" rel="noreferrer">Open recent search</a>
    </div>

    <div class="html-capture-panel">
      <button id="fetchMajorBoardHtmlBtn" class="secondary-action" type="button">Fetch recent page HTML</button>
      <div id="majorBoardHtmlStatus" class="capture-status">No HTML captured yet.</div>
      <div id="majorBoardHtmlResult"></div>
    </div>

    <label class="manual-description-label" for="manualDescription">
      Paste job description
      <textarea id="manualDescription" class="manual-description" rows="10" placeholder="Paste the visible job description from ${escapeAttr(selectedJob.company)} here..."></textarea>
    </label>
    <button id="manualTailorBtn" class="primary-action" type="button">Tailor from pasted description</button>
  `;

  jobDetail.querySelector("#fetchMajorBoardHtmlBtn").addEventListener("click", fetchMajorBoardHtml);
  jobDetail.querySelector("#manualTailorBtn").addEventListener("click", tailorFromManualDescription);
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
  jobLink.href = selectedJob.url;
  jobLink.classList.remove("disabled");
}

async function fetchMajorBoardHtml() {
  if (!selectedJob) return;
  const button = jobDetail.querySelector("#fetchMajorBoardHtmlBtn");
  const status = jobDetail.querySelector("#majorBoardHtmlStatus");
  const result = jobDetail.querySelector("#majorBoardHtmlResult");
  const url = selectedJob.handoff?.searchUrl || selectedJob.url;

  button.disabled = true;
  status.textContent = "Opening the recent-search page and copying rendered HTML...";
  result.innerHTML = "";

  try {
    const response = await fetch("/api/major-board/snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || payload.detail || "Snapshot failed.");

    const blockedText = payload.blocked
      ? "The page looks blocked or login-gated; captured the visible blocked HTML."
      : "Captured accessible rendered HTML.";
    status.textContent = `${blockedText} Saved ${payload.htmlLength.toLocaleString()} characters.`;
    result.innerHTML = `
      <div class="capture-meta">
        <span class="badge">${payload.rendered ? "rendered" : "static"}</span>
        <span class="badge">${payload.blocked ? "blocked/login page" : "public page"}</span>
      </div>
      <label class="manual-description-label" for="capturedHtml">
        Captured HTML
        <textarea id="capturedHtml" class="html-output" spellcheck="false">${escapeTextarea(payload.html)}</textarea>
      </label>
      <div class="capture-actions">
        <button id="copyCapturedHtmlBtn" class="secondary-action" type="button">Copy HTML</button>
      </div>
      <div class="capture-paths">
        <div><strong>Saved:</strong> ${escapeHtml(payload.snapshotPath)}</div>
        ${payload.screenshotPath ? `<div><strong>Screenshot:</strong> ${escapeHtml(payload.screenshotPath)}</div>` : ""}
      </div>
      ${renderCapturedLinks(payload.links || [])}
    `;
    result.querySelector("#copyCapturedHtmlBtn").addEventListener("click", async () => {
      await navigator.clipboard.writeText(payload.html || "");
      status.textContent = "Captured HTML copied.";
    });
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("error");
  } finally {
    button.disabled = false;
  }
}

function renderCapturedLinks(links) {
  if (!links.length) {
    return `<div class="capture-links empty-state">No recent job links were visible in the captured HTML.</div>`;
  }
  return `
    <div class="capture-links">
      <strong>Links found in captured HTML</strong>
      ${links.map((link) => `
        <a href="${escapeAttr(link.url)}" target="_blank" rel="noreferrer">
          ${escapeHtml(link.title || link.url)}
        </a>
      `).join("")}
    </div>
  `;
}

async function tailorFromManualDescription() {
  const description = jobDetail.querySelector("#manualDescription")?.value.trim();
  const resumeText = currentResumeText || form.querySelector("#resumeText")?.value.trim();

  if (!description || description.length < 200) {
    setBusy(false, "Paste a fuller job description before tailoring.", true);
    return;
  }

  if (!resumeText || resumeText.length < 80) {
    setBusy(false, "Resume text is missing. Paste your resume and try again.", true);
    return;
  }

  setBusy(true, "Tailoring from the pasted job description...");

  try {
    const response = await fetch("/api/tailor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resumeText,
        targetTitle: form.querySelector("#targetTitle").value,
        job: {
          ...selectedJob,
          description,
          excerpt: description.slice(0, 700),
          sourceType: "manual"
        }
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Tailoring failed.");

    selectedJob.description = description;
    selectedJob.excerpt = description.slice(0, 700);
    selectedJob.sourceType = "manual";
    selectedJob.tailoring = payload.tailoring;
    selectJob(selectedJob.url);
    setBusy(false, "Tailored from the pasted job description.");
  } catch (error) {
    setBusy(false, error.message, true);
  }
}

function renderBadges(items) {
  if (!items?.length) return `<span class="badge">None detected</span>`;
  return items.map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join("");
}

function clearResults() {
  currentJobs = [];
  selectedJob = null;
  agentGrid.innerHTML = "";
  jobCount.textContent = "0 found";
  jobsList.className = "jobs-list empty-state";
  jobsList.textContent = "Searching...";
  jobDetail.className = "job-detail empty-state";
  jobDetail.textContent = "Tailored resumes will appear after the agents return.";
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
  jobLink.removeAttribute("href");
  jobLink.classList.add("disabled");
}

function setBusy(isBusy, message, isError = false) {
  form.querySelector(".primary-action").disabled = isBusy;
  agenticBtn.disabled = isBusy;
  statusDot.classList.toggle("busy", isBusy);
  statusStrip.classList.toggle("error", isError);
  statusStrip.lastChild.textContent = ` ${message}`;
}

function titleCaseStatus(value) {
  return String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function formatPostedDate(value) {
  if (!value) return "date unknown";
  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "date unknown";
  return `posted ${parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  })}`;
}

function slugify(value) {
  return String(value || "resume")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function escapeTextarea(value) {
  return String(value || "").replace(/<\/textarea/gi, "<\\/textarea");
}
