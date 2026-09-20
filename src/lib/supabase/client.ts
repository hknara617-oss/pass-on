"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicConfig } from "./config";

// Preserve production's SSR cookies, default storage key, and PKCE flow.
// Do not change to localStorage, clear cookies, or sign out during migration.
export function createClient() {
  const { url, key } = publicConfig();
  return createBrowserClient(url, key);
}
