import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?nowelcome&agents=300");
  await expect(page.getByRole("toolbar", { name: "Time controls" })).toBeVisible();
});

test("renders the 3D viewport and a live simulation", async ({ page }) => {
  await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/\d+ animals/)).toBeVisible({ timeout: 20_000 });
});

test("touch: tap controls toggle play/pause and switch workspaces", async ({ page }) => {
  await page.getByRole("button", { name: "Pause" }).tap();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

  await page.getByRole("button", { name: "Splice Lab" }).tap();
  await expect(page.getByRole("heading", { name: "Splice Lab" })).toBeVisible();
});

test("keyboard: shortcuts drive the app", async ({ page }) => {
  await page.locator("canvas").waitFor();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

  await page.keyboard.press("3");
  await expect(page.getByRole("heading", { name: "Cross Lab" })).toBeVisible();

  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByPlaceholder("Type a command or search…");
  await expect(input).toBeFocused();
  await input.fill("charts");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "Charts" })).toHaveAttribute("data-state", "active");
});

test("science tooltips open on tap", async ({ page }) => {
  await page.getByRole("tab", { name: "Environment" }).tap();
  await page.getByRole("button", { name: "About Temperature" }).tap();
  await expect(page.getByText("Bergmann's rule", { exact: false })).toBeVisible();
});

test("interactive targets meet the 44px touch minimum", async ({ page }) => {
  const small = await page.$$eval("button, [role=tab], [role=slider]", (els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const after = getComputedStyle(el, "::after");
        const expanded = after.content !== "none" && after.position === "absolute";
        return { label: el.getAttribute("aria-label") ?? el.textContent, w: r.width, h: r.height, expanded };
      })
      .filter((t) => !t.expanded && (t.w < 43.5 || t.h < 43.5)),
  );
  expect(small).toEqual([]);
});

test("onboarding: welcome, tour and new-world dialog", async ({ page }) => {
  await page.goto("/?agents=300");
  await expect(page.getByText("Evolution you can touch.")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Take the 1-minute tour/ }).click();
  await expect(page.getByText("Step 1 of 6")).toBeVisible();
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "World menu" }).click();
  await page.getByRole("menuitem", { name: /New world/ }).click();
  await page.getByRole("option", { name: /Archipelago Speciation/ }).click();
  await page.getByRole("button", { name: /Start Archipelago Speciation/ }).click();
  await expect(page.getByText("Archipelago Speciation").first()).toBeVisible();
});

test("save and load a world on device", async ({ page }) => {
  await page.getByRole("button", { name: "World menu" }).click();
  await page.getByRole("menuitem", { name: /Save & load/ }).click();
  await page.getByLabel("Save name").fill("E2E world");
  await page.getByRole("button", { name: /Save world/ }).click();
  await expect(page.getByText("E2E world")).toBeVisible({ timeout: 20_000 });
  await page.getByText("E2E world").click();
  await expect(page.getByText(/Loaded world/)).toBeVisible({ timeout: 20_000 });
});
