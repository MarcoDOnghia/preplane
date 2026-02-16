
-- Timeline events for tracking status changes and metadata
CREATE TABLE public.application_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'status_change',
  from_status TEXT,
  to_status TEXT,
  metadata JSONB DEFAULT '{}',
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.application_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own timeline events"
  ON public.application_timeline FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own timeline events"
  ON public.application_timeline FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own timeline events"
  ON public.application_timeline FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own timeline events"
  ON public.application_timeline FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_timeline_app ON public.application_timeline(application_id);

-- Notes for applications
CREATE TABLE public.application_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.application_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notes"
  ON public.application_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own notes"
  ON public.application_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own notes"
  ON public.application_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notes"
  ON public.application_notes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_notes_app ON public.application_notes(application_id);

-- Reminders for applications
CREATE TABLE public.application_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reminder_type TEXT NOT NULL DEFAULT 'follow_up',
  title TEXT NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.application_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reminders"
  ON public.application_reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own reminders"
  ON public.application_reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own reminders"
  ON public.application_reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reminders"
  ON public.application_reminders FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_reminders_app ON public.application_reminders(application_id);
CREATE INDEX idx_reminders_due ON public.application_reminders(user_id, is_done, due_date);

-- Add offer/rejection metadata columns to applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS salary_offered NUMERIC,
  ADD COLUMN IF NOT EXISTS salary_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS offer_deadline TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rejection_stage TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS interview_type TEXT,
  ADD COLUMN IF NOT EXISTS interviewer_name TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP WITH TIME ZONE;
