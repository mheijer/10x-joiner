"use client";
// Scatter: any two measures against each other. Default: Probability of Winning vs Joiner Upside, with the four
// quadrants (Pursue / Safe bet / Lottery ticket / Pass). With a profile, "For you" and "Fit to you" become axes too.
import { useState } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Cell, LabelList } from "recharts";
import type { CompanyRow } from "@/lib/supabase-public";
import { DIMENSIONS } from "@/lib/rubric";
import { scoreColor, usd } from "@/lib/display";

type Axis = { key: string; label: string; get: (c: CompanyRow) => number | null; domain: [number, number] | ["auto", "auto"] };

const BASE_AXES: Axis[] = [
  { key: "composite", label: "Probability of Winning", get: (c) => c.composite, domain: [0, 100] },
  { key: "joiner_upside", label: "Joiner Upside", get: (c) => c.joiner_upside, domain: [0, 100] },
  ...DIMENSIONS.map((d) => ({ key: d.key, label: d.label, get: (c: CompanyRow) => c.scores?.[d.key]?.score ?? null, domain: [1, 5] as [number, number] })),
  { key: "headcount", label: "Headcount", get: (c) => c.headcount, domain: ["auto", "auto"] },
  { key: "funding", label: "Total raised ($M)", get: (c) => (c.total_funding_usd != null ? c.total_funding_usd / 1e6 : null), domain: ["auto", "auto"] },
];

export default function ScatterView({
  companies,
  onSelect,
  personalAxes,
  colorOf,
}: {
  companies: CompanyRow[];
  onSelect: (id: string) => void;
  personalAxes?: { winning: (c: CompanyRow) => number | null; personal: (c: CompanyRow) => number | null; fit: (c: CompanyRow) => number | null } | null;
  colorOf: (c: CompanyRow) => number | null;
}) {
  const AXES: Axis[] = personalAxes
    ? [
        { key: "composite", label: "Probability of Winning (your weights)", get: personalAxes.winning, domain: [0, 100] },
        { key: "personal", label: "For you", get: personalAxes.personal, domain: [0, 100] },
        { key: "fit", label: "Fit to you", get: personalAxes.fit, domain: [0, 100] },
        ...BASE_AXES.filter((a) => a.key !== "composite"),
      ]
    : BASE_AXES;
  const [xKey, setX] = useState("composite");
  const [yKey, setY] = useState("joiner_upside");
  const x = AXES.find((a) => a.key === xKey) ?? AXES[0];
  const y = AXES.find((a) => a.key === yKey) ?? AXES[1];
  const quadrants = xKey === "composite" && yKey === "joiner_upside";

  // Many companies share exact scores (e.g. Joiner Upside 50), so identical points are spread by a tiny, fixed
  // amount (from the company id) to keep every dot visible. The tooltip always shows the exact scores.
  const nudge = (id: string, salt: number) => {
    let h = salt;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return ((h % 1000) / 1000 - 0.5) * 1.6; // within ±0.8 points
  };
  const points = companies
    .map((c) => ({ id: c.id, name: c.name, xr: x.get(c), yr: y.get(c), size: c.total_funding_usd ?? 0, color: scoreColor(colorOf(c)), raised: c.total_funding_usd }))
    .filter((p) => p.xr != null && p.yr != null)
    .map((p) => ({ ...p, x: (p.xr as number) + nudge(p.id, 7), y: (p.yr as number) + nudge(p.id, 13) }));
  // Name only the standouts (highest on both axes); hover any dot for its name and scores.
  const labeled = new Set([...points].sort((a, b) => (b.xr as number) + (b.yr as number) - ((a.xr as number) + (a.yr as number))).slice(0, 10).map((p) => p.id));

  return (
    <div className="scatterwrap">
      <div className="axisbar">
        <label className="small">X axis{" "}
          <select value={xKey} onChange={(e) => setX(e.target.value)}>
            {AXES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </label>
        <label className="small">Y axis{" "}
          <select value={yKey} onChange={(e) => setY(e.target.value)}>
            {AXES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </label>
        <span className="muted small">
          {points.length} companies plotted · bubble size = total raised · names on the 10 standouts; hover any dot · click for its scorecard
          {points.length < companies.length && ` · ${companies.length - points.length} without data for these axes`}
        </span>
      </div>
      <div style={{ minHeight: 0 }}>
        {points.length === 0 ? (
          <div className="empty">No evaluated companies match these filters yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 24, right: 40, bottom: 40, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e3de" />
              {/* An array, not a <>fragment</>: Recharts only renders reference areas that are direct children */}
              {quadrants && [
                <ReferenceArea key="q-pursue" x1={60} x2={100} y1={60} y2={100} fill="#f0fdf4" fillOpacity={0.7} ifOverflow="extendDomain" label={{ value: "Pursue", position: "insideTopRight", fill: "#166534", fontSize: 13 }} />,
                <ReferenceArea key="q-safe" x1={60} x2={100} y1={0} y2={60} fill="#eff6ff" fillOpacity={0.6} ifOverflow="extendDomain" label={{ value: "Safe bet", position: "insideBottomRight", fill: "#1e40af", fontSize: 13 }} />,
                <ReferenceArea key="q-lottery" x1={0} x2={60} y1={60} y2={100} fill="#fffbeb" fillOpacity={0.7} ifOverflow="extendDomain" label={{ value: "Lottery ticket", position: "insideTopLeft", fill: "#92400e", fontSize: 13 }} />,
                <ReferenceArea key="q-pass" x1={0} x2={60} y1={0} y2={60} fill="#f9fafb" fillOpacity={0.7} ifOverflow="extendDomain" label={{ value: "Pass", position: "insideBottomLeft", fill: "#6b7280", fontSize: 13 }} />,
                <ReferenceLine key="q-x" x={60} stroke="#bbb" />,
                <ReferenceLine key="q-y" y={60} stroke="#bbb" />,
              ]}
              <XAxis type="number" dataKey="x" name={x.label} domain={x.domain} label={{ value: x.label, position: "bottom", offset: 10 }} />
              <YAxis type="number" dataKey="y" name={y.label} domain={y.domain} label={{ value: y.label, angle: -90, position: "insideLeft", offset: 0 }} />
              <ZAxis type="number" dataKey="size" range={[40, 420]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  const p: any = payload?.[0]?.payload;
                  if (!p) return null;
                  return (
                    <div style={{ background: "#fff", border: "1px solid #e4e3de", borderRadius: 8, padding: "6px 10px", fontSize: 13 }}>
                      <b>{p.name}</b>
                      <div>{x.label}: {Math.round(p.xr * 10) / 10}</div>
                      <div>{y.label}: {Math.round(p.yr * 10) / 10}</div>
                      <div className="muted">Raised {usd(p.raised)}</div>
                    </div>
                  );
                }}
              />
              <Scatter data={points} onClick={(p: any) => onSelect(p.id ?? p.payload?.id)} cursor="pointer">
                {points.map((p) => <Cell key={p.id} fill={p.color} fillOpacity={0.78} stroke={p.color} strokeOpacity={0.9} strokeWidth={1} />)}
                <LabelList
                  dataKey="name"
                  content={(props: any) => {
                    const pt = points[props.index];
                    if (!pt || !labeled.has(pt.id)) return null;
                    return (
                      <text x={props.x + (props.width ?? 0) / 2} y={props.y - 4} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#1c1c1a" stroke="#ffffff" strokeWidth={3} paintOrder="stroke" style={{ pointerEvents: "none" }}>
                        {pt.name}
                      </text>
                    );
                  }}
                />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
