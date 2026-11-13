"use client";
// Equity simulator: change any assumption behind an offer (grant, valuation, future rounds, exit odds, how long you
// stay) and see your stake, the financing path and the payout in each outcome. Starts from the company's data with
// every source shown. Illustrative only, not financial or tax advice.
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import type { CompanyRow } from "@/lib/supabase-public";
import { defaultSim, runSim } from "@/lib/simulator";
import type { SimState } from "@/lib/simulator";
import { baseSalaryFor } from "@/lib/personal";
import type { Preferences } from "@/lib/filters";
import { usd } from "@/lib/display";

const OUTCOME_COLOR: Record<string, string> = { Bust: "#dc2626", Modest: "#d97706", Base: "#65a30d", Rocketship: "#15803d" };

export default function EquitySimulator({ c, prefs, onClose }: { c: CompanyRow; prefs: Preferences; onClose: () => void }) {
  const initial = useMemo(
    () =>
      defaultSim(
        {
          name: c.name,
          stage: c.stage,
          pmfScore: c.scores?.pmf?.score ?? null,
          latest_post_money_usd: c.latest_post_money_usd,
          post_money_is_estimate: c.post_money_is_estimate,
          total_funding_usd: c.total_funding_usd,
        },
        baseSalaryFor(c.hiring_profile, prefs),
      ),
    [c, prefs],
  );
  const [s, setS] = useState<SimState>(initial.state);
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const set = (patch: Partial<SimState>, key: string) => {
    setS((p) => ({ ...p, ...patch }));
    setEdited((e) => new Set(e).add(key));
  };
  const src = (key: string, def: string) => (edited.has(key) ? "your input" : def);
  const r = useMemo(() => runSim(s, initial.sources.bucket), [s, initial.sources.bucket]);
  const probSum = s.scenarios.reduce((a, x) => a + Math.max(0, x.probability), 0);
  const chart = r.equity.scenarios.map((x) => ({ label: x.label, value: x.netValueUsd, odds: Math.round(x.probability * 100) }));

  return (
    <div className="modalback" onClick={onClose}>
      <div className="modal sim" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Equity simulator">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <strong style={{ fontSize: 17 }}>Equity simulator: {c.name}</strong>
            <div className="muted small">Change any assumption; results update instantly. Illustrative only, not financial or tax advice. Taxes ignored.</div>
          </div>
          <div className="row">
            <button className="btn ghost" onClick={() => { setS(initial.state); setEdited(new Set()); }}>Reset to estimate</button>
            <button className="close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="simgrid">
          {/* ------------------------------------------------ inputs */}
          <div className="siminputs small">
            <h4>Your offer</h4>
            <div className="chips">
              {([["estimate", "Estimate it for me"], ["percent", "I know my %"], ["shares", "I know my shares"]] as const).map(([k, l]) => (
                <button key={k} className={`chip ${s.offerMode === k ? "on" : ""}`} onClick={() => set({ offerMode: k }, "offer")}>{l}</button>
              ))}
            </div>
            <Field label="Base salary ($)" hint={src("base", initial.sources.base)}>
              <input type="number" step={5000} value={s.baseSalaryUsd} onChange={(e) => set({ baseSalaryUsd: Number(e.target.value) }, "base")} />
            </Field>
            {s.offerMode === "estimate" && (
              <Field label="Grant size" hint={`Rule of thumb for a ${initial.sources.bucket}-stage company: 4-year grant worth this multiple of base at today's price. Not market data.`}>
                <div className="chips">
                  {(["low", "mid", "high"] as const).map((k) => (
                    <button key={k} className={`chip ${s.estimateLevel === k ? "on" : ""}`} onClick={() => set({ estimateLevel: k }, "grant")}>{k}</button>
                  ))}
                </div>
              </Field>
            )}
            {s.offerMode === "percent" && (
              <Field label="Grant (% of fully diluted shares)" hint="From your offer letter, e.g. 0.05">
                <input type="number" step={0.005} value={s.grantPct} onChange={(e) => set({ grantPct: Number(e.target.value) }, "grant")} />
              </Field>
            )}
            {s.offerMode === "shares" && (
              <>
                <Field label="Shares in your grant">
                  <input type="number" step={1000} value={s.shares} onChange={(e) => set({ shares: Number(e.target.value) }, "grant")} />
                </Field>
                <Field label="Fully diluted shares outstanding" hint="Ask the company: you need this to know your %">
                  <input type="number" step={1000000} value={s.fullyDilutedShares} onChange={(e) => set({ fullyDilutedShares: Number(e.target.value) }, "grant")} />
                </Field>
                {s.instrument === "options" && (
                  <Field label="Strike price per share ($)">
                    <input type="number" step={0.01} value={s.strikeUsd} onChange={(e) => set({ strikeUsd: Number(e.target.value) }, "grant")} />
                  </Field>
                )}
              </>
            )}
            <Field label="Instrument" hint={src("instrument", s.instrument === "RSUs" ? "late-stage companies usually grant RSUs" : "earlier-stage companies usually grant options")}>
              <div className="chips">
                {(["options", "RSUs"] as const).map((k) => (
                  <button key={k} className={`chip ${s.instrument === k ? "on" : ""}`} onClick={() => set({ instrument: k }, "instrument")}>{k}</button>
                ))}
              </div>
            </Field>
            <Field label={`Years you stay: ${s.yearsStay}`} hint="4-year vesting, 1-year cliff: leave before a year and you get nothing">
              <input className="range" type="range" min={0.5} max={4} step={0.5} value={s.yearsStay} onChange={(e) => set({ yearsStay: Number(e.target.value) }, "years")} />
            </Field>

            <h4>The company today</h4>
            <Field label="Valuation today ($M)" hint={src("valuation", initial.sources.valuation)}>
              <input type="number" step={10} value={Math.round(s.postMoneyUsd / 1e6)} onChange={(e) => set({ postMoneyUsd: Number(e.target.value) * 1e6 }, "valuation")} />
            </Field>
            <Field label="Investor preference ahead of you ($M)" hint={src("pref", initial.sources.preference)}>
              <input type="number" step={10} value={Math.round(s.preferenceUsd / 1e6)} onChange={(e) => set({ preferenceUsd: Number(e.target.value) * 1e6 }, "pref")} />
            </Field>

            <h4>Future funding rounds</h4>
            <div className="muted">Each round raises the valuation (step-up) and dilutes you. In each outcome, only rounds priced below the exit are assumed to happen.</div>
            <div className="roundhead"><span>Round</span><span>Step-up (x)</span><span>Dilution %</span><span /></div>
            {s.rounds.map((rd, i) => (
              <div className="roundrow" key={i}>
                <input type="text" value={rd.name} onChange={(e) => set({ rounds: s.rounds.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }, "rounds")} />
                <input type="number" step={0.1} value={rd.stepUp} onChange={(e) => set({ rounds: s.rounds.map((x, j) => (j === i ? { ...x, stepUp: Number(e.target.value) } : x)) }, "rounds")} />
                <input type="number" step={1} value={Math.round(rd.dilution * 100)} onChange={(e) => set({ rounds: s.rounds.map((x, j) => (j === i ? { ...x, dilution: Number(e.target.value) / 100 } : x)) }, "rounds")} />
                <button className="linkbtn" aria-label="Remove round" onClick={() => set({ rounds: s.rounds.filter((_, j) => j !== i) }, "rounds")}>✕</button>
              </div>
            ))}
            <button className="linkbtn" onClick={() => set({ rounds: [...s.rounds, { name: `Round ${s.rounds.length + 1}`, stepUp: 1.5, dilution: 0.1 }] }, "rounds")}>+ Add a round</button>

            <h4>How it could end</h4>
            <div className="muted">Exit value as a multiple of today's valuation, and the odds of each. Defaults are {initial.sources.bucket}-stage rules of thumb.</div>
            <div className="roundhead"><span>Outcome</span><span>Exit (x today)</span><span>Odds %</span><span /></div>
            {s.scenarios.map((sc, i) => (
              <div className="roundrow" key={i}>
                <input type="text" value={sc.label} onChange={(e) => set({ scenarios: s.scenarios.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }, "scen")} />
                <input type="number" step={0.5} value={sc.multiple} onChange={(e) => set({ scenarios: s.scenarios.map((x, j) => (j === i ? { ...x, multiple: Number(e.target.value) } : x)) }, "scen")} />
                <input type="number" step={1} value={sc.probability} onChange={(e) => set({ scenarios: s.scenarios.map((x, j) => (j === i ? { ...x, probability: Number(e.target.value) } : x)) }, "scen")} />
                <span />
              </div>
            ))}
            {probSum !== 100 && <div className="muted">Odds add up to {probSum}%; they're scaled to 100%.</div>}
            <Field label={`Investors' share of the company at exit: ${Math.round(s.preferredOwnershipAtExit * 100)}%`} hint="Decides when investors convert to common instead of taking their preference">
              <input className="range" type="range" min={20} max={90} step={5} value={Math.round(s.preferredOwnershipAtExit * 100)} onChange={(e) => set({ preferredOwnershipAtExit: Number(e.target.value) / 100 }, "prefown")} />
            </Field>
          </div>

          {/* ------------------------------------------------ results */}
          <div className="simresults">
            {!s.postMoneyUsd ? (
              <div className="note">Enter today's valuation to run the simulation.</div>
            ) : (
              <>
                <div className="kpis four">
                  <div className="kpi"><div className="v">{usd(r.expectedValueUsd)}</div><div className="l">Expected value of your equity (probability-weighted)</div></div>
                  <div className="kpi"><div className="v">{usd(r.equityPerYearUsd)}</div><div className="l">Equity per year stayed</div></div>
                  <div className="kpi"><div className="v">{usd(r.totalCompPerYearUsd)}</div><div className="l">Base + equity per year</div></div>
                  <div className="kpi"><div className="v">{usd(r.grantValueTodayUsd)}</div><div className="l">Full grant on paper today</div></div>
                </div>
                <div className="small" style={{ marginBottom: 8 }}>
                  You'd own <b>{fmtPct(r.vestedPct)}</b> of {c.name} after {s.yearsStay} year{s.yearsStay === 1 ? "" : "s"} ({Math.round(r.vestedFraction * 100)}% of a {fmtPct(r.grantPct)} grant)
                  {r.equity.financingPath.length > 1 && <>, diluted to <b>{fmtPct(r.equity.ownershipAtExitPct)}</b> if every round happens</>}.
                  {s.instrument === "options" && <> Exercising costs about <b>{usd(r.exerciseCostUsd)}</b>{s.offerMode !== "shares" && " (strike estimated from a typical 409A)"}.</>}
                  {r.breakEvenExitUsd != null && <> Your stake is worth something only above a <b>{usd(r.breakEvenExitUsd)}</b> exit.</>}
                </div>

                <h4 className="subsect">Your payout in each outcome</h4>
                <div style={{ height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e3de" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => usd(Number(v))} tick={{ fontSize: 11 }} width={60} />
                      <Tooltip formatter={(v: any) => usd(Number(v))} labelFormatter={(l: any) => `${l}`} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chart.map((d) => <Cell key={d.label} fill={OUTCOME_COLOR[d.label] ?? "#a41034"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <table className="eqtable small">
                  <thead><tr><th>Outcome</th><th>Odds</th><th>Exit value</th><th>Your %</th><th>Investors</th><th>You get</th></tr></thead>
                  <tbody>
                    {r.equity.scenarios.map((x) => (
                      <tr key={x.label}>
                        <td>{x.label}</td>
                        <td>{Math.round(x.probability * 100)}%</td>
                        <td>{usd(x.exitValueUsd)}</td>
                        <td>{fmtPct(x.ownershipAtExitPct)}</td>
                        <td className="muted">{x.exitValueUsd === 0 ? "—" : x.preferredConverted ? "convert" : "take preference first"}</td>
                        <td><b>{usd(x.netValueUsd)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {r.equity.financingPath.length > 1 && (
                  <>
                    <h4 className="subsect">Financing path if every round happens</h4>
                    <table className="eqtable small">
                      <thead><tr><th>Round</th><th>Valuation</th><th>Raised</th><th>Your %</th><th>On paper</th><th>Preference ahead</th></tr></thead>
                      <tbody>
                        {r.equity.financingPath.map((p) => (
                          <tr key={p.name}>
                            <td>{p.name}</td>
                            <td>{usd(p.postMoneyUsd)}</td>
                            <td>{p.raiseUsd ? usd(p.raiseUsd) : "—"}</td>
                            <td>{fmtPct(p.ownershipPct)}</td>
                            <td>{usd(p.paperValueUsd)}</td>
                            <td>{usd(p.preferenceUsd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                <div className="muted small" style={{ marginTop: 8 }}>
                  How it works: your stake shrinks with each round; in a sale, investors either take their money back first
                  (1x non-participating preference) or convert, whichever pays them more; you get your share of what's left,
                  minus the cost to exercise. Ask the company for your share count, fully diluted shares, strike and the
                  latest 409A to replace the estimates.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="simfield">
      <span className="title">{label}</span>
      {children}
      {hint && <span className="muted hint">{hint}</span>}
    </div>
  );
}

const fmtPct = (x: number) => `${x.toFixed(x < 0.01 ? 4 : x < 0.1 ? 3 : 2)}%`;
