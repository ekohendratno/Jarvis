'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, ExternalLink, Loader2, Plug, Search, ShieldCheck, X } from 'lucide-react'
import { APPS, EXTRA_APPS } from './catalog'
import { OAUTH_APPS } from '@/lib/oauth-apps'
import type { PublicState, View } from '@/types/jarvis'

const ALL_APPS = [...APPS, ...EXTRA_APPS]
const BUILTIN = ['chat', 'files', 'memory', 'time', 'voice', 'desktop', 'web']
async function oauth(body: Record<string, unknown>) {
  const response = await fetch('/api/jarvis/oauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Koneksi akun gagal.')
  return data
}

export function AppConnections({ data, connected, selected, setSelected, mutate, notify, onError, navigate, refresh }: { data: PublicState; connected: string[]; selected: string | null; setSelected: (id: string | null) => void; mutate: (body: Record<string, unknown>) => Promise<unknown>; notify: (text: string) => void; onError: (text: string) => void; navigate: (view: View) => void; refresh: () => Promise<unknown> }) {
  const [query, setQuery] = useState('')
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [opening, setOpening] = useState(false)
  const [flow, setFlow] = useState<{ id: string; app: string; url: string; started: number } | null>(null)
  const [message, setMessage] = useState('')
  const popup = useRef<Window | null>(null)
  const mounted = useRef(true)
  const polling = useRef(false)
  const app = ALL_APPS.find(item => item.id === selected)
  const connection = data.settings.connections.find(item => item.app === selected)
  useEffect(() => { setUrl(connection?.url || ''); setToken(''); setMessage('') }, [selected, connection?.url])
  useEffect(() => { mounted.current = true; void refresh().catch(() => {}); return () => { mounted.current = false } }, [refresh])

  async function checkFlow(current: NonNullable<typeof flow>) {
    if (polling.current) return
    polling.current = true
    try {
      const result = await oauth({ action: 'status', flow: current.id })
      if (!mounted.current) return
      if (result.status === 'connected') {
        setFlow(null); setMessage('Akun dan tools berhasil diverifikasi.'); popup.current?.close()
        await refresh(); notify('Akun berhasil dihubungkan melalui browser.'); setSelected(null)
      } else setMessage(popup.current?.closed ? 'Jendela login sudah ditutup. Menunggu verifikasi; gunakan Periksa status atau hubungkan ulang jika login dibatalkan.' : 'Selesaikan login dan persetujuan akses di jendela browser. Status akan diperbarui otomatis.')
    } catch (error) { if (mounted.current) { setFlow(null); onError((error as Error).message) } }
    finally { polling.current = false }
  }
  const checkRef = useRef(checkFlow)
  checkRef.current = checkFlow
  useEffect(() => {
    if (!flow) return
    const timer = setInterval(() => {
      if (Date.now() - flow.started > 10 * 60_000) { setFlow(null); setMessage('Sesi login kedaluwarsa. Hubungkan ulang.'); return }
      void checkRef.current(flow)
    }, 3000)
    return () => clearInterval(timer)
  }, [flow])

  async function begin() {
    if (!app) return
    const windowRef = window.open('about:blank', '_blank', 'popup,width=620,height=760')
    if (windowRef) {
      windowRef.document.title = 'Jarvis · Menyiapkan login'
      windowRef.document.body.textContent = 'Jarvis sedang menyiapkan halaman login aplikasi. Silakan tunggu…'
      windowRef.document.body.style.cssText = 'font:16px system-ui;padding:28px;line-height:1.8;background:#f7f8f5;color:#283122'
      windowRef.opener = null; popup.current = windowRef
    }
    setOpening(true); setMessage('Menyiapkan halaman login…')
    try {
      const result = await oauth({ action: 'begin', app: app.id })
      if (windowRef && !windowRef.closed) windowRef.location.href = result.authorizationUrl
      setFlow({ id: result.flow, app: app.id, url: result.authorizationUrl, started: Date.now() })
      setMessage(windowRef ? 'Silakan login di jendela browser yang dibuka.' : 'Popup diblokir. Gunakan tombol Buka halaman login di bawah.')
    } catch (error) { windowRef?.close(); setMessage(''); onError((error as Error).message) }
    finally { setOpening(false) }
  }
  async function disconnect() {
    if (!connection) return
    setSaving(true)
    try {
      if (connection.kind === 'composio') await oauth({ action: 'disconnect', id: connection.id })
      else await mutate({ action: 'disconnect', id: connection.id })
      await refresh(); setSelected(null); notify('Koneksi aplikasi dilepas.')
    } catch (error) { onError((error as Error).message) } finally { setSaving(false) }
  }

  return <div className="content-page">
    <div className="page-title"><h2>Your world, connected.</h2><p>Hubungkan akun melalui browser. Jarvis memverifikasi akses sebelum memakai tools.</p></div>
    <details className="oauth-setup" open={!data.settings.hasComposioApiKey || undefined}>
      <summary><Plug size={15}/> Pengaturan koneksi OAuth <span>{data.settings.hasComposioApiKey ? 'Key tersimpan' : 'Setup awal diperlukan'}</span></summary>
      <p>Sekali konfigurasi project Composio, lalu hubungkan akun lewat halaman login resmi. Password akun tidak dimasukkan ke Jarvis.</p>
      <form onSubmit={async event => { event.preventDefault(); setSaving(true); try { await oauth({ action: 'configure', apiKey: key }); setKey(''); await refresh(); notify('Key koneksi OAuth tersimpan.') } catch (error) { onError((error as Error).message) } finally { setSaving(false) } }}>
        <label>Composio project API key<input type="password" autoComplete="off" required value={key} onChange={event => setKey(event.target.value)} placeholder={data.settings.hasComposioApiKey ? 'Masukkan key baru untuk mengganti' : 'Project API key Composio'}/></label>
        <button type="submit" className="secondary-button" disabled={saving || !key.trim()}>{saving ? <Loader2 className="spin" size={14}/> : <Check size={14}/>} Simpan key OAuth</button>
      </form>{data.settings.hasComposioApiKey && <button type="button" className="danger-text" onClick={async () => { setSaving(true); try { await oauth({ action: 'clear' }); await refresh(); notify('Key OAuth lokal dihapus.') } catch (error) { onError((error as Error).message) } finally { setSaving(false) } }}>Hapus key OAuth lokal</button>}<a href="https://dashboard.composio.dev/settings" target="_blank" rel="noreferrer">Buka Composio untuk membuat Project API Key (ak_) <ExternalLink size={12}/></a>
    </details>
    <div className="connection-toolbar"><div className="search-field"><Search size={16}/><input aria-label="Search apps" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search applications…"/></div><span>{data.settings.connections.filter(item => item.status === 'connected').length} services connected</span></div>
    <div className="connections-grid">{ALL_APPS.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).map(item => {
      const isConnected = connected.includes(item.id)
      const isWaiting = flow?.app === item.id
      const status = isConnected ? 'Connected' : isWaiting ? 'Waiting for login' : 'Not connected'
      return <button key={item.id} className={`connection-tile${isConnected ? ' is-connected' : ''}${isWaiting ? ' is-waiting' : ''}`} aria-label={`${item.name}: ${status}`} onClick={() => setSelected(item.id)}>
        <span className="service-icon" style={{ color: item.color }}><item.icon size={24}/></span>
        <span className="connection-verified" aria-hidden="true"><Check size={12}/></span>
        <strong>{item.name}</strong>
        <span className={`connection-state${isConnected ? ' connected' : ''}${isWaiting ? ' waiting' : ''}`}><i/>{isConnected ? 'Connected' : isWaiting ? 'Waiting for login' : 'Connect'}</span>
        <span className="connection-action" aria-hidden="true">{isConnected ? 'Manage' : 'Connect'}</span>
        {isConnected ? <Check className="connect-plus" aria-hidden="true" size={15}/> : <Plug className="connect-plus" aria-hidden="true" size={14}/>} 
      </button>
    })}</div>
    {app && <div className="connection-sheet"><div className="section-heading"><h3><app.icon size={21}/> {app.name}</h3><button className="icon-button" aria-label="Close connection" onClick={() => setSelected(null)}><X size={18}/></button></div>
      {BUILTIN.includes(app.id) ? <div className="builtin-details"><ShieldCheck size={30}/><h4>{connected.includes(app.id) ? 'Built into your workspace' : 'Ready to enable'}</h4><p>{app.id === 'voice' ? 'Pilih suara dan bahasa pada Assistant.' : ['desktop', 'web'].includes(app.id) ? 'Aktifkan kontrol komputer pada Assistant untuk memakai aplikasi Windows dan browser.' : 'Kemampuan ini tersedia di workspace lokal tanpa login akun eksternal.'}</p><button className="primary-button" onClick={() => { setSelected(null); navigate(app.id === 'files' ? 'files' : app.id === 'memory' ? 'dashboard' : app.id === 'chat' ? 'talk' : 'assistant') }}>Open <ChevronRight size={15}/></button></div>
      : app.id === 'custom' ? <form className="connection-form" onSubmit={async event => { event.preventDefault(); setSaving(true); try { await mutate({ action: 'connect', connection: { app: 'custom', name: 'Custom MCP', url, token } }); setSelected(null); notify('Custom MCP berhasil diverifikasi.') } catch (error) { onError((error as Error).message) } finally { setSaving(false) } }}><p>Opsi lanjutan untuk server MCP milik Anda.</p><label>Remote MCP URL<input type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://your-server.example/mcp"/></label><label>Bearer token<input type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} placeholder="Opsional"/></label><button className="primary-button" disabled={saving}>{saving ? 'Memverifikasi…' : 'Connect Custom MCP'}</button>{connection && <button className="danger-text" type="button" onClick={() => void disconnect()}>Disconnect</button>}</form>
      : <div className="connection-form"><p>Jarvis akan membuka login {app.name} di browser. Pilih akun, periksa izin, lalu setujui akses. Status Connected hanya ditampilkan setelah akun aktif dan tools berhasil diverifikasi.</p>{!data.settings.hasComposioApiKey && <p className="oauth-warning">Isi project API key Composio pada Pengaturan koneksi OAuth di halaman ini terlebih dahulu.</p>}
        {flow?.app === app.id ? <><p className="oauth-progress" role="status"><Loader2 size={15} className="spin"/>{message}</p><a className="secondary-button" href={flow.url} target="_blank" rel="noreferrer">Buka halaman login <ExternalLink size={13}/></a><button className="secondary-button" onClick={() => void checkFlow(flow)}>Periksa status</button><button className="danger-text" onClick={async () => { try { await oauth({ action: 'cancel', flow: flow.id }); setFlow(null); popup.current?.close(); setMessage('Login dibatalkan.') } catch (error) { onError((error as Error).message) } }}>Batalkan login</button></>
        : <button className="primary-button" disabled={opening || !data.settings.hasComposioApiKey || !OAUTH_APPS[app.id]} onClick={() => void begin()}>{opening ? <Loader2 className="spin" size={15}/> : <ExternalLink size={15}/>} {opening ? 'Membuka login…' : connection ? 'Hubungkan ulang lewat browser' : `Hubungkan ${app.name} lewat browser`}</button>}
        {connection && <><p className="connected-detail"><Check size={14}/>{connection.toolCount} tools terhubung</p><button className="danger-text" disabled={saving} onClick={() => void disconnect()}>Disconnect {app.name}</button></>}
      </div>}
    </div>}
  </div>
}
