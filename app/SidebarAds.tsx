'use client'

import { useEffect, useRef } from 'react'

const ADSENSE_CLIENT = 'ca-pub-3479386406572719'
// Ad unit slot id. Create a Display ad unit in AdSense and paste its data-ad-slot
// here (or set NEXT_PUBLIC_ADSENSE_SLOT). Until then the ad simply renders empty.
const ADSENSE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT ?? ''

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

function AdBox() {
  const ref = useRef<HTMLModElement>(null)
  const pushed = useRef(false)

  useEffect(() => {
    if (pushed.current || !ADSENSE_SLOT) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushed.current = true
    } catch {
      // AdSense script not ready yet; it will retry on next mount
    }
  }, [])

  // No slot configured yet → render nothing (avoids an empty bordered box).
  if (!ADSENSE_SLOT) return null

  return (
    <ins
      ref={ref}
      className="adsbygoogle"
      style={{ display: 'block', width: 160, height: 600 }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={ADSENSE_SLOT}
      data-ad-format="vertical"
      data-full-width-responsive="false"
    />
  )
}

// Two skyscraper ads flanking the centered content. Hidden below xl so the
// narrow mobile layout (where most bill-splitting happens) is never crowded.
export default function SidebarAds() {
  return (
    <>
      <aside className="hidden xl:block fixed left-4 top-24 w-[160px] z-0" aria-hidden="true">
        <AdBox />
      </aside>
      <aside className="hidden xl:block fixed right-4 top-24 w-[160px] z-0" aria-hidden="true">
        <AdBox />
      </aside>
    </>
  )
}
