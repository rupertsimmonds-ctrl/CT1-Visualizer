import { NextResponse } from "next/server";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { pin } = await req.json().catch(() => ({}) as { pin?: string });
  const expected = process.env.CT1_PIN;

  if (!expected) {
    return NextResponse.json({ ok: true, gateOff: true });
  }

  if (typeof pin !== "string" || pin.trim() !== expected) {
    return NextResponse.json(
      { ok: false, message: "Wrong PIN" },
      { status: 401 },
    );
  }

  const token = await sha256Hex(expected + ":ct1-visualizer");
  const res = NextResponse.json({ ok: true });
  res.cookies.set("ct1_auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
  });
  return res;
}
