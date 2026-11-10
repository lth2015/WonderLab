const { chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');

async function main() {
  const output='/workspace/.wonderlab-tools/pr93-review';
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  const results=[];
  try {
    for (const reducedMotion of ['no-preference','reduce']) {
      const context=await browser.newContext({viewport:{width:960,height:640},deviceScaleFactor:1,reducedMotion});
      const page=await context.newPage();
      const pageErrors=[];
      page.on('pageerror',e=>pageErrors.push(e.message));
      await page.goto('http://127.0.0.1:5213/?fresh&tier=standard',{waitUntil:'networkidle',timeout:45000});
      await page.evaluate(async()=>{
        const {Engine}=await import('/src/engine/engine.ts');
        const update=Engine.prototype.update;
        Engine.prototype.update=function(dt){window.reviewEngine=this;return update.call(this,dt);};
      });
      await page.waitForFunction(()=>!!window.reviewEngine,{timeout:30000});
      await page.evaluate(()=>window.reviewEngine.stop());
      await page.locator('canvas.world').focus();
      await page.locator('canvas.world').press('f');
      const result=await page.evaluate(()=>{
        const e=window.reviewEngine;
        const renderLandscape=e.renderLandscape;
        e.renderLandscape=()=>{};
        const step=(seconds)=>{for(let i=0;i<seconds*60;i++){e.time+=1/60;e.update(1/60);}};
        step(5);
        const drawn=e.fishes.find(f=>!f.glow&&!f.ghost&&!f.guest&&f.state==='swimming');
        if(!drawn)throw new Error('Missing drawn fish');
        const S=e.minDim;
        drawn.moveHeadTo(e.width*0.5,e.horizonY-S*0.14);
        const sky=e.meteorFish(e.width*0.5,1);
        const before={skyState:sky.state,companionCount:e.companions.length};
        step(1/60);
        const afterOneFrame={skyState:sky.state,companionCount:e.companions.length};
        step(3);
        const afterFormation={skyState:sky.state,companionCount:e.companions.length};
        // Other checks exercise the existing methods on the actual engine; placement is a fixture.
        e.atmosphere.set({...e.atmosphere.state,timeOfDay:'dusk',weather:'clear'});
        step(25);
        drawn.moveHeadTo(e.width*.76,e.horizonY-S*.12);
        e.updateMoonlight();
        const goldInPath=drawn.silverTarget;
        drawn.moveHeadTo(e.width*.05,e.horizonY-S*.12);
        e.updateMoonlight();
        const goldOutside=drawn.silverTarget;
        const lightPref={seed:drawn.seed,value:drawn.lightPref,savedSeed:e.serialize().fish.find(f=>f.seed===drawn.seed)?.seed};
        e.atmosphere.set({...e.atmosphere.state,timeOfDay:'day',weather:'lotus'});
        step(30);
        const leaf=e.lotus.items.find(it=>it.kind===0);
        const p=e.lotus.place(leaf);
        e.shadeRest.delete(drawn);
        drawn.moveHeadTo(p.x,p.y);
        e.updateCompany();
        const firstRest=drawn.restUntil;
        const leafShade={inside:e.lotus.shadeAt(p.x,p.y),outside:e.lotus.shadeAt(e.width*.5,e.horizonY-S*.4),
          restFor:firstRest-e.time,cooldown:e.shadeRest.get(drawn)-e.time};
        e.updateCompany();
        leafShade.samePassDidNotExtendRest=drawn.restUntil===firstRest;
        e.atmosphere.set({...e.atmosphere.state,timeOfDay:'night',weather:'lanterns'});
        step(25);
        const l=e.lanterns.lamps.find(l=>l.kind===0);
        if(!l)throw new Error('Missing river lamp');
        l.stir=0;
        const first=e.lanterns.stirAt(l.x,l.y,S*.05);
        const second=e.lanterns.stirAt(l.x,l.y,S*.05);
        const lantern={first,second,stir:l.stir};
        e.lanterns.update(.5,e.time+.5,1,{width:e.width,height:e.height,horizonY:e.horizonY,S},e.calm);
        lantern.afterHalfSecond=l.stir;
        e.renderLandscape=renderLandscape;
        e.renderLandscape();
        e.renderer.render(e.scene,e.camera);
        return {calm:e.calm,companion:{before,afterOneFrame,afterFormation},gold:{inside:goldInPath,outside:goldOutside},lightPref,leafShade,lantern};
      });
      results.push({reducedMotion,pageErrors,...result});
      await context.close();
    }
  } finally {await browser.close();}
  const report={source:'bda3711 (PR #93, implementation 2bec39a)',
    method:'Actual browser engine with deterministic 1/60 second updates and fixture placement; production files unchanged. Runtime reproduction, not real-device performance validation.',results};
  await fs.writeFile(output+'/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(results.some(r=>r.pageErrors.length))throw new Error('Browser runtime error');
  if(!results.every(r=>r.companion.before.companionCount===1 && r.companion.afterOneFrame.companionCount===0 && r.companion.afterFormation.skyState==='swimming'))throw new Error('Companion reproduction was inconclusive');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
