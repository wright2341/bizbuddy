import { test, expect } from "@playwright/test";
import process from "node:process";

// Uses an isolated local preview. Never configure this suite against production.
test("professional workspace keeps the complete business workflow working", async ({
  page,
  context,
  baseURL,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const email = `presentation-${Date.now()}@example.com`;
  const password = "Presentation-test-password-123";
  const nav = async (name) => {
    await page
      .locator(".bb-sidebar")
      .getByRole("link", { name, exact: true })
      .click();
  };
  const shot = async (name) => {
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator(".bb-skeleton")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `/tmp/bizbuddy-professional-${name}.png`,
      fullPage: true,
    });
  };
  await test.step("authentication and password controls", async () => {
    await page.goto("/signin");
    await expect(
      page.getByRole("heading", { name: "Welcome back.", exact: true }),
    ).toBeVisible();
    await shot("signin");
    await page
      .getByLabel("Email address", { exact: true })
      .fill("no-account-" + Date.now() + "@example.com");
    await page.getByLabel("Password", { exact: true }).fill("invalid-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Email or password");
    await page
      .getByRole("link", { name: "Create an account", exact: true })
      .click();
    await page.getByLabel("Full name", { exact: true }).fill("Ada Okafor");
    await page
      .getByLabel("Business name", { exact: true })
      .fill("Ada’s Fabric Studio");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page
      .getByLabel("Business category", { exact: true })
      .selectOption({ label: "Arts & crafts" });
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
      "type",
      "text",
    );
    await page.getByRole("button", { name: "Hide password" }).click();
    await shot("register");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/setup$/);
    const token = await page.evaluate(() => sessionStorage.getItem("bizbuddyToken"));
    const profile = await page.request.get("/api/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect((await profile.json()).category).toBe("Arts & crafts");
    await page
      .getByRole("button", { name: "Continue to business knowledge" })
      .click();
    await page
      .getByLabel("What does your business do?")
      .fill("We sell fabrics and provide tailoring services.");
    await page
      .getByLabel("Opening hours", { exact: true })
      .fill("Monday to Friday, 9 AM to 5 PM.");
    await page.getByRole("button", { name: "Save & test an answer" }).click();
    await page.getByRole("button", { name: "Test my assistant" }).click();
    await expect(
      page.getByText("Saved-fact reply", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue to go live" }).click();
    await page
      .getByRole("button", { name: "Activate customer replies" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your customer chat is live." }),
    ).toBeVisible();
    await nav("Overview");
    await expect(
      page.getByRole("heading", {
        name: "Your customer automation, at a glance.",
      }),
    ).toBeVisible();
    await shot("overview-empty");
  });
  await test.step("inventory creation, editing, filtering, export and modal keyboard", async () => {
    await nav("Inventory");
    await page
      .getByRole("button", { name: "Add product", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Add product", exact: true })
      .click();
    await page.getByLabel("Product name", { exact: true }).fill("Blue ankara");
    await page.getByLabel("Price (NGN)", { exact: true }).fill("8000");
    await page.getByLabel("Units in stock", { exact: true }).fill("3");
    await page
      .getByLabel("Description", { exact: true })
      .fill("Cotton fabric, sold by the yard.");
    await page
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("cell", { name: "Low stock", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
      .getByLabel("Product name", { exact: true })
      .fill("Blue ankara cotton");
    await page
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await expect(
      page.getByText("Blue ankara cotton", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Search products", { exact: true })
      .fill("does-not-exist");
    await expect(
      page.getByText("No products match this view.", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Search products", { exact: true }).fill("");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("bizbuddy-inventory.csv");
    await shot("inventory");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Inventory", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Blue ankara cotton", { exact: true }),
    ).toBeVisible();
  });
  let chat;
  let publicId;
  await test.step("website connection, customer chat and operator reply", async () => {
    await nav("Connections");
    await page
      .getByRole("button", { name: "Manage connection", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Enable website chat", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your customer chat is ready" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "View customer chat", exact: true }),
    ).toBeVisible();
    const chatUrl = await page
      .getByLabel("Customer chat link", { exact: true })
      .inputValue();
    publicId = chatUrl.split("/").at(-1);
    await shot("connections");
    chat = await context.newPage();
    chat.on("pageerror", (e) => errors.push(e.message));
    await chat.goto(chatUrl);
    await chat.setViewportSize({ width: 390, height: 844 });
    await expect(
      chat.getByRole("button", {
        name: "What are your opening hours?",
        exact: true,
      }),
    ).toBeVisible();
    await chat
      .getByRole("button", {
        name: "What are your opening hours?",
        exact: true,
      })
      .click();
    await expect(
      chat.getByText("Monday to Friday, 9 AM to 5 PM.", { exact: true }),
    ).toBeVisible();
    const composer = await chat
      .getByLabel("Your message", { exact: true })
      .boundingBox();
    expect(composer.y + composer.height).toBeLessThanOrEqual(844);
    expect(
      await chat.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await chat.screenshot({ path: "/tmp/bizbuddy-refined-chat-mobile.png" });
    await chat.setViewportSize({ width: 1440, height: 1000 });

    await chat
      .getByLabel("Your message", { exact: true })
      .fill("What is the price of Blue ankara cotton?");
    await chat
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(chat.getByText(/NGN 8,000.00/)).toBeVisible();
    await chat
      .getByLabel("Your message", { exact: true })
      .fill("I want to order Blue ankara cotton");
    await chat
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(chat.getByText(/recorded your order request/)).toBeVisible();
    await nav("Unified inbox");
    await expect(
      page.getByText("Order request awaiting confirmation", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Reply as the owner", { exact: true })
      .fill("Thank you! I will confirm the product and quantity.");
    await page.getByRole("button", { name: "Send reply", exact: true }).click();
    await expect(
      chat.getByText("Thank you! I will confirm the product and quantity.", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });
    await shot("inbox");
    await chat.screenshot({
      path: "/tmp/bizbuddy-professional-chat.png",
      fullPage: true,
    });
    await chat.reload();
    await expect(
      chat.getByText("I want to order Blue ankara cotton", { exact: true }),
    ).toBeVisible();
  });
  await test.step("order confirmation adjusts stock exactly once", async () => {
    await page
      .getByLabel("Confirm product", { exact: true })
      .selectOption({ label: "Blue ankara cotton · ₦8,000.00 · 3 in stock" });
    await page.getByLabel("Quantity", { exact: true }).fill("2");
    await page
      .getByRole("button", {
        name: "Confirm order & adjust stock",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Order request awaiting confirmation", { exact: true }),
    ).toHaveCount(0);
    await expect(chat.getByText(/Your order is confirmed: 2/)).toBeVisible({
      timeout: 15000,
    });
    await nav("Orders");
    await expect(
      page.getByText("Blue ankara cotton", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "View order", exact: false })
      .click();
    await expect(page.getByRole("dialog")).toContainText("2");
    await expect(page.getByRole("dialog")).toContainText("16,000.00");
    await page.keyboard.press("Escape");
    await shot("orders");
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await nav("Inventory");
    await expect(
      page.getByRole("cell", { name: "1 Low-stock alert at 5", exact: true }),
    ).toBeVisible();
  });
  await test.step("invoice drafts, reminder preparation and payment confirmation", async () => {
    await nav("Invoices");
    await page
      .getByRole("button", { name: "Create invoice", exact: true })
      .click();
    await page.getByLabel("Customer", { exact: true }).fill("Chioma Nwosu");
    await page
      .getByLabel("Email (optional)", { exact: true })
      .fill("chioma@example.com");
    await page.getByLabel("Amount (NGN)", { exact: true }).fill("16000");
    await page.getByLabel("Due date", { exact: true }).fill("2020-01-01");
    await page.getByRole("checkbox").check();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Create invoice", exact: true })
      .click();
    await expect(
      page.getByRole("cell", { name: "Overdue", exact: true }),
    ).toBeVisible();
    await shot("invoices");
    await page.getByRole("tab", { name: /Drafts & reminders/ }).click();
    await page
      .getByRole("button", { name: "Save reviewed email draft", exact: true })
      .click();
    await expect(page.getByText("email ready", { exact: true })).toBeVisible();
    await expect(
      page.getByText("awaiting approval", { exact: true }),
    ).toBeVisible();
    await shot("drafts");
    await page.getByRole("tab", { name: /^Invoices/ }).click();
    await page.getByRole("button", { name: "Mark paid", exact: true }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      page.getByRole("cell", { name: "Overdue", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Mark paid", exact: true }).click();
    await page
      .getByRole("button", { name: "Record payment", exact: true })
      .click();
    await expect(
      page.getByRole("cell", { name: "Paid", exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: /Drafts & reminders/ }).click();
    await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
  });
  await test.step("assistant knowledge, policies, FAQs and pause controls", async () => {
    await nav("Assistant");
    await page
      .getByLabel("Welcome message", { exact: true })
      .fill("Hello! Welcome to Ada’s Fabric Studio.");
    await page
      .getByRole("button", { name: "Save business knowledge", exact: true })
      .click();
    await page
      .getByRole("tab", { name: "Policies & FAQs", exact: true })
      .click();
    await page
      .getByLabel("Opening hours", { exact: true })
      .fill("Monday to Friday, 9am–5pm.");
    await page
      .getByRole("button", { name: "Save policies", exact: true })
      .click();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page
      .getByLabel("Customer question", { exact: true })
      .fill("Do you sell by the yard?");
    await page
      .getByLabel("Verified answer", { exact: true })
      .fill("Yes, fabric is sold by the yard.");
    await page.getByRole("button", { name: "Save FAQ", exact: true }).click();
    await expect(
      page.getByText("Do you sell by the yard?", { exact: true }),
    ).toBeVisible();
    await shot("assistant");
    await page
      .getByRole("tab", { name: "Test assistant", exact: true })
      .click();
    await page
      .getByLabel("Customer message", { exact: true })
      .fill("Do you sell by the yard?");
    await page.getByRole("button", { name: "Test reply", exact: true }).click();
    await expect(
      page.getByText("Yes, fabric is sold by the yard.", { exact: true }),
    ).toBeVisible();
    const toggle = page.getByRole("switch", {
      name: "Automatic replies",
      exact: true,
    });
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect(toggle).toBeChecked();
  });
  await test.step("customer identity linking, settings and workspace plan", async () => {
    const response = await page.request.post("/api/public/chat", {
      headers: { Origin: baseURL },
      data: { public_id: publicId, message: "My name is Chioma Nwosu." },
    });
    expect(response.ok()).toBeTruthy();
    await nav("Customers");
    await expect(page.getByText("Chioma Nwosu", { exact: true })).toBeVisible();
    const boxes = page.getByRole("checkbox");
    await expect(boxes).toHaveCount(2);
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await page
      .getByRole("button", { name: "Link 2 customer records", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm & link records", exact: true })
      .click();
    await expect(
      page.getByText("2 linked records", { exact: true }),
    ).toBeVisible();
    await shot("customers");
    await nav("Settings");
    await page.getByLabel("Your role", { exact: true }).fill("Business owner");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Daily summary", exact: true })
      .click();
    await page
      .getByLabel("Send at (UTC hour)", { exact: true })
      .selectOption("18");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await shot("settings");
    await nav("Workspace plan");
    await expect(
      page.getByRole("heading", { name: "Free", exact: true }),
    ).toBeVisible();
    await shot("plan");
    await nav("WhatsApp & SMS");
    await expect(
      page.getByRole("button", { name: "Send through Twilio", exact: true }),
    ).toBeDisabled();
    await shot("twilio");
  });
  await test.step("keyboard navigation, browser history and responsive pages", async () => {
    await page.keyboard.press("Control+k");
    await expect(
      page.getByRole("dialog", { name: "Find a page" }),
    ).toBeVisible();
    await page.getByLabel("Search pages", { exact: true }).fill("inventory");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Inventory", exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/inventory$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard\/twilio$/);
    await nav("Overview");
    await shot("overview");
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      if (viewport.width < 760) {
        await page
          .getByRole("button", { name: "More workspace pages" })
          .click();
        await expect(
          page.getByRole("dialog", { name: "Workspace menu" }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(
          page.getByRole("dialog", { name: "Workspace menu" }),
        ).toHaveCount(0);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("mobile-overview");
    await page.getByRole("button", { name: "More workspace pages" }).click();
    await page
      .locator(".bb-sidebar")
      .getByRole("link", { name: "Inventory", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Inventory", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await shot("mobile-inventory");
  });
  await test.step("AI quota status stays honest and readable", async () => {
    await page.route("**/api/assistant/connection", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          provider: "openai",
          model: "gpt-6-luna",
          source: "byok",
          managed_available: false,
          monthly_limit: 500,
          used: 22,
          month: "2026-11",
          key_connected: true,
          state: "limited",
          fallback: true,
          retry_after: 299,
        }),
      }),
    );
    await page.goto("/dashboard/assistant");
    await expect(
      page.getByRole("heading", { name: "Your reply engine", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Using saved facts", { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await shot("assistant-quota-mobile");
    await page.unroute("**/api/assistant/connection");
    await page.goto("/dashboard/inventory");
    await expect(
      page.getByText("Blue ankara cotton", { exact: true }),
    ).toBeVisible();
  });
  await test.step("explicit loading failure and recovery", async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.route("**/api/operations", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "The workspace is temporarily unavailable.",
        }),
      }),
    );
    await page.reload();
    await expect(
      page.getByText("We couldn’t load this page.", { exact: true }),
    ).toBeVisible();
    await page.unroute("**/api/operations");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(
      page.getByText("Blue ankara cotton", { exact: true }),
    ).toBeVisible();
  });
  if (process.env.BIZBUDDY_AXE_PATH) {
    await test.step("automated WCAG checks", async () => {
      for (const route of [
        "/dashboard",
        "/dashboard/inventory",
        "/dashboard/invoices",
        "/dashboard/connections",
        "/dashboard/assistant",
        "/dashboard/settings",
        `/chat/${publicId}`,
      ]) {
        await page.goto(route);
        await expect(page.locator("h1")).toBeVisible();
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
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          }));
        });
        expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
      }
    });
  }
  expect(errors).toEqual([]);
  await chat.close();
});
