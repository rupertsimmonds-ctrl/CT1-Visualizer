"use client";

import { useEffect, useState } from "react";
import type { Unit } from "@/lib/types";
import { TYPE_META, STATUS_LABEL } from "@/lib/constants";
import { fmtAed, fmtSqft } from "@/lib/format";
import RentCalculator from "./RentCalculator";

export default function UnitDetailModal({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const copy = async () => {
    const lines = [
      `🏢 *City Tower 1 — Unit ${unit.uid}*`,
      `${TYPE_META[unit.t].label}${unit.d ? " Duplex" : ""} · Floor ${unit.f} · ${unit.v || "—"}`,
      `Size: ${fmtSqft(unit.sq)}${unit.b && unit.bsq ? ` (incl. ${Math.round(unit.bsq)} sq ft balcony)` : ""}`,
      `Rent: ${fmtAed(unit.pr)} p.a.`,
      `Status: ${STATUS_LABEL[unit.s]}`,
      `All 695 residences unfurnished.`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-paper rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <header
          className="sticky top-0 px-5 pt-4 pb-3 flex items-start gap-3 border-b"
          style={{ background: "var(--paper)", borderColor: "var(--rule)" }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider opacity-60">
              {TYPE_META[unit.t].label}
              {unit.d ? " · Duplex" : ""} · Floor {unit.f} · {unit.v || "—"}
            </div>
            <h3 className="font-serif text-2xl leading-tight">Unit {unit.uid}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full grid place-items-center"
            style={{ background: "var(--mist)" }}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Pill>{STATUS_LABEL[unit.s]}</Pill>
            {unit.d && <Pill>Duplex</Pill>}
            {unit.b && <Pill>Balcony{unit.bsq ? ` · ${Math.round(unit.bsq)} sq ft` : ""}</Pill>}
            <Pill muted>Unfurnished</Pill>
            {unit.orig > 0 && unit.pr < unit.orig && (
              <Pill accent>−{Math.round((1 - unit.pr / unit.orig) * 100)}%</Pill>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat label="Rent p.a." value={fmtAed(unit.pr)} emphasis />
            <Stat label="Total size" value={fmtSqft(unit.sq)} />
            <Stat label="Price / sq ft" value={unit.psf ? `AED ${unit.psf.toFixed(0)}` : "—"} />
            <Stat label="Tranche" value={unit.tr || "—"} />
            {unit.br && <Stat label="Broker" value={unit.br} />}
            {unit.dom != null && <Stat label="Days on market" value={String(unit.dom)} />}
            {unit.sgnD && <Stat label="Signed" value={unit.sgnD} />}
            {unit.sgnR != null && unit.sgnR > 0 && <Stat label="Signed rent" value={fmtAed(unit.sgnR)} />}
          </div>

          <RentCalculator askingRent={unit.pr} />

          <div className="flex gap-2 pt-2">
            <button
              onClick={copy}
              className="flex-1 rounded-xl py-3 text-sm font-medium transition"
              style={{
                background: copied ? "#7BE495" : "var(--slate)",
                color: copied ? "var(--afterlight)" : "var(--haze)",
              }}
            >
              {copied ? "Copied to clipboard" : "Copy for WhatsApp"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-lg bg-white border px-3 py-2" style={{ borderColor: "var(--rule)" }}>
      <div className="text-[10px] uppercase tracking-wider opacity-60">{label}</div>
      <div
        className={emphasis ? "font-serif text-xl mt-0.5" : "text-sm mt-0.5"}
        style={emphasis ? { color: "var(--gold-dark)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function Pill({ children, muted, accent }: { children: React.ReactNode; muted?: boolean; accent?: boolean }) {
  let style: React.CSSProperties = { background: "var(--slate)", color: "var(--haze)" };
  if (muted) style = { background: "var(--mist)", color: "var(--slate)" };
  if (accent) style = { background: "var(--gold)", color: "var(--afterlight)" };
  return (
    <span className="text-[11px] px-2 py-1 rounded-full font-medium" style={style}>
      {children}
    </span>
  );
}
