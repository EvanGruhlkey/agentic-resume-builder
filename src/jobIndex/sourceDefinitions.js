const CURRENT_YEAR = new Date().getFullYear();

export const GITHUB_SEARCH_TEMPLATES = [
  "site:github.com hiring {title}",
  "site:github.com internship {title}",
  'site:github.com "we\'re hiring" "{title}"',
  'site:github.com "new grad" "{title}"',
  'site:github.com "internship" "apply"',
  'site:github.com "careers" "{title}"',
  'site:github.com "jobs" "remote {title}"',
  `site:github.com "${CURRENT_YEAR} internship" "{title}"`,
  `site:github.com "summer ${CURRENT_YEAR}" "internship" "{title}"`,
  `site:github.com "${CURRENT_YEAR} new grad" "{title}"`
];

export const GITHUB_DISCOVERY_URLS = [
  "https://github.com/search?q=awesome+remote+jobs&type=repositories",
  "https://github.com/search?q=hiring&type=issues",
  "https://github.com/search?q=internship&type=repositories",
  "https://github.com/search?q=new+grad+software+engineer&type=repositories",
  "https://github.com/topics/jobs"
];

export const FAST_PUBLIC_JOB_SEEDS = [
  { name: "Anduril", url: "https://boards.greenhouse.io/andurilindustries" },
  { name: "Figma", url: "https://boards.greenhouse.io/figma" },
  { name: "Verkada", url: "https://boards.greenhouse.io/verkada" },
  { name: "OpenAI", url: "https://jobs.ashbyhq.com/openai" },
  { name: "Anthropic", url: "https://jobs.ashbyhq.com/anthropic" },
  { name: "Notion", url: "https://jobs.ashbyhq.com/notion" }
];

export const GENERAL_JOB_BOARD_DOMAINS = [
  "ziprecruiter.com",
  "monster.com",
  "careerbuilder.com",
  "simplyhired.com",
  "getwork.com",
  "job.com",
  "theladders.com",
  "nexxt.com",
  "jooble.org",
  "jora.com",
  "talent.com",
  "adzuna.com"
];

export const RESTRICTED_JOB_SOURCE_DOMAINS = [
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "simplify.jobs",
  "facebook.com",
  "x.com",
  "twitter.com"
];

export const MAJOR_HANDOFF_JOB_SOURCES = [
  {
    id: "linkedin",
    name: "LinkedIn",
    domains: ["linkedin.com"],
    reason:
      "LinkedIn restricts automated scraping. Open the result yourself, use LinkedIn's newest filter, then paste the visible job description back here for tailoring.",
    searchUrl: ({ targetTitle, location = "", recentWindowDays = 14 }) => {
      const params = new URLSearchParams({
        keywords: targetTitle,
        location: location || "United States",
        f_TPR: linkedInFreshnessParam(recentWindowDays)
      });
      return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
    },
    queryTemplates: [
      '"{title}" "{location}" site:linkedin.com/jobs/view',
      '"{title}" "{location}" "posted" site:linkedin.com/jobs/view',
      '"{title}" "{location}" "LinkedIn" "posted today"',
      '"{title}" "{location}" "LinkedIn" "newly posted"'
    ]
  },
  {
    id: "indeed",
    name: "Indeed",
    domains: ["indeed.com"],
    reason:
      "Indeed aggressively blocks automated scraping. Open the result yourself, keep sort by date enabled, then paste the visible job description back here for tailoring.",
    searchUrl: ({ targetTitle, location = "", recentWindowDays = 14 }) => {
      const params = new URLSearchParams({
        q: targetTitle,
        l: location || "United States",
        fromage: String(Math.max(1, Math.min(14, Number(recentWindowDays) || 14))),
        sort: "date"
      });
      return `https://www.indeed.com/jobs?${params.toString()}`;
    },
    queryTemplates: [
      '"{title}" "{location}" site:indeed.com/viewjob',
      '"{title}" "{location}" "date posted" site:indeed.com',
      '"{title}" "{location}" "Indeed" "posted today"',
      '"{title}" "{location}" "Indeed" "just posted"'
    ]
  }
];

export const REMOTE_BOARD_DOMAINS = [
  "weworkremotely.com",
  "remoteok.com",
  "remotive.com",
  "remote.co",
  "workingnomads.com",
  "himalayas.app",
  "nodesk.co",
  "justremote.co",
  "dynamitejobs.com",
  "remotehub.com",
  "skipthedrive.com",
  "virtualvocations.com",
  "pangian.com",
  "crossover.com"
];

export const NICHE_BOARD_DOMAINS = [
  "wellfound.com",
  "ycombinator.com",
  "builtin.com",
  "dice.com",
  "news.ycombinator.com",
  "welcometothejungle.com",
  "levels.fyi",
  "trueup.io",
  "hiretechladies.com",
  "crunchboard.com",
  "arc.dev",
  "turing.com",
  "devitjobs.com",
  "techfetch.com",
  "authenticjobs.com",
  "gun.io",
  "lemon.io",
  "dribbble.com",
  "behance.net",
  "aiga.org",
  "coroflot.com",
  "producthunt.com",
  "uxjobsboard.com",
  "salesjobs.com",
  "repvue.com",
  "marketinghire.com",
  "efinancialcareers.com",
  "roberthalf.com",
  "usajobs.gov",
  "governmentjobs.com",
  "idealist.org",
  "workforgood.org",
  "healthecareers.com",
  "higheredjobs.com",
  "lawjobs.com",
  "mediabistro.com",
  "poachedjobs.com",
  "snagajob.com",
  "craigslist.org"
];

