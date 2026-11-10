const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {stripTypeScriptTypes} = require('node:module');
const vm = require('node:vm');
const repo='/workspace/WonderLab';
const results=[];
async function check(ref, expectedFixed) {
 const source=execFileSync('git',['show',ref+':apps/qingming-edo/src/engine/sound.ts'],{cwd:repo,encoding:'utf8'});
 function fresh() {
  const events={};
  class Param {
   constructor(){this.value=1;this.calls=[];}
   setTargetAtTime(...args){this.calls.push(args);}
   setValueAtTime(...args){this.calls.push(args);}
   linearRampToValueAtTime(){} exponentialRampToValueAtTime(){}
  }
  class Node {
   constructor(ctx){this.ctx=ctx;for(const k of ['gain','frequency','Q','pan','detune','threshold','ratio'])this[k]=new Param();}
   connect(to){return to;}
   start(){this.ctx.starts.push(this.ctx.gains.slice(1,4).map(n=>n.gain.value));}
   stop(){}
  }
  class Context {
   static made=[];
   constructor(){Context.made.push(this);this.state='running';this.currentTime=0;this.sampleRate=32;this.gains=[];this.starts=[];this.destination=new Node(this);this.resumeCalls=0;this.suspendCalls=0;this.reject=false;}
   createGain(){const n=new Node(this);this.gains.push(n);return n;}
   createDynamicsCompressor(){return new Node(this);}
   createBiquadFilter(){return new Node(this);}
   createOscillator(){return new Node(this);}
   createBufferSource(){return new Node(this);}
   createStereoPanner(){return new Node(this);}
   createBuffer(c,n){return {getChannelData:()=>new Float32Array(n)};}
   resume(){this.resumeCalls++;return this.reject?Promise.reject(new Error('NotAllowedError')):Promise.resolve();}
   suspend(){this.suspendCalls++;return this.reject?Promise.reject(new Error('refused')):Promise.resolve();}
  }
  const document={hidden:false,addEventListener:(type,fn)=>events[type]=fn};
  const sandbox={window:{AudioContext:Context,setTimeout:()=>0},navigator:{},document};
  vm.createContext(sandbox);
  const js=stripTypeScriptTypes(source).replace(/^export /gm,'');
  vm.runInContext(js+'\nglobalThis.result={sound,Context:null};',sandbox);
  return {sound:sandbox.result.sound,Context,document,events};
 }
 let f=fresh();f.sound.setLevels({ambient:0,ui:0,music:0});
 assert.equal(f.Context.made.length,0,'no AudioContext before gesture');
 f.sound.cue('tap');assert.equal(f.Context.made.length,0);
 f.sound.unlock();const c=f.Context.made[0];
 const initial=c.gains.slice(1,4).map(n=>n.gain.value);
 assert.deepEqual(initial,expectedFixed?[0,0,0]:[1,1,1]);
 if(expectedFixed)assert(c.starts.every(g=>g.every(v=>v===0)),'all starts see muted buses');
 for(let i=0;i<6;i++)f.sound.unlock();
 assert.equal(f.Context.made.length,1,'repeated gestures reuse one context');
 assert.equal(c.resumeCalls,0,'running context does not resume again');
 c.state='interrupted';f.sound.unlock();assert.equal(c.resumeCalls,expectedFixed?1:0);
 if(expectedFixed){
  c.onstatechange();assert.equal(c.resumeCalls,2);
  f.document.hidden=true;f.sound.unlock();c.onstatechange();assert.equal(c.resumeCalls,2,'hidden context must not resume');
  f.events.visibilitychange();assert.equal(c.suspendCalls,1);
  f.document.hidden=false;c.reject=true;
  f.events.visibilitychange();await new Promise(r=>setImmediate(r));
  assert.equal(c.resumeCalls,3,'visibility return retries');
  f.sound.unlock();await new Promise(r=>setImmediate(r));assert.equal(c.resumeCalls,4,'gesture retries after rejection');
  c.reject=false;c.state='closed';f.sound.unlock();assert.equal(c.resumeCalls,4,'closed context not resumed');
  f=fresh();f.sound.setLevels({ambient:1,ui:.6,music:.35});f.sound.unlock();
  assert.deepEqual(f.Context.made[0].gains.slice(1,4).map(n=>n.gain.value),[1,.36,.35**2]);
 }
 results.push({ref,initial,expectedFixed,pass:true});
}
(async()=>{
 await check('1a5c737370326408d634ea64317b71a9f1c8ef01',false);
 await check('afe15146c222a8325928ff9f9fc73825543ad92c',true);
 await check('e1a5ba538d911a83eec67a2cf158a2879dcec6eb',true);
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});

