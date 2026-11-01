import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./experience.css";
import "./polish.css";
export const metadata: Metadata = {
  title: "PASS ON", description: "중요한 것만 남겨, 너에게.", manifest: "/manifest.json",
  icons: { apple: "/icons/icon-192.png", icon: "/icons/icon-192.png" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "PASS ON", statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f3efe7" };
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="ko"><body>{children}</body></html>; }
