"""C4 end-to-end checks; Python Playwright + system Chromium, against a served production build."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import argparse,json
args=argparse.ArgumentParser();args.add_argument('--url',default='http://127.0.0.1:5205/');args.add_argument('--out',default='/tmp/china-town-map');cfg=args.parse_args();out=Path(cfg.out);out.mkdir(parents=True,exist_ok=True)
KEY='ww:qingming-china:save:v1';SK=KEY+':session';ST='ww:qingming-china:study:session';results=[];errors=[];http=[]
def btn(p,name):return p.get_by_role('button',name=name,exact=True)
def game(p):return p.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',SK)
def open_map(p):btn(p,'打开长卷地图').click();expect(p.get_by_role('dialog',name='汴河长卷地图')).to_be_visible()
def geometry(p):
 expected=p.locator('.scroll-view').evaluate('(e)=>e.clientWidth/Number(e.querySelector(".world-strip").style.getPropertyValue("--world-scale"))*800/6000')
 actual=p.locator('.town-map-here').evaluate_all('(xs)=>xs.reduce((n,x)=>n+Number(x.getAttribute("width")),0)');assert abs(actual-expected)<.01,(actual,expected)
def no_overflow(p):
 for selector in ['.sheet','.sheet-head','.sheet-content','.town-map','.town-map-row','.town-map-list']:
  assert p.locator(selector).evaluate_all('(xs)=>xs.every(e=>e.scrollWidth<=e.clientWidth+1)'),selector
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 c=b.new_context(viewport={'width':360,'height':800});p=c.new_page();requests=[];p.on('request',lambda r:requests.append(r.url));p.on('pageerror',lambda e:errors.append(str(e)));p.on('response',lambda r:http.append(r.url) if r.status>=400 else None);p.goto(cfg.url+'?session=1',wait_until='networkidle');btn(p,'入画').click();before=game(p);assert not any('/map/china-map.webp' in u for u in requests);assert not p.locator('.town-map').count()
 p.evaluate('(k)=>localStorage.setItem(k,"ordinary-sentinel")',KEY)
 # The permanent scene-caption entrance works with keyboard, without going through Nearby.
 btn(p,'打开长卷地图').focus();p.keyboard.press('Enter');expect(p.get_by_role('dialog',name='汴河长卷地图')).to_be_visible();expect(p.locator('.town-map-row')).to_have_count(4);p.wait_for_function('Array.from(document.querySelectorAll(".town-map-row svg image")).length===4');p.wait_for_timeout(300);assert any('/map/china-map.webp' in u for u in requests);geometry(p);no_overflow(p);p.screenshot(path=str(out/'map-360.png'))
 # Tab must include native map buttons, exclude the content of a collapsed details, and wrap in the dialog.
 seen=set()
 for _ in range(20):
  focus=p.evaluate('''()=>{const e=document.activeElement;return {tag:e.tagName,row:e.classList.contains('town-map-row')?e.getAttribute('aria-label'):null,hidden:!!e.closest('details:not([open]) li'),outside:e!==document.body&&!e.closest('dialog')}}''');assert not focus['hidden'] and not focus['outside'],focus
  if focus['row']:seen.add(focus['row'])
  p.keyboard.press('Tab')
 assert len(seen)==4,seen
 p.locator('.town-map-list summary').focus();p.keyboard.press('Enter');p.keyboard.press('Tab');assert p.locator('.town-map-list button').evaluate_all('(xs)=>xs.includes(document.activeElement)');p.screenshot(path=str(out/'map-markers-360.png'))
 # Each row takes the keyboard to its middle and returns focus to the painting.
 centers=[10200,4200,-1800,-7800]
 for i,x in enumerate(centers):
  p.locator('.town-map-row').nth(i).focus();p.keyboard.press('Enter');expect(p.get_by_role('dialog')).to_have_count(0);assert p.locator('.scroll-surface').evaluate('(e)=>e===document.activeElement');open_map(p);geometry(p)
  active=p.locator('.town-map-here');assert active.count()==1
  expected=(x-[7200,1200,-4800,-10800][i])*800/6000
  rect=active.evaluate('(e)=>({x:Number(e.getAttribute("x")),w:Number(e.getAttribute("width"))})');assert abs(rect['x']+rect['w']/2-expected)<.01,rect
 # Pointer near the fold places the viewport on both rows; no guessed centre.
 svg=p.locator('.town-map-row svg').nth(2);r=svg.bounding_box();p.mouse.click(r['x']+r['width']-1,r['y']+r['height']*.5);open_map(p);assert p.locator('.town-map-here').count()==2;geometry(p)
 p.locator('.town-map-list summary').click();marker=p.locator('.town-map-list button').filter(has_text='何娘');marker.click();expect(p.get_by_role('dialog')).to_have_count(0);assert p.locator('.scroll-view').get_attribute('data-scene')=='tea'
 # State changes are confined to the map's local opened flag; no story, reward or collectible progress.
 after=game(p);assert after['wallet']==before['wallet'];assert after['journal']==before['journal'];assert after['claimed']==before['claimed'];assert after['progress']['quests']==before['progress']['quests'];assert after['progress']['map']=={'opened':True,'hinted':False}
 p.reload(wait_until='networkidle');assert game(p)['progress']['map']['opened'];assert p.evaluate('(k)=>localStorage.getItem(k)',KEY)=='ordinary-sentinel'
 btn(p,'设置').click();p.get_by_role('checkbox',name='大字阅读',exact=False).check();p.keyboard.press('Escape')
 for width,height in [(360,800),(360,568),(1280,800)]:
  p.set_viewport_size({'width':width,'height':height});open_map(p);p.locator('.town-map-list summary').click();no_overflow(p);geometry(p)
  if width==360 and height==568:p.screenshot(path=str(out/'map-360-large-short.png'))
  p.keyboard.press('Escape');expect(btn(p,'打开长卷地图')).to_be_focused()
 # Existing saves without map data load with their quests preserved.
 old=game(p);del old['progress']['map'];p.evaluate('(a)=>localStorage.setItem(a[0],JSON.stringify(a[1]))',[SK,old]);p.reload(wait_until='networkidle');s=game(p);assert s['progress']['map']=={'opened':False,'hinted':False};assert s['progress']['quests']==old['progress']['quests'];open_map(p);p.keyboard.press('Escape')
 rec=p.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',ST);events=[e for e in rec['events'] if e['type']=='play_detail'];assert any(e.get('what')=='map' and e.get('outcome')=='opened' for e in events);assert any(e.get('what')=='map' and e.get('outcome')=='tapped' for e in events);assert all('x' not in e and 'label' not in e for e in events)
 assert not any(e['type']=='first_interaction_completed' for e in rec['events']);results.append('lazy image; keyboard rows and marker list; collapsed-details focus; precise pointer/fold/view; focus return; 360px/150%; legacy save; game isolation and fixed telemetry');c.close()
 # New invitations trigger a one-time, actionable reminder; opening the map suppresses later reminders.
 c=b.new_context(viewport={'width':390,'height':844});p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(cfg.url+'?session=1',wait_until='networkidle');btn(p,'入画').click();btn(p,'附近').click();p.locator('.nearby-list button').filter(has=p.get_by_role('heading',name='一纸春风',exact=True)).click();btn(p,'替他压住画纸').click();btn(p,'落笔，记下此景').click();p.keyboard.press('Escape');expect(p.get_by_text('想找河边等你的人，可以展开地名旁的「地图」。',exact=True)).to_be_visible();assert game(p)['progress']['map']=={'opened':False,'hinted':True};p.reload(wait_until='networkidle');assert not p.get_by_text('想找河边等你的人，可以展开地名旁的「地图」。',exact=True).count()
 open_map(p);p.locator('.town-map-list summary').click();expect(p.locator('.town-map-list button').filter(has_text='柳下初笔')).to_have_count(1);expect(p.locator('.town-map-list button').filter(has_text='借一阵风')).to_have_count(1);p.keyboard.press('Escape')
 # Declining one of two invitations never hides the other.
 btn(p,'附近').click();d=p.locator('.play-story-invitations');d.locator('summary').click();d.locator('button').nth(0).click();p.keyboard.press('Escape');btn(p,'附近').click();d=p.locator('.play-story-invitations');d.locator('summary').click();d.locator('button').nth(1).click();expect(btn(p,'陪小柳把画晾起来')).to_be_visible();assert game(p)['progress']['quests']['trace']['step']==0;p.keyboard.press('Escape');p.reload(wait_until='networkidle');assert not p.get_by_text('想找河边等你的人，可以展开地名旁的「地图」。',exact=True).count();results.append('one-time reminder on new paper-story invitations; both C3 invitations remain reachable after declining one');c.close();b.close()
assert not errors and not http,(errors,http)
result={'url':cfg.url,'checks':results,'page_errors':errors,'http_errors':http,'scope':'Headless system Chromium; desktop and phone viewports, 150% text. Not physical phone or Safari.'};(out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
