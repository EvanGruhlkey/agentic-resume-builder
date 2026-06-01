const SECTION_HEADINGS = [
  "summary",
  "profile",
  "experience",
  "work experience",
  "professional experience",
  "employment",
  "skills",
  "technical skills",
  "projects",
  "education",
  "certifications"
];

const SKILL_BANK = [
  "javascript",
  "typescript",
  "react",
  "vue",
  "angular",
  "next.js",
  "redux",
  "vite",
  "node",
  "express",
  "python",
  "java",
  "c#",
  "sql",
  "postgres",
  "mysql",
  "mongodb",
  "aws",
  "azure",
  "gcp",
  "docker",
  "kubernetes",
  "ci/cd",
  "git",
  "linux",
  "api",
  "rest",
  "graphql",
  "json",
  "html",
  "css",
  "tailwind",
  "sass",
  "accessibility",
  "responsive design",
  "performance",
  "testing",
  "jest",
  "playwright",
  "cypress",
  "figma",
  "excel",
  "salesforce",
  "hubspot",
  "customer service",
  "project management",
  "agile",
  "scrum",
  "data analysis",
  "machine learning",
  "communication",
  "leadership",
  "operations",
  "marketing",
  "seo",
  "analytics",
  "financial analysis",
  "budgeting",
  "recruiting",
  "training"
];

const KEYWORD_BANK = [
  ...SKILL_BANK,
  "frontend",
  "front-end",
  "backend",
  "back-end",
  "full-stack",
  "web applications",
  "user experience",
  "code quality",
  "collaboration",
  "stakeholder",
  "ownership",
  "mentorship",
  "documentation",
  "troubleshooting",
  "debugging",
  "architecture",
  "security",
  "scalability",
  "automation",
  "cross-functional"
];

export function tailorResumeForJob({ resumeText, job, targetTitle }) {
  const sections = splitResumeSections(resumeText);
  const contact = extractContactBlock(resumeText);
  const resumeSkills = extractSkills(resumeText);
  const jobSkills = extractSkills(job.description);
  const jobKeywords = extractKeywords(job.description, targetTitle, job.company);
  const matchedSkills = intersect(jobSkills, resumeSkills).slice(0, 18);
  const missingKeywords = jobKeywords
    .filter((keyword) => !includesLoose(resumeText, keyword))
    .slice(0, 12);
  const transferableKeywords = jobKeywords
    .filter((keyword) => includesLoose(resumeText, keyword))
    .slice(0, 14);
  const selectedExperience = selectRelevantExperience(resumeText, jobKeywords);
  const summary = buildSummary({
    targetTitle,
    matchedSkills,
    transferableKeywords,
    originalSummary: sections.summary || sections.profile || ""
  });

  const markdown = [
    contact || "# Tailored Resume",
    "",
    `## Target Role`,
    `${job.title} at ${job.company}`,
    "",
    "## Professional Summary",
    summary,
    "",
    "## Core Skills Aligned To This Role",
    formatSkills(matchedSkills.length ? matchedSkills : transferableKeywords),
    "",
    "## Selected Resume Experience",
    selectedExperience || fallbackExperience(sections, resumeText),
    "",
    "## Education And Credentials",
    sections.education || sections.certifications || "Keep your existing education and certification details here.",
    "",
    "## Source Job Description",
    `[${job.title} - ${job.company}](${job.url})`
  ].join("\n");

  return {
    tailoredResumeMarkdown: markdown.trim(),
    matchedSkills,
    missingKeywords,
    transferableKeywords,
    summary,
    cautions: [
      "Only add missing keywords when they truthfully reflect your experience.",
      "Review bullets before applying so the resume stays accurate."
    ]
  };
}

function splitResumeSections(text) {
  const lines = text.split(/\n+/);
  const sections = {};
  let current = "intro";

  for (const line of lines) {
    const normalized = line.trim().toLowerCase().replace(/[:]+$/, "");
    if (SECTION_HEADINGS.includes(normalized)) {
      current = normalized;
      sections[current] = "";
      continue;
    }
    sections[current] = `${sections[current] || ""}${line}\n`;
  }

  return Object.fromEntries(
    Object.entries(sections).map(([key, value]) => [key, value.trim()])
  );
}

