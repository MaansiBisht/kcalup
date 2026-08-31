import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Kcalup — photograph your plate, get calories in seconds'

// Rendered at build time by next/og; no image file to keep in sync with the brand.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#24462f',
          color: '#f7f5f0',
          fontFamily: 'sans-serif',
        }}
      >
        <svg width="104" height="104" viewBox="0 0 120 120">
          <rect width="120" height="120" rx="26" fill="#f7f5f0" />
          <g stroke="#24462f" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M44 32 L44 88" />
            <path d="M76 46 L44 64 L76 86" />
          </g>
          <circle cx="76" cy="46" r="9" fill="#24462f" />
        </svg>

        <div style={{ fontSize: 82, fontWeight: 700, letterSpacing: -2, marginTop: 44 }}>
          Photograph your plate.
        </div>
        <div style={{ fontSize: 82, fontWeight: 700, letterSpacing: -2, color: '#9db8a6' }}>
          Get calories in seconds.
        </div>
        <div style={{ fontSize: 32, marginTop: 36, color: '#c3d3c8' }}>
          kcalup.maansi.fyi
        </div>
      </div>
    ),
    size,
  )
}
