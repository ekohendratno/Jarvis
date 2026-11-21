export type View = 'network' | 'dashboard' | 'talk' | 'workflows' | 'files' | 'connections' | 'assistant' | 'account'
export type Connection = { id: string; app: string; name: string; url: string; token: string; toolCount: number; status: 'connected' | 'error'; error?: string; kind?: 'mcp' | 'composio'; sessionId?: string; accountId?: string; toolkit?: string }
export type Settings = import('@/lib/voice-options').VoiceOptions & { composioApiKey: string; providerId: import('@/lib/ai-providers').ProviderId; baseUrl: string; apiKey: string; model: string; language: string; voiceEnabled: boolean; desktopEnabled: boolean; systemPrompt: string; connections: Connection[] }
export type Message = { role: 'user' | 'assistant'; content: string; createdAt: string }
export type Conversation = { id: string; title: string; messages: Message[]; updatedAt: string }
export type Activity = { id: string; name: string; detail: string; status: 'success' | 'error'; createdAt: string }
export type Workflow = {
  id: string
  name: string
  command: string
  approval: 'always' | 'writes-only' | 'autonomous'
  schedule: 'manual' | 'daily' | 'weekdays' | 'weekly'
  updatedAt: string
}
export type RunStep = {
  id: string
  label: string
  app?: string
  status: 'planned' | 'running' | 'success' | 'error'
  detail?: string
  startedAt?: string
  finishedAt?: string
}
export type RunArtifact = { label: string; url?: string; detail?: string }
export type TaskRun = {
  id: string
  command: string
  status: 'planning' | 'running' | 'completed' | 'failed' | 'stopped'
  approval: 'approved' | 'not-required'
  steps: RunStep[]
  artifacts: RunArtifact[]
  summary?: string
  createdAt: string
  updatedAt: string
}
export type PendingOAuth = { id: string; app: string; toolkit: string; sessionId: string; accountId: string; apiKey: string; createdAt: string }
export type JarvisState = { settings: Settings; pendingOAuth: PendingOAuth[]; conversations: Conversation[]; activities: Activity[]; workflows: Workflow[]; runs: TaskRun[] }
export type PublicSettings = Omit<Settings, 'apiKey' | 'composioApiKey' | 'connections'> & { hasApiKey: boolean; hasComposioApiKey: boolean; connections: (Omit<Connection, 'token'> & { hasToken: boolean })[] }
export type PublicState = Omit<JarvisState, 'settings' | 'pendingOAuth'> & { settings: PublicSettings; desktopAvailable: boolean }
export type AgentEvent = { type: 'conversation' | 'tool' | 'answer' | 'error' | 'done' | 'run'; id?: string; name?: string; app?: string; detail?: string; content?: string; status?: 'success' | 'error'; runId?: string }
