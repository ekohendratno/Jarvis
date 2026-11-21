'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DEMO_COOKIE, DEMO_EMAIL, DEMO_PASSWORD, isDemoEnabled } from './demo-config'
import { createDemoSession } from './demo-session'
import { createClient } from '@/lib/supabase/server'

export async function signInDemo(email: string, password: string) {
  if (!isDemoEnabled()) return { error: 'Login dummy hanya tersedia dalam mode development.' }
  if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    return { error: 'Email atau password dummy salah.' }
  }
  await createDemoSession()
  return { error: null }
}

export async function signOut() {
  ;(await cookies()).delete(DEMO_COOKIE)
  if (!isDemoEnabled()) {
    const { error } = await (await createClient()).auth.signOut()
    if (error) throw new Error('Gagal keluar. Silakan coba lagi.')
  }
  redirect('/login')
}
