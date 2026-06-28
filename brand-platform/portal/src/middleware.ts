import { NextResponse, type NextRequest } from "next/server";
import { PORTAL_SESSION_COOKIE } from "@/lib/firebase/session";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/invite",
  "/verify-email",
  "/admin/leads",
  "/admin/challenges",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/session-status",
  "/api/auth/resend-verification",
  "/api/brands/register",
  "/api/brands/staff/accept",
  "/api/leads",
  "/api/admin/leads",
  "/api/admin/challenges",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Edge-safe middleware — cookie presence only; full verification runs in server routes/layouts. */
export async function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(PORTAL_SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/v1/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && isPublic(pathname)) {
    return NextResponse.next();
  }

  if (!hasSession && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    const nextPath = pathname + request.nextUrl.search;
    url.pathname = "/login";
    url.search = `next=${encodeURIComponent(nextPath)}`;
    return NextResponse.redirect(url);
  }

  if (hasSession && ["/login", "/signup"].includes(pathname)) {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.searchParams.get("next");
    url.pathname = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
