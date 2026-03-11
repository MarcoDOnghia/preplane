import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_CV_TEXT = 50000;

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

    // Rate limit: 5/day
    const { data: allowed } = await supabase.rpc('check_and_increment_usage', {
      _user_id: userData.user.id,
      _feature: 'parse_cv',
      _max_count: 5,
    });
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Daily limit reached for CV parsing. Resets tomorrow." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { rawText: rawTextInput } = await req.json();
    if (!rawTextInput || typeof rawTextInput !== "string") {
      return new Response(JSON.stringify({ error: "rawText is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (rawTextInput.length > MAX_CV_TEXT) {
      return new Response(JSON.stringify({ error: "CV text exceeds maximum length" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Injection check
    if (containsInjection(rawTextInput)) {
      console.warn(`Prompt injection attempt detected from user ${userData.user.id}`);
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawText = sanitizeInput(rawTextInput);

    if (!rawText) {
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

ABSOLUTE RULE: Extract ONLY what is explicitly written in the CV text. 
- If a field is missing from the CV, use empty string or empty array.
- NEVER fabricate, invent, or infer ANY content — no fake experience, no assumed GPA, no invented skills.
- If there is no professional experience section, return an empty experience array.
- If there is no summary/profile section, return an empty string for summary.
- Copy facts exactly as stated. Do not embellish, quantify, or add context that isn't there.`,
          },
          {
            role: "user",
            content: `Parse this CV:\n\n<USER_CV>\n${rawText}\n</USER_CV>`,
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
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
