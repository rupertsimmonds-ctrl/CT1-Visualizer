"use client";

import type { UnitsPayload } from "@/lib/types";
import { fmtTime } from "@/lib/format";
import type { TabKey } from "./TabBar";

const DESKTOP_TABS: { key: TabKey; label: string }[] = [
  { key: "tower", label: "Tower" },
  { key: "overview", label: "Overview" },
  { key: "available", label: "Available" },
  { key: "info", label: "Info" },
];

export default function TopBar({
  payload,
  tab,
  onTabChange,
}: {
  payload: UnitsPayload;
  tab: TabKey;
  onTabChange: (t: TabKey) => void;
}) {
  const live = payload.source === "live";
  const time = fmtTime(new Date(payload.fetchedAt));
  return (
    <header
      className="fixed top-0 inset-x-0 z-30 text-haze"
      style={{ background: "linear-gradient(180deg, var(--afterlight) 0%, var(--afterlight2) 100%)" }}
    >
      <div className="h-14 lg:h-16 px-4 flex items-center gap-3 mx-auto max-w-6xl w-full">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-serif"
          style={{ background: "var(--gold)", color: "var(--afterlight)" }}
          aria-hidden
        >
          b
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-base lg:text-lg leading-none truncate">City Tower 1 · Live</div>
          <div className="text-[11px] text-sun/80 mt-0.5 truncate">Brokers · BH</div>
        </div>
        <LivePill live={live} time={time} count={payload.units.length} />
      </div>

      <nav
        className="hidden lg:block border-t"
        style={{ borderColor: "rgba(215, 168, 111, 0.25)" }}
      >
        <div className="mx-auto max-w-6xl px-4 h-12 flex items-center gap-1">
          {DESKTOP_TABS.map(({ key, label }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => onTabChange(key)}
                className="px-4 h-9 rounded-full text-sm font-medium transition"
                style={{
                  background: active ? "var(--gold)" : "transparent",
                  color: active ? "var(--afterlight)" : "var(--haze)",
                }}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

function LivePill({ live, time, count }: { live: boolean; time: string; count: number }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0"
      style={{
        background: live ? "rgba(123, 228, 149, 0.18)" : "rgba(255, 120, 122, 0.18)",
        color: live ? "#9CE8B4" : "#FFB1B2",
        border: `1px solid ${live ? "rgba(123, 228, 149, 0.32)" : "rgba(255, 120, 122, 0.32)"}`,
      }}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${live ? "pulse-dot" : ""}`}
        style={{ background: live ? "#7BE495" : "#FF787A" }}
      />
      {live ? `Live · ${count} · ${time}` : `Snapshot · ${count}`}
    </span>
  );
}
