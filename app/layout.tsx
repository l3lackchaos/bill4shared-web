import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SidebarAds from "./SidebarAds";

const geist = Geist({ subsets: ["latin"] });

const ADSENSE_CLIENT = "ca-pub-3479386406572719";

export const metadata: Metadata = {
  title: "Bill4Shared — แตกบิลง่ายๆ",
  description: "อัปโหลดรูปบิล แล้วแตกหารกันเลย",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="light" style={{ colorScheme: "light" }}>
      <body className={`${geist.className} bg-gray-50 text-gray-900 min-h-screen`}>
        {children}
        <SidebarAds />
        {/* Google AdSense loader — afterInteractive so it never blocks first paint */}
        <Script
          id="adsbygoogle-init"
          async
          strategy="afterInteractive"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      </body>
    </html>
  );
}
