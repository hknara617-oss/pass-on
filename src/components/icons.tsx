import type { CSSProperties } from "react";
export type IconName = "write" | "archive" | "time" | "shield" | "photo" | "mic" | "link" | "check" | "close" | "search" | "plus" | "arrow" | "file";
const paths: Record<IconName, string> = {
  write: "M12 20h8M16 3l5 5-11 11-6 1 1-6L16 3ZM14 5l5 5",
  archive: "M4 7h16v13H4V7ZM3 3h18v4H3V3ZM9 11h6",
  time: "M21 12a9 9 0 1 1-3-6.7M21 3v6h-6M12 7v5l3 2",
  shield: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3ZM8 12l3 3 5-6",
  photo: "M4 4h16v16H4V4ZM4 16l5-5 4 4 3-3 4 4M15 8h.01",
  mic: "M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V6ZM5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8",
  link: "m10 13 4-4M9 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M15 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M18 6 6 18",
  search: "M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  plus: "M12 5v14M5 12h14",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  file: "M7 3h7l5 5v13H5V3h2ZM14 3v6h5M8 13h8M8 17h5",
};
export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={style}><path d={paths[name]} /></svg>;
}
