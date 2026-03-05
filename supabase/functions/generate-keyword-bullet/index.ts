import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const { keyword, cvContent, jobDescription, existingBullets } = await req.json();

    if (!keyword || !cvContent) {
      return new Response(JSON.stringify({ error: "keyword and cvContent are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert CV/resume writer. Given a missing ATS keyword and the user's existing CV, generate a tailored addition that naturally incorporates this keyword.

CRITICAL: First classify the keyword into one of two types:

TYPE A — Tool/Software keywords: Named tools, software, platforms, technologies, programming languages, or specific product names (e.g. Microsoft Office, Excel, PowerPoint, Salesforce, HubSpot, Python, SQL, SAP, Tableau, CRM tools, Google Analytics, Jira, Slack).
→ For these: generate a suggestion to UPDATE THE SKILLS SECTION ONLY. Reformat the existing skills line to explicitly include the tool name. For example, if the CV has "Excel (Financial Modeling)" and the keyword is "Microsoft Office", suggest: "Microsoft Office: Excel (Financial Modeling, Data Analysis), PowerPoint". NEVER generate an experience bullet rephrase for tool keywords. Set section to "Skills" and isRephrase to true.

TYPE B — Skill/Competency keywords: Actions, capabilities, or domain expertise (e.g. lead generation, cold calling, customer service, data analysis, project management, CRM hygiene).
→ For these: generate a natural experience bullet rephrase. Weave the keyword in naturally mid-sentence, NEVER bolt it on at the start (bad: "Leveraged customer service to..."; good: "Resolved 50+ customer inquiries daily, maintaining a 95% customer service satisfaction rating").

Rules for both types:
1. Pull from the user's ACTUAL experience in their CV
2. If the user has related but differently-worded experience, rephrase to include the keyword naturally
3. Keep it to 1-2 lines maximum
4. Set "section" to either "Skills" (Type A) or the relevant experience section name (Type B)
5. Do NOT repeat any metric, percentage, phrase, or achievement that already appears in the existing bullets provided below. Each bullet must add completely new information.

You MUST call the generate_bullet function with your result.`;

    const existingBulletsText = Array.isArray(existingBullets) && existingBullets.length > 0
      ? `\n\nEXISTING BULLETS in the target experience entry (DO NOT repeat any metric, phrase, or achievement from these):\n${existingBullets.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n')}`
      : '';

    const userPrompt = `Missing keyword: "${keyword}"

Job Description context:
${(jobDescription || "").slice(0, 3000)}

User's CV:
${cvContent.slice(0, 8000)}${existingBulletsText}

First classify "${keyword}" as a tool/software (Type A) or skill/competency (Type B), then generate the appropriate suggestion.`;

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
              name: "generate_bullet",
              description: "Return the generated bullet point for the missing keyword",
              parameters: {
                type: "object",
                properties: {
                  bullet: {
                    type: "string",
                    description: "The generated bullet point text",
                  },
                  section: {
                    type: "string",
                    description: "Which CV section this belongs in (Skills, Experience, Education, Summary, etc.)",
                  },
                  isRephrase: {
                    type: "boolean",
                    description: "True if this is a suggestion to rephrase an existing bullet rather than add a new one",
                  },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "How confident we are the user actually has this skill/experience based on CV analysis",
                  },
                },
                required: ["bullet", "section", "isRephrase", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_bullet" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
    console.error("generate-keyword-bullet error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
