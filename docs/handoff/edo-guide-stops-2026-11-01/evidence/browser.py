from pathlib import Path
import json
from playwright.sync_api import sync_playwright,expect
OUT=Path('/workspace/.cloud-setup/review152');stops=json.loads(Path('/workspace/.cloud-setup/edo-guide-stops.json').read_text());errors=[];results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for width in [360,390]:
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True,accept_downloads=True);p=c.new_page();p.set_default_timeout(10000);p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto('http://127.0.0.1:5180/edo/',wait_until='domcontentloaded');p.get_by_role('button',name='絵巻に入る',exact=True).click();p.get_by_role('button',name='設定',exact=True).click();p.get_by_role('button',name='もっと大きく',exact=True).click();p.get_by_role('checkbox',name='動きを減らす',exact=True).check();p.get_by_role('button',name='町に戻る',exact=True).click()
  original=p.evaluate("localStorage.getItem('ww:qingming-edo:save')")
  for i,s in enumerate(stops):
   p.get_by_role('button',name='近くのこと',exact=True).click();p.get_by_text('通りの案内',exact=True).click();nav=p.get_by_role('navigation',name='通りの案内');assert nav.get_by_role('button').count()==len(stops)
   assert nav.evaluate('(e)=>e.scrollWidth<=e.clientWidth');assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
   if i==0:p.screenshot(path=str(OUT/f'guide-{width}-large.png'))
   button=nav.get_by_role('button',name=s['name']+' '+s['note'],exact=True);button.focus();button.press('Enter')
   p.wait_for_function("document.activeElement?.classList.contains('street')");assert p.get_by_role('dialog').count()==0
   cam=p.locator('.street').evaluate('(e)=>+e.dataset.cam+e.clientWidth/(+e.dataset.scale)/2');assert abs(cam-s['x'])<1,(s,cam)
   assert p.evaluate("localStorage.getItem('ww:qingming-edo:save')")==original
   if s['id'] in ['bridge','cooper','dye','end']:
    p.wait_for_timeout(200);p.screenshot(path=str(OUT/(str(width)+'-'+s['id']+'.png')))
  before=p.locator('.street').get_attribute('data-cam');p.keyboard.press('ArrowRight');assert p.locator('.street').get_attribute('data-cam')!=before
  p.get_by_role('button',name='設定',exact=True).click();p.get_by_text('この回の試遊の記録とプライバシー',exact=True).click()
  with p.expect_download() as e:p.get_by_role('button',name='この回の試遊の記録を書き出す',exact=True).click()
  path=OUT/f'events-{width}.json';e.value.save_as(str(path));events=json.loads(path.read_text())
  results.append({'width':width,'text_percent':150,'keyboard_all_stops':True,'camera_centres_match':True,'street_focus_returned':True,'dialog_closes':True,'save_unchanged':True,'event_types':sorted(set(e['type'] for e in events['events']))});c.close()
 b.close()
assert not errors,errors
result={'checks':results,'page_errors':errors,'stops':stops}
(OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({'checks':results,'page_errors':errors},ensure_ascii=False,indent=2))
