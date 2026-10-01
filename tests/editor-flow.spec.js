import {test,expect} from './account-fixture.js';
import {mockYouTube} from './youtube-fixture.js';
import {seedClips} from '../src/data.js';

test('link-only first step, Enter continues, changing link preserves draft and resets timing only for a new video', async ({page,accountState}) => {
 await mockYouTube(page); await page.goto('/');
 await page.getByRole('button',{name:'Add clip',exact:true}).click();
 await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 await expect(page.getByLabel('Start',{exact:true})).toHaveCount(0);
 await page.getByLabel('YouTube link').fill('https://example.com/watch?v=1YZEE9-2BWE');
 await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 await page.getByLabel('YouTube link').fill('https://youtu.be/1YZEE9-2BWE');
 await expect(page.locator('.clip-editor')).toHaveCount(0);
 expect(await page.evaluate(()=>window.testPlayer)).toBeUndefined();
 await page.getByLabel('YouTube link').press('Enter');
 await expect(page.getByText('Step 2 of 2 · Create your clip')).toBeFocused();
 expect(accountState.clips).toHaveLength(0);
 await page.getByLabel('Clip title').fill('Keep this draft');
 await page.getByLabel('Start',{exact:true}).fill('3.5');
 await page.getByLabel('End',{exact:true}).fill('10');
 await page.getByRole('button',{name:'Change link',exact:true}).click();
 await expect(page.getByLabel('YouTube link')).toBeFocused();
 await expect.poll(()=>page.evaluate(()=>window.testPlayerDestroyed)).toBe(true);
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.getByLabel('Clip title')).toHaveValue('Keep this draft');
 await expect(page.getByLabel('Start',{exact:true})).toHaveValue('3.5');
 await page.getByRole('button',{name:'Change link',exact:true}).click();
 await page.getByLabel('YouTube link').fill('https://youtu.be/dQw4w9WgXcQ');
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.getByLabel('Start',{exact:true})).toHaveValue('');
 await expect(page.getByLabel('End',{exact:true})).toHaveValue('');
});

test('skip controls seek each distance, clamp at video bounds and preserve play/pause and selection', async ({page}) => {
 await mockYouTube(page);await page.goto('/');
 await page.getByRole('button',{name:'Add clip',exact:true}).click();
 await page.getByLabel('YouTube link').fill('https://youtu.be/1YZEE9-2BWE');
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.getByRole('button',{name:'Skip forward 1 seconds',exact:true})).toBeEnabled();
 await page.getByLabel('Start',{exact:true}).fill('7');await page.getByLabel('End',{exact:true}).fill('10');
 for(const amount of [0.5,1,3,5]) for(const direction of ['backward','forward']) {
  await page.evaluate(()=>{window.testPlayer.current=100;window.testPlayer.pauseVideo();});
  await page.getByRole('button',{name:`Skip ${direction} ${amount} seconds`,exact:true}).click();
  expect(await page.evaluate(()=>window.testPlayer.current)).toBe(100+(direction==='forward'?amount:-amount));
  expect(await page.evaluate(()=>window.testPlayer.state)).toBe(2);
 }
 await page.evaluate(()=>{window.testPlayer.current=2;window.testPlayer.playVideo();});
 await page.getByRole('button',{name:'Skip backward 5 seconds',exact:true}).click();
 expect(await page.evaluate(()=>window.testPlayer.current)).toBe(0);
 expect(await page.evaluate(()=>window.testPlayer.state)).toBe(1);
 await page.evaluate(()=>window.testPlayer.current=999);
 await page.getByRole('button',{name:'Skip forward 5 seconds',exact:true}).click();
 expect(await page.evaluate(()=>window.testPlayer.current)).toBe(1000);
 await page.getByRole('button',{name:'Preview ClipQuote',exact:true}).click();
 await page.getByRole('button',{name:'Skip forward 5 seconds',exact:true}).click();
 expect(await page.evaluate(()=>window.testPlayer.current)).toBe(12);
 await expect(page.getByRole('button',{name:'Preview ClipQuote',exact:true})).toBeVisible();
 await expect(page.getByLabel('Start',{exact:true})).toHaveValue('7');
 await expect(page.getByLabel('End',{exact:true})).toHaveValue('10');
});

test('opening a clip waits for Play and retains the selected range',async({page})=>{
 await mockYouTube(page);
 await page.goto('/#'+new URLSearchParams({clip:JSON.stringify({...seedClips[0],start:7.3,end:10.4})}));
 await expect(page.getByRole('button',{name:'Play clip',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>window.testPlayer.loads.length)).toBe(0);
 expect(await page.evaluate(()=>window.testPlayer.state)).toBe(5);
 expect(await page.evaluate(()=>window.testPlayer.range)).toMatchObject({startSeconds:7.3,endSeconds:10.4});
 await page.getByRole('button',{name:'Play clip',exact:true}).click();
 await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeEnabled();
 await page.evaluate(()=>window.testPlayer.current=10.5);
 await expect(page.getByLabel('Clip time')).toHaveText('0:03.1 / 0:03.1');
 expect(await page.evaluate(()=>window.testPlayer.state)).toBe(2);
});
