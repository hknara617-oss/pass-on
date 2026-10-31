"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: "/capture", label: "남기기", icon: "write" },
  { href: "/archive", label: "보관함", icon: "archive" },
  { href: "/revisit", label: "그때의 나", icon: "time" },
  { href: "/data", label: "내 데이터", icon: "shield" },
];
export function AppNav() {
  const path = usePathname();
  return <nav className="nav quiet-nav" aria-label="주 메뉴">{tabs.map(({href,label,icon})=><Link key={href} href={href} prefetch={false} aria-current={path.startsWith(href)?"page":undefined}><Icon name={icon} size={22}/><span>{label}</span></Link>)}</nav>;
}
