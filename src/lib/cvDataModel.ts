/**
 * CV Data Model — single canonical representation of a CV.
 * All views (ATS editor, score, exports) consume this model.
 */

export interface CvExperience {
  role: string;
  company: string;
  dates: string;
  bullets: string[];
}

export interface CvEducation {
  degree: string;
  university: string;
  dates: string;
  gpa: string;
  coursework: string;
}

export interface CvProject {
  title: string;
  dates: string;
  bullets: string[];
}

export interface CvAward {
  title: string;
  date: string;
}

export interface CvDataModel {
  name: string;
  contact: string;
  summary: string;
  experience: CvExperience[];
  education: CvEducation[];
  skills: string;
  projects: CvProject[];
  certifications: string[];
  awards: CvAward[];
}

// ─── Helpers ────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|blockquote)[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SECTION_MAP: Record<string, string> = {
  summary: "summary",
  "professional summary": "summary",
  "profile summary": "summary",
  "executive summary": "summary",
  objective: "summary",
  about: "summary",
  "about me": "summary",
  profile: "summary",
  experience: "experience",
  "professional experience": "experience",
  "work experience": "experience",
  "employment history": "experience",
  "work history": "experience",
  education: "education",
  "academic background": "education",
  skills: "skills",
  "technical skills": "skills",
  "core competencies": "skills",
  "key skills": "skills",
  "competencies": "skills",
  "areas of expertise": "skills",
  projects: "projects",
  "project experience": "projects",
  "personal projects": "projects",
  certifications: "certifications",
  certificates: "certifications",
  "licenses and certifications": "certifications",
  awards: "awards",
  "honors & awards": "awards",
  "honors and awards": "awards",
  "achievements": "awards",
  languages: "skills",
  interests: "summary",
};

function classifySection(line: string): string | null {
  const lower = line.toLowerCase().replace(/[^a-z\s&]/g, "").trim();
  for (const [key, val] of Object.entries(SECTION_MAP)) {
    if (lower === key || lower.startsWith(key + " ")) return val;
  }
  return null;
}

function isContact(line: string): boolean {
  // A line is contact info if it contains email, phone, linkedin, github, or location-like separators (|, •, ●)
  const patterns = [/@/, /\+?\d[\d\s\-()]{6,}/, /linkedin\.com/i, /github\.com/i];
  if (patterns.some((p) => p.test(line))) return true;
  // Multi-item contact lines separated by | or • or ● (e.g. "Bologna | marco@gmail.com | +39 123...")
  const separators = line.split(/\s*[|•●]\s*/);
  if (separators.length >= 2 && separators.some((s) => patterns.some((p) => p.test(s)))) return true;
  return false;
}

function isMultiContactLine(line: string): boolean {
  // Detects lines like "City | email@x.com | +1 234 567 8900 | linkedin.com/in/x"
  const sep = line.split(/\s*[|•●]\s*/);
  return sep.length >= 2;
}

function isBullet(line: string): boolean {
  return /^\s*[•\-*▪◦‣⁃]\s/.test(line) || /^\s*\d+[.)]\s/.test(line);
}

function cleanBullet(line: string): string {
  return line.replace(/^\s*[•\-*▪◦‣⁃]\s*/, "").replace(/^\s*\d+[.)]\s*/, "").trim();
}

function isDateLine(line: string): boolean {
  return /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}/i.test(line)
    || /\d{4}\s*[-–—]\s*(present|\d{4})/i.test(line);
}

function extractDates(line: string): string {
  const match = line.match(/((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}\s*[-–—]\s*(?:present|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}))/i)
    || line.match(/(\d{4}\s*[-–—]\s*(?:present|\d{4}))/i);
  return match?.[1]?.trim() || "";
}

function removeDates(line: string, dates: string): string {
  return dates ? line.replace(dates, "").replace(/\s*[-–—,]\s*$/, "").trim() : line;
}

// ─── Main Parser ────────────────────────────────────────────

