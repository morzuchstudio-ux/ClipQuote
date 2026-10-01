import {test,expect} from './account-fixture.js';
import {mockYouTube} from './youtube-fixture.js';
import {seedClips} from '../src/data.js';

for (const volume of [0,35]) test(`first Play restores inherited mute (volume ${volume}); explicit mute survives pause and replay`,async({page})=>{
 await mockYouTube(page);
 await page.addInitScript(volume=>{window.testInitialMuted=true;window.testInitialVolume=volume;},volume);
 await page.goto('/#'+new URLSearchParams({clip:JSON.stringify(seedClips[0])}));
 await expect(page.getByRole('button',{name:'Unmute',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>window.testPlayer.state)).toBe(5);
 await page.getByRole('button',{name:'Play clip',exact:true}).click();
 await expect(page.getByRole('button',{name:'Mute',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.testPlayer.isMuted())).toBe(false);
 expect(await page.evaluate(()=>window.testPlayer.getVolume())).toBe(volume || 50);
 await page.getByRole('button',{name:'Mute',exact:true}).click();
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.getByRole('button',{name:'Play clip',exact:true}).click();
 expect(await page.evaluate(()=>window.testPlayer.isMuted())).toBe(true);
 await page.getByRole('button',{name:'Replay clip',exact:true}).click();
 expect(await page.evaluate(()=>window.testPlayer.isMuted())).toBe(true);
 await page.getByRole('button',{name:'Unmute',exact:true}).click();
 expect(await page.evaluate(()=>window.testPlayer.isMuted())).toBe(false);
 await page.evaluate(()=>window.testPlayer.setVolume(0));
 await expect(page.getByRole('button',{name:'Unmute',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Unmute',exact:true}).click();
 expect(await page.evaluate(()=>window.testPlayer.getVolume())).toBe(50);
});
for (const action of ['Play video','Preview ClipQuote','native player']) test(`editor ${action} restores inherited silence`,async({page})=>{
 await mockYouTube(page);await page.addInitScript(()=>{window.testInitialMuted=true;window.testInitialVolume=0;});
 await page.goto('/');await page.getByRole('button',{name:'Add clip',exact:true}).click();
 await page.getByLabel('YouTube link').fill('https://youtu.be/1YZEE9-2BWE');
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.getByLabel('Start',{exact:true}).fill('7');await page.getByLabel('End',{exact:true}).fill('10');
 if (action === 'native player') {
  await expect(page.getByRole('button',{name:'Play video',exact:true})).toBeEnabled();
  await page.evaluate(()=>window.testPlayer.playVideo());
 } else await page.getByRole('button',{name:action,exact:true}).click();
 expect(await page.evaluate(()=>window.testPlayer.isMuted())).toBe(false);
 expect(await page.evaluate(()=>window.testPlayer.getVolume())).toBe(50);
 // Respect a later mute in YouTube's own controls.
 await page.evaluate(()=>{window.testPlayer.mute();window.testPlayer.pauseVideo();});
 await page.getByRole('button',{name:'Play video',exact:true}).click();
 expect(await page.evaluate(()=>window.testPlayer.isMuted())).toBe(true);
});

test('native YouTube Play and direct Replay also restore sound without autoplay',async({page})=>{
 await mockYouTube(page);await page.addInitScript(()=>{window.testInitialMuted=true;window.testInitialVolume=0;});
 const url='/#'+new URLSearchParams({clip:JSON.stringify(seedClips[0])});
 for (const native of [true,false]) {
  await page.goto(url); await expect(page.getByRole('button',{name:'Play clip',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>window.testPlayer.state)).toBe(5);
  if(native) await page.evaluate(()=>window.testPlayer.playVideo());
  else await page.getByRole('button',{name:'Replay clip',exact:true}).click();
  await expect(page.getByRole('button',{name:'Mute',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.testPlayer.isMuted())).toBe(false);
  expect(await page.evaluate(()=>window.testPlayer.getVolume())).toBe(50);
  await page.goto('about:blank');
 }
});
