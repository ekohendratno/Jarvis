import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({ ok: true, service: 'widget-test' })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  return NextResponse.json({ ok: true, received: body })
}
