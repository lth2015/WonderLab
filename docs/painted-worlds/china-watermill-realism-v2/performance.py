from pathlib import Path
import json,time
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parent/'evidence';results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for w,h,cpu in [(390,844,4),(1280,800,1)]:
  c=b.new_context(viewport={'width':w,'height':h},is_mobile=w<900,has_touch=w<900);p=c.new_page();cdp=c.new_cdp_session(p);cdp.send('Emulation.setCPUThrottlingRate',{'rate':cpu});bad=[];p.on('pageerror',lambda e:bad.append(str(e)));p.goto('http://127.0.0.1:5177/qingming/?session=1',wait_until='networkidle');p.get_by_role('button',name='入画',exact=True).click();assert p.locator('.watermill').count()==0
  initial=p.evaluate('performance.getEntriesByType("resource").filter(e=>e.name.includes("/watermill/"))');assert not initial
  p.get_by_role('button',name='附近',exact=True).click();p.get_by_text('以文字探索街巷',exact=True).click();p.get_by_role('dialog').get_by_role('button',name='看看水磨',exact=True).click();p.wait_for_selector('.watermill[data-ready=true]');p.wait_for_timeout(650)
  # Continuous genuine pointer drags around the visible mill, sampled by rAF.
  p.evaluate('''window.millFrames=[];window.millStop=false;let last=performance.now();requestAnimationFrame(function frame(t){if(window.millStop)return;window.millFrames.push(t-last);last=t;requestAnimationFrame(frame)})''')
  r=p.locator('.scroll-surface').bounding_box();y=r['y']+r['height']*.8;left=w*.35;right=w*.65;p.mouse.move(left,y);p.mouse.down();started=time.monotonic()
  for n in range(320):
   phase=n%80;pos=left+(right-left)*(phase/40 if phase<=40 else (80-phase)/40);p.mouse.move(pos,y);p.wait_for_timeout(12)
  p.mouse.up();elapsed=time.monotonic()-started;frames=p.evaluate('window.millStop=true;window.millFrames').copy();frames=sorted(frames[5:]);p95=frames[int((len(frames)-1)*.95)];median=frames[len(frames)//2]
  assert p95<=34,(w,p95)
  assert not bad,bad
  results.append({'width':w,'cpu_throttle':cpu,'duration_s':round(elapsed,2),'frames':len(frames),'median_ms':round(median,2),'p95_ms':round(p95,2),'max_ms':round(max(frames),2),'no_initial_mill_requests':True,'page_errors':bad});c.close()
 b.close()
result={'local_production_drag':results,'limitation':'Headless Chromium in a cloud executor; not physical phone performance or live deployment proof.'};(OUT/'performance.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
