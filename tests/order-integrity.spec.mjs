import { test, expect } from "@playwright/test";

test("catalogue edits cannot silently change a pending order or a confirmed order", async ({
  page,
  context,
  baseURL,
}) => {
  const registration = await page.request.post("/api/auth/register", {
    data: {
      name: "Order QA",
      email: `order-qa-${Date.now()}@example.com`,
      password: "QA-private-password-123",
      business: "Order QA shop",
    },
  });
  expect(registration.status()).toBe(201);
  const { token } = await registration.json();
  const headers = { Authorization: `Bearer ${token}` };
  const product = await (
    await page.request.post("/api/operations/products", {
      headers,
      data: {
        name: "Original blue canvas",
        description: "Blue cotton fabric",
        price: 800000,
        stock: 10,
      },
    })
  ).json();
  const bot = await (
    await page.request.post("/api/operations/website/setup", { headers })
  ).json();
  const customer = await context.newPage();
  await customer.goto(`/chat/${bot.public_id}`);
  await customer
    .getByLabel("Your message", { exact: true })
    .fill("I want to order 2 Original blue canvas");
  await customer
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(customer.getByText(/recorded your order request/)).toBeVisible();
  await page.goto("/");
  await page.evaluate(
    (value) => sessionStorage.setItem("bizbuddyToken", value),
    token,
  );
  await page.goto("/dashboard/inbox");
  await expect(
    page.getByText("Order request awaiting confirmation", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".bb-request-original")).toContainText(
    "Original blue canvas",
  );
  await expect(page.locator(".bb-request-original")).toContainText("8,000.00");
  await page
    .getByLabel("Confirm product", { exact: true })
    .selectOption(product.id);
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  const originalOperations = await (
    await page.request.get("/api/operations", { headers })
  ).json();
  await page.route("**/api/operations", (route) =>
    route.fulfill({ json: originalOperations }),
  );
  const editor = await context.newPage();
  await editor.goto("/");
  await editor.evaluate(
    (value) => sessionStorage.setItem("bizbuddyToken", value),
    token,
  );
  await editor.goto("/dashboard/inventory");
  await editor.getByRole("button", { name: "Edit", exact: true }).click();
  await editor
    .getByLabel("Product name", { exact: true })
    .fill("Replacement red canvas");
  await editor.getByLabel("Price (NGN)", { exact: true }).fill("9500");
  await editor
    .getByLabel("Description", { exact: true })
    .fill("Red synthetic fabric");
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(
    editor.getByText("Replacement red canvas", { exact: true }),
  ).toBeVisible();
  const stale = page.waitForResponse(
    (response) =>
      response.url().includes("/order-requests/") &&
      response.url().endsWith("/confirm"),
  );
  await page
    .getByRole("button", { name: "Confirm order & adjust stock", exact: true })
    .click();
  expect((await stale).status()).toBe(409);
  await expect(
    page
      .getByText(/Product details changed since this form was loaded/)
      .first(),
  ).toBeVisible();
  expect(
    (await (await editor.request.get("/api/operations", { headers })).json())
      .products[0].stock,
  ).toBe(10);
  await page.unroute("**/api/operations");
  await page.reload();
  await expect(
    page.getByText("Order request awaiting confirmation", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Confirm product", { exact: true })
    .selectOption(product.id);
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await expect(
    page.getByText("Catalogue changed since this request.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".bb-request-original")).toContainText(
    "Original blue canvas",
  );
  await expect(page.locator(".bb-request-total")).toContainText("19,000.00");
  await page.setViewportSize({ width: 390, height: 844 });
  const back = page.getByRole("button", { name: /Back to conversations/ });
  if (await back.isVisible()) await back.click();
  const conversation = page.locator(".bb-conversation").first();
  if (await conversation.isVisible()) await conversation.click();
  const review = page.getByRole("checkbox", {
    name: "I have reviewed the current item and price with the customer.",
  });
  await review.scrollIntoViewIfNeeded();
  await expect(review).not.toBeChecked();
  await page.screenshot({
    path: "/tmp/bizbuddy-order-change-review-mobile.png",
    fullPage: true,
  });
  await review.check();
  await page
    .getByRole("button", { name: "Confirm order & adjust stock", exact: true })
    .click();
  await expect(
    page.getByText("Order request awaiting confirmation", { exact: true }),
  ).toHaveCount(0);
  await expect(
    customer.getByText(
      /Your order is confirmed: 2 × Replacement red canvas, total NGN 19,000.00/,
    ),
  ).toBeVisible({ timeout: 15000 });
  await editor.reload();
  await expect(
    editor.getByRole("button", { name: "Edit", exact: true }),
  ).toBeVisible();
  const ordersBefore = await (
    await page.request.get("/api/orders", { headers })
  ).json();
  await editor.getByRole("button", { name: "Edit", exact: true }).click();
  await editor
    .getByLabel("Product name", { exact: true })
    .fill("Later catalogue item");
  await editor.getByLabel("Price (NGN)", { exact: true }).fill("12000");
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(
    editor.getByText("Later catalogue item", { exact: true }),
  ).toBeVisible();
  expect(
    await (await page.request.get("/api/orders", { headers })).json(),
  ).toEqual(ordersBefore);
  expect(
    (await (await page.request.get("/api/operations", { headers })).json())
      .products[0].stock,
  ).toBe(8);
  await customer.close();
  await editor.close();
});
