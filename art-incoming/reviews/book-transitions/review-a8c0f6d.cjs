const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const fs=require('node:fs/promises');const out='/workspace/.wonderlab-tools/book-transitions-a8c0f6d';const base='http://127.0.0.1:5221';
async function capture(p){await p.evaluate(async()=>{const {Engine}=await import('/src/engine/engine.ts');const update=Engine.prototype.update;Engine.prototype.update=function(dt){window.reviewEngine=this;return update.call(this,dt)}});await p.waitForFunction(()=>!!window.reviewEngine);await p.evaluate(()=>{const e=window.reviewEngine;e.stop();e.reviewStep=s=>{const f=e.renderLandscape;e.renderLandscape=()=>{};try{for(let i=0;i<Math.ceil(s*60);i++){e.time+=1/60;e.update(1/60)}}finally{e.renderLandscape=f}}})}
async function openBook(p){await p.getByRole('button',{name:'更多',exact:true}).click();await p.getByRole('menuitem',{name:'四时',exact:true}).click()}
(async()=>{await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});const report={source:'a8c0f6d',method:'Actual Book button clicks. Engine is stepped deterministically to inspect rapid accepted inputs before they finish their queue; scene API unavailable locally, no actual AI request.',errors:[],cases:[]};try{
 for(const name of ['萤火','荷','柳']){
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});await ctx.route('**/api/scene',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"local review fixture"}'}));const p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(base+'/?fresh&tier=standard',{waitUntil:'networkidle',timeout:45000});await capture(p);
  await p.evaluate(()=>{const e=window.reviewEngine;e.atmosphere.set({...e.atmosphere.state,timeOfDay:'day',weather:'clear'});e.reviewStep(35)});
  if(name!=='萤火'){
   await p.locator('canvas.world').focus();for(let i=0;i<3;i++){await p.locator('canvas.world').press('f');await p.evaluate(()=>window.reviewEngine.reviewStep(.1))}
  }
  const before=await p.evaluate(()=>{const e=window.reviewEngine;return {timeOfDay:e.atmosphere.state.timeOfDay,day:e.atmosphere.day,ownFish:e.serialize().fish.filter(f=>f.origin).length,queued:e.leadQueue.length,hasWillow:e.hasWillow}});
  await openBook(p);const button=p.getByRole('button',{name:new RegExp('^'+name+'：')});
  if(name==='柳'){await Promise.all([p.waitForNavigation({waitUntil:'networkidle',timeout:45000}),button.click()]);await capture(p);await p.waitForTimeout(1500)}else await button.click();
  const after=await p.evaluate(()=>{const e=window.reviewEngine;e.reviewStep(15);const s=e.serialize();return {url:location.pathname,timeOfDay:e.atmosphere.state.timeOfDay,weather:e.weather,ownFish:s.fish.filter(f=>f.origin).length,queued:e.leadQueue.length,hasWillow:e.hasWillow}});
  report.cases.push({name,before,after});console.log(JSON.stringify({name,before,after}));await ctx.close();
 }
}finally{await browser.close()}await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n')})().catch(e=>{console.error(e);process.exitCode=1});
