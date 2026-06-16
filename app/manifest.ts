import type { MetadataRoute } from 'next'

// PWA manifest — lets users add Bill4Shared to their home screen and open it
// like an app (standalone, no browser chrome). Icons reuse the existing favicon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bill4Shared — แตกบิลง่ายๆ',
    short_name: 'Bill4Shared',
    description: 'ถ่ายรูปบิล แล้วให้ AI แบ่งหารกับเพื่อนอัตโนมัติ',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#0d9268',
    lang: 'th',
    icons: [
      { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
    ],
  }
}