function extractContactBlock(text) {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstHeadingIndex = lines.findIndex((line) =>
    SECTION_HEADINGS.includes(line.toLowerCase().replace(/[:]+$/, ""))
  );
  const contactLines = lines.slice(0, firstHeadingIndex > 0 ? firstHeadingIndex : 5);

  if (!contactLines.length) return "";

  const [name, ...rest] = contactLines;
  return [`# ${name.replace(/^#+\s*/, "")}`, ...rest].join("\n");
}

function extractSkills(text) {
  const lower = text.toLowerCase();
  return SKILL_BANK.filter((skill) => includesLoose(lower, skill));
}

function extractKeywords(description, targetTitle, company = "") {
  const lower = `${targetTitle} ${description}`.toLowerCase();
  const terms = new Map();
  const importantPhrases = [
    ...KEYWORD_BANK,
    ...targetTitle.toLowerCase().split(/\W+/).filter((term) => term.length > 2)
  ];

  for (const phrase of importantPhrases) {
    if (includesLoose(lower, phrase)) {
      terms.set(phrase, (terms.get(phrase) || 0) + 5);
    }
  }

  const companyWords = String(company)
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 2);
  const stop = new Set([
    "and",
    "the",
    "with",
    "for",
    "you",
    "our",
    "are",
    "will",
    "job",
    "work",
    "role",
    "team",
    "this",
    "that",
    "from",
    "have",
    "your",
    "apply",
    "about",
    "including",
    "company",
    "experience",
    "strong",
    "current",
    "compensation",
    "benefits",
    "remote",
    "hybrid",
    "full",
    "time",
    "years",
    "ability",
    "using",
    "based",
    "well",
    "across",
    "within",
    "high",
    "plus",
    "preferred",
    "required",
    "equal",
    "opportunity",
    ...companyWords
  ]);

  return [...terms.entries()]
    .filter(([keyword]) => !stop.has(keyword))
    .sort((a, b) => b[1] - a[1])
    .map(([keyword]) => keyword)
    .slice(0, 30);
}

function buildSummary({ targetTitle, matchedSkills, transferableKeywords, originalSummary }) {
  const skills = (matchedSkills.length ? matchedSkills : transferableKeywords).slice(0, 6);
  const base = originalSummary
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");

  const alignment = skills.length
    ? ` Brings role-aligned strengths in ${joinHuman(skills)}.`
    : "";

  if (base.length > 40) {
    return `${base}${alignment}`;
  }

  return `Resume-aligned candidate targeting ${targetTitle} roles.${alignment} Focused on translating proven experience into the responsibilities and outcomes described in this job posting.`;
}

function selectRelevantExperience(text, keywords) {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 25);

  const scored = lines.map((line) => {
    const lower = line.toLowerCase();
    const score = keywords.reduce((total, keyword) => {
      return total + (includesLoose(lower, keyword) ? 1 : 0);
    }, 0);
    const bulletBonus = /^[-*•]/.test(line) ? 1 : 0;
    return { line, score: score + bulletBonus };
  });

  const relevant = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((entry) => normalizeBullet(entry.line));

  return relevant.join("\n");
}

function fallbackExperience(sections, resumeText) {
  const experience =
    sections["professional experience"] ||
    sections["work experience"] ||
    sections.experience ||
    sections.employment;
  if (experience) return experience;

  return resumeText
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 30)
    .slice(0, 12)
    .map(normalizeBullet)
    .join("\n");
}

function formatSkills(skills) {
  if (!skills.length) return "Add truthful skills from your resume that match the job description.";
  return skills.map((skill) => `- ${titleCase(skill)}`).join("\n");
}

function normalizeBullet(line) {
  return /^[-*•]/.test(line) ? `- ${line.replace(/^[-*•]\s*/, "")}` : `- ${line}`;
}

function intersect(a, b) {
  const second = new Set(b);
  return a.filter((item) => second.has(item));
}

function includesLoose(text, keyword) {
  const lowerText = String(text).toLowerCase();
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i").test(lowerText);
}

function joinHuman(items) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function titleCase(value) {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
