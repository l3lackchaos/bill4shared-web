import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

const ADSENSE_CLIENT = "ca-pub-3479386406572719";

export const metadata: Metadata = {
  title: "Bill4Shared — แตกบิลง่ายๆ",
  description: "อัปโหลดรูปบิล แล้วแตกหารกันเลย",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="light" style={{ colorScheme: "light" }}>
      <head>
        {/*
          Google AdSense Auto ads loader. Plain async <script> (NOT next/script)
          so it has no data-nscript attribute — Auto ads' tag detection requires
          the official tag shape, and React 19 hoists this async script into
          <head> and dedupes it. Auto ads places units automatically; no manual
          ad slots needed.
        */}
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      </head>
      <body className={`${geist.className} bg-gray-50 text-gray-900 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
