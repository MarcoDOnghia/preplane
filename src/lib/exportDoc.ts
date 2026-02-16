import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import type { CvSuggestion, InterviewQuestion } from "@/lib/types";

export async function exportCoverLetter(coverLetter: string, jobTitle: string) {
  const paragraphs = coverLetter.split("\n").filter(Boolean).map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line, size: 24, font: "Calibri" })],
        spacing: { after: 200 },
      })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: `Cover Letter — ${jobTitle}`, heading: HeadingLevel.HEADING_1, spacing: { after: 400 } }),
        ...paragraphs,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Cover_Letter_${jobTitle.replace(/\s+/g, "_")}.docx`);
}

export async function exportCvSuggestions(suggestions: CvSuggestion[], jobTitle: string) {
  const children: Paragraph[] = [
    new Paragraph({ text: `CV Tailoring Suggestions — ${jobTitle}`, heading: HeadingLevel.HEADING_1, spacing: { after: 400 } }),
  ];

  suggestions.forEach((s, i) => {
    children.push(
      new Paragraph({ text: `${i + 1}. ${s.section}${s.priority ? ` [${s.priority.toUpperCase()}]` : ""}`, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 } }),
      new Paragraph({
        children: [
          new TextRun({ text: "Original: ", bold: true, size: 22, font: "Calibri" }),
          new TextRun({ text: s.original, size: 22, font: "Calibri" }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Suggested: ", bold: true, size: 22, font: "Calibri", color: "2563EB" }),
          new TextRun({ text: s.suggested, size: 22, font: "Calibri" }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Reason: ", bold: true, italics: true, size: 20, font: "Calibri" }),
          new TextRun({ text: s.reason, italics: true, size: 20, font: "Calibri" }),
        ],
        spacing: { after: 300 },
      })
    );
  });

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `CV_Suggestions_${jobTitle.replace(/\s+/g, "_")}.docx`);
}

export async function exportInterviewPrep(
  questions: InterviewQuestion[],
  questionsToAsk: string[],
  companyBrief: string,
  jobTitle: string
) {
  const children: Paragraph[] = [
    new Paragraph({ text: `Interview Prep — ${jobTitle}`, heading: HeadingLevel.HEADING_1, spacing: { after: 400 } }),
    new Paragraph({ text: "Likely Interview Questions", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 200 } }),
  ];

  questions.forEach((q, i) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${i + 1}. ${q.question}`, bold: true, size: 24, font: "Calibri" })],
        spacing: { before: 200, after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "STAR Guidance: ", bold: true, size: 22, font: "Calibri" }),
          new TextRun({ text: q.starGuidance, size: 22, font: "Calibri" }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Suggested Answer: ", bold: true, size: 22, font: "Calibri" }),
          new TextRun({ text: q.suggestedAnswer, size: 22, font: "Calibri" }),
        ],
        spacing: { after: 200 },
      })
    );
  });

  children.push(
    new Paragraph({ text: "Questions to Ask the Interviewer", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 } })
  );

  questionsToAsk.forEach((q, i) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${i + 1}. ${q}`, size: 22, font: "Calibri" })],
        spacing: { after: 100 },
      })
    );
  });

  if (companyBrief) {
    children.push(
      new Paragraph({ text: "Company Research Brief", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 } }),
      ...companyBrief.split("\n").filter(Boolean).map(
        (line) => new Paragraph({ children: [new TextRun({ text: line, size: 22, font: "Calibri" })], spacing: { after: 150 } })
      )
    );
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Interview_Prep_${jobTitle.replace(/\s+/g, "_")}.docx`);
}
