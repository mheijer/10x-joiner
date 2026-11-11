// POST /api/evaluate  { name, website, hq_location? }
// Evaluates a user-added company. The company is private to the signed-in (or anonymous) user.
// Auth: send the user's Supabase access token as "Authorization: Bearer <token>".
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { evaluateCompany } from "@/lib/evaluate";
import { normalizeUsLocation, geocodeUs } from "@/lib/geocode";

export const maxDuration = 300; // evaluations with web search can take 1-2 minutes

export async function POST(req: Request) {
  const db = supabaseAdmin();
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const { data: auth } = await db.auth.getUser(token ?? "");
  if (!auth?.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const website = String(body.website ?? "").trim() || null;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const domain = website?.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? null;

  // Already on the seed list? Return that instead of re-evaluating.
  if (domain) {
    const { data: seeded } = await db.from("companies").select("id").eq("is_seed", true).eq("domain", domain).maybeSingle();
    if (seeded) return NextResponse.json({ company_id: seeded.id, existing: true });
  }

  const hq = normalizeUsLocation(body.hq_location);
  const geo = hq ? await geocodeUs(hq).catch(() => null) : null;
  const { data: company, error } = await db
    .from("companies")
    .insert({ name, domain, hq_city: hq, lat: geo?.lat, lng: geo?.lng, is_seed: false, created_by: auth.user.id })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const { result, composite, model } = await evaluateCompany({ name, website, hq_location: hq });
    await db.from("evaluations").insert({
      company_id: company.id, scores: result.scores, composite, summary: result.summary, model, status: "done",
    });
    const f = result.facts ?? {};
    await db.from("companies").update({
      stage: f.stage ?? null,
      headcount: f.headcount_estimate ?? null,
      latest_post_money_usd: f.latest_post_money_usd ?? null,
      careers_url: f.careers_url ?? null,
      ats_provider: f.ats?.provider ?? null,
      ats_slug: f.ats?.slug ?? null,
      hq_city: hq ?? f.hq_city ?? null,
    }).eq("id", company.id);
    return NextResponse.json({ company_id: company.id, composite });
  } catch (e: any) {
    await db.from("evaluations").insert({ company_id: company.id, scores: {}, status: "error", summary: e.message });
    return NextResponse.json({ company_id: company.id, error: "Evaluation failed; partial data saved" }, { status: 502 });
  }
}
