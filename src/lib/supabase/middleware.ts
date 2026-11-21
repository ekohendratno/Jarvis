import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Refresh the Supabase auth session on every request and update cookies. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Without credentials we cannot refresh anything — let the app still render.
  if (!url || !anonKey) return response

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value })
        response = NextResponse.next({ request })
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '' })
        response = NextResponse.next({ request })
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })

  // IMPORTANT: this call validates the session and refreshes expired tokens.
  await supabase.auth.getUser()

  return response
}
