import { test, expect, userId } from './account-fixture.js';
import { seedClips, demoClips } from '../src/data.js';

for (const role of ['member', 'admin']) {
  test(`${role} can save, reload and remove a personal favorite`, async ({page, accountState}) => {
    accountState.role = role;
    accountState.managed = [{...seedClips[0],id:'22222222-2222-4222-8222-222222222222',title:'Shared favorite',_kind:'saved'}];
    await page.goto('/');
    await page.getByRole('button',{name:'Add to favorites: Shared favorite',exact:true}).click();
    await expect(page.getByRole('button',{name:'Remove from favorites: Shared favorite',exact:true})).toBeVisible();
    expect(accountState.favorites).toEqual([{owner_id:userId,clip_id:accountState.managed[0].id}]);
    await page.reload();
    await expect(page.getByRole('button',{name:'Remove from favorites: Shared favorite',exact:true})).toBeVisible();
    await page.getByRole('button',{name:/^Favorites/}).click();
    await expect(page.locator('.clip-card')).toHaveCount(1);
    await page.getByRole('button',{name:'Remove from favorites: Shared favorite',exact:true}).click();
    await expect(page.locator('.clip-card')).toHaveCount(0);
    expect(accountState.favorites).toEqual([]);
    await expect(page.locator('.filters button')).toHaveText(['All']);
  });
}

test('My clips contains only uploads by this account; categories follow view and search', async ({page, accountState}) => {
  accountState.hidden = [...seedClips,...demoClips].map(c=>c.id);
  accountState.clips = [{id:'11111111-2222-4333-8444-555555555555',owner_id:userId,data:{...seedClips[0],title:'My scene',category:'😂 Humor'}}];
  accountState.managed = [{...seedClips[1],id:'22222222-2222-4222-8222-222222222222',title:'Another scene',category:'😏 Sarcasm',_kind:'saved'}];
  await page.goto('/');
  await expect(page.locator('.clip-card')).toHaveCount(2);
  await expect(page.locator('.filters button')).toHaveText(['All','😂 Humor','😏 Sarcasm']);
  await page.locator('.filters').getByRole('button',{name:'😏 Sarcasm',exact:true}).click();
  await expect(page.locator('.clip-card')).toHaveCount(1);
  await page.getByPlaceholder('Search a quote, movie, or reaction…').fill('My scene');
  await expect(page.locator('.filters button')).toHaveText(['All','😂 Humor']);
  await expect(page.locator('.filters .selected')).toHaveText('All');
  await expect(page.getByRole('button',{name:'Play: My scene',exact:true})).toBeVisible();
  await page.getByRole('button',{name:/^My clips/}).click();
  await expect(page.locator('.clip-card')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Play: My scene',exact:true})).toBeVisible();
  await expect(page.locator('.filters button')).toHaveText(['All','😂 Humor']);
});
