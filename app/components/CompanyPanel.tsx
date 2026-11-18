"use client";
// Company panel, in four tabs so each question has one place:
//   Overview      — For you first (and how it's built), then the two company questions that make up the Company
//                   score, strengths and watch-outs, red flags, total comp, key facts
//   Scorecard     — every LTV concept as ONE number: points earned out of its weight; open one for the reasoning,
//                   sources and "What is …?" (definition, why it matters, the course concepts behind it)
//   Equity & comp — total comp (salary + equity per year), with the equity levers editable right there
//   Fit & hiring  — your fit first, then open roles by function and posted pay
// Every number shows its source or is marked an estimate.
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CompanyRow } from "@/lib/supabase-public";
import { DIMENSIONS, DEFAULT_WEIGHTS, EXPLAINERS, JOINER_DIMENSIONS, realRedFlags } from "@/lib/rubric";
import { contributions, joinerContributions } from "@/lib/scoring";
import { coverage } from "@/lib/coverage";
import { usd, num, scoreColor, quadrant, PHASE_LABEL, band, QUADRANT_INFO, strengthsAndWatchouts } from "@/lib/display";
import type { Highlight } from "@/lib/display";
import { activeWeights, baseSalaryFor, effectivePreferences, isPersonalized } from "@/lib/personal";
import { defaultSim, runSim, grantPctFor } from "@/lib/simulator";
import type { SimState } from "@/lib/simulator";
import type { Personal, ProfileState } from "@/lib/personal";
import EquitySimulator from "./EquitySimulator";
import SaveToList from "./SaveToList";
import type { SavedList } from "@/lib/lists";
import { alumniLinks, linkedinPageUrl } from "@/lib/linkedin";

