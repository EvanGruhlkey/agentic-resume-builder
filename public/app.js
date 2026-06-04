const form = document.querySelector("#searchForm");
const statusStrip = document.querySelector("#statusStrip");
const statusDot = document.querySelector(".status-dot");
const statusText = document.querySelector(".status-text");
const jobsList = document.querySelector("#jobsList");
const jobCount = document.querySelector("#jobCount");
const jobDetail = document.querySelector("#jobDetail");
const jobLink = document.querySelector("#jobLink");
const sortRecentBtn = document.querySelector("#sortRecentBtn");

let currentJobs = [];
let selectedJob = null;
let sortBy = "score";

sortRecentBtn.addEventListener("click", () => {
  sortBy = sortBy === "recent" ? "score" : "recent";
  updateSortButton();
  applySort();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearResults();

  const requestedJobs = Number(form.maxJobs.value) || 25;
  setBusy(true, `Searching for up to ${requestedJobs} job matches...`);

  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetTitle: form.targetTitle.value.trim(),
        location: form.location.value.trim(),
        maxJobs: requestedJobs
      })
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Search failed.");
    }

    currentJobs = payload.jobs || [];
    sortBy = "score";
    updateSortButton();
    renderJobs(currentJobs);

    if (currentJobs.length) {
      selectJob(currentJobs[0].url);
      const requested = payload.requestedJobs || requestedJobs;
      const statusMessage = currentJobs.length >= requested
        ? `Found ${currentJobs.length} matches for ${payload.targetTitle}.`
        : `Found ${currentJobs.length} of ${requested} requested for ${payload.targetTitle}.`;
      setBusy(false, statusMessage);
    } else {
      setBusy(false, "No matches found. Try a broader title or location.");
    }
  } catch (error) {
    setBusy(false, error.message, true);
  }
});

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
            <span class="meta-separator" aria-hidden="true"></span>
            <span>${escapeHtml(job.location)}</span>
            <span class="meta-separator" aria-hidden="true"></span>
            <span>${escapeHtml(formatPostedDate(job.datePosted))}</span>
          </div>
          <div class="job-meta">
            <span class="badge source-badge">${escapeHtml(formatJobSource(job))}</span>
            <span class="badge">score ${job.score ?? 0}</span>
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
    button.setAttribute("aria-current", button.dataset.url === url ? "true" : "false");
  });

  const summary = selectedJob.excerpt || selectedJob.description || "No description available.";
  jobDetail.className = "card job-detail";
  jobDetail.innerHTML = `
    <div class="detail-header">
      <h3>${escapeHtml(selectedJob.title)}</h3>
      <div class="job-meta">
        <span>${escapeHtml(selectedJob.company)}</span>
        <span class="meta-separator" aria-hidden="true"></span>
        <span>${escapeHtml(selectedJob.location)}</span>
        <span class="meta-separator" aria-hidden="true"></span>
        <span>${escapeHtml(formatPostedDate(selectedJob.datePosted))}</span>
      </div>
      <div class="job-meta">
        <span class="badge source-badge">${escapeHtml(formatJobSource(selectedJob))}</span>
      </div>
    </div>
    <div class="job-description">${escapeHtml(summary)}</div>
  `;

  jobLink.href = selectedJob.url;
  jobLink.classList.remove("disabled");
  jobLink.removeAttribute("aria-disabled");
}

function applySort() {
  if (!currentJobs.length) return;

  const selectedUrl = selectedJob?.url;
  const sorted = [...currentJobs].sort(compareJobsForSort);
  currentJobs = sorted;
  renderJobs(currentJobs);

  if (selectedUrl && currentJobs.some((job) => job.url === selectedUrl)) {
    selectJob(selectedUrl);
  } else if (currentJobs.length) {
    selectJob(currentJobs[0].url);
  }
}

function compareJobsForSort(a, b) {
  if (sortBy === "recent") {
    return postedTime(b.datePosted) - postedTime(a.datePosted) || (b.score || 0) - (a.score || 0);
  }
  return (b.score || 0) - (a.score || 0) || postedTime(b.datePosted) - postedTime(a.datePosted);
}

function postedTime(value) {
  if (!value) return 0;
  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
}

function updateSortButton() {
  const hasJobs = currentJobs.length > 0;
  sortRecentBtn.disabled = !hasJobs;
  sortRecentBtn.classList.toggle("active", sortBy === "recent");
  sortRecentBtn.textContent = sortBy === "recent" ? "Best match" : "Most recent";
  sortRecentBtn.setAttribute("aria-pressed", String(sortBy === "recent"));
}

function clearResults() {
  currentJobs = [];
  selectedJob = null;
  sortBy = "score";
  updateSortButton();
  jobCount.textContent = "0 found";
  jobsList.className = "jobs-list empty-state";
  jobsList.textContent = "Searching...";
  jobDetail.className = "card job-detail empty-state";
  jobDetail.textContent = "Select a job to read the listing summary.";
  jobLink.removeAttribute("href");
  jobLink.classList.add("disabled");
  jobLink.setAttribute("aria-disabled", "true");
}

function setBusy(isBusy, message, isError = false) {
  form.querySelector(".search-button").disabled = isBusy;
  statusDot.classList.toggle("busy", isBusy);
  statusStrip.classList.toggle("error", isError);
  statusText.textContent = message;
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

function formatJobSource(job) {
  const source = String(job?.source || job?.adapterName || job?.sourceType || "").trim();
  if (!source) return "Unknown source";
  return source
    .replace(/\s+visible listings$/i, "")
    .replace(/^JobSpy-style\s+/i, "")
    .replace(/^Generic\s+/i, "")
    .replace(/\s+discovery$/i, "")
    .trim();
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
