import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_TYPES = [
  "hiring_manager",
  "follow_up",
  "thank_you",
  "referral_request",
  "offer_negotiation",
];

const TYPE_PROMPTS: Record<string, string> = {
  hiring_manager: `Generate a concise hiring manager outreach message (3-4 sentences). Show genuine interest in the role, highlight 1-2 most relevant experiences from the CV, and end with a clear call to action (request for a brief chat). Also suggest a subject line.`,
  follow_up: `Generate a professional follow-up email for an application with no response. Reference the application date, reaffirm interest, ask about the timeline, and offer to provide additional information. Keep it brief and respectful. Also suggest a subject line.`,
  thank_you: `Generate a personalized thank-you email after an interview. Thank the interviewer by name if provided, reference specific discussion topics if given, reaffirm fit and interest, and mention next steps. Keep it warm and professional. Also suggest a subject line.`,
  referral_request: `Generate a referral request message. Make it easy for the contact to say yes by being specific about the role, providing context about your fit, and offering to send your resume. Keep it personal and appreciative. Also suggest a subject line.`,
  offer_negotiation: `Generate a professional offer negotiation email. Express gratitude for the offer, clearly state the counter-request with reasoning, reference market data or competing offers if context is provided, and maintain enthusiasm for the role. Also suggest a subject line.`,
};

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

    const { messageType, jobTitle, company, cvSummary, recipientName, additionalContext } = await req.json();

    if (!messageType || !VALID_TYPES.includes(messageType)) {
      return new Response(
        JSON.stringify({ error: `Invalid message type. Must be one of: ${VALID_TYPES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!jobTitle || !company) {
      return new Response(
        JSON.stringify({ error: "Job title and company are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert career coach specializing in professional communication. ${TYPE_PROMPTS[messageType]}

You MUST call the generate_message function with your output.`;

    const userPrompt = `Job: ${jobTitle} at ${company}
${cvSummary ? `\nUser's background summary:\n${cvSummary}` : ""}
${recipientName ? `\nRecipient: ${recipientName}` : ""}
${additionalContext ? `\nAdditional context: ${additionalContext}` : ""}`;

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
              name: "generate_message",
              description: "Return the generated outreach message",
              parameters: {
                type: "object",
                properties: {
                  subject: { type: "string", description: "Suggested email subject line" },
                  content: { type: "string", description: "The full message body" },
                },
                required: ["subject", "content"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_message" } },
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
    console.error("generate-outreach error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
