'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      // If email confirmation is enabled there is no session yet.
      if (!data.session) {
        setMessage('Check your email to confirm your account, then sign in.')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Create account</h1>

      {error && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {message && (
        <p className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          required
          autoComplete="name"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="password"
          required
          autoComplete="new-password"
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Sign up'}
        </button>
      </form>

      <p className="text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600">
          Sign in
        </Link>
      </p>
    </div>
  )
}
