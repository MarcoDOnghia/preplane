

# UrTailor — AI-Powered CV & Cover Letter Tailoring App

## Overview
A web app that helps users customize their CV and generate tailored cover letters for specific job applications, with account-based history to revisit past applications.

---

## 1. Authentication & User Accounts
- Email/password signup and login
- User profiles table to store display name
- Protected routes — only logged-in users can access the app

## 2. Input Section (Two-Column Layout)
- **Left column — CV Input:**
  - File upload supporting `.pdf` and `.docx` formats
  - Text extraction using `mammoth.js` (for .docx) and `PDF.js` (for PDF)
  - Alternative: paste CV text directly into a textarea
- **Right column — Job Description:**
  - Textarea to paste job description text
- **Tone selector** dropdown: Professional, Enthusiastic, or Creative
- "Tailor My Application" button to trigger analysis
- "Clear All" button to reset inputs

## 3. AI-Powered Analysis (Lovable AI Gateway)
- Backend edge function calls Lovable AI with CV content, job description, and selected tone
- Structured output via tool calling returns:
  - Top 5–7 key requirements extracted from the job description
  - Specific CV modification suggestions with original vs. suggested text and reasoning
  - A personalized cover letter matching the selected tone
- Loading state with progress messages during processing

## 4. Results Display (Tab-Based Interface)
- **Tab 1 — Key Requirements:** Job requirements shown as badge/cards
- **Tab 2 — CV Suggestions:** Side-by-side comparison cards showing original text, suggested text, and the reason for each change
- **Tab 3 — Cover Letter:** Generated cover letter displayed in an editable textarea with word count
- All text is editable by the user before exporting

## 5. Export Functionality
- Download tailored CV suggestions as a Word document (using `docx` library)
- Download cover letter as a Word document
- Professional formatting with proper fonts and spacing

## 6. Application History (Database)
- Save each tailored application (job title, company, date, results) to the database
- Dashboard/history page listing past applications
- Click to revisit and re-download previous results

## 7. Design & UX
- Clean, modern UI with blue (#2563eb) primary color and neutral grays
- Responsive layout for desktop and mobile
- Subtle animations and transitions for loading states and tab switches
- Clear visual hierarchy with the header, main content area, and footer
- Sample CV and job description available as demo data for first-time users

