"use client";

import Image from "next/image";

export default function Info() {
  return (
    <div className="pt-4 space-y-6">
      <header>
        <h2 className="font-serif text-2xl">About City Tower 1</h2>
        <p className="text-sm opacity-70 mt-1">
          695 unfurnished residences. Live availability synced from the leasing operations sheet.
        </p>
      </header>

      <section
        className="rounded-2xl p-6 text-center"
        style={{ background: "linear-gradient(180deg, var(--afterlight) 0%, var(--afterlight2) 100%)", color: "var(--haze)" }}
      >
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--gold)" }}>
          BH Brokers
        </div>
        <h3 className="font-serif text-xl mt-1">Join the broker network</h3>
        <div className="mx-auto mt-4 inline-block bg-white rounded-xl p-3" style={{ imageRendering: "pixelated" as const }}>
          <Image
            src="/qr.png"
            alt="BH Brokers QR"
            width={220}
            height={220}
            unoptimized
            priority
            style={{ imageRendering: "pixelated" }}
          />
        </div>
        <div className="text-sm opacity-80 mt-3">Scan to register</div>
      </section>

      <section
        className="rounded-xl bg-white border p-4 text-sm leading-relaxed"
        style={{ borderColor: "var(--rule)" }}
      >
        <h3 className="font-serif text-base mb-2">How this works</h3>
        <ul className="list-disc pl-5 space-y-1 opacity-80">
          <li>Data is read live from the leasing sheet and refreshed automatically.</li>
          <li>Tap any unit to see details and run the rent calculator.</li>
          <li>Use the Available tab to filter by bedroom, balcony, or duplex.</li>
          <li>If the sheet is unreachable, you&apos;ll see the most recent snapshot.</li>
        </ul>
      </section>
    </div>
  );
}
