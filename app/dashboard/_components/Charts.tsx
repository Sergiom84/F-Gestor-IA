"use client";
// GFiscal — lightweight inline SVG charts (no external chart lib).
// Drop into app/dashboard/_components/. All colours come from CSS vars set by
// theme-fintech.css, so they follow the active brand palette automatically.

import { useId } from "react";

/* ---- KPI sparkline ---- */
export function Sparkline({ data, color }: { data: number[]; color: string }) {
  const safeData = data.length > 1 ? data : [0, data[0] ?? 0];
  const w = 84, h = 30, p = 3;
  const min = Math.min(...safeData), max = Math.max(...safeData), rng = max - min || 1;
  const pts: Array<[number, number]> = safeData.map((v, i) => [
    p + i * ((w - 2 * p) / (safeData.length - 1)),
    h - p - ((v - min) / rng) * (h - 2 * p),
  ]);
  const line = pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
  const first = pts[0] ?? [0, h];
  const last = pts[pts.length - 1] ?? first;
  const area = `${line} L ${last[0].toFixed(1)} ${h} L ${first[0].toFixed(1)} ${h} Z`;
  const id = useId().replace(/:/g, "");
  return (
    <svg className="kpi-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---- Ingresos vs. gastos (area + dashed line) ---- */
export function AreaChart({ ingresos, gastos }: { ingresos: number[]; gastos: number[] }) {
  const w = 600, h = 200, pl = 6, pr = 6, pt = 14, pb = 8;
  const max = Math.max(...ingresos, ...gastos) * 1.15;
  const X = (i: number) => pl + i * ((w - pl - pr) / (ingresos.length - 1));
  const Y = (v: number) => pt + (1 - v / max) * (h - pt - pb);
  const line = (arr: number[]) => arr.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const area = (arr: number[]) =>
    `${line(arr)} L ${X(arr.length - 1).toFixed(1)} ${(h - pb).toFixed(1)} L ${X(0).toFixed(1)} ${(h - pb).toFixed(1)} Z`;
  const grid = [0.25, 0.5, 0.75, 1].map((g) => pt + (1 - g) * (h - pt - pb));
  return (
    <svg className="area-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="gf-ingresos" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--ft-accent)" stopOpacity="0.20" />
          <stop offset="1" stopColor="var(--ft-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid.map((y, i) => (
        <line key={i} x1="0" x2={w} y1={y} y2={y} stroke="var(--ft-line)" strokeWidth="1" />
      ))}
      <path d={area(ingresos)} fill="url(#gf-ingresos)" />
      <path d={line(gastos)} fill="none" stroke="#c0476f" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <path d={line(ingresos)} fill="none" stroke="var(--ft-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---- Automatización donut ---- */
export function Donut({ pct, label }: { pct: number; label: string }) {
  const r = 70, c = 2 * Math.PI * r, sw = 16, off = c * (1 - pct / 100);
  return (
    <div className="donut">
      <svg width="168" height="168" viewBox="0 0 168 168">
        <circle cx="84" cy="84" r={r} fill="none" stroke="var(--ft-line)" strokeWidth={sw} />
        <circle cx="84" cy="84" r={r} fill="none" stroke="var(--ft-accent)" strokeWidth={sw} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="donut-center">
        <strong>{pct}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
