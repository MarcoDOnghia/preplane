
-- Create outreach_messages table
CREATE TABLE public.outreach_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  application_id UUID NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'hiring_manager',
  recipient_name TEXT,
  recipient_email TEXT,
  subject TEXT,
  content TEXT NOT NULL DEFAULT '',
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_application FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own outreach messages"
ON public.outreach_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own outreach messages"
ON public.outreach_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own outreach messages"
ON public.outreach_messages FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own outreach messages"
ON public.outreach_messages FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_outreach_messages_updated_at
BEFORE UPDATE ON public.outreach_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_outreach_messages_application ON public.outreach_messages(application_id);
CREATE INDEX idx_outreach_messages_user ON public.outreach_messages(user_id);
