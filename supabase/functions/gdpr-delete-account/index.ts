import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user from their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { confirmation } = await req.json();
    if (confirmation !== "DELETE_MY_ACCOUNT") {
      return new Response(JSON.stringify({ error: "Invalid confirmation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userId = user.id;

    // Delete all user data in dependency order (children first)
    // Tables with foreign keys to applications
    await Promise.all([
      adminClient.from("application_notes").delete().eq("user_id", userId),
      adminClient.from("application_reminders").delete().eq("user_id", userId),
      adminClient.from("application_timeline").delete().eq("user_id", userId),
      adminClient.from("interview_feedback").delete().eq("user_id", userId),
      adminClient.from("outreach_messages").delete().eq("user_id", userId),
    ]);

    // Tables with foreign keys to campaigns
    await Promise.all([
      adminClient.from("campaign_signals").delete().eq("user_id", userId),
      adminClient.from("proof_cards").delete().eq("user_id", userId),
    ]);

    // Get user email for email-related tables
    const userEmail = user.email;

    // Parent tables and standalone tables
    await Promise.all([
      adminClient.from("applications").delete().eq("user_id", userId),
      adminClient.from("campaigns").delete().eq("user_id", userId),
      adminClient.from("cvs").delete().eq("user_id", userId),
      adminClient.from("research_usage").delete().eq("user_id", userId),
      adminClient.from("usage_limits").delete().eq("user_id", userId),
      adminClient.from("role_waitlist").delete().eq("user_id", userId),
      adminClient.from("role_waitlist_insights").delete().eq("user_id", userId),
      adminClient.from("profiles").delete().eq("user_id", userId),
    ]);

    // Clean email-related tables by user email
    if (userEmail) {
      await Promise.all([
        adminClient.from("email_send_log").delete().eq("recipient_email", userEmail),
        adminClient.from("suppressed_emails").delete().eq("email", userEmail),
        adminClient.from("email_unsubscribe_tokens").delete().eq("email", userEmail),
      ]);
    }

    // Delete storage files
    try {
      const { data: cvFiles } = await adminClient.storage.from("cvs").list(userId);
      if (cvFiles?.length) {
        await adminClient.storage.from("cvs").remove(cvFiles.map(f => `${userId}/${f.name}`));
      }
      const { data: proofFiles } = await adminClient.storage.from("proof-cards").list(userId);
      if (proofFiles?.length) {
        await adminClient.storage.from("proof-cards").remove(proofFiles.map(f => `${userId}/${f.name}`));
      }
    } catch (storageErr) {
      console.error("Storage cleanup error (non-fatal):", storageErr);
    }

    // Finally delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Auth delete error:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete auth account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("GDPR delete error:", err);
    return new Response(JSON.stringify({ error: "Deletion failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
