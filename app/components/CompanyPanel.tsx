"use client";
// Company panel, in four tabs so each question has one place:
//   Overview  — the verdict in plain English (quadrant + where it sits), each score as a question with a word,
//               top strengths and watch-outs, red flags, key facts, an equity summary
//   Scorecard — every LTV check: grade, what it earns toward the score, rationale and sources
//   Equity    — the first estimate (edit base salary) and the simulator for everything else
//   Hiring    — open roles by function, posted pay, careers page
// Every number shows its source or is marked an estimate.
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CompanyRow } from "@/lib/supabase-public";
import { DIMENSIONS, DEFAULT_WEIGHTS, JOINER_DIMENSIONS } from "@/lib/rubric";
import { contributions, joinerContributions } from "@/lib/scoring";
import { coverage } from "@/lib/coverage";
import { usd, num, scoreColor, quadrant, PHASE_LABEL, band, gradeWord, QUADRANT_INFO, strengthsAndWatchouts } from "@/lib/display";
import type { Highlight } from "@/lib/display";
import { activeWeights, baseSalaryFor, effectivePreferences, isPersonalized } from "@/lib/personal";
import { defaultSim, runSim, grantPctFor } from "@/lib/simulator";
import type { Personal, ProfileState } from "@/lib/personal";
import EquitySimulator from "./EquitySimulator";

type Tab = "overview" | "scorecard" | "equity" | "hiring";
type Dim = (typeof DIMENSIONS)[number];
type Grade = { score: number; confidence: string; rationale: string; sources: string[] };
const LOW_GRADE = 2.5;
const label = (key: string) => DIMENSIONS.find((d) => d.key === key)?.label ?? key;

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
        <text x={(mid + S - pad) / 2} y={(midY + S - pad) / 2 + 3} textAnchor="middle" fontSize="8.5" fill="#9a968c">Blue chip</text>
        <circle cx={x} cy={y} r="6" fill="var(--accent)" stroke="#fff" strokeWidth="2" />
        <text x={S / 2} y={S + 14} textAnchor="middle" fontSize="9" fill="#6b6860">Will it win? →</text>
      </g>
      <text x="10" y={S / 2} fontSize="9" fill="#6b6860" transform={`rotate(-90 10 ${S / 2})`} textAnchor="middle">Good deal to join? →</text>
    </svg>
  );
}

