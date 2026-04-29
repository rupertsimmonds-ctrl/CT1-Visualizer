"use client";

import { useMemo, useState } from "react";
import type { Unit, BedroomCode, StatusCode } from "@/lib/types";
import { STATUS_FILL, STATUS_RING, TYPE_EDGE } from "@/lib/statusColor";
import { STATUS_LABEL, TYPE_META, BEDROOM_ORDER, AVAILABLE_STATES, BH_LET_STATES, HH_LET_STATES } from "@/lib/constants";
import { fmtAed, fmtSqft } from "@/lib/format";

type StatusFilter = "all" | "available" | "bh_let" | "hh_let" | "lost" | "show_flat";
type BedFilter = BedroomCode | "all";

const BANDS = [
  { code: "lower", label: "Lower · 5–25", min: 5, max: 25 },
  { code: "mid", label: "Mid · 26–69", min: 26, max: 69 },
  { code: "upper", label: "Upper · 70–89", min: 70, max: 89 },
  { code: "penthouse", label: "Penthouse · 90–93", min: 90, max: 93 },
];

const matchStatus = (s: StatusCode, f: StatusFilter): boolean => {
  if (f === "all") return true;
  if (f === "available") return AVAILABLE_STATES.includes(s);
  if (f === "bh_let") return BH_LET_STATES.includes(s);
  if (f === "hh_let") return HH_LET_STATES.includes(s);
  if (f === "lost") return s === "lost";
  if (f === "show_flat") return s === "show_flat";
  return true;
};

