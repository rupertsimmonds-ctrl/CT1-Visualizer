"use client";

import { useMemo, useState } from "react";
import type { Unit, BedroomCode } from "@/lib/types";
import { BEDROOM_ORDER, TYPE_META } from "@/lib/constants";
import { filterAvailable } from "@/lib/aggregate";
import { fmtAed, fmtSqft } from "@/lib/format";

type BedFilter = BedroomCode | "all";

export default function Available({ units, onPickUnit }: { units: Unit[]; onPickUnit: (u: Unit) => void }) {
  const [bed, setBed] = useState<BedFilter>("all");
  const [balcony, setBalcony] = useState(false);
  const [duplex, setDuplex] = useState(false);
  const [show, setShow] = useState(false);

  const filtered = useMemo(
    () => filterAvailable(units, { bed, balcony, duplex, show }),
    [units, bed, balcony, duplex, show]
  );

  const reset = () => {
    setBed("all");
    setBalcony(false);
    setDuplex(false);
    setShow(false);
  };

  const dirty = bed !== "all" || balcony || duplex || show;

  return (
    <div className="pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl">Available</h2>
        <span className="text-sm opacity-60">{filtered.length} units</span>
      </div>

      <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 w-max">
          <Chip active={bed === "all"} onClick={() => setBed("all")}>All</Chip>
          {BEDROOM_ORDER.map((t) => (
            <Chip key={t} active={bed === t} onClick={() => setBed(t)}>
              {TYPE_META[t].label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 w-max">
          <Chip active={balcony} onClick={() => setBalcony((v) => !v)}>Balcony</Chip>
          <Chip active={duplex} onClick={() => setDuplex((v) => !v)}>Duplex</Chip>
          <Chip active={show} onClick={() => setShow((v) => !v)}>Include show flats</Chip>
          {dirty && (
            <button
              onClick={reset}
              className="px-3 py-1.5 rounded-full text-xs font-medium underline opacity-70"
              style={{ color: "var(--slate)" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-xl bg-white border p-8 text-center text-sm opacity-70"
          style={{ borderColor: "var(--rule)" }}
        >
          No units match these filters.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((u) => (
            <li key={u.uid}>
              <button
                onClick={() => onPickUnit(u)}
                className="w-full text-left rounded-xl bg-white shadow-card border p-3 transition active:scale-[0.99]"
                style={{ borderColor: "var(--rule)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider opacity-60">
                      Unit · Floor {u.f}
                    </div>
                    <div className="font-serif text-2xl leading-tight">{u.uid}</div>
                  </div>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: TYPE_META[u.t].color, color: "white" }}
                  >
                    {TYPE_META[u.t].label}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs opacity-80">
                  <span>{u.v || "—"}</span>
                  <span className="text-right">{fmtSqft(u.sq)}</span>
                  <span className="opacity-70">
                    {[u.d ? "Duplex" : null, u.b ? "Balcony" : null, u.s === "show_flat" ? "Show flat" : null]
                      .filter(Boolean)
                      .join(" · ") || "Unfurnished"}
                  </span>
                  <span className="text-right font-medium" style={{ color: "var(--gold-dark)" }}>
                    {fmtAed(u.pr, { compact: true })}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium border transition shrink-0"
      style={{
        background: active ? "var(--slate)" : "white",
        color: active ? "var(--haze)" : "var(--slate)",
        borderColor: active ? "var(--slate)" : "var(--rule)",
      }}
    >
      {children}
    </button>
  );
}
