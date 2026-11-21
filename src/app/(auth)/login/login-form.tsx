'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signInDemo } from '@/lib/auth/actions'
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/auth/demo-config'

export default function LoginForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedNext = searchParams.get('next') || '/dashboard'
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') && !/[\\\s]/.test(requestedNext)
    ? requestedNext : '/dashboard'

  const [email, setEmail] = React.useState(demoMode ? DEMO_EMAIL : '')
  const [password, setPassword] = React.useState(demoMode ? DEMO_PASSWORD : '')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (demoMode) {
        const result = await signInDemo(email, password)
        if (result.error) {
          setError(result.error)
          return
        }
      } else {
        const supabase = createClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          setError(signInError.message)
          return
        }
      }
      router.push(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {demoMode && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm">
          <p className="font-medium">Akun dummy lokal</p>
          <p>Email: {DEMO_EMAIL}</p>
          <p>Password: {DEMO_PASSWORD}</p>
          <p className="mt-2">Akun sudah terisi. Klik Masuk demo untuk membuka dashboard.</p>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          aria-label="Email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="password"
          aria-label="Password"
          required
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Signing in…' : demoMode ? 'Masuk demo' : 'Sign in'}
        </button>
      </form>

      {!demoMode && <p className="text-sm">
        No account?{' '}
        <Link href="/signup" className="text-blue-600">
          Sign up
        </Link>
      </p>}
    </>
  )
}
