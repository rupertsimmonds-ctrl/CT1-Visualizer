"use client";

import type { Unit } from "@/lib/types";
import type { OverviewKpis } from "@/lib/aggregate";
import { fmtAed } from "@/lib/format";

export default function Overview({
  overview,
  onPickUnit,
  onJumpAvailable,
}: {
  overview: OverviewKpis;
  onPickUnit: (u: Unit) => void;
  onJumpAvailable: () => void;
}) {
  const { total, available, bhLet, hhLet, lost, byBedroomAvailable, showFlats, mix } = overview;

  return (
    <div className="space-y-6 pt-4 pb-2">
      <button
        onClick={onJumpAvailable}
        className="w-full rounded-2xl p-5 text-left shadow-card transition active:scale-[0.99]"
        style={{ background: "linear-gradient(180deg, var(--afterlight) 0%, var(--afterlight2) 100%)", color: "var(--haze)" }}
      >
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--gold)" }}>
          Available now
        </div>
        <div className="font-serif text-5xl mt-1" style={{ color: "var(--gold)" }}>
          {available}
        </div>
        <div className="text-sm opacity-80 mt-1">of {total} residences · tap to browse</div>
      </button>

      <section className="grid grid-cols-3 gap-3">
        <KpiCard label="BH Let" value={bhLet} />
        <KpiCard label="H&H Let" value={hhLet} />
        <KpiCard label="Lost" value={lost} accent={lost > 0 ? "var(--salmon)" : undefined} />
      </section>

      <section>
        <SectionHeader title="By bedroom" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {byBedroomAvailable.map((b) => (
            <button
              key={b.type}
              onClick={onJumpAvailable}
              className="rounded-xl p-3 text-left bg-white shadow-card border"
              style={{ borderColor: "var(--rule)" }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
                <span className="text-xs uppercase tracking-wider opacity-70">{b.label}</span>
              </div>
              <div className="font-serif text-3xl mt-1">{b.count}</div>
              <div className="text-[11px] opacity-60">available</div>
            </button>
          ))}
        </div>
      </section>

      {showFlats.length > 0 && (
        <section>
          <SectionHeader title="Show flats" subtitle={`${showFlats.length} on tour`} />
          <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-3 snap-x snap-mandatory">
              {showFlats.map((u) => (
                <button
                  key={u.uid}
                  onClick={() => onPickUnit(u)}
                  className="snap-start shrink-0 w-56 rounded-xl bg-white shadow-card border p-3 text-left"
                  style={{ borderColor: "var(--rule)" }}
                >
                  <div className="text-[11px] uppercase tracking-wider opacity-60">Show flat</div>
                  <div className="font-serif text-xl mt-0.5">Unit {u.uid}</div>
                  <div className="text-xs opacity-70 mt-0.5">
                    Floor {u.f} · {u.v}
                  </div>
                  <div className="mt-2 text-sm" style={{ color: "var(--gold-dark)" }}>
                    {fmtAed(u.pr, { compact: true })}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section>
        <SectionHeader title="Rent by type" />
        <div className="rounded-xl bg-white shadow-card border overflow-hidden" style={{ borderColor: "var(--rule)" }}>
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider opacity-60">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-right px-3 py-2 font-medium">Units</th>
                <th className="text-right px-3 py-2 font-medium">Avg</th>
                <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">Range</th>
              </tr>
            </thead>
            <tbody>
              {mix.filter((m) => m.count > 0).map((m) => (
                <tr key={m.type} className="border-t" style={{ borderColor: "var(--rule)" }}>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                      {m.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{m.count}</td>
                  <td className="px-3 py-2 text-right">{fmtAed(m.avgRent, { compact: true })}</td>
                  <td className="px-3 py-2 text-right hidden sm:table-cell opacity-70">
                    {fmtAed(m.minRent, { compact: true })} – {fmtAed(m.maxRent, { compact: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl bg-white shadow-card border p-3" style={{ borderColor: "var(--rule)" }}>
      <div className="text-[11px] uppercase tracking-wider opacity-60">{label}</div>
      <div className="font-serif text-3xl mt-0.5" style={{ color: accent ?? "var(--slate)" }}>
        {value}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <h2 className="font-serif text-lg">{title}</h2>
      {subtitle && <span className="text-xs opacity-60">{subtitle}</span>}
    </div>
  );
}
