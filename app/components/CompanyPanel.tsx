"use client";
// Scorecard panel for one company: the two scores, quadrant, coverage caveat, key facts, red flags, every LTV
// dimension with its grade, confidence and reasoning, and hiring. Every number shows its source or "estimate".
import type { CompanyRow } from "@/lib/supabase-public";
import { DIMENSIONS } from "@/lib/rubric";
import { coverage } from "@/lib/coverage";
import { usd, num, scoreColor, quadrant, PHASE_LABEL } from "@/lib/display";

export default function CompanyPanel({ c, onClose }: { c: CompanyRow; onClose: () => void }) {
  const cov = coverage(c);
  const quad = quadrant(c.composite, c.joiner_upside);
  const hp = c.hiring_profile;
  const evaluated = c.composite != null;

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

      {!evaluated ? (
        <p className="note" style={{ marginTop: 12 }}>
          Not evaluated yet. {c.description}
        </p>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi">
              <div className="v" style={{ color: scoreColor(c.composite) }}>{Math.round(c.composite!)}</div>
              <div className="l">Probability of Winning</div>
            </div>
            <div className="kpi">
              <div className="v" style={{ color: scoreColor(c.joiner_upside) }}>{c.joiner_upside != null ? Math.round(c.joiner_upside) : "—"}</div>
              <div className="l">Joiner Upside</div>
            </div>
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
              <h3 style={{ fontSize: 15, marginBottom: 4 }}>Red flags</h3>
              {(c.red_flags ?? []).map((f, i) => (
                <div key={i} className="small" style={{ marginBottom: 4 }}>
                  <span className={`badge ${f.severity === "low" ? "" : "flag"}`}>{f.severity}</span> {f.detail}
                  {f.source && <> (<a href={f.source} target="_blank" rel="noreferrer">source</a>)</>}
                </div>
              ))}
            </>
          )}

          <h3 style={{ fontSize: 15, marginBottom: 4 }}>LTV scorecard</h3>
          {DIMENSIONS.map((d) => {
            const s = c.scores?.[d.key];
            if (!s) return null;
            return (
              <div className="dim" key={d.key} title={d.courseAnchor}>
                <div className="top">
                  <span>{d.label}{d.group === "joiner" ? " (joiner)" : ""}</span>
                  <span><b>{s.score}</b>/5 <span className="muted">· {s.confidence}</span></span>
                </div>
                <div className="bar"><div style={{ width: `${(s.score / 5) * 100}%`, background: scoreColor(((s.score - 1) / 4) * 100), opacity: s.confidence === "low" ? 0.45 : 1 }} /></div>
                <div className="why">
                  {s.rationale}{" "}
                  {s.sources?.slice(0, 2).map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer">[{i + 1}]</a>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {hp && hp.total_open > 0 && (
        <>
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>Hiring now</h3>
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
