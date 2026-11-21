export const OAUTH_APPS: Record<string, { toolkit: string; name: string }> = {
  gmail: { toolkit: 'gmail', name: 'Gmail' }, calendar: { toolkit: 'googlecalendar', name: 'Google Calendar' },
  drive: { toolkit: 'googledrive', name: 'Google Drive' }, docs: { toolkit: 'googledocs', name: 'Google Docs' },
  sheets: { toolkit: 'googlesheets', name: 'Google Sheets' }, notion: { toolkit: 'notion', name: 'Notion' },
  github: { toolkit: 'github', name: 'GitHub' }, slack: { toolkit: 'slack', name: 'Slack' },
  youtube: { toolkit: 'youtube', name: 'YouTube' }, x: { toolkit: 'twitter', name: 'Twitter' },
  facebook: { toolkit: 'facebook', name: 'Facebook' }, instagram: { toolkit: 'instagram', name: 'Instagram' },
  discord: { toolkit: 'discord', name: 'Discord' }, spotify: { toolkit: 'spotify', name: 'Spotify' },
}
export function safeAuthorizationUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || !['app.composio.dev', 'connect.composio.dev', 'platform.composio.dev', 'backend.composio.dev'].includes(url.hostname) || url.username || url.password) throw new Error('Provider OAuth mengirim URL otorisasi yang tidak valid.')
  return url.toString()
}
export function accountMatches(account: { id?: string; toolkit?: { slug?: string }; user_id?: string; status?: string; is_disabled?: boolean }, expected: { accountId: string; toolkit: string; userId: string }) {
  return account.id === expected.accountId && account.toolkit?.slug === expected.toolkit && (!account.user_id || account.user_id === expected.userId) && account.status === 'ACTIVE' && !account.is_disabled
}
