import { test, expect } from "@playwright/test";

test("home loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
});

test("dashboard loads", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("actions.json is valid JSON with rules", async ({ request }) => {
  const res = await request.get("/actions.json");
  expect(res.ok()).toBeTruthy();
  const json = (await res.json()) as { rules?: unknown };
  expect(Array.isArray(json.rules)).toBeTruthy();
});

test("pay action metadata returns shape", async ({ request }) => {
  const res = await request.get("/api/actions/pay");
  expect(res.ok()).toBeTruthy();
  const json = (await res.json()) as { title?: unknown; links?: unknown };
  expect(typeof json.title).toBe("string");
  expect(json.links).toBeTruthy();
});
