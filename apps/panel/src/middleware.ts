import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'healthpanel-token';

const PUBLIC_PATHS = ['/login'];
const EXCLUDED_PREFIXES = ['/api/auth/', '/_next/', '/favicon.ico'];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) {
    return true;
  }

  for (const prefix of EXCLUDED_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const isAuthenticated = Boolean(token);

  // Allow public paths through without redirect
  if (isPublicPath(pathname)) {
    // If authenticated and trying to access /login, redirect to /dashboard
    if (isAuthenticated && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Protected route: no token → redirect to /login
  if (!isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
