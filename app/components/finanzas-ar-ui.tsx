// ═══════════════════════════════════════════════════════════════════
// Helpers visuales compartidos por Finanzas AR (dashboard, punto de equilibrio).
// ═══════════════════════════════════════════════════════════════════

// ─── Formatters ───
export const fmtArs = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}MM`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${Math.round(abs / 1e3)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

export const fmtArsExact = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
};

export const fmtPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(1)}%`;
};

export const fmtNum = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("es-AR");
};

// Color helpers (paleta orange-blue-green-red, sin amarillo)
export const C = {
  orange: "#E8692A",
  blue: "#74ACDF",
  green: "#10B981",     // emerald
  greenDk: "#059669",
  red: "#EF4444",
  redDk: "#DC2626",
  amber: "#F59E0B",
  gray: "#6B7280",
};

export type Tone = "green" | "red" | "orange" | "blue" | "amber";

export function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: Tone }) {
  const colorMap: Record<Tone, string> = { green: C.green, red: C.red, orange: C.orange, blue: C.blue, amber: C.amber };
  return (
    <div className="glass-card p-4">
      <div className="text-[11px] t-muted uppercase tracking-wider mb-1">{label}</div>
      <div className="font-mono text-xl font-semibold" style={{ color: colorMap[tone] }}>{value}</div>
      <div className="text-[11px] t-muted mt-1 leading-snug">{sub}</div>
    </div>
  );
}

export function Th({ children, align = "right" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`py-3 px-4 text-[11px] t-muted uppercase tracking-wider whitespace-nowrap ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

export function Td({ children, align = "right", bold, mono, color, muted }: { children: React.ReactNode; align?: "left" | "right"; bold?: boolean; mono?: boolean; color?: string; muted?: boolean }) {
  return (
    <td
      className={`py-2 px-4 text-xs ${align === "right" ? "text-right" : "text-left"} ${mono ? "font-mono" : ""} ${bold ? "font-semibold" : ""} ${muted ? "t-muted" : ""}`}
      style={color ? { color } : undefined}
    >
      {children}
    </td>
  );
}

export function Badge({ children, tone }: { children: React.ReactNode; tone: Tone }) {
  const colorMap: Record<Tone, { bg: string; text: string }> = {
    green: { bg: "rgba(16,185,129,0.15)", text: C.green },
    red: { bg: "rgba(239,68,68,0.15)", text: C.red },
    orange: { bg: "rgba(232,105,42,0.15)", text: C.orange },
    blue: { bg: "rgba(116,172,223,0.15)", text: C.blue },
    amber: { bg: "rgba(245,158,11,0.15)", text: C.amber },
  };
  const c = colorMap[tone];
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap" style={{ background: c.bg, color: c.text }}>
      {children}
    </span>
  );
}
