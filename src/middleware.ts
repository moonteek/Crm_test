import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Cheap signature check only; pages re-check the user (active, permissions) against the database.
export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session && req.nextUrl.pathname !== "/login") return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  // /api/mcp authenticates with bearer tokens instead of the session cookie.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/mcp).*)"],
};
