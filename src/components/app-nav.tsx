"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function AppNav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="주 메뉴">
      {[
        ["/capture", "남기기"],
        ["/archive", "내가 남긴 것"],
        ["/revisit", "그때의 나"],
        ["/data", "내 데이터"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={path.startsWith(href) ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
