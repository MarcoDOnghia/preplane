import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Signal {
  type: string;
  text: string;
}

function parseSignals(text: string): Signal[] {
  const signals: Signal[] = [];
  const cleaned = text.replace(/END_OF_RESEARCH[\s\S]*$/, '').trim();
  const sections = [
    { key: "WHAT THEY DO", type: "company" },
    { key: "RECENT NEWS", type: "news" },
    { key: "OPEN ROLES", type: "hiring" },
    { key: "CUSTOMER SIGNALS", type: "customer" },
    { key: "FOUNDER ACTIVITY", type: "founder_linkedin" },
  ];
  for (const section of sections) {
    const upper = cleaned.toUpperCase();
    const idx = upper.indexOf(section.key);
    if (idx === -1) continue;
    const afterHeader = cleaned.slice(idx + section.key.length);
    const nextIdx = sections
      .map(s => upper.indexOf(s.key, idx + section.key.length))
      .filter(i => i > idx)
      .sort((a, b) => a - b)[0];
    const raw = nextIdx ? cleaned.slice(idx + section.key.length, nextIdx) : afterHeader;
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

/** Verifier: evaluates signal quality, not just count/length */
function evaluateConfidence(signals: Signal[]): number {
  let score = 0;
  const expectedTypes = ["company", "news", "hiring", "customer", "founder_linkedin"];

  for (const expected of expectedTypes) {
    const signal = signals.find(s => s.type === expected);
    if (!signal) continue;
    const text = signal.text.trim();
    // Quality check: must be substantial AND not garbage
    const isSubstantial = text.length > 50;
    const isNotGarbage = !text.toLowerCase().includes("not found") &&
      !text.toLowerCase().startsWith("let me") &&
      !text.toLowerCase().includes("based on my research");
    if (isSubstantial && isNotGarbage) {
      score += 0.2; // Each quality signal = 0.2, max 1.0
    }
  }

  // Bonus for high-value signals
  if (signals.some(s => s.type === "founder_linkedin" && s.text.length > 80)) score += 0.1;
  if (signals.some(s => s.type === "customer" && s.text.length > 80)) score += 0.1;

  return Math.min(score, 1);
}

const MAX_RETRIES = 2;
const CONFIDENCE_THRESHOLD = 0.6;

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

    // Orchestrator → Agent → Verifier loop
    let signals: Signal[] = [];
    let content = "";
    let confidence = 0;
    let low_confidence = false;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      attempt++;
      console.log(`[Orchestrator] Claude research attempt ${attempt}/${MAX_RETRIES}`);

      // Orchestrator selects: research agent
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

Return in this EXACT format with these EXACT headers. End your response with the line END_OF_RESEARCH.

WHAT THEY DO

[2-3 sentences on what they do and who their customers are]

RECENT NEWS

[Most recent funding round or company news with date. Last 90 days only. If none: Not found.]

OPEN ROLES

[List open roles related to ${roleLabel}. Include exact job title and one key requirement. If none: Not found.]

CUSTOMER SIGNALS

[Specific complaints or praise from G2, Trustpilot, or app reviews. Quote directly if possible. If none: Not found.]

FOUNDER ACTIVITY

[What the founder has posted about on LinkedIn in the last 30 days. What problems are they publicly wrestling with? If none: Not found.]

END_OF_RESEARCH`,
          messages: [{
            role: "user",
            content: `Research "${company.trim()}" for a student applying for a ${roleLabel} internship.${attempt > 1 ? " Dig deeper — previous attempt found insufficient data. Try alternative search queries and company name variations." : ""}`,
          }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Anthropic API error:", response.status, errText);
        throw new Error("Research failed");
      }

      const data = await response.json();

      content = data.content
        ?.filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n") || "";
      if (!content) throw new Error("No content returned");

      // Parse signals
      signals = parseSignals(content);

      // Verifier: evaluate signal quality
      confidence = evaluateConfidence(signals);
      console.log(`[Verifier] Claude confidence: ${confidence.toFixed(2)} (threshold: ${CONFIDENCE_THRESHOLD})`);

      if (confidence >= CONFIDENCE_THRESHOLD) {
        console.log(`[Verifier] PASS — proceeding to synthesis`);
        break;
      }

      if (attempt >= MAX_RETRIES) {
        console.log(`[Verifier] FAIL — max retries reached, emitting low_confidence`);
        low_confidence = true;
        break;
      }

      console.log(`[Verifier] FAIL — sending back to Orchestrator for retry`);
    }

    // Extract source URLs
    // (from last attempt's raw data — we don't store intermediate attempts)
    const urls: string[] = [];

    // Synthesis call (only if confidence passes)
    let pow_angle: string | null = null;
    if (confidence >= CONFIDENCE_THRESHOLD) {
      const truncatedSignals = signals.map(s => ({ ...s, text: s.text.slice(0, 300) }));
      const synthPayload = {
        model: "claude-haiku-3-5-20241022",
        max_tokens: 500,
        system: `You are given research signals about a company. Find the tension: the gap between what the company claims and what customers or the founder's own words reveal. Then produce ONE specific proof of work a student can build in 48 hours for a ${roleLabel} internship that addresses that tension directly. Be ruthlessly specific: name exactly what to build, what free tool to use, and why it matters to this company right now. If signals are too thin, return exactly: LOW_SIGNAL`,
        messages: [{
          role: "user",
          content: JSON.stringify(truncatedSignals),
        }],
      };

      const SYNTH_MAX_RETRIES = 3;
      for (let i = 0; i < SYNTH_MAX_RETRIES; i++) {
        try {
          const synthResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(synthPayload),
          });

          if (synthResponse.status === 429 && i < SYNTH_MAX_RETRIES - 1) {
            const wait = 3000 * (i + 1);
            console.log(`[Synthesis] 429 rate-limited, retrying in ${wait}ms (attempt ${i + 1}/${SYNTH_MAX_RETRIES})`);
            await new Promise(r => setTimeout(r, wait));
            continue;
          }

          if (synthResponse.ok) {
            const synthData = await synthResponse.json();
            const synthText = synthData.content
              ?.filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join("\n")
              .trim() || "";
            pow_angle = synthText === "LOW_SIGNAL" ? null : synthText || null;
          } else {
            const errBody = await synthResponse.text();
            console.error("Synthesis call failed:", synthResponse.status, errBody);
          }
          break;
        } catch (synthErr) {
          if (i < SYNTH_MAX_RETRIES - 1) {
            console.log(`[Synthesis] Error, retrying (attempt ${i + 1}/${SYNTH_MAX_RETRIES}):`, synthErr);
            await new Promise(r => setTimeout(r, 3000 * (i + 1)));
          } else {
            console.error("Synthesis call error after retries:", synthErr);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        research: content,
        signals: [
          ...signals,
          ...(pow_angle ? [{ type: "pow_angle", text: pow_angle }] : []),
        ],
        sources: urls,
        confidence: parseFloat(confidence.toFixed(2)),
        low_confidence,
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
