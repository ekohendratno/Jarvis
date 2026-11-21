import { Suspense } from 'react'
import { isDemoEnabled } from '@/lib/auth/demo-config'
import LoginForm from './login-form'

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <Suspense fallback={<p className="text-sm opacity-60">Loading…</p>}>
        <LoginForm demoMode={isDemoEnabled()} />
      </Suspense>
    </div>
  )
}
