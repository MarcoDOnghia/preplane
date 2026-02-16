import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { cvContent, jobDescription, tone } = await req.json();

    if (!cvContent || !jobDescription) {
      return new Response(
        JSON.stringify({ error: "CV content and job description are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert career coach and CV tailoring specialist. Analyze the CV and job description provided, then return structured suggestions.

Tone for cover letter: ${tone || "professional"}

Instructions:
1. Identify 5-7 key requirements from the job description
2. Suggest specific CV modifications with original text, suggested replacement, and reasoning
3. Generate a compelling cover letter matching the requested tone

You MUST call the tailor_application function with your analysis.`;

    const userPrompt = `CV Content:\n${cvContent}\n\nJob Description:\n${jobDescription}`;

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
              name: "tailor_application",
              description: "Return the tailored CV analysis results",
              parameters: {
                type: "object",
                properties: {
                  keyRequirements: {
                    type: "array",
                    items: { type: "string" },
                    description: "5-7 key requirements extracted from the job description",
                  },
                  cvSuggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        section: { type: "string", description: "CV section name" },
                        original: { type: "string", description: "Original text from the CV" },
                        suggested: { type: "string", description: "Suggested improved text" },
                        reason: { type: "string", description: "Why this change helps" },
                      },
                      required: ["section", "original", "suggested", "reason"],
                      additionalProperties: false,
                    },
                  },
                  coverLetter: {
                    type: "string",
                    description: "Full personalized cover letter",
                  },
                },
                required: ["keyRequirements", "cvSuggestions", "coverLetter"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "tailor_application" } },
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
    console.error("tailor-cv error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
