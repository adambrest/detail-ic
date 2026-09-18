const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { startServer } = require("./server.cjs");
(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true }),
    context = await browser.newContext(),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(server.url);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  const version = await page.evaluate(() => globalThis.APP_VERSION);
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.ok(await page.locator("#update").isHidden());
  assert.ok(await page.locator("#status").isVisible());

  // A newer version installs in the background and waits to be applied.
  server.overrides["/version.js"] = 'globalThis.APP_VERSION = "9.9.9";';
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg.update();
  });
  await page.locator("#update").waitFor({ state: "visible", timeout: 10000 });
  assert.ok(await page.locator("#status").isHidden());
  assert.equal(await page.evaluate(() => globalThis.APP_VERSION), version);

  // Applying it reloads the page on the new version and drops the old cache.
  await page.locator("#update").click();
  await page.waitForFunction(() => globalThis.APP_VERSION === "9.9.9", null, {
    timeout: 10000,
  });
  assert.ok(await page.locator("#update").isHidden());
  assert.deepEqual(await page.evaluate(() => caches.keys()), [
    "detail-ic-v9.9.9",
  ]);
  assert.ok(
    (await page.locator("#main").innerText()).includes("New shoot"),
    "the app still runs after updating",
  );

  // The updated app still works with the server gone.
  await server.stop();
  await context.setOffline(true);
  await page.reload();
  assert.ok((await page.locator("#main").innerText()).includes("New shoot"));
  assert.deepEqual(errors, []);
  await browser.close();
  console.log("Update: background install, Update button, reload and offline use passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
