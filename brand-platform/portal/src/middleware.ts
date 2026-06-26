import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  "/api/brands/register",
  "/api/brands/staff/accept",
  "/api/leads",
  "/api/admin/leads",
  "/api/admin/challenges",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Mobile API v1 — Bearer auth handled in route handlers
  if (pathname.startsWith("/api/v1/")) {
    return response;
  }

  if (pathname.startsWith("/api/") && isPublic(pathname)) {
    return response;
  }

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    const nextPath = pathname + request.nextUrl.search;
    url.pathname = "/login";
    url.search = `next=${encodeURIComponent(nextPath)}`;
    return NextResponse.redirect(url);
  }

  const isRedeemLanding = pathname.startsWith("/r/");

  const skipVerification = process.env.SKIP_EMAIL_VERIFICATION === "true";
  const onboardingApi =
    pathname === "/api/brands/me" ||
    pathname === "/api/brands/logo";

  const needsVerification =
    user &&
    !skipVerification &&
    !user.email_confirmed_at &&
    pathname !== "/verify-email" &&
    !pathname.startsWith("/api/auth/") &&
    !onboardingApi &&
    !isRedeemLanding &&
    pathname !== "/scan" &&
    !pathname.startsWith("/verify-email");

  if (needsVerification && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/verify-email";
    return NextResponse.redirect(url);
  }

  if (user && isPublic(pathname) && ["/login", "/signup"].includes(pathname)) {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.searchParams.get("next");
    const destination =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    url.pathname =
      user.email_confirmed_at || skipVerification ? destination : "/verify-email";
    if (!(user.email_confirmed_at || skipVerification) && next) {
      url.searchParams.set("next", next);
    } else {
      url.search = "";
    }
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
