"use client";
// "Your profile": tell the app about yourself (text or a résumé / cover letter), set explicit preferences, and
// choose your weights. The team's LTV default weights stay the baseline: suggested weights apply only when you click
// Apply, and "Reset to default" always brings the defaults back. One AI call reads your profile; everything else is math.
import { useEffect, useState } from "react";
import { DEFAULT_WEIGHTS, WINNING_DIMENSIONS } from "@/lib/rubric";
import { normalizeWeights, WEIGHT_PRESETS } from "@/lib/scoring";
import type { Weights } from "@/lib/scoring";
import { effectivePreferences } from "@/lib/personal";
import type { ProfileState, RedFlagMode } from "@/lib/personal";
import type { Preferences } from "@/lib/filters";
import type { SyncStatus } from "./useProfile";

const FUNCTIONS: [string, string][] = [
  ["product", "Product"], ["bizops", "BizOps / Strategy"], ["chief_of_staff", "Chief of Staff"], ["gtm", "Sales / GTM"],
  ["fde", "Forward-deployed"], ["marketing", "Marketing"], ["engineering", "Engineering"],
];
const STAGES: [NonNullable<Preferences["stage_buckets"]>[number], string][] = [["early", "Early (Seed–A)"], ["mid", "Mid (B–C)"], ["late", "Late (D+)"]];
const WORK: ["onsite" | "hybrid" | "remote", string][] = [["onsite", "Onsite"], ["hybrid", "Hybrid"], ["remote", "Remote"]];

const STATUS_TEXT: Record<SyncStatus, string> = {
  connecting: "Connecting…",
  saving: "Saving…",
  saved: "Saved to your account (this browser stays signed in)",
  local: "Saved on this device only",
  error: "Couldn't save to your account; kept on this device",
};

type Key = keyof Weights;