type Tab = "overview" | "scorecard" | "equity" | "hiring";
type Dim = (typeof DIMENSIONS)[number];
type Grade = { score: number; confidence: string; rationale: string; sources: string[] };
const LOW_GRADE = 2.5;
const label = (key: string) => DIMENSIONS.find((d) => d.key === key)?.label ?? key;
/** Dimension name without its parenthetical, e.g. "PMF, job-to-be-done & customer love (HUNCH)" → "PMF". */
const shortLabel = (key: string) => label(key).split(/[,(&]/)[0].trim();
const fmtW = (w: number) => (w % 1 ? w.toFixed(1) : String(w));

const COVERAGE_TEXT: Record<string, string> = {
  high: "Plenty of public evidence: treat the scores as solid.",
  medium: "Some gaps in public evidence: treat the scores as a good first read.",
  low: "Thin public evidence: treat the scores as a rough guess.",
  none: "Not researched yet.",
};

/** Where the company sits: Probability of Winning across, Joiner Upside up, split at 60. */
function QuadrantMini({ w, u }: { w: number; u: number }) {
  const S = 112, pad = 4, x = pad + (Math.max(0, Math.min(100, w)) / 100) * (S - 2 * pad), y = S - pad - (Math.max(0, Math.min(100, u)) / 100) * (S - 2 * pad);
  const mid = pad + 0.6 * (S - 2 * pad), midY = S - pad - 0.6 * (S - 2 * pad);
  return (
    <svg viewBox={`0 0 ${S + 34} ${S + 20}`} className="quadmini" role="img" aria-label={`Winning ${Math.round(w)}, Upside ${Math.round(u)}`}>
      <g transform="translate(30,2)">
        <rect x={pad} y={pad} width={S - 2 * pad} height={S - 2 * pad} rx="6" fill="#fafaf8" stroke="#e4e3de" />
        <line x1={mid} x2={mid} y1={pad} y2={S - pad} stroke="#d6d4cd" strokeDasharray="3 3" />
        <line x1={pad} x2={S - pad} y1={midY} y2={midY} stroke="#d6d4cd" strokeDasharray="3 3" />
        <text x={(pad + mid) / 2} y={(pad + midY) / 2 + 3} textAnchor="middle" fontSize="8.5" fill="#9a968c">Lottery</text>
        <text x={(mid + S - pad) / 2} y={(pad + midY) / 2 + 3} textAnchor="middle" fontSize="8.5" fill="#9a968c">Pursue</text>
        <text x={(pad + mid) / 2} y={(midY + S - pad) / 2 + 3} textAnchor="middle" fontSize="8.5" fill="#9a968c">Pass</text>
        <text x={(mid + S - pad) / 2} y={(midY + S - pad) / 2 + 3} textAnchor="middle" fontSize="8.5" fill="#9a968c">Safe bet</text>
        <circle cx={x} cy={y} r="6" fill="var(--accent)" stroke="#fff" strokeWidth="2" />
        <text x={S / 2} y={S + 14} textAnchor="middle" fontSize="9" fill="#6b6860">Will it win? →</text>
      </g>
      <text x="10" y={S / 2} fontSize="9" fill="#6b6860" transform={`rotate(-90 10 ${S / 2})`} textAnchor="middle">Good deal to join? →</text>
    </svg>
  );
}

/** One score as a question, a number, a word and a bar (with the 60 line the quadrants use). */
function Meter({ q, sub, score, onMore, more, small }: { q: string; sub: ReactNode; score: number | null; onMore?: () => void; more?: string; small?: boolean }) {
  return (
    <div className={`meter ${small ? "small-meter" : ""}`}>
      <div className="meterhead">
        <span className="meterq">{q}</span>
        <span className="meterv" style={{ color: scoreColor(score) }}>
          {score != null ? Math.round(score) : "—"}<span className="muted small">/100</span> <b>{band(score)}</b>
        </span>
      </div>
      <div className="meterbar">
        <div style={{ width: `${score ?? 0}%`, background: scoreColor(score) }} />
        <span className="meter60" title="60 = the line between the quadrants" />
      </div>
      <div className="muted small">
        {sub} {onMore && <button className="linkbtn" onClick={onMore}>{more ?? "How it's scored"} ›</button>}
      </div>
    </div>
  );
}

/** For you, built up in front of the user: blend × Company score + (1 − blend) × Fit. */
function ForYouCard({ personal, profile, upside, onFit, onProfile }: { personal: Personal; profile: ProfileState; upside: number | null; onFit: () => void; onProfile?: () => void }) {
  const b = profile.blend;
  return (
    <div className="foryou">
      <Meter q="For you" score={personal.personal} sub="Your personal ranking for this company." />
      <div className="formula small">
        <div className="fpart">
          <div className="fhead"><span className="fnum" style={{ color: scoreColor(personal.company) }}>{personal.company != null ? Math.round(personal.company) : "—"}</span><span className="fw">× {Math.round(b * 100)}%</span></div>
          <div className="flabel">Company score</div>
          <div className="muted fsub">average of "Will it win?" and "Good deal to join?" below</div>
        </div>
        <div className="fop">+</div>
        <div className="fpart">
          <div className="fhead"><span className="fnum" style={{ color: scoreColor(personal.fit.score) }}>{personal.fit.score}</span><span className="fw">× {Math.round((1 - b) * 100)}%</span></div>
          <div className="flabel">Fit to you</div>
          <div className="muted fsub">roles, stage, size, location, pay · <button className="linkbtn" onClick={onFit}>see fit ›</button></div>
        </div>
      </div>
      <div className="muted small">
        Your split: {Math.round(b * 100)}% company, {Math.round((1 - b) * 100)}% fit{onProfile && <> (<button className="linkbtn" onClick={onProfile}>change</button>)</>}.
        {profile.red_flag_mode === "penalize" ? " Red flags are subtracted (your setting)." : ""}
        {upside == null ? " No Joiner Upside score yet, so Company score = Will it win?" : ""}
      </div>
    </div>
  );
}

/** Short on purpose: the concept's name and its points. Click one to read the reasoning in the Scorecard. */
function Highlights({ title, items, tone, onOpen, pts }: { title: string; items: Highlight[]; tone: "good" | "bad"; onOpen: (key: string) => void; pts: Record<string, { points: number; weight: number }> }) {
  if (!items.length) return null;
  return (
    <div className={`hl ${tone}`}>
      <div className="hlt">{title}</div>
      {items.map((h) => (
        <button key={h.key} className="hli" onClick={() => onOpen(h.key)} title={`${h.line} (click for the full reasoning)`}>
          <span>{shortLabel(h.key)}</span>
          <span className="hlg">{pts[h.key] ? `${pts[h.key].points.toFixed(1)} / ${fmtW(pts[h.key].weight)}` : ""} ›</span>
        </button>
      ))}
    </div>
  );
}

/**
 * A concept: its name, a bar, and ONE number (points earned out of its weight). Open it for the reasoning, sources,
 * confidence and "What is …?" (definition, why it matters to a joiner, the course concepts behind it).
 */
function CheckRow({ d, s, points, weight, extra, open }: { d: Dim; s: Grade; points: number; weight: number; extra?: ReactNode; open?: boolean }) {
  const low = s.score < LOW_GRADE;
  const ref = useRef<HTMLDetailsElement>(null);
  const [explain, setExplain] = useState(false);
  useEffect(() => {
    // Opened from a strength/watch-out on the Overview: unfold it and bring it into view, once.
    if (open && ref.current) {
      ref.current.open = true;
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [open]);
  const ex = EXPLAINERS[d.key];
  const share = weight > 0 ? points / weight : 0;
  const name = shortLabel(d.key);
  return (
    <details ref={ref} className={`check ${low ? "lowgrade" : ""} ${open ? "flash" : ""}`}>
      <summary>
        <span className="checkname">{d.label}</span>
        <span className="checkbar"><i style={{ width: `${share * 100}%`, background: scoreColor(share * 100) }} /></span>
        <span className="checkpts">
          <b>{points.toFixed(1)}</b> / {fmtW(weight)}
          {s.confidence === "low" && <span className="lowconf" title="Low confidence: thin evidence, so this was pulled toward the middle">*</span>}
        </span>
      </summary>
      <div className="checkbody small">
        <div className="checkq">{d.question}</div>
        <div style={{ marginTop: 4 }}>{s.rationale}</div>
        <div className="muted" style={{ marginTop: 4 }}>
          Confidence: {s.confidence}
          {s.sources?.length ? <> · Sources: {s.sources.slice(0, 4).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer">[{i + 1}]</a>)}</> : null}
          {extra}
        </div>
        {ex && (
          <>
            <button className="linkbtn" style={{ marginTop: 6 }} onClick={() => setExplain((v) => !v)}>
              {explain ? "Hide" : `What is ${name === "PMF" || name === "GTM fit" || name === "AI positioning" ? name : name.toLowerCase()}, and why does it matter? ›`}
            </button>
            {explain && (
              <div className="explainer">
                <p><b>What it is.</b> {ex.what}</p>
                <p><b>Why it matters to a joiner.</b> {ex.why}</p>
                <p className="muted"><b>From the course:</b> {d.courseAnchor}</p>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}

export default function CompanyPanel({
  c,
  onClose,
  profile,
  personal,
  onOpenProfile,
  onListsChange,
}: {
  c: CompanyRow;
  onClose: () => void;
  profile: ProfileState;
  personal: Personal | null;
  onOpenProfile?: () => void;
  onListsChange?: (lists: SavedList[]) => void;
}) {
  const [tab, setTabRaw] = useState<Tab>("overview");
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  // Clicking a tab opens it fresh (every scorecard row collapsed); a strength/watch-out opens its own concept.
  const setTab = (t: Tab) => {
    setOpenCheck(null);
    setTabRaw(t);
  };
  const showCheck = (key: string) => {
    setTabRaw("scorecard");
    setOpenCheck(key);
  };
  const cov = coverage(c);
  const winning = personal?.winning ?? c.composite;
  const quad = quadrant(winning, c.joiner_upside);
  const qi = quad ? QUADRANT_INFO[quad] : null;
  const hp = c.hiring_profile;
  const evaluated = c.composite != null && !!c.scores;
  const personalized = isPersonalized(profile);
  const customWeights = profile.weights_source !== "default";
  const weights = activeWeights(profile);

  // Equity levers, editable on the Equity & comp tab (the simulator starts from the same state)
  const [baseInput, setBaseInput] = useState<string>("");
  const [grantLevel, setGrantLevel] = useState<"low" | "mid" | "high">("mid");
  const [grantPctInput, setGrantPctInput] = useState<string>("");
  const [valInput, setValInput] = useState<string>("");
  const [simOpen, setSimOpen] = useState(false);
  const prefs = effectivePreferences(profile);
  // One estimate, shared by this panel and the simulator: company-specific defaults (valuation, raised, stage judged
  // by traction, exit odds nudged by Probability of Winning, posted pay for your role), then the user's edits.
  const est = useMemo(() => {
    const base = baseSalaryFor(c.hiring_profile, prefs, baseInput ? Number(baseInput) : null);
    const sim = defaultSim(
      {
        name: c.name, stage: c.stage, pmfScore: c.scores?.pmf?.score ?? null, winning: winning ?? null,
        latest_post_money_usd: c.latest_post_money_usd, post_money_is_estimate: c.post_money_is_estimate, total_funding_usd: c.total_funding_usd,
      },
      base,
    );
    const state: SimState = {
      ...sim.state,
      estimateLevel: grantLevel,
      ...(grantPctInput ? { offerMode: "percent" as const, grantPct: Number(grantPctInput) } : {}),
      ...(valInput ? { postMoneyUsd: Number(valInput) * 1e6 } : {}),
    };
    const b = sim.sources.bucket;
    return {
      base,
      sim: { ...sim, state },
      result: state.postMoneyUsd ? runSim(state, b) : null,
      lowPct: grantPctFor({ ...state, offerMode: "estimate", estimateLevel: "low" }, b),
      highPct: grantPctFor({ ...state, offerMode: "estimate", estimateLevel: "high" }, b),
    };
  }, [c, prefs, baseInput, winning, grantLevel, grantPctInput, valInput]);

  const contrib = evaluated ? contributions(c.scores as any, weights) : [];
  const jcontrib = evaluated ? joinerContributions(c.scores as any) : [];
  const pts: Record<string, { points: number; weight: number }> = Object.fromEntries([
    ...contrib.map((x) => [x.key, { points: x.points, weight: Math.round(x.weight * 10) / 10 }]),
    ...jcontrib.map((x) => [x.key, { points: x.points, weight: Math.round(x.weight) }]),
  ]);
  const hl = evaluated ? strengthsAndWatchouts(c.scores as any, weights as any) : { strengths: [], watchouts: [] };
  const flags = realRedFlags(c.red_flags); // events and conduct only (team rule)
  const openRoles = hp?.total_open ?? 0;
  const r = est.result;

  const TABS: [Tab, string][] = [
    ["overview", "Overview"],
    ["scorecard", "Scorecard"],
    ["equity", "Equity & comp"],
    ["hiring", `${personalized ? "Fit & hiring" : "Hiring"}${openRoles ? ` (${openRoles})` : ""}`],
  ];

  return (
    <div className="detail">
      <button className="close" onClick={onClose} aria-label="Close">✕</button>
      <h2>{c.name}</h2>
      <div className="muted small">
        {[c.sector, c.stage, c.hq_city].filter(Boolean).join(" · ")}
        {c.domain && (
          <> · <a href={`https://${c.domain}`} target="_blank" rel="noreferrer">{c.domain}</a></>
        )}
      </div>
      {!c.is_seed && <div className="small" style={{ marginTop: 4 }}><span className="badge user">Added by a user</span> <span className="muted">not on the Rocketship List</span></div>}
      {onListsChange && <SaveToList companyId={c.id} lists={profile.lists ?? []} onChange={onListsChange} />}

      <nav className="ptabs" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`ptab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>
      {simOpen && <EquitySimulator c={c} initial={est.sim} onClose={() => setSimOpen(false)} />}

      {/* ================================================================ OVERVIEW */}
      {tab === "overview" && (
        <div className="ptab-body">
          {!evaluated ? (
            <div className="note">
              <b>Not scored yet.</b> {c.description}
            </div>
          ) : (
            <>
              {qi && (
                <div className="verdict" style={{ borderColor: qi.color }}>
                  <div>
                    <div className="vlabel muted small">The company, for any joiner</div>
                    <div className="vhead" style={{ color: qi.color }}>{qi.headline}</div>
                    <div className="small">{qi.detail}</div>
                  </div>
                  <QuadrantMini w={winning!} u={c.joiner_upside!} />
                </div>
              )}

              {personalized && personal ? (
                <ForYouCard personal={personal} profile={profile} upside={c.joiner_upside} onFit={() => setTab("hiring")} onProfile={onOpenProfile} />
              ) : (
                <div className="note small" style={{ marginBottom: 10 }}>
                  Want a personal ranking? <button className="linkbtn" onClick={onOpenProfile}>Tell us about you</button> and we'll add a For you score that blends these scores with how well the company fits you.
                </div>
              )}

              <Meter
                q="Will it win?"
                small={personalized}
                sub={<>Probability of Winning: 12 weighted concepts from LTV (market, PMF, moat, team…){customWeights ? ", with your weights" : ""}.</>}
                score={winning}
                onMore={() => setTab("scorecard")}
              />
              <Meter
                q="Is joining now a good deal?"
                small={personalized}
                sub="Joiner Upside: room for the valuation to grow, and how fast you'd grow there."
                score={c.joiner_upside}
                onMore={() => setTab("scorecard")}
              />
              {personalized && <div className="muted small" style={{ margin: "-4px 0 10px" }}>These two average into your Company score (above).</div>}

              <div className="hlgrid">
                <Highlights title="Strengths" items={hl.strengths} tone="good" onOpen={showCheck} pts={pts} />
                <Highlights title="Watch-outs" items={hl.watchouts} tone="bad" onOpen={showCheck} pts={pts} />
              </div>

              {flags.length > 0 && (
                <div className="flags">
                  <div className="hlt">Red flags</div>
                  {flags.map((f, i) => (
                    <div key={i} className="small" style={{ marginBottom: 4 }}>
                      <span className={`badge ${f.severity === "low" ? "" : "flag"}`}>{f.severity}</span> {f.detail}
                      {f.source && <> (<a href={f.source} target="_blank" rel="noreferrer">source</a>)</>}
                    </div>
                  ))}
                  <div className="muted small">
                    Red flags are events or conduct (leadership changes, layoffs, lawsuits, governance). {profile.red_flag_mode === "penalize"
                      ? "You chose to let them lower your For you score."
                      : "Shown, not scored: you decide how much they matter (Your profile → Red flags)."}
                  </div>
                </div>
              )}
            </>
          )}

          <button className="equitycard" onClick={() => (r ? setTab("equity") : setSimOpen(true))}>
            <span>💰 <b>Your total comp, estimated</b></span>
            {r ? (
              <>
                <span className="tc"><b>≈ {usd(r.totalCompPerYearUsd)}/yr</b></span>
                <span>{usd(est.sim.state.baseSalaryUsd)} salary + {usd(r.equityPerYearUsd)}/yr equity ({usd(r.expectedValueUsd)} over 4 years, probability-weighted)</span>
              </>
            ) : (
              <span>Enter a valuation to estimate the equity part</span>
            )}
            <span className="muted">{est.base.isAssumption ? "Salary assumed" : "Salary from posted pay"} · equity estimated · change the numbers ›</span>
          </button>

          {evaluated && (
            <>
              {c.summary && <p className="small" style={{ lineHeight: 1.5 }}>{c.summary}</p>}
              <div className="facts">
                <div><span className="muted">Phase</span><br />{c.ltv_phase ? PHASE_LABEL[c.ltv_phase] ?? c.ltv_phase : "—"}</div>
                <div><span className="muted">Headcount</span><br />{num(c.headcount)}{c.headcount_growth_pct != null && ` (${c.headcount_growth_pct > 0 ? "+" : ""}${Math.round(c.headcount_growth_pct)}%/yr)`}</div>
                <div><span className="muted">Raised</span><br />{usd(c.total_funding_usd)}</div>
                <div><span className="muted">Valuation</span><br />{usd(c.latest_post_money_usd)}{c.latest_post_money_usd != null && c.post_money_is_estimate ? " (estimate)" : ""}</div>
                <div><span className="muted">ARR</span><br />{c.arr_estimate_usd === 0 ? "Pre-revenue" : usd(c.arr_estimate_usd)}{c.arr_estimate_usd ? " (reported/estimated)" : ""}</div>
                <div><span className="muted">Work policy · Visas</span><br />{c.work_policy ?? "—"} · {c.sponsors_visas ?? "unknown"}</div>
              </div>
              <div className="small">
                <span className={`badge ${cov.level}`}>{cov.level} confidence</span> <span className="muted">{COVERAGE_TEXT[cov.level]}</span>
                {cov.reasons.length > 0 && (
                  <ul className="covreasons muted">
                    {cov.reasons.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                )}
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                Researched {c.facts_as_of ?? (c.evaluated_at ?? "").slice(0, 10)} · a snapshot, not live data
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================ SCORECARD */}
      {tab === "scorecard" && (
        <div className="ptab-body">
          {!evaluated ? (
            <div className="note">Not scored yet.</div>
          ) : (
            <>
              <h3 className="sect">Will it win? {Math.round(winning!)} / 100 <span className="muted small">({band(winning)})</span></h3>
              <div className="muted small" style={{ marginBottom: 6 }}>
                Weighted concepts from LTV{customWeights ? ", with your weights" : ""}. Each earns points up to its weight; together they add up to the score. Open one to see why.
              </div>
              {contrib.map((x) => {
                const d = DIMENSIONS.find((dd) => dd.key === x.key)!;
                const s = c.scores?.[x.key];
                if (!s) return null;
                const def = DEFAULT_WEIGHTS[x.key];
                return (
                  <CheckRow
                    key={x.key}
                    d={d}
                    s={s}
                    points={x.points}
                    open={openCheck === x.key}
                    weight={Math.round(x.weight * 10) / 10}
                    extra={customWeights && Math.abs(def - x.weight) >= 0.5 ? <> · team default weight {def}</> : null}
                  />
                );
              })}
              <div className="scoretotal small"><span>Total</span><b>{contrib.reduce((a, x) => a + x.points, 0).toFixed(1)} / 100</b></div>

              <h3 className="sect">Is joining now a good deal? {c.joiner_upside != null ? Math.round(c.joiner_upside) : "—"} / 100 <span className="muted small">({band(c.joiner_upside)})</span></h3>
              <div className="muted small" style={{ marginBottom: 6 }}>
                Two equal halves. A great company can still be a so-so deal if its success is already priced in.
              </div>
              {JOINER_DIMENSIONS.map((d) => {
                const s = c.scores?.[d.key];
                const x = jcontrib.find((j) => j.key === d.key);
                if (!s || !x) return null;
                return <CheckRow key={d.key} d={d} s={s} points={x.points} weight={Math.round(x.weight)} open={openCheck === d.key} />;
              })}
              <div className="muted small" style={{ marginTop: 8 }}>* low confidence: thin evidence, so it was pulled toward the middle.</div>
            </>
          )}
        </div>
      )}

      {/* ================================================================ EQUITY & COMP */}
      {tab === "equity" && (
        <div className="ptab-body">
          <div className="tcbox">
            <div className="muted small">Your total comp, estimated</div>
            <div className="tcbig">{r ? `≈ ${usd(r.totalCompPerYearUsd)}/yr` : "—"}</div>
            {r && (
              <div className="tcsplit small">
                <span><b>{usd(est.sim.state.baseSalaryUsd)}</b> salary</span>
                <span>+</span>
                <span><b>{usd(r.equityPerYearUsd)}</b>/yr equity</span>
                <span className="muted">({usd(r.expectedValueUsd)} over 4 years, probability-weighted; {usd(r.grantValueTodayUsd)} on paper today)</span>
              </div>
            )}
          </div>

          <div className="levers small">
            <label>
              <span className="title">Salary ($/yr)</span>
              <input type="number" step={5000} placeholder={String(Math.round(est.base.usd))} value={baseInput} onChange={(e) => setBaseInput(e.target.value)} />
              <span className="muted hint">{est.base.source}{est.base.isAssumption ? " (assumption)" : ""}</span>
            </label>
            <div>
              <span className="title">Equity grant</span>
              <div className="chips">
                {(["low", "mid", "high"] as const).map((k) => (
                  <button key={k} className={`chip ${!grantPctInput && grantLevel === k ? "on" : ""}`} onClick={() => { setGrantPctInput(""); setGrantLevel(k); }}>
                    {k === "low" ? "Small" : k === "mid" ? "Typical" : "Large"}
                  </button>
                ))}
              </div>
              <input type="number" step={0.005} placeholder="or your % from an offer, e.g. 0.05" value={grantPctInput} onChange={(e) => setGrantPctInput(e.target.value)} />
              <span className="muted hint">
                {grantPctInput ? "your offer" : `rule of thumb for this stage: ${fmtPct(est.lowPct)}–${fmtPct(est.highPct)} of the company`}
              </span>
            </div>
            <label>
              <span className="title">Valuation today ($M)</span>
              <input type="number" step={10} placeholder={est.sim.state.postMoneyUsd ? String(Math.round(est.sim.state.postMoneyUsd / 1e6)) : "enter one"} value={valInput} onChange={(e) => setValInput(e.target.value)} />
              <span className="muted hint">{valInput ? "your input" : est.sim.sources.valuation}</span>
            </label>
          </div>

          {r && (
            <>
              <h4 className="subsect">What your equity could be worth</h4>
              <table className="eqtable small">
                <thead><tr><th>Outcome</th><th>Odds</th><th>Exit value</th><th>Your equity</th></tr></thead>
                <tbody>
                  {r.equity.scenarios.map((x) => (
                    <tr key={x.label}><td>{x.label}</td><td>{Math.round(x.probability * 100)}%</td><td>{usd(x.exitValueUsd)}</td><td><b>{usd(x.netValueUsd)}</b></td></tr>
                  ))}
                </tbody>
              </table>
              <div className="muted small" style={{ marginTop: 4 }}>
                You'd own {fmtPct(r.grantPct)} of {c.name}{r.exerciseCostUsd > 0 ? `; exercising costs about ${usd(r.exerciseCostUsd)}` : ""}. Odds: {est.sim.sources.odds}.
              </div>
            </>
          )}
          <button className="btn" style={{ marginTop: 10 }} onClick={() => setSimOpen(true)}>Open the full simulator (future rounds, exit odds, vesting) →</button>
          <div className="muted small" style={{ marginTop: 6 }}>Rules of thumb, not market data or financial advice. Replace with a real offer when you have one.</div>
        </div>
      )}

      {/* ================================================================ FIT & HIRING */}
      {tab === "hiring" && (
        <div className="ptab-body">
          {personalized && personal && (
            <>
              <h3 className="sect">Fit to you: {personal.fit.score} / 100</h3>
              <div className="muted small" style={{ marginBottom: 6 }}>From your profile, with plain math (no AI). Every point traced to a preference.</div>
              {personal.fit.items.map((i) => (
                <div key={i.factor} className="fitrow small">
                  <span className="fitf">{FIT_LABEL[i.factor] ?? i.factor}</span>
                  <span className="muted">{i.reason}</span>
                  <b>{i.points}/{i.max}</b>
                </div>
              ))}
            </>
          )}
          {openRoles > 0 && hp ? (
            <div className="small">
              <h3 className="sect">{hp.total_open} open roles</h3>
              {hp.by_function.map((b: any) => (
                <div key={b.label} className="fnrow">
                  <span>{b.label}</span>
                  <span className="fnbar"><i style={{ width: `${(b.count / hp.total_open) * 100}%` }} /></span>
                  <b>{b.count}</b>
                </div>
              ))}
              {hp.focus && <div className="muted" style={{ marginTop: 6 }}>{hp.focus.read}</div>}
              {hp.salary_bands?.length > 0 && (
                <>
                  <h3 className="sect">Posted pay</h3>
                  {hp.salary_bands.map((b: any) => (
                    <div key={b.label}>{b.label}: {usd(b.min)}–{usd(b.max)} <span className="muted">({b.postings_with_pay} postings)</span></div>
                  ))}
                </>
              )}
              <div className="muted" style={{ marginTop: 6 }}>From the company's public job board, at the time of research.</div>
            </div>
          ) : (
            <div className="note" style={{ marginTop: 10 }}>
              We couldn't read {c.name}'s open roles automatically. We can read job boards hosted on Greenhouse, Lever,
              Ashby, Workable or SmartRecruiters; {c.name} {c.careers_url ? "lists its roles on its own careers page (below)" : "doesn't link to one we found"}.
            </div>
          )}
          {c.careers_url && <p className="small"><a href={c.careers_url} target="_blank" rel="noreferrer">See all roles on {c.name}'s careers page →</a></p>}
          <ReachOut c={c} schools={effectivePreferences(profile).schools ?? []} onOpenProfile={onOpenProfile} />
        </div>
      )}
    </div>
  );
}

/** "Who to reach out to": alumni searches on LinkedIn that the joiner runs themselves (we never scrape LinkedIn). */
function ReachOut({ c, schools, onOpenProfile }: { c: CompanyRow; schools: string[]; onOpenProfile?: () => void }) {
  const links = alumniLinks(c, schools);
  const exact = !!c.linkedin_slug;
  const ownSchools = links.length > 2;
  return (
    <div className="reach">
      <h3 className="sect">Who to reach out to</h3>
      <div className="muted small">Alumni who work at {c.name}, on LinkedIn. Opens in a new tab; you need to be signed in to LinkedIn.</div>
      <div className="reach-links">
        {links.map((l) => (
          <a key={l.school} className="reach-btn" href={l.url} target="_blank" rel="noreferrer">{l.label} at {c.name} ↗</a>
        ))}
      </div>
      <div className="muted small">
        {exact ? (
          <>Searches {c.name}'s own LinkedIn page (<a href={linkedinPageUrl(c.linkedin_slug)!} target="_blank" rel="noreferrer">linkedin.com/company/{c.linkedin_slug}</a>, linked from {c.domain ?? "its website"}), so everyone listed works there now.</>
        ) : (
          <>We couldn't find {c.name}'s LinkedIn page on its website, so this is a general LinkedIn search: check each person's current company.</>
        )}
        {!ownSchools && (
          <> Add your other schools{onOpenProfile ? <> in <button className="linkbtn" onClick={onOpenProfile}>your profile</button></> : " in your profile"} (or upload your résumé) to search those networks too.</>
        )}
      </div>
    </div>
  );
}

const FIT_LABEL: Record<string, string> = {
  roles: "Open roles",
  stage: "Stage",
  size: "Size",
  interests: "Interests",
  location: "Location",
  pay: "Pay",
  momentum: "Momentum",
};

const fmtPct = (x: number) => `${x.toFixed(x < 0.01 ? 3 : 2)}%`;
