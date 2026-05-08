import { NextResponse, type NextRequest } from "next/server";

const MOBILE_UA = /iPhone|iPod|Android.*Mobile|Mobile.*Firefox|IEMobile|BlackBerry|webOS/i;

// Paths that bypass the PIN gate.
const PUBLIC_EXACT = new Set([
  "/pin",
  "/api/pin",
  "/favicon.ico",
  "/bh-mark.svg",
]);

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function expectedAuthToken(): Promise<string | null> {
  const pin = process.env.CT1_PIN;
  if (!pin) return null;
  return sha256Hex(pin + ":ct1-visualizer");
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  if (PUBLIC_EXACT.has(path) || path.startsWith("/_next/")) {
    return NextResponse.next();
  }

  const expected = await expectedAuthToken();
  if (expected !== null) {
    const have = req.cookies.get("ct1_auth")?.value;
    if (have !== expected) {
      const target = new URL("/pin", req.url);
      return NextResponse.rewrite(target);
    }
  }

  if (path === "/" || path === "") {
    const ua = req.headers.get("user-agent") || "";
    const target = MOBILE_UA.test(ua) ? "/mobile.html" : "/desktop.html";
    return NextResponse.rewrite(new URL(target, req.url));
  }

  if (path === "/m" || path === "/mobile") {
    return NextResponse.rewrite(new URL("/mobile.html", req.url));
  }
  if (path === "/d" || path === "/desktop") {
    return NextResponse.rewrite(new URL("/desktop.html", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on every path; the function itself short-circuits public assets.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
