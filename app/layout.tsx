import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tri-Two SEO Grader',
  description: 'SEO health check and grading tool',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

