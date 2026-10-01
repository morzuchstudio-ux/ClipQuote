import { test, expect } from "./account-fixture.js";

test("signed-out visitors must sign in before adding or saving favorites", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  await page.evaluate(() => {
    sessionStorage.setItem("test-signed-out", "yes");
    localStorage.removeItem("sb-jiacjllvlnjeuzzlzhoc-auth-token");
  });
  await page.reload();
  await page.getByRole("button", { name: "Add clip", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByLabel("YouTube link")).toHaveCount(0);
});

test("failed online save keeps the draft and does not claim success", async ({ page, accountState }) => {
  accountState.failSave = true;
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add clip", exact: true }).click();
  await page.getByLabel("YouTube link").fill("https://youtu.be/1YZEE9-2BWE");
  await page.getByLabel("Clip title").fill("Unsaved draft");
  await page.getByLabel("Start", { exact: true }).fill("7");
  await page.getByLabel("End", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Save clip", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Could not save online");
  await expect(page.getByLabel("Clip title")).toHaveValue("Unsaved draft");
  expect(accountState.clips).toHaveLength(0);
  accountState.failSave = false;
  await page.getByRole("button", { name: "Save clip", exact: true }).click();
  await expect(page.getByText("Clip saved online.", { exact: true })).toBeVisible();
});

test("admin can approve and suspend an email", async ({ page, accountState }) => {
  accountState.role = "admin";
  await page.goto("/");
  await page.getByRole("button", { name: "Admin", exact: true }).click();
  await page.getByLabel("Email address").fill("friend@example.com");
  await page.getByRole("button", { name: "Approve access" }).click();
  await expect(page.locator(".member-list")).toContainText("friend@example.com");
  await page.getByRole("button", { name: "Suspend", exact: true }).click();
  await expect(page.locator(".member-list")).toContainText("Suspended");
});

test("unapproved account cannot open the add form", async ({ page, accountState }) => {
  accountState.role = null;
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("not approved");
  await page.getByRole("button", { name: "Add clip", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Account", exact: true })).toBeVisible();
  await expect(page.getByLabel("YouTube link")).toHaveCount(0);
});

test("browser library transferred from the old site is available to import", async ({ page }) => {
  const clip = { id: "legacy-transfer", videoId: "1YZEE9-2BWE", title: "Transferred scene", quote: "", start: 7, end: 10, source: "", speaker: "", category: "😂 Humor", tags: [] };
  const hash = new URLSearchParams({ "browser-import": JSON.stringify({ clips: [clip], favorites: [clip.id] }) });
  await page.goto("/#" + hash);
  await expect(page.getByRole("button", { name: "Import to my account" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Import to my account" }).click();
  await expect(page.getByRole("button", { name: "Play: Transferred scene" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cq-clips"))[0].id)).toBe("legacy-transfer");
});
