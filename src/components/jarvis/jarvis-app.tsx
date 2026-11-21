'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, ArrowDownToLine, ArrowUp, AudioLines, Brain, Check, ChevronDown, ChevronRight, CircleAlert, ExternalLink, FileText, Folder, GitBranch, LayoutDashboard, Loader2, Menu, MessageSquare, Mic, MicOff, Monitor, Network, Plug, Plus, Settings2, ShieldCheck, Square, Trash2, Upload, UserRound, Volume2, VolumeX, X, Zap, AlertCircle } from 'lucide-react'
import { NeuralNetwork } from './neural-network'
import { APPS } from './catalog'
import { useJarvisVoice } from '@/hooks/useJarvisVoice'
import type { AgentEvent, Message, PublicSettings, PublicState, TaskRun, View } from '@/types/jarvis'
import SignOutButton from '@/app/(dashboard)/dashboard/sign-out-button'
import './jarvis.css'
import { VoiceSettings } from './voice-settings'
import { ProviderSettings } from './provider-settings'
import { AppConnections } from './app-connections'
import { isLocalEndpoint } from '@/lib/ai-providers'
import { AssistantMessage } from './assistant-message'
import { createExecutionPlan, ExecutionPlanCard, type ExecutionPlan } from './execution-plan'

const NAV = [
  { id: 'network', title: 'Network', icon: Network }, { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard },
  { id: 'talk', title: 'Talk', icon: AudioLines }, { id: 'workflows', title: 'Workflows', icon: GitBranch },
  { id: 'files', title: 'Files', icon: Folder }, { id: 'connections', title: 'Connections', icon: Plug },
  { id: 'assistant', title: 'Assistant', icon: Settings2 }, { id: 'account', title: 'Account', icon: UserRound },
] as const
const BUILTIN = ['chat', 'files', 'memory', 'time']

async function jsonResponse(response: Response) {
  const body = await response.json()
  if (response.status === 401) window.location.assign('/login')
  if (!response.ok) throw new Error(body.error || `Permintaan gagal (${response.status}).`)
  return body
}
function timeAgo(date: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000))
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : new Date(date).toLocaleDateString('id-ID')
}

