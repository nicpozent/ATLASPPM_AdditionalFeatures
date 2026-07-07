import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { LOCALES, messages, type LocaleCode } from "./messages";

// ============================================================================
//  i18n runtime — a tiny, dependency-free translation layer.
//
//  t(key, fallback?) resolves against the current locale, then English, then
//  the caller's fallback, then the key itself — so a missing translation
//  degrades gracefully rather than showing a blank.
//
//  The chosen language is persisted in localStorage and re-applied on load.
//  Scope is UI chrome only (see messages.ts); a live translation service can be
//  layered on later without changing this contract.
// ============================================================================

export type TFunc = (key: string, fallback?: string) => string;

interface I18nCtx {
  locale: LocaleCode;
  setLocale: (l: LocaleCode) => void;
  t: TFunc;
}
const Ctx = createContext<I18nCtx | null>(null);

const KEY = "atlas.lang";
const codes = LOCALES.map((l) => l.code);

function initialLocale(): LocaleCode {
  const saved = localStorage.getItem(KEY);
  return (saved && (codes as string[]).includes(saved) ? saved : "en") as LocaleCode;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(initialLocale);

  const setLocale = useCallback((l: LocaleCode) => {
    setLocaleState(l);
    localStorage.setItem(KEY, l);
    // Reflect the language on <html lang> for accessibility and correct
    // hyphenation/spellcheck; harmless if the element isn't present.
    document.documentElement.setAttribute("lang", l);
  }, []);

  const t = useCallback<TFunc>(
    (key, fallback) => messages[locale]?.[key] ?? messages.en[key] ?? fallback ?? key,
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider by design; affects dev HMR only
export function useI18n(): I18nCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used within I18nProvider");
  return c;
}

// Convenience hook for components that only need to translate.
// eslint-disable-next-line react-refresh/only-export-components -- convenience hook co-located with the provider; affects dev HMR only
export function useT(): TFunc {
  return useI18n().t;
}

export { LOCALES };
export type { LocaleCode };
