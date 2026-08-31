import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kcalup',
  description: 'Photo to calories in seconds.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Kcalup' },
}

export const viewport: Viewport = {
  themeColor: '#f7f5f0',
  // Standalone PWAs need the safe-area insets to clear the home indicator.
  viewportFit: 'cover',
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-cream text-ink antialiased">
        {/* Phone-first: the app is a single column. Desktop is the same column, centred. */}
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper shadow-[0_0_60px_rgba(20,21,15,0.06)]">
          {children}
        </div>
      </body>
    </html>
  )
}
