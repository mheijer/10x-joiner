"use client";
// Explore: filters (left), map or scatter (center), ranked list (right), scorecard panel on selection.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { CompanyRow } from "@/lib/supabase-public";
import { DIMENSIONS } from "@/lib/rubric";
import { stageBucket } from "@/lib/equity";
import { coverage } from "@/lib/coverage";
import { scoreColor, quadrant } from "@/lib/display";
import { isPersonalized, metricValue, personalFor, shownMetric, METRIC_LABEL, METRIC_SHORT } from "@/lib/personal";
import type { Metric, Personal } from "@/lib/personal";
import CompanyPanel from "./CompanyPanel";
import ScatterView from "./ScatterView";
import ProfileDrawer from "./ProfileDrawer";
import AddCompany from "./AddCompany";
import { useRouter } from "next/navigation";
import { useProfile } from "./useProfile";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="empty">Loading map…</div> });

type Bucket = "early" | "mid" | "late";
type DimFilter = { key: string; min: number };
type SortKey = "personal" | "composite" | "joiner_upside" | "name" | "funding";

type AiResult = { q: string; understood: string; picks: { id: string; reason: string }[]; filters: Record<string, unknown> };

/** Keyword search: every word must appear somewhere in the name, sector, stage, HQ or description. */
function textMatch(c: CompanyRow, text: string): boolean {
  const hay = [c.name, c.sector, c.stage, c.hq_city, c.description].filter(Boolean).join(" ").toLowerCase();
  return text.split(/[\s,]+/).filter(Boolean).every((w) => hay.includes(w));
}

const metroOf = (hq: string | null) => (hq ? hq.split(",")[0].trim() : null);