export default function JarvisApp({ email, name }: { email: string; name: string }) {
  const [view, setView] = useState<View>('network')
  const [data, setData] = useState<PublicState | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [selectedApp, setSelectedApp] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [command, setCommand] = useState('')
  const [busy, setBusy] = useState(false)
  const [currentTool, setCurrentTool] = useState('')
  const [activeApp, setActiveApp] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<ExecutionPlan | null>(null)
  const speechEnabled = useRef(false)
  speechEnabled.current = !!data?.settings.voiceEnabled && !muted
  const abort = useRef<AbortController | null>(null)
  const commandRef = useRef<HTMLTextAreaElement>(null)
  const transcript = useRef<HTMLDivElement>(null)
  const sendRef = useRef<(text: string) => void>(() => {})
  const voice = useJarvisVoice(text => sendRef.current(text), data?.settings.language || 'id-ID', data?.settings)

  const load = useCallback(async () => {
    const state = await jsonResponse(await fetch('/api/jarvis/state', { cache: 'no-store' }))
    setData(state)
    return state as PublicState
  }, [])
  useEffect(() => { load().catch(e => setError(e.message)); return () => abort.current?.abort() }, [load])
  useEffect(() => { if (toast) { const timeout = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timeout) } }, [toast])
  useEffect(() => { transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'smooth' }) }, [messages, busy])

  async function mutate(body: Record<string, unknown>) {
    const state = await jsonResponse(await fetch('/api/jarvis/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
    if (state.settings) setData(state)
    return state
  }

  async function send(text: string, plan?: ExecutionPlan) {
    const clean = text.trim()
    if (!clean || busy) return
    voice.stop(); voice.prepare(); setCommand(''); setError(''); setBusy(true); setCurrentTool('Thinking')
    setMessages(previous => [...previous, { role: 'user', content: clean, createdAt: new Date().toISOString() }])
    const controller = new AbortController()
    abort.current = controller
    try {
      const response = await fetch('/api/jarvis/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: clean, ...(conversationId ? { conversationId } : {}), ...(plan ? { approved: plan.needsApproval, plan: plan.steps } : {}) }), signal: controller.signal })
      if (!response.ok) { await jsonResponse(response); return }
      const reader = response.body?.getReader()
      if (!reader) throw new Error('Streaming tidak tersedia. Muat ulang halaman.')
      const decoder = new TextDecoder()
      let pending = ''
      const consume = (event: AgentEvent) => {
        if (event.type === 'conversation' && event.id) setConversationId(event.id)
        if (event.type === 'tool') { setCurrentTool(event.status === 'error' ? `${event.name}: gagal` : event.name || 'Working'); setActiveApp(event.app || null) }
        if (event.type === 'answer' && event.content) {
          setMessages(previous => [...previous, { role: 'assistant', content: event.content!, createdAt: new Date().toISOString() }])
          if (speechEnabled.current) voice.speak(event.content)
        }
        if (event.type === 'error') setError(event.content || 'Perintah gagal.')
      }
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        pending += decoder.decode(value, { stream: true })
        const lines = pending.split('\n'); pending = lines.pop() || ''
        for (const line of lines) if (line.trim()) consume(JSON.parse(line))
      }
      if (pending.trim()) consume(JSON.parse(pending))
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') setError(err.message)
    } finally {
      setBusy(false); setCurrentTool(''); setActiveApp(null); abort.current = null
      await load().catch(() => {})
    }
  }
  function requestExecution(text: string, policy?: 'always' | 'writes-only' | 'autonomous') {
    const clean = text.trim()
    if (!clean || busy) return
    voice.stop()
    const plan = createExecutionPlan(clean)
    if (policy === 'always') plan.needsApproval = true
    if (policy === 'autonomous') { plan.needsApproval = true; void send(clean, plan); return }
    setPendingPlan(plan)
  }
  sendRef.current = requestExecution

  function navigate(next: View) { setView(next); setMobileNav(false); setError('') }
  function newConversation() {
    if (busy) return
    voice.stop(); setConversationId(null); setMessages([]); setCommand(''); setView('network'); setMobileNav(false)
    commandRef.current?.focus()
  }
  function selectApp(id: string) {
    if (id === 'chat') navigate('talk')
    else if (id === 'files') navigate('files')
    else if (id === 'voice' || id === 'desktop') navigate('assistant')
    else if (id === 'memory') navigate('dashboard')
    else { setSelectedApp(id); navigate('connections') }
  }
  const connected = [...BUILTIN, ...(voice.supported ? ['voice'] : []), ...(data?.settings.desktopEnabled && data.desktopAvailable ? ['desktop', 'web'] : []), ...(data?.settings.connections.filter(c => c.status === 'connected').map(c => c.app) || [])]
  const status = voice.listening ? 'Listening…' : voice.speaking ? 'Speaking…' : voice.preparing ? 'Preparing voice…' : busy ? 'Thinking…' : 'Tap to talk'

  return (
    <div className="jarvis-app">
      {mobileNav && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
      <aside className={`jarvis-sidebar ${mobileNav ? 'open' : ''}`}>
        <button className="jarvis-brand" onClick={() => navigate('network')}><span className="brand-mark"><Brain size={17}/></span><strong>Jarvis</strong><span className="brand-version">personal AI</span></button>
        <button className="new-conversation" onClick={newConversation} disabled={busy}><Plus size={14}/> NEW CONVERSATION</button>
        <nav aria-label="Main navigation">{NAV.map(item => <button key={item.id} className={`nav-item ${view === item.id ? 'selected' : ''}`} onClick={() => navigate(item.id)}><item.icon size={15}/><span>{item.title}</span>{view === item.id && <span className="nav-selected-dot"/>}{item.id === 'connections' && !!data?.settings.connections.length && <small>{data.settings.connections.length}</small>}</button>)}</nav>
        <div className="history-label">HISTORY<span>{data?.conversations.length || 0}</span></div>
        <div className="sidebar-history">
          {!data?.conversations.length && <p className="history-empty">Your conversations<br/>will appear here.</p>}
          {data?.conversations.map(conversation => <button key={conversation.id} disabled={busy} className={`history-item ${conversationId === conversation.id ? 'current' : ''}`} onClick={() => { voice.stop(); setConversationId(conversation.id); setMessages(conversation.messages); navigate('talk') }}><span>{conversation.title}</span><small>{timeAgo(conversation.updatedAt)}</small></button>)}
        </div>
        <div className="sidebar-footer"><div className="workspace-status"><i/><span>Local workspace</span><ShieldCheck size={13}/></div><button className="profile-button" onClick={() => navigate('account')}><span className="profile-avatar">{name.slice(0, 1)}</span><span><strong>{name}</strong><small>Personal account</small></span><ChevronDown size={13}/></button></div>
      </aside>

      <main className="jarvis-main">
        <header className="jarvis-header"><div><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={19}/></button><h1>{NAV.find(item => item.id === view)?.title}</h1>{view === 'network' && <span className="header-description">Your connected intelligence</span>}</div><div className="header-right"><span className={`provider-indicator ${data?.settings.hasApiKey ? 'ready' : ''}`}><i/>{data?.settings.hasApiKey ? data.settings.model : 'Local mode'}</span><button className="icon-button" aria-label="Assistant settings" onClick={() => navigate('assistant')}><Settings2 size={17}/></button></div></header>
        {error && <div className="app-alert" role="alert"><AlertCircle size={16}/><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={15}/></button></div>}
        {voice.error && <div className="app-alert voice-alert" role="alert"><MicOff size={16}/><span>{voice.error}</span></div>}
        {!data ? <div className="page-loading"><Loader2 className="spin" size={24}/><p>{error ? 'Jarvis belum dapat dimuat.' : 'Preparing your workspace…'}</p><button onClick={() => { setError(''); void load().catch(e => setError(e.message)) }}>Coba lagi</button></div> : <>
          {(view === 'network' || view === 'talk') && <section className={`conversation-workspace ${view === 'talk' ? 'talk-view' : ''}`}>
            {view === 'network' && <NeuralNetwork connected={connected} busy={busy || voice.listening || voice.speaking} activeApp={activeApp} status={status} onSelect={selectApp} onCore={() => { if (busy) return; if (voice.listening || voice.speaking) voice.stop(); else voice.start() }} onActivity={() => setShowActivity(v => !v)}/>}
            {view === 'talk' && !messages.length && <div className="talk-welcome"><div className="talk-brain"><Brain size={46} strokeWidth={1}/></div><h2>What can I do for you?</h2><p>Speak naturally. I’ll take it from here.</p><div className="suggested-commands">{['Jam berapa sekarang?', 'Lihat catatan saya', 'Buka kalkulator'].map(text => <button key={text} onClick={() => void send(text)}>{text}<ArrowUp size={13}/></button>)}</div></div>}
            <div className="conversation-transcript" ref={transcript} aria-live="polite">
              {!messages.length && view === 'network' && <div className="transcript-empty"><span>One conversation. Everything connected.</span><p>Ask Jarvis to find, create, or get things done.</p></div>}
              {messages.map((message, index) => <div key={`${index}-${message.createdAt}`} className={`chat-message ${message.role}`}><div className="message-avatar">{message.role === 'assistant' ? <Brain size={15}/> : <UserRound size={14}/>}</div><div><span className="message-author">{message.role === 'assistant' ? 'Jarvis' : 'You'}</span>{message.role === 'assistant' ? <AssistantMessage content={message.content}/> : <p>{message.content}</p>}</div></div>)}
              {busy && <div className="thinking-indicator"><span/><span/><span/><small>{currentTool.replaceAll('_', ' ')}</small></div>}
            </div>
            <div className="composer-area">
              <div className="voice-status"><span className={voice.listening || voice.speaking ? 'voice-active' : ''}>{voice.listening ? 'Listening. Speak your command.' : voice.speaking ? 'Speaking. Tap to interrupt.' : voice.preparing ? 'Preparing voice…' : busy ? 'Working on your request' : 'Ready when you are'}{(voice.listening || voice.speaking) && <AudioLines size={13}/>}</span><button aria-label={muted ? 'Enable voice replies' : 'Mute voice replies'} onClick={() => { if (!muted) voice.stop(); setMuted(!muted) }}>{muted ? <VolumeX size={14}/> : <Volume2 size={14}/>}</button></div>
              {pendingPlan && <ExecutionPlanCard plan={pendingPlan} onCancel={() => { setCommand(pendingPlan.command); setPendingPlan(null); commandRef.current?.focus() }} onApprove={() => { const plan = pendingPlan; setPendingPlan(null); void send(plan.command, plan) }}/>}<form className={`command-composer ${voice.listening ? 'listening' : ''}`} onSubmit={event => { event.preventDefault(); requestExecution(command) }}><button type="button" className={`mic-button ${voice.listening ? 'active' : ''}`} disabled={busy} onClick={() => voice.listening ? voice.stop() : voice.start()} aria-label={voice.listening ? 'Stop microphone' : 'Start microphone'}>{voice.listening ? <AudioLines size={19}/> : <Mic size={18}/>}</button><textarea ref={commandRef} rows={1} aria-label="Message Jarvis" placeholder={voice.interim || 'Ask Jarvis anything, or tap to talk…'} value={command} disabled={busy} onChange={event => setCommand(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); requestExecution(command) } }}/>{busy ? <button type="button" className="send-button stop" aria-label="Stop command" onClick={() => { abort.current?.abort(); voice.stop() }}><Square size={14}/></button> : <button className="send-button" type="submit" disabled={!command.trim()} aria-label="Send message"><ArrowUp size={18}/></button>}</form>
              <div className="composer-caption"><span><span className="tiny-dot"/> {connected.filter(id => APPS.some(app => app.id === id)).length} connections active</span><span>Enter to send <span className="keyboard-key">↵</span></span></div>
            </div>
          </section>}
          {view === 'dashboard' && <div className="content-page"><PageTitle title={`Welcome back, ${name.split(' ')[0]}.`} description="A little context for everything you do."/><div className="dashboard-overview"><div><MessageSquare/><strong>{data.conversations.length}</strong><span>Conversations</span></div><div><Zap/><strong>{data.activities.filter(a => a.status === 'success').length}</strong><span>Actions completed</span></div><div><Plug/><strong>{data.settings.connections.length}</strong><span>Connected services</span></div><div><GitBranch/><strong>{data.workflows.length}</strong><span>Workflows</span></div></div><ExecutionCenter runs={data.runs || []}/><div className="section-heading"><h3>Recent conversations</h3><button className="text-button" onClick={newConversation}>New conversation <Plus size={14}/></button></div><div className="data-list">{!data.conversations.length && <Empty icon={MessageSquare} title="Start with a conversation" description="Your conversations and real activity will appear here."/>}{data.conversations.slice(0, 8).map(c => <div className="conversation-row" key={c.id}><button onClick={() => { setConversationId(c.id); setMessages(c.messages); navigate('talk') }}><MessageSquare size={17}/><span><strong>{c.title}</strong><small>{c.messages.length} messages · {timeAgo(c.updatedAt)}</small></span><ChevronRight size={16}/></button><button className="icon-button" aria-label={`Delete ${c.title}`} onClick={() => { void mutate({ action: 'delete-conversation', id: c.id }).catch(e => setError(e.message)) }}><Trash2 size={15}/></button></div>)}</div><div className="section-heading"><h3>Activity</h3><span>{data.activities.length} recorded actions</span></div><ActivityList data={data}/></div>}
          {view === 'connections' && <AppConnections refresh={load} data={data} connected={connected} selected={selectedApp} setSelected={setSelectedApp} mutate={mutate} notify={setToast} onError={setError} navigate={navigate}/>}
          {view === 'assistant' && <Assistant stopReply={voice.stop} settings={data.settings} desktopAvailable={data.desktopAvailable} mutate={mutate} notify={setToast} onError={setError}/>}
          {view === 'files' && <Files onError={setError} notify={setToast}/>}
          {view === 'workflows' && <Workflows data={data} mutate={mutate} busy={busy} run={workflow => { navigate('talk'); requestExecution(workflow.command, workflow.approval) }} onError={setError}/>} 
          {view === 'account' && <div className="content-page account-page"><PageTitle title="Your workspace" description="Personal by design. Everything starts with you."/><div className="account-profile"><span className="large-avatar">{name[0]}</span><div><h3>{name}</h3><p>{email}</p></div></div><div className="settings-section"><h3>Session</h3><div className="account-detail"><span>Account type</span><strong>Local personal workspace</strong></div><div className="account-detail"><span>Data storage</span><strong>Encrypted on this computer</strong></div><div className="account-detail"><span>AI provider</span><strong>{data.settings.hasApiKey ? data.settings.model : 'Not configured'}</strong></div></div><div className="account-actions"><button className="secondary-button" onClick={() => { const blob = new Blob([JSON.stringify({ conversations: data.conversations, activities: data.activities, workflows: data.workflows }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'jarvis-workspace.json'; anchor.click(); URL.revokeObjectURL(url) }}><ArrowDownToLine size={15}/> Export workspace</button><SignOutButton/></div></div>}
        </>}
        {showActivity && <aside className="activity-drawer"><div className="section-heading"><h3>Live activity</h3><button className="icon-button" aria-label="Close activity" onClick={() => setShowActivity(false)}><X size={18}/></button></div>{busy && <div className="activity-live"><Loader2 className="spin" size={15}/>{currentTool}</div>}{data && <ActivityList data={data}/>}</aside>}
      </main>
      {toast && <div className="app-toast" role="status"><Check size={16}/>{toast}</div>}
    </div>
  )
}

function PageTitle({ title, description }: { title: string; description: string }) { return <div className="page-title"><h2>{title}</h2><p>{description}</p></div> }
function Empty({ icon: Icon, title, description }: { icon: typeof Folder; title: string; description: string }) { return <div className="empty-state"><Icon size={27} strokeWidth={1.3}/><h3>{title}</h3><p>{description}</p></div> }
function ActivityList({ data }: { data: PublicState }) {
  return <div className="activity-list">{!data.activities.length && <Empty icon={Activity} title="Nothing to report yet" description="Actions will appear here as Jarvis works."/>}{data.activities.slice(0, 40).map(a => <div className="activity-row" key={a.id}><span className={`activity-result ${a.status}`}>{a.status === 'success' ? <Check size={13}/> : <X size={13}/>}</span><div><strong>{a.name.replaceAll('_', ' ')}</strong><p>{a.detail}</p></div><time>{timeAgo(a.createdAt)}</time></div>)}</div>
}

function ExecutionCenter({ runs }: { runs: TaskRun[] }) {
  const [expanded, setExpanded] = useState<string | null>(runs[0]?.id || null)
  const latest = runs.slice(0, 5)
  return <section className="execution-center" aria-label="Pusat eksekusi">
    <div className="section-heading"><div><h3><Activity size={15}/> Execution center</h3><p>Rencana, tool yang dipakai, dan artefak dari setiap pekerjaan.</p></div><span>{runs.filter(run => run.status === 'running').length ? 'Sedang berjalan' : `${runs.length} run tersimpan`}</span></div>
    {!latest.length && <div className="execution-empty"><CircleAlert size={18}/><span>Belum ada pekerjaan. Kirim perintah dari Talk untuk melihat rencana dan jejak eksekusi di sini.</span></div>}
    <div className="run-list">{latest.map(run => <article className={`run-item ${run.status}`} key={run.id}>
      <button className="run-summary" onClick={() => setExpanded(expanded === run.id ? null : run.id)} aria-expanded={expanded === run.id}><span className={`run-state ${run.status}`}>{run.status === 'completed' ? <Check size={13}/> : run.status === 'failed' ? <X size={13}/> : <Zap size={13}/>}</span><span className="run-command"><strong>{run.command}</strong><small>{run.approval === 'approved' ? 'Disetujui untuk aksi eksternal' : 'Read-only / tidak perlu persetujuan'} · {timeAgo(run.updatedAt)}</small></span><ChevronRight size={16} className={expanded === run.id ? 'expanded' : ''}/></button>
      {expanded === run.id && <div className="run-details"><ol>{run.steps.map(step => <li key={step.id} className={step.status}><span>{step.status === 'success' ? <Check size={11}/> : step.status === 'error' ? <X size={11}/> : <Zap size={11}/>}</span><div><strong>{step.label}</strong>{step.detail && <small>{step.detail}</small>}</div></li>)}</ol>{run.artifacts.length > 0 && <div className="run-artifacts"><h4>Artefak</h4>{run.artifacts.map((artifact, index) => artifact.url ? <a key={`${artifact.url}-${index}`} href={artifact.url} target="_blank" rel="noreferrer"><ExternalLink size={12}/>{artifact.label}</a> : <span key={`${artifact.label}-${index}`}>{artifact.label}</span>)}</div>}{run.summary && <p className="run-summary-copy">{run.summary}</p>}</div>}
    </article>)}</div>
  </section>
}

function Assistant({ settings, desktopAvailable, mutate, notify, onError, stopReply }: { stopReply: () => void; settings: PublicSettings; desktopAvailable: boolean; mutate: (body: Record<string, unknown>) => Promise<unknown>; notify: (text: string) => void; onError: (text: string) => void }) {
  const [draft, setDraft] = useState({ ...settings, apiKey: '', clearApiKey: false })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  useEffect(() => { setDraft({ ...settings, apiKey: '', clearApiKey: false }) }, [settings])
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true)
    try { await mutate({ action: 'settings', settings: draft }); notify('Pengaturan tersimpan.') } catch (error) { onError((error as Error).message) } finally { setSaving(false) }
  }
  return <div className="content-page settings-page"><PageTitle title="Make Jarvis yours." description="Choose how your assistant thinks, speaks, and works."/><form onSubmit={save}><section className="settings-section"><div className="settings-section-title"><Brain size={19}/><div><h3>Intelligence</h3><p>Connect your OpenAI-compatible provider.</p></div><span className={`setting-status ${settings.hasApiKey ? 'ready' : ''}`}>{settings.hasApiKey ? 'Configured' : 'Setup needed'}</span></div><ProviderSettings value={draft} savedUrl={settings.baseUrl} hasSavedKey={settings.hasApiKey} change={value => setDraft({ ...draft, ...value })}/><div className="provider-actions"><button type="button" className="secondary-button" disabled={testing || (!settings.hasApiKey && !isLocalEndpoint(settings.baseUrl))} onClick={async () => { setTesting(true); try { const result = await mutate({ action: 'test-provider' }) as { message: string }; notify(result.message) } catch (e) { onError((e as Error).message) } finally { setTesting(false) } }}>{testing ? <Loader2 size={14} className="spin"/> : <Zap size={14}/>} Uji koneksi tersimpan</button>{settings.hasApiKey && <label className="checkbox-label"><input type="checkbox" checked={draft.clearApiKey} onChange={e => setDraft({ ...draft, clearApiKey: e.target.checked })}/> Hapus API key saat menyimpan</label>}</div></section><section className="settings-section"><div className="settings-section-title"><AudioLines size={19}/><div><h3>Voice & language</h3><p>A conversation that feels natural.</p></div></div><div className="setting-row"><label htmlFor="voice-language">Response & recognition language</label><select id="voice-language" value={draft.language} onChange={e => setDraft({ ...draft, language: e.target.value })}><option value="id-ID">Bahasa Indonesia</option><option value="en-US">English (US)</option></select></div><VoiceSettings value={draft} language={draft.language} change={value => setDraft({ ...draft, ...value })} stopReply={stopReply}/><Toggle label="Spoken replies" description="Read replies aloud using your selected voice." checked={draft.voiceEnabled} onChange={value => setDraft({ ...draft, voiceEnabled: value })}/></section><section className="settings-section"><div className="settings-section-title"><Monitor size={19}/><div><h3>Computer control</h3><p>Let Jarvis work on this Windows computer.</p></div><span className={`setting-status ${desktopAvailable ? 'ready' : ''}`}>{desktopAvailable ? 'Windows available' : 'Unavailable'}</span></div><Toggle label="Enable computer control" description="Open applications, observe the screen, move the pointer, click, type, and use keyboard shortcuts." checked={draft.desktopEnabled} disabled={!desktopAvailable} onChange={value => setDraft({ ...draft, desktopEnabled: value })}/><p className="setting-hint">Screenshots are sent to your AI provider only when a task uses the screenshot tool. Use a vision-capable model for visual tasks.</p></section><section className="settings-section"><div className="settings-section-title"><Settings2 size={19}/><div><h3>Personality & instructions</h3><p>How Jarvis should approach your requests.</p></div></div><label className="system-instructions"><span className="sr-only">System instructions</span><textarea rows={6} required value={draft.systemPrompt} onChange={e => setDraft({ ...draft, systemPrompt: e.target.value })}/></label></section><div className="settings-save"><span><ShieldCheck size={14}/> Credentials encrypted on this computer</span><button className="primary-button" disabled={saving}>{saving ? <Loader2 className="spin" size={15}/> : <Check size={15}/>} Simpan pengaturan</button></div></form></div>
}
function Toggle({ label, description, checked, onChange, disabled }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) { return <div className="toggle-row"><div><strong>{label}</strong><p>{description}</p></div><button type="button" className={`toggle ${checked ? 'on' : ''}`} role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}><span/></button></div> }

