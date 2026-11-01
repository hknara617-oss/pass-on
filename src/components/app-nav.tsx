"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: "/capture", label: "남기기", icon: "write" },
  { href: "/archive", label: "보관함", icon: "archive" },
  { href: "/revisit", label: "그때의 나", icon: "time" },
  { href: "/data", label: "내 공간", icon: "shield" },
];
export function AppNav() {
  const path = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const active = document.activeElement;
      const editable = active instanceof HTMLTextAreaElement || (active instanceof HTMLInputElement && !["checkbox","radio","button","file"].includes(active.type));
      const view = window.visualViewport;
      const raised = !!view && editable && view.scale < 1.1 && window.innerHeight - view.height > 110;
      root.dataset.keyboard = raised ? "open" : "closed";
    };
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update); window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update); document.removeEventListener("focusout", update);
      delete root.dataset.keyboard;
    };
  }, []);
  return <nav className="nav quiet-nav" aria-label="주 메뉴">{tabs.map(({href,label,icon}) => <Link key={href} href={href} prefetch={false} aria-current={path.startsWith(href)?"page":undefined}><span className="nav-icon"><Icon name={icon} size={22}/></span><span>{label}</span></Link>)}</nav>;
}
