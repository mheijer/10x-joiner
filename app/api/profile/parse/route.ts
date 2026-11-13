// POST /api/profile/parse  { background_text, looking_for, preferences }
// Reads the user's résumé / cover letter and goals ONCE (one AI call) and returns structured preferences plus
// SUGGESTED weights with reasons. Nothing changes in the user's ranking until they click "Apply" in the app:
// the team's LTV default weights stay the baseline. Fit across all companies is then plain math in the browser.
// Auth: the user's Supabase access token as "Authorization: Bearer <token>".
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { parseProfile } from "@/lib/fit";

export const maxDuration = 60;
const MAX_PARSES_PER_USER = 15; // each read costs a few cents; plenty for editing a profile

export async function POST(req: Request) {
  const db = supabaseAdmin();
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const { data: auth } = await db.auth.getUser(token ?? "");
  if (!auth?.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const background_text = String(body.background_text ?? "").slice(0, 20000);
  const looking_for = String(body.looking_for ?? "").slice(0, 4000);
  const preferences = body.preferences && typeof body.preferences === "object" ? body.preferences : {};
  if (!background_text.trim() && !looking_for.trim())
    return NextResponse.json({ error: "Tell us about yourself or upload a résumé first." }, { status: 400 });

  const { data: existing } = await db.from("profiles").select("parsed, profile_version").eq("user_id", auth.user.id).maybeSingle();
  const count = Number(existing?.parsed?.parse_count ?? 0);
  if (count >= MAX_PARSES_PER_USER)
    return NextResponse.json({ error: `You've used all ${MAX_PARSES_PER_USER} profile reads. Edit weights and preferences by hand.` }, { status: 429 });

  try {
    const parsed = await parseProfile({ background_text, looking_for, preferences });
    const stored = { ...parsed, parse_count: count + 1, parsed_at: new Date().toISOString() };
    await db.from("profiles").upsert({
      user_id: auth.user.id,
      background_text,
      looking_for,
      parsed: stored,
      profile_version: Number(existing?.profile_version ?? 0) + 1, // invalidates cached "why this fits you" text
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ parsed: stored });
  } catch (e: any) {
    return NextResponse.json({ error: `Couldn't read the profile: ${e.message}` }, { status: 502 });
  }
}
