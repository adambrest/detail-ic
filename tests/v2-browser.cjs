const { chromium, webkit } = require("playwright");
const assert = require("node:assert/strict");
const { startServer } = require("./server.cjs");
const key = "detail-ic-v2-store";
const tab = (p, id) => p.locator(`[data-tab="${id}"]`).click();
const data = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);

(async () => {
  for (const type of [chromium, webkit]) {
    const server = await startServer(),
      browser = await type.launch(),
      page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto(server.url);
      await page.evaluate(async (k) => {
        const c = await import("./core.js"),
          store = c.newStore(),
          s = c.createShoot(store, "ATP_M", "standard", "V2 audit");
        c.addParticipants(s, "Alice Tan\nBob Lim", s.settings.weapon);
        c.setRosterLock(s, true);
        // Stage A is cleared so the test still covers configuring a stage that
        // ships with no layout. Stage B keeps its shipped four parts of two.
        delete c.preset(store, "ATP_M").breakdowns[`${s.settings.weapon}:A`];
        delete s.settings.breakdowns[`${s.settings.weapon}:A`];
        c.applyPresets(store);
        localStorage.setItem(k, JSON.stringify(store));
      }, key);
      await page.reload();
      await page.locator("[data-open-shoot]").click();
      await tab(page, "stage:B");
      for (const name of ["Bob Lim", "Alice Tan"])
        for (let i = 1; i <= 4; i++)
          await page
            .getByLabel(`${name} Practice ${i} hits`, { exact: true })
            .fill(i === 4 ? "1" : "2");
      await page.locator("#search").fill("Bob");
      assert.equal(await page.locator("[data-individual] tbody tr").count(), 2);
      assert.ok(
        (
          await page.locator("[data-individual] tbody tr").first().innerText()
        ).includes("Bob"),
      );
      await page.locator("[data-confirm-all]").click();
      let store = await data(page),
        shoot = store.shoots[0];
      assert.equal(shoot.attempts.length, 2);
      assert.deepEqual(
        shoot.attempts.map((a) => a.score),
        [7, 7],
      );
      assert.deepEqual(
        shoot.attempts.map((a) => a.participantId),
        shoot.participants.map((p) => p.id),
      );
      assert.deepEqual(
        shoot.attempts.map((a) => a.lane),
        [1, 2],
      );
      await tab(page, "stage:A");
      assert.equal(await page.locator("[data-unlock-stage]").count(), 1);
      assert.equal(await page.locator("[data-confirm-all]").isDisabled(), true);
      await page.locator("[data-unlock-stage]").click();
      // Stage A was cleared in the seed, as CS (SP) A and C still are: an unset
      // stage cannot be scored until a layout is given here.
      assert.equal(
        await page.locator("[data-hits]").first().isDisabled(),
        true,
      );
      await page.locator("[data-configure-parts]").first().click();
      await page.locator('[name="layout"]').fill("First, 12\nSecond, 12");
      await page
        .getByRole("button", { name: "Save breakdown", exact: true })
        .click();
      await page.getByLabel("Alice Tan First hits", { exact: true }).fill("10");
      await page.locator("[data-confirm-all]").click();
      assert.ok(
        (await page.locator(".draft-errors").innerText()).includes("Missing"),
      );
      assert.equal((await data(page)).shoots[0].attempts.length, 2);
      await page
        .getByLabel("Alice Tan Second hits", { exact: true })
        .fill("11");
      await page.locator("[data-confirm-all]").click();
      await tab(page, "final");
      assert.equal(await page.locator("tbody tr").count(), 2);
      // Sub-stage figures sit beside each stage score as quiet gray text.
      assert.equal(await page.locator(".sub-parts").count(), 3);
      assert.match(
        await page.locator(".sub-parts").first().innerText(),
        /^\d+( · \d+)+$/,
      );
      await tab(page, "history");
      await page.locator("#search").fill("Alice 7/8");
      assert.ok(await page.locator(".event.match").count());
      assert.ok(
        (await page.locator(".event.match").first().innerText()).includes(
          "Practice 4: 1/2",
        ),
      );
      const count = await page.locator(".event").count();
      await page.locator("#search").fill("no such name");
      assert.equal(await page.locator(".event").count(), count);

      // Stale-tab persistence must not claim that newly confirmed scores saved.
      await tab(page, "stage:A");
      await page.locator("#search").fill("");
      await page.getByLabel("Bob Lim First hits", { exact: true }).fill("8");
      await page.getByLabel("Bob Lim Second hits", { exact: true }).fill("9");
      await page.evaluate((k) => {
        const v = JSON.parse(localStorage.getItem(k));
        v.externalChange = true;
        localStorage.setItem(k, JSON.stringify(v));
      }, key);
      await page.locator("[data-confirm-all]").click();
      await page.waitForFunction(() =>
        document.querySelector("#toast").textContent.includes("only in memory"),
      );
      assert.equal((await data(page)).shoots[0].attempts.length, 3);
      assert.equal(await page.locator("#export-unsaved").count(), 1);

      // Skip makes a short detail actionable and does not duplicate final rows.
      await page.evaluate(async (k) => {
        const c = await import("./core.js"),
          store = c.newStore();
        store.requireBreakdown = false;
        const s = c.createShoot(store, "CS_SP", "standard", "Skip audit");
        c.addParticipants(
          s,
          "Alpha\nBravo\nCharlie\nDelta\nEcho\nFoxtrot\nGolf\nHotel",
          s.settings.weapon,
        );
        c.autoDetail(s);
        c.setRosterLock(s, true);
        localStorage.setItem(k, JSON.stringify(store));
      }, key);
      await page.reload();
      await page.locator("[data-open-shoot]").click();
      await tab(page, "stage:A");
      // Skip is per stage and lives in the firer's own menu.
      await page
        .getByRole("button", { name: "Options for Alpha", exact: true })
        .click();
      await page.locator("#person-skip").click();
      assert.ok(
        (await page.locator("[data-detail]").first().innerText()).includes(
          "Too few available",
        ),
      );
      assert.equal(
        await page.locator("[data-confirm]").first().isDisabled(),
        true,
      );
      await page
        .getByRole("button", { name: "Build replacement detail", exact: true })
        .click();
      assert.equal(await page.locator('[name="pick"]:checked').count(), 4);
      assert.equal(
        await page.getByLabel("Include Alpha", { exact: true }).isDisabled(),
        true,
      );
      await page
        .getByRole("button", { name: "One-off detail", exact: true })
        .click();
      await tab(page, "final");
      assert.equal(await page.locator("tbody tr").count(), 8);
      await tab(page, "stage:A");
      await page
        .getByRole("button", { name: "Unskip Alpha", exact: true })
        .first()
        .click();
      const after = await data(page);
      assert.deepEqual(after.shoots[0].personSkips ?? {}, {});

      // A rifle issued more rounds than the stage credits: the real score is
      // entered and kept, the arithmetic uses the credited cap.
      await page.evaluate(async (k) => {
        const c = await import("./core.js"),
          store = c.newStore();
        store.requireBreakdown = false;
        const s = c.createShoot(store, "CS_SP", "standard", "LMG audit");
        s.settings.requireBreakdown = false;
        const d = c.addDetail(s, 1),
          people = c.addParticipants(
            s,
            "Alpha\nBravo\nCharlie\nDelta",
            s.settings.weapon,
            d.id,
          );
        c.updateParticipant(s, people[0].id, {
          name: "Alpha",
          weapon: "LMG",
          detailId: d.id,
        });
        c.setRosterLock(s, true);
        localStorage.setItem(k, JSON.stringify(store));
      }, key);
      await page.reload();
      await page.locator("[data-open-shoot]").click();
      await tab(page, "stage:A");
      const lmg = page.getByLabel("Alpha hits", { exact: true });
      assert.equal(await lmg.getAttribute("inputmode"), "numeric");
      // The LMG is issued the rifles' 15 rounds in Combat Shoot, so its box
      // carries no "what can be credited" note and takes the same maximum.
      assert.equal(await page.locator(".score-input .info").count(), 0);
      await lmg.fill("12");
      for (const n of ["Bravo", "Charlie", "Delta"])
        await page.getByLabel(`${n} hits`, { exact: true }).fill("15");
      await page.locator("[data-confirm]").first().click();
      const credited = await page.evaluate((k) => {
        const s = JSON.parse(localStorage.getItem(k)).shoots[0],
          alpha = s.participants.find((p) => p.name === "Alpha"),
          a = s.attempts.find((x) => x.participantId === alpha.id);
        return {
          raw: a.rawHits,
          score: a.score,
          total: s.shared[0].aggregateHits,
        };
      }, key);
      // The gunner's own 12 is kept and the detail averages 57 over 4 firers.
      assert.deepEqual(credited, { raw: 12, score: 14, total: 57 });

      // A locked stage is readable but nothing on it can be acted on, and the
      // summary says how urgent it is by color rather than by a label.
      await page.evaluate(async (k) => {
        const c = await import("./core.js"),
          store = c.newStore();
        const s = c.createShoot(store, "ATP_M", "standard", "Lock audit");
        c.addParticipants(s, "One\nTwo", s.settings.weapon);
        c.setRosterLock(s, true);
        localStorage.setItem(k, JSON.stringify(store));
      }, key);
      await page.reload();
      await page.locator("[data-open-shoot]").click();
      await tab(page, "stage:A");
      for (const n of ["One", "Two"])
        for (let i = 1; i <= 4; i++)
          await page
            .getByLabel(`${n} Practice ${i} hits`, { exact: true })
            .fill("2");
      await page.locator("[data-confirm-all]").click();
      assert.equal(
        (await page.locator(".summary").innerText()).includes("to review"),
        false,
        "the summary labels urgency with color, not a count",
      );
      // Unlocking B locks A; A's redetail controls must all go dead.
      await tab(page, "stage:B");
      await page.locator("[data-unlock-stage]").click();
      await tab(page, "stage:A");
      for (const sel of ['[data-action="select-all"]', "#order", "#redetail"])
        assert.equal(
          await page.locator(sel).isDisabled(),
          true,
          `${sel} stays live on a locked stage`,
        );
      assert.equal(await page.locator("[data-unlock-stage]").isEnabled(), true);
      // Strong and weak only mean something where hits are pooled.
      assert.equal(
        await page
          .locator(".badge")
          .filter({ hasText: /^(Strong|Weak)$/ })
          .count(),
        0,
      );

      // Done shooting closes every stage and puts the results forward.
      await tab(page, "stage:A");
      await page.locator("[data-unlock-stage]").click();
      for (const st of ["B", "C"]) {
        await tab(page, `stage:${st}`);
        const unlock = page.locator("[data-unlock-stage]");
        if (await unlock.count()) await unlock.click();
        for (const n of ["One", "Two"])
          for (let i = 1; i <= 4; i++)
            await page
              .getByLabel(`${n} Practice ${i} hits`, { exact: true })
              .fill("2");
        await page.locator("[data-confirm-all]").click();
      }
      await tab(page, "final");
      const finish = page.getByRole("button", { name: "Done shooting" });
      assert.equal(await finish.isEnabled(), true);
      await finish.click();
      assert.equal(await page.locator(".summary").count(), 0);
      await tab(page, "stage:A");
      assert.match(
        await page.locator(".panel.confirmed").innerText(),
        /finished/,
      );
      await page.getByRole("button", { name: "Reopen shoot" }).click();
      assert.equal((await data(page)).shoots[0].finished, false);

      assert.deepEqual(errors, []);
      console.log(
        `${type.name()}: V2 breakdowns, search scope, lane order, locks, recovery, skips and replacement passed`,
      );
    } finally {
      await browser.close();
      await server.stop();
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
