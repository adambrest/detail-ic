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
    assert.ok(landing.includes("Turn on the shoot types"));

    // Settings only open for enabled types; BTP has no rifle choice or source line.
    await tab(page, "Settings");
    assert.equal(await page.getByRole("switch", { checked: false }).count(), 6);
    await page.locator("[data-expand=BTP]").click();
    assert.ok(
      (await page.locator(".preset.open").innerText()).includes(
        "Turn on BTP to edit its settings",
      ),
    );
    await page.getByRole("switch", { name: "Enable BTP", exact: true }).click();
    assert.equal(
      await page.getByRole("combobox", { name: "BTP default rifle" }).count(),
      0,
    );
    await page.getByText("Scoring rules").first().click();
    const settingsText = await page.locator("#main").innerText();
    assert.ok(!settingsText.includes("Source"));
    assert.ok(!settingsText.includes("requires"));
    await page.screenshot({ path: `tests/${name}-settings.png`, fullPage: true });

    // New shoot needs a name.
    await tab(page, "Shoots");
    await page.getByRole("button", { name: "Create shoot", exact: true }).click();
    assert.equal(await page.locator("#tabs button").count(), 2);
    await page.getByLabel("Shoot name").fill("Alpha Coy BTP");
    await page.getByRole("button", { name: "Create shoot", exact: true }).click();
    await page
      .getByRole("button", { name: "Add participants", exact: false })
      .first()
      .click();
    assert.equal(await page.locator("#dialog select").count(), 0);
    await page
      .locator("textarea[name=names]")
      .fill("Alex Tan\nBenjamin Lee\nChris Wong");
    await page.locator("#dialog").getByRole("button", { name: "Add", exact: true }).click();
    assert.ok(!(await page.locator("#main").innerText()).includes("Detail"));

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
    await page.getByRole("switch", { name: "Enable CS (SP)", exact: true }).click();

    // Combat Shoot: detail numbers from the paste, then one tap per firer.
    await tab(page, "Shoots");
    await page.getByText("CS (SP)", { exact: true }).click();
    await page.getByLabel("Shoot name").fill("Bravo Coy CS");
    await page.getByRole("button", { name: "Create shoot", exact: true }).click();
    assert.ok(!(await page.locator("#shoot-type").isDisabled()));
    await page
      .getByRole("button", { name: "Add participants", exact: false })
      .first()
      .click();
    await page
      .locator("textarea[name=names]")
      .fill("Dana Koh, 1\nEvan Lim\nFarah Ali\nGrace Tan");
    await page.locator("#dialog").getByRole("button", { name: "Add", exact: true }).click();
    const issues = await page.locator(".issues").innerText();
    assert.ok(issues.includes("3 participants need a detail"));
    assert.ok(issues.includes("Too few"));
    for (const person of ["Evan Lim", "Farah Ali", "Grace Tan"])
      await page.getByRole("button", { name: `${person} detail 1`, exact: true }).click();
    assert.equal(await page.locator(".issues").count(), 0);
    await page.locator("#search").fill("Farah");
    assert.equal(await page.locator("tbody tr").count(), 4);
    assert.equal(await page.locator("tr.match").count(), 1);
    await page.locator("#search").fill("");

    await tab(page, "Stage A");
    await page.getByRole("spinbutton", { name: "Detail 1 total hits", exact: true }).fill("43");
    for (const person of ["Dana Koh", "Evan Lim", "Farah Ali"])
      await page
        .getByRole("combobox", { name: `${person} rifle for Stage A` })
        .selectOption("M16/LMG");
    assert.ok((await page.locator(".draft-errors").innerText()).includes("non-SAR21"));
    await page.getByRole("button", { name: "Confirm scores", exact: true }).click();
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("detail-ic-v2")).shoots[1].attempts.length,
      ),
      0,
    );
    await page
      .getByRole("combobox", { name: "Farah Ali rifle for Stage A" })
      .selectOption("SAR21");

    // Not present greys the row until marked present again.
    await page.getByRole("button", { name: "Options for Grace Tan" }).click();
    await page.getByRole("button", { name: "Not present for this detail" }).click();
    assert.equal(await page.locator("tr.absent").count(), 1);
    assert.ok((await page.locator(".draft-summary").innerText()).includes("1 not present"));
    await page.getByRole("button", { name: "Options for Grace Tan" }).click();
    await page.getByRole("button", { name: "Mark present" }).click();
    assert.equal(await page.locator("tr.absent").count(), 0);

    // A full offline reload recovers the unfinished detail entry.
    await server.stop();
    if (name === "chromium") await context.setOffline(true);
    await page.reload();
    await tab(page, "Stage A");
    assert.equal(
      await page.getByRole("spinbutton", { name: "Detail 1 total hits" }).inputValue(),
      "43",
    );
    assert.equal(
      await page.getByRole("combobox", { name: "Dana Koh rifle for Stage A" }).inputValue(),
      "M16/LMG",
    );
    await page.getByRole("button", { name: "Confirm scores", exact: true }).click();
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("detail-ic-v2")).shoots[1].attempts[0].score,
      ),
      10,
    );
    assert.equal(await page.locator(".score-panel").count(), 0);
    assert.ok((await page.locator("#main").innerText()).includes("Show 1 scored detail"));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `tests/${name}-mobile.png`, fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.ok(await inViewport(page, page.locator("#redetail")));
    await page.reload();
    await tab(page, "Final scores");
    assert.ok((await page.locator("tbody tr").first().innerText()).includes("10/15"));
    assert.ok((await page.locator("#status").innerText()).includes("Offline"));
    assert.deepEqual(errors, []);
    await browser.close();
    console.log(
      `${name}: shoots, settings, autosave, undo, priorities, redetail prompt, detail assignment, presence, confirm, mobile and offline reload passed`,
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