export function parseCvToModel(input: string): CvDataModel {
  const raw = input.includes("<") ? stripHtml(input) : input;
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  const model: CvDataModel = {
    name: "",
    contact: "",
    summary: "",
    experience: [],
    education: [],
    skills: "",
    projects: [],
    certifications: [],
    awards: [],
  };

  let currentSection: string | null = null;
  let headerDone = false;
  let contactParts: string[] = [];
  let nameSet = false;

  // Temporary accumulators for structured entries
  let currentExp: CvExperience | null = null;
  let currentEdu: CvEducation | null = null;
  let currentProj: CvProject | null = null;
  let summaryParts: string[] = [];
  let skillsParts: string[] = [];
  let certParts: string[] = [];

  function flushExp() {
    if (currentExp) { model.experience.push(currentExp); currentExp = null; }
  }
  function flushEdu() {
    if (currentEdu) { model.education.push(currentEdu); currentEdu = null; }
  }
  function flushProj() {
    if (currentProj) { model.projects.push(currentProj); currentProj = null; }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // First line = name (but check if it's actually a contact line or combined name+contact)
    if (!nameSet && !headerDone && !classifySection(line) && !isBullet(line)) {
      // If the first line IS contact info (multi-item with email/phone), skip it as name
      if (isContact(line) && isMultiContactLine(line)) {
        contactParts.push(line);
        continue;
      }
      model.name = line;
      nameSet = true;
      continue;
    }

    // Contact lines before first section
    if (!headerDone && isContact(line) && !classifySection(line)) {
      contactParts.push(line);
      continue;
    }

    // Section header
    const section = classifySection(line);
    if (section) {
      // Flush any pending entry
      flushExp(); flushEdu(); flushProj();
      if (currentSection === "summary") model.summary = summaryParts.join(" ").trim();
      if (currentSection === "skills") model.skills = skillsParts.join(", ").replace(/, ,/g, ",").trim();
      if (currentSection === "certifications") model.certifications = certParts;

      currentSection = section;
      headerDone = true;
      summaryParts = [];
      skillsParts = [];
      certParts = [];
      continue;
    }

    // Content lines by section
    switch (currentSection) {
      case "summary":
        summaryParts.push(line);
        break;

      case "experience": {
        if (isBullet(line)) {
          if (currentExp) currentExp.bullets.push(cleanBullet(line));
        } else {
          const dates = extractDates(line);
          if (dates && currentExp && !currentExp.dates) {
            currentExp.dates = dates;
          } else if (currentExp && !currentExp.company && line.length < 80 && !dates) {
            // Likely company name on its own line
            currentExp.company = line;
          } else {
            flushExp();
            const d = extractDates(line);
            const cleaned = removeDates(line, d);
            // Try splitting "Role — Company" or "Role at Company"
            const dashSplit = cleaned.split(/\s*[—–]\s*/);
            const atSplit = cleaned.split(/\s+at\s+/i);
            if (dashSplit.length >= 2) {
              currentExp = { role: dashSplit[0], company: dashSplit.slice(1).join(" — "), dates: d, bullets: [] };
            } else if (atSplit.length >= 2) {
              currentExp = { role: atSplit[0], company: atSplit.slice(1).join(" at "), dates: d, bullets: [] };
            } else {
              currentExp = { role: cleaned, company: "", dates: d, bullets: [] };
            }
          }
        }
        break;
      }

      case "education": {
        if (isBullet(line)) {
          if (currentEdu) {
            const c = cleanBullet(line);
            // Detect GPA bullets
            if (/^gpa\s*:/i.test(c) || /^gpa\s/i.test(c) || /^\d+(\.\d+)?\s*\/\s*\d+/i.test(c)) {
              currentEdu.gpa = c.replace(/^gpa\s*:?\s*/i, "").trim();
            } else {
              currentEdu.coursework = currentEdu.coursework ? currentEdu.coursework + ", " + c : c;
            }
          }
        } else if (/^gpa\s*:/i.test(line)) {
          if (currentEdu) {
            currentEdu.gpa = line.replace(/^gpa\s*:?\s*/i, "").trim();
          }
        } else if (/relevant\s+coursework/i.test(line)) {
          if (currentEdu) {
            const cw = line.replace(/relevant\s+coursework\s*:?\s*/i, "").trim();
            if (cw) currentEdu.coursework = cw;
          }
        } else {
          const dates = extractDates(line);
          if (dates && currentEdu && !currentEdu.dates) {
            currentEdu.dates = dates;
          } else if (currentEdu && !currentEdu.university && line.length < 100 && !dates) {
            currentEdu.university = line;
          } else {
            flushEdu();
            const d = extractDates(line);
            const cleaned = removeDates(line, d);
            currentEdu = { degree: cleaned, university: "", dates: d, gpa: "", coursework: "" };
          }
        }
        break;
      }

      case "skills":
        if (isBullet(line)) {
          skillsParts.push(cleanBullet(line));
        } else {
          skillsParts.push(line);
        }
        break;

      case "projects": {
        if (isBullet(line)) {
          if (currentProj) currentProj.bullets.push(cleanBullet(line));
        } else {
          flushProj();
          const d = extractDates(line);
          const cleaned = removeDates(line, d);
          currentProj = { title: cleaned, dates: d, bullets: [] };
        }
        break;
      }

      case "certifications":
        certParts.push(isBullet(line) ? cleanBullet(line) : line);
        break;

      case "awards": {
        const d = extractDates(line);
        const cleaned = removeDates(line, d);
        if (cleaned) model.awards.push({ title: cleaned, date: d });
        break;
      }

      default:
        // Lines before any section (after name/contact) — treat as summary
        if (!headerDone) {
          summaryParts.push(line);
        }
        break;
    }
  }

  // Flush remaining
  flushExp(); flushEdu(); flushProj();
  if (currentSection === "summary" || (!headerDone && summaryParts.length)) {
    model.summary = summaryParts.join(" ").trim();
  }
  if (currentSection === "skills") model.skills = skillsParts.join(", ").replace(/, ,/g, ",").trim();
  if (currentSection === "certifications") model.certifications = certParts;

  // Join contact parts, normalizing separators to " | "
  model.contact = contactParts
    .map((p) => p.trim())
    .join(" | ")
    .replace(/\s*[|•●]\s*[|•●]\s*/g, " | ") // clean double separators
    .trim();

  return model;
}

