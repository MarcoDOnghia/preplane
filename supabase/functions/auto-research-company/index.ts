// v4
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseSignals(text: string): { type: string; text: string }[] {
  const signals: { type: string; text: string }[] = [];
  const sections = [
    { key: "WHAT THEY DO", type: "company" },
    { key: "RECENT NEWS", type: "funding" },
    { key: "OPEN ROLES", type: "hiring" },
    { key: "CUSTOMER SIGNALS", type: "customer" },
    { key: "BEST POW ANGLE", type: "pow_angle" },
  ];
  for (const section of sections) {
    const idx = text.toUpperCase().indexOf(section.key);
    if (idx === -1) continue;
    const afterHeader = text.slice(idx + section.key.length);
    const nextHeader = sections
      .map((s) => afterHeader.toUpperCase().indexOf(s.key))
      .filter((i) => i > 0)
      .sort((a, b) => a - b)[0];
    const content = (nextHeader ? afterHeader.slice(0, nextHeader) : afterHeader).trim();
    if (content && content.toLowerCase() !== "not found") {
      signals.push({ type: section.type, text: content });
    }
  }
  return signals;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

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
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
        system: `You are a research assistant for Preplane. Research the company and return ONLY verified facts found via web search. Never invent. If not found, write "Not found".

Return in this EXACT format using these EXACT headers in ALL CAPS:

WHAT THEY DO
2-3 sentences on what the product is, who it serves, what problem it solves.

RECENT NEWS
Most recent funding or news with date. If none: Not found.

OPEN ROLES
Open roles related to ${role || "general"}. If none: Not found.

CUSTOMER SIGNALS
Complaints or praise from G2, Trustpilot, or app reviews. If none: Not found.

BEST POW ANGLE
One specific proof of work idea for a ${role || "general"} role based on the above.`,
        messages: [
          {
            role: "user",
            content: `Research "${company.trim()}" for a student applying for a ${role || "general"} internship.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      throw new Error("Research failed");
    }

    const data = await response.json();
    const content =
      data.content
        ?.filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n") || "";

    if (!content) throw new Error("No content returned");

    const signals = parseSignals(content);

    return new Response(JSON.stringify({ research: content, signals }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("auto-research-company error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
