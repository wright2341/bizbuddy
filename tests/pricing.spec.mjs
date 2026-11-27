import { test, expect } from "@playwright/test";
import process from "node:process";

test("four pricing tiers show accurate monthly and annual bills on every screen", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/pricing");
  await expect(page).toHaveTitle(/BizBuddy/);
  await expect(page.getByRole("heading", { name: "Free", exact: true })).toBeVisible();
  await expect(page.locator(".bb-price-option")).toHaveCount(4);
  const tiers = [["Free", "₦0", "₦0"], ["Starter", "₦5,000", "₦50,000"], ["Growth", "₦15,000", "₦150,000"], ["Business", "₦35,000", "₦350,000"]];
  for (const [name, monthly] of tiers) await expect(page.getByRole("region", { name: `${name} plan`, exact: true }).locator(".bb-price-amount")).toContainText(monthly);
  await page.getByRole("button", { name: /Annual/ }).click();
  await expect(page.getByRole("button", { name: /Annual/ })).toHaveAttribute("aria-pressed", "true");
  for (const [name, , annual] of tiers) await expect(page.getByRole("region", { name: `${name} plan`, exact: true }).locator(".bb-price-amount")).toContainText(annual);
  await expect(page.getByRole("region", { name: "Growth plan", exact: true })).toContainText("Save ₦30,000 each year.");
  await expect(page.getByRole("note")).toContainText("checkout is not open yet");
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await expect(page.getByRole("button", { name: "Start with Free", exact: true })).toBeVisible();
    if ([1440, 390].includes(width)) await page.screenshot({ path: `/tmp/bizbuddy-pricing-${width}.png`, fullPage: true });
  }
  if (process.env.BIZBUDDY_AXE_PATH) {
    await page.addScriptTag({ path: process.env.BIZBUDDY_AXE_PATH });
    expect(await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })))).toEqual([]);
  }
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(page.getByRole("region", { name: "Starter plan", exact: true }).locator(".bb-price-amount")).toContainText("₦5,000");
  await page.getByRole("button", { name: "Start with Free", exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  expect(errors).toEqual([]);
});
