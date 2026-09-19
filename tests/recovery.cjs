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
  assert.equal((await page.locator(".type-option").count()), 7);
  await page.getByLabel("Shoot name").fill("Recovery shoot");
  await page.getByRole("button", { name: "Create shoot", exact: true }).click();
  await page.getByRole("button", { name: "Add participants", exact: true }).click();
  await page.locator("#add-names").fill("Backup Firer");
  await page.getByRole("button", { name: "Add participants", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm participants", exact: true })
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
  const data = await page.evaluate(() => localStorage.getItem("detail-ic-v2"));
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
    JSON.parse(localStorage.getItem("detail-ic-v2")),
  );
  assert.equal(persisted.shoots.length, 2);
  assert.equal(persisted.presets?.BTP?.targets?.["SAR21:A:marksman"], undefined);

  // Data saved by the previous version opens with grouped rifles.
  const upgraded = await browser.newContext(),
    older = await upgraded.newPage();
  older.on("pageerror", (e) => errors.push(e.message));
  await older.addInitScript((saved) => {
    if (!localStorage.getItem("detail-ic-v2"))
      localStorage.setItem("detail-ic-v2", JSON.stringify(saved));
  }, previousVersion);
  await older.goto(server.url);
  await older.getByRole("button", { name: "Open ATP (M)" }).click();
  assert.equal(
    await older
      .getByRole("combobox", { name: "Rifle for Earlier Firer" })
      .inputValue(),
    "SAR21 SS/HK416",
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
