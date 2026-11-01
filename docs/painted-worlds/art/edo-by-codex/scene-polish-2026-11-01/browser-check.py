from pathlib import Path
import json
from playwright.sync_api import sync_playwright
out=Path('/workspace/.cloud-setup/edo-polish')
errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 def go(page,center):
  page.locator('.street').evaluate("""(el,center)=>{const s=+el.dataset.scale;const target=center-el.clientWidth/s/2;el.dispatchEvent(new WheelEvent('wheel',{deltaX:(target-(+el.dataset.cam))*s,bubbles:true}));}""",center)
  page.wait_for_timeout(160)
 for label,width,height,mobile in [('desktop',1280,900,False),('mobile',390,844,True)]:
  ctx=b.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile)
  page=ctx.new_page();page.set_default_timeout(10000)
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:5180/edo/',wait_until='domcontentloaded')
  page.evaluate("""async()=>{const {newSave}=await import('/edo/src/engine/state.ts');const {SAVE_KEY}=await import('/edo/src/engine/save.ts');const s=newSave();s.settings={...s.settings,reduceMotion:true,sound:{ambient:0,ui:0,music:0}};localStorage.setItem(SAVE_KEY,JSON.stringify(s));}""")
  page.reload(wait_until='domcontentloaded')
  page.get_by_role('button',name='絵巻に入る',exact=True).click()
  go(page,1000)
  page.screenshot(path=str(out/('canal-'+label+'.png')))
  page.get_by_role('button',name='近くで見る',exact=True).click()
  go(page,1000)
  page.screenshot(path=str(out/('canal-'+label+'-close.png')))
  page.get_by_role('button',name='もとに戻す',exact=True).click()
  if not mobile:
   for index in range(1,14):
    go(page,index*1000)
    page.locator('.stage').screenshot(path=str(out/('join-'+str(index)+'.png')))
  # All crowd identities unique in the actual imported world, not just visible tiles.
  crowd=page.evaluate("async()=> (await import('/edo/src/scene/painted.tsx')).CROWD")
  assert len(crowd)==8 and len({c['id'] for c in crowd})==8
  page.get_by_role('button',name='近くのこと',exact=True).click()
  assert page.locator('[role=dialog]').count()>0
  ctx.close()
 # Bell regression and a native running-context zero output after mute.
 ctx=b.new_context();page=ctx.new_page();page.set_default_timeout(10000)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("""const Native=AudioContext;window.audioContexts=[];window.AudioContext=class extends Native{constructor(...a){super(...a);const e={ctx:this,analyser:null};window.audioContexts.push(e);const create=this.createDynamicsCompressor.bind(this);this.createDynamicsCompressor=()=>{const c=create();e.analyser=this.createAnalyser();c.connect(e.analyser);return c;};}}""")
 page.goto('http://127.0.0.1:5180/edo/',wait_until='domcontentloaded')
 page.evaluate("""async()=>{const {newSave}=await import('/edo/src/engine/state.ts');const {SAVE_KEY}=await import('/edo/src/engine/save.ts');const s=newSave();s.progress.quests={kaze:'complete',dougu:'complete',tenugui:'complete'};s.settings.sound={ambient:.6,ui:0,music:0};localStorage.setItem(SAVE_KEY,JSON.stringify(s));}""")
 page.reload(wait_until='domcontentloaded');page.locator('header button.time').wait_for()
 assert page.evaluate('audioContexts.length')==0
 page.evaluate("""async()=>{const {sound}=await import('/edo/src/engine/sound.ts');window.bellCalls=[];const f=sound.timeBell.bind(sound);sound.timeBell=()=>{const result=f();bellCalls.push(result);return result;};}""")
 for name in ['朝','昼','朝','夕','朝']:
  page.locator('header button.time').click();page.get_by_role('menuitemradio',name=name,exact=True).click()
 assert page.evaluate('bellCalls')==[True,True]
 assert page.evaluate('audioContexts.length')==1
 peak=page.evaluate("""async()=>{const {sound}=await import('/edo/src/engine/sound.ts');sound.setLevels({ambient:0,ui:0,music:0});await new Promise(r=>setTimeout(r,60));const a=audioContexts[0].analyser, data=new Float32Array(a.fftSize);let peak=0;for(let i=0;i<20;i++){a.getFloatTimeDomainData(data);for(const v of data)peak=Math.max(peak,Math.abs(v));await new Promise(r=>setTimeout(r,10));}return peak;}""")
 assert peak==0,peak
 ctx.close();b.close()
assert not errors,errors
result={'crowd_count':8,'unique_silhouettes':8,'joins_loaded':13,'desktop_and_mobile_zoom':True,'bell_sequence':[True,True],'mute_peak':peak,'page_errors':errors}
(out/'browser-result.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))