export const ATS_DEFINITIONS = [
  ats("greenhouse", "Greenhouse", ["boards.greenhouse.io", "job-boards.greenhouse.io"], [/\/jobs\/\d+/i], [/^\/[^/]*$/]),
  ats("lever", "Lever", ["jobs.lever.co"], [/\/[^/]+\/[a-f0-9-]{20,}/i], [/^\/[^/]+\/?$/]),
  ats("ashby", "Ashby", ["jobs.ashbyhq.com"], [/\/[^/]+\/[a-f0-9-]{20,}/i], [/^\/[^/]+\/?$/]),
  ats("workday", "Workday", ["myworkdayjobs.com", "wd1.myworkdaysite.com", "wd5.myworkdaysite.com"], [/\/job\//i, /\/jobs\//i], [/\/search/i]),
  ats("icims", "iCIMS", ["icims.com"], [/\/jobs\/\d+\//i], [/\/jobs\/search/i]),
  ats("smartrecruiters", "SmartRecruiters", ["jobs.smartrecruiters.com", "careers.smartrecruiters.com"], [/\/[^/]+\/\d+/i], [/\/[^/]+\/?$/]),
  ats("jobvite", "Jobvite", ["jobs.jobvite.com"], [/\/job\/[A-Za-z0-9]+/i], [/\/careers\//i]),
  ats("bamboohr", "BambooHR", ["bamboohr.com"], [/\/careers\/\d+/i, /\/jobs\/view\.php/i], [/\/careers/i]),
  ats("workable", "Workable", ["apply.workable.com"], [/\/j\/[A-Z0-9]+/i], [/^\/[^/]+\/?$/]),
  ats("zoho", "Zoho Recruit", ["zohorecruit.com", "zoho.com"], [/\/jobs\/[A-Za-z0-9-]+/i], [/\/recruit/i]),
  ats("recruitee", "Recruitee", ["recruitee.com"], [/\/o\//i], [/\/c\//i]),
  ats("teamtailor", "Teamtailor", ["teamtailor.com"], [/\/jobs\/\d+/i], [/\/jobs/i]),
  ats("breezyhr", "BreezyHR", ["breezy.hr"], [/\/p\/[a-f0-9]+/i], [/\/$/]),
  ats("jazzhr", "JazzHR", ["applytojob.com", "jazzhr.com"], [/\/apply\//i, /\/job\//i], [/\/jobs/i]),
  ats("paylocity", "Paylocity", ["paylocity.com"], [/\/requisition\//i, /\/jobs\//i], [/\/careers/i]),
  ats("paycom", "Paycom", ["paycomonline.net", "paycom.com"], [/\/jobs\/detail\//i], [/\/jobs/i]),
  ats("ukg", "UKG", ["ultipro.com", "ukg.com"], [/\/OpportunityDetail/i, /\/jobs\//i], [/\/jobs/i]),
  ats("adp", "ADP", ["adp.com"], [/\/jobs\/[A-Za-z0-9-]+/i], [/\/jobs/i]),
  ats("taleo", "Oracle Taleo", ["taleo.net"], [/\/jobdetail\.ftl/i], [/\/careersection\//i]),
  ats("successfactors", "SAP SuccessFactors", ["successfactors.com"], [/\/job\//i], [/\/career/i]),
  ats("dayforce", "Dayforce", ["dayforcehcm.com", "dayforce.com"], [/\/CandidatePortal\/.*\/Posting\/View\//i], [/\/CandidatePortal/i]),
  ats("rippling", "Rippling", ["rippling.com"], [/\/careers\/jobs\//i], [/\/careers/i]),
  ats("personio", "Personio", ["jobs.personio.com", "personio.com"], [/\/job\/\d+/i], [/\/jobs/i]),
  ats("pinpoint", "Pinpoint", ["pinpointhq.com"], [/\/jobs\/\d+/i], [/\/jobs/i]),
  ats("fountain", "Fountain", ["fountain.com"], [/\/jobs\//i], [/\/jobs/i]),
  ats("recruiterflow", "Recruiterflow", ["recruiterflow.com"], [/\/jobs\//i], [/\/jobs/i]),
  ats("comeet", "Comeet", ["comeet.com"], [/\/jobs\/[^/]+\/[A-Z0-9.]+/i], [/\/jobs/i])
];

export function sourceDefinitionForUrl(url) {
  const hostname = hostnameOf(url);
  const pathname = pathnameOf(url);
  return ATS_DEFINITIONS.find((source) =>
    source.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) &&
    [...source.detailPathPatterns, ...source.listingPathPatterns].some((pattern) => pattern.test(pathname))
  );
}

export function renderTemplate(template, { targetTitle, location = "" }) {
  return template
    .replaceAll("{title}", targetTitle)
    .replaceAll("{location}", location || "United States")
    .replaceAll("{year}", String(CURRENT_YEAR));
}

function linkedInFreshnessParam(windowDays) {
  const days = Number(windowDays) || 14;
  if (days <= 1) return "r86400";
  if (days <= 7) return "r604800";
  return "r2592000";
}

function ats(id, name, domains, detailPathPatterns, listingPathPatterns) {
  return { id, name, domains, detailPathPatterns, listingPathPatterns };
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function pathnameOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}
