import type { Metadata, Viewport } from 'next'
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A0F1A',
}

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
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.svg',
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
