'use client'

import { useFormStatus } from 'react-dom'
import { signOut } from '@/lib/auth/actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border px-4 py-2 text-sm disabled:opacity-50"
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}

export default function SignOutButton() {
  return <form action={signOut}><SubmitButton /></form>
}
