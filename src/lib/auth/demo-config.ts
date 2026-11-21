// Demo access is local development only; production always uses Supabase.
export function isDemoEnabled() {
  return process.env.NODE_ENV === 'development' && process.env.DEMO_AUTH_ENABLED !== 'false'
}

export const DEMO_EMAIL = 'demo@jarvis.local'
export const DEMO_PASSWORD = 'Jarvis123!'
export const DEMO_COOKIE = 'jarvis-demo-session'