export default function Tower({ units, onPickUnit }: { units: Unit[]; onPickUnit: (u: Unit) => void }) {
  const [bed, setBed] = useState<BedFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [hover, setHover] = useState<{ unit: Unit; x: number; y: number } | null>(null);

  const byFloor = useMemo(() => {
    const map = new Map<number, Unit[]>();
    for (const u of units) {
      if (!map.has(u.f)) map.set(u.f, []);
      map.get(u.f)!.push(u);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.p - b.p);
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [units]);

  const isMatch = (u: Unit) => (bed === "all" || u.t === bed) && matchStatus(u.s, status);
  const totalMatch = useMemo(() => units.filter(isMatch).length, [units, bed, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">Tower</h2>
          <p className="text-xs opacity-60">{totalMatch} units highlighted · floors 93 → 5</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={status === "all"} onClick={() => setStatus("all")}>All</Chip>
        <Chip active={status === "available"} onClick={() => setStatus("available")} swatch="#D9B9A0">Available</Chip>
        <Chip active={status === "bh_let"} onClick={() => setStatus("bh_let")} swatch="#1F343F">BH Let</Chip>
        <Chip active={status === "hh_let"} onClick={() => setStatus("hh_let")} swatch="#7BA0B2">H&amp;H Let</Chip>
        <Chip active={status === "show_flat"} onClick={() => setStatus("show_flat")} swatch="#2C537A">Show flat</Chip>
        <Chip active={status === "lost"} onClick={() => setStatus("lost")} swatch="#FF787A">Lost</Chip>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={bed === "all"} onClick={() => setBed("all")}>All beds</Chip>
        {BEDROOM_ORDER.map((t) => (
          <Chip key={t} active={bed === t} onClick={() => setBed(t)} swatch={TYPE_META[t].color}>
            {TYPE_META[t].label}
          </Chip>
        ))}
      </div>

      <div
        className="relative rounded-xl bg-white border p-3 overflow-hidden"
        style={{ borderColor: "var(--rule)" }}
        onMouseLeave={() => setHover(null)}
      >
        <div className="space-y-[2px]">
          {byFloor.map(([floor, floorUnits], idx, arr) => {
            const prevFloor = arr[idx - 1]?.[0];
            const newBand =
              prevFloor !== undefined &&
              ((prevFloor > 89 && floor <= 89) ||
                (prevFloor > 69 && floor <= 69) ||
                (prevFloor > 25 && floor <= 25));
            const showLabel = floor % 10 === 0 || floor === 5 || floor === 93;
            return (
              <div
                key={floor}
                className={`flex items-center gap-1 ${newBand ? "border-t border-dashed pt-1 mt-1" : ""}`}
                style={{ borderColor: newBand ? "var(--rule-strong)" : undefined }}
              >
                <div
                  className="w-8 text-[10px] font-mono opacity-60 tabular-nums text-right pr-1"
                  style={{ opacity: showLabel ? 0.7 : 0 }}
                >
                  {floor}
                </div>
                <div className="flex-1 flex gap-[2px] flex-wrap">
                  {floorUnits.map((u) => {
                    const dim = !isMatch(u);
                    return (
                      <button
                        key={u.uid}
                        onClick={() => onPickUnit(u)}
                        onMouseEnter={(e) =>
                          setHover({ unit: u, x: e.clientX, y: e.clientY })
                        }
                        onMouseMove={(e) =>
                          setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : null))
                        }
                        className="relative flex-1 min-w-[10px] h-[10px] transition-transform hover:scale-[1.6] hover:z-10"
                        style={{
                          background: STATUS_FILL[u.s],
                          boxShadow: STATUS_RING[u.s] ? `inset 0 0 0 1.5px ${STATUS_RING[u.s]}` : undefined,
                          outline: u.d ? "1.5px solid var(--gold)" : undefined,
                          outlineOffset: u.d ? -1 : undefined,
                          opacity: dim ? 0.12 : 1,
                        }}
                        aria-label={`Unit ${u.uid}`}
                      >
                        <span
                          className="absolute right-0 top-0 bottom-0 w-[2px]"
                          style={{ background: TYPE_EDGE[u.t] }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="absolute right-3 top-3 flex flex-col gap-1 text-[10px] opacity-70 pointer-events-none">
          {BANDS.map((b) => (
            <span key={b.code}>{b.label}</span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] opacity-80">
        <Legend swatch="#E8DBC8" label="Not launched" />
        <Legend swatch="#B39470" label="Marketing" />
        <Legend swatch="#D9B9A0" label="Available / Reserved" />
        <Legend swatch="#1F343F" label="Signed / Occupied · BH" />
        <Legend swatch="#7BA0B2" label="Signed / Occupied · H&H" />
        <Legend swatch="#2C537A" label="Show flat" />
        <Legend swatch="#FF787A" label="Lost" />
        <Legend swatch="#D7A86F" label="Duplex (gold outline)" outline />
      </div>

      {hover && <Tooltip data={hover} />}
    </div>
  );
}

function Tooltip({ data }: { data: { unit: Unit; x: number; y: number } }) {
  const u = data.unit;
  const offset = 14;
  return (
    <div
      className="fixed z-40 pointer-events-none rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{
        left: data.x + offset,
        top: data.y + offset,
        background: "var(--slate)",
        color: "var(--haze)",
        maxWidth: 220,
      }}
    >
      <div className="font-serif text-sm" style={{ color: "var(--gold)" }}>
        Unit {u.uid}
      </div>
      <div className="opacity-90">
        {TYPE_META[u.t].label}
        {u.d ? " · Duplex" : ""} · {u.v || "—"}
      </div>
      <div className="opacity-90">{fmtSqft(u.sq)}</div>
      <div className="opacity-90">{fmtAed(u.pr)} p.a.</div>
      <div className="mt-1 inline-block px-1.5 py-0.5 rounded text-[10px]" style={{ background: STATUS_FILL[u.s], color: u.s === "signed_bh" || u.s === "occupied_bh" || u.s === "show_flat" ? "white" : "var(--slate)" }}>
        {STATUS_LABEL[u.s]}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  swatch,
  children,
}: {
  active: boolean;
  onClick: () => void;
  swatch?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium border inline-flex items-center gap-1.5"
      style={{
        background: active ? "var(--slate)" : "white",
        color: active ? "var(--haze)" : "var(--slate)",
        borderColor: active ? "var(--slate)" : "var(--rule)",
      }}
    >
      {swatch && <span className="w-2 h-2 rounded-sm" style={{ background: swatch }} />}
      {children}
    </button>
  );
}

function Legend({ swatch, label, outline }: { swatch: string; label: string; outline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-3 rounded-sm"
        style={
          outline
            ? { background: "transparent", outline: `1.5px solid ${swatch}`, outlineOffset: -1 }
            : { background: swatch }
        }
      />
      {label}
    </span>
  );
}