// ─── Convert ReformattedCv (from AI) to CvDataModel ────────

import type { ReformattedCv } from "./types";

export function reformattedCvToModel(cv: ReformattedCv): CvDataModel {
  return {
    name: cv.name,
    contact: cv.contact,
    summary: cv.profileSummary,
    experience: (cv.experience || []).map((e) => ({
      role: e.role,
      company: e.company,
      dates: e.dates,
      bullets: e.bullets || [],
    })),
    education: (cv.education || []).map((e) => ({
      degree: e.degree,
      university: e.university,
      dates: e.dates,
      gpa: "",
      coursework: e.coursework || "",
    })),
    skills: cv.technicalSkills || "",
    projects: (cv.projectExperience || []).map((p) => ({
      title: p.title,
      dates: p.dates,
      bullets: p.bullets || [],
    })),
    certifications: [],
    awards: (cv.honorsAwards || []).map((a) => ({
      title: a.title,
      date: a.date,
    })),
  };
}

// ─── Convert parse-cv edge function response to CvDataModel ────

export function aiParsedCvToModel(cvData: any): CvDataModel {
  const contact = [
    cvData.contact?.email,
    cvData.contact?.phone,
    cvData.contact?.location,
    cvData.contact?.linkedin,
  ].filter(Boolean).join(" | ");

  const model: CvDataModel = {
    name: cvData.name || "",
    contact,
    summary: cvData.summary || "",
    experience: (cvData.experience || []).map((e: any) => ({
      role: e.title || e.role || "",
      company: e.company || "",
      dates: e.dates || "",
      bullets: e.bullets || [],
    })),
    education: (cvData.education || []).map((e: any) => ({
      degree: e.degree || "",
      university: e.school || e.university || "",
      dates: e.dates || "",
      gpa: e.gpa || "",
      coursework: e.coursework || "",
    })),
    skills: Array.isArray(cvData.skills) ? cvData.skills.join(", ") : (cvData.skills || ""),
    projects: [],
    certifications: cvData.certifications || [],
    awards: [],
  };

  return model;
}

// ─── Serialize model to plain text (for ATS score, clipboard) ────

