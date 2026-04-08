import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname;
    const token = (req as any).nextauth?.token as
      | { role?: string; youtubeAccess?: boolean; linkedinAccess?: boolean; xAccess?: boolean }
      | undefined;

    if (pathname.startsWith("/youtube")) {
      const allowed = token?.role === "admin" || token?.youtubeAccess === true;
      if (!allowed) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    if (pathname.startsWith("/linkedin")) {
      const allowed = token?.role === "admin" || token?.linkedinAccess === true;
      if (!allowed) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    if (pathname.startsWith("/x")) {
      const allowed = token?.role === "admin" || token?.xAccess === true;
      if (!allowed) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/youtube/:path*", "/linkedin/:path*", "/x/:path*"],
};

