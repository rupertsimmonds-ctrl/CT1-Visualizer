import { NextResponse } from "next/server";

const SHEET_ID = "1FOofWcGkSXXnBWZ70dB7tix9T5lHjV3BL8evePp-URk";
const SHEET_TAB = "07_HTML_Export";
const BRIDGE_TAB = "unit_level_bridge";
// `headers=1` tells gviz to treat row 1 as headers explicitly. Needed for
// tabs that don't have row 1 frozen (otherwise gviz mislabels the columns).
const DEFAULT_GVIZ_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
  `?tqx=out:json&sheet=${encodeURIComponent(SHEET_TAB)}`;
const DEFAULT_BRIDGE_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
  `?tqx=out:json&headers=1&sheet=${encodeURIComponent(BRIDGE_TAB)}`;
const GVIZ_URL = process.env.CT1_GVIZ_URL || DEFAULT_GVIZ_URL;
const BRIDGE_URL = process.env.CT1_BRIDGE_URL || DEFAULT_BRIDGE_URL;

export const dynamic = "force-dynamic";

// Minimal shape we touch from gviz responses.
type GvizCol = { id?: string; label?: string };
type GvizCell = { v?: unknown } | null;
type GvizRow = { c?: GvizCell[] };
type GvizTable = { cols: GvizCol[]; rows: GvizRow[] };
type GvizResponse = { status?: string; table?: GvizTable };

function colName(c: GvizCol): string {
  return ((c.label || c.id || "") + "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

async function fetchGviz(url: string): Promise<GvizResponse | null> {
  try {
    const r = await fetch(url + "&t=" + Date.now(), {
      cache: "no-store",
      headers: { "user-agent": "ct1-visualizer-proxy" },
    });
    if (!r.ok) return null;
    const text = await r.text();
    const start = text.indexOf("(");
    const end = text.lastIndexOf(")");
    if (start < 0 || end <= start) return null;
    const json = JSON.parse(text.slice(start + 1, end)) as GvizResponse;
    if (!json || json.status !== "ok") return null;
    return json;
  } catch {
    return null;
  }
}

// Build `unit_id -> architectural_type` from the bridge tab. The bridge can
// key by unit_id directly, or by a (floor, unit_no) composite — we accept
// either so the sheet maintainer has flexibility.
function buildArchMap(bridge: GvizResponse | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!bridge || !bridge.table) return out;
  const cols = bridge.table.cols.map(colName);
  const ix = (n: string) => cols.indexOf(n);
  const iUid = ix("unit_id");
  const iFloor = ix("floor");
  const iPos =
    ix("unit_no") >= 0 ? ix("unit_no") : ix("position") >= 0 ? ix("position") : -1;
  const iArch =
    ix("architectural_type") >= 0 ? ix("architectural_type") : ix("arch_type");
  if (iArch < 0) return out;
  for (const row of bridge.table.rows ?? []) {
    const cell = (i: number): unknown =>
      i < 0 || !row.c || !row.c[i] ? null : row.c[i]!.v;
    const arch = String(cell(iArch) ?? "").trim();
    if (!arch) continue;
    let uid = String(cell(iUid) ?? "").trim();
    if (!uid && iFloor >= 0 && iPos >= 0) {
      const f = parseInt(String(cell(iFloor) ?? ""), 10);
      const p = parseInt(String(cell(iPos) ?? ""), 10);
      if (f && p) uid = `${String(f).padStart(2, "0")}-${String(p).padStart(2, "0")}`;
    }
    if (uid) out.set(uid, arch);
  }
  return out;
}

// Inject `architectural_type` cells into the 07_HTML_Export response. Idempotent
// — if the column already exists on 07, no-op. If the bridge gave us nothing,
// also no-op (architectural_type stays null on each unit, the client falls back
// to the legacy composite floorplan key).
function injectArchColumn(units: GvizResponse, archByUid: Map<string, string>) {
  if (!units.table) return;
  const cols = units.table.cols.map(colName);
  if (cols.includes("architectural_type") || cols.includes("arch_type")) return;
  if (archByUid.size === 0) return;
  const iUid = cols.indexOf("unit_id");
  const iFloor = cols.indexOf("floor");
  const iPos =
    cols.indexOf("unit_no") >= 0
      ? cols.indexOf("unit_no")
      : cols.indexOf("position");
  units.table.cols.push({ label: "architectural_type" });
  for (const row of units.table.rows ?? []) {
    const cell = (i: number): unknown =>
      i < 0 || !row.c || !row.c[i] ? null : row.c[i]!.v;
    let uid = iUid >= 0 ? String(cell(iUid) ?? "").trim() : "";
    if (!uid && iFloor >= 0 && iPos >= 0) {
      const f = parseInt(String(cell(iFloor) ?? ""), 10);
      const p = parseInt(String(cell(iPos) ?? ""), 10);
      if (f && p) uid = `${String(f).padStart(2, "0")}-${String(p).padStart(2, "0")}`;
    }
    const arch = uid ? archByUid.get(uid) || "" : "";
    row.c = row.c || [];
    row.c.push(arch ? { v: arch } : null);
  }
}

export async function GET() {
  try {
    // Fetch both tabs in parallel. The bridge is best-effort — if it fails
    // we still return the units, the client just won't have arch keys.
    const [units, bridge] = await Promise.all([
      fetchGviz(GVIZ_URL),
      fetchGviz(BRIDGE_URL),
    ]);
    if (!units) {
      return NextResponse.json(
        { status: "error", message: "07_HTML_Export fetch failed" },
        { status: 502 },
      );
    }
    const archByUid = buildArchMap(bridge);
    injectArchColumn(units, archByUid);
    return new NextResponse(JSON.stringify(units), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "fetch failed",
      },
      { status: 502 },
    );
  }
}
