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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const { company, role } = await req.json();

    if (!company || !company.trim()) {
      return new Response(JSON.stringify({ error: "Company name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        tools: [
          {
            type: "web_search_20260209",
            name: "web_search",
            max_uses: 5,
          },
        ],
        system: `You are a research assistant for Preplane, a tool that helps students land internships through proof of work.

Your job: research a real company using web search and return ONLY verified, specific information.

Rules:
- Only state facts you found via web search. Never invent or guess.
- If you cannot find something, write "Not found" for that field.
- Be specific. Dates, numbers, names matter.
- No generic fluff. Every sentence must be something the student could not have written themselves.

Return your response in this exact format:

WHAT THEY DO
[2-3 sentences. What product, who it's for, what problem it solves.]

RECENT NEWS
[Most recent funding round or company news with date. If none found: Not found.]

OPEN ROLES
[Any open roles related to ${role || "general"}. If none found: Not found.]

CUSTOMER SIGNALS
[Any complaints or praise from G2, Trustpilot, or app reviews. If none found: Not found.]

BEST POW ANGLE
[Based on the above, one specific proof of work idea for a ${role || "general"} role.]`,
        messages: [
          {
            role: "user",
            content: `Research the company "${company.trim()}" for a student applying for a ${role || "general"} internship. Use web search to find real, current information.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      throw new Error("Research failed");
    }

    const data = await response.json();

    const content =
      data.content
        ?.filter((block: { type: string }) => block.type === "text")
        .map((block: { text: string }) => block.text)
        .join("\n") || "";

    if (!content) {
      throw new Error("No research content returned");
    }

    return new Response(JSON.stringify({ research: content }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("auto-research-company error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
