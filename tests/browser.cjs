const { chromium, webkit } = require("playwright");
const assert = require("node:assert/strict");
const { startServer } = require("./server.cjs");
const tab = (page, name) =>
  page.locator("#tabs").getByRole("button", { name, exact: true }).click();
const click = (page, name) =>
  page.getByRole("button", { name, exact: true }).click();
const waitFor = (page, fn) => page.waitForFunction(fn, null, { timeout: 5000 });
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("detail-ic-v2")));
async function inViewport(page, locator) {
  const box = await locator.boundingBox(),
    size = page.viewportSize();
  return box && box.y >= 0 && box.y + box.height <= size.height;
}
async function enterHits(page, person, hits) {
  const input = page.getByRole("spinbutton", {
    name: `${person} hits`,
    exact: true,
  });
  await input.fill(hits);
  await input.press("Enter");
}
async function newShoot(page, type, name) {
  await tab(page, "Shoots");
  await page.getByText(type, { exact: true }).click();
  await page.getByLabel("Shoot name").fill(name);
  await click(page, "Create shoot");
}
async function addNames(page, names) {
  await click(page, "Add participants");
  const whole = page.getByRole("button", {
    name: "Paste the whole list",
    exact: true,
  });
  if (await whole.count()) await whole.click();
  await page.locator("#add-names").fill(names);
  await click(page, "Add participants");
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
    assert.ok((await page.locator("#main").innerText()).includes("New shoot"));
    assert.equal(await page.locator(".type-option").count(), 7);
    assert.equal(
      await page
        .locator('a[href="https://github.com/adambrest/detail-ic"]')
        .count(),
      1,
    );

    // Settings: every type on, no rifle choice for BTP, thresholds save as typed.
    await tab(page, "Settings");
    assert.equal(await page.getByRole("switch", { checked: true }).count(), 6);
    await page.locator("[data-expand=BTP]").click();
    assert.equal(
      await page.getByRole("combobox", { name: "BTP rifle type" }).count(),
      0,
    );
    const btp = await page.locator(".preset.open").innerText();
    assert.ok(btp.includes("Pass 16/32 · Marksman 26/32"));
    assert.ok(btp.includes("Auto-detailing thresholds"));
    const threshold = page.getByRole("spinbutton", {
      name: "BTP Stage A · Day threshold",
    });
    assert.equal(await threshold.inputValue(), "13");
    await threshold.fill("14");
    await threshold.press("Tab");
    await waitFor(
      page,
      () =>
        JSON.parse(localStorage.getItem("detail-ic-v2")).presets.BTP.targets[
          "SAR21:A:marksman"
        ] === 14,
    );
    await click(page, "Reset");
    assert.equal(await threshold.inputValue(), "13");
    await page.screenshot({
      path: `tests/${name}-settings.png`,
      fullPage: true,
    });

    // BTP: paste a roster, edit it in place, then confirm it.
    await newShoot(page, "BTP", "Alpha Coy BTP");
    await addNames(page, "Alex Tan\nBenjamin Lee\nChris Wong");
    const nameBox = page.getByRole("textbox", { name: "Name for Chris Wong" });
    await nameBox.fill("Chris Wong Jr");
    await nameBox.press("Tab");
    await waitFor(page, () =>
      JSON.parse(
        localStorage.getItem("detail-ic-v2"),
      ).shoots[0].participants.some((p) => p.name === "Chris Wong Jr"),
    );
    const renamed = page.getByRole("textbox", {
      name: "Name for Chris Wong Jr",
    });
    await renamed.fill("Chris Wong");
    await renamed.press("Tab");
    await click(page, "Confirm participants");
    assert.ok(
      (await page.locator("#tabs .on").innerText()).includes("Stage A · Day"),
    );

    // Redetailing stays empty until firers have shot.
    assert.equal(await page.locator(".queue-row").count(), 0);
    await enterHits(page, "Alex Tan", "8");
    await enterHits(page, "Benjamin Lee", "11");
    await enterHits(page, "Chris Wong", "14");
    await waitFor(
      page,
      () => document.querySelectorAll(".queue-row").length === 2,
    );
    assert.ok(
      (await page.locator(".queue-row").first().innerText()).includes(
        "Benjamin Lee",
      ),
    );
    assert.equal(await page.locator(".queue .info").count(), 1);
    assert.ok(await inViewport(page, page.locator("#redetail")));
    await page
      .getByRole("button", { name: "Alex Tan priority: normal" })
      .click();
    assert.ok(
      (await page.locator(".queue-row").first().innerText()).includes(
        "Alex Tan",
      ),
    );
    await page.screenshot({
      path: `tests/${name}-desktop.png`,
      fullPage: true,
    });
    await click(page, "Select all");
    await page.locator("#redetail").click();
    await waitFor(
      page,
      () => document.querySelectorAll("tr.awaiting").length === 2,
    );

    // Results show every attempt, and Undo puts a score back.
    await enterHits(page, "Alex Tan", "13");
    const alex = page.locator("tr", { hasText: "Alex Tan" });
    await waitFor(page, () =>
      [...document.querySelectorAll("tr")].some(
        (tr) =>
          tr.innerText.includes("Alex Tan") &&
          tr.querySelector(".prev")?.textContent === "8 13",
      ),
    );
    await page.locator("#toast").getByRole("button", { name: "Undo" }).click();
    assert.equal(await alex.locator(".results b").innerText(), "8");
    await enterHits(page, "Alex Tan", "13");

    // A recorded score can be edited from the history.
    await page.getByRole("button", { name: "Options for Alex Tan" }).click();
    await click(page, "History");
    assert.ok((await page.locator("#dialog").innerText()).includes("attempt 2"));
    await page
      .locator("#dialog")
      .getByRole("button", { name: "Edit" })
      .first()
      .click();
    await page.locator("#dialog input[name=hits]").fill("15");
    await click(page, "Save score");
    assert.ok((await page.locator("#dialog").innerText()).includes("Edited"));
    await click(page, "Close");
    assert.equal(await alex.locator(".results b").innerText(), "15");
    await page.getByRole("button", { name: "Options for Alex Tan" }).click();
    await click(page, "History");
    await page
      .locator("#dialog")
      .getByRole("button", { name: "Edit" })
      .first()
      .click();
    await page.locator("#dialog input[name=hits]").fill("13");
    await click(page, "Save score");
    await click(page, "Close");

    // Redetailing a reshoot before everyone has shot asks first.
    await tab(page, "Stage B · Night");
    await enterHits(page, "Alex Tan", "13");
    await enterHits(page, "Benjamin Lee", "5");
    await waitFor(page, () =>
      [...document.querySelectorAll(".queue-row")].some((r) =>
        r.innerText.includes("Benjamin Lee"),
      ),
    );
    await page.getByRole("checkbox", { name: "Select Benjamin Lee" }).check();
    await page.locator("#redetail").click();
    assert.ok(
      (await page.locator("#dialog").innerText()).includes(
        "Not all participants have shot yet",
      ),
    );
    await click(page, "Go back");
    await page.locator("#redetail").click();
    await click(page, "Continue redetailing");
    await waitFor(
      page,
      () => document.querySelectorAll("tr.awaiting").length === 1,
    );

    await tab(page, "Final scores");
    const first = await page.locator("tbody tr").first().innerText();
    assert.ok(first.includes("26/32") && first.includes("Marksman"));
    // The results tab only opens the history.
    await page.getByRole("button", { name: "Options for Alex Tan" }).click();
    const results = await page.locator("#dialog").innerText();
    assert.ok(results.includes("attempt"));
    assert.ok(!results.includes("Queue reshoot"));
    await click(page, "Close");

    // Combat Shoot: paste detail by detail, then auto-detail the rest.
    await newShoot(page, "CS (M)", "Bravo Coy CS");
    assert.equal(await page.locator("#fill-weapon").count(), 1);
    await click(page, "Add participants");
    await click(page, "Paste detail by detail");
    await page.locator("#add-names").fill("Dana Koh\nEvan Lim\nFarah Ali");
    await click(page, "Confirm and next detail");
    assert.ok(
      (await page.locator(".add-note").innerText()).includes(
        "Detail 1 has 3 firers",
      ),
    );
    await click(page, "Done");
    assert.ok((await page.locator(".issues").innerText()).includes("Too few"));
    await addNames(
      page,
      "Grace Tan\nHenry Ng\nIvan Goh\nJoel Sim\nKai Ong\nLeon Teo\nMark Lim",
    );
    await click(page, "Auto-detail");
    assert.equal(await page.locator(".unassigned").count(), 0);
    assert.equal(await page.locator(".issues").count(), 0);
    assert.deepEqual(
      (await stored(page)).shoots[1].details.map((d) => d.name),
      ["Detail 1", "Detail 2"],
    );

    // LMG is given out per firer, and three of them is too many for one detail.
    for (const person of ["Dana Koh", "Evan Lim"])
      await page
        .getByRole("combobox", { name: `Rifle for ${person}` })
        .selectOption("LMG");
    assert.equal(await page.locator(".issues").count(), 0);
    await page
      .getByRole("combobox", { name: "Rifle for Farah Ali" })
      .selectOption("LMG");
    assert.ok((await page.locator(".issues").innerText()).includes("non-SAR21"));
    await page
      .getByRole("combobox", { name: "Rifle for Farah Ali" })
      .selectOption("SAR21/M203");
    await page.locator("#search").fill("Farah");
    assert.equal(await page.locator("tr.match").count(), 1);
    await page.locator("#search").fill("");
    await click(page, "Confirm participants");
    assert.ok((await page.locator("#main").innerText()).includes("Detail 1"));

    // Stage A is scored by detail, and confirmed details drop out of the way.
    await page
      .getByRole("spinbutton", { name: "Detail 1 total hits" })
      .fill("43");
    await click(page, "Confirm scores for Detail 1");
    await waitFor(
      page,
      () => document.querySelectorAll(".score-panel").length === 1,
    );
    assert.ok(
      (await page.locator("#main").innerText()).includes("Show 1 scored detail"),
    );
    assert.equal(
      (await stored(page)).shoots[1].attempts.filter((a) => a.stage === "A")[0]
        .score,
      8,
    );

    // A manual detail lands in the table so its scores can be entered.
    await click(page, "Manual detail");
    for (const person of [
      "Dana Koh",
      "Evan Lim",
      "Grace Tan",
      "Henry Ng",
      "Ivan Goh",
    ])
      await page.getByRole("checkbox", { name: `Include ${person}` }).check();
    await click(page, "Keep as a detail");
    await waitFor(page, () =>
      [...document.querySelectorAll(".score-panel h3")].some(
        (h) => h.textContent === "Temp detail 1",
      ),
    );
    // Detail 2 is flagged; Detail 1 is flagged too once the scored details show.
    assert.equal(await page.locator(".detail-head .warn").count(), 1);
    await click(page, "Show 1 scored detail");
    assert.equal(await page.locator(".detail-head .warn").count(), 2);
    await click(page, "Hide scored details");
    await page
      .getByRole("spinbutton", { name: "Temp detail 1 total hits" })
      .fill("60");
    await click(page, "Confirm scores for Temp detail 1");
    await waitFor(page, () =>
      JSON.parse(localStorage.getItem("detail-ic-v2")).shoots[1].attempts.some(
        (a) => a.score === 12,
      ),
    );
    await waitFor(page, () =>
      [...document.querySelectorAll(".queue-row")].some((r) =>
        r.innerText.includes("Temp detail 1"),
      ),
    );

    // Stage B has no details at all, and can be fired on another rifle.
    await tab(page, "Stage B");
    assert.equal(await page.locator(".score-panel").count(), 1);
    assert.equal(
      await page.getByRole("button", { name: /Confirm scores/ }).count(),
      0,
    );
    assert.ok(
      (await page.locator(".stage-note").innerText()).includes(
        "Details do not apply",
      ),
    );
    await page
      .getByRole("combobox", { name: "Dana Koh rifle for Stage B" })
      .selectOption("SAR21/M203");
    await enterHits(page, "Dana Koh", "6");
    await waitFor(page, () =>
      JSON.parse(localStorage.getItem("detail-ic-v2")).shoots[1].attempts.some(
        (a) => a.stage === "B" && a.weapon === "SAR21/M203",
      ),
    );

    // Stage C goes back to the original details.
    await tab(page, "Stage C");
    assert.equal(await page.locator(".score-panel").count(), 2);
    assert.equal(await page.locator(".detail-head .warn").count(), 0);

    // Clearing is refused once scores exist.
    await tab(page, "Participants");
    await click(page, "Edit participants");
    await click(page, "Clear participants");
    await page
      .locator("#dialog")
      .getByRole("button", { name: "Clear participants", exact: true })
      .click();
    assert.ok(
      (await page.locator("#dialog .error").innerText()).includes(
        "Delete the shoot",
      ),
    );
    await click(page, "Cancel");

    // Shoots page: export, import and delete.
    await tab(page, "Shoots");
    assert.equal(await page.locator(".shoot-row").count(), 2);
    const downloading = page.waitForEvent("download");
    await click(page, "Export backup");
    assert.ok((await downloading).suggestedFilename().startsWith("detail-ic-"));
    await click(page, "Import backup");
    await click(page, "Close");
    await page.getByRole("button", { name: "Delete Alpha Coy BTP" }).click();
    await click(page, "Delete shoot");
    await waitFor(
      page,
      () => document.querySelectorAll(".shoot-row").length === 1,
    );

    // A full offline reload keeps everything.
    await server.stop();
    if (name === "chromium") await context.setOffline(true);
    await page.reload();
    await tab(page, "Stage A");
    assert.equal(await page.locator(".score-panel").count(), 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `tests/${name}-mobile.png`, fullPage: true });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.ok(await inViewport(page, page.locator("#redetail")));
    await tab(page, "Final scores");
    assert.ok(
      (await page.locator("tbody tr").first().innerText()).includes("12/20"),
    );
    await waitFor(page, () =>
      document.querySelector("#status").textContent.includes("Offline"),
    );
    assert.deepEqual(errors, []);
    await browser.close();
    console.log(
      `${name}: shoots, settings, roster editing, confirm, auto-detail, rifles, scoring, history editing, redetailing, manual details, Stage B, mobile and offline reload passed`,
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
