import React from 'react'
import { notFound } from 'next/navigation'

const SAMPLE_SITES: Record<string, { name: string }> = {
  demo: { name: 'Demo Site' },
}

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const site = SAMPLE_SITES[slug]
  if (!site) notFound()

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-semibold">{site.name}</h1>
      <p className="mt-2 opacity-70">Slug: {slug}</p>
    </main>
  )
}
