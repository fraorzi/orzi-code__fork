import { describe, expect, it } from "vitest";
import {
  AI_LANGUAGE_VALUES,
  SUPPORTED_LOCALES,
  resolveAiLanguageName,
  resolveLocale,
} from "./locale";

describe("resolveLocale", () => {
  it("ships only English and Polish", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "pl"]);
    expect(AI_LANGUAGE_VALUES).toEqual(["match-app", "en", "pl"]);
  });

  it("returns an explicit supported locale", () => {
    expect(resolveLocale("pl", ["en-US"])).toBe("pl");
  });

  it("matches regional and normalized system preferences", () => {
    expect(resolveLocale("system", ["pl-PL"])).toBe("pl");
    expect(resolveLocale("system", [" PL_pl "])).toBe("pl");
    expect(resolveLocale("system", ["en-GB"])).toBe("en");
  });

  it("skips removed languages and tries the next system preference", () => {
    expect(resolveLocale("system", ["de-DE", "pl-PL"])).toBe("pl");
  });

  it("falls back to English when no preferred language is supported", () => {
    expect(resolveLocale("system", ["zh-CN", "pt-BR"])).toBe("en");
    expect(resolveLocale("system", [])).toBe("en");
  });
});

describe("resolveAiLanguageName", () => {
  it("omits the directive for English", () => {
    expect(resolveAiLanguageName("en", "pl", ["pl-PL"])).toBeUndefined();
    expect(resolveAiLanguageName("match-app", "system", ["en-US"])).toBeUndefined();
  });

  it("uses Polish when pinned or matching the interface", () => {
    expect(resolveAiLanguageName("pl", "en", ["en-US"])).toBe("Polish");
    expect(resolveAiLanguageName("match-app", "pl", ["en-US"])).toBe("Polish");
    expect(resolveAiLanguageName("match-app", "system", ["pl-PL"])).toBe("Polish");
  });
});
