const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises');
const out='/workspace/.wonderlab-tools/sky-magpie-aecb408';
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5221/?fresh&shore=willow&tier=standard',{waitUntil:'networkidle',timeout:45000});
  await page.evaluate(async()=>{const {Engine}=await import('/src/engine/engine.ts');const u=Engine.prototype.update;Engine.prototype.update=function(dt){window.reviewEngine=this;return u.call(this,dt)}});await page.waitForFunction(()=>!!window.reviewEngine);
  await page.evaluate(()=>{const e=window.reviewEngine;e.stop();e.reviewStep=s=>{const f=e.renderLandscape;e.renderLandscape=()=>{};try{for(let i=0;i<Math.ceil(s*60);i++){e.time+=1/60;e.update(1/60)}}finally{e.renderLandscape=f}};e.reviewRender=()=>{e.renderLandscape();e.renderer.render(e.scene,e.camera)}});
  const sky=await page.evaluate(async()=>{
   const e=window.reviewEngine;const {Stroke}=await import('/src/engine/stroke.ts');const {nightSkyShows}=await import('/src/engine/world-rules.ts');
   e.sky.clear();e.atmosphere.set({...e.atmosphere.state,timeOfDay:'night',weather:'clear'});e.reviewStep(35);
   for(let i=0;i<6;i++)e.keyAction('moon');e.reviewStep(25);
   const night={moon:!!e.sky.moonSpec,planets:e.sky.seen().planets,queue:e.leadQueue.length,visibleMoon:e.sky.uniforms.uMoon.value.w};
   const dot=(x,y)=>{const s=new Stroke(e.palette,e.minDim,false);s.add({x,y,t:0,pressure:.5});s.add({x:x+1,y:y+1,t:50,pressure:.5});s.finish();e.scene.add(s.mesh);e.resolveStroke(s,'mouse')};
   dot(30,e.height-55);const nightStars=e.sky.seen().stars;
   const source=e.serialize();e.applyScene({timeOfDay:'day'});e.reviewStep(35);
   const before=e.sky.seen().stars;dot(50,e.height-45);const after=e.sky.seen().stars;
   const day={storedMoon:!!e.sky.moonSpec,storedPlanets:e.sky.seen().planets,nightVisibility:nightSkyShows(e.atmosphere.day),starsBefore:before,starsAfter:after,moonRecordSame:JSON.stringify(e.serialize().moon)===JSON.stringify(source.moon)};
   return {night,nightStars,day};
  });
  await page.locator('canvas.world').focus();await page.locator('canvas.world').press('f');
  await page.evaluate(()=>{const e=window.reviewEngine;e.reviewStep(4);e.atmosphere.set({...e.atmosphere.state,timeOfDay:'day',weather:'clear'});e.reviewStep(30)});
  const flight=await page.evaluate(async()=>{
   const e=window.reviewEngine;const m=e.shore.willow.magpie;const Vector3=m.mesh.position.constructor;const previousRandom=Math.random;Math.random=()=>.5;
   const takeoff=m.onTakeoff,land=m.onLand;let takeoffs=0,landings=0;m.onTakeoff=(...args)=>{takeoffs++;takeoff(...args)};m.onLand=(...args)=>{landings++;land(...args)};
   try{
    m.phase='perched';m.flight=null;m.until=e.time+999;m.startle(e.time,0);
    const phases=[],poses=new Set(),sizes=[],anchors=[];let last=null;
    for(let i=0;i<105*60;i++){
     e.reviewStep(1/60);
     if(m.phase!==last){phases.push({at:i/60,phase:m.phase});last=m.phase}
     if(m.mesh.visible){poses.add(m.mat.uniforms.uPose.value);sizes.push(m.mesh.scale.x);if(i%30===0){const flip=m.mat.uniforms.uFlip.value>.5;const pos=m.mesh.geometry.getAttribute('position');let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(let j=0;j<pos.count;j++){minX=Math.min(minX,pos.getX(j));maxX=Math.max(maxX,pos.getX(j));minY=Math.min(minY,pos.getY(j));maxY=Math.max(maxY,pos.getY(j))}const uvX=flip?1-.37:.37;const uvY=1-.51;m.mesh.updateMatrixWorld(true);const body=new Vector3(minX+(maxX-minX)*uvX,minY+(maxY-minY)*uvY,0).applyMatrix4(m.mesh.matrixWorld);anchors.push({phase:m.phase,frameSize:m.mesh.scale.x,offsetX:body.x-m.mesh.position.x,offsetY:body.y-m.mesh.position.y,distance:body.distanceTo(m.mesh.position)})}}
    }
    const normal={phases,takeoffs,landings,poses:[...poses],minFrame:Math.min(...sizes),maxFrame:Math.max(...sizes),anchors};
    m.phase='perched';m.flight=null;m.until=e.time+999;e.setReducedMotion(true);m.startle(e.time,0);e.reviewStep(3);const calm={phase:m.phase,visible:m.mesh.visible};e.setReducedMotion(false);return {normal,calm};
   }finally{Math.random=previousRandom;m.onTakeoff=takeoff;m.onLand=land}
  });
  const result={source:'aecb408',method:'Actual engine and Magpie state/uniforms, deterministic stepping; source UV anchor is the supplied approximate body anchor. Not a perceptual smoothness or device performance claim.',errors,sky,flight};
  await fs.writeFile(out+'/report.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({source:result.source,errors,sky,flight:{phases:flight.normal.phases,takeoffs:flight.normal.takeoffs,landings:flight.normal.landings,poses:flight.normal.poses,minFrame:flight.normal.minFrame,maxFrame:flight.normal.maxFrame,calm:flight.calm,leavingMaxAnchor:Math.max(...flight.normal.anchors.filter(a=>a.phase==='leaving').map(a=>a.distance)),returningMaxAnchor:Math.max(...flight.normal.anchors.filter(a=>a.phase==='returning').map(a=>a.distance))}},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
