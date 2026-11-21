'use client'

import { useEffect, useRef } from 'react'
import { Brain, Activity, Maximize2 } from 'lucide-react'
import { APPS } from './catalog'

function NeuralCore({ active }: { active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    element.width = 240 * ratio; element.height = 240 * ratio
    context.scale(ratio, ratio)
    const points = Array.from({ length: 390 }, (_, i) => {
      const phi = Math.acos(1 - 2 * (i + 0.5) / 390)
      const theta = i * 2.399963
      const fold = 1 + 0.12 * Math.sin(theta * 8) * Math.sin(phi * 7)
      return { x: Math.sin(phi) * Math.cos(theta) * 54 * fold, y: Math.cos(phi) * 58 * fold, z: Math.sin(phi) * Math.sin(theta) * 47 * fold }
    })
    let frame = 0
    let angle = 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const draw = () => {
      context.clearRect(0, 0, 240, 240)
      if (!reduced) angle += active ? 0.006 : 0.0015
      const projected = points.map(p => ({ x: p.x * Math.cos(angle) + p.z * Math.sin(angle), y: p.y, z: p.z * Math.cos(angle) - p.x * Math.sin(angle) }))
      const halo = context.createRadialGradient(120, 120, 20, 120, 120, 112)
      halo.addColorStop(0, 'rgba(235,124,169,0.08)'); halo.addColorStop(0.55, 'rgba(228,116,157,0.12)'); halo.addColorStop(1, 'rgba(228,116,157,0)')
      context.fillStyle = halo; context.fillRect(0, 0, 240, 240)
      projected.forEach((p, i) => {
        for (let j = i + 1; j < projected.length; j++) {
          const q = projected[j]
          const distance = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)
          if (distance < 16) {
            context.strokeStyle = `rgba(234,143,181,${(1 - distance / 18) * (p.z + 90) / 280})`
            context.lineWidth = 0.65; context.beginPath(); context.moveTo(p.x + 120, p.y + 120); context.lineTo(q.x + 120, q.y + 120); context.stroke()
          }
        }
        context.fillStyle = `rgba(255,175,208,${(p.z + 70) / 125})`
        context.beginPath(); context.arc(p.x + 120, p.y + 120, p.z > 0 ? 1.35 : 0.7, 0, Math.PI * 2); context.fill()
      })
      if (!reduced) frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [active])
  return <canvas ref={canvas} className="neural-canvas" aria-hidden="true" />
}

export function NeuralNetwork({ connected, busy, activeApp, status, onSelect, onCore, onActivity }: { connected: string[]; busy: boolean; activeApp: string | null; status: string; onSelect: (id: string) => void; onCore: () => void; onActivity: () => void }) {
  const stage = useRef<HTMLDivElement>(null)
  return (
    <div className="network-stage" ref={stage}>
      <div className="network-meta"><span>NEURAL NETWORK</span><small>{connected.filter(id => APPS.some(app => app.id === id)).length} of {APPS.length} links active</small></div>
      <div className="network-actions"><span className={`live-pill ${busy ? 'working' : ''}`}><i />{busy ? 'WORKING' : 'LIVE'}</span><button onClick={onActivity}><Activity size={13} /> Activity</button><button aria-label="Fullscreen network" className="fullscreen-button" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void stage.current?.requestFullscreen().catch(() => {}) }}><Maximize2 size={14} /></button></div>
      <svg className="network-lines" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <defs><radialGradient id="networkGlow"><stop offset="0" stopColor="#db83a5" stopOpacity="0.1"/><stop offset="1" stopColor="#db83a5" stopOpacity="0"/></radialGradient></defs>
        <ellipse cx="500" cy="312" rx="255" ry="200" fill="url(#networkGlow)" />
        {APPS.map(app => {
          const path = `M 500 312 Q ${(500 + app.x * 10) / 2 + 25} ${(312 + app.y * 6) / 2 - 20} ${app.x * 10} ${app.y * 6}`
          const signaling = activeApp === app.id
          return <g key={app.id}><path d={path} className={connected.includes(app.id) ? 'edge connected' : 'edge'} />{signaling && <path d={path} className="edge signal" />}</g>
        })}
      </svg>
      <button className={`neural-core ${busy ? 'active' : ''}`} onClick={onCore} aria-label="Talk to Jarvis"><NeuralCore active={busy} /><Brain size={47} strokeWidth={0.8}/><span>{status}</span></button>
      {APPS.map(app => {
        const active = connected.includes(app.id)
        const Icon = app.icon
        return <button key={app.id} className={`app-node ${active ? 'is-connected' : ''} ${activeApp === app.id ? 'is-active' : ''}`} style={{ left: `${app.x}%`, top: `${app.y}%`, '--node-color': app.color } as React.CSSProperties} onClick={() => onSelect(app.id)} aria-label={`${app.name}: ${activeApp === app.id ? 'tool sedang berjalan' : active ? 'connected' : 'connect'}`}><span className="app-node-circle"><Icon size={19}/>{active && <i/>}</span><span className="app-node-name">{app.name}</span></button>
      })}
    </div>
  )
}
