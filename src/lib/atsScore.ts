// No longer importing cvToPlainText — callers now pass plain text directly

/**
 * Client-side ATS score recalculation with synonym-aware, fuzzy keyword matching.
 */

/** Synonym mappings for common job skills and qualifications */
const SYNONYMS: Record<string, string[]> = {
  // Technical skills
  excel: ["microsoft excel", "ms excel", "spreadsheet", "xlookup", "pivot tables", "vlookup"],
  "power bi": ["powerbi", "power business intelligence", "microsoft power bi"],
  python: ["python programming", "python scripting", "python3"],
  sql: ["structured query language", "mysql", "postgresql", "sql server", "t-sql", "tsql"],
  "financial modeling": ["financial models", "budgeting models", "forecast modeling", "forecasting"],
  "data analysis": ["data analytics", "analyzing data", "statistical analysis", "data-driven"],
  javascript: ["js", "ecmascript", "es6", "node.js", "nodejs"],
  typescript: ["ts"],
  react: ["reactjs", "react.js"],
  "machine learning": ["ml", "deep learning", "neural networks"],
  "project management": ["project manager", "managing projects", "pm"],
  // Qualifications
  "master's degree": ["masters degree", "msc", "m.s.", "laurea magistrale", "graduate degree", "master degree"],
  "bachelor's degree": ["bachelors degree", "bs", "b.s.", "ba", "b.a.", "undergraduate degree", "laurea", "bachelor degree"],
  // Soft skills
  "analytical thinking": ["analytical skills", "analysis skills", "analytical ability", "analytical capabilities"],
  "problem solving": ["problem-solving", "solving problems", "critical thinking"],
  "team collaboration": ["teamwork", "collaborative", "team player", "working in teams", "cross-functional"],
  communication: ["communication skills", "communicating", "verbal communication", "written communication"],
  leadership: ["leading teams", "team lead", "team leadership", "people management"],
  // Experience
  "financial analyst": ["financial analysis", "finance analyst"],
  controller: ["financial controller", "management control", "controllo di gestione"],
  // Semantic groupings for common phrases
  "english fluency": ["english", "fluent in english", "fluent english", "english proficient", "english proficiency", "native english", "c1 english", "c2 english", "ielts", "toefl", "english (native)", "english (fluent)", "english (c1)", "english (c2)", "english (b2)"],
  "onboarding team members": ["onboarding", "onboard", "training team", "training new", "managing team", "team training", "mentoring", "coached", "ramping up"],
  "okrs tracking": ["okr", "okrs", "kpi tracking", "kpi", "kpis", "objectives and key results", "key performance indicator"],
  airtable: ["airtable"],
  notion: ["notion"],
  figma: ["figma"],
  jira: ["jira"],
  trello: ["trello"],
  slack: ["slack"],
  asana: ["asana"],
  hubspot: ["hubspot"],
  salesforce: ["salesforce"],
  zapier: ["zapier"],
  intercom: ["intercom"],
  zendesk: ["zendesk"],
  "google analytics": ["google analytics", "ga4"],
  canva: ["canva"],
  miro: ["miro"],
  clickup: ["clickup"],
  monday: ["monday.com"],
  linear: ["linear"],
};

/**
 * Semantic phrase patterns: if the keyword matches a pattern key,
 * we check if ANY of the associated terms appear in the CV.
 * This handles cases like "English fluency" matching "English (C1)".
 */
const SEMANTIC_PATTERNS: { test: RegExp; cvTerms: string[] }[] = [
  // Language + fluency/proficiency
  { test: /\b(english)\b.*\b(fluen|proficien|native|level|spoken|written)\b/i, cvTerms: ["english"] },
  { test: /\b(italian)\b.*\b(fluen|proficien|native|level|spoken|written)\b/i, cvTerms: ["italian", "italiano"] },
  { test: /\b(french)\b.*\b(fluen|proficien|native|level|spoken|written)\b/i, cvTerms: ["french", "français"] },
  { test: /\b(spanish)\b.*\b(fluen|proficien|native|level|spoken|written)\b/i, cvTerms: ["spanish", "español"] },
  { test: /\b(german)\b.*\b(fluen|proficien|native|level|spoken|written)\b/i, cvTerms: ["german", "deutsch"] },
  // Onboarding/training people
  { test: /\bonboard(ing)?\b.*\b(team|member|employee|staff|hire)\b/i, cvTerms: ["onboarding", "onboard", "training", "mentoring", "coached", "ramping"] },
  // OKR/KPI tracking
  { test: /\b(okr|kpi)s?\b.*\b(track|monitor|measur|report)\b/i, cvTerms: ["okr", "kpi", "objectives", "key results", "key performance"] },
];

/**
 * Check if a keyword (or any of its synonyms) appears in the CV text.
 * Also does partial/fuzzy matching for multi-word keywords.
 */
