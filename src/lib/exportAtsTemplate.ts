import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import type { ReformattedCv } from "./types";

function sectionHeader(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 24, font: "Calibri" }),
    ],
    spacing: { before: 280, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "444444" },
    },
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Calibri" })],
    bullet: { level: 0 },
    spacing: { after: 40 },
  });
}

export function reformattedCvToHtml(cv: ReformattedCv): string {
  const parts: string[] = [];
  parts.push(`<h1>${cv.name}</h1>`);
  parts.push(`<p>${cv.contact}</p>`);

  parts.push(`<h2>PROFILE SUMMARY</h2>`);
  parts.push(`<p>${cv.profileSummary}</p>`);

  if (cv.education?.length) {
    parts.push(`<h2>EDUCATION</h2>`);
    cv.education.forEach((e) => {
      parts.push(`<p><strong>${e.degree}</strong> ${e.dates}</p>`);
      parts.push(`<p>${e.university}</p>`);
      if (e.coursework) {
        parts.push(`<p><strong>Relevant Coursework:</strong> ${e.coursework}</p>`);
      }
    });
  }

  if (cv.experience?.length) {
    parts.push(`<h2>PROFESSIONAL EXPERIENCE</h2>`);
    cv.experience.forEach((exp) => {
      parts.push(`<p><strong>${exp.role}</strong> — ${exp.company} — ${exp.dates}</p>`);
      if (exp.bullets?.length) {
        parts.push("<ul>");
        exp.bullets.forEach((b) => parts.push(`<li>${b}</li>`));
        parts.push("</ul>");
      }
    });
  }

  if (cv.technicalSkills) {
    parts.push(`<h2>TECHNICAL SKILLS</h2>`);
    parts.push(`<p>${cv.technicalSkills}</p>`);
  }

  if (cv.projectExperience?.length) {
    parts.push(`<h2>PROJECT EXPERIENCE</h2>`);
    cv.projectExperience.forEach((p) => {
      parts.push(`<p><strong>${p.title}</strong> ${p.dates}</p>`);
      if (p.bullets?.length) {
        parts.push("<ul>");
        p.bullets.forEach((b) => parts.push(`<li>${b}</li>`));
        parts.push("</ul>");
      }
    });
  }

  if (cv.honorsAwards?.length) {
    parts.push(`<h2>HONORS & AWARDS</h2>`);
    cv.honorsAwards.forEach((a) => {
      parts.push(`<p><strong>${a.title}</strong> ${a.date}</p>`);
    });
  }

  return parts.join("");
}

export async function exportAtsTemplateCv(cv: ReformattedCv, jobTitle: string) {
  const children: Paragraph[] = [];

  // Name
  children.push(
    new Paragraph({
      children: [new TextRun({ text: cv.name.toUpperCase(), bold: true, size: 32, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    })
  );

  // Contact
  children.push(
    new Paragraph({
      children: [new TextRun({ text: cv.contact, size: 22, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Profile Summary
  children.push(sectionHeader("Profile Summary"));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: cv.profileSummary, size: 22, font: "Calibri" })],
      spacing: { after: 120 },
    })
  );

  // Education
  if (cv.education?.length) {
    children.push(sectionHeader("Education"));
    cv.education.forEach((ed) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: ed.degree, bold: true, size: 22, font: "Calibri" }),
            new TextRun({ text: `  ${ed.dates}`, italics: true, size: 22, font: "Calibri" }),
          ],
          spacing: { after: 40 },
        })
      );
      children.push(
        new Paragraph({
          children: [new TextRun({ text: ed.university, size: 22, font: "Calibri" })],
          spacing: { after: 40 },
        })
      );
      if (ed.coursework) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Relevant Coursework: ", bold: true, size: 20, font: "Calibri" }),
              new TextRun({ text: ed.coursework, size: 20, font: "Calibri" }),
            ],
            spacing: { after: 80 },
          })
        );
      }
    });
  }

  // Professional Experience
  if (cv.experience?.length) {
    children.push(sectionHeader("Professional Experience"));
    cv.experience.forEach((exp) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${exp.role} — ${exp.company}`, bold: true, size: 22, font: "Calibri" }),
          ],
          spacing: { before: 80, after: 20 },
        })
      );
      children.push(
        new Paragraph({
          children: [new TextRun({ text: exp.dates, italics: true, size: 22, font: "Calibri" })],
          spacing: { after: 60 },
        })
      );
      exp.bullets?.forEach((b) => children.push(bullet(b)));
    });
  }

  // Technical Skills
  if (cv.technicalSkills) {
    children.push(sectionHeader("Technical Skills"));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: cv.technicalSkills, size: 22, font: "Calibri" })],
        spacing: { after: 80 },
      })
    );
  }

  // Project Experience
  if (cv.projectExperience?.length) {
    children.push(sectionHeader("Project Experience"));
    cv.projectExperience.forEach((proj) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: proj.title, bold: true, size: 22, font: "Calibri" }),
            new TextRun({ text: `  ${proj.dates}`, italics: true, size: 22, font: "Calibri" }),
          ],
          spacing: { before: 80, after: 40 },
        })
      );
      proj.bullets?.forEach((b) => children.push(bullet(b)));
    });
  }

  // Honors & Awards
  if (cv.honorsAwards?.length) {
    children.push(sectionHeader("Honors & Awards"));
    cv.honorsAwards.forEach((award) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: award.title, bold: true, size: 22, font: "Calibri" }),
            new TextRun({ text: `  ${award.date}`, italics: true, size: 22, font: "Calibri" }),
          ],
          spacing: { after: 60 },
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
  saveAs(blob, `ATS_Template_CV_${date}.docx`);
}
