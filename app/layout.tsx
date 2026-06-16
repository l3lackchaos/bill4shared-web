import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import ThemeToggle from "./ThemeToggle";
import { ToastProvider } from "./Toast";

const geist = Geist({ subsets: ["latin"] });

const ADSENSE_CLIENT = "ca-pub-3479386406572719";
const SITE_URL = "https://www.bill4shared.site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Bill4Shared — แตกบิลง่ายๆ จากรูปใบเสร็จ",
    template: "%s — Bill4Shared",
  },
  description:
    "ถ่ายรูปใบเสร็จหรือบิล LINE MAN แล้วให้ AI อ่านรายการ แบ่งหารกับเพื่อนอัตโนมัติ พร้อมค่าส่ง ส่วนลด และไทยช่วยไทย",
  applicationName: "Bill4Shared",
  keywords: ["แตกบิล", "หารบิล", "แชร์บิล", "หารค่าอาหาร", "bill split", "LINE MAN", "ไทยช่วยไทย"],
  // apex + www serve the same content; point canonical at the primary host
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: SITE_URL,
    siteName: "Bill4Shared",
    title: "Bill4Shared — แตกบิลง่ายๆ จากรูปใบเสร็จ",
    description:
      "ถ่ายรูปบิล แล้วให้ AI อ่านรายการ แบ่งหารกับเพื่อนอัตโนมัติ พร้อมค่าส่ง ส่วนลด และไทยช่วยไทย",
  },
  twitter: {
    card: "summary",
    title: "Bill4Shared — แตกบิลง่ายๆ จากรูปใบเสร็จ",
    description: "ถ่ายรูปบิล แล้วให้ AI แบ่งหารกับเพื่อนอัตโนมัติ",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0d9268", // emerald brand — matches --brand, tints browser chrome
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        {/*
          Set the theme class before first paint to avoid a flash of the wrong
          theme. Reads the saved choice, falling back to the OS preference.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();`,
          }}
        />
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
      <body className={`${geist.className} bg-canvas text-ink min-h-screen`}>
        <ToastProvider>
          {children}
          {/* Floating theme switch — available on every page. Bottom-right keeps
              it clear of page headers and back-links that live at the top. */}
          <div className="fixed bottom-4 right-4 z-[var(--z-sticky)]">
            <ThemeToggle />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
