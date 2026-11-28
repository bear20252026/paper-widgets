import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const origin = process.env.PREVIEW_URL ?? "http://localhost:4173";
const failures = [];
const browser = await chromium.launch({ channel: "chromium", args: ["--enable-unsafe-swiftshader"] });
await mkdir("artifacts", { recursive: true });
const results = [];
let activePage;

async function watch(page) {
  activePage = page;
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("crash", () => failures.push("Browser renderer crashed"));
  page.on("console", (message) => { if (message.type() === "error") failures.push(message.text()); });
  await page.emulateMedia({ reducedMotion: "reduce" });
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "zh-CN" });
  await watch(page);
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  assert.equal(await page.locator('[role="dialog"]').count(), 0, "Do not block the first visit with onboarding");
  await page.screenshot({ path: "artifacts/final-lobby-desktop.png" });
  results.push("Desktop: unobstructed branded lobby");

  await page.getByRole("button", { name: "下一款皮肤" }).click();
  assert.match(await page.locator(".skin-caption h2").innerText(), /水母电台/);
  assert.equal(await page.getByRole("button", { name: "开始游戏", exact: true }).isVisible(), true);
  assert.match(await page.locator(".control-note").innerText(), /纸间锦鲤/);
  await page.getByRole("button", { name: /进工坊先试游/ }).click();
  await page.getByRole("button", { name: /解锁造型 · 280/ }).click();
  assert.equal(await page.getByRole("button", { name: "当前已装备", exact: true }).isDisabled(), true);
  await page.screenshot({ path: "artifacts/final-workshop-desktop.png" });
  await page.getByRole("tab", { name: "全部 24", exact: true }).click();
  assert.equal(await page.locator(".atelier-tile").count(), 24);
  await page.getByLabel("搜索皮肤").fill("胶片");
  assert.equal(await page.locator(".atelier-tile").count(), 1);
  await page.getByLabel("搜索皮肤").fill("");
  await page.getByRole("button", { name: "预览胶片旅行", exact: true }).click();
  await page.getByRole("button", { name: /解锁造型 · 460/ }).click();
  assert.match(await page.getByRole("status").innerText(), /还差/);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  assert.match(await page.locator(".skin-caption h2").innerText(), /水母电台/);
  results.push("Workshop: 24 previews, search, purchase, insufficient-funds guard, explicit equip");

  await page.getByRole("button", { name: "皮肤工坊", exact: true }).click();
  await page.getByRole("tab", { name: "异想 4", exact: true }).click();
  assert.equal(await page.locator(".atelier-tile").count(), 4);
  const artFingerprints = new Set();
  for (const name of ["游走花园", "一口拉链", "发条游龙", "环游计划"]) {
    await page.getByRole("button", { name: `预览${name}`, exact: true }).click();
    await page.waitForTimeout(100);
    const fingerprint = await page.locator(".atelier-stage canvas").evaluate((canvas) => {
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0, hash = 0;
      for (let i = 0; i < pixels.length; i += 16) {
        if (pixels[i + 3] > 30) ink++;
        hash = (hash * 31 + pixels[i] + pixels[i + 1] + pixels[i + 2]) >>> 0;
      }
      if (ink < 150) throw new Error("Empty skin artwork");
      return hash;
    });
    artFingerprints.add(fingerprint);
  }
  assert.equal(artFingerprints.size, 4);
  await page.getByRole("button", { name: "预览发条游龙", exact: true }).click();
  await page.screenshot({ path: "artifacts/final-curious-workshop.png" });
  const trialSave = await page.evaluate(() => localStorage.getItem("snake-arena-save-v1"));
  await page.getByRole("button", { name: /先试游 20 秒/ }).click();
  await page.getByRole("button", { name: "放大试游画面", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "缩小试游画面", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "缩小试游画面", exact: true }).click();
  const trialCanvas = page.locator(".trial-court canvas");
  const court = await trialCanvas.boundingBox();
  await page.mouse.move(court.x + court.width * .62, court.y + court.height * .38);
  await trialCanvas.focus();
  await page.waitForTimeout(200);
  assert.match(await page.locator(".trial-footer").innerText(), /你正在操控/);
  await page.keyboard.down("Space");
  await page.waitForTimeout(240);
  assert.equal(await page.locator('.trial-actions .is-boosting').count(), 1);
  await page.keyboard.up("Space");
  await page.screenshot({ path: "artifacts/final-locked-skin-trial.png" });
  await page.locator(".trial-finished").waitFor({ timeout: 60000 });
  assert.equal(await page.evaluate(() => localStorage.getItem("snake-arena-save-v1")), trialSave);
  await page.getByRole("button", { name: "再试一次", exact: true }).click();
  await page.waitForTimeout(200);
  assert.equal(await page.locator(".trial-finished").count(), 0);
  await page.getByRole("button", { name: "回到工坊", exact: true }).click();
  assert.match(await page.locator(".atelier-details h3").innerText(), /发条游龙/);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  results.push("Curious objects: four distinct rendered structures; locked-skin 20s trial, steering, boost and reset without save mutations");

  await page.reload({ waitUntil: "networkidle" });
  assert.match(await page.locator(".skin-caption h2").innerText(), /水母电台/);
  results.push("Storage: purchased skin persists after reload");

  await page.getByRole("button", { name: "成长手册", exact: true }).click();
  await page.getByRole("button", { name: /每日收集与纸格旅券/ }).click();
  await page.getByRole("button", { name: "领取第 1 天奖励", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "今日已领取", exact: true }).isDisabled(), true);
  await page.getByRole("tab", { name: "今日任务", exact: true }).click();
  assert.equal(await page.locator(".notebook-row").count(), 3);
  await page.getByRole("tab", { name: "纸格旅券", exact: true }).click();
  assert.equal(await page.locator(".season-row").count(), 20);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator('[role="dialog"]').count(), 0);
  results.push("Rewards: one daily claim, three tasks, 20-tier journal, Escape dismiss");

  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("switch", { name: "背景音乐", exact: true }).click();
  await page.getByRole("slider", { name: "主音量", exact: true }).fill("40");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  results.push("Settings: accessible switches and volume controls");

  await page.getByRole("button", { name: "皮肤工坊", exact: true }).click();
  await page.getByRole("tab", { name: "异想 4", exact: true }).click();
  await page.getByRole("button", { name: "预览游走花园", exact: true }).click();
  await page.getByRole("button", { name: "使用这个造型", exact: true }).click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  assert.match(await page.locator(".skin-caption h2").innerText(), /游走花园/);

  await page.getByRole("button", { name: "开始游戏", exact: true }).click();
  await page.locator(".name-input input").fill("纸格测试员");
  await page.getByRole("button", { name: "出发吧", exact: true }).click();
  await page.waitForFunction(async () => {
    const url = performance.getEntriesByType("resource").find((e) => e.name.includes("/src/store/gameStore.ts"))?.name;
    const { useGameStore } = await import(url ?? "/src/store/gameStore.ts");
    return (useGameStore.getState().hud?.timeMs ?? 0) > 300;
  }, null, { timeout: 90000 });
  await page.mouse.move(900, 350);
  await page.keyboard.down("Space");
  await page.waitForTimeout(250);
  await page.keyboard.up("Space");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  assert.match(await page.locator(".pause-sheet").innerText(), /歇一会儿/);
  await page.getByRole("button", { name: "继续游戏", exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "artifacts/final-battle-desktop.png", timeout: 60000 });
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.getByRole("button", { name: "回游乐场", exact: true }).click();
  results.push("WebGL: new structural skin, real fixed-step match, mouse/space, pause/resume/home");

  // A deterministic real-engine collision fixture drives the result UI.
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType("resource");
    const engineUrl = resources.find((e) => e.name.includes("/src/game/engine.ts"))?.name;
    const storeUrl = resources.find((e) => e.name.includes("/src/store/gameStore.ts"))?.name;
    const { GameEngine } = await import(engineUrl ?? "/src/game/engine.ts");
    const { useGameStore } = await import(storeUrl ?? "/src/store/gameStore.ts");
    const fixture = new GameEngine({ seed: 107, skin: "koi", botCount: 3, onEnd: (result) => useGameStore.getState().completeRun(result) });
    const target = fixture.state.snakes.find((snake) => !snake.isPlayer);
    const point = target.points[12];
    fixture.player.x = point.x;
    fixture.player.y = point.y;
    fixture.player.spawnGrace = 0;
    fixture.step(1000 / 60);
    if (fixture.player.alive) throw new Error("Collision fixture did not settle");
    if (!useGameStore.getState().result) throw new Error("Result was not awarded by the engine");
  });
  await page.locator(".result-sheet").waitFor();
  assert.match(await page.locator(".result-sheet").innerText(), /金币已入账/);
  await page.screenshot({ path: "artifacts/final-results-desktop.png" });
  await page.getByRole("button", { name: "回游乐场", exact: true }).click();
  results.push("Settlement: genuine collision result, reward breakdown and return to lobby");
  await page.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "zh-CN" });
  await watch(mobile);
  await mobile.goto(origin, { waitUntil: "networkidle" });
  await mobile.waitForTimeout(500);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.equal(await mobile.getByRole("button", { name: "开始游戏", exact: true }).isVisible(), true);
  await mobile.screenshot({ path: "artifacts/final-lobby-mobile.png", fullPage: true });
  await mobile.getByRole("button", { name: "皮肤工坊", exact: true }).click();
  await mobile.getByRole("button", { name: "预览风筝来信", exact: true }).click();
  await mobile.screenshot({ path: "artifacts/final-workshop-mobile.png" });
  assert.equal(await mobile.locator(".atelier-details .play-button").isVisible(), true);
  await mobile.getByRole("tab", { name: "异想 4", exact: true }).click();
  await mobile.getByRole("button", { name: "预览一口拉链", exact: true }).click();
  await mobile.getByRole("button", { name: /先试游 20 秒/ }).click();
  assert.equal(await mobile.getByRole("button", { name: "缩小试游画面", exact: true }).isVisible(), true);
  const mobileCourt = await mobile.locator('.trial-court canvas').boundingBox();
  const cdp = await mobile.context().newCDPSession(mobile);
  const x = mobileCourt.x + mobileCourt.width * .6;
  const y = mobileCourt.y + mobileCourt.height * .5;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 40, y: y - 45, id: 0 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobile.waitForTimeout(250);
  assert.match(await mobile.locator('.trial-footer').innerText(), /你正在操控/);
  await mobile.screenshot({ path: "artifacts/final-trial-mobile.png" });
  await mobile.getByRole('button', { name: '回到工坊', exact: true }).click();
  await mobile.getByRole("button", { name: "关闭", exact: true }).click();
  await mobile.getByRole("button", { name: "成长手册", exact: true }).click();
  await mobile.getByRole("tab", { name: "成就", exact: true }).click();
  await mobile.screenshot({ path: "artifacts/final-notebook-mobile.png" });
  await mobile.getByRole("button", { name: "关闭", exact: true }).click();
  results.push("Mobile 390px: no horizontal overflow, all primary actions and workshop details visible");
  await mobile.close();

  assert.deepEqual(failures, [], "No browser page errors or console errors");
  console.log(results.join("\n"));
  console.log("PASS: " + results.length + " browser flows; console/page errors: 0");
} catch (error) {
  console.error("BROWSER DIAGNOSTICS", failures);
  if (activePage && !activePage.isClosed()) {
    console.error((await activePage.innerText("body").catch(() => "")).slice(0, 1800));
    await activePage.screenshot({ path: "artifacts/failing-flow.png", timeout: 10000 }).catch(() => {});
  }
  throw error;
} finally {
  await browser.close();
}