import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|context)/i,
  /you\s+are\s+now\s+/i,
  /disregard\s+(your|all|previous|any)/i,
  /\bact\s+as\b/i,
  /\bpretend\s+(to\s+be|you('re| are))\b/i,
];

function stripHtml(text: string): string {
  return text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function containsInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

function sanitizeInput(text: string): string {
  return stripHtml(text)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/system\s*:\s*/gi, "")
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting: max 15 alignment checks per day
    const { data: allowed, error: rpcError } = await supabaseClient.rpc("check_and_increment_usage", {
      _user_id: user.id,
      _feature: "check_alignment",
      _max_count: 15,
    });
    if (rpcError || allowed === false) {
      return new Response(
        JSON.stringify({ error: "You've used your daily limit for this feature. Come back tomorrow — limits reset at midnight." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { targetRole: rawTargetRole, jobDescription: rawJobDescription } = await req.json();
    if (!rawTargetRole || !rawJobDescription) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Injection check
    if (containsInjection(String(rawTargetRole)) || containsInjection(String(rawJobDescription))) {
      console.warn(`Prompt injection attempt detected from user ${user.id}`);
      return new Response(
        JSON.stringify({ error: "Invalid input" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetRole = sanitizeInput(String(rawTargetRole)).slice(0, 200);
    const jobDescription = sanitizeInput(String(rawJobDescription)).slice(0, 5000);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const jdSnippet = jobDescription.slice(0, 1000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "user",
            content: `The user's long-term career target is: <USER_DATA>${targetRole}</USER_DATA>. The job description is: <USER_DATA>${jdSnippet}</USER_DATA>. Assess whether this role is a strong, partial, or weak stepping stone toward that target. Consider that roles in adjacent fields, smaller firms, or different locations can still be valid stepping stones. Rate as strong if directly relevant, partial if it builds transferable skills or is a logical stepping stone, weak only if there is genuinely no career logic connecting this role to the target. Return JSON only: { "alignment": "strong"|"partial"|"weak", "reason": "one sentence explanation, focus on career logic not location" }`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status, await response.text());
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify({
      alignment: parsed.alignment,
      reason: parsed.reason,
      targetRole,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-alignment error:", e);
    return new Response(JSON.stringify({ skipped: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
