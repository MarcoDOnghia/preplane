import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        system: `You are a research assistant for Preplane. Research the company using web search. Never invent facts. If not found write "Not found".

Return in this EXACT format:

WHAT THEY DO
[2-3 sentences on what they do]

RECENT NEWS
[Most recent funding or news with date. If none: Not found.]

OPEN ROLES
[Open roles related to ${role || "general"}. If none: Not found.]

CUSTOMER SIGNALS
[Complaints or praise from G2, Trustpilot, app reviews. If none: Not found.]

BEST POW ANGLE
[One specific proof of work idea for a ${role || "general"} role.]`,
        messages: [{
          role: "user",
          content: `Research "${company.trim()}" for a student applying for a ${role || "general"} internship.`,
        }],
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      throw new Error("Research failed");
    }
    const data = await response.json();
    const content = data.content
      ?.filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n") || "";
    if (!content) throw new Error("No content returned");
    return new Response(JSON.stringify({ research: content }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("auto-research-company error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
