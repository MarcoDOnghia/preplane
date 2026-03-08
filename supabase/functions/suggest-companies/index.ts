import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Infer categories from a target_role string using keyword matching. */
function inferCategories(targetRole: string, extraCategories?: string[]): string[] {
  const role = targetRole.toLowerCase();
  const cats = new Set<string>(extraCategories ?? []);

  const rules: [RegExp, string[]][] = [
    [/\b(vc|venture|invest)/i, ["VC", "Finance"]],
    [/\b(startup|operations|ops)\b/i, ["Operations", "Startup"]],
    [/\b(sales|sdr|gtm|business development)\b/i, ["Sales"]],
    [/\b(marketing|content|growth)\b/i, ["Marketing"]],
    [/\b(finance|banking|analyst)\b/i, ["Finance"]],
    [/\b(tech|software|engineer)\b/i, ["Tech"]],
  ];

  for (const [pattern, matched] of rules) {
    if (pattern.test(role)) {
      matched.forEach((c) => cats.add(c));
    }
  }

  // Fallback: if nothing matched, return all categories so we still get results
  if (cats.size === 0) {
    return ["VC", "Finance", "Operations", "Sales", "Marketing", "Tech"];
  }

  return Array.from(cats);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_role: rawRole, target_location: rawLocation, experience_level, categories } = await req.json();

    // Strip HTML and validate
    const target_role = rawRole ? String(rawRole).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) : "";
    const target_location = rawLocation ? String(rawLocation).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) : "";

    if (!target_role) {
      return new Response(JSON.stringify({ error: "target_role is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inferredCategories = inferCategories(target_role, categories);

    // Use the authenticated client (with user's auth header + ANON_KEY) instead of SERVICE_ROLE_KEY
    // The companies table has a SELECT policy for authenticated users
    let query = supabaseClient
      .from("companies")
      .select("*")
      .eq("hiring_juniors", true)
      .overlaps("categories", inferredCategories)
      .order("prestige_level", { ascending: true })
      .limit(8);

    // Location matching: try country first, then city
    if (target_location) {
      const loc = target_location.trim();
      const { data: byCountry, error: err1 } = await query.ilike("country", `%${loc}%`);

      if (!err1 && byCountry && byCountry.length > 0) {
        return new Response(JSON.stringify({ companies: byCountry, inferred_categories: inferredCategories }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try city match
      const { data: byCity, error: err2 } = await supabaseClient
        .from("companies")
        .select("*")
        .eq("hiring_juniors", true)
        .overlaps("categories", inferredCategories)
        .ilike("city", `%${loc}%`)
        .order("prestige_level", { ascending: true })
        .limit(8);

      if (!err2 && byCity && byCity.length > 0) {
        return new Response(JSON.stringify({ companies: byCity, inferred_categories: inferredCategories }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fallback: return without location filter
      const { data: fallback, error: err3 } = await supabaseClient
        .from("companies")
        .select("*")
        .eq("hiring_juniors", true)
        .overlaps("categories", inferredCategories)
        .order("prestige_level", { ascending: true })
        .limit(8);

      return new Response(
        JSON.stringify({ companies: fallback ?? [], inferred_categories: inferredCategories, location_matched: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No location provided
    const { data, error } = await query;

    if (error) throw error;

    return new Response(JSON.stringify({ companies: data ?? [], inferred_categories: inferredCategories }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("suggest-companies error:", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch companies. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
