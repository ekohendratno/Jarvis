'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { AI_PROVIDERS, isLocalEndpoint, sameEndpoint, type ProviderId } from '@/lib/ai-providers'

type Draft = { providerId: ProviderId; baseUrl: string; apiKey: string; clearApiKey: boolean; model: string }
export function ProviderSettings({ value, savedUrl, hasSavedKey, change }: { value: Draft; savedUrl: string; hasSavedKey: boolean; change: (value: Partial<Draft>) => void }) {
  const [models, setModels] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [manual, setManual] = useState(false)
  const [revision, setRevision] = useState(0)
  const generation = useRef(0)
  const savedKeyUsable = hasSavedKey && sameEndpoint(savedUrl, value.baseUrl) && !value.clearApiKey

  useEffect(() => {
    const id = ++generation.current
    const controller = new AbortController()
    setModels([]); setError(''); setLoading(false)
    let valid = false
    try { valid = ['http:', 'https:'].includes(new URL(value.baseUrl).protocol) } catch {}
    if (!valid) return
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/jarvis/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: value.baseUrl, apiKey: value.apiKey, clearApiKey: value.clearApiKey }), signal: controller.signal })
        const body = await response.json()
        if (generation.current !== id || controller.signal.aborted) return
        if (!response.ok) throw new Error(body.error || 'Tidak dapat mengambil model. Isi model manual.')
        setModels(body.models)
        if (!body.models.length) setError('Provider tidak mengembalikan model. Isi model manual.')
      } catch (error) {
        if (!controller.signal.aborted && generation.current === id) setError(error instanceof Error ? error.message : 'Pengecekan gagal. Isi model manual.')
      } finally { if (!controller.signal.aborted && generation.current === id) setLoading(false) }
    }, 450)
    return () => { clearTimeout(timer); controller.abort() }
  }, [value.baseUrl, value.apiKey, value.clearApiKey, savedUrl, hasSavedKey, revision])

  const selectProvider = (id: ProviderId) => {
    const provider = AI_PROVIDERS.find(provider => provider.id === id)!
    const baseUrl = provider.baseUrl || value.baseUrl
    const same = sameEndpoint(baseUrl, value.baseUrl)
    change({ providerId: id, baseUrl, ...(same ? {} : { apiKey: '', clearApiKey: false, model: '' }) })
    setManual(false)
  }
  return <div className="provider-settings">
    <div className="settings-form-grid">
      <label>Provider AI<select value={value.providerId} onChange={event => selectProvider(event.target.value as ProviderId)}>{AI_PROVIDERS.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
      <label>Base URL<input type="url" required value={value.baseUrl} onChange={event => change({ baseUrl: event.target.value, apiKey: '', clearApiKey: false })} placeholder="https://your-provider.example/v1"/></label>
      <label>API key<input type="password" autoComplete="off" value={value.apiKey} onChange={event => change({ apiKey: event.target.value })} placeholder={savedKeyUsable ? 'Tersimpan untuk endpoint ini · kosongkan untuk mempertahankan' : isLocalEndpoint(value.baseUrl) ? 'Opsional jika server lokal tidak membutuhkan key' : 'API key provider ini'}/></label>
      <div className="provider-model-field">
        <div className="model-field-heading"><span>Model</span><button className="text-button" type="button" onClick={() => setManual(!manual)}>{manual ? 'Pilih dari provider' : 'Isi manual'}</button></div>
        {!manual && models.length ? <label><span className="sr-only">Model</span><select required value={value.model} onChange={event => change({ model: event.target.value })}><option value="">Pilih model…</option>{value.model && !models.some(model => model.id === value.model) && <option value={value.model}>{value.model} · manual / tersimpan</option>}{models.map(model => <option value={model.id} key={model.id}>{model.name === model.id ? model.id : `${model.name} · ${model.id}`}</option>)}</select></label> : <label><span className="sr-only">Model</span><input required value={value.model} onChange={event => { setManual(true); change({ model: event.target.value }) }} placeholder="ID model, misalnya asistent"/></label>}
      </div>
    </div>
    <div className="model-discovery-status"><button type="button" className="secondary-button" disabled={loading || !value.baseUrl} onClick={() => setRevision(previous => previous + 1)}>{loading ? <Loader2 className="spin" size={13}/> : <RefreshCw size={13}/>} {loading ? 'Mengecek model…' : 'Cek model'}</button><span role="status">{loading ? 'Mengambil daftar dari provider…' : error || (models.length ? `${models.length} model tersedia. Pilih dari daftar atau isi manual.` : 'Daftar model diperiksa otomatis. Anda tetap dapat mengisi ID manual.')}</span></div>
    {!sameEndpoint(value.baseUrl, savedUrl) && hasSavedKey && <p className="setting-hint">Endpoint berubah. Key lama tidak dikirim ke provider baru; masukkan key yang sesuai jika diperlukan.</p>}
  </div>
}
