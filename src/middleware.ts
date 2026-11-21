import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { isDemoEnabled } from '@/lib/auth/demo-config'

const PROTECTED_PREFIXES = ['/dashboard']

export async function middleware(request: NextRequest) {
  // Demo sessions are validated by the dashboard on the server.
  if (isDemoEnabled()) return NextResponse.next({ request })
  const response = await updateSession(request)

  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))

  if (isProtected) {
    // Session cookie presence check; full validation happens in the page via getUser().
    const hasSession = request.cookies.has('sb-') || [...request.cookies.getAll()].some((c) => c.name.startsWith('sb-'))
    if (!hasSession) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
