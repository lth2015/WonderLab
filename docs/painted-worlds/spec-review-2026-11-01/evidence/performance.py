from pathlib import Path
import json,statistics
from playwright.sync_api import sync_playwright,expect
out=Path('/workspace/.cloud-setup/spec-audit');result={}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for world,path,button in [('edo','edo/','絵巻に入る'),('china','qingming/','入画')]:
  trials=[]
  for i in range(3):
   c=b.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True);page=c.new_page();d=c.new_cdp_session(page)
   d.send('Network.enable');d.send('Network.setCacheDisabled',{'cacheDisabled':True});d.send('Network.emulateNetworkConditions',{'offline':False,'latency':100,'downloadThroughput':10_000_000/8,'uploadThroughput':1_000_000/8});d.send('Emulation.setCPUThrottlingRate',{'rate':4})
   page.goto('http://127.0.0.1:5177/'+path,wait_until='networkidle');expect(page.get_by_role('button',name=button,exact=True)).to_be_enabled()
   record=page.evaluate("""async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const rs=performance.getEntriesByType('resource');return {ready_proxy_ms:performance.now(),resource_encoded_bytes:rs.reduce((n,r)=>n+r.encodedBodySize,0),resource_transfer_bytes:rs.reduce((n,r)=>n+r.transferSize,0),resources:rs.map(r=>({path:new URL(r.name).pathname,encoded_bytes:r.encodedBodySize}))}}""")
   trials.append(record);c.close()
  result[world]={'trials':trials,'median_ready_proxy_ms':statistics.median(x['ready_proxy_ms'] for x in trials),'median_resource_encoded_bytes':statistics.median(x['resource_encoded_bytes'] for x in trials)}
 b.close()
result['conditions']={'cache':'disabled; new context each trial','network':'10Mbps down /1Mbps up /100ms latency via CDP','cpu':'4x slowdown','viewport':'390x844@3','runtime':'headless Chromium, GPU disabled','ready_proxy':'networkidle + entry button enabled + two RAF; not measured first interactive instant','server':'local Python static HTTP, no gzip or Brotli; no production CDN/TTFB','navigation_document_bytes':'excluded from resource byte sum'}
(out/'performance.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({w:{k:v for k,v in result[w].items() if k!='trials'} for w in ['edo','china']},ensure_ascii=False,indent=2))
