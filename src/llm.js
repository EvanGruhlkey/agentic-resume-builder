const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.2";

export function getLlmStatus() {
  return {
    enabled: Boolean(process.env.OPENAI_API_KEY),
    provider: "openai",
    model: process.env.OPENAI_API_KEY ? DEFAULT_MODEL : null,
    jobExtractionEnabled: Boolean(process.env.OPENAI_API_KEY) && process.env.JOB_INDEX_LLM_EXTRACTION === "true"
  };
}

export async function planSearchQueries({ targetTitle, location, resumeText, agents }) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      enabled: false,
      notes: ["Set OPENAI_API_KEY to enable LLM query planning."]
    };
  }

  const agentList = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    mode: agent.mode,
    description: agent.description
  }));

  const prompt = [
    "Create a concise JSON search plan for parallel job-search agents.",
    "Return only JSON with this exact shape:",
    '{"extraQueriesByAgent":{"agent_id":["query"]},"notes":["short note"]}',
    "Rules:",
    "- Add at most 3 extra queries per agent.",
    "- Keep queries under 180 characters.",
    "- Do not ask agents to bypass login, paywalls, CAPTCHA, robots.txt, or site terms.",
    "- Skip sources that require login, CAPTCHA, MFA, or user review.",
    "- Do not use Indeed.",
    "- Prefer public ATS and company career pages for direct extraction.",
    "",
    `Target title: ${targetTitle}`,
    `Location: ${location}`,
    `Agents: ${JSON.stringify(agentList)}`,
    `Resume excerpt: ${resumeText.slice(0, 1800)}`
  ].join("\n");

  try {
    const output = await callOpenAIJson(prompt);
    return {
      enabled: true,
      model: DEFAULT_MODEL,
      extraQueriesByAgent: sanitizeQueryPlan(output.extraQueriesByAgent, agents),
      notes: Array.isArray(output.notes) ? output.notes.slice(0, 4) : []
    };
  } catch (error) {
    return {
      enabled: false,
      model: DEFAULT_MODEL,
      notes: [`LLM planning unavailable: ${error.message}`]
    };
  }
}

export async function tailorResumeWithLlm({ resumeText, job, targetTitle, fallbackTailoring }) {
  if (!process.env.OPENAI_API_KEY || job.sourceType === "handoff") {
    return {
      ...fallbackTailoring,
      method: "deterministic"
    };
  }

  const prompt = [
    "Tailor a resume to a job description without inventing experience.",
    "Return only JSON with this exact shape:",
    '{"tailoredResumeMarkdown":"markdown","matchedSkills":["skill"],"missingKeywords":["keyword"],"transferableKeywords":["keyword"],"summary":"short summary","cautions":["caution"]}',
    "Rules:",
    "- Preserve the candidate's factual experience.",
    "- Do not add skills, employers, degrees, metrics, certifications, or tools unless they appear in the resume.",
    "- You may reorder, emphasize, and lightly rewrite existing content.",
    "- Include the source job link at the end.",
    "- Keep the resume concise and application-ready.",
    "",
    `Target title: ${targetTitle}`,
    `Job title: ${job.title}`,
    `Company: ${job.company}`,
    `Job URL: ${job.url}`,
    `Job description: ${job.description.slice(0, 9000)}`,
    `Resume: ${resumeText.slice(0, 12000)}`
  ].join("\n");

  try {
    const output = await callOpenAIJson(prompt);
    if (!output.tailoredResumeMarkdown || typeof output.tailoredResumeMarkdown !== "string") {
      throw new Error("The model returned an incomplete resume.");
    }

    return {
      tailoredResumeMarkdown: output.tailoredResumeMarkdown.trim(),
      matchedSkills: normalizeStringArray(output.matchedSkills),
      missingKeywords: normalizeStringArray(output.missingKeywords),
      transferableKeywords: normalizeStringArray(output.transferableKeywords),
      summary: String(output.summary || fallbackTailoring.summary || "").trim(),
      cautions: normalizeStringArray(output.cautions).length
        ? normalizeStringArray(output.cautions)
        : fallbackTailoring.cautions,
      method: "llm",
      model: DEFAULT_MODEL
    };
  } catch (error) {
    return {
      ...fallbackTailoring,
      method: "deterministic",
      llmError: error.message
    };
  }
}

