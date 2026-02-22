export interface CvSuggestion {
  section: string;
  original: string;
  suggested: string;
  reason: string;
  priority?: "high" | "medium" | "low";
  impactScore?: number;
}

export interface CoverLetterVersion {
  label: string;
  content: string;
}

export interface InterviewQuestion {
  question: string;
  starGuidance: string;
  suggestedAnswer: string;
}

export interface AtsAnalysis {
  score: number;
  keywordsFound: string[];
  keywordsMissing: string[];
  formattingIssues: string[];
  quickWins: string[];
}

export interface TailorResult {
  keyRequirements: string[];
  cvSuggestions: CvSuggestion[];
  coverLetter: string;
  coverLetterVersions: CoverLetterVersion[];
  atsAnalysis: AtsAnalysis;
  interviewQuestions: InterviewQuestion[];
  questionsToAsk: string[];
  companyBrief: string;
  reformattedCv?: ReformattedCv;
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
  cover_letter_versions: CoverLetterVersion[];
  ats_score: number;
  keywords_found: string[];
  keywords_missing: string[];
  formatting_issues: string[];
  quick_wins: string[];
  interview_questions: InterviewQuestion[];
  questions_to_ask: string[];
  company_brief: string;
  status: string;
  applied_date: string | null;
  follow_up_date: string | null;
  created_at: string;
}

export interface ReformattedEducation {
  degree: string;
  dates: string;
  university: string;
  coursework: string;
}

export interface ReformattedExperience {
  role: string;
  company: string;
  dates: string;
  bullets: string[];
}

export interface ReformattedProject {
  title: string;
  dates: string;
  bullets: string[];
}

export interface ReformattedAward {
  title: string;
  date: string;
}

export interface ReformattedCv {
  name: string;
  contact: string;
  profileSummary: string;
  education: ReformattedEducation[];
  experience: ReformattedExperience[];
  technicalSkills: string;
  projectExperience: ReformattedProject[];
  honorsAwards: ReformattedAward[];
}

export type Tone = "professional" | "enthusiastic" | "creative";
