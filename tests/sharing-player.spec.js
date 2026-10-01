import { test, expect } from "./account-fixture.js";
import { seedClips } from "../src/data.js";
import { mockYouTube } from "./youtube-fixture.js";
const sample = {
  ...seedClips[0],
  id: "local-range-test",
  videoId: "1YZEE9-2BWE",
  start: 7,
  end: 10,
  title: "Trzy sekundy",
};
async function openClip(page) {
  await mockYouTube(page);
  await page.goto("/#" + new URLSearchParams({ clip: JSON.stringify(sample) }));
  await expect(
    page.getByRole("button", { name: "Play clip", exact: true }),
  ).toBeEnabled();
}
test("legacy write endpoint is closed and missing links handled", async ({ request, page }) => {
  expect((await request.post("/api/clips", { data: sample })).status()).toBe(401);
  await page.goto("/c/aaaaaaaaaaaaaaaa");
  await expect(page.getByRole("heading", { name: "Link unavailable" })).toBeVisible();
});
test("clip-relative seeking, end stop, replay, loop, cleanup", async ({
  page,
}) => {
  await openClip(page);
  await expect(page.getByLabel("Clip time")).toHaveText("0:00 / 0:03");
  const slider = page.getByRole("slider", { name: "Clip position" });
  await expect(slider).toHaveAttribute("max", "3");
  await slider.fill("1.5");
  expect(await page.evaluate(() => window.testPlayer.current)).toBe(8.5);
  await page
    .getByRole("button", { name: "Play clip", exact: true })
    .click();
  await page.evaluate(() => (window.testPlayer.current = 10.01));
  await expect(page.getByLabel("Clip time")).toHaveText("0:03 / 0:03");
  expect(await page.evaluate(() => window.testPlayer.state)).toBe(2);
  await page.evaluate(() => window.testPlayer.change(1));
  expect(
    await page.evaluate(() => window.testPlayer.loads.at(-1)),
  ).toMatchObject({ startSeconds: 7, endSeconds: 10 });
  await page.getByRole("button", { name: "Loop clip" }).click();
  await page.evaluate(() => (window.testPlayer.current = 10.01));
  await expect
    .poll(() => page.evaluate(() => window.testPlayer.loads.length))
    .toBe(2);
  expect(await page.evaluate(() => window.testPlayer.current)).toBe(7);
  await page.evaluate(() => (window.testPlayer.current = 2));
  await expect
    .poll(() => page.evaluate(() => window.testPlayer.current))
    .toBe(7);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  expect(await page.evaluate(() => window.testPlayerDestroyed)).toBe(true);
});
test("sharing failure does not invent a short link", async ({ page }) => {
  await openClip(page);
  await page.route("**/rest/v1/rpc/share_clip", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"Unavailable"}',
    }),
  );
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(page.locator(".toast")).toContainText(
    "Could not create a link",
  );
  await expect(
    page.getByRole("button", { name: "Copy link", exact: true }),
  ).toBeEnabled();
});

test("failed embed hides controls and offers timestamped fallback", async ({ page }) => {
  await openClip(page);
  await page.evaluate(() => window.testPlayer.options.events.onError({ data: 101 }));
  await expect(page.getByRole("button", { name: "Play clip", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Watch on YouTube ↗" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=1YZEE9-2BWE&t=7s");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play clip", exact: true })).toBeEnabled();
});

test("creation preview verifies actual playback and resets on range change", async ({ page }) => {
  await mockYouTube(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Add clip", exact: true }).click();
  await page.getByLabel("YouTube link", { exact: true }).fill("https://www.youtube.com/watch?v=1YZEE9-2BWE");
  await page.getByLabel("Start", { exact: true }).fill("7");
  await page.getByLabel("End", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Check playback" }).click();
  await expect(page.getByText("Press Play clip to test playback.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Play clip", exact: true }).click();
  await expect(page.getByText("Playback works here right now.", { exact: false })).toBeVisible();
  await page.evaluate(() => window.testPlayer.options.events.onError({ data: 150 }));
  await expect(page.getByText("Playback check failed.", { exact: false })).toBeVisible();
  await page.getByLabel("End", { exact: true }).fill("11");
  await expect(page.locator(".playback-fallback")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Add a new clip." })).toBeVisible();
});
