/**
 * Minimal zero-dependency i18n for Treeble.
 *
 * Locale is detected from `navigator.language` once at init.
 * Uses Vite import.meta.glob to bundle all locale JSON files at build time.
 *
 * Fallback chain: detected locale → en.json → raw key.
 */

// ponytail: eager glob bundles all JSONs. For 18 locales ~10 kB total — fine.
const localeModules = import.meta.glob<{ default: Record<string, string> }>(
  "/src/locales/*.json",
  { eager: true },
);

const LOCALES: Record<string, Record<string, string>> = {};
for (const [path, module] of Object.entries(localeModules)) {
  const lang = path.split("/").pop()?.replace(".json", "") ?? "";
  LOCALES[lang] = module.default;
}

let g_locale = "en";
let g_dict: Record<string, string> = LOCALES["en"] ?? {};

/** Detect preferred language from the browser/WebView. */
function detect(): string {
  const raw = navigator.language ?? "";
  const full = raw.toLowerCase();
  // Try exact match first (e.g. es-MX, pt-BR, zh-TW)
  if (full in LOCALES) return full;
  // Fall back to base language (e.g. es, pt, zh)
  const base = full.split("-")[0];
  if (base in LOCALES) return base;
  return "en";
}

/** Initialise i18n — call once at app startup before rendering. */
export function init(): void {
  g_locale = detect();
  g_dict = LOCALES[g_locale] ?? LOCALES["en"] ?? {};
  console.log("[i18n] locale:", g_locale);
}

/** Translate a key. Falls back to en.json → raw key. */
export function t(key: string): string {
  return g_dict[key] ?? LOCALES["en"]?.[key] ?? key;
}

/** Return the active locale code (e.g. "en", "ru"). */
export function locale(): string {
  return g_locale;
}
