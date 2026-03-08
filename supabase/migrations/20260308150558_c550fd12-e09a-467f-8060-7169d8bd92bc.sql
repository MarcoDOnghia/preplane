
-- =====================================================
-- FIX: Convert ALL RESTRICTIVE RLS policies to PERMISSIVE
-- =====================================================

-- 1. PROFILES
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- 2. CAMPAIGNS
DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON public.campaigns;

CREATE POLICY "Users can view their own campaigns" ON public.campaigns
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own campaigns" ON public.campaigns
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns" ON public.campaigns
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns" ON public.campaigns
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 3. CVS
DROP POLICY IF EXISTS "Users can view their own CVs" ON public.cvs;
DROP POLICY IF EXISTS "Users can insert their own CVs" ON public.cvs;
DROP POLICY IF EXISTS "Users can update their own CVs" ON public.cvs;
DROP POLICY IF EXISTS "Users can delete their own CVs" ON public.cvs;

CREATE POLICY "Users can view their own CVs" ON public.cvs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own CVs" ON public.cvs
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own CVs" ON public.cvs
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own CVs" ON public.cvs
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4. APPLICATIONS
DROP POLICY IF EXISTS "Users can view their own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can insert their own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can update their own applications" ON public.applications;
DROP POLICY IF EXISTS "Users can delete their own applications" ON public.applications;

CREATE POLICY "Users can view their own applications" ON public.applications
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own applications" ON public.applications
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own applications" ON public.applications
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own applications" ON public.applications
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 5. APPLICATION_NOTES
DROP POLICY IF EXISTS "Users can view their own notes" ON public.application_notes;
DROP POLICY IF EXISTS "Users can create their own notes" ON public.application_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.application_notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.application_notes;

CREATE POLICY "Users can view their own notes" ON public.application_notes
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes" ON public.application_notes
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" ON public.application_notes
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" ON public.application_notes
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 6. APPLICATION_REMINDERS
DROP POLICY IF EXISTS "Users can view their own reminders" ON public.application_reminders;
DROP POLICY IF EXISTS "Users can create their own reminders" ON public.application_reminders;
DROP POLICY IF EXISTS "Users can update their own reminders" ON public.application_reminders;
DROP POLICY IF EXISTS "Users can delete their own reminders" ON public.application_reminders;

CREATE POLICY "Users can view their own reminders" ON public.application_reminders
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reminders" ON public.application_reminders
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminders" ON public.application_reminders
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminders" ON public.application_reminders
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 7. APPLICATION_TIMELINE
DROP POLICY IF EXISTS "Users can view their own timeline events" ON public.application_timeline;
DROP POLICY IF EXISTS "Users can create their own timeline events" ON public.application_timeline;
DROP POLICY IF EXISTS "Users can update their own timeline events" ON public.application_timeline;
DROP POLICY IF EXISTS "Users can delete their own timeline events" ON public.application_timeline;

CREATE POLICY "Users can view their own timeline events" ON public.application_timeline
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own timeline events" ON public.application_timeline
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own timeline events" ON public.application_timeline
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own timeline events" ON public.application_timeline
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 8. OUTREACH_MESSAGES
DROP POLICY IF EXISTS "Users can view their own outreach messages" ON public.outreach_messages;
DROP POLICY IF EXISTS "Users can create their own outreach messages" ON public.outreach_messages;
DROP POLICY IF EXISTS "Users can update their own outreach messages" ON public.outreach_messages;
DROP POLICY IF EXISTS "Users can delete their own outreach messages" ON public.outreach_messages;

CREATE POLICY "Users can view their own outreach messages" ON public.outreach_messages
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own outreach messages" ON public.outreach_messages
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own outreach messages" ON public.outreach_messages
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own outreach messages" ON public.outreach_messages
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 9. INTERVIEW_FEEDBACK
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.interview_feedback;
DROP POLICY IF EXISTS "Users can create their own feedback" ON public.interview_feedback;
DROP POLICY IF EXISTS "Users can update their own feedback" ON public.interview_feedback;
DROP POLICY IF EXISTS "Users can delete their own feedback" ON public.interview_feedback;

CREATE POLICY "Users can view their own feedback" ON public.interview_feedback
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own feedback" ON public.interview_feedback
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback" ON public.interview_feedback
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback" ON public.interview_feedback
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 10. COMPANIES (public read-only)
DROP POLICY IF EXISTS "Anyone can read companies" ON public.companies;

CREATE POLICY "Anyone can read companies" ON public.companies
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

-- 11. USAGE_LIMITS (SELECT + INSERT only for authenticated; no UPDATE/DELETE)
DROP POLICY IF EXISTS "Users can view their own usage" ON public.usage_limits;
DROP POLICY IF EXISTS "Users can insert their own usage" ON public.usage_limits;

CREATE POLICY "Users can view their own usage" ON public.usage_limits
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage" ON public.usage_limits
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
