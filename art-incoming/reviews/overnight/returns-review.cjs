const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5215/?fresh&tier=standard',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{
   const {Engine}=await import('/src/engine/engine.ts');const update=Engine.prototype.update;
   Engine.prototype.update=function(dt){window.reviewEngine=this;return update.call(this,dt);};
  });
  await page.waitForFunction(()=>!!window.reviewEngine);
  const result=await page.evaluate(async()=>{
   const e=window.reviewEngine;e.stop();const {Stroke}=await import('/src/engine/stroke.ts');
   const drawLandscape=e.renderLandscape;e.renderLandscape=()=>{};
   const step=(seconds)=>{for(let k=0;k<seconds*60;k++){e.time+=1/60;e.update(1/60);}};
   for(let j=0;j<9;j++){
    const s=new Stroke(e.palette,e.minDim,false);
    for(let i=0;i<11;i++)s.add({x:55+j*6+i*7,y:160+j*6+Math.sin(i/10*Math.PI)*6,t:i*24,pressure:.5});
    s.finish();e.scene.add(s.mesh);e.resolveStroke(s,'mouse');
   }
   // Creation intentionally queues birth appearances; wait for every synthetic stroke to arrive.
   step(25);
   const current=()=>e.fishes.filter(f=>!f.ghost&&!f.guest&&!f.hidden&&f.state!=='leaving');
   const allSeeds=()=>[...current().map(f=>f.seed),...e.away.map(f=>f.seed)].sort((a,b)=>a-b);
   const before={current:current().length,away:e.away.length,honmei:current().find(f=>f.honmei)?.seed,seeds:allSeeds()};
   e.nextReturn=e.time-1;e.input={};e.updateReturns();
   const drawingProtected=JSON.stringify(before.seeds)===JSON.stringify(allSeeds())&&current().length===before.current;
   e.input=null;e.lastInput=e.time;e.nextReturn=e.time-1;e.updateReturns();
   const idleProtected=JSON.stringify(before.seeds)===JSON.stringify(allSeeds())&&e.away.length===before.away;
   const oldAway=e.away[0]?.seed;
   e.time+=21;e.nextReturn=e.time-1;e.updateReturns();
   const firstReturn={current:current().length,away:e.away.length,oldFishCameBack:current().some(f=>f.seed===oldAway),honmeiStillHere:current().some(f=>f.honmei&&f.seed===before.honmei),allSeedsPreserved:JSON.stringify(before.seeds)===JSON.stringify(allSeeds())};
   const leaving=e.fishes.find(f=>f.state==='leaving');
   const departure=leaving?{y:leaving.headY,farWater:e.horizonY-e.minDim*.08,opacity:leaving.opacity}:null;
   step(3);
   const rounds=[];
   for(let i=0;i<8;i++){
    e.time+=131;e.nextReturn=e.time-1;e.lastInput=e.time-30;e.updateReturns();step(3);
    rounds.push({current:current().length,away:e.away.length,honmeiStillHere:current().some(f=>f.honmei&&f.seed===before.honmei),allSeedsPreserved:JSON.stringify(before.seeds)===JSON.stringify(allSeeds())});
   }
   e.renderLandscape=drawLandscape;
   return {initial:{current:before.current,away:before.away,total:before.seeds.length},drawingProtected,idleProtected,firstReturn,departure,rounds};
  });
  const report={source:'2938133',method:'Actual browser engine with synthetic strokes, direct scheduled-return trigger and deterministic stepping; does not validate perceived departure animation or phone performance.',pageErrors:errors,result};
  await fs.writeFile('/workspace/.wonderlab-tools/overnight-review-results/returns-report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(errors.length||result.initial.current!==8||result.initial.away!==1||!result.drawingProtected||!result.idleProtected||!result.firstReturn.oldFishCameBack||!result.rounds.every(r=>r.current===8&&r.away===1&&r.honmeiStillHere&&r.allSeedsPreserved))process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
