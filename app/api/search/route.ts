// POST /api/search  { q }
// AI search over the company list: one Haiku call per question (~$0.003). Light per-visitor rate limit to protect
// the monthly API budget. The company catalog is read from Supabase and cached for 10 minutes.
import { NextResponse } from "next/server";
import { supabasePublic } from "@/lib/supabase-public";
import { aiSearch } from "@/lib/search";
import type { CatalogRow } from "@/lib/search";

export const maxDuration = 60;

let cache: { at: number; rows: CatalogRow[] } | null = null;
const hits = new Map<string, number[]>(); // ip → timestamps (per server instance)
const LIMIT_PER_HOUR = 30;

async function catalog(): Promise<CatalogRow[]> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.rows;
  const { data, error } = await supabasePublic()
    .from("company_latest")
    .select("id,name,sector,stage,hq_city,headcount,description,composite")
    .limit(2000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((c: any) => ({ ...c, evaluated: c.composite != null })) as CatalogRow[];
  cache = { at: Date.now(), rows };
  return rows;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const q = String(body.q ?? "").trim().slice(0, 300);
  if (q.length < 3) return NextResponse.json({ error: "Ask a longer question" }, { status: 400 });

  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= LIMIT_PER_HOUR) return NextResponse.json({ error: "Too many AI searches this hour. Try the regular filters." }, { status: 429 });
  hits.set(ip, [...recent, now]);

  try {
    const result = await aiSearch(q, await catalog());
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: `AI search failed: ${e.message}` }, { status: 502 });
  }
}
