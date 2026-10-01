import {test,expect} from './account-fixture.js';
import {seedClips} from '../src/data.js';
for(const width of [1440,390]){
 test(`sticky search and theme at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await expect(page.locator('.clip-card')).toHaveCount(18);
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('header').getByRole('button',{name:'Add clip',exact:true})).toHaveCount(0);
  const hero=await page.locator('.hero').boundingBox(),add=await page.locator('.library-actions .primary').boundingBox();expect(add.y).toBeGreaterThan(hero.y+hero.height);
  await page.evaluate(()=>window.scrollTo(0,850));
  const sticky=await page.locator('.library-search').boundingBox();expect(Math.round(sticky.y)).toBe(width===390?112:0);
  expect((await page.locator('.hero').boundingBox()).y+hero.height).toBeLessThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  await page.evaluate(()=>window.scrollTo(0,0));await page.getByRole('button',{name:'Switch to light mode'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.getByRole('button',{name:'Add clip',exact:true}).click();await expect(page.getByRole('dialog',{name:'Add clip'})).toBeVisible();await expect(page.getByLabel('YouTube link')).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Switch to dark mode'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 });
}
test('legacy Polish categories survive and filter in English',async({page})=>{
 await page.addInitScript(clip=>localStorage.setItem('cq-clips',JSON.stringify([clip])),{...seedClips[0],id:'old-polish-clip',title:'My saved scene',category:'😤 Frustracja'});
 await page.goto('/');await page.getByRole('button',{name:'Import to my account'}).click();await expect(page.getByText('Browser clips imported.',{exact:false})).toBeVisible();await page.locator('.filters').getByRole('button',{name:'😤 Frustration',exact:true}).click();await expect(page.getByRole('button',{name:'My saved scene',exact:true})).toBeVisible();
 await expect(page.locator('.clip-card').filter({hasText:'My saved scene'}).getByRole('button',{name:'😤 Frustration',exact:true})).toBeVisible();
});
