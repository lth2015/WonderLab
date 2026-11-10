const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises');
const out='/workspace/.wonderlab-tools/entrance-results-3d1c289';
const base='http://127.0.0.1:5221';
async function attach(page,url){
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
 await page.evaluate(async()=>{const {Engine}=await import('/src/engine/engine.ts');const original=Engine.prototype.update;Engine.prototype.update=function(dt){window.reviewEngine=this;return original.call(this,dt)}});
 await page.waitForFunction(()=>!!window.reviewEngine,{timeout:30000});
 await page.evaluate(()=>{
  const e=window.reviewEngine;e.stop();
  e.reviewPlayed=[];e.setSound({play:(kind,opts)=>e.reviewPlayed.push({kind,t:e.time,weather:e.weather,opts}),ambient:levels=>e.reviewAmbient={...levels}});
  e.reviewStep=seconds=>{const render=e.renderLandscape;e.renderLandscape=()=>{};try{for(let i=0;i<Math.ceil(seconds*60);i++){e.time+=1/60;e.update(1/60)}}finally{e.renderLandscape=render}};
  e.reviewRender=()=>{e.renderLandscape();e.renderer.render(e.scene,e.camera)};
 });
}
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const report={source:'3d1c289',method:'Isolated actual browser engine with synthetic keyboard/branch strokes. Local scene API deliberately unavailable; no live AI requests. Deterministic time stepping is not device performance or audio audition.',pageErrors:[],branches:{},entries:[],moments:[]};
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,timezoneId:'Asia/Tokyo'});
  await context.route('**/api/scene',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"local review fixture"}'}));
  const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));
  await attach(page,base+'/?fresh&shore&tier=standard');
  report.branches=await page.evaluate(async()=>{
   const e=window.reviewEngine;const {Stroke}=await import('/src/engine/stroke.ts');const {parseWorld}=await import('/src/engine/persist.ts');
   const add=j=>{const s=new Stroke(e.palette,e.minDim,false);for(let i=0;i<8;i++)s.add({x:30+j*4+i*7,y:24+i*5,t:i*24,pressure:.5});s.finish();e.scene.add(s.mesh);e.placeBranch(s,'mouse')};
   for(let j=0;j<12;j++)add(j);
   const before=e.serialize().branches.map(b=>b.seed);add(12);
   const save=e.serialize();const after=save.branches.map(b=>b.seed);const parsed=parseWorld(save).branches.map(b=>b.seed);
   e.undo();const afterUndo=e.serialize().branches.map(b=>b.seed);
   localStorage.setItem('wonderlab.world',JSON.stringify(save));
   // Leave the saved 13th-creation state for the reload; pagehide normally re-saves current state.
   for(const j of [13])add(j);
   const forReload=e.serialize();localStorage.setItem('wonderlab.world',JSON.stringify(forReload));
   return {beforeCount:before.length,afterCount:after.length,parsedCount:parsed.length,latestRetained:parsed.at(-1)===after.at(-1),latestTwelveMatch:JSON.stringify(before.slice(1))===JSON.stringify(after.slice(0,-1)),beforeSeeds:before,afterSeeds:after,undoCount:afterUndo.length,undoRestoredPrevious:JSON.stringify(afterUndo)===JSON.stringify(before),reloadExpected:forReload.branches.map(b=>b.seed)};
  });
  await attach(page,base+'/?shore&tier=standard');
  report.branches.reloaded=await page.evaluate(()=>window.reviewEngine.serialize().branches.map(b=>b.seed));
  report.branches.reloadPreserved=JSON.stringify(report.branches.reloadExpected)===JSON.stringify(report.branches.reloaded);
  console.log(JSON.stringify({branches:{created:report.branches.afterCount,parsed:report.branches.parsedCount,reloadPreserved:report.branches.reloadPreserved,undoCount:report.branches.undoCount,undoRestoredPrevious:report.branches.undoRestoredPrevious}}));
  await attach(page,base+'/?fresh&tier=standard');
  const home=await page.evaluate(()=>({localHour:new Date().getHours(),timeOfDay:window.reviewEngine.atmosphere.state.timeOfDay}));report.home=home;
  await page.locator('canvas.world').focus();await page.locator('canvas.world').press('f');await page.evaluate(()=>window.reviewEngine.reviewStep(4));
  await page.locator('canvas.world').press('f');await page.evaluate(()=>window.reviewEngine.reviewStep(4));
  await page.locator('canvas.world').press('m');await page.evaluate(()=>window.reviewEngine.reviewStep(4));
  const original=await page.evaluate(()=>{const e=window.reviewEngine;const s=e.serialize();localStorage.setItem('wonderlab.world',JSON.stringify(s));return {fish:s.fish.filter(f=>f.origin).map(f=>({seed:f.seed,honmei:!!f.honmei,origin:f.origin})),moon:s.moon}});report.original=original;
  if(original.fish.length!==2||!original.moon)throw Error('keyboard fixture did not create two own fish and one circle');
  const scenes=await page.evaluate(async()=>{const {SCENES}=await import('/src/scenes.ts');return SCENES});
  for(const scene of scenes){
   await attach(page,base+'/'+encodeURIComponent(scene.name)+'?tier=standard');
   await page.waitForTimeout(1500);
   const result=await page.evaluate(({scene,original})=>{
    const e=window.reviewEngine;e.reviewStep(20);const s=e.serialize();
    const preserved=original.fish.map(o=>{const f=[...s.fish,...(s.away??[])].find(f=>f.seed===o.seed);return {seed:o.seed,found:!!f,honmei:!!f?.honmei,originMatches:JSON.stringify(f?.origin)===JSON.stringify(o.origin)}});
    localStorage.setItem('wonderlab.world',JSON.stringify(s));
    return {id:scene.id,weather:e.weather,timeOfDay:e.atmosphere.state.timeOfDay,hasWillow:e.hasWillow,preserved,moonPreserved:JSON.stringify(s.moon)===JSON.stringify(original.moon),sounds:e.reviewPlayed.filter(p=>p.kind==='cicada'||p.kind==='wings'),magpiePhase:e.shore?.willow?.magpie?.phase??null,pass:e.weather===scene.weather&&(!scene.time||scene.time===e.atmosphere.state.timeOfDay)&&preserved.every(p=>p.found&&p.originMatches)&&(!scene.willow||e.hasWillow)};
   },{scene,original});
   report.entries.push(result);console.log(JSON.stringify({entry:result.id,pass:result.pass,time:result.timeOfDay,weather:result.weather,sounds:result.sounds.map(s=>s.kind)}));
  }
  await page.getByRole('button',{name:'更多',exact:true}).click();await page.getByRole('menuitem',{name:'四时',exact:true}).click();
  const book=page.getByRole('dialog',{name:'四时',exact:true});await book.waitFor();report.book=await book.evaluate(el=>({scrollTop:el.scrollTop,pages:el.querySelectorAll('button.page').length,painted:el.querySelectorAll('img').length,text:el.textContent}));
  await page.screenshot({path:out+'/book-first-four.png'});
  await context.close();
  for(const reducedMotion of ['no-preference','reduce']){
   const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion});
   await ctx.route('**/api/scene',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"local review fixture"}'}));
   const p=await ctx.newPage();p.on('pageerror',e=>report.pageErrors.push(e.message));
   for(const name of ['惊鹊','鸣蝉']){
    await attach(p,base+'/'+encodeURIComponent(name)+'?fresh&tier=standard');await p.waitForTimeout(1500);
    const moment=await p.evaluate(()=>{const e=window.reviewEngine;const phases=[];for(let i=0;i<12*60;i++){e.reviewStep(1/60);if(i%30===0)phases.push({at:i/60,phase:e.shore?.willow?.magpie?.phase??null})}return {calm:e.calm,weather:e.weather,timeOfDay:e.atmosphere.state.timeOfDay,sounds:e.reviewPlayed,phases}});
    report.moments.push({name,reducedMotion,...moment});
    console.log(JSON.stringify({moment:name,reducedMotion,sounds:moment.sounds.map(s=>s.kind),phases:[...new Set(moment.phases.map(p=>p.phase))]}));
   }
   await ctx.close();
  }
  const last=await browser.newPage({viewport:{width:390,height:844}});last.on('pageerror',e=>report.pageErrors.push(e.message));
  await attach(last,base+'/?fresh&tier=standard');
  report.extra=await last.evaluate(async()=>{
   const e=window.reviewEngine;
   const state=(time,weather)=>{e.atmosphere.set({...e.atmosphere.state,timeOfDay:time,weather});e.reviewStep(40)};
   state('night','rainbow');const rainbow={state:{...e.atmosphere.state},day:e.atmosphere.day,uRainbow:e.worldMat.uniforms.uRainbow.value};
   const {Voices}=await import('/src/sound.ts');const ctx=new OfflineAudioContext(2,48000,48000);const voices=new Voices(ctx);const targets=[];const param=voices.insectGain.gain;const original=param.setTargetAtTime.bind(param);param.setTargetAtTime=(v,...a)=>{targets.push(v);return original(v,...a)};
   for(const timeOfDay of ['day','night','dusk']){state(timeOfDay,'clear');voices.ambient(e.reviewAmbient,0)}
   const ambient={labels:['day','night','dusk'],insectTargets:targets};
   const strikes=[];for(const calm of [false,true]){e.calm=calm;state('night','storm');e.reviewPlayed=[];e.nextFlash=e.time;e.updateStorm();const delay=e.thunder?.at-e.time;const flash=e.worldMat.uniforms.uFlash.value.x;e.nextFlash=e.time+30;e.reviewStep(4.1);strikes.push({calm,delay,initialFlash:flash,thunder:e.reviewPlayed.filter(p=>p.kind==='thunder')})}
   return {rainbow,ambient,strikes};
  });
  await last.evaluate(()=>{const e=window.reviewEngine;e.calm=false;e.atmosphere.set({...e.atmosphere.state,timeOfDay:'night',weather:'rainbow'});e.reviewStep(40);e.reviewRender()});await last.screenshot({path:out+'/rainbow-night.png'});
  await last.close();
 }finally{await browser.close()}
 await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({complete:true,entries:report.entries.length,allEntriesPass:report.entries.every(e=>e.pass),pageErrors:report.pageErrors,out}));
})().catch(e=>{console.error(e);process.exitCode=1});
