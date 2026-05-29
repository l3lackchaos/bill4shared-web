import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bill4Shared — แตกบิลง่ายๆ",
  description: "อัปโหลดรูปบิล แล้วแตกหารกันเลย",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${geist.className} bg-gray-50 min-h-screen`}>{children}</body>
    </html>
  );
}
