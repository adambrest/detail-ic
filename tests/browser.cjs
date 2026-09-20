const { chromium, webkit } = require("playwright");
const assert = require("node:assert/strict");
const { startServer } = require("./server.cjs");
const tab = (page, name) =>
  page.locator("#tabs").getByRole("button", { name, exact: true }).click();
const click = (page, name) =>
  page.getByRole("button", { name, exact: true }).click();
const waitFor = (page, fn, arg = null) =>
  page.waitForFunction(fn, arg, { timeout: 5000 });
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

    // Settings: no switches, no rifle choice for BTP, thresholds save as typed.
    await tab(page, "Settings");
    assert.equal(await page.getByRole("switch").count(), 0);
    assert.ok(!(await page.locator("#main").innerText()).includes("Version"));
    await page.locator("[data-expand=BTP]").click();
    assert.equal(
      await page.getByRole("combobox", { name: "BTP default rifle" }).count(),
      0,
    );
    // Thresholds sit in a section per rifle, closed until opened.
    await page.locator('[data-expand="BTP|standard|SAR21"]').click();
    const btp = await page.locator(".preset.open").innerText();
    assert.ok(btp.includes("Pass 16/32 · Marksman 26/32"));
    assert.ok(btp.includes("Starting thresholds"));
    const threshold = page.getByRole("spinbutton", {
      name: "BTP SAR21 Stage A · Day threshold",
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
    // ATP (M): LMG has its own section and standard; Stage B stays at 7/8.
    await page.locator("[data-expand=ATP_M]").click();
    await page.locator('[data-expand="ATP_M|standard|LMG"]').click();
    const lmg = await page
      .locator(".rifle-set.open", { hasText: "LMG" })
      .innerText();
    assert.ok(lmg.includes("Pass 32/126 · Marksman 63/126"), lmg);
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "ATP (M) LMG Stage B threshold" })
        .inputValue(),
      "7",
    );
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
    // Scoring tabs stay shut until the participants are confirmed.
    assert.ok(
      await page
        .locator("#tabs")
        .getByRole("button", { name: "Stage A · Day", exact: true })
        .isDisabled(),
    );
    await click(page, "Confirm participants");
    // Confirming settles the roster and stays put; the stage is the user's
    // choice, and the roster is read-only until they unlock it.
    assert.ok(
      (await page.locator("#tabs .on").innerText()).includes("Participants"),
    );
    assert.ok(
      await page.getByRole("textbox", { name: /^Name for / }).first().isDisabled(),
    );
    assert.equal(
      await page.getByRole("button", { name: /^Go to / }).count(),
      0,
    );
    await tab(page, "Stage A · Day");

    // Nothing in Redetailing before any score is confirmed.
    assert.equal(await page.locator(".queue-row").count(), 0);
    assert.ok(
      (await page.locator(".queue").innerText()).includes(
        "Opens once the first Stage A · Day scores are in.",
      ),
    );
    // The stage tab is the firing order, starting as the roster.
    assert.equal(await page.locator("[data-individual] td.seat").count(), 3);
    assert.ok(
      (await page.locator("tr.next").innerText()).includes("Alex Tan"),
    );
    await enterHits(page, "Alex Tan", "8");
    await click(page, "Confirm scores");
    // Redetailing opens straight away; the firing queue shows who is next.
    await waitFor(
      page,
      () => document.querySelectorAll(".queue-row").length === 1,
    );
    const firing = await page
      .locator("[data-individual] tbody")
      .innerText();
    assert.ok(/Benjamin Lee[\s\S]*Chris Wong/.test(firing), firing);
    assert.ok(!firing.includes("Alex Tan"), firing);
    await enterHits(page, "Benjamin Lee", "11");
    await enterHits(page, "Chris Wong", "14");
    await click(page, "Confirm scores");
    await waitFor(
      page,
      () => document.querySelectorAll(".queue-row").length === 2,
    );
    // Automatic order by default: Alex is 5 short, further behind than
    // Benjamin, so he needs the practice first. Each row says why.
    const topRow = await page.locator(".queue-row").first().innerText();
    assert.ok(topRow.includes("Alex Tan"), topRow);
    // Stage B is not in yet, so 13 is a recommendation, not a promise.
    assert.ok(topRow.includes("best 8, recommended 13 for Marksman"), topRow);
    assert.equal(await page.locator(".queue .info").count(), 1);
    assert.ok(await inViewport(page, page.locator("#redetail")));
    // A priority tag still wins over the smart order.
    await page
      .getByRole("button", { name: "Benjamin Lee priority: normal" })
      .click();
    await waitFor(page, () =>
      document
        .querySelector(".queue-row")
        ?.innerText.includes("Benjamin Lee"),
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

    // Skip greys out only while that entry has hits typed in it.
    const skipAlex = page.getByRole("button", { name: "Skip Alex Tan" });
    await enterHits(page, "Alex Tan", "9");
    assert.ok(await skipAlex.isDisabled());
    await page
      .getByRole("spinbutton", { name: "Alex Tan hits", exact: true })
      .fill("");
    assert.ok(await skipAlex.isEnabled());

    // Results show every attempt, and Undo puts a score back.
    await enterHits(page, "Alex Tan", "13");
    await click(page, "Confirm scores");
    // Scored firers move into the collapsed past scores list.
    await page.locator(".past-scores > summary").first().click();
    const alex = page.locator(".past-scores tr", { hasText: "Alex Tan" });
    await waitFor(page, () =>
      [...document.querySelectorAll("tr")].some(
        (tr) =>
          tr.innerText.includes("Alex Tan") &&
          tr.querySelector(".prev")?.textContent === "8" &&
          tr.querySelector(".results b")?.textContent === "13",
      ),
    );
    await page.locator("#toast").getByRole("button", { name: "Undo" }).click();
    assert.equal(
      await page
        .locator("tr", { hasText: "Alex Tan" })
        .locator(".results b")
        .innerText(),
      "8",
    );
    await enterHits(page, "Alex Tan", "13");
    await click(page, "Confirm scores");
    await page.locator(".past-scores > summary").first().click();

    // A recorded score can be edited from the history.
    await page.getByRole("button", { name: "Options for Alex Tan" }).first().click();
    await page.locator("#dialog").getByRole("button", { name: "History", exact: true }).click();
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
    await page.locator(".past-scores > summary").first().click();
    assert.equal(await alex.locator(".results b").innerText(), "15");
    await page.getByRole("button", { name: "Options for Alex Tan" }).first().click();
    await page.locator("#dialog").getByRole("button", { name: "History", exact: true }).click();
    await page
      .locator("#dialog")
      .getByRole("button", { name: "Edit" })
      .first()
      .click();
    await page.locator("#dialog input[name=hits]").fill("13");
    await click(page, "Save score");
    await click(page, "Close");

    // Redetailing while most firers have not shot asks first, and the
    // redetail joins the back of the firing queue.
    await tab(page, "Stage B · Night");
    await enterHits(page, "Benjamin Lee", "5");
    await click(page, "Confirm scores");
    await waitFor(page, () =>
      [...document.querySelectorAll(".queue-row")].some((r) =>
        r.innerText.includes("Benjamin Lee"),
      ),
    );
    await page.getByRole("checkbox", { name: "Select Benjamin Lee" }).check();
    await page.locator("#redetail").click();
    assert.ok(
      (await page.locator("#dialog").innerText()).includes(
        "Only 1 of 3 firers",
      ),
    );
    await click(page, "Go back");
    await page.locator("#redetail").click();
    await page
      .locator("#dialog")
      .getByRole("button", { name: "Redetail", exact: true })
      .click();
    await waitFor(
      page,
      () => document.querySelectorAll("tr.awaiting").length === 1,
    );
    const order = await page
      .locator("[data-individual] tr[data-row]")
      .allInnerTexts();
    assert.ok(order[0].includes("Alex Tan"), order.join("|"));
    assert.ok(order.at(-1).includes("Benjamin Lee"), order.join("|"));
    assert.ok(order.at(-1).includes("Attempt 2 · redetailed"), order.join("|"));
    await enterHits(page, "Alex Tan", "13");
    await click(page, "Confirm scores");

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
    assert.equal(await page.locator("#fill-weapon").count(), 0);
    await click(page, "Add participants");
    await click(page, "Paste detail by detail");
    await page.locator("#add-names").fill("Dana Koh\nEvan Lim\nFarah Ali");
    await click(page, "Save and next detail");
    assert.ok(
      (await page.locator(".add-note").innerText()).includes(
        "Detail 1 has 3 firers",
      ),
    );
    await click(page, "Save and finish");
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
      .selectOption("SAR21/SAR21 SS/M203");
    // A short detail can be filled from its own row, and numbering cannot skip.
    const firstDetail = page.locator("[data-drop]").first();
    await firstDetail
      .getByRole("textbox", { name: /Add a firer to Detail 1/ })
      .fill("Nadia Goh");
    await firstDetail
      .getByRole("textbox", { name: /Add a firer to Detail 1/ })
      .press("Tab");
    await waitFor(page, () =>
      JSON.parse(localStorage.getItem("detail-ic-v2")).shoots[1].participants.some(
        (p) => p.name === "Nadia Goh",
      ),
    );
    const options = await page
      .getByRole("combobox", { name: "Detail for Nadia Goh" })
      .locator("option")
      .allInnerTexts();
    assert.ok(!options.includes("Detail 4"), "cannot skip to an empty detail");
    // Put the roster back for the scoring that follows.
    await page.getByRole("button", { name: "Remove Nadia Goh" }).click();
    await waitFor(page, () =>
      JSON.parse(
        localStorage.getItem("detail-ic-v2"),
      ).shoots[1].participants.every((p) => p.name !== "Nadia Goh"),
    );

    // A firer can be dragged onto another to set the order inside a detail.
    const detailOne = () =>
      page.evaluate(() => {
        const shoot = JSON.parse(localStorage.getItem("detail-ic-v2")).shoots[1],
          detail = shoot.details.find((d) => d.name === "Detail 1");
        return shoot.participants
          .filter((p) => p.detailId === detail.id)
          .map((p) => ({ id: p.id, name: p.name }));
      });
    const seats = await detailOne();
    await page.evaluate(([from, onto]) => {
      const dt = new DataTransfer(),
        fire = (el, type) =>
          el.dispatchEvent(
            new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }),
          );
      fire(document.querySelector(`[data-drag="${from}"]`), "dragstart");
      const target = document.querySelector(`[data-drop-row="${onto}"]`);
      fire(target, "dragover");
      fire(target, "drop");
    }, [seats.at(-1).id, seats[0].id]);
    await waitFor(
      page,
      ([first, moved]) => {
        const shoot = JSON.parse(localStorage.getItem("detail-ic-v2")).shoots[1],
          names = shoot.participants.map((p) => p.name);
        return names.indexOf(moved) < names.indexOf(first);
      },
      [seats[0].name, seats.at(-1).name],
    );
    assert.deepEqual(
      (await detailOne()).map((p) => p.name),
      [seats.at(-1).name, ...seats.slice(0, -1).map((p) => p.name)],
    );

    await page.locator("#search").fill("Farah");
    assert.equal(await page.locator("tr.match").count(), 1);
    await page.locator("#search").fill("");
    await click(page, "Confirm participants");
    // The roster is settled; which stage fires first is the user's call.
    assert.ok(
      (await page.locator("#tabs .on").innerText()).includes("Participants"),
    );
    await tab(page, "Stage A");
    assert.ok((await page.locator("#main").innerText()).includes("Detail 1"));

    // Stage A is scored by detail, and confirmed details drop out of the way.
    await page
      .getByRole("spinbutton", { name: "Detail 1 total hits" })
      .fill("43");
    await click(page, "Confirm scores for Detail 1");
    // A total with no hits is allowed, after saying what it costs.
    assert.ok(
      (await page.locator("#dialog").innerText()).includes(
        "poor-shooter warnings are off",
      ),
    );
    await click(page, "Confirm total only");
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
    await click(page, "Confirm total only");
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
    // Changing the order reshuffles the list.
    await page.locator("#order").selectOption("highest");
    await waitFor(page, () => document.querySelectorAll(".queue-row").length > 0);

    // Stage B has no details at all, and can be fired on another rifle: LMG
    // fires the same rounds as a rifle in Stage B.
    await tab(page, "Stage B");
    assert.equal(await page.locator(".score-panel").count(), 1);
    // Individual confirm, but no per-detail confirm.
    assert.equal(
      await page.getByRole("button", { name: /Confirm scores for/ }).count(),
      0,
    );
    assert.ok(
      (await page.locator(".stage-note").innerText()).includes(
        "Details do not apply",
      ),
    );
    // The Stage B rifle lives in the ⋯ menu now, off the score row.
    await page.getByRole("button", { name: "Options for Dana Koh" }).first().click();
    await page
      .getByRole("combobox", { name: "Rifle for Stage B" })
      .selectOption("SAR21/SAR21 SS/M203");
    await click(page, "Close");
    // Tab skips the rifle and Skip, straight to the next score box.
    await page.getByRole("spinbutton", { name: "Dana Koh hits" }).fill("6");
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.getAttribute("aria-label")),
      "Evan Lim hits",
    );
    await click(page, "Confirm scores");
    await waitFor(page, () =>
      JSON.parse(localStorage.getItem("detail-ic-v2")).shoots[1].attempts.some(
        (a) => a.stage === "B" && a.weapon === "SAR21/SAR21 SS/M203",
      ),
    );
    // Confirming used to crash here: a Combat Shoot firer queued on an
    // individual stage has no detail to name.
    assert.ok(
      !(await page.locator("#toast").innerText()).includes("Cannot read"),
    );
    assert.equal(
      await page.locator(".queue-row strong", { hasText: "Dana Koh" }).count(),
      1,
    );

    // History is the record of the whole shoot, and where scores are corrected.
    await tab(page, "History");
    const events = await page.locator(".event").count();
    assert.ok(events > 4, `expected a full history, saw ${events}`);
    const feed = await page.locator(".history-feed").innerText();
    for (const line of [
      "Participants added",
      "Participants confirmed",
      "Temp detail 1 built",
      "Scored",
    ])
      assert.ok(feed.includes(line), `history is missing "${line}"`);
    // Searching narrows it to one firer, temporary details included.
    await page.locator("#search").fill("Temp detail");
    await waitFor(page, () => {
      const n = document.querySelectorAll(".event").length;
      return n > 0 && n < 4;
    });
    assert.ok(
      (await page.locator(".history-feed").innerText()).includes("Temp detail 1"),
    );
    await page.locator("#search").fill("Dana Koh");
    const forDana = await page.locator(".event").count();
    assert.ok(forDana && forDana < events);
    await page.locator("#search").fill("");
    await waitFor(
      page,
      (n) => document.querySelectorAll(".event").length === n,
      events,
    );
    // A detail's scores open from its entry, and a firer's from their row.
    await page.getByRole("button", { name: /^Scores for Detail 1$/ }).first().click();
    assert.ok((await page.locator("#dialog").innerText()).includes("Detail 1"));
    await click(page, "Close");
    await page
      .getByRole("button", { name: "Scores for Dana Koh", exact: true })
      .first()
      .click();
    assert.ok((await page.locator("#dialog").innerText()).includes("History"));
    await click(page, "Close");

    // The roster keeps temporary details out, and says why a rifle is fixed.
    await tab(page, "Participants");
    assert.equal(
      await page.locator('h3:text-is("Temp detail 1")').count(),
      0,
      "temporary details do not belong on the roster",
    );
    await page.locator("[data-locked-rifle]").first().click();
    assert.ok((await page.locator("#toast").innerText()).includes("void those scores"));
    // Drilling into a detail's scores from the roster offers a way back.
    await page.getByRole("button", { name: /^Scores for Detail 1$/ }).first().click();
    await page.getByRole("button", { name: /^Stage A scores$/ }).click();
    assert.equal(await page.locator("#close-dialog").innerText(), "Back");
    await click(page, "Back");
    assert.ok((await page.locator("#dialog").innerText()).includes("Open a stage"));
    await click(page, "Close");

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
    await click(page, "Confirm participants");

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
    // On a phone the score table comes first, then Redetailing.
    const top = async (sel) => (await page.locator(sel).first().boundingBox()).y;
    assert.ok((await top(".score-panel")) < (await top(".queue")));
    await tab(page, "Final scores");
    assert.ok(
      (await page.locator("tbody tr").first().innerText()).includes("12/20"),
    );
    assert.equal(await page.locator("#status").count(), 0);
    assert.deepEqual(errors, []);
    await browser.close();
    console.log(
      `${name}: shoots, settings, roster editing, confirm, auto-detail, rifles, scoring, history editing, redetailing, manual details, Stage B, History, mobile and offline reload passed`,
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
