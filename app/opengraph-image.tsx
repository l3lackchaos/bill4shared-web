import { ImageResponse } from 'next/og'

// Branded social-share image, generated at the edge. Shown when the link is
// pasted into LINE / messengers. Emerald brand to match the app.
export const runtime = 'edge'
export const alt = 'Bill4Shared — แตกบิลง่ายๆ จากรูปใบเสร็จ'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
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
          background: 'linear-gradient(135deg, #0d9268 0%, #0a7a57 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 130, fontWeight: 800, letterSpacing: -2 }}>฿</div>
        <div style={{ fontSize: 76, fontWeight: 800, marginTop: 8 }}>Bill4Shared</div>
        <div style={{ fontSize: 34, opacity: 0.9, marginTop: 16 }}>
          แตกบิลง่ายๆ จากรูปใบเสร็จ
        </div>
      </div>
    ),
    size,
  )
}
