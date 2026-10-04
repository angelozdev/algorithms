import type { Lang } from "../../runner/src/types.ts";

const KEY = "algo.lang";

/** The only language with a file; otherwise the last one the user chose; otherwise Python. */
export function pickLang(solutions: Record<Lang, boolean>, remembered: Lang | null): Lang {
  if (solutions.py !== solutions.ts) return solutions.py ? "py" : "ts";
  return remembered ?? "py";
}

export function readRememberedLang(): Lang | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "py" || value === "ts" ? value : null;
  } catch {
    return null;
  }
}

export function rememberLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Not remembered: the next page opens with the default.
  }
}
