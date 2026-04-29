"use client";

import { useMemo, useState } from "react";
import type { Unit, BedroomCode, StatusCode } from "@/lib/types";
import { STATUS_FILL, STATUS_RING, TYPE_EDGE } from "@/lib/statusColor";
import { STATUS_LABEL, TYPE_META, BEDROOM_ORDER, AVAILABLE_STATES, BH_LET_STATES, HH_LET_STATES } from "@/lib/constants";
import { fmtAed, fmtSqft } from "@/lib/format";

type StatusFilter = "all" | "available" | "bh_let" | "hh_let" | "lost" | "show_flat";
type BedFilter = BedroomCode | "all";

const CELL_W = 22;
const CELL_H = 8;
const CELL_GAP = 2;
const ROW_GAP = 1;
const FRAME_PAD_LEFT = 90;
const FRAME_PAD_RIGHT = 20;

const TRANCHE_BANDS = [
  { code: "penthouse", label: "Penthouse · 90–93", min: 90, max: 93, color: "#A06767" },
  { code: "upper", label: "Upper · 70–89", min: 70, max: 89, color: "#2C537A" },
  { code: "mid", label: "Mid · 26–69", min: 26, max: 69, color: "#7BA0B2" },
  { code: "lower", label: "Lower · 5–25", min: 5, max: 25, color: "#EDE8E4" },
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

const hasCenterDot = (s: StatusCode): "bh" | "hh" | null => {
  if (s === "signed_bh" || s === "occupied_bh") return "bh";
  if (s === "signed_hh" || s === "occupied_hh") return "hh";
  return null;
};

export default function Tower({ units, onPickUnit }: { units: Unit[]; onPickUnit: (u: Unit) => void }) {
  const [bed, setBed] = useState<BedFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [hover, setHover] = useState<{ unit: Unit; x: number; y: number } | null>(null);

  const floors = useMemo(() => {
    const map = new Map<number, Unit[]>();
    for (const u of units) {
      if (!map.has(u.f)) map.set(u.f, []);
      map.get(u.f)!.push(u);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.p - b.p);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [units]);

  const maxUnitsPerFloor = useMemo(
    () => floors.reduce((m, [, arr]) => Math.max(m, arr.length), 0),
    [floors]
  );

  const innerW = maxUnitsPerFloor * CELL_W + Math.max(0, maxUnitsPerFloor - 1) * CELL_GAP;
  const frameW = FRAME_PAD_LEFT + innerW + FRAME_PAD_RIGHT;

  const isMatch = (u: Unit) => (bed === "all" || u.t === bed) && matchStatus(u.s, status);
  const totalMatch = useMemo(() => units.filter(isMatch).length, [units, bed, status]);

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-end justify-between gap-4 border-b pb-3" style={{ borderColor: "var(--rule)" }}>
        <h2 className="font-serif text-xl">Tower</h2>
        <span
          className="text-[10px] uppercase"
          style={{ letterSpacing: "0.24em", color: "var(--denim)" }}
        >
          {totalMatch} highlighted · 89 floors
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={status === "all"} onClick={() => setStatus("all")}>All</Chip>
        <Chip active={status === "available"} onClick={() => setStatus("available")} swatch="#D9B9A0">Available</Chip>
        <Chip active={status === "bh_let"} onClick={() => setStatus("bh_let")} swatch="#1F343F">BH Let</Chip>
        <Chip active={status === "hh_let"} onClick={() => setStatus("hh_let")} swatch="#7BA0B2">H&amp;H Let</Chip>
        <Chip active={status === "show_flat"} onClick={() => setStatus("show_flat")} swatch="#2C537A">Show flat</Chip>
        <Chip active={status === "lost"} onClick={() => setStatus("lost")} swatch="#FF787A">Lost</Chip>
        <span className="w-px self-stretch mx-1" style={{ background: "var(--rule)" }} />
        <Chip active={bed === "all"} onClick={() => setBed("all")}>All beds</Chip>
        {BEDROOM_ORDER.map((t) => (
          <Chip key={t} active={bed === t} onClick={() => setBed(t)} swatch={TYPE_META[t].color}>
            {TYPE_META[t].label}
          </Chip>
        ))}
      </div>

      <div className="flex justify-center" onMouseLeave={() => setHover(null)}>
        <div
          className="relative"
          style={{
            width: frameW,
            background: "linear-gradient(180deg, #E8E4DE 0%, #F7F2EB 28%, #FDFAF4 100%)",
            border: "1px solid var(--rule)",
            padding: `24px ${FRAME_PAD_RIGHT}px 24px ${FRAME_PAD_LEFT}px`,
          }}
        >
          <Crown />

          <div
            className="w-full"
            style={{ height: 8, background: "linear-gradient(180deg, var(--afterlight) 0%, var(--afterlight2) 100%)", boxShadow: "inset 0 -1px 0 var(--gold-dark)", marginBottom: 2 }}
          />

          <div className="flex flex-col-reverse" style={{ gap: ROW_GAP }}>
            {floors.map(([floor, floorUnits], idx) => {
              const prev = floors[idx - 1]?.[0];
              const tranche =
                prev !== undefined &&
                ((prev <= 25 && floor > 25) ||
                  (prev <= 69 && floor > 69) ||
                  (prev <= 89 && floor > 89));
              const showLabel = floor % 10 === 0 || floor === 5 || floor === 93;
              return (
                <div
                  key={floor}
                  className="relative flex items-center group"
                  style={{
                    height: tranche ? 11 : CELL_H,
                    gap: CELL_GAP,
                    marginTop: tranche ? 5 : 0,
                    paddingTop: tranche ? 3 : 0,
                    borderTop: tranche ? "1px dashed var(--rule-strong)" : undefined,
                    boxShadow: floor % 10 === 0 ? "0 -1px 0 rgba(31,52,63,0.06)" : undefined,
                  }}
                >
                  <span
                    className="absolute font-semibold tabular-nums transition-opacity group-hover:opacity-100"
                    style={{
                      right: "calc(100% + 6px)",
                      fontSize: 9,
                      color: "var(--denim)",
                      opacity: showLabel ? 1 : 0,
                    }}
                  >
                    {floor}
                  </span>
                  {floorUnits.map((u) => {
                    const dim = !isMatch(u);
                    const dot = hasCenterDot(u.s);
                    return (
                      <button
                        key={u.uid}
                        onClick={() => onPickUnit(u)}
                        onMouseEnter={(e) => setHover({ unit: u, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : null))}
                        className="relative transition-all hover:scale-[1.4] hover:z-10"
                        style={{
                          width: CELL_W,
                          height: CELL_H,
                          padding: 0,
                          border: 0,
                          cursor: "pointer",
                          background: STATUS_FILL[u.s],
                          boxShadow: STATUS_RING[u.s] ? `inset 0 0 0 1.5px ${STATUS_RING[u.s]}` : undefined,
                          outline: u.d ? "1.5px solid var(--gold)" : undefined,
                          outlineOffset: u.d ? -1 : undefined,
                          opacity: dim ? 0.12 : 1,
                        }}
                        aria-label={`Unit ${u.uid}`}
                      >
                        {dot && (
                          <span
                            className="absolute"
                            style={{
                              left: "50%",
                              top: "50%",
                              width: 3,
                              height: 3,
                              transform: "translate(-50%, -50%)",
                              background: dot === "bh" ? "var(--sand)" : "var(--slate)",
                            }}
                          />
                        )}
                        <span
                          className="absolute right-0 top-0 bottom-0"
                          style={{ width: u.t === "4br" ? 3 : 2, background: TYPE_EDGE[u.t] }}
                        />
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {TRANCHE_BANDS.map((b) => (
            <span
              key={b.code}
              className="absolute uppercase pointer-events-none"
              style={{
                left: 12,
                width: 70,
                top: trancheTopPx(b.min, b.max, floors.length),
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "var(--denim)",
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                textAlign: "center",
                borderLeft: `2px solid ${b.color}`,
                padding: "6px 4px 6px 8px",
                opacity: 0.85,
              }}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] opacity-80 pt-1">
        <Legend swatch="#E8DBC8" label="Not launched" />
        <Legend swatch="#B39470" label="Marketing" />
        <Legend swatch="#D9B9A0" label="Reserved" />
        <Legend swatch="#1F343F" label="BH" />
        <Legend swatch="#7BA0B2" label="H&H" />
        <Legend swatch="#2C537A" label="Show flat" />
        <Legend swatch="#FF787A" label="Lost" />
        <Legend swatch="#D7A86F" label="Duplex" outline />
      </div>

      {hover && <Tooltip data={hover} />}
    </div>
  );
}

function trancheTopPx(min: number, max: number, _totalFloors: number): number {
  const rowH = CELL_H + ROW_GAP;
  const crownPx = 24 + 18 + 5 + 4 + 3 + 8 + 2;
  const fromTopFloors = 93 - max;
  const heightFloors = max - min + 1;
  const top = crownPx + fromTopFloors * rowH;
  const center = top + (heightFloors * rowH) / 2;
  return center - 36;
}

function Crown() {
  return (
    <div className="mx-auto mb-[3px] flex flex-col items-center" style={{ marginTop: -4 }}>
      <div style={{ width: 2, height: 18, background: "linear-gradient(180deg, var(--gold) 0%, var(--afterlight) 100%)" }} />
      <div style={{ width: 42, height: 5, background: "var(--afterlight)" }} />
      <div style={{ width: 90, height: 4, background: "linear-gradient(180deg, var(--gold-dark) 0%, var(--afterlight) 100%)" }} />
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
      <div
        className="mt-1 inline-block px-1.5 py-0.5 rounded text-[10px]"
        style={{
          background: STATUS_FILL[u.s],
          color: ["signed_bh", "occupied_bh", "show_flat", "lost"].includes(u.s) ? "white" : "var(--slate)",
        }}
      >
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
