"use client";

import { useMemo, useState } from "react";
import { fmtAed } from "@/lib/format";

export default function RentCalculator({ askingRent }: { askingRent: number }) {
  const [rent, setRent] = useState<number>(Math.round(askingRent || 0));
  const [term, setTerm] = useState<number>(12);
  const [free, setFree] = useState<number>(2);

  const calc = useMemo(() => {
    const safeTerm = Math.max(1, Math.round(term || 0));
    const safeFree = Math.max(0, Math.min(safeTerm, Math.round(free || 0)));
    const paid = Math.max(0, safeTerm - safeFree);
    const totalCash = (rent / 12) * paid;
    const eff = paid > 0 ? totalCash / (safeTerm / 12) : 0;
    const disc = rent > 0 && eff > 0 ? (1 - eff / rent) * 100 : 0;
    const effMon = safeTerm > 0 ? totalCash / safeTerm : 0;
    return { totalCash, eff, disc, effMon, paid, safeTerm, safeFree };
  }, [rent, term, free]);

  return (
    <section
      className="rounded-xl border p-4"
      style={{ background: "var(--mist)", borderColor: "var(--rule)" }}
    >
      <h4 className="font-serif text-base mb-3">Rent calculator</h4>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Asking (AED p.a.)" value={rent} onChange={setRent} step={5000} />
        <Field label="Term (months)" value={term} onChange={setTerm} step={1} min={1} />
        <Field label="Rent-free (months)" value={free} onChange={setFree} step={1} min={0} />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
        <Out label="Effective p.a." value={fmtAed(calc.eff)} highlight />
        <Out label="Discount" value={`${calc.disc.toFixed(1)}%`} />
        <Out label="Monthly equivalent" value={fmtAed(calc.effMon)} />
        <Out label="Total cash" value={fmtAed(calc.totalCash)} />
      </div>
      <p className="text-[11px] opacity-70 mt-2">
        {calc.paid} paid · {calc.safeFree} rent-free over a {calc.safeTerm}-month lease
      </p>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  step,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
  min?: number;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider opacity-60">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-sm"
        style={{ borderColor: "var(--rule)" }}
      />
    </label>
  );
}

function Out({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-white border px-3 py-2" style={{ borderColor: "var(--rule)" }}>
      <div className="text-[10px] uppercase tracking-wider opacity-60">{label}</div>
      <div
        className={highlight ? "font-serif text-lg mt-0.5" : "text-sm mt-0.5"}
        style={highlight ? { color: "var(--gold-dark)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
