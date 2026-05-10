import { NextResponse } from "next/server";

const SHEET_ID = "1FOofWcGkSXXnBWZ70dB7tix9T5lHjV3BL8evePp-URk";
const SHEET_TAB = "08_Floorplans";
// `headers=1` tells gviz to treat row 1 as headers explicitly. Without it
// gviz auto-detects based on the tab's freeze setting, which fails (columns
// come back labelled a/b/c/d) on tabs that don't have row 1 frozen.
const DEFAULT_GVIZ_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
  `?tqx=out:json&headers=1&sheet=${encodeURIComponent(SHEET_TAB)}`;
const GVIZ_URL = process.env.CT1_FLOORPLANS_URL || DEFAULT_GVIZ_URL;

export const dynamic = "force-dynamic";

const FILE_ID_RE = /(?:\/file\/d\/|[?&]id=)([a-zA-Z0-9_-]{20,})/;

function extractFileId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = trimmed.match(FILE_ID_RE);
  if (m) return m[1];
  // Allow a bare ID to be pasted instead of a full URL.
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

type FloorplanRow = {
  bedroom_type: string;
  product_type: string;
  // "Y", "N", or "" — empty acts as a catch-all matching either duplex or non-duplex
  // when no specific Y/N row exists for the same bedroom + product_type combo.
  is_duplex: string;
  file_id: string;
};

function normalizeYN(raw: unknown): string {
  if (raw == null) return "";
  const v = String(raw).trim().toUpperCase();
  if (v === "Y" || v === "YES" || v === "TRUE" || v === "1") return "Y";
  if (v === "N" || v === "NO" || v === "FALSE" || v === "0") return "N";
  return "";
}

export async function GET() {
  try {
    const upstream = await fetch(GVIZ_URL + "&t=" + Date.now(), {
      cache: "no-store",
      headers: { "user-agent": "ct1-visualizer-proxy" },
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { status: "error", message: `gviz HTTP ${upstream.status}` },
        { status: 502 },
      );
    }
    const text = await upstream.text();
    const start = text.indexOf("(");
    const end = text.lastIndexOf(")");
    if (start < 0 || end <= start) {
      return NextResponse.json(
        { status: "error", message: "bad gviz envelope" },
        { status: 502 },
      );
    }
    const json = JSON.parse(text.slice(start + 1, end));

    if (!json || json.status !== "ok") {
      return NextResponse.json(
        {
          status: "error",
          message:
            (json &&
              json.errors &&
              json.errors[0] &&
              json.errors[0].detailed_message) ||
            "gviz error",
        },
        { status: 502 },
      );
    }

    const cols: string[] = (json.table?.cols ?? []).map((c: { label?: string; id?: string }) =>
      ((c.label || c.id || "") + "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_"),
    );
    const ix = (name: string) => cols.indexOf(name);
    const iBed = ix("bedroom_type");
    const iType = ix("product_type");
    const iDup = ix("is_duplex"); // optional — older sheets without this column still work
    const iUrl =
      ix("drive_url") >= 0
        ? ix("drive_url")
        : ix("url") >= 0
          ? ix("url")
          : ix("file_id");

    if (iBed < 0 || iType < 0 || iUrl < 0) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "08_Floorplans missing one of: bedroom_type, product_type, drive_url",
        },
        { status: 502 },
      );
    }

    const rows: FloorplanRow[] = [];
    for (const row of json.table.rows ?? []) {
      const cell = (i: number) =>
        i < 0 || !row.c || !row.c[i] ? null : row.c[i].v;
      const bed = String(cell(iBed) ?? "").trim();
      const type = String(cell(iType) ?? "").trim();
      const dup = iDup >= 0 ? normalizeYN(cell(iDup)) : "";
      const fileId = extractFileId(cell(iUrl));
      if (!bed || !type || !fileId) continue;
      rows.push({
        bedroom_type: bed,
        product_type: type,
        is_duplex: dup,
        file_id: fileId,
      });
    }

    return new NextResponse(
      JSON.stringify({ status: "ok", rows, fetched_at: Date.now() }),
      {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
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
