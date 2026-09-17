const { chromium, webkit } = require("playwright");
const assert = require("node:assert/strict");
const {startServer}=require("./server.cjs");
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
    assert.ok(
      (await page.locator("#main").innerText()).includes("Enable a shoot"),
    );
    await page
      .locator("#tabs")
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    assert.equal(await page.getByRole("switch", { checked: false }).count(), 6);
    assert.equal(await page.locator("input[name=name]").count(), 0);
    await page.screenshot({
      path: `tests/${name}-settings.png`,
      fullPage: true,
    });
    await page.getByRole("switch", { name: "Enable BTP", exact: true }).click();
    assert.equal(
      await page
        .getByRole("spinbutton", {
          name: "BTP Stage B · Night suggested score",
        })
        .count(),
      0,
    );
    assert.ok(
      (await page.locator(".sample").first().innerText()).includes("13/16"),
    );
    await page
      .locator("#tabs")
      .getByRole("button", { name: "Participants", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add participants", exact: false })
      .first()
      .click();
    await page
      .locator("textarea[name=names]")
      .fill("Alex Tan\nBenjamin Lee\nChris Wong");
    await page
      .locator("#dialog")
      .getByRole("button", { name: "Add", exact: true })
      .click();
    await page.getByRole("button", { name: "Fill all", exact: true }).click();
    await page
      .locator("#tabs")
      .getByRole("button", { name: "Stage A · Day", exact: true })
      .click();
    for (const [person, hits] of [
      ["Alex Tan", "8"],
      ["Benjamin Lee", "11"],
      ["Chris Wong", "14"],
    ])
      await page
        .getByRole("spinbutton", { name: `${person} hits`, exact: true })
        .fill(hits);
    await page
      .getByRole("button", { name: "Save entered scores", exact: true })
      .click();
    assert.equal(await page.locator(".queue-row").count(), 2);
    assert.ok(
      (await page.locator(".queue-row").first().innerText()).includes(
        "Benjamin Lee",
      ),
    );
    await page.locator(".queue-row").first().locator(".info").hover();
    assert.ok(
      await page.locator(".queue-row").first().locator(".tooltip").isVisible(),
    );
    await page.mouse.move(5, 5);
    await page.screenshot({
      path: `tests/${name}-desktop.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Select all", exact: true }).click();
    await page.getByRole("button", { name: /Mark detailed/ }).click();
    assert.equal(await page.locator(".queue-row").count(), 0);
    await page
      .getByRole("spinbutton", { name: "Alex Tan hits", exact: true })
      .fill("13");
    await page
      .getByRole("button", { name: "Save entered scores", exact: true })
      .click();
    await page
      .locator("#tabs")
      .getByRole("button", { name: "Stage B · Night", exact: true })
      .click();
    await page
      .getByRole("spinbutton", { name: "Alex Tan hits", exact: true })
      .fill("13");
    await page
      .getByRole("button", { name: "Save entered scores", exact: true })
      .click();
    await page
      .locator("#tabs")
      .getByRole("button", { name: "Final scores", exact: true })
      .click();
    assert.ok(
      (await page.locator("tbody tr").first().innerText()).includes("26/32"),
    );
    assert.ok(
      (await page.locator("tbody tr").first().innerText()).includes("Marksman"),
    );
    await page
      .locator("#tabs")
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await page
      .getByRole("switch", { name: "Enable CS (SP)", exact: true })
      .click();
    await page
      .locator("#tabs")
      .getByRole("button", { name: "Participants", exact: true })
      .click();
    await page.locator("#shoot").selectOption("CS_SP");
    await page
      .getByRole("button", { name: "Add participants", exact: false })
      .first()
      .click();
    await page
      .locator("textarea[name=names]")
      .fill("Dana Koh\nEvan Lim\nFarah Ali");
    await page
      .locator("#dialog")
      .getByRole("button", { name: "Add", exact: true })
      .click();
    assert.ok((await page.locator(".errors").innerText()).includes("Too few"));
    await page.getByRole("button", { name: "＋ Add", exact: true }).click();
    await page.locator("textarea[name=names]").fill("Grace Tan");
    await page
      .locator("#dialog")
      .getByRole("button", { name: "Add", exact: true })
      .click();
    assert.equal(await page.locator(".errors").count(), 0);
    await page
      .locator("#tabs")
      .getByRole("button", { name: "Stage A", exact: true })
      .click();
    await page
      .getByRole("spinbutton", { name: "Detail 1 total hits", exact: true })
      .fill("43");
    await page
      .getByRole("checkbox", { name: "All 4 accounted for", exact: true })
      .check();
    await page
      .getByRole("combobox", { name: "Dana Koh rifle for Stage A" })
      .selectOption("LMG");
    await page
      .getByRole("combobox", { name: "Evan Lim rifle for Stage A" })
      .selectOption("M16");
    await page
      .getByRole("combobox", { name: "Farah Ali rifle for Stage A" })
      .selectOption("LMG");
    assert.ok(
      (await page.locator(".draft-errors").innerText()).includes("non-SAR21"),
    );
    await page
      .getByRole("button", { name: "Confirm scores", exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("detail-ic-v2")).shoots.CS_SP.attempts
            .length,
      ),
      0,
    );
    await page
      .getByRole("combobox", { name: "Farah Ali rifle for Stage A" })
      .selectOption("SAR21");
    // A full offline reload must recover the roster, stage weapons, and unfinished aggregate draft.
    await server.stop();
    if(name === "chromium") await context.setOffline(true);
    await page.reload();
    await page
      .locator("#tabs")
      .getByRole("button", { name: "Stage A", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "Detail 1 total hits" })
        .inputValue(),
      "43",
    );
    assert.equal(
      await page
        .getByRole("combobox", { name: "Dana Koh rifle for Stage A" })
        .inputValue(),
      "LMG",
    );
    assert.ok(
      await page
        .getByRole("checkbox", { name: "All 4 accounted for" })
        .isChecked(),
    );
    await page
      .getByRole("button", { name: "Confirm scores", exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("detail-ic-v2")).shoots.CS_SP
            .attempts[0].score,
      ),
      10,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `tests/${name}-mobile.png`, fullPage: true });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.reload();
    await page
      .locator("#tabs")
      .getByRole("button", { name: "Final scores", exact: true })
      .click();
    assert.ok(
      (await page.locator("tbody tr").first().innerText()).includes("10/15"),
    );
    assert.ok((await page.locator("#status").innerText()).includes("Offline"));
    assert.deepEqual(errors, []);
    await browser.close();
    console.log(
      `${name}: simplified UI, defaults, scoring cycle, composition, stage weapons, mobile, and offline reload passed`,
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
