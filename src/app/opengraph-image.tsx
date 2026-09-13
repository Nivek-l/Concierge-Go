import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const runtime = 'nodejs'
export const alt = 'Concierge Go — You ask. We handle it.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  const iconBuffer = await readFile(join(process.cwd(), 'public/brand/icon-mark.png'))
  const iconSrc = `data:image/png;base64,${iconBuffer.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F7F9FC',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} width={340} height={177} alt="" />
        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 84,
            fontWeight: 800,
          }}
        >
          <span style={{ color: '#0B2D6B' }}>Concierge</span>
          <span style={{ color: '#FFA001', marginLeft: 18 }}>Go</span>
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 18,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: 4,
            color: '#0B2D6B',
            opacity: 0.85,
          }}
        >
          YOU ASK. WE HANDLE IT.
        </div>
      </div>
    ),
    { ...size },
  )
}
