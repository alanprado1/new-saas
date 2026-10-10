// proxy.ts  (project root — same level as app/, not inside it)
// ─────────────────────────────────────────────────────────────────────────────
// Runs on every matched request BEFORE it reaches any page or API route.
// Responsibilities:
//   1. Refresh the Supabase session cookie so it never expires silently.
//   2. Protect ALL routes by default. Public pages and public APIs must be explicit.
// ─────────────────────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { isLocalWalkthroughRequest, isWalkthroughPath } from "@/lib/busuu/local-walkthrough";

const PUBLIC_PAGE_ROUTES = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
]);

// APIs are authenticated by default. Add exact paths here only when an API is
// intentionally public and safe to call without a user session.
const PUBLIC_API_ROUTES = new Set<string>();

function isApiRoute(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isPublicPageRoute(pathname: string): boolean {
  return PUBLIC_PAGE_ROUTES.has(pathname) || pathname.startsWith("/auth/");
}

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.has(pathname);
}

function copyResponseCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach(({ name, value, ...options }) => {
    to.cookies.set(name, value, options);
  });
  return to;
}

export async function proxy(request: NextRequest) {
  // Local walkthrough (development + BUSUU_LOCAL_WALKTHROUGH=1 + loopback host only): the course pages and course
  // attempt API skip Supabase entirely. Every other path, and every request when the gate is off, is unchanged.
  if (isWalkthroughPath(request.nextUrl.pathname) && isLocalWalkthroughRequest(request)) {
    return NextResponse.next({ request });
  }

  // 1. Refresh session + get current user (no extra network call — reads cookie).
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const apiRoute = isApiRoute(pathname);
  const isPublicRoute = isPublicPageRoute(pathname) || isPublicApiRoute(pathname);

  // 2. APIs are protected by default. Return JSON rather than redirecting fetch
  // callers to the login page.
  if (!user && apiRoute && !isPublicApiRoute(pathname)) {
    return copyResponseCookies(
      supabaseResponse,
      NextResponse.json(
        { error: "Unauthorized. Invalid or expired session." },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        },
      ),
    );
  }

  // 3. If they are NOT logged in and trying to view a private page, kick them to /login
  if (!user && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url);
    
    // Preserve the intended destination so we can redirect back after login.
    // (We skip saving "/" as a destination since it's the default anyway)
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    
    return NextResponse.redirect(loginUrl);
  }

  // 4. Already logged in and trying to visit /login → send to dashboard.
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Return the supabaseResponse unchanged — it carries the refreshed cookie.
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico, sitemap.xml, robots.txt, manifest.json
     * - kanji/ (public stroke-animation geometry and notices)
     * - Public asset extensions
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|manifest\\.json|kanji/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|eot)).*)",
  ],
};
