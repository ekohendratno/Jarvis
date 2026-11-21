import React from 'react'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold">Jarvis AI Assistant</h1>
      <p className="opacity-70">Starter file — the app boots successfully.</p>
      <nav className="flex gap-4">
        <Link href="/login" className="text-blue-600 underline">
          Login
        </Link>
        <Link href="/signup" className="text-blue-600 underline">
          Signup
        </Link>
        <Link href="/sites/demo" className="text-blue-600 underline">
          Demo site
        </Link>
      </nav>
    </main>
  )
}