export function matchKeyword(keyword: string, cvText: string): boolean {
  const kw = keyword.toLowerCase();

  // Direct match
  if (cvText.includes(kw)) return true;

  // Synonym match
  const syns = SYNONYMS[kw];
  if (syns && syns.some((s) => cvText.includes(s))) return true;

  // Also check if the keyword itself is a synonym value for another key
  for (const [, values] of Object.entries(SYNONYMS)) {
    if (values.includes(kw)) {
      // Check the canonical form and all other synonyms
      for (const v of values) {
        if (v !== kw && cvText.includes(v)) return true;
      }
    }
  }

  // Partial/fuzzy match for multi-word keywords (e.g. "Excel (advanced)")
  if (kw.includes(" ") || kw.includes("(")) {
    // Strip parenthetical qualifiers for matching: "excel (advanced)" → check "excel"
    const withoutParens = kw.replace(/\s*\([^)]*\)/g, "").trim();
    if (withoutParens && cvText.includes(withoutParens)) return true;

    // Word overlap: if 70%+ of significant words match
    const words = kw
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3);
    if (words.length > 0) {
      const matchCount = words.filter((w) => cvText.includes(w)).length;
      if (matchCount / words.length >= 0.7) return true;
    }
  }

  return false;
}

function extractKeywords(jobDescription: string): string[] {
  const text = jobDescription.toLowerCase();
  const words = text
    .replace(/[^a-z0-9\s\-+#.]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const phrases: string[] = [];
  const rawWords = text.split(/\n|[,;•\-]/).map((s) => s.trim()).filter(Boolean);
  for (const phrase of rawWords) {
    const cleaned = phrase.replace(/[^a-z0-9\s\-+#.]/g, "").trim();
    if (cleaned.length > 2 && cleaned.length < 40 && cleaned.split(/\s+/).length <= 4) {
      phrases.push(cleaned);
    }
  }

  const stopWords = new Set([
    "the", "and", "for", "with", "that", "this", "from", "are", "was", "were",
    "will", "have", "has", "had", "been", "being", "can", "could", "should",
    "would", "may", "might", "must", "shall", "not", "but", "also", "our",
    "your", "you", "they", "their", "them", "its", "about", "into", "over",
    "such", "than", "other", "which", "these", "those", "then", "when",
    "where", "who", "whom", "how", "all", "each", "every", "both",
  ]);

  const importantWords = words.filter((w) => !stopWords.has(w) && w.length > 3);
  const unique = [...new Set([...phrases, ...importantWords])];
  return unique.slice(0, 30);
}

/**
 * Check if a keyword's component parts (especially parenthesized sub-items) are already
 * covered in the CV text. E.g. "Microsoft Office (Excel, PowerPoint)" is covered if
 * both "Excel" and "PowerPoint" appear in the CV.
 */
function checkComponentsCovered(keyword: string, cvText: string): boolean {
  const kw = keyword.toLowerCase();
  // Extract parenthesized components: "Microsoft Office (Excel, PowerPoint)" → ["Excel", "PowerPoint"]
  const parenMatch = kw.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const components = parenMatch[1].split(/[,;\/]+/).map(s => s.trim()).filter(s => s.length > 1);
    if (components.length > 0) {
      const allPresent = components.every(c => cvText.includes(c));
      if (allPresent) return true;
    }
  }
  // Also check multi-word keywords: if all significant words (>3 chars) appear individually
  const words = kw.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
  if (words.length >= 2) {
    const allWordsPresent = words.every(w => cvText.includes(w));
    if (allWordsPresent) return true;
  }
  return false;
}

export interface AtsScoreResult {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
}

/**
 * Recalculate ATS score using AI-provided keywords (preferred) or fallback to regex extraction.
 * Uses synonym-aware fuzzy matching for accurate keyword detection.
 */
export function calculateAtsScore(
  cvContent: string,
  jobDescription: string,
  aiKeywords?: string[]
): AtsScoreResult {
  const cvText = cvContent.toLowerCase();
  const keywords = aiKeywords && aiKeywords.length > 0
    ? aiKeywords
    : extractKeywords(jobDescription);

  if (keywords.length === 0) {
    return { score: 0, matchedKeywords: [], missingKeywords: [] };
  }

  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of keywords) {
    if (matchKeyword(kw, cvText)) {
      matched.push(kw);
    } else {
      // Issue 4: Check if the keyword's component words are all covered semantically
      // e.g. "Microsoft Office (Excel, PowerPoint)" — if Excel and PowerPoint are in CV, don't mark missing
      const componentsCovered = checkComponentsCovered(kw, cvText);
      if (componentsCovered) {
        matched.push(kw);
      } else {
        missing.push(kw);
      }
    }
  }

  // Keyword match score (70% weight)
  const keywordScore = (matched.length / keywords.length) * 70;

  // Format quality score (30% weight)
  let formatScore = 30;
  const lineCount = cvText.split("\n").filter((l) => l.trim()).length;
  if (lineCount < 10) formatScore -= 10;
  if (cvText.length < 200) formatScore -= 10;
  const hasHeaders = /\b(education|experience|skills|certifications)\b/i.test(cvText);
  if (!hasHeaders) formatScore -= 5;

  const score = Math.min(100, Math.max(0, Math.round(keywordScore + formatScore)));

  return {
    score,
    matchedKeywords: matched,
    missingKeywords: missing,
  };
}
