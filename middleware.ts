import { NextResponse, type NextRequest } from "next/server";

const MOBILE_UA = /iPhone|iPod|Android.*Mobile|Mobile.*Firefox|IEMobile|BlackBerry|webOS/i;

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  if (url.pathname === "/" || url.pathname === "") {
    const ua = req.headers.get("user-agent") || "";
    const target = MOBILE_UA.test(ua) ? "/mobile.html" : "/desktop.html";
    return NextResponse.rewrite(new URL(target, req.url));
  }

  if (url.pathname === "/m" || url.pathname === "/mobile") {
    return NextResponse.rewrite(new URL("/mobile.html", req.url));
  }
  if (url.pathname === "/d" || url.pathname === "/desktop") {
    return NextResponse.rewrite(new URL("/desktop.html", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/m", "/d", "/mobile", "/desktop"],
};
