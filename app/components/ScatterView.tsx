"use client";
// Scatter: any two measures against each other. Default: Probability of Winning vs Joiner Upside, with the four
// quadrants (Pursue / Blue chip / Lottery ticket / Pass). Personal Fit becomes the default Y axis once profiles ship.
import { useState } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Cell, LabelList } from "recharts";
import type { CompanyRow } from "@/lib/supabase-public";
import { DIMENSIONS } from "@/lib/rubric";
import { scoreColor, usd } from "@/lib/display";

type Axis = { key: string; label: string; get: (c: CompanyRow) => number | null; domain: [number, number] | ["auto", "auto"] };

const AXES: Axis[] = [
  { key: "composite", label: "Probability of Winning", get: (c) => c.composite, domain: [0, 100] },
  { key: "joiner_upside", label: "Joiner Upside", get: (c) => c.joiner_upside, domain: [0, 100] },
  ...DIMENSIONS.map((d) => ({ key: d.key, label: d.label, get: (c: CompanyRow) => c.scores?.[d.key]?.score ?? null, domain: [1, 5] as [number, number] })),
  { key: "headcount", label: "Headcount", get: (c) => c.headcount, domain: ["auto", "auto"] },
  { key: "funding", label: "Total raised ($M)", get: (c) => (c.total_funding_usd != null ? c.total_funding_usd / 1e6 : null), domain: ["auto", "auto"] },
];

export default function ScatterView({ companies, onSelect }: { companies: CompanyRow[]; onSelect: (id: string) => void }) {
  const [xKey, setX] = useState("composite");
  const [yKey, setY] = useState("joiner_upside");
  const x = AXES.find((a) => a.key === xKey)!;
  const y = AXES.find((a) => a.key === yKey)!;
  const quadrants = xKey === "composite" && yKey === "joiner_upside";

  const points = companies
    .map((c) => ({ id: c.id, name: c.name, x: x.get(c), y: y.get(c), size: c.total_funding_usd ?? 0, color: scoreColor(c.composite), raised: c.total_funding_usd }))
    .filter((p) => p.x != null && p.y != null);

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
          {points.length} companies plotted · bubble size = total raised · click a bubble for its scorecard
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
              {quadrants && (
                <>
                  <ReferenceArea x1={60} x2={100} y1={60} y2={100} fill="#f0fdf4" fillOpacity={0.7} label={{ value: "Pursue", position: "insideTopRight", fill: "#166534", fontSize: 13 }} />
                  <ReferenceArea x1={60} x2={100} y1={0} y2={60} fill="#eff6ff" fillOpacity={0.6} label={{ value: "Blue chip", position: "insideBottomRight", fill: "#1e40af", fontSize: 13 }} />
                  <ReferenceArea x1={0} x2={60} y1={60} y2={100} fill="#fffbeb" fillOpacity={0.7} label={{ value: "Lottery ticket", position: "insideTopLeft", fill: "#92400e", fontSize: 13 }} />
                  <ReferenceArea x1={0} x2={60} y1={0} y2={60} fill="#f9fafb" fillOpacity={0.7} label={{ value: "Pass", position: "insideBottomLeft", fill: "#6b7280", fontSize: 13 }} />
                  <ReferenceLine x={60} stroke="#bbb" />
                  <ReferenceLine y={60} stroke="#bbb" />
                </>
              )}
              <XAxis type="number" dataKey="x" name={x.label} domain={x.domain} label={{ value: x.label, position: "bottom", offset: 10 }} />
              <YAxis type="number" dataKey="y" name={y.label} domain={y.domain} label={{ value: y.label, angle: -90, position: "insideLeft", offset: 0 }} />
              <ZAxis type="number" dataKey="size" range={[60, 700]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  const p: any = payload?.[0]?.payload;
                  if (!p) return null;
                  return (
                    <div style={{ background: "#fff", border: "1px solid #e4e3de", borderRadius: 8, padding: "6px 10px", fontSize: 13 }}>
                      <b>{p.name}</b>
                      <div>{x.label}: {Math.round(p.x * 10) / 10}</div>
                      <div>{y.label}: {Math.round(p.y * 10) / 10}</div>
                      <div className="muted">Raised {usd(p.raised)}</div>
                    </div>
                  );
                }}
              />
              <Scatter data={points} onClick={(p: any) => onSelect(p.id ?? p.payload?.id)} cursor="pointer">
                {points.map((p) => <Cell key={p.id} fill={p.color} fillOpacity={0.8} stroke="#fff" />)}
                <LabelList dataKey="name" position="top" style={{ fontSize: 12, fill: "#1c1c1a" }} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