export async function extractJobFieldsWithLlm({ job, heuristicFields = {} }) {
  if (!process.env.OPENAI_API_KEY || process.env.JOB_INDEX_LLM_EXTRACTION !== "true") {
    return {
      enabled: false,
      method: "heuristic"
    };
  }

  const prompt = [
    "Extract structured fields from a job description.",
    "Return only JSON with this exact shape:",
    '{"salaryRange":{"min":null,"max":null,"currency":"","period":"","raw":""},"requiredSkills":["skill"],"programmingLanguages":["language"],"certifications":["certification"],"degreeRequirements":["requirement"],"graduationYear":"","employmentType":"","seniority":"","workMode":"","visaSponsorship":"","securityClearance":"","applicationDeadline":"","applyUrl":"","confidence":0}',
    "Rules:",
    "- Use null or an empty string when a field is not stated.",
    "- Do not infer requirements that are not present.",
    "- Keep arrays deduplicated and concise.",
    "- confidence is a number from 0 to 1.",
    "",
    `Job title: ${job.title || ""}`,
    `Company: ${job.company || ""}`,
    `Location: ${job.location || ""}`,
    `Known apply URL: ${job.applyUrl || job.url || ""}`,
    `Heuristic fields: ${JSON.stringify(heuristicFields).slice(0, 4000)}`,
    `Description: ${String(job.description || "").slice(0, 9000)}`
  ].join("\n");

  try {
    const output = await callOpenAIJson(prompt);
    return {
      enabled: true,
      method: "llm",
      model: DEFAULT_MODEL,
      fields: sanitizeExtractedJobFields(output)
    };
  } catch (error) {
    return {
      enabled: false,
      method: "heuristic",
      error: error.message
    };
  }
}

async function callOpenAIJson(prompt) {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: prompt,
      text: {
        format: { type: "json_object" }
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed with ${response.status}: ${detail.slice(0, 180)}`);
  }

  const payload = await response.json();
  const text =
    payload.output_text ||
    payload.output?.flatMap((item) => item.content || [])
      ?.find((content) => content.type === "output_text")?.text;

  if (!text) throw new Error("OpenAI response did not contain text.");
  return JSON.parse(text);
}

function sanitizeQueryPlan(extraQueriesByAgent, agents) {
  const allowedIds = new Set(agents.map((agent) => agent.id));
  const sanitized = {};

  if (!extraQueriesByAgent || typeof extraQueriesByAgent !== "object") return sanitized;

  for (const [agentId, queries] of Object.entries(extraQueriesByAgent)) {
    if (!allowedIds.has(agentId) || !Array.isArray(queries)) continue;
    sanitized[agentId] = queries
      .filter((query) => typeof query === "string")
      .map((query) => query.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  return sanitized;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 18);
}

function sanitizeExtractedJobFields(value = {}) {
  return {
    salaryRange: sanitizeSalaryRange(value.salaryRange),
    requiredSkills: normalizeStringArray(value.requiredSkills).slice(0, 30),
    programmingLanguages: normalizeStringArray(value.programmingLanguages).slice(0, 20),
    certifications: normalizeStringArray(value.certifications).slice(0, 20),
    degreeRequirements: normalizeStringArray(value.degreeRequirements).slice(0, 12),
    graduationYear: String(value.graduationYear || "").trim().slice(0, 40),
    employmentType: String(value.employmentType || "").trim().slice(0, 80),
    seniority: String(value.seniority || "").trim().slice(0, 80),
    workMode: String(value.workMode || "").trim().slice(0, 80),
    visaSponsorship: String(value.visaSponsorship || "").trim().slice(0, 120),
    securityClearance: String(value.securityClearance || "").trim().slice(0, 120),
    applicationDeadline: String(value.applicationDeadline || "").trim().slice(0, 80),
    applyUrl: String(value.applyUrl || "").trim().slice(0, 1000),
    confidence: clampConfidence(value.confidence)
  };
}

function sanitizeSalaryRange(value = {}) {
  return {
    min: Number.isFinite(Number(value.min)) ? Number(value.min) : null,
    max: Number.isFinite(Number(value.max)) ? Number(value.max) : null,
    currency: String(value.currency || "").trim().slice(0, 12),
    period: String(value.period || "").trim().slice(0, 24),
    raw: String(value.raw || "").trim().slice(0, 240)
  };
}

function clampConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}
