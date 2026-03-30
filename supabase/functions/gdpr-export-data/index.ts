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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userId = user.id;

    // Collect all user data from every table
    const [
      profiles, applications, campaigns, campaignSignals,
      cvs, applicationNotes, applicationReminders,
      applicationTimeline, interviewFeedback, outreachMessages,
      proofCards, researchUsage, usageLimits,
      roleWaitlist, roleWaitlistInsights
    ] = await Promise.all([
      adminClient.from("profiles").select("*").eq("user_id", userId),
      adminClient.from("applications").select("*").eq("user_id", userId),
      adminClient.from("campaigns").select("*").eq("user_id", userId),
      adminClient.from("campaign_signals").select("*").eq("user_id", userId),
      adminClient.from("cvs").select("*").eq("user_id", userId),
      adminClient.from("application_notes").select("*").eq("user_id", userId),
      adminClient.from("application_reminders").select("*").eq("user_id", userId),
      adminClient.from("application_timeline").select("*").eq("user_id", userId),
      adminClient.from("interview_feedback").select("*").eq("user_id", userId),
      adminClient.from("outreach_messages").select("*").eq("user_id", userId),
      adminClient.from("proof_cards").select("*").eq("user_id", userId),
      adminClient.from("research_usage").select("*").eq("user_id", userId),
      adminClient.from("usage_limits").select("*").eq("user_id", userId),
      adminClient.from("role_waitlist").select("*").eq("user_id", userId),
      adminClient.from("role_waitlist_insights").select("*").eq("user_id", userId),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      profiles: profiles.data || [],
      applications: applications.data || [],
      campaigns: campaigns.data || [],
      campaign_signals: campaignSignals.data || [],
      cvs: cvs.data || [],
      application_notes: applicationNotes.data || [],
      application_reminders: applicationReminders.data || [],
      application_timeline: applicationTimeline.data || [],
      interview_feedback: interviewFeedback.data || [],
      outreach_messages: outreachMessages.data || [],
      proof_cards: proofCards.data || [],
      research_usage: researchUsage.data || [],
      usage_limits: usageLimits.data || [],
      role_waitlist: roleWaitlist.data || [],
      role_waitlist_insights: roleWaitlistInsights.data || [],
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="preplane-data-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (err) {
    console.error("GDPR export error:", err);
    return new Response(JSON.stringify({ error: "Export failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
