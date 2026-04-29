"use client";

export type TabKey = "tower" | "overview" | "available" | "info";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "overview",
    label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21V9l9-6 9 6v12" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    key: "available",
    label: "Available",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  },
  {
    key: "info",
    label: "Info",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M11 12h1v5h1" />
      </svg>
    ),
  },
];

export default function TabBar({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 h-16 lg:hidden grid grid-cols-3 border-t bg-paper/95 backdrop-blur"
      style={{ borderColor: "var(--rule)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map(({ key, label, icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="flex flex-col items-center justify-center gap-0.5 transition-colors"
            style={{ color: active ? "var(--gold-dark)" : "var(--slate)" }}
            aria-current={active ? "page" : undefined}
          >
            <span style={{ opacity: active ? 1 : 0.7 }}>{icon}</span>
            <span className="text-[11px]" style={{ fontWeight: active ? 600 : 500 }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
