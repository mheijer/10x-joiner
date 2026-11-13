// POST /api/evaluate  { name, website, hq_location? }
// Adds and evaluates a company a user suggests. Added companies are SHARED: every user sees them (tagged
// "Added by a user"), so each one is paid for once. Budget guardrails (team decision):
//   - site-wide cap of DAILY_SITE_CAP new companies per rolling 24 hours (each costs ~$0.75 on Opus)
//   - 3 per account (also enforced by a database trigger)
//   - duplicates (same domain or name, on the list or already added) return the existing company for free
// Auth: the user's Supabase access token as "Authorization: Bearer <token>" (anonymous accounts are fine).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { evaluateCompany } from "@/lib/evaluate";
import { normalizeUsLocation, geocodeUs } from "@/lib/geocode";
import { factsToCompanyUpdate } from "@/lib/facts";
import { joinerUpside } from "@/lib/scoring";
import { discoverJobs, countByFunction, boardUrl, classifyRole } from "@/lib/jobs";
import { hiringProfile } from "@/lib/hiring";
import { collectSignals } from "@/lib/signals";

export const maxDuration = 300; // evaluations with web search can take 1-2 minutes
const MAX_COMPANIES_PER_USER = 3;
const DAILY_SITE_CAP = Number(process.env.DAILY_ADD_CAP ?? 10); // new companies per rolling 24h, across all users

export async function POST(req: Request) {
  const db = supabaseAdmin();
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const { data: auth } = await db.auth.getUser(token ?? "");
  if (!auth?.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const website = String(body.website ?? "").trim() || null;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const domain = website?.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null;

  // Already on the list, or already added by someone? Return it instead of paying to evaluate it again.
  const { data: byName } = await db.from("companies").select("id").ilike("name", name.replace(/[%_]/g, "")).limit(1);
  const { data: byDomain } = domain ? await db.from("companies").select("id").eq("domain", domain).limit(1) : { data: [] as any[] };
  const existing = byDomain?.[0] ?? byName?.[0];
  if (existing) return NextResponse.json({ company_id: existing.id, existing: true });

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count: today } = await db.from("companies").select("id", { count: "exact", head: true }).eq("is_seed", false).gte("created_at", since);
  if ((today ?? 0) >= DAILY_SITE_CAP)
    return NextResponse.json(
      { error: `The site has reached today's limit of ${DAILY_SITE_CAP} new companies (each one costs real research money). Try again tomorrow.` },
      { status: 429 },
    );

  const { count } = await db.from("companies").select("id", { count: "exact", head: true }).eq("created_by", auth.user.id);
  if ((count ?? 0) >= MAX_COMPANIES_PER_USER)
    return NextResponse.json({ error: `You've already added ${MAX_COMPANIES_PER_USER} companies.` }, { status: 429 });

  const hq = normalizeUsLocation(body.hq_location);
  const geo = hq ? await geocodeUs(hq).catch(() => null) : null;
  const { data: company, error } = await db
    .from("companies")
    .insert({ name, domain, hq_city: hq, lat: geo?.lat, lng: geo?.lng, is_seed: false, created_by: auth.user.id })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const hit = await discoverJobs(name, domain).catch(() => null);
    const signals = await collectSignals({
      name,
      domain,
      jobsByFunction: hit ? countByFunction(hit.jobs) : undefined,
      jobBoardUrl: hit ? boardUrl(hit.provider, hit.slug) : undefined,
    }).catch(() => []);
    const { result, composite, model } = await evaluateCompany({ name, website, hq_location: hq }, signals);
    await db.from("evaluations").insert({
      company_id: company.id,
      scores: result.scores,
      composite,
      joiner_upside: joinerUpside(result.scores),
      red_flags: result.red_flags,
      conflicts: result.conflicts,
      pmf_evidence: result.pmf_evidence,
      signals,
      summary: result.summary,
      model,
      status: "done",
    });
    await db
      .from("companies")
      .update({
        ...factsToCompanyUpdate(result.facts ?? {}, { hq_city: hq }),
        ...(hit ? { ats_provider: hit.provider, ats_slug: hit.slug, hiring_profile: hiringProfile(hit.jobs) } : {}),
      })
      .eq("id", company.id);
    if (hit?.jobs.length)
      await db.from("jobs").insert(hit.jobs.map((j) => ({ company_id: company.id, ...j, job_function: classifyRole(j.title) })));
    // Geocode from the researched HQ if the user didn't give one
    const { data: after } = await db.from("companies").select("hq_city,lat").eq("id", company.id).single();
    if (after?.hq_city && after.lat == null) {
      const g = await geocodeUs(after.hq_city).catch(() => null);
      if (g) await db.from("companies").update({ lat: g.lat, lng: g.lng }).eq("id", company.id);
    }
    return NextResponse.json({ company_id: company.id, composite });
  } catch (e: any) {
    // Remove the half-made company so it can be retried (and doesn't block the duplicate check).
    await db.from("companies").delete().eq("id", company.id);
    return NextResponse.json({ error: `The research step failed (${e.message}). Please try again.` }, { status: 502 });
  }
}
