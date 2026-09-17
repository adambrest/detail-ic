const { chromium, webkit } = require("playwright");
const assert = require("node:assert/strict");
const { startServer } = require("./server.cjs");
const tab = (page, name) =>
  page.locator("#tabs").getByRole("button", { name, exact: true }).click();
const waitFor = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 5000 });
async function inViewport(page, locator) {
  const box = await locator.boundingBox(),
    size = page.viewportSize();
  return box && box.y >= 0 && box.y + box.height <= size.height;
}
async function enterHits(page, person, hits) {
  const input = page.getByRole("spinbutton", { name: `${person} hits`, exact: true });
  await input.fill(hits);
  await input.press("Enter");
}
(async () => {
  for (const [name, type] of [
    ["chromium", chromium],
    ["webkit", webkit],
  ]) {
    const server = await startServer();
    const browser = await type.launch({ headless: true }),
      context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(server.url);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    assert.equal(await page.title(), "Detail IC");
    const landing = await page.locator("#main").innerText();
    assert.ok(landing.includes("New shoot"));
    assert.equal(await page.locator(".type-option").count(), 7);

    // Every type is on by default; turning one off closes its settings.
    await tab(page, "Settings");
    assert.equal(await page.getByRole("switch", { checked: true }).count(), 6);
    await page.locator("[data-expand=ATP_SP]").click();
    await page.getByRole("switch", { name: "Enable ATP (SP)", exact: true }).click();
    assert.ok(
      (await page.locator(".preset.open").innerText()).includes(
        "Turn on ATP (SP) to edit its settings",
      ),
    );
    await page.locator("[data-expand=ATP_SP]").click();
    await page.locator("[data-expand=BTP]").click();
    assert.equal(
      await page.getByRole("combobox", { name: "BTP rifle type" }).count(),
      0,
    );
    const btp = await page.locator(".preset.open").innerText();
    assert.ok(btp.includes("SAR21") && btp.includes("Pass 16/32 · Marksman 26/32"));
    assert.ok(btp.includes("Auto-detailing thresholds"));
    assert.ok(!btp.includes("Source") && !btp.includes("requires"));
    assert.equal(await page.getByRole("button", { name: "Save suggestions" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Export backup" }).count(), 0);
    const threshold = page.getByRole("spinbutton", { name: "BTP Stage A · Day threshold" });
    assert.equal(await threshold.inputValue(), "13");
    await threshold.fill("14");
    await threshold.press("Tab");
    await waitFor(page, () =>
      JSON.parse(localStorage.getItem("detail-ic-v2")).presets.BTP.targets["SAR21:A:marksman"] === 14,
    );
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    assert.equal(
      await page.getByRole("spinbutton", { name: "BTP Stage A · Day threshold" }).inputValue(),
      "13",
    );
    assert.equal(await page.locator('a[href="https://github.com/adambrest/detail-ic"]').count(), 1);
    assert.equal(await page.locator('a[href*="detail-ic/issues/new"]').count(), 1);
    await page.screenshot({ path: `tests/${name}-settings.png`, fullPage: true });

    // New shoot needs a name.
    await tab(page, "Shoots");
    await page.getByRole("button", { name: "Create shoot", exact: true }).click();
    assert.equal(await page.locator("#tabs button").count(), 2);
    await page.getByLabel("Shoot name").fill("Alpha Coy BTP");
    await page.getByRole("button", { name: "Create shoot", exact: true }).click();
    await page.getByRole("button", { name: "Add participants", exact: true }).click();
    await page.locator("#add-names").fill("Alex Tan\nBenjamin Lee\nChris Wong");
    await page.getByRole("button", { name: "Add participants", exact: true }).click();
    assert.ok(!(await page.locator("#main").innerText()).includes("Detail"));
    // Names are edited in the list itself.
    const nameBox = page.getByRole("textbox", { name: "Name for Chris Wong" });
    await nameBox.fill("Chris Wong Jr");
    await nameBox.press("Tab");
    await waitFor(page, () =>
      JSON.parse(localStorage.getItem("detail-ic-v2")).shoots[0].participants.some(
        (p) => p.name === "Chris Wong Jr",
      ),
    );
    const renamed = page.getByRole("textbox", { name: "Name for Chris Wong Jr" });
    await renamed.fill("Chris Wong");
    await renamed.press("Tab");

    // Scores save on Enter; the redetail controls are visible without scrolling.
    await tab(page, "Stage A · Day");
    await enterHits(page, "Alex Tan", "8");
    await enterHits(page, "Benjamin Lee", "11");
    await enterHits(page, "Chris Wong", "14");
    await waitFor(page, () => document.querySelectorAll(".queue-row").length === 2);
    assert.ok((await page.locator(".queue-row").first().innerText()).includes("Benjamin Lee"));
    assert.equal(await page.locator(".queue .info").count(), 1);
    assert.equal(await page.locator(".queue-row .info").count(), 0);
    await page.locator(".queue .info").hover();
    assert.ok(await page.locator(".queue .tooltip").isVisible());
    await page.mouse.move(5, 5);
    assert.ok(await inViewport(page, page.locator("#redetail")));

    // High priority moves a firer to the front.
    await page.getByRole("button", { name: "Alex Tan priority: normal" }).click();
    assert.ok((await page.locator(".queue-row").first().innerText()).includes("Alex Tan"));
    await page.screenshot({ path: `tests/${name}-desktop.png`, fullPage: true });

    await page.getByRole("button", { name: "Select all", exact: true }).click();
    await page.locator("#redetail").click();
    await waitFor(page, () => document.querySelectorAll("tr.awaiting").length === 2);
    assert.equal(await page.locator(".queue-row").count(), 0);
    assert.ok(
      (await page.locator("tr[data-row]").first().innerText()).includes("Awaiting scores"),
    );

    // Previous results show beside the best; Undo reverses an entry.
    await enterHits(page, "Alex Tan", "13");
    const alex = page.locator("tr", { hasText: "Alex Tan" });
    await waitFor(page, () =>
      [...document.querySelectorAll("tr")].some(
        (tr) => tr.innerText.includes("Alex Tan") && tr.querySelector(".prev")?.textContent === "8 13",
      ),
    );
    assert.equal(await alex.locator(".results b").innerText(), "13");
    await page.locator("#toast").getByRole("button", { name: "Undo" }).click();
    assert.equal(await alex.locator(".results b").innerText(), "8");
    assert.ok((await alex.innerText()).includes("Awaiting scores"));
    await enterHits(page, "Alex Tan", "13");
    await waitFor(page, () => document.querySelectorAll(".prev").length === 1);

    // Redetailing a reshoot before everyone has shot asks first.
    await tab(page, "Stage B · Night");
    await enterHits(page, "Alex Tan", "13");
    await enterHits(page, "Benjamin Lee", "5");
    await waitFor(page, () =>
      [...document.querySelectorAll(".queue-row")].some((r) => r.innerText.includes("Benjamin Lee")),
    );
    await page.getByRole("checkbox", { name: "Select Benjamin Lee" }).check();
    await page.locator("#redetail").click();
    assert.ok(
      (await page.locator("#dialog").innerText()).includes(
        "Not all participants have shot yet",
      ),
    );
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    assert.equal(await page.locator(".queue-row").count(), 2);
    await page.locator("#redetail").click();
    await page.getByRole("button", { name: "Continue redetailing", exact: true }).click();
    await waitFor(page, () => document.querySelectorAll("tr.awaiting").length === 1);
    assert.equal(await page.locator(".queue-row").count(), 1);

    await tab(page, "Final scores");
    const first = await page.locator("tbody tr").first().innerText();
    assert.ok(first.includes("26/32") && first.includes("Marksman"));

    // Recorded scores lock the shoot type; the open shoot's type stays on.
    await tab(page, "Participants");
    assert.ok(await page.locator("#shoot-type").isDisabled());
    await tab(page, "Settings");
    assert.ok(
      await page.getByRole("switch", { name: "Enable BTP", exact: true }).isDisabled(),
    );

    // Combat Shoot: paste detail by detail, then fix sizes with the dropdowns.
    await tab(page, "Shoots");
    await page.getByText("CS (SP)", { exact: true }).click();
    await page.getByLabel("Shoot name").fill("Bravo Coy CS");
    await page.getByRole("button", { name: "Create shoot", exact: true }).click();
    assert.ok(!(await page.locator("#shoot-type").isDisabled()));
    assert.equal(await page.locator("#fill-weapon").count(), 1);
    await page.getByRole("button", { name: "Add participants", exact: true }).click();
    await page.getByRole("button", { name: "Paste detail by detail" }).click();
    await page.locator("#add-names").fill("Dana Koh\nEvan Lim\nFarah Ali");
    await page.getByRole("button", { name: "Confirm and next detail" }).click();
    assert.ok((await page.locator(".add-note").innerText()).includes("Detail 1 has 3 firers"));
    await page.locator("#add-names").fill("Grace Tan");
    await page.getByRole("button", { name: "Confirm and next detail" }).click();
    assert.ok((await page.locator(".add-note").innerText()).includes("Detail 2 has 1 firer"));
    await page.getByRole("button", { name: "Done", exact: true }).click();
    assert.ok((await page.locator(".issues").innerText()).includes("Too few"));
    await page
      .getByRole("combobox", { name: "Detail for Grace Tan" })
      .selectOption("1");
    assert.equal(await page.locator(".issues").count(), 0);

    // Extra names with no detail can be auto-detailed into groups.
    await page.getByRole("button", { name: "Add participants", exact: true }).click();
    await page.getByRole("button", { name: "Paste the whole list" }).click();
    await page.locator("#add-names").fill("Henry Ng\nIvan Goh\nJoel Sim\nKai Ong");
    await page.getByRole("button", { name: "Add participants", exact: true }).click();
    await page.getByRole("spinbutton", { name: "Detail size" }).fill("4");
    await page.getByRole("button", { name: "Auto-detail", exact: true }).click();
    assert.equal(await page.locator(".unassigned").count(), 0);
    assert.equal(await page.locator(".issues").count(), 0);

    // Rifles are changed per firer in the list; an all-LMG detail is allowed.
    for (const person of ["Henry Ng", "Ivan Goh", "Joel Sim", "Kai Ong"])
      await page
        .getByRole("combobox", { name: `Rifle for ${person}` })
        .selectOption("M16/LMG");
    assert.equal(await page.locator(".issues").count(), 0);
    await page
      .getByRole("combobox", { name: "Rifle for Kai Ong" })
      .selectOption("SAR21");
    assert.ok((await page.locator(".issues").innerText()).includes("non-SAR21"));
    await page
      .getByRole("combobox", { name: "Rifle for Kai Ong" })
      .selectOption("M16/LMG");
    assert.equal(await page.locator(".issues").count(), 0);

    await page.locator("#search").fill("Farah");
    assert.equal(await page.locator("tbody tr").count(), 4);
    assert.equal(await page.locator("tr.match").count(), 1);
    await page.locator("#search").fill("");

    await tab(page, "Stage A");    await tab(page, "Stage A");
    assert.equal(await page.locator(".issues").count(), 0);
    await page.getByRole("spinbutton", { name: "Detail 1 total hits", exact: true }).fill("43");

    // A full offline reload recovers the unfinished detail entry.
    await server.stop();
    if (name === "chromium") await context.setOffline(true);
    await page.reload();
    await tab(page, "Stage A");
    assert.equal(
      await page.getByRole("spinbutton", { name: "Detail 1 total hits" }).inputValue(),
      "43",
    );
    await page.getByRole("button", { name: "Confirm scores for Detail 1", exact: true }).click();
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("detail-ic-v2")).shoots[1].attempts[0].score,
      ),
      10,
    );
    assert.equal(await page.locator(".score-panel").count(), 1);
    assert.ok((await page.locator("#main").innerText()).includes("Show 1 scored detail"));

    // A manual detail saved as a new detail joins redetailing and flags its source detail.
    await page.getByRole("button", { name: "Manual detail", exact: true }).click();
    for (const person of ["Dana Koh", "Evan Lim", "Farah Ali", "Grace Tan"])
      await page.getByRole("checkbox", { name: `Include ${person}` }).check();
    assert.equal(
      await page.getByRole("combobox", { name: "Dana Koh rifle" }).inputValue(),
      "SAR21",
    );
    await page.getByRole("combobox", { name: "Dana Koh rifle" }).selectOption("M16/LMG");
    await page.getByRole("spinbutton", { name: "Manual detail total hits" }).fill("48");
    assert.ok((await page.locator(".manual-summary").innerText()).includes("→ 12/15"));
    await page.getByRole("button", { name: "Save as new detail", exact: true }).click();
    await waitFor(page, () => !document.querySelector("#dialog").open);
    const saved = await page.evaluate(
      () => JSON.parse(localStorage.getItem("detail-ic-v2")).shoots[1],
    );
    assert.equal(saved.attempts.length, 8);
    assert.equal(saved.participants.length, 8);
    assert.ok(saved.details.some((d) => d.temporary && d.memberIds.length === 4));
    await waitFor(page, () =>
      [...document.querySelectorAll(".queue-row")].some((r) =>
        r.innerText.includes("Temporary detail 1"),
      ),
    );
    assert.equal(await page.locator(".queue-row .warn").count(), 1);
    await tab(page, "Participants");
    assert.equal(await page.locator(".detail-head .warn").count(), 1);
    await tab(page, "Stage A");

    await tab(page, "Participants");
    await page.getByRole("button", { name: "Clear participants", exact: true }).click();
    await page
      .locator("#dialog")
      .getByRole("button", { name: "Clear participants", exact: true })
      .click();
    assert.ok(
      (await page.locator("#dialog .error").innerText()).includes("Delete the shoot"),
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    await tab(page, "Shoots");
    assert.equal(await page.locator(".shoot-row").count(), 2);
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export backup", exact: true }).click();
    assert.ok((await downloading).suggestedFilename().startsWith("detail-ic-"));
    await page.getByRole("button", { name: "Import backup", exact: true }).click();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Delete Alpha Coy BTP" }).click();
    await page.getByRole("button", { name: "Delete shoot", exact: true }).click();
    await waitFor(page, () => document.querySelectorAll(".shoot-row").length === 1);
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("detail-ic-v2")).shoots.length,
      ),
      1,
    );
    await tab(page, "Stage A");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `tests/${name}-mobile.png`, fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.ok(await inViewport(page, page.locator("#redetail")));
    await page.reload();
    await tab(page, "Final scores");
    assert.ok((await page.locator("tbody tr").first().innerText()).includes("12/15"));
    await waitFor(page, () => document.querySelector("#status").textContent.includes("Offline"));
    assert.deepEqual(errors, []);
    await browser.close();
    console.log(
      `${name}: shoots, delete, settings, thresholds, roster editing, auto-detail, autosave, undo, priorities, redetail prompt, detail assignment, rifles, confirm, manual detail, mobile and offline reload passed`,
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
