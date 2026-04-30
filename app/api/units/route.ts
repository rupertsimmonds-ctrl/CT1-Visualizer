import { NextResponse } from "next/server";

const SHEET_ID = "1FOofWcGkSXXnBWZ70dB7tix9T5lHjV3BL8evePp-URk";
const SHEET_TAB = "07_HTML_Export";
const DEFAULT_GVIZ_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
  `?tqx=out:json&sheet=${encodeURIComponent(SHEET_TAB)}`;
const GVIZ_URL = process.env.CT1_GVIZ_URL || DEFAULT_GVIZ_URL;

export const dynamic = "force-dynamic";

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
    return new NextResponse(JSON.stringify(json), {
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
