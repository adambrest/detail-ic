const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const {startServer}=require("./server.cjs");
(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true }),
    context = await browser.newContext(),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(server.url);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  assert.deepEqual(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("detail-ic-v2")).enabled,
    ),
    [],
  );
  await page
    .locator("#tabs")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByRole("switch", { name: "Enable BTP", exact: true }).click();
  await page
    .locator("#tabs")
    .getByRole("button", { name: "Participants", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add participants", exact: false })
    .first()
    .click();
  await page.locator("textarea[name=names]").fill("Backup Firer");
  await page
    .locator("#dialog")
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await page.getByRole("button", { name: "Options for Backup Firer" }).click();
  await page
    .getByRole("button", { name: "Enter Stage A · Day", exact: true })
    .click();
  await page.locator("#dialog input[name=hits]").fill("16");
  await page.getByRole("button", { name: "Save score", exact: true }).click();
  const data = await page.evaluate(() => localStorage.getItem("detail-ic-v2"));
  await page
    .locator("#tabs")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  assert.ok((await downloading).suggestedFilename().startsWith("detail-ic-"));
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#dialog .error").textContent.length > 0,
  );
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(data),
    });
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("#dialog").open);
  await page.reload();
  assert.ok((await page.locator("#main").innerText()).includes("Backup Firer"));
  await page
    .locator("#tabs")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByText("Earlier records (1)", { exact: true }).click();
  await page.getByRole("button", { name: "View", exact: true }).click();
  assert.ok(
    (await page.locator("#dialog").innerText()).includes("Backup Firer"),
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const other = await context.newPage();
  await other.goto(server.url);
  await other
    .locator("#tabs")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await other
    .getByRole("switch", { name: "Enable ATP (M)", exact: true })
    .click();
  await page.waitForFunction(
    () => !document.querySelector("#storage-warning").hidden,
  );
  await page
    .locator("#tabs")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page
    .getByRole("switch", { name: "Enable CS (M)", exact: true })
    .click();
  assert.ok(
    (await page.locator("#storage-warning").innerText()).includes(
      "another tab",
    ),
  );
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("detail-ic-v2")),
  );
  assert.ok(persisted.enabled.includes("ATP_M"));
  assert.ok(!persisted.enabled.includes("CS_M"));
  assert.ok(
    persisted.archives.some(
      (a) => a.shoot?.participants?.[0]?.name === "Backup Firer",
    ),
  );
  assert.deepEqual(errors, []);
  await browser.close();
  await server.stop();
  console.log(
    "Recovery: manual score entry, backup validation/restore, earlier records, and stale-tab protection passed",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
