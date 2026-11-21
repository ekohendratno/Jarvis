import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import JarvisApp from '@/components/jarvis/jarvis-app'
import { getDemoUser } from '@/lib/auth/demo-session'
import { isDemoEnabled } from '@/lib/auth/demo-config'

export default async function DashboardPage() {
  const demoMode = isDemoEnabled()
  const user = demoMode
    ? await getDemoUser()
    : (await (await createClient()).auth.getUser()).data.user

  if (!user) redirect('/login')

  return <JarvisApp email={user.email || ''} name={demoMode ? 'Demo User' : user.user_metadata?.full_name || 'Your workspace'} />
}