export default function Explore({ companies, loadError }: { companies: CompanyRow[]; loadError: string | null }) {
  const [view, setView] = useState<"map" | "scatter">("map");
  const [q, setQ] = useState("");
  const [onlyEvaluated, setOnlyEvaluated] = useState(false);
  const [stages, setStages] = useState<Bucket[]>([]);
  const [sizeMin, setSizeMin] = useState<string>("");
  const [sizeMax, setSizeMax] = useState<string>("");
  const [metro, setMetro] = useState<string>("");
  const [minWin, setMinWin] = useState(0);
  const [minUp, setMinUp] = useState(0);
  const [dims, setDims] = useState<DimFilter[]>([]);
  const [hideLowCoverage, setHideLowCoverage] = useState(false);
  const [hideFlagged, setHideFlagged] = useState(false);
  const [visaOnly, setVisaOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("composite");
  const [selected, setSelected] = useState<string | null>(null);
  const [lastScoreFilter, setLastScoreFilter] = useState<Metric | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  const [addNote, setAddNote] = useState<string | null>(null);
  const router = useRouter();
  const [ai, setAi] = useState<AiResult | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiOrder, setAiOrder] = useState(false); // list in AI best-match order until the user picks a sort
  const aiRank = useMemo(() => new Map((ai?.picks ?? []).map((p, i) => [p.id, { i, reason: p.reason }])), [ai]);

  async function askAi(question: string) {
    const qq = question.trim();
    if (qq.length < 3) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: qq }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "AI search failed");
      setAiOrder(true);
      setAi({ q: qq, understood: j.understood, picks: j.picks ?? [], filters: j.filters ?? {} });
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setAiBusy(false);
    }
  }
  const { profile, update, status, signedIn, email, accessToken, clearAll, sendSignInLink, signOut } = useProfile();
  const personalized = isPersonalized(profile);

  // Personal scores for every company: plain math in the browser, recomputed when the profile changes.
  const personalById = useMemo(() => {
    const m = new Map<string, Personal>();
    for (const c of companies) m.set(c.id, personalFor(c as any, profile));
    return m;
  }, [companies, profile]);
  const P = useCallback((c: CompanyRow) => personalById.get(c.id) ?? null, [personalById]);

  // Once a profile exists, rank "For you" by default (until the user picks a sort themselves).
  const sortTouched = useRef(false);
  useEffect(() => {
    if (personalized && !sortTouched.current && sort === "composite") setSort("personal");
    if (!personalized && sort === "personal") setSort("composite");
  }, [personalized]); // eslint-disable-line react-hooks/exhaustive-deps

  const metric = shownMetric({ sort, lastScoreFilter, personalized });
  const valueOf = useCallback((c: CompanyRow) => metricValue(c, metric, P(c)), [metric, P]);

  const metros = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of companies) {
      const m = metroOf(c.hq_city);
      if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
  }, [companies]);

  const scoreFiltersOn = minWin > 0 || minUp > 0 || dims.length > 0 || hideLowCoverage;

  const filtered = useMemo(() => {
    const text = ai ? "" : q.trim().toLowerCase();
    const lo = sizeMin ? Number(sizeMin) : null;
    const hi = sizeMax ? Number(sizeMax) : null;
    return companies.filter((c) => {
      const evaluated = c.composite != null;
      if ((onlyEvaluated || scoreFiltersOn) && !evaluated) return false;
      if (ai && !aiRank.has(c.id)) return false;
      if (text && !textMatch(c, text)) return false;
      if (stages.length) {
        if (!c.stage) return false;
        if (!stages.includes(stageBucket(c.stage, c.scores?.pmf?.score ?? null))) return false;
      }
      if (lo != null && (c.headcount == null || c.headcount < lo)) return false;
      if (hi != null && (c.headcount == null || c.headcount > hi)) return false;
      if (metro && metroOf(c.hq_city) !== metro) return false;
      if (minWin > 0 && (P(c)?.winning ?? c.composite ?? 0) < minWin) return false;
      if (minUp > 0 && (c.joiner_upside ?? 0) < minUp) return false;
      for (const d of dims) if ((c.scores?.[d.key]?.score ?? 0) < d.min) return false;
      if (hideLowCoverage && coverage(c).level === "low") return false;
      if ((hideFlagged || profile.red_flag_mode === "hide") && (c.red_flags ?? []).some((f) => f.severity === "medium" || f.severity === "high")) return false;
      if (visaOnly && !(c.sponsors_visas === "yes" || c.sponsors_visas === "likely")) return false;
      return true;
    });
  }, [companies, q, onlyEvaluated, scoreFiltersOn, stages, sizeMin, sizeMax, metro, minWin, minUp, dims, hideLowCoverage, hideFlagged, visaOnly, P, profile.red_flag_mode, ai, aiRank]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const val = (c: CompanyRow) =>
      sort === "personal" ? P(c)?.personal ?? null
      : sort === "composite" ? P(c)?.winning ?? c.composite
      : sort === "joiner_upside" ? c.joiner_upside
      : sort === "funding" ? c.total_funding_usd
      : null;
    if (ai && aiOrder) return arr.sort((a, b) => aiRank.get(a.id)!.i - aiRank.get(b.id)!.i); // best AI match first
    arr.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      const va = val(a), vb = val(b);
      if (va == null && vb == null) return a.name.localeCompare(b.name);
      if (va == null) return 1;
      if (vb == null) return -1;
      return vb - va;
    });
    return arr;
  }, [filtered, sort, P, ai, aiRank, aiOrder]);

  // How many companies the search alone matches, to explain when other filters hide them all.
  const searchOnlyCount = useMemo(() => {
    if (ai) return ai.picks.length;
    const text = q.trim().toLowerCase();
    return text ? companies.filter((c) => textMatch(c, text)).length : companies.length;
  }, [companies, q, ai]);
  const otherFiltersOn =
    onlyEvaluated || stages.length > 0 || !!sizeMin || !!sizeMax || !!metro || minWin > 0 || minUp > 0 || dims.length > 0 ||
    hideLowCoverage || hideFlagged || visaOnly || profile.red_flag_mode === "hide";
  const clearOtherFilters = () => {
    setOnlyEvaluated(false); setStages([]); setSizeMin(""); setSizeMax(""); setMetro("");
    setMinWin(0); setMinUp(0); setLastScoreFilter(null); setDims([]); setHideLowCoverage(false); setHideFlagged(false); setVisaOnly(false);
  };
  const fitKey = ai ? `ai:${ai.q}` : q.trim().length >= 2 ? `q:${q.trim()}|${filtered.length}` : metro ? `m:${metro}` : "";

  const selectedCompany = selected ? companies.find((c) => c.id === selected) ?? null : null;
  // After adding a company, the page re-reads the list; open the new company once it arrives.
  useEffect(() => {
    if (pendingSelect && companies.some((c) => c.id === pendingSelect)) {
      setSelected(pendingSelect);
      setPendingSelect(null);
    }
  }, [companies, pendingSelect]);
  const evaluatedCount = companies.filter((c) => c.composite != null).length;
  const toggleStage = (b: Bucket) => setStages((s) => (s.includes(b) ? s.filter((x) => x !== b) : [...s, b]));
  const reset = () => {
    setQ(""); setAi(null); setAiError(null); setOnlyEvaluated(false); setStages([]); setSizeMin(""); setSizeMax(""); setMetro("");
    setMinWin(0); setMinUp(0); setLastScoreFilter(null); setDims([]); setHideLowCoverage(false); setHideFlagged(false); setVisaOnly(false);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">The Next <span>10x</span> Joiner</div>
        <nav className="tabs">
          <button className={`tab ${view === "map" ? "active" : ""}`} onClick={() => setView("map")}>Map</button>
          <button className={`tab ${view === "scatter" ? "active" : ""}`} onClick={() => setView("scatter")}>Scatter</button>
        </nav>
        <div className="spacer" />
        <div className="muted small">
          {companies.length} companies · {evaluatedCount} evaluated · Rocketship List 2026 (US)
        </div>
        <button className="btn" onClick={() => setShowAdd(true)} title="Research and score a company that isn't on the list">+ Add a company</button>
        <button className={`btn ${personalized ? "" : "primary"}`} onClick={() => setShowProfile(true)}>
          {email ? `${email.split("@")[0]} · profile` : personalized ? "Your profile ✓" : "Personalize: tell us about you"}
        </button>
      </header>

      {loadError ? (
        <div className="error">
          Couldn't load companies: {loadError}. Check the Supabase environment variables.
        </div>
      ) : (
        <div className="main">
          <aside className="filters">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <strong>Filters</strong>
              <button className="linkbtn" onClick={reset}>Reset</button>
            </div>

            <div className="fgroup">
              <label className="title">Search</label>
              <input
                type="text"
                placeholder="Company, sector, city, or ask a question…"
                value={q}
                onChange={(e) => { setQ(e.target.value); if (ai) setAi(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && q.trim().split(/\s+/).length >= 3) askAi(q); }}
              />
              <div className="row" style={{ marginTop: 6, justifyContent: "space-between" }}>
                <button className="btn" disabled={aiBusy || q.trim().length < 3} onClick={() => askAi(q)}>
                  {aiBusy ? "Searching…" : "✨ Ask AI"}
                </button>
                <span className="muted small">e.g. "Series B AI healthcare in Boston"</span>
              </div>
              {aiError && <div className="note" style={{ marginTop: 6 }}>{aiError}</div>}
              {ai && (
                <div className="aibox small">
                  <b>AI search:</b> {ai.understood || ai.q}
                  <div className="muted">{ai.picks.length} matches, best first · picked from company descriptions, so check each one</div>
                  <button className="linkbtn" onClick={() => setAi(null)}>Clear AI search</button>
                </div>
              )}
            </div>

            <div className="fgroup">
              <label className="title">Stage</label>
              <div className="chips">
                {(["early", "mid", "late"] as Bucket[]).map((b) => (
                  <button key={b} className={`chip ${stages.includes(b) ? "on" : ""}`} onClick={() => toggleStage(b)}>
                    {b === "early" ? "Early (Seed–A)" : b === "mid" ? "Mid (B–C)" : "Late (D+)"}
                  </button>
                ))}
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>Judged by traction, not just the round name.</div>
            </div>

            <div className="fgroup">
              <label className="title">Headcount</label>
              <div className="row">
                <input type="number" placeholder="Min" value={sizeMin} onChange={(e) => setSizeMin(e.target.value)} />
                <input type="number" placeholder="Max" value={sizeMax} onChange={(e) => setSizeMax(e.target.value)} />
              </div>
            </div>

            <div className="fgroup">
              <label className="title">Location</label>
              <select value={metro} onChange={(e) => setMetro(e.target.value)}>
                <option value="">Anywhere</option>
                {metros.map(([m, n]) => (
                  <option key={m} value={m}>{m} ({n})</option>
                ))}
              </select>
            </div>

            <div className="fgroup">
              <label className="title">Probability of Winning ≥ {minWin}</label>
              <input className="range" type="range" min={0} max={100} step={5} value={minWin} onChange={(e) => { const v = Number(e.target.value); setMinWin(v); setLastScoreFilter(v > 0 ? "composite" : minUp > 0 ? "joiner_upside" : null); }} />
            </div>
            <div className="fgroup">
              <label className="title">Joiner Upside ≥ {minUp}</label>
              <input className="range" type="range" min={0} max={100} step={5} value={minUp} onChange={(e) => { const v = Number(e.target.value); setMinUp(v); setLastScoreFilter(v > 0 ? "joiner_upside" : minWin > 0 ? "composite" : null); if (v > 0 && sort !== "joiner_upside" && (sort === "composite" || sort === "personal")) { sortTouched.current = true; setSort("joiner_upside"); } }} />
            </div>

            <div className="fgroup">
              <label className="title">LTV dimensions</label>
              {dims.map((d, i) => (
                <div className="dimrow" key={i}>
                  <select value={d.key} onChange={(e) => setDims(dims.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}>
                    {DIMENSIONS.map((dd) => (
                      <option key={dd.key} value={dd.key}>{dd.label}</option>
                    ))}
                  </select>
                  <select value={d.min} onChange={(e) => setDims(dims.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) } : x)))}>
                    {[2, 2.5, 3, 3.5, 4, 4.5, 5].map((v) => (
                      <option key={v} value={v}>≥ {v}</option>
                    ))}
                  </select>
                  <button className="linkbtn" aria-label="Remove" onClick={() => setDims(dims.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button className="linkbtn" style={{ marginTop: 6 }} onClick={() => setDims([...dims, { key: "moat", min: 4 }])}>
                + Add dimension filter (e.g. Moat ≥ 4)
              </button>
            </div>

            <div className="fgroup">
              <label className="title">Caveats</label>
              <label className="row small"><input type="checkbox" checked={onlyEvaluated} onChange={(e) => setOnlyEvaluated(e.target.checked)} /> Only evaluated companies</label>
              <label className="row small"><input type="checkbox" checked={hideLowCoverage} onChange={(e) => setHideLowCoverage(e.target.checked)} /> Hide low data coverage</label>
              <label className="row small"><input type="checkbox" checked={hideFlagged} onChange={(e) => setHideFlagged(e.target.checked)} /> Hide medium/high red flags</label>
              <label className="row small"><input type="checkbox" checked={visaOnly} onChange={(e) => setVisaOnly(e.target.checked)} /> Sponsors visas</label>
            </div>
          </aside>

          <section className="center">
            {view === "map" ? (
              <MapView companies={filtered} selectedId={selected} onSelect={setSelected} valueOf={valueOf} metricLabel={METRIC_LABEL[metric]} fitKey={fitKey} />
            ) : (
              <ScatterView
                companies={filtered}
                onSelect={setSelected}
                colorOf={valueOf}
                personalAxes={personalized ? { winning: (c) => P(c)?.winning ?? null, personal: (c) => P(c)?.personal ?? null, fit: (c) => P(c)?.fit.score ?? null } : null}
              />
            )}
            {selectedCompany && <CompanyPanel c={selectedCompany} onClose={() => setSelected(null)} profile={profile} personal={P(selectedCompany)} />}
            {showAdd && (
              <AddCompany
                accessToken={accessToken}
                onClose={() => setShowAdd(false)}
                onDone={(id, existing) => {
                  setShowAdd(false);
                  setAddNote(existing ? "That company is already on the list, so we opened it for you." : "Added and scored. Everyone can see it now.");
                  setPendingSelect(id);
                  reset();
                  router.refresh();
                }}
              />
            )}
            {addNote && <div className="toast" onClick={() => setAddNote(null)}>{addNote} ✕</div>}
            {showProfile && (
              <ProfileDrawer profile={profile} update={update} status={status} signedIn={signedIn} accessToken={accessToken} clearAll={clearAll} onClose={() => setShowProfile(false)} email={email} sendSignInLink={sendSignInLink} signOut={signOut} />
            )}
          </section>

          <aside className="list">
            <div className="listhead">
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                <strong className="count">{sorted.length.toLocaleString()} {sorted.length === 1 ? "company" : "companies"}</strong>
                <select className="sortsel" value={sort} onChange={(e) => { sortTouched.current = true; setAiOrder(false); setSort(e.target.value as SortKey); }}>
                  {personalized && <option value="personal">Sort: For you</option>}
                  <option value="composite">Sort: Winning</option>
                  <option value="joiner_upside">Sort: Joiner Upside</option>
                  <option value="funding">Sort: Total raised</option>
                  <option value="name">Sort: Name</option>
                </select>
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                Badge shows <b>{METRIC_LABEL[metric]}</b>{metric === "personal" ? " (your weights + fit)" : profile.weights_source !== "default" && metric === "composite" ? " (your weights)" : ""}
                {ai && aiOrder && " · listed in AI best-match order"}
              </div>
            </div>
            {sorted.length === 0 && (
              <div className="empty">
                {searchOnlyCount > 0 && otherFiltersOn ? (
                  <>
                    {searchOnlyCount} {searchOnlyCount === 1 ? "company matches" : "companies match"} {ai ? "the AI search" : `"${q.trim()}"`}, but your other filters hide{" "}
                    {searchOnlyCount === 1 ? "it" : "them"}{minWin > 0 || minUp > 0 || dims.length > 0 ? " (score filters only show the companies we've evaluated so far)" : ""}.
                    <div style={{ marginTop: 8 }}><button className="btn" onClick={clearOtherFilters}>Clear the other filters</button></div>
                  </>
                ) : ai ? (
                  "The AI found no good matches. Try rephrasing."
                ) : q.trim() ? (
                  <>
                    No companies match "{q.trim()}". Try <button className="linkbtn" onClick={() => askAi(q)}>asking the AI</button>, or{" "}
                    <button className="linkbtn" onClick={() => setShowAdd(true)}>add it</button> if it's missing.
                  </>
                ) : (
                  "No companies match these filters."
                )}
              </div>
            )}
            {sorted.length > 0 && otherFiltersOn && searchOnlyCount > sorted.length && (q.trim() || ai) && (
              <div className="hiddenbar small">
                {searchOnlyCount - sorted.length} more {ai ? "AI matches" : "matches"} hidden by your filters ·{" "}
                <button className="linkbtn" onClick={clearOtherFilters}>show them</button>
              </div>
            )}
            {sorted.slice(0, 300).map((c) => {
              const cov = coverage(c);
              const flags = (c.red_flags ?? []).filter((f) => f.severity !== "low").length;
              const pc = P(c);
              const quad = quadrant(pc?.winning ?? c.composite, c.joiner_upside);
              const shown = valueOf(c);
              const others = (["composite", "joiner_upside", "personal"] as Metric[])
                .filter((m) => m !== metric && (m !== "personal" || personalized))
                .map((m) => [m, metricValue(c, m, pc)] as const)
                .filter(([, v]) => v != null);
              return (
                <div key={c.id} className={`item ${selected === c.id ? "sel" : ""}`} onClick={() => setSelected(c.id)}>
                  <div className="name">{c.name}{!c.is_seed && <span className="badge user" style={{ marginLeft: 6 }}>Added by a user</span>}</div>
                  <div>
                    {shown != null ? (
                      <span className="pill" style={{ background: scoreColor(shown) }} title={METRIC_LABEL[metric]}>
                        {METRIC_SHORT[metric]} {Math.round(shown)}
                      </span>
                    ) : (
                      <span className="badge">Not evaluated</span>
                    )}
                  </div>
                  <div className="meta">
                    {[c.sector, c.stage, c.hq_city].filter(Boolean).join(" · ")}
                    {others.map(([m, v]) => <span key={m}> · {METRIC_SHORT[m]} {Math.round(v!)}</span>)}
                    {quad && <> · {quad}</>}
                    {c.composite != null && <> · <span className={`badge ${cov.level}`}>{cov.level} coverage</span></>}
                    {flags > 0 && <> · <span className="badge flag">{flags} red flag{flags > 1 ? "s" : ""}</span></>}
                  </div>
                  {aiRank.get(c.id)?.reason && <div className="aireason">✨ {aiRank.get(c.id)!.reason}</div>}
                </div>
              );
            })}
            {sorted.length > 0 && (
              <div className="listfoot small muted">
                Missing a company? <button className="linkbtn" onClick={() => setShowAdd(true)}>Add it</button>
              </div>
            )}
            {sorted.length > 300 && <div className="empty small">Showing the first 300. Narrow the filters to see more.</div>}
          </aside>
        </div>
      )}
    </div>
  );
}
