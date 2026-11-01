import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./signature.css";
import "./signature-polish.css";
import "./continuity.css";
import "./memory-audio.css";
export const metadata: Metadata = {
  title: "PASS ON", description: "오늘의 나를, 내일의 너에게.", manifest: "/manifest.json",
  icons: { apple: "/icons/icon-192.png", icon: "/icons/icon-192.png" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "PASS ON", statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#fbfaf8" };
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="ko"><body>{children}</body></html>; }
