const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises');
const out='/workspace/.wonderlab-tools/book-integration-aecb408';
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const expected=JSON.parse(await fs.readFile('/workspace/WonderLab/art-incoming/book/delivery-check.json','utf8')).images;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5221/?fresh',{waitUntil:'networkidle',timeout:45000});
  await page.evaluate(async()=>{const {Engine}=await import('/src/engine/engine.ts');const original=Engine.prototype.update;Engine.prototype.update=function(dt){window.reviewEngine=this;return original.call(this,dt)}});await page.waitForFunction(()=>!!window.reviewEngine);await page.evaluate(()=>window.reviewEngine.stop());
  await page.getByRole('button',{name:'更多',exact:true}).click();await page.getByRole('menuitem',{name:'四时',exact:true}).click();const book=page.getByRole('dialog',{name:'四时',exact:true});await book.waitFor();
  const art=await page.evaluate(async expected=>{
   const {SCENES,sceneArt}=await import('/src/scenes.ts');const results=[];
   for(const s of SCENES){const url=sceneArt(s,'/');const response=await fetch(url);const bytes=await response.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');const image=new Image();image.src=url;await image.decode();const e=expected.find(e=>e.id===s.id);results.push({id:s.id,url,status:response.status,width:image.naturalWidth,height:image.naturalHeight,hashMatches:hash===e.sha256})}return results;
  },expected);
  const layout=await book.evaluate(el=>({scrollTop:el.scrollTop,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,pages:el.querySelectorAll('button.page').length,paintedBackgrounds:Array.from(el.querySelectorAll('button.page')).filter(p=>getComputedStyle(p).backgroundImage.includes('url(')).length,cards:Array.from(el.querySelectorAll('button.page')).map(p=>({label:p.getAttribute('aria-label'),width:p.getBoundingClientRect().width,height:p.getBoundingClientRect().height}))}));
  await page.screenshot({path:out+'/mobile-spring.png'});
  await book.evaluate(el=>{el.scrollTop=440});await page.screenshot({path:out+'/mobile-summer.png'});
  await book.evaluate(el=>{el.scrollTop=el.scrollHeight});await page.screenshot({path:out+'/mobile-winter.png'});
  await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(100);await book.evaluate(el=>{el.scrollTop=0});await page.screenshot({path:out+'/desktop-book.png'});
  const result={source:'aecb408',method:'Actual React Book with all delivered paintings; compare HTTP response, decoded size and exact file hashes against delivery manifest. Screenshots are static software-WebGL views.',errors,layout,art,pass:errors.length===0&&layout.pages===14&&layout.paintedBackgrounds===14&&layout.scrollTop===0&&layout.scrollWidth===layout.clientWidth&&art.length===14&&art.every(a=>a.status===200&&a.width===480&&a.height===640&&a.hashMatches)};
  await fs.writeFile(out+'/report.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
