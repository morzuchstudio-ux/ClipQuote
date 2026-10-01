import { test, expect, userId } from "./account-fixture.js";
import { seedClips } from "../src/data.js";
import { mockYouTube } from "./youtube-fixture.js";

test("card blank areas open the player; action buttons stay independent", async ({ page }) => {
  await mockYouTube(page);
  await page.goto("/");
  await expect(page.getByRole("button", {name:"Account",exact:true})).toBeVisible();
  const card = page.locator(".clip-card").first();
  await card.locator(".card-copy").click({ position: { x: 4, y: 4 } });
  await expect(page.getByRole("dialog", {name:"Clip player"})).toBeVisible();
  await page.getByRole("button", {name:"Close",exact:true}).click();
  await card.getByRole("button", {name:/Add to favorites/}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card.getByRole("button", {name:/Remove from favorites/})).toBeVisible();
  await card.getByRole("button", {name:seedClips[0].category,exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("admin sees migrated and other-owner clips and can delete them", async ({ page, accountState }) => {
  accountState.role = "admin";
  accountState.managed = [
    {...seedClips[0],id:"legacy:legacytest000001",title:"Migrated clip",_kind:"legacy",_legacyLink:"legacytest000001"},
    {...seedClips[1],id:"22222222-2222-4222-8222-222222222222",title:"Another user's clip",_kind:"saved",_ownerId:userId.replaceAll("1","2")},
  ];
  await mockYouTube(page);
  await page.goto("/");
  await page.getByRole("button", {name:"Play: Migrated clip",exact:true}).click();
  await page.getByRole("button", {name:"Delete clip",exact:true}).click();
  await page.getByRole("button", {name:"Delete permanently",exact:true}).click();
  await expect(page.getByRole("button", {name:"Play: Migrated clip",exact:true})).toHaveCount(0);
  expect(accountState.deleted).toEqual({clip_kind:"legacy",clip_key:"legacytest000001"});
  await page.getByRole("button", {name:"Play: Another user's clip",exact:true}).click();
  await page.getByRole("button", {name:"Delete clip",exact:true}).click();
  await page.getByRole("button", {name:"Delete permanently",exact:true}).click();
  await expect(page.getByRole("button", {name:"Play: Another user's clip",exact:true})).toHaveCount(0);
  expect(accountState.deleted.clip_kind).toBe("saved");
});

test("admin example removal persists and member has no delete control", async ({ page, accountState }) => {
  accountState.role = "admin";
  await mockYouTube(page);
  await page.goto("/");
  await expect(page.getByRole("button", {name:"Admin",exact:true})).toBeVisible();
  await page.getByRole("button", {name:"Play: No. God. Please, no!",exact:true}).click();
  await page.getByRole("button", {name:"Delete clip",exact:true}).click();
  await page.getByRole("button", {name:"Delete permanently",exact:true}).click();
  await expect(page.getByRole("dialog", {name:"Confirm deletion"})).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", {name:"Play: No. God. Please, no!",exact:true})).toHaveCount(0);
  accountState.role = "member";
  await page.reload();
  await expect(page.getByRole("button", {name:"Account",exact:true})).toBeVisible();
  await page.locator(".thumbnail").first().click();
  await expect(page.getByRole("button", {name:"Delete clip",exact:true})).toHaveCount(0);
});

test("saved metadata cannot disguise a personal clip as a migrated link", async ({ page, accountState }) => {
  accountState.role = "admin";
  const id = "22222222-2222-4222-8222-222222222222";
  accountState.clips = [{ id, data: {...seedClips[0], id, title:"Personal clip", _kind:"legacy", _legacyLink:"some-other-link"} }];
  await mockYouTube(page);
  await page.goto("/");
  await page.getByRole("button", {name:"Play: Personal clip",exact:true}).click();
  await page.getByRole("button", {name:"Delete clip",exact:true}).click();
  await page.getByRole("button", {name:"Delete permanently",exact:true}).click();
  await expect(page.getByRole("button", {name:"Play: Personal clip",exact:true})).toHaveCount(0);
  expect(accountState.deleted).toEqual({clip_kind:"saved",clip_key:id});
});


test("deletion works with browser confirmations blocked and supports cancel and retry", async ({ page, accountState }) => {
  accountState.role = "admin";
  await page.addInitScript(() => { window.confirm = () => false; });
  await mockYouTube(page);
  await page.goto("/");
  await expect(page.getByRole("button", {name:"Admin",exact:true})).toBeVisible();
  await page.locator(".thumbnail").first().click();
  await page.getByRole("button", {name:"Delete clip",exact:true}).click();
  await page.getByRole("button", {name:"Cancel",exact:true}).click();
  expect(accountState.deleted).toBeUndefined();
  await expect(page.getByRole("dialog", {name:"Clip player"})).toBeVisible();
  await page.getByRole("button", {name:"Delete clip",exact:true}).click();
  await page.route("**/rpc/admin_delete_clip", (route) => route.fulfill({status:503,json:{message:"Please retry"}}));
  await page.getByRole("button", {name:"Delete permanently",exact:true}).click();
  await expect(page.getByRole("dialog", {name:"Confirm deletion"}).getByRole("alert")).toContainText("Please retry");
  await page.unroute("**/rpc/admin_delete_clip");
  await page.getByRole("button", {name:"Delete permanently",exact:true}).click();
  await expect(page.getByRole("dialog", {name:"Confirm deletion"})).toHaveCount(0);
  expect(accountState.deleted.clip_kind).toBe("example");
});