function Files({ onError, notify }: { onError: (text: string) => void; notify: (text: string) => void }) {
  const [files, setFiles] = useState<{ name: string; size: number; updatedAt: string }[]>([])
  const [filename, setFilename] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const upload = useRef<HTMLInputElement>(null)
  const load = useCallback(async () => { const result = await jsonResponse(await fetch('/api/jarvis/files')); setFiles(result.files) }, [])
  useEffect(() => { void load().catch(e => onError(e.message)) }, [load, onError])
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true)
    try { await jsonResponse(await fetch('/api/jarvis/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename, content }) })); await load(); notify('Catatan tersimpan. Jarvis dapat membacanya.') } catch (e) { onError((e as Error).message) } finally { setSaving(false) }
  }
  return <div className="content-page"><PageTitle title="A place for your context." description="Notes and files Jarvis can read and create with you."/><div className="files-actions"><button className="secondary-button" onClick={() => { setFilename('catatan-baru.md'); setContent('') }}><Plus size={15}/> New note</button><button className="secondary-button" onClick={() => upload.current?.click()}><Upload size={15}/> Import text file</button><input ref={upload} type="file" accept=".md,.txt" hidden onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 100_000) { onError('Ukuran maksimal 100 KB.'); return } setFilename(file.name); setContent(await file.text()); e.target.value = '' }}/></div><div className={`file-workspace ${filename ? 'editing' : ''}`}><div className="file-list">{!files.length && <Empty icon={Folder} title="Room for your ideas" description="Create a note or import a .txt or .md file."/>}{files.map(file => <button key={file.name} className={filename === file.name ? 'selected' : ''} onClick={async () => { try { const result = await jsonResponse(await fetch(`/api/jarvis/files?filename=${encodeURIComponent(file.name)}`)); setFilename(result.filename); setContent(result.content) } catch (e) { onError((e as Error).message) } }}><FileText size={18}/><span><strong>{file.name}</strong><small>{file.size.toLocaleString()} bytes · {timeAgo(file.updatedAt)}</small></span><ChevronRight size={14}/></button>)}</div>{filename && <form className="note-editor" onSubmit={save}><div><input aria-label="Note filename" required value={filename} onChange={e => setFilename(e.target.value)}/><button type="button" className="icon-button" aria-label="Close note" onClick={() => setFilename('')}><X size={17}/></button></div><textarea aria-label="Note content" value={content} onChange={e => setContent(e.target.value)} placeholder="Write something worth remembering…"/><footer><span>.txt or .md · max 100 KB</span><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save note'}</button></footer></form>}</div></div>
}

