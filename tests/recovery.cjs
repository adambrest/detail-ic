const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { startServer } = require("./server.cjs");
const tab = (page, name) =>
  page.locator("#tabs").getByRole("button", { name, exact: true }).click();
// Saved data in the previous format: one roster per type, rifles listed singly.
const previousVersion = {
  schema: 2,
  enabled: ["ATP_M"],
  active: "ATP_M",
  aps: "standard",
  archives: [],
  shoots: {
    ATP_M: {
      id: "old-shoot",
      program: "ATP_M",
      variant: "standard",
      participants: [
        {
          id: "p1",
          name: "Earlier Firer",
          detailId: "d1",
          weapon: "HK416",
          recordId: "r1",
          profile: { id: "ATP_M:standard:HK416", version: "2026-09-17.2" },
        },
      ],
      details: [{ id: "d1", name: "Detail 1" }],
      attempts: [],
      shared: [],
      drafts: {},
      dispatches: [],
      manualQueue: [],
      audit: [],
      settings: {
        weapon: "SAR21",
        objective: "marksman",
        order: "automatic",
        targets: {},
      },
    },
  },
};
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
  await tab(page, "Settings");
  await page.getByRole("switch", { name: "Enable BTP", exact: true }).click();
  await tab(page, "Shoots");
  await page.getByLabel("Shoot name").fill("Recovery shoot");
  await page.getByRole("button", { name: "Create shoot", exact: true }).click();
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
  await tab(page, "Settings");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  assert.ok((await downloading).suggestedFilename().startsWith("detail-ic-"));
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
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
    .getByRole("button", { name: "Continue Recovery shoot", exact: true })
    .click();
  assert.ok((await page.locator("#main").innerText()).includes("Backup Firer"));

  // Another tab's change blocks overwriting.
  const other = await context.newPage();
  await other.goto(server.url);
  await tab(other, "Settings");
  await other
    .getByRole("switch", { name: "Enable ATP (M)", exact: true })
    .click();
  await page.waitForFunction(
    () => !document.querySelector("#storage-warning").hidden,
  );
  await tab(page, "Settings");
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
  assert.equal(persisted.shoots.length, 1);

  // Data saved by the previous version opens with grouped rifles.
  const upgraded = await browser.newContext(),
    older = await upgraded.newPage();
  older.on("pageerror", (e) => errors.push(e.message));
  await older.addInitScript((saved) => {
    if (!localStorage.getItem("detail-ic-v2"))
      localStorage.setItem("detail-ic-v2", JSON.stringify(saved));
  }, previousVersion);
  await older.goto(server.url);
  await older.getByRole("button", { name: "Continue ATP (M)" }).click();
  assert.ok(
    (await older.locator("#main").innerText()).includes("SAR21 SS/HK416"),
  );
  assert.equal(
    await older.evaluate(
      () => JSON.parse(localStorage.getItem("detail-ic-v2")).schema,
    ),
    3,
  );

  assert.deepEqual(errors, []);
  await browser.close();
  await server.stop();
  console.log(
    "Recovery: manual score entry, backup validation/restore, shoot list, stale-tab protection and upgrade from saved data passed",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
