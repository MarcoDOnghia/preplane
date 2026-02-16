
-- Create interview_feedback table
CREATE TABLE public.interview_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  application_id UUID NOT NULL,
  interview_date DATE NOT NULL DEFAULT CURRENT_DATE,
  interviewer_name TEXT,
  interview_type TEXT DEFAULT 'general',
  questions_asked JSONB NOT NULL DEFAULT '[]'::jsonb,
  unexpected_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  self_rating INTEGER NOT NULL DEFAULT 3 CHECK (self_rating >= 1 AND self_rating <= 5),
  went_well TEXT,
  improvement_notes TEXT,
  overall_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_application FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback"
ON public.interview_feedback FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own feedback"
ON public.interview_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
ON public.interview_feedback FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback"
ON public.interview_feedback FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_interview_feedback_updated_at
BEFORE UPDATE ON public.interview_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_interview_feedback_application ON public.interview_feedback(application_id);
CREATE INDEX idx_interview_feedback_user ON public.interview_feedback(user_id);