/** One score as a question, a number, a word and a bar (with the 60 line the quadrants use). */
function Meter({ q, sub, score, onMore, more }: { q: string; sub: string; score: number | null; onMore?: () => void; more?: string }) {
  return (
    <div className="meter">
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

function Highlights({ title, items, tone }: { title: string; items: Highlight[]; tone: "good" | "bad" }) {
  if (!items.length) return null;
  return (
    <div className={`hl ${tone}`}>
      <div className="hlt">{title}</div>
      {items.map((h) => (
        <div key={h.key} className="hli">
          <b>{label(h.key)}</b> <span className="muted">· {gradeWord(h.grade)} ({h.grade}/5{h.confidence === "low" ? ", low confidence" : ""})</span>
          <div className="small">{h.line}</div>
        </div>
      ))}
    </div>
  );
}

/** A graded check: name, grade as pips + word, points earned of its weight, rationale and sources. */
function CheckRow({ d, s, points, weight, extra }: { d: Dim; s: Grade; points: number; weight: number; extra?: ReactNode }) {
  const low = s.score <= LOW_GRADE;
  return (
    <details className={`check ${low ? "lowgrade" : ""}`}>
      <summary>
        <span className="checkname" title={d.question}>{d.label}</span>
        <span className="grade">
          <span className="pips" aria-label={`${s.score} of 5`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <i key={i} style={i <= Math.round(s.score) ? { background: scoreColor(((s.score - 1) / 4) * 100) } : undefined} />
            ))}
          </span>
          <span className="checkword">{gradeWord(s.score)}{s.confidence === "low" ? "*" : ""}</span>
        </span>
        <span className="checkpts"><b>{points.toFixed(1)}</b> of {weight % 1 ? weight.toFixed(1) : weight}</span>
      </summary>
      <div className="checkbody small">
        <div className="muted">{d.question}</div>
        <div style={{ marginTop: 4 }}>{s.rationale}</div>
        <div className="muted" style={{ marginTop: 4 }}>
          Confidence: {s.confidence}
          {s.sources?.length ? <> · Sources: {s.sources.slice(0, 4).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer">[{i + 1}]</a>)}</> : null}
          {extra}
        </div>
        <div className="muted" style={{ marginTop: 2 }}>Course link: {d.courseAnchor}</div>
      </div>
    </details>
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
  const [tab, setTab] = useState<Tab>("overview");
  const cov = coverage(c);
  const winning = personal?.winning ?? c.composite;
  const quad = quadrant(winning, c.joiner_upside);
  const qi = quad ? QUADRANT_INFO[quad] : null;
  const hp = c.hiring_profile;
  const evaluated = c.composite != null && !!c.scores;
  const personalized = isPersonalized(profile);
  const customWeights = profile.weights_source !== "default";
  const weights = activeWeights(profile);

  const [baseInput, setBaseInput] = useState<string>("");
  const [simOpen, setSimOpen] = useState(false);
  const prefs = effectivePreferences(profile);
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
  const hl = evaluated ? strengthsAndWatchouts(c.scores as any, weights as any) : { strengths: [], watchouts: [] };
  const flags = c.red_flags ?? [];
  const openRoles = hp?.total_open ?? 0;

  const TABS: [Tab, string][] = [
    ["overview", "Overview"],
    ["scorecard", "Scorecard"],
    ["equity", "Equity"],
    ["hiring", `${personalized ? "Hiring & fit" : "Hiring"}${openRoles ? ` (${openRoles})` : ""}`],
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
                    <div className="vlabel muted small">Our read for a joiner</div>
                    <div className="vhead" style={{ color: qi.color }}>{qi.headline}</div>
                    <div className="small">{qi.detail}</div>
                  </div>
                  <QuadrantMini w={winning!} u={c.joiner_upside!} />
                </div>
              )}

              <Meter
                q="Will it win?"
                sub={`Probability of Winning: 12 LTV checks (market, PMF, moat, team…)${customWeights ? ", with your weights" : ""}.`}
                score={winning}
                onMore={() => setTab("scorecard")}
              />
              <Meter
                q="Is joining now a good deal?"
                sub="Joiner Upside: room for the valuation to grow, and how fast you'd grow there."
                score={c.joiner_upside}
                onMore={() => setTab("scorecard")}
              />
              {personalized && personal && (
                <Meter
                  q="How well does it fit you?"
                  sub={`For you: ${Math.round(profile.blend * 100)}% company quality + ${Math.round((1 - profile.blend) * 100)}% fit to your profile (fit ${personal.fit.score}/100).`}
                  score={personal.personal}
                  onMore={() => setTab("hiring")}
                  more="Your fit"
                />
              )}

              <div className="hlgrid">
                <Highlights title="Strengths" items={hl.strengths} tone="good" />
                <Highlights title="Watch-outs" items={hl.watchouts} tone="bad" />
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
                    {profile.red_flag_mode === "penalize"
                      ? "You chose to let red flags lower your For you score."
                      : "Shown, not scored: you decide how much they matter (Your profile → Red flags)."}
                  </div>
                </div>
              )}
            </>
          )}

          <button className="equitycard" onClick={() => (est.result ? setTab("equity") : setSimOpen(true))}>
            <span>💰 <b>Your equity, estimated</b></span>
            <span>
              {est.result ? (
                <>≈ <b>{usd(est.result.expectedValueUsd)}</b> expected over 4 yrs · {usd(est.result.totalCompPerYearUsd)}/yr with base</>
              ) : (
                "Enter a valuation to estimate"
              )}
            </span>
            <span className="muted">Based on a {usd(est.base.usd)} base{est.base.isAssumption ? " (assumed)" : ""} · details ›</span>
          </button>

          {evaluated && (
            <>
              {c.summary && <p className="small" style={{ lineHeight: 1.5 }}>{c.summary}</p>}
              <div className="facts">
                <div><span className="muted">Phase</span><br />{c.ltv_phase ? PHASE_LABEL[c.ltv_phase] ?? c.ltv_phase : "—"}</div>
                <div><span className="muted">Headcount</span><br />{num(c.headcount)}{c.headcount_growth_pct != null && ` (${c.headcount_growth_pct > 0 ? "+" : ""}${Math.round(c.headcount_growth_pct)}%/yr)`}</div>
                <div><span className="muted">Raised</span><br />{usd(c.total_funding_usd)}</div>
                <div><span className="muted">Valuation</span><br />{usd(c.latest_post_money_usd)}{c.latest_post_money_usd != null && c.post_money_is_estimate ? " (estimate)" : ""}</div>
                <div><span className="muted">ARR</span><br />{usd(c.arr_estimate_usd)}{c.arr_estimate_usd != null ? " (reported/estimated)" : ""}</div>
                <div><span className="muted">Work policy · Visas</span><br />{c.work_policy ?? "—"} · {c.sponsors_visas ?? "unknown"}</div>
              </div>
              <div className="small">
                <span className={`badge ${cov.level}`}>{cov.level} confidence</span> <span className="muted">{COVERAGE_TEXT[cov.level]}</span>
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
              <div className="howto small">
                <b>How to read this.</b> Each check is graded 1–5 from public evidence. A 5 earns the check's full
                points, a 3 earns half, a 1 earns none; the points add up to the score. Weak grades are highlighted;
                * = low confidence (pulled toward 3). Tap a check for the reasoning and sources.
              </div>

              <h3 className="sect">Will it win? {Math.round(winning!)} / 100 <span className="muted small">({band(winning)})</span></h3>
              <div className="muted small" style={{ marginBottom: 6 }}>
                {customWeights ? "Using your weights; changed checks show the team default." : "Using the team's LTV default weights."}
              </div>
              <div className="checkhead small muted"><span>Check</span><span>Grade</span><span>Points earned</span></div>
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
                return <CheckRow key={d.key} d={d} s={s} points={x.points} weight={Math.round(x.weight)} />;
              })}
            </>
          )}
        </div>
      )}

      {/* ================================================================ EQUITY */}
      {tab === "equity" && (
        <div className="ptab-body">
          <EquityEstimate c={c} est={est} baseInput={baseInput} setBaseInput={setBaseInput} openSim={() => setSimOpen(true)} />
        </div>
      )}

      {/* ================================================================ HIRING (+ your fit) */}
      {tab === "hiring" && (
        <div className="ptab-body">
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
            <div className="note">No public job board found for {c.name}.</div>
          )}
          {c.careers_url && <p className="small"><a href={c.careers_url} target="_blank" rel="noreferrer">Careers page →</a></p>}

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
        </div>
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
