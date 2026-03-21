import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseSignals(text: string): { type: string; text: string }[] {
  const signals: { type: string; text: string }[] = [];
  const sections = [
    { key: "WHAT THEY DO", type: "company" },
    { key: "RECENT NEWS", type: "news" },
    { key: "OPEN ROLES", type: "hiring" },
    { key: "CUSTOMER SIGNALS", type: "customer" },
    { key: "FOUNDER ACTIVITY", type: "founder_linkedin" },
  ];
  for (const section of sections) {
    const upper = text.toUpperCase();
    const idx = upper.indexOf(section.key);
    if (idx === -1) continue;
    const afterHeader = text.slice(idx + section.key.length);
    const nextIdx = sections
      .map(s => upper.indexOf(s.key, idx + section.key.length))
      .filter(i => i > idx)
      .sort((a, b) => a - b)[0];
    const raw = nextIdx ? text.slice(idx + section.key.length, nextIdx) : afterHeader;
    const content = raw
      .replace(/\*\*/g, '')
      .replace(/^[\s:–\-\n]+/, '')
      .trim();
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
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roleLabel = role || "general";

    // Step 1 — Research call
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
        system: `You are a research assistant for Preplane. Research the company using web search. Only include information from the last 90 days where relevant. Never invent facts. If not found write "Not found".

Return in this EXACT format with these EXACT headers:

WHAT THEY DO
[2-3 sentences on what they do and who their customers are]

RECENT NEWS
[Most recent funding round or company news with date. Last 90 days only. If none: Not found.]

OPEN ROLES
[List open roles related to ${roleLabel}. Include exact job title and one key requirement. If none: Not found.]

CUSTOMER SIGNALS
[Specific complaints or praise from G2, Trustpilot, or app reviews. Quote directly if possible. If none: Not found.]

FOUNDER ACTIVITY
[What the founder has posted about on LinkedIn in the last 30 days. What problems are they publicly wrestling with? If none: Not found.]`,
        messages: [{
          role: "user",
          content: `Research "${company.trim()}" for a student applying for a ${roleLabel} internship.`,
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      throw new Error("Research failed");
    }

    const data = await response.json();

    // Step 2 — Extract text content
    const content = data.content
      ?.filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n") || "";
    if (!content) throw new Error("No content returned");

    // Step 3 — Parse signals
    const signals = parseSignals(content);

    // Step 4 — Extract source URLs
    const urls: string[] = data.content
      ?.filter((b: any) => b.type === "tool_result")
      .flatMap((b: any) =>
        Array.isArray(b.content)
          ? b.content.map((c: any) => c.url).filter(Boolean)
          : []
      ) || [];

    // Step 5 — Confidence score
    const confidence = Math.min(
      (signals.length / 5) * 0.5 +
      (signals.some(s => s.type === "founder_linkedin") ? 0.3 : 0) +
      (signals.some(s => s.type === "customer") ? 0.2 : 0),
      1
    );

    // Step 6 — Tension synthesis (only if enough signal)
    let pow_angle: string | null = null;
    if (confidence >= 0.4) {
      const synthResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 500,
          system: `You are given research signals about a company. Find the tension: the gap between what the company claims and what customers or the founder's own words reveal. Then produce ONE specific proof of work a student can build in 48 hours for a ${roleLabel} internship that addresses that tension directly. Be ruthlessly specific: name exactly what to build, what free tool to use, and why it matters to this company right now. If signals are too thin, return exactly: LOW_SIGNAL`,
          messages: [{
            role: "user",
            content: JSON.stringify(signals),
          }],
        }),
      });

      if (synthResponse.ok) {
        const synthData = await synthResponse.json();
        const synthText = synthData.content
          ?.filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("\n")
          .trim() || "";
        pow_angle = synthText === "LOW_SIGNAL" ? null : synthText || null;
      }
    }

    // Step 7 — Return
    return new Response(
      JSON.stringify({
        research: content,
        signals: [
          ...signals,
          ...(pow_angle ? [{ type: "pow_angle", text: pow_angle }] : []),
        ],
        sources: urls,
        confidence: parseFloat(confidence.toFixed(2)),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: unknown) {
    console.error("auto-research-company error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
