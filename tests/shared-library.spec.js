import { test, expect } from './account-fixture.js';
import { seedClips } from '../src/data.js';
import { mockYouTube } from './youtube-fixture.js';

test('member sees community clips, shares without copying, and keeps My clips personal', async ({ page, accountState }) => {
  accountState.managed = [{ ...seedClips[0], id:'22222222-2222-4222-8222-222222222222', title:'Community moment', _kind:'saved' }];
  await mockYouTube(page);
  await page.goto('/');
  const card = page.locator('.clip-card').filter({hasText:'Community moment'});
  await expect(card).toBeVisible();
  await card.getByRole('button', {name:'Share: Community moment',exact:true}).click();
  await expect.poll(() => accountState.shared?.title).toBe('Community moment');
  expect(accountState.clips).toHaveLength(0);
  await page.reload();
  await page.getByRole('button',{name:'Play: Community moment',exact:true}).click();
  await expect(page.getByRole('button',{name:'Delete clip',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:/My clips/}).click();
  await expect(page.locator('.clip-card')).toHaveCount(0);
  accountState.managed.push({...seedClips[1],id:'33333333-3333-4333-8333-333333333333',title:'New community moment',_kind:'saved'});
  await page.reload();
  await expect(page.getByRole('button',{name:'Play: New community moment',exact:true})).toBeVisible();
});
