"use client";
// Scorecard panel for one company: the scores (each one clickable to its breakdown), quadrant, coverage caveat, key
// facts, red flags, the LTV scorecard with each dimension's weight and points earned, the Joiner Upside breakdown
// with a first equity estimate, the fit to you, and hiring. Every number shows its source or is marked an estimate.
import { useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type { CompanyRow } from "@/lib/supabase-public";
import { DIMENSIONS, DEFAULT_WEIGHTS, JOINER_DIMENSIONS } from "@/lib/rubric";
import { contributions, joinerContributions } from "@/lib/scoring";
import { coverage } from "@/lib/coverage";
import { usd, num, scoreColor, quadrant, PHASE_LABEL } from "@/lib/display";
import { activeWeights, baseSalaryFor, effectivePreferences, isPersonalized } from "@/lib/personal";
import { defaultSim, runSim, grantPctFor } from "@/lib/simulator";
import type { Personal, ProfileState } from "@/lib/personal";
import EquitySimulator from "./EquitySimulator";

const LOW_GRADE = 2.5; // grades at or below this are highlighted as weak spots

type Dim = (typeof DIMENSIONS)[number];
type Grade = { score: number; confidence: string; rationale: string; sources: string[] };

function DimRow({ d, s, right, low }: { d: Dim; s: Grade; right: ReactNode; low: boolean }) {
  return (
    <div className={`dim ${low ? "lowgrade" : ""}`} title={d.courseAnchor}>
      <div className="top">
        <span>
          {d.label}
          {low && <span className="badge low" style={{ marginLeft: 6 }}>weak spot</span>}
        </span>
        <span>{right}</span>
      </div>
      <div className="bar">
        <div style={{ width: `${(s.score / 5) * 100}%`, background: scoreColor(((s.score - 1) / 4) * 100), opacity: s.confidence === "low" ? 0.45 : 1 }} />
      </div>
      <div className="why">
        {s.rationale}{" "}
        {s.sources?.slice(0, 2).map((u, i) => (
          <a key={i} href={u} target="_blank" rel="noreferrer">[{i + 1}]</a>
        ))}
      </div>
    </div>
  );
}

export default function CompanyPanel({
  c,
  onClose,
  profile,
  personal,
}: {
  c: CompanyRow;
  onClose: () => void;
  profile: ProfileState;
  personal: Personal | null;
}) {
  const cov = coverage(c);
  const winning = personal?.winning ?? c.composite;
  const quad = quadrant(winning, c.joiner_upside);
  const hp = c.hiring_profile;
  const evaluated = c.composite != null && !!c.scores;
  const personalized = isPersonalized(profile);
  const customWeights = profile.weights_source !== "default";
  const weights = activeWeights(profile);

  const winRef = useRef<HTMLDivElement>(null);
  const upRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const go = (r: RefObject<HTMLDivElement | null>) => r.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const [baseInput, setBaseInput] = useState<string>("");
  const [simOpen, setSimOpen] = useState(false);
  const prefs = effectivePreferences(profile);
  const eqRef = useRef<HTMLDivElement>(null);
  // One estimate, shared by this panel and the simulator: company-specific defaults (valuation, raised, stage judged
  // by traction, exit odds nudged by Probability of Winning, posted pay for your role).
  const est = useMemo(() => {
    const base = baseSalaryFor(c.hiring_profile, prefs, baseInput ? Number(baseInput) : null);
    const sim = defaultSim(
      {
        name: c.name, stage: c.stage, pmfScore: c.scores?.pmf?.score ?? null, winning: winning ?? null,
        latest_post_money_usd: c.latest_post_money_usd, post_money_is_estimate: c.post_money_is_estimate, total_funding_usd: c.total_funding_usd,
      },
      base,
    );
    const b = sim.sources.bucket;
    return {
      base,
      sim,
      result: sim.state.postMoneyUsd ? runSim(sim.state, b) : null,
      lowPct: grantPctFor({ ...sim.state, estimateLevel: "low" }, b),
      highPct: grantPctFor({ ...sim.state, estimateLevel: "high" }, b),
    };
  }, [c, prefs, baseInput, winning]);

  const contrib = evaluated ? contributions(c.scores as any, weights) : [];
  const jcontrib = evaluated ? joinerContributions(c.scores as any) : [];

  return (
    <div className="detail">
      <button className="close" onClick={onClose} aria-label="Close">✕</button>
      <h2>{c.name}</h2>
      {!c.is_seed && <div className="small" style={{ margin: "2px 0" }}><span className="badge user">Added by a user</span> <span className="muted">not on the Rocketship List</span></div>}
      <div className="muted small">
        {[c.sector, c.stage, c.hq_city].filter(Boolean).join(" · ")}
        {c.domain && (
          <> · <a href={`https://${c.domain}`} target="_blank" rel="noreferrer">{c.domain}</a></>
        )}
      </div>

      {/* Equity at a glance: easy to find, one click to the details */}
      <button className="equitycard" onClick={() => (evaluated ? go(eqRef) : setSimOpen(true))}>
        <span>💰 <b>Your equity, estimated</b></span>
        <span>
          {est.result ? (
            <>≈ <b>{usd(est.result.expectedValueUsd)}</b> expected over 4 yrs · {usd(est.result.totalCompPerYearUsd)}/yr with base</>
          ) : (
            "Enter a valuation to estimate"
          )}
        </span>
        <span className="muted">Based on a {usd(est.base.usd)} base{est.base.isAssumption ? " (assumed)" : ""} · see how ›</span>
      </button>
      {simOpen && <EquitySimulator c={c} initial={est.sim} onClose={() => setSimOpen(false)} />}

      {!evaluated ? (
        <p className="note" style={{ marginTop: 12 }}>
          Not evaluated yet. {c.description}
        </p>
      ) : (
        <>
          <div className={`kpis ${personalized ? "four" : ""}`}>
            <button className="kpi click" onClick={() => go(winRef)} title="See how this score is built">
              <div className="v" style={{ color: scoreColor(winning) }}>{Math.round(winning!)}</div>
              <div className="l">Probability of Winning{customWeights ? " (your weights)" : ""} ›</div>
            </button>
            <button className="kpi click" onClick={() => go(upRef)} title="See how this score is built, plus an equity estimate">
              <div className="v" style={{ color: scoreColor(c.joiner_upside) }}>{c.joiner_upside != null ? Math.round(c.joiner_upside) : "—"}</div>
              <div className="l">Joiner Upside ›</div>
            </button>
            {personalized && personal && (
              <button className="kpi click" onClick={() => go(fitRef)} title="See your fit breakdown">
                <div className="v" style={{ color: scoreColor(personal.personal) }}>{personal.personal != null ? Math.round(personal.personal) : "—"}</div>
                <div className="l">For you ›</div>
              </button>
            )}
            <div className="kpi">
              <div className="v" style={{ fontSize: 16, paddingTop: 4 }}>{quad ?? "—"}</div>
              <div className="l">Quadrant</div>
            </div>
          </div>

          <div className="small" style={{ marginBottom: 8 }}>
            <span className={`badge ${cov.level}`}>{cov.level} data coverage</span>
            {cov.reasons.length > 0 && <span className="muted"> · {cov.reasons.join(", ")}</span>}
          </div>

          {c.summary && <p style={{ fontSize: 14, lineHeight: 1.5 }}>{c.summary}</p>}

          <div className="facts">
            <div><span className="muted">Phase</span><br />{c.ltv_phase ? PHASE_LABEL[c.ltv_phase] ?? c.ltv_phase : "—"}</div>
            <div><span className="muted">Headcount</span><br />{num(c.headcount)}{c.headcount_growth_pct != null && ` (${c.headcount_growth_pct > 0 ? "+" : ""}${Math.round(c.headcount_growth_pct)}%/yr)`}</div>
            <div><span className="muted">Raised</span><br />{usd(c.total_funding_usd)}</div>
            <div><span className="muted">Valuation</span><br />{usd(c.latest_post_money_usd)}{c.latest_post_money_usd != null && c.post_money_is_estimate ? " (estimate)" : ""}</div>
            <div><span className="muted">ARR</span><br />{usd(c.arr_estimate_usd)}{c.arr_estimate_usd != null ? " (reported/estimated)" : ""}</div>
            <div><span className="muted">Work policy · Visas</span><br />{c.work_policy ?? "—"} · {c.sponsors_visas ?? "unknown"}</div>
          </div>
          <div className="muted small">Data as of {c.facts_as_of ?? (c.evaluated_at ?? "").slice(0, 10)} · snapshot, not live</div>

          {(c.red_flags ?? []).length > 0 && (
            <>
              <h3 className="sect">Red flags</h3>
              {(c.red_flags ?? []).map((f, i) => (
                <div key={i} className="small" style={{ marginBottom: 4 }}>
                  <span className={`badge ${f.severity === "low" ? "" : "flag"}`}>{f.severity}</span> {f.detail}
                  {f.source && <> (<a href={f.source} target="_blank" rel="noreferrer">source</a>)</>}
                </div>
              ))}
              <div className="muted small">
                {profile.red_flag_mode === "penalize"
                  ? "You chose to penalize red flags: they lower this company's For you score."
                  : "Shown, not scored: you decide how much they matter (Your profile → Red flags)."}
              </div>
            </>
          )}

          {/* ------------------------------------------------ Probability of Winning: weights × grades = points */}
          <div ref={winRef} />
          <h3 className="sect">Probability of Winning: {Math.round(winning!)} / 100</h3>
          <div className="muted small" style={{ marginBottom: 6 }}>
            Each dimension is graded 1–5 and earns up to its weight in points (5 = full points, 3 = half, 1 = none).
            Low-confidence grades are pulled toward 3. {customWeights ? "Using your weights; the team default is shown in grey." : "Using the team's LTV default weights."}
          </div>
          <div className="scorehead small muted"><span>Dimension</span><span>Grade</span><span>Points / weight</span></div>
          {contrib.map((x) => {
            const d = DIMENSIONS.find((dd) => dd.key === x.key)!;
            const s = c.scores?.[x.key];
            if (!s) return null;
            const def = DEFAULT_WEIGHTS[x.key];
            return (
              <DimRow
                key={x.key}
                d={d}
                s={s}
                low={s.score <= LOW_GRADE}
                right={
                  <>
                    <b>{s.score}</b>/5 <span className="muted">· {s.confidence}</span>
                    <span className="pts">
                      <b>{x.points.toFixed(1)}</b> / {x.weight.toFixed(x.weight % 1 ? 1 : 0)}
                      {customWeights && Math.abs(def - x.weight) >= 0.5 && <span className="muted"> (default {def})</span>}
                    </span>
                  </>
                }
              />
            );
          })}
          <div className="scoretotal small">
            <span>Total</span>
            <b>{contrib.reduce((a, x) => a + x.points, 0).toFixed(1)} / 100</b>
          </div>

          {/* ------------------------------------------------ Joiner Upside: two dimensions, 50/50, + equity */}
          <div ref={upRef} />
          <h3 className="sect">Joiner Upside: {c.joiner_upside != null ? Math.round(c.joiner_upside) : "—"} / 100</h3>
          <div className="muted small" style={{ marginBottom: 6 }}>
            Is joining at today's price and stage a good deal for you? Two equal halves: how much room the valuation has
            to grow, and how fast you'd grow there. A great company can still be a so-so deal for a joiner.
          </div>
          {JOINER_DIMENSIONS.map((d) => {
            const s = c.scores?.[d.key];
            const x = jcontrib.find((j) => j.key === d.key);
            if (!s || !x) return null;
            return (
              <DimRow
                key={d.key}
                d={d}
                s={s}
                low={s.score <= LOW_GRADE}
                right={
                  <>
                    <b>{s.score}</b>/5 <span className="muted">· {s.confidence}</span>
                    <span className="pts"><b>{x.points.toFixed(1)}</b> / {Math.round(x.weight)}</span>
                  </>
                }
              />
            );
          })}

          <div ref={eqRef} />
          <h4 className="subsect">Your equity, estimated</h4>
          <EquityEstimate c={c} est={est} baseInput={baseInput} setBaseInput={setBaseInput} openSim={() => setSimOpen(true)} />
        </>
      )}

      {/* ------------------------------------------------ Fit to you (plain math, every point traced) */}
      {personalized && personal && (
        <>
          <div ref={fitRef} />
          <h3 className="sect">Fit to you: {personal.fit.score} / 100</h3>
          <div className="muted small" style={{ marginBottom: 6 }}>
            From your profile, with plain math (no AI). For you = {Math.round(profile.blend * 100)}% company quality + {Math.round((1 - profile.blend) * 100)}% fit
            {profile.red_flag_mode === "penalize" ? ", minus red-flag penalties" : ""}.
          </div>
          {personal.fit.items.map((i) => (
            <div key={i.factor} className="fitrow small">
              <span className="fitf">{FIT_LABEL[i.factor] ?? i.factor}</span>
              <span className="muted">{i.reason}</span>
              <b>{i.points}/{i.max}</b>
            </div>
          ))}
        </>
      )}

      {hp && hp.total_open > 0 && (
        <>
          <h3 className="sect">Hiring now</h3>
          <div className="small">
            {hp.total_open} open roles: {hp.by_function.map((b: any) => `${b.label} ${b.count}`).join(", ")}
            {hp.focus && <div className="muted" style={{ marginTop: 4 }}>{hp.focus.read}</div>}
            {hp.salary_bands?.length > 0 && (
              <div style={{ marginTop: 4 }}>
                Posted pay:{" "}
                {hp.salary_bands.map((b: any) => `${b.label} ${usd(b.min)}–${usd(b.max)}`).join("; ")}
              </div>
            )}
          </div>
        </>
      )}
      {c.careers_url && (
        <p className="small"><a href={c.careers_url} target="_blank" rel="noreferrer">Careers page →</a></p>
      )}
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

/** The estimate as it stands: only base salary needs editing; everything else has company-specific defaults. */
function EquityEstimate({
  c,
  est,
  baseInput,
  setBaseInput,
  openSim,
}: {
  c: CompanyRow;
  est: {
    base: { usd: number; source: string; isAssumption: boolean };
    sim: ReturnType<typeof defaultSim>;
    result: ReturnType<typeof runSim> | null;
    lowPct: number;
    highPct: number;
  };
  baseInput: string;
  setBaseInput: (v: string) => void;
  openSim: () => void;
}) {
  const r = est.result;
  const st = est.sim.state;
  return (
    <div className="equity small">
      <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        <span>Base salary</span>
        <input type="number" className="baseinput" placeholder={String(Math.round(est.base.usd))} value={baseInput} onChange={(e) => setBaseInput(e.target.value)} />
        <span className="muted">
          {usd(est.base.usd)}: {est.base.source}
          {est.base.isAssumption && <span className="badge medium" style={{ marginLeft: 4 }}>assumption</span>}
        </span>
      </div>
      {!r ? (
        <div className="note">No valuation found for {c.name}. <button className="linkbtn" onClick={openSim}>Enter one</button> to estimate your equity.</div>
      ) : (
        <>
          <div className="facts" style={{ margin: "4px 0 8px" }}>
            <div><span className="muted">Likely grant (estimate)</span><br />{fmtPct(est.lowPct)}–{fmtPct(est.highPct)} of the company</div>
            <div><span className="muted">Paper value today (mid)</span><br />{usd(r.grantValueTodayUsd)} over 4 years</div>
            <div><span className="muted">Instrument</span><br />{st.instrument}{r.exerciseCostUsd > 0 ? ` · ~${usd(r.exerciseCostUsd)} to exercise` : ""}</div>
            <div><span className="muted">Expected value (probability-weighted)</span><br /><b>{usd(r.expectedValueUsd)}</b> · ≈{usd(r.totalCompPerYearUsd)}/yr with base</div>
          </div>
          <table className="eqtable">
            <thead><tr><th>Outcome</th><th>Odds</th><th>Exit value</th><th>Your stake</th></tr></thead>
            <tbody>
              {r.equity.scenarios.map((x) => (
                <tr key={x.label}><td>{x.label}</td><td>{Math.round(x.probability * 100)}%</td><td>{usd(x.exitValueUsd)}</td><td>{usd(x.netValueUsd)}</td></tr>
              ))}
            </tbody>
          </table>
          <details style={{ marginTop: 6 }}>
            <summary className="muted">Where these numbers come from</summary>
            <ul className="assumptions">
              <li>Valuation {usd(st.postMoneyUsd)}: {est.sim.sources.valuation}.</li>
              <li>Investor preference {usd(st.preferenceUsd)}: {est.sim.sources.preference}.</li>
              <li>Stage treated as {est.sim.sources.bucket} (judged by traction, not just the round name).</li>
              <li>Grant: 4-year grant worth {est.sim.sources.bucket === "early" ? "1–2.5x" : est.sim.sources.bucket === "mid" ? "0.5–1.5x" : "0.3–0.9x"} base at today's price (rule of thumb, midpoint used).</li>
              <li>Future rounds: {st.rounds.map((x) => `${x.name} (${Math.round(x.dilution * 100)}% dilution, ${x.stepUp}x)`).join(", ") || "none"}.</li>
              <li>Exit odds: {est.sim.sources.odds}.</li>
              <li>4-year vesting, 1-year cliff, you stay all 4 years. Taxes ignored.</li>
            </ul>
          </details>
        </>
      )}
      <button className="btn" style={{ marginTop: 8 }} onClick={openSim}>Change other assumptions →</button>
      <div className="muted" style={{ marginTop: 4 }}>Rules of thumb, not market data or financial advice. Replace with a real offer when you have one.</div>
    </div>
  );
}
