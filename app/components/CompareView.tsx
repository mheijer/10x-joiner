"use client";
// Compare two companies at a high level. Deliberately short: the verdict, the scores, a few facts and the top
// strength/watch-out for each. "Open full profile" hands off to the company panel for the detail and sources.
import type { ReactNode } from "react";
import type { CompanyRow } from "@/lib/supabase-public";
import type { Personal, ProfileState } from "@/lib/personal";
import { activeWeights, isPersonalized } from "@/lib/personal";
import { DIMENSIONS, realRedFlags } from "@/lib/rubric";
import { coverage } from "@/lib/coverage";
import { num, quadrant, scoreColor, strengthsAndWatchouts, usd, QUADRANT_INFO, PHASE_LABEL } from "@/lib/display";

const shortLabel = (key: string) => (DIMENSIONS.find((d) => d.key === key)?.label ?? key).split(/[,(&]/)[0].trim();

interface Side {
  c: CompanyRow;
  p: Personal | null;
}

type Cell = { text: ReactNode; score?: number | null };
interface Row {
  label: string;
  a: Cell;
  b: Cell;
  better?: boolean; // higher number is better: mark the winner
}

const score = (x: number | null | undefined): Cell => ({
  text: x == null ? "—" : <span className="pill" style={{ background: scoreColor(x) }}>{Math.round(x)}</span>,
  score: x ?? null,
});

export default function CompareView({ a, b, profile, onOpen, onClose }: { a: Side; b: Side; profile: ProfileState; onOpen: (id: string) => void; onClose: () => void }) {
  const personalized = isPersonalized(profile);
  const weights = activeWeights(profile) as Record<string, number>;

  const facts = (s: Side) => {
    const c = s.c;
    const winning = s.p?.winning ?? c.composite;
    const quad = quadrant(winning, c.joiner_upside);
    const hl = c.scores ? strengthsAndWatchouts(c.scores as any, weights, 2) : { strengths: [], watchouts: [] };
    const hp = c.hiring_profile;
    const flags = realRedFlags(c.red_flags);
    return { c, p: s.p, winning, quad, hl, hp, flags, cov: coverage(c) };
  };
  const A = facts(a);
  const B = facts(b);
  const both = (f: (x: typeof A) => Cell): [Cell, Cell] => [f(A), f(B)];
  const row = (label: string, f: (x: typeof A) => Cell, better = false): Row => {
    const [ca, cb] = both(f);
    return { label, a: ca, b: cb, better };
  };

  const rows: Row[] = [
    row("Verdict", (x) => ({ text: x.quad ? <><b>{x.quad}</b><div className="muted small">{QUADRANT_INFO[x.quad]?.detail}</div></> : "Not scored yet" })),
    ...(personalized ? [row("For you", (x) => score(x.p?.personal), true)] : []),
    row("Probability of Winning", (x) => score(x.winning), true),
    row("Joiner Upside", (x) => score(x.c.joiner_upside), true),
    ...(personalized ? [row("Fit to you", (x) => score(x.p?.fit.score), true)] : []),
    row("Stage", (x) => ({ text: [x.c.stage, x.c.ltv_phase ? PHASE_LABEL[x.c.ltv_phase] ?? x.c.ltv_phase : null].filter(Boolean).join(" · ") || "—" })),
    row("Total raised", (x) => ({ text: usd(x.c.total_funding_usd) })),
    row("Valuation", (x) => ({ text: <>{usd(x.c.latest_post_money_usd)}{x.c.latest_post_money_usd != null && x.c.post_money_is_estimate ? " (estimate)" : ""}</> })),
    row("Headcount", (x) => ({
      text: <>{num(x.c.headcount)}{x.c.headcount_growth_pct != null && ` (${x.c.headcount_growth_pct > 0 ? "+" : ""}${Math.round(x.c.headcount_growth_pct)}%/yr)`}</>,
    })),
    row("HQ · work policy", (x) => ({ text: [x.c.hq_city, x.c.work_policy].filter(Boolean).join(" · ") || "—" })),
    row("Hiring", (x) => ({
      text: x.hp?.total_open ? <>{x.hp.total_open} open roles{x.hp.focus ? <div className="muted small">Mostly {x.hp.focus.label}</div> : null}</> : "No public job board found",
    })),
    row("Top strengths", (x) => ({ text: x.hl.strengths.length ? x.hl.strengths.map((h) => shortLabel(h.key)).join(", ") : "—" })),
    row("Watch-outs", (x) => ({ text: x.hl.watchouts.length ? x.hl.watchouts.map((h) => shortLabel(h.key)).join(", ") : "—" })),
    row("Red flags", (x) => ({ text: x.flags.length ? <span className="badge flag">{x.flags.length} red flag{x.flags.length > 1 ? "s" : ""}</span> : "None found" })),
    row("Data confidence", (x) => ({ text: x.c.composite != null ? <span className={`badge ${x.cov.level}`}>{x.cov.level}</span> : "—" })),
  ];

  const win = (r: Row, side: "a" | "b") => {
    if (!r.better || r.a.score == null || r.b.score == null || Math.round(r.a.score) === Math.round(r.b.score)) return "";
    return (side === "a" ? r.a.score > r.b.score : r.b.score > r.a.score) ? "win" : "";
  };

  return (
    <div className="modalback" onClick={onClose}>
      <div className="modal cmp" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Compare ${a.c.name} and ${b.c.name}`}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>Compare</strong>
          <button className="linkbtn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <table className="cmptable">
          <thead>
            <tr>
              <th />
              <th>{a.c.name}</th>
              <th>{b.c.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="muted">{r.label}</td>
                <td className={win(r, "a")}>{r.a.text}</td>
                <td className={win(r, "b")}>{r.b.text}</td>
              </tr>
            ))}
            <tr>
              <td />
              <td><button className="btn" onClick={() => onOpen(a.c.id)}>Open {a.c.name} →</button></td>
              <td><button className="btn" onClick={() => onOpen(b.c.id)}>Open {b.c.name} →</button></td>
            </tr>
          </tbody>
        </table>
        <div className="muted small" style={{ marginTop: 8 }}>
          Scores are from our research{profile.weights_source !== "default" ? " with your weights" : ""}. Funding, valuation and headcount come from public sources at the time of research; "estimate" marks estimated values. Open either company for the reasoning and sources.
        </div>
      </div>
    </div>
  );
}
