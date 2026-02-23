import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { rawText } = await req.json();
    if (!rawText || typeof rawText !== "string") {
      return new Response(JSON.stringify({ error: "rawText is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a CV parser. Extract structured data from raw CV text. Return ONLY a valid JSON object with this exact schema:
{
  "name": "Full Name",
  "contact": { "phone": "", "email": "", "location": "", "linkedin": "" },
  "summary": "Professional summary paragraph",
  "experience": [
    { "title": "Job Title", "company": "Company", "location": "City", "dates": "Start - End", "bullets": ["Achievement 1", "Achievement 2"] }
  ],
  "education": [
    { "degree": "Degree Name", "school": "School Name", "dates": "Year - Year", "gpa": "", "coursework": "" }
  ],
  "skills": "Comma-separated skills",
  "certifications": ["Cert 1"],
  "extras": []
}
If a field is missing from the CV, use empty string or empty array. Do NOT fabricate content.`,
          },
          {
            role: "user",
            content: `Parse this CV:\n\n${rawText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_cv_data",
              description: "Return the structured CV data",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  contact: {
                    type: "object",
                    properties: {
                      phone: { type: "string" },
                      email: { type: "string" },
                      location: { type: "string" },
                      linkedin: { type: "string" },
                    },
                    required: ["phone", "email", "location", "linkedin"],
                  },
                  summary: { type: "string" },
                  experience: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        company: { type: "string" },
                        location: { type: "string" },
                        dates: { type: "string" },
                        bullets: { type: "array", items: { type: "string" } },
                      },
                      required: ["title", "company", "location", "dates", "bullets"],
                    },
                  },
                  education: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        degree: { type: "string" },
                        school: { type: "string" },
                        dates: { type: "string" },
                        gpa: { type: "string" },
                        coursework: { type: "string" },
                      },
                      required: ["degree", "school", "dates", "gpa", "coursework"],
                    },
                  },
                  skills: { type: "string" },
                  certifications: { type: "array", items: { type: "string" } },
                  extras: { type: "array", items: { type: "string" } },
                },
                required: ["name", "contact", "summary", "experience", "education", "skills", "certifications", "extras"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_cv_data" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI parsing failed");
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    let cvData;
    if (toolCall?.function?.arguments) {
      cvData = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } else {
      // Fallback: try to parse from message content
      const content = aiResult.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cvData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not extract structured CV data from AI response");
      }
    }

    return new Response(JSON.stringify({ cvData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-cv error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
