import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PASS ON",
  description: "아이에게, 지금의 당신을.",
  manifest: "/manifest.json",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "PASS ON", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f3efe7",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
