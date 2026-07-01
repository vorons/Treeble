/**
 * Minimal zero-dependency i18n for Treeble.
 *
 * Locale is detected from `navigator.language` once at init.
 * All locale JSON files are statically imported at build time
 * (Vite bundles them — no dynamic imports, no extra requests).
 *
 * Fallback chain: detected locale → en.json → raw key.
 */

import en from "@/locales/en.json";
import ru from "@/locales/ru.json";

// ── Locale registry ─────────────────────────────────────────────────────────
// ponytail: flat pre-import for 2 locales. If more are added, switch to
// dynamic import() or a build-time plugin.
const LOCALES: Record<string, Record<string, string>> = { en, ru };

let g_locale = "en";
let g_dict: Record<string, string> = en;

/** Detect preferred language from the browser/WebView. */
function detect(): string {
  const raw = navigator.language ?? "";
  const lang = raw.split("-")[0]?.toLowerCase() || "en";
  return lang in LOCALES ? lang : "en";
}

/** Initialise i18n — call once at app startup before rendering. */
export function init(): void {
  g_locale = detect();
  g_dict = LOCALES[g_locale] ?? en;
  console.log("[i18n] locale:", g_locale);
}

/** Translate a key. Falls back to en.json → raw key. */
export function t(key: string): string {
  return g_dict[key] ?? en[key as keyof typeof en] ?? key;
}

/** Return the active locale code (e.g. "en", "ru"). */
export function locale(): string {
  return g_locale;
}
