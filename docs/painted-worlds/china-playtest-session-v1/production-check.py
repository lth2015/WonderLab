from pathlib import Path
import json
from playwright.sync_api import sync_playwright,expect
OUT=Path(__file__).resolve().parent / 'evidence'; NORMAL='ww:qingming-china:save:v1';GAME=NORMAL+':session';LOG='ww:qingming-china:study:session'
errors=[];failed=[];results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for base in ['http://127.0.0.1:5176/','http://127.0.0.1:5177/qingming/']:
  c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
  p.goto(base+'?session=1',wait_until='networkidle');p.get_by_role('button',name='入画',exact=True).tap();expect(p.get_by_text('试玩会',exact=True)).to_be_visible()
  surface=p.locator('.scroll-surface');strip=p.locator('.world-strip');transform=strip.evaluate('(e)=>e.style.transform')
  liu=p.get_by_role('button',name='与小柳交谈',exact=False);box=liu.bounding_box();assert box and 0<box['x']+box['width']/2<390,box
  x=box['x']+box['width']/2;y=box['y']+box['height']/2
  cdp=c.new_cdp_session(p);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
  for n in range(1,13):cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+n*8,'y':y}]})
  cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});p.wait_for_timeout(100)
  assert strip.evaluate('(e)=>e.style.transform')!=transform;assert p.locator('dialog[open]').count()==0
  p.get_by_role('button',name='附近',exact=True).click();p.locator('.nearby-list').get_by_role('button',name='一纸春风',exact=False).click();p.get_by_role('button',name='替他压住画纸',exact=False).click()
  game=p.evaluate('(k)=>localStorage.getItem(k)',GAME);log=p.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',LOG);sid=log['session_id']
  transform=strip.evaluate('(e)=>e.style.transform')
  # Locked surface rejects pointer gestures while the story is open.
  surface.dispatch_event('pointerdown',{'clientX':200,'clientY':350,'button':0,'pointerId':9});surface.dispatch_event('pointermove',{'clientX':80,'clientY':350,'pointerId':9});surface.dispatch_event('pointerup',{'pointerId':9});assert strip.evaluate('(e)=>e.style.transform')==transform
  p.set_viewport_size({'width':844,'height':390});expect(p.get_by_role('button',name='落笔，记下此景',exact=False)).to_be_visible();assert p.evaluate('(k)=>localStorage.getItem(k)',GAME)==game
  p.set_viewport_size({'width':390,'height':844});background=c.new_page();background.goto('about:blank');background.bring_to_front();p.bring_to_front();expect(p.get_by_role('button',name='落笔，记下此景',exact=False)).to_be_visible();assert p.evaluate('(k)=>localStorage.getItem(k)',GAME)==game
  # A fresh page reloads the committed middle step and the same player record.
  fresh=c.new_page();fresh.goto(base+'?session=1',wait_until='networkidle');assert fresh.evaluate('(k)=>localStorage.getItem(k)',GAME)==game;assert fresh.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).session_id',LOG)==sid
  fresh.get_by_role('button',name='附近',exact=True).click();fresh.locator('.nearby-list').get_by_role('button',name='一纸春风',exact=False).click();fresh.get_by_role('button',name='落笔，记下此景',exact=False).click();assert fresh.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).wallet',GAME)==72
  assert fresh.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).events.every(e=>e.environment==="playtest-session")',LOG)
  fresh.goto(base,wait_until='networkidle');expect(fresh.get_by_role('button',name='入画',exact=True)).to_be_visible();assert fresh.get_by_text('试玩会',exact=True).count()==0;assert fresh.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).wallet',NORMAL)==60
  results.append({'base':base,'touch_drag_does_not_open_person':True,'story_locks_world':True,'rotation_keeps_step':True,'background_return_keeps_step':True,'fresh_page_resumes_story_and_player':True,'complete_once_wallet':72,'normal_mode_isolated':True});c.close()
 b.close()
assert not errors,errors
assert not failed,failed
result={'builds':results,'page_errors':errors,'http_errors':failed,'device':'headless Chromium touch emulation; not physical iPhone/Android'}
(OUT/'production-quality.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
