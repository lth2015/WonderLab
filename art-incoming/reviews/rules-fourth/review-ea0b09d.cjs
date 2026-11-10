const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const fs=require('node:fs/promises');
const out='/workspace/.wonderlab-tools/rules-third-ea0b09d';
(async()=>{await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5221/?fresh&shore&tier=standard',{waitUntil:'networkidle',timeout:45000});await page.evaluate(async()=>{const {Engine}=await import('/src/engine/engine.ts');const u=Engine.prototype.update;Engine.prototype.update=function(dt){window.reviewEngine=this;return u.call(this,dt)}});await page.waitForFunction(()=>!!window.reviewEngine);
 const result=await page.evaluate(async()=>{
  const e=window.reviewEngine;e.stop();e.reviewStep=s=>{const f=e.renderLandscape;e.renderLandscape=()=>{};try{for(let i=0;i<Math.ceil(s*60);i++){e.time+=1/60;e.update(1/60)}}finally{e.renderLandscape=f}};
  const {Stroke}=await import('/src/engine/stroke.ts');const {Voices}=await import('/src/sound.ts');const played=[];let ambient;
  e.setSound({play:(kind,opts)=>played.push({kind,opts}),ambient:v=>ambient={...v}});
  const add=j=>{const s=new Stroke(e.palette,e.minDim,false);for(let i=0;i<8;i++)s.add({x:30+j*4+i*7,y:24+i*5,t:i*24,pressure:.5});s.finish();e.scene.add(s.mesh);e.placeBranch(s,'mouse')};
  for(let i=0;i<12;i++)add(i);const before=e.serialize().branches;add(12);e.undo();const once=e.serialize().branches;const sequence=[{step:0,count:once.length}];for(let i=0;i<12;i++){e.undo();sequence.push({step:i+1,count:e.serialize().branches?.length??0})}
  const branches={singleUndoRestores:JSON.stringify(before)===JSON.stringify(once),beforeCount:before.length,afterSingleCount:once.length,undoOriginals:sequence,afterAll:e.serialize().branches??[]};
  const state=(time,weather)=>{e.atmosphere.set({...e.atmosphere.state,timeOfDay:time,weather});e.reviewStep(40)};
  state('night','rainbow');const nightRainbow=e.worldMat.uniforms.uRainbow.value;state('day','rainbow');const dayRainbow=e.worldMat.uniforms.uRainbow.value;
  const ctx=new OfflineAudioContext(2,48000,48000);const v=new Voices(ctx);const values=[];const g=v.insectGain.gain;const original=g.setTargetAtTime.bind(g);g.setTargetAtTime=(value,...args)=>{values.push(value);return original(value,...args)};
  for(const time of ['day','night','dusk']){state(time,'clear');v.ambient(ambient,0)}
  const cicadas=[];for(const calm of [false,true]){e.setReducedMotion(calm);state('night','fireflies');e.calls=[];played.length=0;e.sceneMoment('cicada');e.reviewStep(12);cicadas.push({calm,events:played.filter(p=>p.kind==='cicada').length})}
  return {branches,rainbow:{night:nightRainbow,day:dayRainbow},ambient:{labels:['day','night','dusk'],insectTargets:values},cicadas};
 });const report={source:'ea0b09d',method:'Actual engine/Voices with synthetic branch creation and direct scene moment; full undo sequence checked, no sound audition claim.',errors,...result};await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