export default function ProfileDrawer({
  profile,
  update,
  status,
  signedIn,
  accessToken,
  clearAll,
  onClose,
}: {
  profile: ProfileState;
  update: (p: Partial<ProfileState> | ((p: ProfileState) => ProfileState)) => void;
  status: SyncStatus;
  signedIn: boolean;
  accessToken: () => Promise<string | null>;
  clearAll: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<"upload" | "parse" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const prefs = profile.preferences ?? {};
  const inferred = profile.parsed?.preferences ?? {};
  const eff = effectivePreferences(profile);
  const setPref = (patch: Partial<Preferences>) => update((p) => ({ ...p, preferences: { ...p.preferences, ...patch } }));
  const toggle = <T extends string>(list: T[] | undefined, v: T): T[] => {
    const l = list ?? [];
    return l.includes(v) ? l.filter((x) => x !== v) : [...l, v];
  };
  const isDefault = profile.weights_source === "default";
  const shownWeights: Weights = isDefault ? { ...DEFAULT_WEIGHTS } : normalizeWeights(profile.weights);

  async function upload(file: File) {
    setBusy("upload");
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/extract", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Upload failed");
      update((p) => ({ ...p, background_text: [p.background_text.trim(), j.text].filter(Boolean).join("\n\n") }));
      setMsg(`Read ${file.name}${j.truncated ? " (long file: first 20,000 characters kept)" : ""}. Check the text, then click "Read my profile".`);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function parse() {
    setBusy("parse");
    setMsg(null);
    try {
      const token = await accessToken();
      if (!token) throw new Error("Reading your profile needs your saved account, which isn't connected right now. You can still set preferences and weights below.");
      const res = await fetch("/api/profile/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ background_text: profile.background_text, looking_for: profile.looking_for, preferences: profile.preferences }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Couldn't read the profile");
      // Store the suggestions. Weights in use do NOT change until the user clicks Apply.
      update((p) => ({ ...p, parsed: j.parsed }));
      setMsg("Done. Your preferences now shape Fit to you. Suggested weights are below: apply them only if they look right.");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  const setWeight = (k: Key, v: number) => update((p) => ({ ...p, weights: { ...shownWeights, [k]: v }, weights_source: "custom" }));
  const applyWeights = (w: Weights, source: "suggested" | "custom") => update((p) => ({ ...p, weights: normalizeWeights(w), weights_source: source }));
  const resetWeights = () => update((p) => ({ ...p, weights: { ...DEFAULT_WEIGHTS }, weights_source: "default" }));
  const suggested = profile.parsed?.weights;
  const changedSuggestions = suggested
    ? WINNING_DIMENSIONS.filter((d) => Math.abs((suggested[d.key as Key] ?? 0) - DEFAULT_WEIGHTS[d.key as Key]) >= 1)
    : [];
  const inferredNote = (k: keyof Preferences) =>
    (prefs as any)[k] == null || ((prefs as any)[k] as any[])?.length === 0
      ? (inferred as any)[k] != null && !((Array.isArray((inferred as any)[k]) && (inferred as any)[k].length === 0))
        ? <span className="muted small"> · from your profile</span>
        : null
      : null;

  return (
    <div className="drawer" role="dialog" aria-label="Your profile">
      <div className="drawerhead">
        <strong>Your profile</strong>
        <span className="muted small">{STATUS_TEXT[status]}</span>
        <div className="spacer" />
        <button className="close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="drawerbody">
        {/* 1. About you */}
        <section>
          <h3 className="sect">1. About you</h3>
          <p className="muted small">
            Paste or upload your résumé or cover letter, and say what you're looking for. One AI call reads it and turns
            it into preferences and suggested weights; we store the text only, never the file.
          </p>
          <label className="title small">Résumé, cover letter or background</label>
          <textarea rows={6} value={profile.background_text} onChange={(e) => update({ background_text: e.target.value })} placeholder="e.g. 4 years in product at a fintech, ex-consultant, HBS '27…" />
          <label className="upload small">
            <input type="file" accept=".pdf,.docx,.txt,.md" disabled={!!busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            {busy === "upload" ? "Reading file…" : "Upload PDF / Word / text"}
          </label>
          <label className="title small" style={{ marginTop: 10 }}>What you're looking for</label>
          <textarea rows={3} value={profile.looking_for} onChange={(e) => update({ looking_for: e.target.value })} placeholder="e.g. a product role at a Series B–C AI company in NYC; I care about founders and learning more than cash." />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" disabled={!!busy || (!profile.background_text.trim() && !profile.looking_for.trim())} onClick={parse}>
              {busy === "parse" ? "Reading…" : profile.parsed ? "Read my profile again" : "Read my profile"}
            </button>
            {!signedIn && status !== "connecting" && <span className="muted small">Needs your saved account (not connected)</span>}
          </div>
          {msg && <div className="note" style={{ marginTop: 8 }}>{msg}</div>}
          {profile.parsed?.summary && <p className="small" style={{ marginTop: 8 }}><b>How we read you:</b> {profile.parsed.summary}</p>}
        </section>

        {/* 2. Preferences */}
        <section>
          <h3 className="sect">2. What you want</h3>
          <p className="muted small">These shape <b>Fit to you</b> (plain math). Anything you set here overrides what we read from your profile.</p>

          <label className="title small">Roles {inferredNote("target_functions")}</label>
          <div className="chips">
            {FUNCTIONS.map(([k, l]) => (
              <button key={k} className={`chip ${(eff.target_functions ?? []).includes(k as any) ? "on" : ""}`} onClick={() => setPref({ target_functions: toggle(eff.target_functions as string[], k) as any })}>{l}</button>
            ))}
          </div>

          <label className="title small">Stage {inferredNote("stage_buckets")}</label>
          <div className="chips">
            {STAGES.map(([k, l]) => (
              <button key={k} className={`chip ${(eff.stage_buckets ?? []).includes(k) ? "on" : ""}`} onClick={() => setPref({ stage_buckets: toggle(eff.stage_buckets, k) })}>{l}</button>
            ))}
          </div>

          <label className="title small">Locations (comma-separated metros) {inferredNote("locations")}</label>
          <ListInput value={eff.locations ?? []} onChange={(v) => setPref({ locations: v })} placeholder="San Francisco, New York, Boston" />

          <label className="title small">Work style {inferredNote("work_policy")}</label>
          <div className="chips">
            {WORK.map(([k, l]) => (
              <button key={k} className={`chip ${(eff.work_policy ?? []).includes(k) ? "on" : ""}`} onClick={() => setPref({ work_policy: toggle(eff.work_policy, k) })}>{l}</button>
            ))}
          </div>

          <label className="title small">Interests (comma-separated keywords) {inferredNote("interests")}</label>
          <ListInput value={eff.interests ?? []} onChange={(v) => setPref({ interests: v })} placeholder="healthcare, AI agents, fintech" />

          <div className="row" style={{ marginTop: 8, gap: 12 }}>
            <label className="small" style={{ flex: 1 }}>
              <span className="title">Headcount min</span>
              <input type="number" value={eff.headcount?.[0] ?? ""} onChange={(e) => setPref({ headcount: [e.target.value ? Number(e.target.value) : null, eff.headcount?.[1] ?? null] })} />
            </label>
            <label className="small" style={{ flex: 1 }}>
              <span className="title">max</span>
              <input type="number" value={eff.headcount?.[1] ?? ""} onChange={(e) => setPref({ headcount: [eff.headcount?.[0] ?? null, e.target.value ? Number(e.target.value) : null] })} />
            </label>
            <label className="small" style={{ flex: 1.3 }}>
              <span className="title">Min base ($) {inferredNote("min_base_salary_usd")}</span>
              <input type="number" step={5000} value={eff.min_base_salary_usd ?? ""} onChange={(e) => setPref({ min_base_salary_usd: e.target.value ? Number(e.target.value) : null })} />
            </label>
          </div>
          <label className="row small" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={!!eff.needs_visa_sponsorship} onChange={(e) => setPref({ needs_visa_sponsorship: e.target.checked })} /> I need visa sponsorship
          </label>
        </section>

        {/* 3. Weights */}
        <section>
          <h3 className="sect">3. How you weigh a company</h3>
          <p className="muted small">
            {isDefault
              ? "Using the team's LTV default weights. Change them only if you want to: your ranking moves, the defaults stay one click away."
              : profile.weights_source === "suggested"
                ? "Using the weights suggested from your profile."
                : "Using your own weights."}
          </p>

          {suggested && changedSuggestions.length > 0 && (
            <div className="suggest small">
              <b>Suggested from your profile</b> ({WEIGHT_PRESETS[profile.parsed!.preset]?.label ?? profile.parsed!.preset})
              <ul>
                {changedSuggestions.map((d) => (
                  <li key={d.key}>
                    {d.label}: {DEFAULT_WEIGHTS[d.key as Key]} → <b>{suggested[d.key as Key]}</b>
                    {profile.parsed!.weight_reasons?.[d.key as Key] && <span className="muted">: {profile.parsed!.weight_reasons[d.key as Key]}</span>}
                  </li>
                ))}
              </ul>
              <button className="btn" onClick={() => applyWeights(suggested, "suggested")} disabled={profile.weights_source === "suggested"}>
                {profile.weights_source === "suggested" ? "Applied" : "Apply suggested weights"}
              </button>
            </div>
          )}

          <div className="chips" style={{ margin: "8px 0" }}>
            {Object.entries(WEIGHT_PRESETS).map(([k, pr]) => (
              <button key={k} className="chip" title={pr.description} onClick={() => (k === "balanced" ? resetWeights() : applyWeights(pr.weights, "custom"))}>{pr.label}</button>
            ))}
          </div>

          {WINNING_DIMENSIONS.map((d) => {
            const k = d.key as Key;
            const v = shownWeights[k];
            return (
              <div key={k} className="wrow small" title={d.question}>
                <span>{d.label}</span>
                <input type="range" min={0} max={30} step={1} value={Math.round(v)} onChange={(e) => setWeight(k, Number(e.target.value))} />
                <span className="wval">
                  <b>{Math.round(v)}</b>
                  {!isDefault && Math.abs(v - DEFAULT_WEIGHTS[k]) >= 0.5 && <span className="muted"> ({DEFAULT_WEIGHTS[k]})</span>}
                </span>
              </div>
            );
          })}
          <div className="muted small">Weights are rescaled to add up to 100. Default in brackets when yours differs.</div>
          <button className="btn ghost" style={{ marginTop: 6 }} onClick={resetWeights} disabled={isDefault}>Reset to default weights</button>
        </section>

        {/* 4. Ranking */}
        <section>
          <h3 className="sect">4. Your ranking</h3>
          <label className="title small">For you = company quality vs. fit to you: {Math.round(profile.blend * 100)}% / {Math.round((1 - profile.blend) * 100)}%</label>
          <input className="range" type="range" min={0} max={100} step={5} value={Math.round(profile.blend * 100)} onChange={(e) => update({ blend: Number(e.target.value) / 100 })} />
          <label className="title small" style={{ marginTop: 8 }}>Red flags (your call)</label>
          <div className="chips">
            {(
              [
                ["show", "Show them, don't score them"],
                ["penalize", "Lower the score"],
                ["hide", "Hide medium/high"],
              ] as [RedFlagMode, string][]
            ).map(([k, l]) => (
              <button key={k} className={`chip ${profile.red_flag_mode === k ? "on" : ""}`} onClick={() => update({ red_flag_mode: k })}>{l}</button>
            ))}
          </div>
        </section>

        <section>
          <button className="linkbtn" onClick={() => { if (confirm("Clear your profile, preferences and weights?")) clearAll(); }}>
            Clear my profile
          </button>
        </section>
      </div>
    </div>
  );
}

/** Comma-separated list input that keeps what you type (commas, spaces) while saving the cleaned list. */
function ListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [raw, setRaw] = useState(value.join(", "));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setRaw(value.join(", "));
  }, [value.join("|"), focused]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      type="text"
      value={raw}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(e.target.value.split(",").map((x) => x.trim()).filter(Boolean));
      }}
    />
  );
}
