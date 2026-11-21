import { z } from 'zod'
import { requireUser } from '@/lib/jarvis/auth'
import { verifyOAuth } from '@/lib/jarvis/oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  let success = false
  try {
    const user = await requireUser(request)
    const flow = z.string().uuid().parse(new URL(request.url).searchParams.get('flow'))
    success = (await verifyOAuth(user.id, flow)).status === 'connected'
  } catch {}
  return new Response(`<!doctype html><html lang="id"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jarvis · Login aplikasi</title><style>body{font:16px system-ui;background:#f7f8f5;color:#283122;display:grid;place-items:center;min-height:95vh}main{max-width:440px;padding:28px}h1{font-size:24px}p{line-height:1.8}button{padding:12px 20px;background:#e9a0b5;border:0;border-radius:8px;cursor:pointer}</style></head><body><main><h1>${success ? 'Akun berhasil dihubungkan' : 'Kembali ke Jarvis untuk memeriksa status'}</h1><p>${success ? 'Jarvis sudah memverifikasi akun dan tools aplikasi. Anda dapat menutup jendela ini.' : 'Jika login belum selesai atau sesi Jarvis berakhir, kembali ke Connections dan tekan Periksa status atau hubungkan ulang.'}</p><button onclick="window.close()">Tutup jendela</button></main></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
}
