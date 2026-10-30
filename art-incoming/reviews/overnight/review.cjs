const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises');
const base='http://127.0.0.1:5215/';
const output='/workspace/.wonderlab-tools/overnight-review-results';
function check(condition,message){if(!condition)throw new Error(message);}
async function attach(page,url){
 await page.goto(url,{waitUntil:'networkidle',timeout:45000});
 await page.evaluate(async()=>{
  const {Engine}=await import('/src/engine/engine.ts');
  const update=Engine.prototype.update;
  Engine.prototype.update=function(dt){window.reviewEngine=this;return update.call(this,dt);};
 });
 await page.waitForFunction(()=>!!window.reviewEngine,{timeout:30000});
 await page.evaluate(()=>{
  const e=window.reviewEngine;e.stop();
  e.reviewStep=(seconds)=>{
   const render=e.renderLandscape;e.renderLandscape=()=>{};
   try{for(let i=0;i<Math.ceil(seconds*60);i++){e.time+=1/60;e.update(1/60);}}
   finally{e.renderLandscape=render;}
  };
 });
}
(async()=>{
 await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const report={source:'2938133',mode:'Isolated actual browser engine, deterministic stepping and synthetic fixture placement; no product code changes or device-performance claim.',behaviors:[],persistence:{},findings:[]};
 try{
  for(const reducedMotion of ['no-preference','reduce']){
   const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await attach(page,base+'?fresh&tier=standard&shore');
   await page.locator('canvas.world').focus();await page.locator('canvas.world').press('f');
   const result=await page.evaluate(()=>{
    const e=window.reviewEngine;e.reviewStep(5);
    const drawn=e.fishes.find(f=>!f.glow&&!f.ghost&&!f.guest&&f.state==='swimming');
    if(!drawn)throw new Error('Missing drawn fish');
    const S=e.minDim;drawn.moveHeadTo(e.width*.5,e.horizonY-S*.14);
    const sky=e.meteorFish(e.width*.5,1);
    const born={state:sky.state,count:e.companions.length,until:e.companions[0]?.until};
    e.reviewStep(1/60);
    const firstFrame={state:sky.state,count:e.companions.length,until:e.companions[0]?.until};
    e.reviewStep(3);
    const swimming={state:sky.state,count:e.companions.length,timeRemaining:e.companions[0]?.until-e.time,following:!!sky.attract};
    e.time=e.companions[0].until+.01;e.updateCompany();
    const afterExpiry=e.companions.length;
    e.atmosphere.set({...e.atmosphere.state,timeOfDay:'day',weather:'lotus'});e.reviewStep(30);
    const leaf=e.lotus.items.find(it=>it.kind===0&&e.lotus.place(it).y>e.shore.bankHigh);
    const p=e.lotus.place(leaf);drawn.moveHeadTo(p.x,p.y);e.shadeRest.delete(drawn);
    e.applyScene({fish:'rest'});const requested=drawn.restUntil-e.time;e.updateCompany();
    const rest={requested,afterShade:drawn.restUntil-e.time};
    e.atmosphere.moonlit=0;e.atmosphere.dusk=0;e.worldMat.uniforms.uFlash.value.x=1;e.updateMoonlight();
    const lightningTarget=drawn.silverTarget;
    const originalCalm=drawn.calm; // Record actual accessibility mode from Engine, not Fish internals.
    return {calm:e.calm,companion:{born,firstFrame,swimming,afterExpiry},rest,lightningTarget};
   });
   check(result.companion.born.count===1&&result.companion.firstFrame.count===1,'Formation pair lost');
   check(result.companion.firstFrame.until===0,'Company timer began before forming finished');
   check(result.companion.swimming.count===1&&result.companion.swimming.following,'No active company after formation');
   check(result.companion.afterExpiry===0,'Company did not expire');
   check(Math.abs(result.rest.requested-result.rest.afterShade)<1e-6,'Short shade rest cut long request');
   check(result.calm?result.lightningTarget===0:result.lightningTarget>1,'Lightning accessibility or target mismatch');
   check(errors.length===0,'Browser errors: '+errors.join(';'));
   report.behaviors.push({reducedMotion,pageErrors:errors,...result});
   if(reducedMotion==='no-preference'){
    const before=await page.evaluate(async()=>{
     const e=window.reviewEngine;const {Stroke}=await import('/src/engine/stroke.ts');
     const s=new Stroke(e.palette,e.minDim,false);
     for(let i=0;i<12;i++)s.add({x:55+i*9,y:28+i*6,t:i*24,pressure:.5});
     s.finish();e.scene.add(s.mesh);e.placeBranch(s,'mouse');
     const save=e.serialize();localStorage.setItem('wonderlab.world',JSON.stringify(save));
     return save.branches;
    });
    await attach(page,base+'?tier=standard');
    const plain=await page.evaluate(()=>{
     const e=window.reviewEngine;const save=e.serialize();localStorage.setItem('wonderlab.world',JSON.stringify(save));
     return {hasShore:!!e.shore,branches:save.branches};
    });
    check(!plain.hasShore&&JSON.stringify(plain.branches)===JSON.stringify(before),'Plain visit lost branches');
    await attach(page,base+'?tier=standard&shore');
    const restored=await page.evaluate(()=>{
     const e=window.reviewEngine;
     const branches=e.serialize().branches;
     e.restart();const during=e.serialize().branches??[];
     e.undoRestart();const afterUndo=e.serialize().branches;
     e.restart();e.commitRestart();const afterCommit=e.serialize().branches??[];
     return {branches,during,afterUndo,afterCommit};
    });
    check(restored.branches[0].seed===before[0].seed,'Branch seed changed');
    check(JSON.stringify(restored.branches)===JSON.stringify(restored.afterUndo),'Undo restart failed to restore branches');
    check(restored.during.length===0&&restored.afterCommit.length===0,'Restart persisted old branches');
    report.persistence.roundTrip={initialCount:before.length,plainCount:plain.branches.length,restoredCount:restored.branches.length,seedPreserved:true,undoRestored:true,commitCleared:true};
    const limit=await page.evaluate(async()=>{
     const e=window.reviewEngine;const {Stroke}=await import('/src/engine/stroke.ts');const {parseWorld}=await import('/src/engine/persist.ts');
     for(let j=0;j<13;j++){
      const s=new Stroke(e.palette,e.minDim,false);
      for(let i=0;i<8;i++)s.add({x:40+j*2+i*7,y:24+i*5,t:i*24,pressure:.5});
      s.finish();e.scene.add(s.mesh);e.placeBranch(s,'mouse');
     }
     const save=e.serialize();const parsed=parseWorld(save);localStorage.setItem('wonderlab.world',JSON.stringify(save));
     return {runtime:save.branches.length,parsed:parsed.branches.length,lastRuntimeSeed:save.branches.at(-1).seed,lastParsedSeed:parsed.branches.at(-1).seed};
    });
    await attach(page,base+'?tier=standard&shore');
    limit.afterReload=await page.evaluate(()=>window.reviewEngine.serialize().branches?.length??0);
    report.persistence.limit=limit;
    if(limit.runtime!==limit.afterReload)report.findings.push({severity:'P2',title:'Branch 13 and later are discarded on reload',runtime:limit.runtime,reloaded:limit.afterReload});
   }
   await context.close();
  }
 }finally{await browser.close();}
 await fs.writeFile(output+'/report.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 if(report.findings.length)process.exitCode=2;
})().catch(e=>{console.error(e);process.exitCode=1;});
