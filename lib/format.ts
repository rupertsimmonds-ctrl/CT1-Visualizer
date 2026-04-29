export function fmtAed(n: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (opts.compact) {
    if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `AED ${Math.round(n / 1_000)}K`;
  }
  return `AED ${Math.round(n).toLocaleString("en-US")}`;
}

export function fmtSqft(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${Math.round(n).toLocaleString("en-US")} sq ft`;
}

export function fmtPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
