"use client";
import { useEffect } from "react";
// Protect in-app link navigation; no claim that iOS process termination can be prevented.
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const navigate = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const target = new URL(link.href, location.href);
      if (target.origin === location.origin && target.pathname === location.pathname && target.search === location.search) return;
      if (!window.confirm("아직 저장을 마치지 않은 내용이 있어요. 이 화면을 나가면 사라질 수 있습니다. 이동할까요?")) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", before); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
}
