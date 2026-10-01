import { test, expect } from "./account-fixture.js";
test("cards use metadata thumbnails and fall back when unavailable", async ({ page }) => {
  await page.route("**/api/video-metadata?*", async (route) => {
    const id = new URL(route.request().url()).searchParams.get("id");
    await route.fulfill({ json: { thumbnail: `https://i.ytimg.com/vi/${id}/metadata.jpg` } });
  });
  await page.route("**/metadata.jpg", (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
  }));
  await page.goto("/");
  const image = page.locator(".thumbnail img").first();
  await expect(image).toHaveAttribute("src", /metadata.jpg$/);
  await image.dispatchEvent("error");
  await expect(image).toHaveAttribute("src", /hqdefault.jpg$/);
});
