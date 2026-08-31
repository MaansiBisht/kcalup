import type { Metadata, Viewport } from 'next'
import './globals.css'

const SITE_URL = 'https://kcalup.maansi.fyi'
const TAGLINE = 'Photograph your plate and get calories and macros in seconds — no database to search, no barcodes to scan.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Kcalup — photo to calories in seconds', template: '%s · Kcalup' },
  description: TAGLINE,
  applicationName: 'Kcalup',
  keywords: [
    'calorie counter',
    'photo calorie tracker',
    'AI food log',
    'macro tracker',
    'nutrition tracker',
    'meal logger',
    'food diary app',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Kcalup',
    title: 'Kcalup — photo to calories in seconds',
    description: TAGLINE,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kcalup — photo to calories in seconds',
    description: TAGLINE,
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Kcalup' },
}

// Tells search engines this is an app, not an article.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Kcalup',
  url: SITE_URL,
  description: TAGLINE,
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {/* Phone-first: the app is a single column. Desktop is the same column, centred. */}
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper shadow-[0_0_60px_rgba(20,21,15,0.06)]">
          {children}
        </div>
      </body>
    </html>
  )
}
