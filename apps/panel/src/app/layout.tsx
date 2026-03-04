import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'HealthPanel',
    template: '%s | HealthPanel',
  },
  description: 'Enterprise website monitoring dashboard — real-time uptime, performance, and status visibility.',
  keywords: ['monitoring', 'uptime', 'dashboard', 'health', 'status'],
  authors: [{ name: 'HealthPanel Team' }],
  robots: {
    index: false,
    follow: false,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-text-primary font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