export function cvModelToPlainText(model: CvDataModel): string {
  const parts: string[] = [];
  parts.push(model.name);
  if (model.contact) parts.push(model.contact);
  parts.push("");

  if (model.summary) {
    parts.push("PROFILE SUMMARY");
    parts.push(model.summary);
    parts.push("");
  }

  if (model.experience.length) {
    parts.push("PROFESSIONAL EXPERIENCE");
    model.experience.forEach((e) => {
      parts.push(`${e.role}${e.company ? " — " + e.company : ""}${e.dates ? " — " + e.dates : ""}`);
      e.bullets.forEach((b) => parts.push("• " + b));
      parts.push("");
    });
  }

  if (model.projects.length) {
    parts.push("PROJECTS");
    model.projects.forEach((p) => {
      parts.push(`${p.title}${p.dates ? " " + p.dates : ""}`);
      p.bullets.forEach((b) => parts.push("• " + b));
      parts.push("");
    });
  }

  if (model.education.length) {
    parts.push("EDUCATION");
    model.education.forEach((e) => {
      parts.push(`${e.university}${e.dates ? " | " + e.dates : ""}`);
      if (e.degree) parts.push(e.degree);
      if (e.gpa) parts.push("GPA: " + e.gpa);
      if (e.coursework) parts.push("Relevant Coursework: " + e.coursework);
      parts.push("");
    });
  }

  if (model.skills) {
    parts.push("SKILLS");
    parts.push(model.skills);
    parts.push("");
  }

  if (model.certifications.length) {
    parts.push("CERTIFICATIONS");
    model.certifications.forEach((c) => parts.push("• " + c));
    parts.push("");
  }

  if (model.awards.length) {
    parts.push("AWARDS");
    model.awards.forEach((a) => parts.push(`${a.title}${a.date ? " " + a.date : ""}`));
    parts.push("");
  }

  return parts.join("\n");
}

// ─── Serialize model to HTML (for rendering / export) ────

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function cvModelToHtml(model: CvDataModel): string {
  const parts: string[] = [];
  parts.push(`<h1>${esc(model.name)}</h1>`);
  if (model.contact) parts.push(`<p>${esc(model.contact)}</p>`);

  if (model.summary) {
    parts.push(`<h2>PROFILE SUMMARY</h2>`);
    parts.push(`<p>${esc(model.summary)}</p>`);
  }

  if (model.experience.length) {
    parts.push(`<h2>PROFESSIONAL EXPERIENCE</h2>`);
    model.experience.forEach((e) => {
      const title = [e.role, e.company, e.dates].filter(Boolean).join(" — ");
      parts.push(`<p><strong>${esc(title)}</strong></p>`);
      if (e.bullets.length) {
        parts.push("<ul>");
        e.bullets.forEach((b) => parts.push(`<li>${esc(b)}</li>`));
        parts.push("</ul>");
      }
    });
  }

  if (model.projects.length) {
    parts.push(`<h2>PROJECTS</h2>`);
    model.projects.forEach((p) => {
      parts.push(`<p><strong>${esc(p.title)}</strong>${p.dates ? " " + esc(p.dates) : ""}</p>`);
      if (p.bullets.length) {
        parts.push("<ul>");
        p.bullets.forEach((b) => parts.push(`<li>${esc(b)}</li>`));
        parts.push("</ul>");
      }
    });
  }

  if (model.education.length) {
    parts.push(`<h2>EDUCATION</h2>`);
    model.education.forEach((e) => {
      parts.push(`<p><strong>${esc(e.university)}</strong>${e.dates ? " | " + esc(e.dates) : ""}</p>`);
      if (e.degree) parts.push(`<p>${esc(e.degree)}</p>`);
      if (e.gpa) parts.push(`<p>GPA: ${esc(e.gpa)}</p>`);
      if (e.coursework) parts.push(`<p>Relevant Coursework: ${esc(e.coursework)}</p>`);
    });
  }

  if (model.skills) {
    parts.push(`<h2>SKILLS</h2>`);
    parts.push(`<p>${esc(model.skills)}</p>`);
  }

  if (model.certifications.length) {
    parts.push(`<h2>CERTIFICATIONS</h2>`);
    parts.push("<ul>");
    model.certifications.forEach((c) => parts.push(`<li>${esc(c)}</li>`));
    parts.push("</ul>");
  }

  if (model.awards.length) {
    parts.push(`<h2>AWARDS</h2>`);
    model.awards.forEach((a) => {
      parts.push(`<p><strong>${esc(a.title)}</strong>${a.date ? " " + esc(a.date) : ""}</p>`);
    });
  }

  return parts.join("");
}
