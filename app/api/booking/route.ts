import { NextResponse } from "next/server";

// Posts each viewing booking to a Google Apps Script web-app endpoint.
// The endpoint URL lives in env (CT1_BOOKING_URL) so the static HTML never
// sees it directly — keeps things gated behind the PIN-protected proxy.
const APPS_SCRIPT_URL = process.env.CT1_BOOKING_URL || "";

export const dynamic = "force-dynamic";

type BookingPayload = {
  unit_id?: string;
  unit_label?: string;
  bedroom_type?: string;
  viewing_date?: string;
  viewing_time?: string;
  engage_ref?: string;
  applicant_name?: string;
  mobile_last4?: string;
  broker?: string;
};

export async function POST(req: Request) {
  if (!APPS_SCRIPT_URL) {
    return NextResponse.json(
      { status: "error", message: "booking endpoint not configured" },
      { status: 503 },
    );
  }
  let body: BookingPayload;
  try {
    body = (await req.json()) as BookingPayload;
  } catch {
    return NextResponse.json(
      { status: "error", message: "bad JSON" },
      { status: 400 },
    );
  }
  if (
    !body.unit_id ||
    !body.viewing_date ||
    !body.viewing_time ||
    !body.applicant_name ||
    !/^\d{4}$/.test(body.mobile_last4 || "")
  ) {
    return NextResponse.json(
      { status: "error", message: "missing/invalid fields" },
      { status: 400 },
    );
  }
  try {
    const upstream = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      // Apps Script web apps follow redirects on POST; node-fetch handles it.
      redirect: "follow",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...body,
        // Stamp here so the sheet timestamp is the actual booking moment,
        // not the script execution moment (which can lag by a few seconds).
        timestamp: new Date().toISOString(),
      }),
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { status: "error", message: `upstream ${upstream.status}` },
        { status: 502 },
      );
    }
    const text = await upstream.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Apps Script can return non-JSON on errors; surface raw text.
      parsed = text;
    }
    return NextResponse.json({ status: "ok", upstream: parsed });
  } catch (e) {
    return NextResponse.json(
      {
        status: "error",
        message: e instanceof Error ? e.message : "fetch failed",
      },
      { status: 502 },
    );
  }
}
