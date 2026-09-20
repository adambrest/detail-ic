const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { startServer } = require("./server.cjs");
const tab = (page, name) =>
  page.locator("#tabs").getByRole("button", { name, exact: true }).click();
(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true }),
    context = await browser.newContext(),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(server.url);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  assert.equal(await page.locator(".type-option").count(), 7);
  await tab(page, "Settings");
  await page.locator("#require-breakdown").uncheck();
  await tab(page, "Shoots");
  await page.getByLabel("Shoot name").fill("Recovery shoot");
  await page.getByRole("button", { name: "Create shoot", exact: true }).click();
  await page
    .getByRole("button", { name: "Add participants", exact: true })
    .click();
  await page.locator("#add-names").fill("Backup Firer");
  await page
    .getByRole("button", { name: "Add participants", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm participants", exact: true })
    .click();
  // Confirming stays on Participants; the stage is chosen from the tabs.
  await page
    .locator("#tabs")
    .getByRole("button", { name: "Stage A · Day", exact: true })
    .click();
  const hits = page.getByRole("spinbutton", {
    name: "Backup Firer hits",
    exact: true,
  });
  await hits.fill("16");
  await hits.press("Enter");
  await page
    .getByRole("button", { name: "Confirm scores", exact: true })
    .click();
  const data = await page.evaluate(() =>
    localStorage.getItem("detail-ic-v2-store"),
  );
  await tab(page, "Shoots");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  assert.ok((await downloading).suggestedFilename().startsWith("detail-ic-"));
  await page
    .getByRole("button", { name: "Import backup", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#dialog .error").textContent.length > 0,
  );
  await page.locator("input[type=file]").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(data),
  });
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("#dialog").open);
  await page.reload();
  assert.ok(
    (await page.locator("#main").innerText()).includes("Recovery shoot"),
  );
  await page
    .getByRole("button", { name: "Open Recovery shoot", exact: true })
    .click();
  // A shoot with scores opens on its active stage; the roster is a tab away.
  await tab(page, "Participants");
  assert.equal(
    await page
      .getByRole("textbox", { name: "Name for Backup Firer" })
      .inputValue(),
    "Backup Firer",
  );

  // Another tab's change blocks overwriting.
  const other = await context.newPage();
  await other.goto(server.url);
  await other.getByLabel("Shoot name").fill("Second tab shoot");
  await other
    .getByRole("button", { name: "Create shoot", exact: true })
    .click();
  await page.waitForFunction(
    () => !document.querySelector("#storage-warning").hidden,
  );
  await tab(page, "Settings");
  const threshold = page.getByRole("spinbutton", {
    name: "BTP SAR21 Stage A · Day threshold",
  });
  await page.locator("[data-expand=BTP]").click();
  await page.locator('[data-expand="BTP|standard|SAR21"]').click();
  await threshold.fill("15");
  await threshold.press("Tab");
  assert.ok(
    (await page.locator("#storage-warning").innerText()).includes(
      "another tab",
    ),
  );
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("detail-ic-v2-store")),
  );
  assert.equal(persisted.shoots.length, 2);
  assert.equal(
    persisted.presets?.BTP?.targets?.["SAR21:A:marksman"],
    undefined,
  );

  assert.deepEqual(errors, []);
  await browser.close();
  await server.stop();
  console.log(
    "Recovery: manual score entry, backup validation/restore, shoot list, stale-tab protection passed",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
