-- Block authenticated access to email infrastructure tables
-- email_send_log: deny authenticated SELECT
CREATE POLICY "No authenticated reads on email_send_log"
ON email_send_log FOR SELECT
TO authenticated
USING (false);

-- email_unsubscribe_tokens: deny authenticated SELECT
CREATE POLICY "No authenticated reads on email_unsubscribe_tokens"
ON email_unsubscribe_tokens FOR SELECT
TO authenticated
USING (false);

-- suppressed_emails: deny authenticated SELECT
CREATE POLICY "No authenticated reads on suppressed_emails"
ON suppressed_emails FOR SELECT
TO authenticated
USING (false);

-- beta_whitelist: deny authenticated SELECT (use RPC instead)
CREATE POLICY "No authenticated reads on beta_whitelist"
ON beta_whitelist FOR SELECT
TO authenticated
USING (false);

-- email_send_state: deny authenticated SELECT
CREATE POLICY "No authenticated reads on email_send_state"
ON email_send_state FOR SELECT
TO authenticated
USING (false);

-- Ensure RLS is enabled on all these tables
ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppressed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_send_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_usage ENABLE ROW LEVEL SECURITY;