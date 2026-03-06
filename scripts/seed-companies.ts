/**
 * Seed script for the companies table.
 *
 * Usage:
 *   npx tsx scripts/seed-companies.ts
 *
 * Requires environment variables:
 *   SUPABASE_URL — your project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (NOT the anon key)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const filePath = path.join(__dirname, "companies-seed.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const companies = JSON.parse(raw);

  console.log(`Seeding ${companies.length} companies...`);

  const { data, error } = await supabase
    .from("companies")
    .upsert(
      companies.map((c: any) => ({
        ...c,
        added_by: c.added_by ?? "manual",
      })),
      { onConflict: "name" }
    );

  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }

  console.log("✓ Seed complete.", data?.length ?? companies.length, "rows inserted.");
}

main();
