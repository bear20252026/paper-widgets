import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EN } from "../en";
import { getLang, hasTranslation, setLang, t, tIn } from "../index";
import { FORM_INFO, SKINS, skinName } from "../../game/skins";
import { ACHIEVEMENTS, DAILY_POOL, SIGN_IN_REWARDS, TITLES, buildShareText, formatCountdown } from "../../game/meta";
import { MISSIONS, RANK_TIERS, streakTitle } from "../../game/progression";
import { AI_NAMES, AI_NAMES_EN } from "../../game/ai";

const SRC = join(__dirname, "..", "..");
const CJK = /[一-鿿]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

afterEach(() => setLang("zh"));

describe("i18n", () => {
  it("defaults to Chinese and falls back to the source string", () => {
    expect(getLang()).toBe("zh");
    expect(t("开始游戏")).toBe("开始游戏");
    expect(tIn("en", "开始游戏")).toBe("Play");
    expect(tIn("en", "完全没有翻译的句子")).toBe("完全没有翻译的句子");
  });

  it("fills placeholders in both languages", () => {
    expect(t("剩余 {n} 秒", { n: 9 })).toBe("剩余 9 秒");
    setLang("en");
    expect(t("剩余 {n} 秒", { n: 9 })).toBe("9s left");
    expect(t("当前 {len} 米 · 第 {rank} 名", { len: 120, rank: 3 })).toBe("120 m · rank #3");
  });

  it("every t(\"…\") literal in the source has an English entry", () => {
    const missing: string[] = [];
    const call = /\bt\(\s*"((?:[^"\\]|\\.)*)"/g;
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(call)) {
        if (CJK.test(m[1]) && !hasTranslation(m[1])) missing.push(`${file.replace(SRC, "")}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("all game data shown to players is translated", () => {
    const strings = [
      ...SKINS.flatMap((s) => [s.tagline, s.rarity]),
      ...Object.values(FORM_INFO).flatMap((f) => [f.label, f.desc]),
      ...DAILY_POOL.flatMap((m) => [m.title, m.desc]),
      ...SIGN_IN_REWARDS.map((r) => r.label),
      ...ACHIEVEMENTS.flatMap((a) => [a.title, a.desc]),
      ...TITLES.flatMap((x) => [x.name, x.desc]),
      ...RANK_TIERS.flatMap((r) => [r.name, r.shortName]),
      ...MISSIONS.flatMap((m) => [m.title, m.desc]),
    ];
    expect(strings.filter((s) => !hasTranslation(s))).toEqual([]);
    expect(SKINS.filter((s) => !s.englishName).map((s) => s.id)).toEqual([]);
  });

  it("English strings never leak Chinese characters (except the language switch itself)", () => {
    const allowed = new Set(["切换到中文", "语言"]);
    const leaks = Object.entries(EN).filter(([k, v]) => !allowed.has(k) && CJK.test(v));
    expect(leaks).toEqual([]);
  });

  it("localises skins, streaks, countdowns, bot names and share text", () => {
    setLang("en");
    expect(skinName(SKINS.find((s) => s.id === "koi")!)).toBe("Paper Koi");
    expect(streakTitle(3).label).toBe("TRIPLE KILL!");
    expect(formatCountdown(65_000)).toBe("1m 05s");
    const text = buildShareText({ playerName: "Ada", length: 320, rank: 2, kills: 4, bestStreak: 2, mode: "timed", tierName: "Gold Spirit", titleName: "Hunter" });
    expect(text).toContain("[Paper Snake] Ada");
    expect(text).toContain("320 m · rank #2 · 4 KOs · 2-kill streak");
    expect(CJK.test(text)).toBe(false);
    expect(AI_NAMES_EN).toHaveLength(AI_NAMES.length);
    expect(AI_NAMES_EN.some((n) => CJK.test(n))).toBe(false);
  });
});
