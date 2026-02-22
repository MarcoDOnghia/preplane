import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import type { ReformattedCv } from "./types";

const FONT = "Arial";
const BODY_SIZE = 21;   // 10.5pt (half-points)
const HEADER_SIZE = 22; // 11pt
const NAME_SIZE = 26;   // 13pt

function sectionHeader(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: HEADER_SIZE, font: FONT }),
    ],
    spacing: { before: 240, after: 100 },
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: BODY_SIZE, font: FONT })],
    bullet: { level: 0 },
    spacing: { after: 40 },
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function reformattedCvToHtml(cv: ReformattedCv): string {
  const parts: string[] = [];
  parts.push(`<h1>${escapeHtml(cv.name)}</h1>`);
  parts.push(`<p>${escapeHtml(cv.contact)}</p>`);

  if (cv.profileSummary) {
    parts.push(`<h2>PROFILE SUMMARY</h2>`);
    parts.push(`<p>${escapeHtml(cv.profileSummary)}</p>`);
  }

  if (cv.experience?.length) {
    parts.push(`<h2>PROFESSIONAL EXPERIENCE</h2>`);
    cv.experience.forEach((exp) => {
      parts.push(`<p><strong>${escapeHtml(exp.role)}</strong> — ${escapeHtml(exp.company)} — ${escapeHtml(exp.dates)}</p>`);
      if (exp.bullets?.length) {
        parts.push("<ul>");
        exp.bullets.forEach((b) => parts.push(`<li>${escapeHtml(b)}</li>`));
        parts.push("</ul>");
      }
    });
  }

  if (cv.education?.length) {
    parts.push(`<h2>EDUCATION</h2>`);
    cv.education.forEach((e) => {
      parts.push(`<p><strong>${escapeHtml(e.degree)}</strong> ${escapeHtml(e.dates)}</p>`);
      parts.push(`<p>${escapeHtml(e.university)}</p>`);
      if (e.coursework) {
        parts.push(`<p><strong>Relevant Coursework:</strong> ${escapeHtml(e.coursework)}</p>`);
      }
    });
  }

  if (cv.technicalSkills) {
    parts.push(`<h2>SKILLS</h2>`);
    parts.push(`<p>${escapeHtml(cv.technicalSkills)}</p>`);
  }

  if (cv.projectExperience?.length) {
    parts.push(`<h2>PROJECTS</h2>`);
    cv.projectExperience.forEach((p) => {
      parts.push(`<p><strong>${escapeHtml(p.title)}</strong> ${escapeHtml(p.dates)}</p>`);
      if (p.bullets?.length) {
        parts.push("<ul>");
        p.bullets.forEach((b) => parts.push(`<li>${escapeHtml(b)}</li>`));
        parts.push("</ul>");
      }
    });
  }

  if (cv.honorsAwards?.length) {
    parts.push(`<h2>AWARDS</h2>`);
    cv.honorsAwards.forEach((a) => {
      parts.push(`<p><strong>${escapeHtml(a.title)}</strong> ${escapeHtml(a.date)}</p>`);
    });
  }

  return parts.join("");
}

export async function exportAtsTemplateCv(cv: ReformattedCv, jobTitle: string) {
  const children: Paragraph[] = [];

  // Name — bold, centered, not all-caps
  children.push(
    new Paragraph({
      children: [new TextRun({ text: cv.name, bold: true, size: NAME_SIZE, font: FONT })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    })
  );

  // Contact line
  children.push(
    new Paragraph({
      children: [new TextRun({ text: cv.contact, size: BODY_SIZE, font: FONT })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Profile Summary
  if (cv.profileSummary) {
    children.push(sectionHeader("Profile Summary"));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: cv.profileSummary, size: BODY_SIZE, font: FONT })],
        spacing: { after: 100 },
      })
    );
  }

  // Professional Experience
  if (cv.experience?.length) {
    children.push(sectionHeader("Professional Experience"));
    cv.experience.forEach((exp) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: exp.role, bold: true, size: BODY_SIZE, font: FONT }),
            new TextRun({ text: ` — ${exp.company}`, size: BODY_SIZE, font: FONT }),
          ],
          spacing: { before: 80, after: 20 },
        })
      );
      children.push(
        new Paragraph({
          children: [new TextRun({ text: exp.dates, italics: true, size: BODY_SIZE, font: FONT })],
          spacing: { after: 40 },
        })
      );
      exp.bullets?.forEach((b) => children.push(bullet(b)));
    });
  }

  // Education
  if (cv.education?.length) {
    children.push(sectionHeader("Education"));
    cv.education.forEach((ed) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: ed.degree, bold: true, size: BODY_SIZE, font: FONT }),
            new TextRun({ text: `  ${ed.dates}`, italics: true, size: BODY_SIZE, font: FONT }),
          ],
          spacing: { after: 20 },
        })
      );
      children.push(
        new Paragraph({
          children: [new TextRun({ text: ed.university, size: BODY_SIZE, font: FONT })],
          spacing: { after: 20 },
        })
      );
      if (ed.coursework) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Relevant Coursework: ", bold: true, size: BODY_SIZE, font: FONT }),
              new TextRun({ text: ed.coursework, size: BODY_SIZE, font: FONT }),
            ],
            spacing: { after: 60 },
          })
        );
      }
    });
  }

  // Skills
  if (cv.technicalSkills) {
    children.push(sectionHeader("Skills"));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: cv.technicalSkills, size: BODY_SIZE, font: FONT })],
        spacing: { after: 80 },
      })
    );
  }

  // Certifications (only if present — via honorsAwards with "cert" marker or dedicated field)
  // Projects
  if (cv.projectExperience?.length) {
    children.push(sectionHeader("Projects"));
    cv.projectExperience.forEach((proj) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: proj.title, bold: true, size: BODY_SIZE, font: FONT }),
            new TextRun({ text: `  ${proj.dates}`, italics: true, size: BODY_SIZE, font: FONT }),
          ],
          spacing: { before: 60, after: 20 },
        })
      );
      proj.bullets?.forEach((b) => children.push(bullet(b)));
    });
  }

  // Awards
  if (cv.honorsAwards?.length) {
    children.push(sectionHeader("Awards"));
    cv.honorsAwards.forEach((award) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: award.title, bold: true, size: BODY_SIZE, font: FONT }),
            new TextRun({ text: `  ${award.date}`, italics: true, size: BODY_SIZE, font: FONT }),
          ],
          spacing: { after: 40 },
        })
      );
    });
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `ATS_CV_${date}.docx`);
}
