import { test, expect } from "@playwright/test";

test("the original messaging demo is useful on a phone and never writes to a real API", async ({
  page,
}) => {
  const writes = [];
  const errors = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/") && request.method() !== "GET")
      writes.push(request.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signin");
  await page
    .getByRole("link", { name: "Try the messages demo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/demo$/);
  const log = page.getByRole("log", {
    name: "Sample customer and assistant messages",
  });
  await expect(
    page.getByRole("heading", { name: "Adaeze Okafor", exact: true }),
  ).toBeVisible();
  await expect(log).toContainText(
    "Hi, is the blue ankara fabric still available?",
  );
  await expect(log).toContainText("₦8,000 per yard");
  await expect(
    page.getByText("Nothing is sent. All records are examples.", {
      exact: true,
    }),
  ).toBeVisible();
  const composer = page.getByLabel("Try a customer message", { exact: true });
  const bounds = await composer.boundingBox();
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "/tmp/bizbuddy-professional-demo-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ask the price", exact: true })
    .click();
  await expect(
    log.getByText(/In this sample catalogue, blue ankara/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Place an order", exact: true })
    .click();
  await expect(log).toContainText("I’ve recorded your request for 6 yards");
  await page.getByRole("button", { name: /^Needs owner confirmation/ }).click();
  await page
    .getByRole("button", { name: "Confirm example order", exact: true })
    .click();
  await expect(log).toContainText("Your example order is confirmed");
  await page
    .getByRole("button", { name: "Back to example conversations", exact: true })
    .click();
  for (const name of [
    "Adaeze Okafor",
    "Chidi Nwosu",
    "Amara Bello",
    "Tolu James",
  ])
    await expect(
      page.getByRole("button", { name: new RegExp(name) }),
    ).toBeVisible();
  await page.screenshot({
    path: "/tmp/bizbuddy-professional-demo-mobile-list.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Tolu James/ }).click();
  await expect(log).toContainText(
    "We are open Monday to Saturday, 9 AM to 6 PM.",
  );
  await page.getByRole("tab", { name: "Invoices", exact: true }).click();
  await page
    .getByRole("button", { name: "Create demo invoice", exact: true })
    .click();
  await page
    .getByLabel("Demo invoice customer", { exact: true })
    .selectOption("Adaeze Okafor");
  await page
    .getByLabel("Item or service", { exact: true })
    .fill("Presentation example · 6 yards");
  await page.getByLabel("Amount (NGN)", { exact: true }).fill("48000");
  await page
    .getByRole("button", { name: "Create example invoice", exact: true })
    .click();
  const invoice = page
    .getByRole("row")
    .filter({ hasText: "Presentation example" });
  await expect(invoice).toContainText("48,000.00");
  await invoice
    .getByRole("button", { name: "Prepare reminder", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve demo reminder", exact: true })
    .click();
  await expect(log).toContainText("a friendly reminder about invoice");
  await page.getByRole("tab", { name: "Daily summary", exact: true }).click();
  await expect(
    page.getByText("1 confirmed example orders", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Blue ankara: 24 sample yards", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Messages", exact: true }).click();
  await page.getByLabel("Conversation options", { exact: true }).click();
  await page
    .getByRole("button", { name: "Pause demo assistant", exact: true })
    .click();
  await composer.fill("Hello there");
  await page
    .getByRole("button", { name: "Send demo message", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Demo assistant paused.",
  );
  await page.getByLabel("Conversation options", { exact: true }).click();
  await page
    .getByRole("button", { name: "Resume demo assistant", exact: true })
    .click();
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "/tmp/bizbuddy-professional-demo-desktop.png",
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await log
      .locator(".bb-demo-bubble")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
