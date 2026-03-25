import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Signal {
  text: string;
  source_url: string | null;
  date: string | null;
  signal_type: string;
}

async function queryPerplexity(
  apiKey: string,
  query: string,
  signalType: string
): Promise<Signal> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: `You are a company research assistant. Return a concise factual summary (2-4 sentences max). Include the most relevant date if available. If you cannot find specific information, respond with exactly the word NOT_FOUND and nothing else. Never explain your search process or say what you would search for next.`,
        },
        { role: "user", content: query },
      ],
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Perplexity error for ${signalType}:`, res.status, errText);
    return { text: "", source_url: null, date: null, signal_type: signalType };
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() || "";
  const sourceUrl = data.citations?.[0] || null;

  const lowerText = text.toLowerCase();
  const garbagePhrases = [
    "let me search",
    "based on my research",
    "i would search",
    "i cannot find",
    "as an ai"
  ];
  const isGarbage =
    text.length < 50 ||
    garbagePhrases.some((phrase) => lowerText.includes(phrase));

  if (text === "NOT_FOUND" || !text || isGarbage) {
    return { text: "", source_url: null, date: null, signal_type: signalType };
  }

  let date: string | null = null;
  const datePatterns = [
    /\b(\d{4}-\d{2}-\d{2})\b/,
    /\b(\d{4}\/\d{2}\/\d{2})\b/,
    /\b([A-Z][a-z]+ \d{4})\b/,
    /\b(\d{1,2} [A-Z][a-z]+ \d{4})\b/,
    /\b([A-Z][a-z]+ \d{1,2}, \d{4})\b/,
    /\b(\d{4})\b/
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      date = match[1];
      break;
    }
  }

  return { text, source_url: sourceUrl, date, signal_type: signalType };
}

/** Verifier: evaluates signal quality (typed completeness, not raw length) */
function evaluateSignalQuality(signals: Signal[]): number {
  const expectedTypes = ["news", "hiring", "customer", "founder_press", "social_updates"];
  let score = 0;

  for (const expected of expectedTypes) {
    const signal = signals.find(s => s.signal_type === expected);
    if (!signal || !signal.text) continue;
    const text = signal.text.trim();
    // Quality: substantial text, not garbage, has real content
    const isSubstantial = text.length > 60;
    const hasSource = !!signal.source_url;
    const isNotGarbage = !text.toLowerCase().includes("not found") &&
      !text.toLowerCase().startsWith("let me");
    if (isSubstantial && isNotGarbage) {
      score += hasSource ? 0.22 : 0.18; // Sourced signals worth slightly more
    }
  }

  return Math.min(score, 1);
}

const MAX_RETRIES = 2;
const CONFIDENCE_THRESHOLD = 0.5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 5 research calls per day
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().split("T")[0];
    const { data: usageRow } = await adminClient
      .from("research_usage")
      .select("call_count")
      .eq("user_id", user.id)
      .eq("usage_date", today)
      .maybeSingle();

    if (usageRow && usageRow.call_count >= 5) {
      return new Response(
        JSON.stringify({ error: "You've used all your research credits for today. Credits reset at midnight — come back tomorrow to keep building." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (usageRow) {
      await adminClient
        .from("research_usage")
        .update({ call_count: usageRow.call_count + 1 })
        .eq("user_id", user.id)
        .eq("usage_date", today);
    } else {
      await adminClient
        .from("research_usage")
        .insert({ user_id: user.id, usage_date: today, call_count: 1 });
    }

    const { company, role, campaign_id } = await req.json();
    if (!company?.trim()) {
      return new Response(JSON.stringify({ error: "Company name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyName = company.trim();
    const roleLabel = role?.trim() || "general";

    // Orchestrator → Agent → Verifier loop
    let signals: Signal[] = [];
    let confidence = 0;
    let low_confidence = false;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      attempt++;
      console.log(`[Orchestrator] Perplexity research attempt ${attempt}/${MAX_RETRIES}`);

      // Core queries (always run)
      const coreQueries: { query: string; signalType: string }[] = [
        {
          query: `Search startupitalia.eu, ilsole24ore.com, eu-startups.com, sifted.eu, tech.eu for news or funding about "${companyName}" in last 180 days. Return factual summary with date.`,
          signalType: "news",
        },
        {
          query: `Find open ${roleLabel} positions at "${companyName}" Italy on LinkedIn Jobs and Wellfound. Return role titles and key requirements.`,
          signalType: "hiring",
        },
        {
          query: `Find reviews about "${companyName}" on G2, Capterra, Trustpilot, Apple App Store, Google Play. Return specific complaints and praise with dates.`,
          signalType: "customer",
        },
      ];

      signals = [];
      const coreResults: Record<string, Signal> = {};

      // Run core queries
      for (const q of coreQueries) {
        const signal = await queryPerplexity(PERPLEXITY_API_KEY, q.query, q.signalType);
        if (signal.text) {
          signals.push(signal);
          coreResults[q.signalType] = signal;
        }
      }

      // Adaptive skipping: only run conditional queries if prerequisites pass
      // Founder Press: only if hiring signal found (company is active)
      if (coreResults["hiring"]?.text) {
        console.log(`[Orchestrator] hiring signal OK → routing to founder_press`);
        const founderSignal = await queryPerplexity(
          PERPLEXITY_API_KEY,
          `Find interviews, podcast appearances, LinkedIn posts or press quotes from founder or CEO of "${companyName}" Italy in last 90 days. Return direct quotes if available.`,
          "founder_press"
        );
        if (founderSignal.text) signals.push(founderSignal);
      } else {
        console.log(`[Orchestrator] hiring signal empty → skipping founder_press`);
      }

      // Social Updates: only if news signal found (company has public presence)
      if (coreResults["news"]?.text) {
        console.log(`[Orchestrator] news signal OK → routing to social_updates`);
        const socialSignal = await queryPerplexity(
          PERPLEXITY_API_KEY,
          `Find recent product updates, feature launches or announcements from "${companyName}" Italy on LinkedIn, their blog or tech press in last 60 days.`,
          "social_updates"
        );
        if (socialSignal.text) signals.push(socialSignal);
      } else {
        console.log(`[Orchestrator] news signal empty → skipping social_updates`);
      }

      // Verifier: evaluate signal quality
      confidence = evaluateSignalQuality(signals);
      console.log(`[Verifier] Perplexity confidence: ${confidence.toFixed(2)} (threshold: ${CONFIDENCE_THRESHOLD})`);

      if (confidence >= CONFIDENCE_THRESHOLD) {
        console.log(`[Verifier] PASS — aggregating signals`);
        break;
      }

      if (attempt >= MAX_RETRIES) {
        console.log(`[Verifier] FAIL — max retries reached, emitting low_confidence`);
        low_confidence = true;
        break;
      }

      console.log(`[Verifier] FAIL — sending back to Orchestrator for retry`);
    }

    // Save to campaign_signals if campaign_id provided
    if (campaign_id) {
      await adminClient
        .from("campaign_signals")
        .delete()
        .eq("campaign_id", campaign_id);

      if (signals.length > 0) {
        const rows = signals.map((s) => ({
          campaign_id,
          user_id: user.id,
          signal_type: s.signal_type,
          text: s.text,
          source_url: s.source_url,
          date: s.date,
        }));
        const { error: insertError } = await adminClient
          .from("campaign_signals")
          .insert(rows);
        if (insertError) {
          console.error("Failed to save signals:", insertError);
        }
      }
    }

    return new Response(JSON.stringify({ signals, confidence: parseFloat(confidence.toFixed(2)), low_confidence }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("research-company error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
