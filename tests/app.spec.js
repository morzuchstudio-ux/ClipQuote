import { mockAccount } from "./account-fixture.js";
import { mockYouTube } from "./youtube-fixture.js";
import { test, expect } from "./account-fixture.js";
import { youtubeId, seconds, validClip, seedClips } from "../src/data.js";
test("validates YouTube hosts and timestamps", () => {
  expect(youtubeId("https://youtu.be/dQw4w9WgXcQ?t=43")).toBe("dQw4w9WgXcQ");
  expect(
    youtubeId("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"),
  ).toBeNull();
  expect(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
    "dQw4w9WgXcQ",
  );
  expect(seconds("1:24")).toBe(84);
  expect(seconds("1:99")).toBeNaN();
  expect(seconds("-1")).toBeNaN();
  expect(seedClips.every(validClip)).toBe(true);
});
test.beforeEach(async ({ page }) => {
  await mockYouTube(page);
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({
      body: "<html><body>Player fixture</body></html>",
      contentType: "text/html",
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
});
test("search, category and favorite persist", async ({ page }) => {
  await expect(page.locator(".clip-card")).toHaveCount(18);
  await page
    .getByRole("textbox", { name: "Search clips" })
    .fill("poniedzialek");
  await expect(page.locator(".clip-card")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Add to favorites: No. God. Please, no!",
      exact: true,
    })
    .click();
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: /Favorites/ })
    .click();
  await expect(page.locator(".clip-card")).toHaveCount(1);
  await page
    .locator("nav")
    .getByRole("button", { name: /Explore/ })
    .click();
  await page
    .locator(".filters")
    .getByRole("button", { name: "💪 Motivation", exact: true })
    .click();
  await expect(page.locator(".clip-card")).toHaveCount(4);
});
test("add, validate range, reload and share to a fresh browser", async ({
  page,
  browser,
  accountState,
}) => {
  await page.getByRole("button", { name: "Add clip", exact: true }).click();
  await page.getByLabel("YouTube link").fill("https://youtu.be/dQw4w9WgXcQ");
  await page.getByRole("button", {name:"Next",exact:true}).click();
  await page.getByLabel("Start", { exact: true }).fill("0:43");
  await page.getByLabel("End", { exact: true }).fill("0:40");
  await page.getByLabel("Clip title").fill("Testowy cytat");

  await page.getByRole("button", { name: "Save clip" }).click();
  await expect(page.getByRole("alert")).toContainText("end");
  await page.getByLabel("End", { exact: true }).fill("0:51");
  await page.getByRole("button", { name: "Save clip" }).click();
  await expect(page.locator(".clip-card")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Play: Testowy cytat" }).click();
  await expect(page.locator("iframe")).toHaveAttribute(
    "src",
    /start=43&end=51/,
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text) => {
          window.testSharedUrl = text;
        },
      },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.testSharedUrl))
    .toBeTruthy();
  const url = await page.evaluate(() => window.testSharedUrl);
  expect(url).toMatch(/\/c\/[a-f0-9]{24}$/);
  const context = await browser.newContext();
  await mockAccount(context, accountState, false);
  const recipient = await context.newPage();
  await mockYouTube(recipient);
  await recipient.route("https://www.youtube-nocookie.com/**", (r) =>
    r.fulfill({ body: "Player" }),
  );
  await recipient.goto(url);
  await expect(recipient.getByRole("dialog")).toContainText("Testowy cytat");
  await expect(recipient.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await context.close();
  await page.getByRole("button", { name: "Delete clip", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play: Testowy cytat" })).toHaveCount(0);
});
test("mobile layout and navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page
    .locator("nav")
    .getByRole("button", { name: /My clips/ })
    .click();
  await expect(
    page.getByText("Your collection starts here."),
  ).toBeVisible();
});

test("simplified form, precise timing, optional metadata and searchable title", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add clip", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Add clip", exact: true });
  await expect(form.getByLabel("Clip title")).toHaveCount(0);
  await expect(form.getByLabel("Start", { exact: true })).toHaveCount(0);
  await expect(form.getByLabel("Quote", { exact: true })).toHaveCount(0);
  await form
    .getByLabel("YouTube link")
    .fill("https://example.com/watch?v=dQw4w9WgXcQ");
  await expect(form.getByLabel("Quote", { exact: true })).toHaveCount(0);
  await form.getByLabel("YouTube link").fill("https://youtu.be/dQw4w9WgXcQ");
  await form.getByRole("button", {name:"Next",exact:true}).click();
  await expect(form.getByLabel("Clip title")).toBeEnabled();
  await expect(
    form.getByRole("button", { name: "Transkrybuj", exact: true }),
  ).toHaveCount(0);
  await form.getByLabel("Clip title").fill("Kolejny deadline");
  await form.getByLabel("End", { exact: true }).fill("1:05");
  await form.getByLabel("Start", { exact: true }).fill("0:43");
  await expect(form.getByLabel("Start", { exact: true })).toHaveValue("0:43");
  await expect(form.getByLabel("End", { exact: true })).toHaveValue("1:05");
  await form.getByRole("button", { name: "End later by 0.1 seconds" }).click();
  await expect(form.getByLabel("End", { exact: true })).toHaveValue("1:05.1");

  await expect(form.getByLabel("Movie, series, or channel")).not.toBeVisible();
  await form.getByText("Additional options", { exact: true }).click();
  await expect(form.getByLabel("Movie, series, or channel")).toBeVisible();
  await form.getByLabel("Movie, series, or channel").fill("Biuro");
  await form.getByRole("button", { name: "Save clip" }).click();
  await expect(form).not.toBeVisible();
  await page.reload();
  await page.getByRole("textbox", { name: "Search clips" }).fill("deadline");
  await expect(
    page.getByRole("button", { name: "Kolejny deadline", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add clip", exact: true }).click();
  await form.getByLabel("YouTube link").fill("https://youtu.be/dQw4w9WgXcQ");
  await form.getByRole("button", {name:"Next",exact:true}).click();
  await form.getByLabel("Start", { exact: true }).fill("10");
  await form.getByLabel("End", { exact: true }).fill("20");
  await form.getByRole("button", {name:"Change link",exact:true}).click();
  await form.getByLabel("YouTube link").fill("");
  await expect(form.getByLabel("Start", { exact: true })).toHaveCount(0);
  await expect(form.getByRole("button", {name:"Next",exact:true})).toBeDisabled();
});
