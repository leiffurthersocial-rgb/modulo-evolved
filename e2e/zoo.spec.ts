import { expect, test, type Page } from "@playwright/test";

const count = (page: Page, species: string) =>
  page.evaluate(
    (s) =>
      (
        window as unknown as {
          __modulo: { useWorld: { getState: () => { speciesCounts: Record<string, number> } } };
        }
      ).__modulo.useWorld.getState().speciesCounts[s] ?? 0,
    species,
  );

test.beforeEach(async ({ page }) => {
  await page.goto("/?nowelcome&scenario=zoo");
  await expect(page.getByText(/\d+ animals/)).toBeVisible({ timeout: 30_000 });
});

test("breeding zoo: place animals by tapping, rations, fast-forward a generation", async ({ page }) => {
  // The zoo opens on the Animals panel.
  await expect(page.getByRole("tab", { name: "Animals" })).toHaveAttribute("data-state", "active");
  await expect(page.getByText("food for 10")).toBeVisible();

  await expect.poll(() => count(page, "human")).toBeGreaterThan(0);
  const before = await count(page, "human");
  await page.getByRole("button", { name: /Place 2 × Human/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Tap the ground" })).toBeVisible();
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.6);
  await expect.poll(() => count(page, "human")).toBe(before + 2);
  await page.getByRole("button", { name: "Done placing" }).click();

  await page.getByRole("button", { name: "Fast-forward 1 generation" }).click();
  await expect(page.getByText(/Fast-forward complete/)).toBeVisible({ timeout: 90_000 });
});

test("low battery mode toggles from the top bar", async ({ page }) => {
  const toggle = page.getByRole("button", { name: "Low battery mode" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("clear the island from the command palette", async ({ page }) => {
  await page.getByRole("button", { name: "Open command palette" }).click();
  await page.getByRole("option", { name: /Clear island/ }).click();
  await expect(page.getByText(/^0 animals$/)).toBeVisible();
});
