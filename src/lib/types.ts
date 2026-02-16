export interface CvSuggestion {
  section: string;
  original: string;
  suggested: string;
  reason: string;
}

export interface TailorResult {
  keyRequirements: string[];
  cvSuggestions: CvSuggestion[];
  coverLetter: string;
}

export interface ApplicationRecord {
  id: string;
  job_title: string;
  company: string;
  cv_content: string;
  job_description: string;
  tone: string;
  key_requirements: string[];
  cv_suggestions: CvSuggestion[];
  cover_letter: string;
  created_at: string;
}

export type Tone = "professional" | "enthusiastic" | "creative";
