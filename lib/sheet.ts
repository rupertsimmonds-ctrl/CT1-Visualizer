import { SHEET_ID, SHEET_TAB, BEDROOM_CODE, REVALIDATE_SECONDS } from "./constants";
import { classify } from "./classify";
import type { Unit, UnitsPayload, BedroomCode } from "./types";

const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_TAB)}`;

interface GvizCell {
  v: string | number | null;
  f?: string;
}
interface GvizRow {
  c: (GvizCell | null)[];
}
interface GvizCol {
  id: string;
  label: string;
  type: string;
}
interface GvizTable {
  cols: GvizCol[];
  rows: GvizRow[];
}
interface GvizResponse {
  status: "ok" | "error";
  errors?: { detailed_message?: string }[];
  table?: GvizTable;
}

function stripJsonp(text: string): GvizResponse {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("malformed gviz response");
  return JSON.parse(text.slice(start, end + 1));
}

function parseRows(table: GvizTable): Unit[] {
  const cols = table.cols.map((c) =>
    ((c.label || c.id || "") + "").trim().toLowerCase().replace(/\s+/g, "_")
  );
  const ix = (name: string) => cols.indexOf(name);
  const need = [
    "unit_id", "floor", "unit_no", "bedroom_type", "is_duplex", "view_code",
    "total_sqft", "asking_rent_aed", "current_asking_aed", "asking_psf",
    "status", "agency_won", "tranche",
  ];
  for (const n of need) {
    if (ix(n) < 0) throw new Error(`expected column missing: ${n}`);
  }

  const iBalc = ix("balcony");
  const iBsq = ix("balcony_sqft");
  const get = (row: GvizRow, i: number) => (i < 0 || !row.c[i]) ? null : row.c[i]!.v;

  const units: Unit[] = [];
  for (const row of table.rows) {
    const f = parseInt(String(get(row, ix("floor")) ?? ""), 10);
    const p = parseInt(String(get(row, ix("unit_no")) ?? ""), 10);
    if (!f || !p) continue;

    const bedRaw = String(get(row, ix("bedroom_type")) ?? "").trim();
    const t: BedroomCode = (BEDROOM_CODE[bedRaw] ?? BEDROOM_CODE[bedRaw.replace(/\s*Duplex$/i, "")] ?? "studio") as BedroomCode;
    const status = String(get(row, ix("status")) ?? "Not Launched").trim();
    const agency = String(get(row, ix("agency_won")) ?? "").trim();
    const cur = parseFloat(String(get(row, ix("current_asking_aed")) ?? "")) || parseFloat(String(get(row, ix("asking_rent_aed")) ?? "")) || 0;
    const orig = parseFloat(String(get(row, ix("asking_rent_aed")) ?? "")) || cur;

    units.push({
      uid: String(get(row, ix("unit_id")) ?? `${String(f).padStart(2, "0")}-${String(p).padStart(2, "0")}`),
      f, p, t,
      d: String(get(row, ix("is_duplex")) ?? "").toUpperCase() === "Y",
      v: String(get(row, ix("view_code")) ?? "").trim(),
      sq: parseFloat(String(get(row, ix("total_sqft")) ?? "")) || 0,
      pr: cur,
      orig,
      psf: parseFloat(String(get(row, ix("asking_psf")) ?? "")) || null,
      tr: String(get(row, ix("tranche")) ?? "").trim(),
      b: String(get(row, iBalc) ?? "").toUpperCase() === "Y",
      bsq: parseFloat(String(get(row, iBsq) ?? "")) || 0,
      s: classify(status, agency),
    });
  }
  return units;
}

async function loadSnapshot(): Promise<Unit[]> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const file = path.join(process.cwd(), "public", "snapshot.json");
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as Unit[];
}

export async function fetchUnits(): Promise<UnitsPayload> {
  try {
    const res = await fetch(GVIZ_URL, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) throw new Error(`gviz HTTP ${res.status}`);
    const text = await res.text();
    const data = stripJsonp(text);
    if (data.status !== "ok" || !data.table) {
      throw new Error(data.errors?.[0]?.detailed_message || "gviz error");
    }
    const units = parseRows(data.table);
    if (units.length < 100) throw new Error(`only ${units.length} rows`);
    return { units, source: "live", fetchedAt: new Date().toISOString() };
  } catch (err) {
    const units = await loadSnapshot();
    return {
      units,
      source: "snapshot",
      fetchedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
