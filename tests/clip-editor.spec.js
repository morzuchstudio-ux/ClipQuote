import { test, expect, mockAccount } from './account-fixture.js';
import { mockYouTube } from './youtube-fixture.js';
import { seconds, time, validClip, seedClips } from '../src/data.js';

async function openEditor(page) {
  await mockYouTube(page);
  await page.goto('/');
  await page.getByRole('button', {name:'Add clip',exact:true}).click();
  await page.getByLabel('YouTube link').fill('https://youtu.be/1YZEE9-2BWE');
  await page.getByRole("button", {name:"Next",exact:true}).click();
  await expect(page.getByRole('button',{name:'Set start here'})).toBeEnabled();
}
test('fractional timestamps validate and format without floating point noise', () => {
  expect(seconds('2:43.3')).toBe(163.3);
  expect(seconds('8.125')).toBe(8.125);
  expect(seconds('1:60.3')).toBeNaN();
  expect(seconds('Infinity')).toBeNaN();
  expect(seconds('-0.1')).toBeNaN();
  expect(time(10.1 - 7.2)).toBe('0:02.9');
  expect(time(59.9999)).toBe('1:00');
  expect(validClip({...seedClips[0],start:7.2,end:10.1})).toBe(true);
  expect(validClip({...seedClips[0],start:NaN})).toBe(false);
});
test('mark while watching, fine tune, preview stops at end, save and share decimals', async ({page, browser, accountState}) => {
  await openEditor(page);
  await page.getByRole('button',{name:'Play video',exact:true}).click();
  await page.evaluate(() => window.testPlayer.current = 163.34);
  await page.getByRole('button',{name:'Set start here'}).click();
  await expect(page.getByLabel('Start',{exact:true})).toHaveValue('2:43.3');
  await page.getByRole('button',{name:'Set end here'}).click();
  await expect(page.getByText('The end must be after the start.',{exact:false})).toBeVisible();
  await page.evaluate(() => window.testPlayer.current = 170.27);
  await page.getByRole('button',{name:'Set end here'}).click();
  await page.getByRole('button',{name:'Start earlier by 0.1 seconds'}).click();
  await page.getByRole('button',{name:'End later by 0.1 seconds'}).click();
  await expect(page.getByLabel('Start',{exact:true})).toHaveValue('2:43.2');
  await expect(page.getByLabel('End',{exact:true})).toHaveValue('2:50.4');
  await page.getByRole('button',{name:'Preview ClipQuote',exact:true}).click();
  expect(await page.evaluate(() => window.testPlayer.loads.at(-1))).toMatchObject({startSeconds:163.2,endSeconds:170.4});
  await page.evaluate(() => window.testPlayer.current = 170.41);
  await expect(page.getByText('Preview finished.',{exact:false})).toBeVisible();
  expect(await page.evaluate(() => window.testPlayer.state)).toBe(2);
  await page.getByLabel('Clip title').fill('Precise moment');
  await page.getByRole('button',{name:'Save clip',exact:true}).click();
  expect(accountState.clips[0].data).toMatchObject({start:163.2,end:170.4});
  await expect.poll(() => page.evaluate(() => window.testPlayerDestroyed)).toBe(true);
  await page.reload();
  await page.getByRole('button',{name:'Play: Precise moment',exact:true}).click();
  await expect.poll(() => page.evaluate(() => window.testPlayer.range)).toMatchObject({startSeconds:163.2,endSeconds:170.4});
  await page.getByRole('button',{name:'Copy link',exact:true}).click();
  await expect.poll(() => accountState.shared?.start).toBe(163.2);
  const context = await browser.newContext();
  await mockAccount(context,accountState,false);
  const recipient = await context.newPage(); await mockYouTube(recipient);
  await recipient.goto('/c/'+'a'.repeat(24));
  await expect(recipient.getByLabel('Clip time')).toHaveText('0:00 / 0:07.2');
  expect(await recipient.evaluate(() => window.testPlayer.range)).toMatchObject({startSeconds:163.2,endSeconds:170.4});
  await context.close();
});
test('timing enforces video duration and changing source clears old range', async ({page}) => {
  await openEditor(page);
  await page.getByLabel('Start',{exact:true}).fill('0:19.9');
  await page.getByLabel('End',{exact:true}).fill('0:20');
  await page.getByRole('button',{name:'End earlier by 0.1 seconds'}).click();
  await expect(page.getByLabel('End',{exact:true})).toHaveValue('0:20');
  await page.getByRole('button',{name:'Preview ClipQuote',exact:true}).click();
  await page.getByRole('button',{name:'End later by 0.1 seconds'}).click();
  expect(await page.evaluate(() => window.testPlayer.state)).toBe(2);
  expect(await page.evaluate(() => window.testPlayerDestroyed)).not.toBe(true);
  await page.getByLabel('End',{exact:true}).fill('1001');
  await expect(page.getByRole('button',{name:'Preview ClipQuote',exact:true})).toBeDisabled();
  await page.getByLabel('Clip title').fill('Invalid range');
  await page.getByRole('button',{name:'Save clip',exact:true}).click();
  await expect(page.getByText('Choose a valid range:',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Change link',exact:true}).click();
  await page.getByLabel('YouTube link').fill('https://youtu.be/dQw4w9WgXcQ');
  await page.getByRole("button", {name:"Next",exact:true}).click();
  await expect(page.getByLabel('Start',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('End',{exact:true})).toHaveValue('');
  await expect(page.getByRole('button',{name:'Set start here'})).toBeEnabled();
  expect(await page.evaluate(() => window.testPlayer.options.videoId)).toBe('dQw4w9WgXcQ');
});
test('blocked embedding keeps manual timing and save available, retry works', async ({page,accountState}) => {
  await openEditor(page);
  await page.evaluate(() => window.testPlayer.options.events.onError({data:150}));
  await expect(page.getByRole('link',{name:'Open on YouTube ↗',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Set start here'})).toBeDisabled();
  await page.getByLabel('Start',{exact:true}).fill('7.2');
  await page.getByLabel('End',{exact:true}).fill('10.1');
  await page.getByRole('button',{name:'Retry video'}).click();
  await expect(page.getByRole('button',{name:'Set start here'})).toBeEnabled();
  await expect(page.getByLabel('Start',{exact:true})).toHaveValue('7.2');
  await page.evaluate(() => window.testPlayer.options.events.onError({data:150}));
  await page.getByLabel('Clip title').fill('Manual fallback');
  await page.getByRole('button',{name:'Save clip',exact:true}).click();
  expect(accountState.clips[0].data).toMatchObject({start:7.2,end:10.1});
});
test('editor fits mobile and both themes', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await openEditor(page);
  const editor = page.locator('.clip-editor');
  for (const theme of ['light','dark']) {
    await page.evaluate(theme => document.documentElement.dataset.theme=theme,theme);
    await expect(editor).toBeVisible();
    expect(await editor.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await editor.screenshot({path:`/tmp/clipquote-editor-${theme}.png`});
  }
});
