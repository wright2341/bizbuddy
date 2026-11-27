import { test, expect } from "@playwright/test";
import process from "node:process";

test("public pages share the brand and keep navigation usable on phones", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const check = async () => {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await expect(page.getByRole("heading").first()).toBeVisible();
    if (process.env.BIZBUDDY_AXE_PATH) {
      await page.addScriptTag({ path: process.env.BIZBUDDY_AXE_PATH });
      const violations = await page.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
          },
        });
        return result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        }));
      });
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    }
  };
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 760 ? 844 : 1000 });
    await page.goto("/");
    await check();
    await expect(
      page
        .locator(".public-header-actions")
        .getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    const actionColor = await page
      .locator(".landing-hero-actions .hero-primary")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    await page
      .getByRole("link", { name: "Explore Messages", exact: true })
      .click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(
      page.getByRole("tab", { name: "Messages", exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await page
      .locator(".public-header-actions")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(page).toHaveURL(/\/signin$/);
    await check();
    expect(
      await page
        .getByRole("button", { name: "Sign in", exact: true })
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(actionColor);
    await page
      .getByRole("link", { name: "Create an account", exact: true })
      .click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
    await check();
  }
  expect(errors).toEqual([]);
});
