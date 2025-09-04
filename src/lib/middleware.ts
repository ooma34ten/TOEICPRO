import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 保護したいパス配下
const protectedPrefixes = ["/words", "/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 対象外（静的資産など）
  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) return NextResponse.next();

  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // SupabaseのCookie（sb:token系）が無いときはログインへ
  const hasSupabaseSession =
    req.cookies.has("sb-access-token") || req.cookies.has("sb-refresh-token");

  if (!hasSupabaseSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
// See "Matching Paths" below to learn more