import {
  directoryQueriesForSearch,
  externalBoardCatalogForClient,
  externalBoardForUrl
} from "./jobBoardDirectory.js";

const CURRENT_YEAR = new Date().getFullYear();

export const JOB_SOURCES = [
  {
    id: "lever",
    name: "Lever",
    mode: "fetch",
    sourcePageExamples: ["https://jobs.lever.co/{company}"],
    detailUrlPatterns: [/^https:\/\/jobs\.lever\.co\/[^/]+\/[a-f0-9-]{20,}(?:\/apply)?/i],
    listingUrlPatterns: [/^https:\/\/jobs\.lever\.co\/[^/]+\/?$/i],
    queryTemplates: [
      '"{title}" "{location}" site:jobs.lever.co',
      '"{title}" "{location}" "{year}" "apply" site:jobs.lever.co',
      '"{title}" "{location}" "posted" site:jobs.lever.co'
    ]
  },
  {
    id: "greenhouse",
    name: "Greenhouse",
    mode: "fetch",
    sourcePageExamples: ["https://boards.greenhouse.io/{company}", "https://job-boards.greenhouse.io/{company}"],
    detailUrlPatterns: [
      /^https:\/\/boards\.greenhouse\.io\/[^/]+\/jobs\/\d+/i,
      /^https:\/\/job-boards\.greenhouse\.io\/[^/]+\/jobs\/\d+/i
    ],
    listingUrlPatterns: [
      /^https:\/\/boards\.greenhouse\.io\/[^/]+\/?$/i,
      /^https:\/\/job-boards\.greenhouse\.io\/[^/]+\/?$/i
    ],
    queryTemplates: [
      '"{title}" "{location}" site:boards.greenhouse.io',
      '"{title}" "{location}" site:job-boards.greenhouse.io',
      '"{title}" "{location}" "{year}" "apply" site:boards.greenhouse.io OR site:job-boards.greenhouse.io'
    ]
  },
  {
    id: "ashby",
    name: "Ashby",
    mode: "fetch",
    sourcePageExamples: ["https://jobs.ashbyhq.com/{company}"],
    detailUrlPatterns: [/^https:\/\/jobs\.ashbyhq\.com\/[^/]+\/[a-f0-9-]{20,}/i],
    listingUrlPatterns: [/^https:\/\/jobs\.ashbyhq\.com\/[^/]+\/?$/i],
    queryTemplates: [
      '"{title}" "{location}" site:jobs.ashbyhq.com',
      '"{title}" "{location}" "{year}" site:jobs.ashbyhq.com',
      '"{title}" "{location}" "posted" site:jobs.ashbyhq.com'
    ]
  },
  {
    id: "workable",
    name: "Workable",
    mode: "fetch",
    sourcePageExamples: ["https://apply.workable.com/{company}"],
    detailUrlPatterns: [/^https:\/\/apply\.workable\.com\/[^/]+\/j\/[A-Z0-9]+/i],
    listingUrlPatterns: [/^https:\/\/apply\.workable\.com\/[^/]+\/?$/i],
    queryTemplates: [
      '"{title}" "{location}" site:apply.workable.com',
      '"{title}" "{location}" "{year}" site:apply.workable.com',
      '"{title}" "{location}" "Posted" site:apply.workable.com'
    ]
  },
  {
    id: "smartrecruiters",
    name: "SmartRecruiters",
    mode: "fetch",
    sourcePageExamples: ["https://jobs.smartrecruiters.com/{company}"],
    detailUrlPatterns: [/^https:\/\/jobs\.smartrecruiters\.com\/[^/]+\/\d+/i],
    listingUrlPatterns: [/^https:\/\/jobs\.smartrecruiters\.com\/[^/]+\/?$/i],
    queryTemplates: [
      '"{title}" "{location}" site:jobs.smartrecruiters.com',
      '"{title}" "{location}" "{year}" site:jobs.smartrecruiters.com',
      '"{title}" "{location}" "SmartRecruiters" "apply"'
    ]
  },
  {
    id: "amazon",
    name: "Amazon Jobs",
    mode: "fetch",
    sourcePageExamples: ["https://amazon.jobs/en/search"],
    detailUrlPatterns: [/^https:\/\/amazon\.jobs\/(?:[a-z]{2}\/)?jobs\/\d+/i],
    listingUrlPatterns: [/^https:\/\/amazon\.jobs\/(?:[a-z]{2}\/)?search/i],
    queryTemplates: [
      '"{title}" "{location}" site:amazon.jobs/en/jobs',
      '"{title}" "{location}" "{year}" site:amazon.jobs/en/jobs'
    ]
  },
  {
    id: "company",
    name: "Company Careers",
    mode: "fetch",
    sourcePageExamples: ["https://{company}.com/careers", "https://{company}.com/jobs"],
    detailUrlPatterns: [/\/(?:job|jobs|career|careers|position|opening|requisition)s?\/[^/?#]+/i],
    listingUrlPatterns: [/\/(?:jobs|careers|open-positions|join-us)\/?$/i],
    queryTemplates: [
      '"{title}" "{location}" careers "job description" "apply" -site:linkedin.com -site:simplify.jobs -site:indeed.com',
      'intitle:"{title}" "{location}" "careers" "responsibilities" "qualifications"',
      '"{title}" "{location}" "posted" "careers" "{year}" "apply"'
    ]
  },
  {
    id: "broad",
    name: "Broad Public Web",
    mode: "fetch",
    sourcePageExamples: [],
    detailUrlPatterns: [/\/(?:job|jobs|career|careers|apply|requisition|posting)s?\/[^/?#]+/i],
    listingUrlPatterns: [/\/(?:jobs|careers|search)\/?$/i],
    queryTemplates: [
      '"{title}" "{location}" "job description" "apply now"',
      'intitle:"{title}" "{location}" "requirements" "employment" -site:linkedin.com -site:simplify.jobs -site:indeed.com',
      '"{title}" "{location}" "posted today" OR "posted this week" "apply"'
    ]
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    mode: "handoff",
    sourcePageExamples: ["https://www.linkedin.com/jobs/search"],
    detailUrlPatterns: [/^https:\/\/(?:www\.)?linkedin\.com\/jobs\/view\//i],
    listingUrlPatterns: [/^https:\/\/(?:www\.)?linkedin\.com\/jobs\/search/i],
    handoffReason:
      "LinkedIn restricts unauthorized scraping and automation. Open the link, complete any login or CAPTCHA yourself, then paste the job description back into the app.",
    searchUrl: ({ targetTitle, location }) =>
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(targetTitle)}&location=${encodeURIComponent(location)}`,
    queryTemplates: [
      '"{title}" "{location}" site:linkedin.com/jobs/view',
      '"{title}" "{location}" site:linkedin.com/jobs "LinkedIn"'
    ]
  },
  {
    id: "simplify",
    name: "Simplify",
    mode: "handoff",
    sourcePageExamples: ["https://simplify.jobs/jobs"],
    detailUrlPatterns: [/^https:\/\/simplify\.jobs\/p\/[a-f0-9-]+\/[^/?#]+/i],
    listingUrlPatterns: [/^https:\/\/simplify\.jobs\/jobs/i],
    handoffReason:
      "Simplify restricts automated scraping. Open the link yourself, review the posting, then paste the job description back into the app.",
    searchUrl: ({ targetTitle, location }) =>
      `https://simplify.jobs/jobs?query=${encodeURIComponent(targetTitle)}&location=${encodeURIComponent(location)}`,
    queryTemplates: [
      '"{title}" "{location}" site:simplify.jobs/p',
      '"{title}" "{location}" site:simplify.jobs "Simplify Jobs"'
    ]
  }
];

const EXTERNAL_BOARD_AGENT = {
  id: "external",
  mode: "handoff",
  name: "External Board Directory",
  description: "Searches relevant third-party job boards from the configured source directory and hands links to the user.",
  sourceIds: ["external-directory"],
  handoffReason:
    "This result comes from a third-party job board that is not modeled as a direct fetch source. Open the link, review the posting, then paste the job description back into the app.",
  searchUrl: ({ targetTitle, location }) =>
    `https://www.bing.com/search?q=${encodeURIComponent(`${targetTitle} ${location || "United States"} jobs`)}`,
  queries: (params) => directoryQueriesForSearch(params)
};

export function buildSearchAgents() {
  return [
    groupedAgent("ats", "ATS Boards", "Finds public ATS-hosted roles.", ["lever", "greenhouse", "ashby", "workable", "smartrecruiters", "amazon"]),
    groupedAgent("company", "Company Careers", "Looks for public company career pages and direct application pages.", ["company"]),
    groupedAgent("broad", "Broad Public Web", "Searches the open web for fresh public job descriptions.", ["broad"]),
    handoffAgent("linkedin"),
    handoffAgent("simplify"),
    EXTERNAL_BOARD_AGENT
  ];
}

export function sourceCatalogForClient() {
  return [
    ...JOB_SOURCES.map((source) => ({
    id: source.id,
    name: source.name,
    mode: source.mode,
    sourcePageExamples: source.sourcePageExamples,
    detailUrlPatterns: source.detailUrlPatterns.map((pattern) => pattern.source),
    listingUrlPatterns: source.listingUrlPatterns.map((pattern) => pattern.source)
    })),
    ...externalBoardCatalogForClient()
  ];
}

export function sourceForUrl(url) {
  const specificSources = JOB_SOURCES.filter((source) => !["company", "broad"].includes(source.id));
  return (
    specificSources.find((source) =>
      [...source.detailUrlPatterns, ...source.listingUrlPatterns].some((pattern) => pattern.test(url))
    ) ||
    JOB_SOURCES.find((source) => source.detailUrlPatterns.some((pattern) => pattern.test(url))) ||
    externalBoardForUrl(url)
  );
}

export function isKnownDetailUrl(url) {
  return JOB_SOURCES.some((source) => source.detailUrlPatterns.some((pattern) => pattern.test(url)));
}

export function isKnownListingUrl(url) {
  return JOB_SOURCES.some((source) => source.listingUrlPatterns.some((pattern) => pattern.test(url)));
}

export function isRestrictedSourceUrl(url) {
  const source = sourceForUrl(url) || JOB_SOURCES.find((candidate) =>
    candidate.listingUrlPatterns.some((pattern) => pattern.test(url))
  );
  return source?.mode === "handoff";
}

export function externalBoardSourceForUrl(url) {
  return externalBoardForUrl(url);
}

export function isBlockedSourceUrl(url) {
  return /indeed\.com/i.test(url);
}

function groupedAgent(id, name, description, sourceIds) {
  const sources = sourceIds.map((sourceId) => JOB_SOURCES.find((source) => source.id === sourceId)).filter(Boolean);

  return {
    id,
    mode: "fetch",
    name,
    description,
    sourceIds,
    queries: (params) => sources.flatMap((source) => renderQueries(source, params))
  };
}

function handoffAgent(sourceId) {
  const source = JOB_SOURCES.find((candidate) => candidate.id === sourceId);
  return {
    id: source.id,
    mode: "handoff",
    name: `${source.name} handoff`,
    description: `Finds ${source.name} links and hands control to the user for review.`,
    sourceIds: [source.id],
    handoffReason: source.handoffReason,
    searchUrl: source.searchUrl,
    queries: (params) => renderQueries(source, params)
  };
}

function renderQueries(source, { targetTitle, location }) {
  return source.queryTemplates.map((template) =>
    template
      .replaceAll("{title}", targetTitle)
      .replaceAll("{location}", location || "United States")
      .replaceAll("{year}", String(CURRENT_YEAR))
  );
}
