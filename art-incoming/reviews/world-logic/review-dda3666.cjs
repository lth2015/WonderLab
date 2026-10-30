const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises');
const out='/workspace/.wonderlab-tools/world-logic-results-dda3666';
const source='dda3666';
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5221/?fresh&shore=willow&tier=standard',{waitUntil:'networkidle',timeout:45000});
  await page.evaluate(async()=>{const {Engine}=await import('/src/engine/engine.ts');const original=Engine.prototype.update;Engine.prototype.update=function(dt){window.reviewEngine=this;return original.call(this,dt)};});
  await page.waitForFunction(()=>!!window.reviewEngine);
  await page.evaluate(()=>{
   const e=window.reviewEngine;e.stop();
   e.reviewStep=seconds=>{const render=e.renderLandscape;e.renderLandscape=()=>{};try{for(let i=0;i<Math.ceil(seconds*60);i++){e.time+=1/60;e.update(1/60)}}finally{e.renderLandscape=render}};
   e.reviewRender=()=>{e.renderLandscape();e.renderer.render(e.scene,e.camera)};
  });
  const report=await page.evaluate(async()=>{
   const e=window.reviewEngine;
   const {Stroke}=await import('/src/engine/stroke.ts');
   const {classify}=await import('/src/engine/classify.ts');
   const {interpret}=await import('/src/engine/intent.ts');
   const {SCENES}=await import('/src/scenes.ts');
   const {nightSkyShows,audit}=await import('/src/engine/world-rules.ts');
   const set=(time,weather)=>{e.atmosphere.set({...e.atmosphere.state,timeOfDay:time,weather});e.reviewStep(40)};
   const circle=(x,y)=>{const s=new Stroke(e.palette,e.minDim,false);for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;s.add({x:x+22*Math.cos(a),y:y+22*Math.sin(a),t:i*12,pressure:.5})}s.finish();e.scene.add(s.mesh);const c=classify(s.points);return {s,c}};
   e.sky.clear?.();
   set('day','clear');e.sky.setMoon(null);e.reviewStep(2);
   let q=circle(90,e.horizonY+140);e.leadMoon(q.c,q.s,false);e.reviewStep(3);
   q=circle(240,e.horizonY+160);e.leadMoon(q.c,q.s,false);e.reviewStep(3);
   const daySequential={moon:!!e.sky.moonSpec,planets:e.sky.seen().planets,clouds:e.sky.snapshot().clouds.length};
   e.sky.setMoon(null);e.reviewStep(2);e.leadUntil=e.time+5;
   const cloudBefore=e.sky.snapshot().clouds.length;
   for(const x of [90,240]){q=circle(x,e.horizonY+170);e.leadMoon(q.c,q.s,false)}
   const queuedBefore=e.leadQueue.length;e.reviewStep(12);
   const dayQueued={queuedBefore,moon:!!e.sky.moonSpec,planets:e.sky.seen().planets,cloudsAdded:e.sky.snapshot().clouds.length-cloudBefore};
   set('night','galaxy');e.applyScene({timeOfDay:'day'});e.reviewStep(35);
   const galaxyByDay={state:{...e.atmosphere.state},day:e.atmosphere.day,galaxy:e.atmosphere.galaxy,uGalaxy:e.worldMat.uniforms.uGalaxy.value,nightVisibility:nightSkyShows(e.atmosphere.day),audit:audit({light:e.light,day:e.atmosphere.day,bodies:e.sky.moonSpec?1:0,settingSun:e.atmosphere.dusk>=.5,...e.sky.seen()})};
   set('day','clear');e.applyScene(interpret('萤火虫飞起来吧').command);e.reviewStep(35);
   const firefliesByDay={state:{...e.atmosphere.state},day:e.atmosphere.day,fireflies:e.atmosphere.fireflies,uFireflies:e.weatherMat.uniforms.uFireflies.value};
   set('day','lotus');const played=[];e.setSound({play:(kind,opts)=>played.push({kind,t:e.time,snow:e.atmosphere.snow,weather:e.weather,opts}),ambient:levels=>{e.reviewAmbient={...levels}}});
   e.calls=[];e.gustHeard=true;e.gust.k=0;e.updateCalls(e.time,e.atmosphere);
   const queuedCicadas=e.calls.map(c=>({kind:c.kind,delay:c.at-e.time}));
   e.applyScene({weather:'snow'});e.reviewStep(12);
   const soundsAfterSnow={queuedCicadas,played:played.filter(c=>c.kind==='cicada'||c.kind==='frog'),ambient:e.reviewAmbient};
   const scenes=SCENES.map(s=>{const c=interpret(s.line).command;return {id:s.id,name:s.name,season:s.season,declaredTime:s.time??null,command:c,effectiveTime:c.timeOfDay??s.time??'inherited',weatherMatches:c.weather===s.weather}});
   const {Willow}=await import('/src/engine/willow.ts');
   const summary=w=>{w.update(0,1/60,.25,{day:1,dusk:0},false,()=>{});return {strands:w.strands.length,maxLength:Math.max(...w.strands.map(s=>s.len)),tipsBelowHorizon:w.strands.filter((s,i)=>{const p=(i*21+20)*6;return (w.ribbonPos[p+1]+w.ribbonPos[p+4])/2<464.2}).length}};
   const fresh=new Willow();fresh.resize(390,844,464.2,390);const resized=new Willow();resized.resize(1440,900,450,900);resized.resize(390,844,464.2,390);const resize={fresh:summary(fresh),resized:summary(resized)};fresh.dispose();resized.dispose();
   e.setSound(null);set('day','clear');e.reviewRender();
   return {daySequential,dayQueued,galaxyByDay,firefliesByDay,soundsAfterSnow,scenes,resize};
  });
  await page.evaluate(()=>{const e=window.reviewEngine;e.atmosphere.set({...e.atmosphere.state,timeOfDay:'day',weather:'galaxy'});e.reviewStep(40);e.reviewRender()});
  await page.screenshot({path:out+'/galaxy-day.png'});
  await page.evaluate(()=>{const e=window.reviewEngine;e.worldMat.uniforms.uGalaxy.value=0;e.renderer.render(e.scene,e.camera)});
  await page.screenshot({path:out+'/galaxy-day-layer-disabled.png'});
  const result={source,method:'Actual engine in isolated source archive; synthetic strokes and direct public scene commands; deterministic stepping; no physical-device performance or sound audition claim.',pageErrors:errors,...report};
  await fs.writeFile(out+'/report.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
