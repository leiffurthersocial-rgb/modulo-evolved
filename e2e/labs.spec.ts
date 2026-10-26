import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?nowelcome&agents=300");
  await expect(page.getByText(/\d+ animals/)).toBeVisible({ timeout: 30_000 });
});

test("genome editor: open a wild genome, edit an allele, undo", async ({ page }) => {
  await page.getByRole("button", { name: "Genome Editor" }).click();
  await page.getByRole("button", { name: "Choose genome" }).first().click();
  await page.getByRole("tab", { name: /Wild type/ }).click();
  await page.getByRole("button", { name: "Plains zebra" }).click();
  await expect(page.getByText("Wild plains zebra", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "More copies" }).first().click();
  await expect(page.getByText("1 loci edited")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("unedited")).toBeVisible();
});

test("cross lab: Punnett square and a bred litter", async ({ page }) => {
  await page.getByRole("button", { name: "Cross Lab", exact: true }).click();
  await page.getByRole("button", { name: /Choose mother/ }).click();
  await page.getByRole("tab", { name: /Wild type/ }).click();
  await page.getByRole("button", { name: "Rabbit" }).click();
  await page.getByRole("button", { name: /Choose father/ }).click();
  await page.getByRole("tab", { name: /Wild type/ }).click();
  await page.getByRole("button", { name: "Rabbit" }).click();
  await expect(page.getByText(/hybrid fertility 100%/)).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: /Breed litter/ }).click();
  await expect(page.getByText(/viability \d+%/).first()).toBeVisible();
});

test("splice lab: a preset chimera shows derived trade-offs", async ({ page }) => {
  await page.getByRole("button", { name: "Splice Lab" }).click();
  await page.getByRole("button", { name: "Human with hawk wings" }).first().click();
  await expect(page.getByText(/Too heavy to fly/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("grounded", { exact: true })).toBeVisible();
});

test("charts and phylogeny render live data", async ({ page }) => {
  await page.getByRole("tab", { name: "Charts" }).click();
  await expect(page.getByRole("img", { name: "Population per species" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Phylogeny" }).click();
  await expect(page.getByRole("img", { name: "Lineage tree over simulated time" })).toBeVisible();
  await page.getByRole("tab", { name: "Deep time" }).click();
  await expect(page.getByRole("img", { name: /Deep-time phylogeny/ })).toBeVisible();
});
