"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { UnitsPayload, Unit } from "@/lib/types";
import { buildOverview } from "@/lib/aggregate";
import TopBar from "./TopBar";
import TabBar, { type TabKey } from "./TabBar";
import Tower from "./Tower";
import Overview from "./Overview";
import Available from "./Available";
import Info from "./Info";
import UnitDetailModal from "./UnitDetailModal";

const POLL_INTERVAL_MS = 60_000;

export default function AppShell({ payload }: { payload: UnitsPayload }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("overview");
  const [openUnit, setOpenUnit] = useState<Unit | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (isDesktop && tab === "overview") setTab("tower");
    if (!isDesktop && tab === "tower") setTab("overview");
  }, [isDesktop]);

  useEffect(() => {
    const refresh = () => router.refresh();
    const id = window.setInterval(refresh, POLL_INTERVAL_MS);
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [router]);

  const overview = useMemo(() => buildOverview(payload.units), [payload.units]);

  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar payload={payload} tab={tab} onTabChange={setTab} />

      <main className="flex-1 pt-14 pb-20 lg:pt-28 lg:pb-6">
        <div className="mx-auto w-full max-w-6xl px-4">
          {tab === "tower" && <Tower units={payload.units} onPickUnit={setOpenUnit} />}
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
