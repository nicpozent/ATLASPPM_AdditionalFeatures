import { describe, it, expect } from "vitest";
import { LOCALES, messages, type LocaleCode } from "./messages";
import { SCREENS } from "@/nav";

const enKeys = Object.keys(messages.en);

describe("translation catalogs", () => {
  it("every locale is registered with a catalog", () => {
    for (const { code } of LOCALES) {
      expect(messages[code as LocaleCode], `missing catalog: ${code}`).toBeTruthy();
    }
  });

  it("every locale covers all English keys (no gaps, no blanks)", () => {
    for (const { code } of LOCALES) {
      const cat = messages[code as LocaleCode];
      for (const key of enKeys) {
        expect(cat[key], `${code} missing "${key}"`).toBeTruthy();
        expect(cat[key].trim().length, `${code} blank "${key}"`).toBeGreaterThan(0);
      }
    }
  });

  it("no locale carries stray keys absent from English", () => {
    const en = new Set(enKeys);
    for (const { code } of LOCALES) {
      for (const key of Object.keys(messages[code as LocaleCode])) {
        expect(en.has(key), `${code} has stray key "${key}"`).toBe(true);
      }
    }
  });

  it("every screen has a translatable label and subtitle", () => {
    for (const id of Object.keys(SCREENS)) {
      expect(messages.en[`screen.${id}.label`], `no label for ${id}`).toBeTruthy();
      expect(messages.en[`screen.${id}.subtitle`], `no subtitle for ${id}`).toBeTruthy();
    }
  });
});
