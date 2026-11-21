import { promises as fs } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { requireUser, apiError } from '@/lib/jarvis/auth'
import { userRoot } from '@/lib/jarvis/storage'
import { notePath } from '@/ai/tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    const filename = new URL(request.url).searchParams.get('filename')
    if (filename) return Response.json({ filename, content: await fs.readFile(notePath(user.id, filename), 'utf8') })
    const folder = path.join(userRoot(user.id), 'notes')
    await fs.mkdir(folder, { recursive: true })
    const files = await Promise.all((await fs.readdir(folder)).filter(name => /\.(md|txt)$/.test(name)).map(async name => {
      const stat = await fs.stat(notePath(user.id, name))
      return { name, size: stat.size, updatedAt: stat.mtime.toISOString() }
    }))
    return Response.json({ files })
  } catch (err) { return apiError(err) }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request, true)
    const input = z.object({ filename: z.string(), content: z.string().max(100_000) }).parse(await request.json())
    const file = notePath(user.id, input.filename)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, input.content, 'utf8')
    return Response.json({ ok: true })
  } catch (err) { return apiError(err) }
}
