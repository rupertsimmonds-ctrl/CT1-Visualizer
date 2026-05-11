import { NextResponse } from "next/server";

// Hardcoded broker PIN. Kept in sync with middleware.ts.
const PIN = "1986";

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

  if (typeof pin !== "string" || pin.trim() !== PIN) {
    return NextResponse.json(
      { ok: false, message: "Wrong PIN" },
      { status: 401 },
    );
  }

  const token = await sha256Hex(PIN + ":ct1-visualizer");
  const res = NextResponse.json({ ok: true });
  res.cookies.set("ct1_auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
  });
  return res;
}
