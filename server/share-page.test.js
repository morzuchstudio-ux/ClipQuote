import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSharePage } from './share-page.js';
const template = '<!doctype html><html><head><meta name="description" content="generic" /><title>Generic title</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';
const id = '01643dbe35e709a723193879';
const clip = { title:'Scene & reaction', videoId:'CHJL4j5Cllc', source:'YouTube', start:160.5,end:162 };
const lookup = async () => Response.json({clip});
const handler = createSharePage(async()=>template, lookup);
test('initial public HTML contains thumbnail and title without JavaScript and preserves the app',async()=>{
 for(const path of [`/c/${id}`,`/api/share?id=${id}`, '/c/legacytest000001']) {
  const r=await handler(new Request('https://clipquote.local'+path));
  assert.equal(r.status,200);
  assert.match(r.headers.get('content-type'),/text\/html/);
  assert.equal(r.headers.get('cache-control'),'no-store');
  const html=await r.text();
  assert.match(html,/<meta property="og:title" content="Scene &amp; reaction"/);
  assert.match(html,/<meta property="og:image" content="https:\/\/i.ytimg.com\/vi\/CHJL4j5Cllc\/hqdefault.jpg"/);
  assert.match(html,/<meta name="twitter:card" content="summary_large_image"/);
  assert.match(html,/<script type="module" src="\/assets\/app.js"><\/script>/);
  assert.doesNotMatch(html,/Generic title|content="generic"/);
  assert.equal((html.match(/<title>/g)||[]).length,1);
 }
});
test('untrusted titles and descriptions cannot inject HTML or script',async()=>{
 const dangerous='</title><script>alert(1)</script><img src=x onerror="alert(1)">';
 const h=createSharePage(async()=>template,async()=>Response.json({clip:{...clip,title:dangerous,source:dangerous}}));
 const html=await (await h(new Request('https://clipquote.local/c/'+id))).text();
 assert.doesNotMatch(html,/<script>alert|<img src=x/);
 assert.match(html,/&lt;script&gt;alert/);
 assert.match(html,/&quot;alert\(1\)&quot;/);
});
test('invalid or deleted links and storage errors preserve app shell without misleading thumbnail',async()=>{
 let called=false;
 const invalid=createSharePage(async()=>template,async()=>{called=true;return lookup();});
 assert.equal((await invalid(new Request('https://clipquote.local/c/bad'))).status,404);
 assert.equal(called,false);
 for(const status of [404,503]) {
  const h=createSharePage(async()=>template,async()=>Response.json({error:'Unavailable'},{status}));
  const r=await h(new Request('https://clipquote.local/c/'+id));
  assert.equal(r.status,status);
  const html=await r.text();
  assert.match(html,/id="root"/);
  assert.match(html,/content="noindex"/);
  assert.doesNotMatch(html,/og:image/);
 }
});
test('HEAD and method handling, canonical excludes query strings',async()=>{
 const head=await handler(new Request('https://clipquote.local/c/'+id,{method:'HEAD'}));
 assert.equal(head.status,200);assert.equal(await head.text(),'');
 const post=await handler(new Request('https://clipquote.local/c/'+id,{method:'POST'}));
 assert.equal(post.status,405);
 const html=await (await handler(new Request('https://clipquote.local/c/'+id+'?preview=2'))).text();
 assert.match(html,new RegExp(`property="og:url" content="https://clipquote.vercel.app/c/${id}"`));
 assert.doesNotMatch(html,/preview=2/);
});
