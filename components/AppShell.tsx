"use client";

import { useMemo, useState } from "react";
import type { UnitsPayload, Unit } from "@/lib/types";
import { buildOverview } from "@/lib/aggregate";
import TopBar from "./TopBar";
import TabBar, { type TabKey } from "./TabBar";
import Overview from "./Overview";
import Available from "./Available";
import Info from "./Info";
import UnitDetailModal from "./UnitDetailModal";

export default function AppShell({ payload }: { payload: UnitsPayload }) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [openUnit, setOpenUnit] = useState<Unit | null>(null);
  const overview = useMemo(() => buildOverview(payload.units), [payload.units]);

  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar payload={payload} tab={tab} onTabChange={setTab} />

      <main className="flex-1 pt-14 pb-20 lg:pt-28 lg:pb-6">
        <div className="mx-auto w-full max-w-6xl px-4">
          {tab === "overview" && (
            <Overview overview={overview} onPickUnit={setOpenUnit} onJumpAvailable={() => setTab("available")} />
          )}
          {tab === "available" && <Available units={payload.units} onPickUnit={setOpenUnit} />}
          {tab === "info" && <Info />}
        </div>
      </main>

      <TabBar tab={tab} onChange={setTab} />

      {openUnit && <UnitDetailModal unit={openUnit} onClose={() => setOpenUnit(null)} />}
    </div>
  );
}
