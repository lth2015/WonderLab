const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises');
const out='/workspace/.wonderlab-tools/willow-v3-results';
async function captureEngine(page,url){
 await page.goto(url,{waitUntil:'networkidle',timeout:45000});
 await page.evaluate(async()=>{const {Engine}=await import('/src/engine/engine.ts');const update=Engine.prototype.update;Engine.prototype.update=function(dt){window.reviewEngine=this;return update.call(this,dt);};});
 await page.waitForFunction(()=>!!window.reviewEngine);
 await page.evaluate(()=>{const e=window.reviewEngine;e.stop();e.reviewStep=(seconds)=>{const f=e.renderLandscape;e.renderLandscape=()=>{};try{for(let k=0;k<seconds*60;k++){e.time+=1/60;e.update(1/60);}}finally{e.renderLandscape=f;}};});
}
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await captureEngine(page,'http://127.0.0.1:5217/?fresh&shore=willow&tier=standard');
  await page.locator('canvas.world').focus();await page.locator('canvas.world').press('f');
  await page.evaluate(()=>{const e=window.reviewEngine;e.atmosphere.set({...e.atmosphere.state,timeOfDay:'day',weather:'clear'});e.reviewStep(25);const f=e.fishes.find(f=>!f.ghost);f.moveHeadTo(e.width*.5,e.height*.28);e.renderLandscape();e.renderer.render(e.scene,e.camera);});
  await page.screenshot({path:out+'/v3-day-with-fish.png',animations:'disabled'});
  const measures=await page.evaluate(async()=>{
   const e=window.reviewEngine;const w=e.shore.willow;
   const runs=[];
   for(const wind of [0,.45]){
    const xs=w.strands.map(()=>[]),ys=w.strands.map(()=>[]);let dips=0;
    for(let k=0;k<=600;k++){
     w.update(k/60,1/60,wind,{day:1,dusk:0},false,()=>dips++);
     w.strands.forEach((s,i)=>{const j=(i*21+20)*6;xs[i].push((w.ribbonPos[j]+w.ribbonPos[j+3])/2);ys[i].push((w.ribbonPos[j+1]+w.ribbonPos[j+4])/2);});
    }
    const near=w.strands.map((s,i)=>({depth:s.depth,xSpan:Math.max(...xs[i])-Math.min(...xs[i]),ySpan:Math.max(...ys[i])-Math.min(...ys[i]),tipX:xs[i][0]/390,tipY:1-ys[i][0]/844})).filter(s=>s.depth>=.8);
    runs.push({wind,seconds:10,dips,near});
   }
   const {Willow}=await import('/src/engine/willow.ts');
   const resized=new Willow();resized.resize(1440,900,450,900);resized.resize(390,844,464.2,390);
   const fresh=new Willow();fresh.resize(390,844,464.2,390);
   const summary=(a)=>{a.update(0,1/60,.25,{day:1,dusk:0},false,()=>{});let below=0;for(let i=0;i<a.strands.length;i++){const p=(i*21+20)*6;const y=(a.ribbonPos[p+1]+a.ribbonPos[p+4])/2;if(y<464.2)below++;}return {strands:a.strands.length,maxLength:Math.max(...a.strands.map(s=>s.len)),tipsBelowHorizon:below,nearLengths:a.strands.filter(s=>s.depth>=.8).map(s=>s.len)};};
   const resize={freshMobile:summary(fresh),desktopThenMobile:summary(resized)};resized.dispose();fresh.dispose();
   return {runs,resize};
  });
  await page.evaluate(()=>{const e=window.reviewEngine;e.atmosphere.set({...e.atmosphere.state,timeOfDay:'night',weather:'moonlit'});e.reviewStep(30);const f=e.fishes.find(f=>!f.ghost);f.moveHeadTo(e.width*.5,e.height*.28);e.renderLandscape();e.renderer.render(e.scene,e.camera);});
  await page.screenshot({path:out+'/v3-moon-with-fish.png',animations:'disabled'});
  // Actual viewport transition: load desktop, resize to the same mobile size, render at a fixed day state.
  await page.setViewportSize({width:1440,height:900});
  await captureEngine(page,'http://127.0.0.1:5217/?fresh&shore=willow&tier=standard');
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>window.reviewEngine.width===390&&window.reviewEngine.height===844);
  await page.evaluate(()=>{const e=window.reviewEngine;e.atmosphere.set({...e.atmosphere.state,timeOfDay:'day',weather:'clear'});e.reviewStep(25);e.renderLandscape();e.renderer.render(e.scene,e.camera);});
  await page.screenshot({path:out+'/v3-desktop-to-mobile.png',animations:'disabled'});
  const resizeContext=await page.evaluate(()=>({width:window.reviewEngine.width,height:window.reviewEngine.height,contextLost:window.reviewEngine.renderer.getContext().isContextLost()}));
  const report={source:'ac69d38',method:'Actual Willow data and deterministic browser rendering; screenshots are static captures, not realtime performance validation.',pageErrors:errors,resizeContext,...measures};
  await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  if(errors.length)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
