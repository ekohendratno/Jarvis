import React from 'react'
import '@/styles/globals.css'

export const metadata = {
  title: 'Jarvis AI Assistant',
  description: 'Build your own Jarvis AI personal assistant.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
