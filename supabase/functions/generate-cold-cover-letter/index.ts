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

function sanitizeInput(text: string): string {
  return text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/system\s*:\s*/gi, "")
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting
    const { data: allowed } = await supabaseClient.rpc("check_and_increment_usage", {
      _user_id: user.id,
      _feature: "cold_cover_letter",
      _max_count: 5,
    });
    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: "You've used your daily limit for this feature. Come back tomorrow." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { cvContent, company, roleType, powBrief, contactName } = body;

    if (!cvContent || !company || !roleType || !powBrief) {
      return new Response(
        JSON.stringify({ error: "CV content, company, role type, and proof of work brief are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const textsToCheck = [cvContent, company, roleType, powBrief, contactName].filter(Boolean) as string[];
    for (const text of textsToCheck) {
      if (containsInjection(text)) {
        return new Response(
          JSON.stringify({ error: "Invalid input" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const safeCv = sanitizeInput(cvContent).slice(0, 3000);
    const safeCompany = sanitizeInput(company).slice(0, 200);
    const safeRoleType = sanitizeInput(roleType).slice(0, 200);
    const safePow = sanitizeInput(powBrief).slice(0, 3000);
    const safeContact = contactName ? sanitizeInput(contactName).slice(0, 100) : "";

    const greeting = safeContact ? `Hi ${safeContact},` : "Hi,";

    const systemPrompt = `You are a career strategist writing a cold outreach cover letter for a student. This is NOT a standard job application cover letter. This is for cold outreach to a company with no job posting.

ABSOLUTE TRUTHFULNESS RULE:
- NEVER invent, fabricate, or hallucinate ANY information not in the CV or PoW brief.
- Every claim must be traceable to what the user actually wrote.

THE COVER LETTER MUST FOLLOW THIS EXACT 4-PARAGRAPH STRUCTURE:

PARAGRAPH 1 — The hook (PoW lead):
Open with what the user built. Reference the SPECIFIC PoW project BY NAME and one key finding or insight from it. Write as if the reader has never heard of this project before. Be specific about what was built and what was discovered.

PARAGRAPH 2 — Why this company specifically:
One specific reason why the user is targeting ${safeCompany}. Reference something real about the company — their stage, their USP, their market position — not a generic compliment. Be concrete.

PARAGRAPH 3 — What the user brings:
Connect one specific experience from the CV to what ${safeCompany} needs for a ${safeRoleType} role. Maximum two sentences. Be precise.

PARAGRAPH 4 — The CTA:
Soft close. Offer to share the PoW or get feedback. NEVER ask for a job or internship directly. One sentence maximum.

RULES:
- Start with "${greeting}" — NEVER "Dear Hiring Manager" or any formal opener
- NEVER use "I am writing to express my interest" or any similar corporate opener
- Tone is direct, confident, and human — written by a person not a template
- Maximum 250 words total
- The PoW MUST be mentioned BY NAME and described specifically — never referred to as "a project" generically
- NEVER start more than 2 consecutive sentences with "I" or "My"
- NEVER use em dashes (—) or double dashes (--)
- NEVER use "I look forward to the possibility of discussing"
- Use natural contractions (I'm, you're, we're)

You MUST call the generate_cover_letter function with the result.`;

    const userPrompt = `<USER_CV>\n${safeCv}\n</USER_CV>\n\n<PROOF_OF_WORK_BRIEF>\n${safePow}\n</PROOF_OF_WORK_BRIEF>\n\nTarget Company: ${safeCompany}\nTarget Role Type: ${safeRoleType}`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "generate_cover_letter",
              description: "Return the cold outreach cover letter",
              parameters: {
                type: "object",
                properties: {
                  coverLetter: {
                    type: "string",
                    description: "The full cover letter text, 4 paragraphs, max 250 words",
                  },
                },
                required: ["coverLetter"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_cover_letter" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No structured response from AI");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-cold-cover-letter error:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
