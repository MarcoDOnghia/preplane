import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the Authorization header for authenticated edge function calls.
 * Use this whenever you need to pass explicit auth headers.
 *
 * @throws Error if the user is not authenticated
 */
export async function getAuthHeader(): Promise<{ Authorization: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${session.access_token}` };
}
