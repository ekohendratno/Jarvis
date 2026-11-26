'use client'

import { AlertTriangle, Circle, FileText, Play, ShieldCheck, X } from 'lucide-react'

export type ExecutionPlan = { command: string; steps: string[]; needsApproval: boolean; reason?: string }

const WRITE_INTENT = /\b(kirim|send|buat|create|hapus|delete|jadwalkan|schedule|post|publish|ubah|update|draft|tulis|write|pesan|message|emailkan|upload|simpan|save|tambahkan|add|pindahkan|move|bagikan|share)\b/i

const appFor = (command: string) => {
  const pairs = [['gmail', 'Gmail'], ['email', 'Gmail'], ['kalender', 'Google Calendar'], ['calendar', 'Google Calendar'], ['drive', 'Google Drive'], ['dokumen', 'Google Docs'], ['docs', 'Google Docs'], ['sheet', 'Google Sheets'], ['youtube', 'YouTube'], ['notion', 'Notion'], ['file', 'Files'], ['catatan', 'Files']]
  return pairs.find(([key]) => new RegExp(`\\b${key}\\b`, 'i').test(command))?.[1]
}

export function createExecutionPlan(command: string): ExecutionPlan {
  const app = appFor(command)
  const needsApproval = WRITE_INTENT.test(command)
  const steps = [
    'Memeriksa konteks, koneksi, dan kemampuan yang relevan',
    app ? `Mengambil data atau menjalankan tool ${app}` : 'Memilih tool yang paling sesuai untuk permintaan ini',
    needsApproval ? 'Melakukan perubahan hanya sesuai ruang lingkup yang disetujui' : 'Merangkum hasil dan menyertakan sumber atau artefak bila tersedia',
  ]
  return { command, steps, needsApproval, reason: needsApproval ? 'Perintah ini dapat membuat, mengubah, mengirim, atau menjadwalkan data eksternal.' : undefined }
}

export function ExecutionPlanCard({ plan, onApprove, onCancel }: { plan: ExecutionPlan; onApprove: () => void; onCancel: () => void }) {
  return <section className="execution-plan" aria-label="Rencana eksekusi">
    <div className="execution-plan-heading"><div><span className="execution-plan-icon"><FileText size={15}/></span><div><h3>Rencana eksekusi</h3><p>Jarvis akan menjalankan langkah berikut.</p></div></div><button className="icon-button" type="button" onClick={onCancel} aria-label="Batalkan rencana"><X size={15}/></button></div>
    <ol>{plan.steps.map(step => <li key={step}><span><Circle size={9}/></span>{step}</li>)}</ol>
    {plan.needsApproval && <div className="execution-risk"><AlertTriangle size={14}/><p>{plan.reason} Anda tetap dapat menghentikan proses setelah dimulai.</p></div>}
    <div className="execution-plan-actions"><button className="secondary-button" type="button" onClick={onCancel}>Edit perintah</button><button className="primary-button" type="button" onClick={onApprove}>{plan.needsApproval ? <ShieldCheck size={14}/> : <Play size={14}/>} {plan.needsApproval ? 'Setujui & jalankan' : 'Jalankan rencana'}</button></div>
  </section>
}