function Workflows({ data, mutate, busy, run, onError }: { data: PublicState; mutate: (body: Record<string, unknown>) => Promise<unknown>; busy: boolean; run: (workflow: PublicState['workflows'][number]) => void; onError: (text: string) => void }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [approval, setApproval] = useState<'always' | 'writes-only' | 'autonomous'>('writes-only')
  const [schedule, setSchedule] = useState<'manual' | 'daily' | 'weekdays' | 'weekly'>('manual')
  const [saving, setSaving] = useState(false)
  return <div className="content-page"><div className="page-title-with-action"><PageTitle title="Less repetition. More flow." description="Build a reusable instruction, choose its safety policy, then run it with a visible plan."/><button className="primary-button" onClick={() => setCreating(true)}><Plus size={15}/> Create workflow</button></div>{creating && <form className="workflow-form" onSubmit={async e => { e.preventDefault(); setSaving(true); try { await mutate({ action: 'workflow', workflow: { name, command, approval, schedule } }); setCreating(false); setName(''); setCommand(''); setApproval('writes-only'); setSchedule('manual') } catch (err) { onError((err as Error).message) } finally { setSaving(false) } }}><label>Workflow name<input required value={name} onChange={e => setName(e.target.value)} placeholder="Morning briefing"/></label><label>What should Jarvis do?<textarea required rows={3} value={command} onChange={e => setCommand(e.target.value)} placeholder="Periksa kalender hari ini, ringkas email terbaru, lalu simpan briefing ke catatan."/></label><div className="workflow-options"><label>Approval policy<select value={approval} onChange={e => setApproval(e.target.value as typeof approval)}><option value="always">Always ask before running</option><option value="writes-only">Ask only before external changes</option><option value="autonomous">Run without approval</option></select></label><label>Run cadence<select value={schedule} onChange={e => setSchedule(e.target.value as typeof schedule)}><option value="manual">Manual only</option><option value="daily">Daily review</option><option value="weekdays">Weekdays review</option><option value="weekly">Weekly review</option></select><span>Cadence is stored now; automatic background execution requires the local runner to stay open.</span></label></div><div><button className="secondary-button" type="button" onClick={() => setCreating(false)}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save workflow'}</button></div></form>}{!data.workflows.length && !creating && <div className="workflow-empty"><GitBranch size={40} strokeWidth={1}/><h3>Your next shortcut starts here.</h3><p>A morning briefing, a research routine, or just opening your favorite apps. Give it a name and let Jarvis handle the steps.</p><button className="secondary-button" onClick={() => { setCreating(true); setName('Catatan harian'); setCommand('Baca waktu sekarang dan buat catatan harian baru di workspace.') }}>Create your first workflow <Plus size={14}/></button></div>}<div className="workflow-list">{data.workflows.map(workflow => <div className="workflow-item" key={workflow.id}><div className="workflow-icon"><GitBranch size={20}/></div><div><h3>{workflow.name}</h3><p>{workflow.command}</p><div className="workflow-meta"><span>{workflow.approval === 'always' ? 'Selalu minta persetujuan' : workflow.approval === 'autonomous' ? 'Otonom' : 'Persetujuan untuk perubahan'}</span><span>{workflow.schedule === 'manual' ? 'Manual' : `Review ${workflow.schedule}`}</span></div></div><button className="secondary-button" disabled={busy} onClick={() => run(workflow)}><Zap size={14}/> Run</button><button className="icon-button" aria-label={`Delete ${workflow.name}`} onClick={() => { void mutate({ action: 'delete-workflow', id: workflow.id }).catch(e => onError(e.message)) }}><Trash2 size={15}/></button></div>)}</div></div>
}
