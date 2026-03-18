// proxy.ts  (project root — same level as app/, not inside it)
// ─────────────────────────────────────────────────────────────────────────────
// Runs on every matched request BEFORE it reaches any page or API route.
// Responsibilities:
//   1. Refresh the Supabase session cookie so it never expires silently.
//   2. Protect ALL routes (except /login and APIs) — redirect unauthenticated users.
// ─────────────────────────────────────────────────────────────────────────────

import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function proxy(request: NextRequest) {
  // 1. Refresh session + get current user (no extra network call — reads cookie).
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // 2. Define our public routes
  const isPublicRoute = pathname === "/login" || pathname.startsWith("/api/");

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
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public asset extensions
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|eot)).*)",
  ],
};