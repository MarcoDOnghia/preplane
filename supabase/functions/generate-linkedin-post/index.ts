import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|context)/i,
  /you\s+are\s+now\s+/i,
  /disregard\s+(your|all|previous|any)/i,
  /\bact\s+as\b/i,
  /\bpretend\s+(to\s+be|you('re| are))\b/i,
];

function containsInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 5 LinkedIn posts per day
    const { data: allowed, error: rpcError } = await supabaseClient.rpc("check_and_increment_usage", {
      _user_id: user.id,
      _feature: "linkedin_post",
      _max_count: 5,
    });
    if (rpcError || allowed === false) {
      return new Response(
        JSON.stringify({ error: "Daily limit reached for LinkedIn posts. Come back tomorrow." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { company, role, outreachHook, writingStyle, selectedAngle } = await req.json();

    // Injection check
    const textsToCheck = [company, role, outreachHook, selectedAngle].filter(Boolean).map(String);
    for (const text of textsToCheck) {
      if (containsInjection(text)) {
        return new Response(JSON.stringify({ error: "Invalid input" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a LinkedIn post ghostwriter for a student or early-career professional. You write short, authentic LinkedIn posts that showcase proof of work.

RULES:
- Write in the "${writingStyle}" style
- Keep it under 200 words
- Use short paragraphs (1-2 sentences each)
- No hashtags in the body — put 3-5 at the very end
- No emojis in the first line
- Lead with the insight or result, not "I just did..."
- Make it sound like a real person, not AI
- Never fabricate metrics, results, or experiences
- The post should subtly showcase the work without being a brag
- End with a question or soft CTA to drive comments`;

    let userPrompt = `Write a LinkedIn post for someone targeting a ${role} role at ${company}.

They built a proof of work project. Here's the outreach hook that summarizes what they did:
"${outreachHook}"`;

    if (selectedAngle) {
      userPrompt += `\n\nThe user wants to write about this specific angle:\n"${selectedAngle}"`;
    }

    userPrompt += `\n\nWrite the post now. Just the post text, nothing else.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Failed to generate post" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const post = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ post }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-linkedin-post error:", e);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
