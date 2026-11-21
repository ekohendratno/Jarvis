import React from 'react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontSize: 48, fontWeight: 700 }}>404</h1>
      <p style={{ opacity: 0.7 }}>Halaman tidak ditemukan.</p>
      <Link href="/" style={{ color: '#2563eb' }}>
        Kembali ke beranda
      </Link>
    </div>
  )
}
