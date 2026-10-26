import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
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
