"use client";
// Scorecard panel for one company: the scores (each one clickable to its breakdown), quadrant, coverage caveat, key
// facts, red flags, the LTV scorecard with each dimension's weight and points earned, the Joiner Upside breakdown
// with a first equity estimate, the fit to you, and hiring. Every number shows its source or is marked an estimate.
import { useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type { CompanyRow } from "@/lib/supabase-public";
import { DIMENSIONS, DEFAULT_WEIGHTS, JOINER_DIMENSIONS } from "@/lib/rubric";
import { contributions, joinerContributions } from "@/lib/scoring";
import { coverage } from "@/lib/coverage";
import { usd, num, scoreColor, quadrant, PHASE_LABEL } from "@/lib/display";
import { activeWeights, effectivePreferences, firstEquityEstimate, isPersonalized } from "@/lib/personal";
import type { Personal, ProfileState } from "@/lib/personal";

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
  const prefs = effectivePreferences(profile);
  const eq = evaluated ? firstEquityEstimate(c, prefs, baseInput ? Number(baseInput) : null) : null;

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

          <h4 className="subsect">First equity estimate (illustrative)</h4>
          {!eq ? (
            <div className="note">No valuation found for {c.name}, so the equity package can't be estimated yet.</div>
          ) : (
            <div className="equity small">
              <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                <span>Base salary</span>
                <input
                  type="number"
                  className="baseinput"
                  placeholder={String(Math.round(eq.base.usd))}
                  value={baseInput}
                  onChange={(e) => setBaseInput(e.target.value)}
                />
                <span className="muted">
                  {usd(eq.base.usd)}: {eq.base.source}
                  {eq.base.isAssumption && <span className="badge medium" style={{ marginLeft: 4 }}>assumption</span>}
                </span>
              </div>
              {eq.estimate.grant && (
                <div className="facts" style={{ margin: "4px 0 8px" }}>
                  <div><span className="muted">Likely grant (estimate)</span><br />{fmtPct(eq.estimate.grant.pct_low)}–{fmtPct(eq.estimate.grant.pct_high)} of the company</div>
                  <div><span className="muted">Paper value today (mid)</span><br />{usd(eq.estimate.grant.value_mid_usd)} over 4 years</div>
                  <div><span className="muted">Instrument</span><br />{eq.estimate.instrument}{eq.estimate.exercise_cost_usd > 0 ? ` · ~${usd(eq.estimate.exercise_cost_usd)} to exercise` : ""}</div>
                  <div><span className="muted">Expected value (probability-weighted)</span><br /><b>{usd(eq.estimate.equity?.expectedValueUsd)}</b>{eq.estimate.annualized_mid_usd ? ` · ≈${usd(eq.estimate.annualized_mid_usd)}/yr with base` : ""}</div>
                </div>
              )}
              {eq.estimate.equity && (
                <table className="eqtable">
                  <thead>
                    <tr><th>Outcome</th><th>Odds</th><th>Exit value</th><th>Your stake</th></tr>
                  </thead>
                  <tbody>
                    {eq.estimate.equity.scenarios.map((s) => (
                      <tr key={s.label}>
                        <td>{s.label}</td>
                        <td>{Math.round(s.probability * 100)}%</td>
                        <td>{usd(s.exitValueUsd)}</td>
                        <td>{usd(s.netValueUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <details style={{ marginTop: 6 }}>
                <summary className="muted">All assumptions ({eq.estimate.assumptions.length})</summary>
                <ul className="assumptions">
                  {eq.estimate.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </details>
              <div className="muted" style={{ marginTop: 4 }}>
                Rule-of-thumb grant sizes and stage-based exit odds, not market data or financial advice. Replace with a real offer when you have one.
              </div>
            </div>
          )}
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
