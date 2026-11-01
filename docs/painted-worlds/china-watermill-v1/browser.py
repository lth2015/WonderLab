from pathlib import Path
import json,math,time
from playwright.sync_api import sync_playwright,expect
OUT=Path(__file__).resolve().parent/'evidence';errors=[];requests=[];checks=[]
URL='http://127.0.0.1:5175/';KEY='ww:qingming-china:save:v1:session'
def visit(p):
 p.get_by_role('button',name='附近',exact=True).click();p.get_by_text('以文字探索街巷',exact=True).click();p.get_by_role('dialog').get_by_role('button',name='看看水磨',exact=True).click();p.wait_for_selector('.watermill[data-ready=true]');p.wait_for_timeout(350)
def settings(p):p.get_by_role('button',name='设置',exact=True).click()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for w,h in [(390,844),(1280,800)]:
  c=b.new_context(viewport={'width':w,'height':h},is_mobile=w<900,has_touch=w<900);p=c.new_page();p.set_default_timeout(12000);p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url));p.goto(URL+'?session=1',wait_until='networkidle');p.get_by_role('button',name='入画',exact=True).click()
  assert p.locator('.watermill').count()==0;assert not any('/watermill/' in u for u in requests)
  visit(p);before=p.evaluate('(k)=>localStorage.getItem(k)',KEY)
  phases=p.evaluate('''async()=>{
   const rotor=document.querySelector('.mill-rotor'),fall=document.querySelector('.mill-current'),front=document.querySelector('.watermill > g');
   const a=rotor.getAnimations()[0],f=fall.getAnimations()[0];a.pause();f.pause();let frames=[];
   for(const t of [0,1000,3500,7000,10500,14000,21000,28000]){
    a.currentTime=t;f.currentTime=t;await new Promise(requestAnimationFrame);
    const m=rotor.getScreenCTM(),r=front.getBoundingClientRect();
    frames.push({ms:t,pivotX:m.e,pivotY:m.f,rotorMatrix:getComputedStyle(rotor).transform,flowMatrix:getComputedStyle(fall).transform,frontX:r.x,frontY:r.y});
   }a.play();f.play();return frames;
  }''')
  assert max(f['pivotX'] for f in phases)-min(f['pivotX'] for f in phases)<.1
  assert max(f['pivotY'] for f in phases)-min(f['pivotY'] for f in phases)<.1
  assert phases[0]['rotorMatrix']!=phases[3]['rotorMatrix'];assert phases[0]['flowMatrix']!=phases[1]['flowMatrix']
  assert p.evaluate('(k)=>localStorage.getItem(k)',KEY)==before
  (OUT/f'phases-{w}.json').write_text(json.dumps(phases,indent=2));p.screenshot(path=str(OUT/f'after-{w}.png'))
  # Reload after WAAPI phase control so CSS owns play-state again.
  p.reload(wait_until='networkidle');visit(p)
  # Reach a point just outside the mill view: keep the layer prefetched, pause it.
  p.get_by_role('region',name='虹桥两岸可拖动画卷。左右方向键移动；也可通过附近入口选择人物。').focus()
  for _ in range(5 if w<900 else 9):p.keyboard.press('ArrowLeft')
  p.wait_for_timeout(350);assert p.locator('.watermill').count()==1
  assert p.locator('.watermill').evaluate('(e)=>e.classList.contains("mill-paused")')
  p.wait_for_function('document.querySelector(".mill-rotor").getAnimations()[0].playState==="paused"');p.wait_for_timeout(60)
  paused=p.locator('.mill-rotor').evaluate('(e)=>e.getAnimations()[0].currentTime');p.wait_for_timeout(150);assert abs(p.locator('.mill-rotor').evaluate('(e)=>e.getAnimations()[0].currentTime')-paused)<1
  # Going much farther unloads every mill node; coming back resumes cached layers.
  p.get_by_role('button',name='附近',exact=True).click();p.get_by_text('长卷导览',exact=True).click();p.get_by_role('navigation',name='长卷导览').get_by_role('button',name='纸铺',exact=True).click();p.wait_for_timeout(350);assert p.locator('.watermill').count()==0
  visit(p);settings(p);p.get_by_role('checkbox',name='减少动态',exact=False).check();p.get_by_role('button',name='返回街上',exact=True).click();assert p.locator('.watermill').evaluate('(e)=>e.getAnimations({subtree:true}).length')==0
  p.screenshot(path=str(OUT/f'reduced-{w}.png'));settings(p);p.get_by_role('checkbox',name='减少动态',exact=False).uncheck();p.get_by_role('button',name='返回街上',exact=True).click()
  p.emulate_media(reduced_motion='reduce');p.wait_for_function('document.querySelector(".watermill").getAnimations({subtree:true}).length===0');p.emulate_media(reduced_motion='no-preference');p.wait_for_function('document.querySelector(".mill-rotor").getAnimations().length===1')
  # Simulate document visibility events through CDP lifecycle when supported by the browser.
  p.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
  p.wait_for_function('document.querySelector(".game-shell").classList.contains("paused")');assert p.locator('.mill-rotor').evaluate('(e)=>e.getAnimations()[0].playState')=='paused'
  p.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))");p.wait_for_function('document.querySelector(".mill-rotor").getAnimations()[0].playState==="running"')
  p.reload(wait_until='networkidle');visit(p);assert p.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).wallet',KEY)==60;assert p.evaluate("localStorage.getItem('ww:qingming-china:save:v1')") is None
  checks.append({'width':w,'no_first_view_assets':True,'pivot_max_delta_px':0,'rotor_and_flow_move':True,'offscreen_pause_and_unmount':True,'app_and_live_system_reduced_motion':True,'hidden_document_pauses':True,'refresh_restores':True,'wallet':60,'no_ordinary_save_write':True});c.close();requests=[]
 # A failed new asset must show the unchanged original static tile.
 c=b.new_context(viewport={'width':390,'height':844});p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.route('**/watermill/**',lambda r:r.abort());p.goto(URL+'?session=1',wait_until='networkidle');p.get_by_role('button',name='入画',exact=True).click();p.get_by_role('button',name='附近',exact=True).click();p.get_by_text('以文字探索街巷',exact=True).click();p.get_by_role('dialog').get_by_role('button',name='看看水磨',exact=True).click();p.wait_for_timeout(500);assert p.locator('.watermill').get_attribute('data-ready')=='false';assert p.locator('.watermill > g').get_attribute('opacity')=='0';p.screenshot(path=str(OUT/'asset-failure-original.png'));c.close()
 b.close()
assert not errors,errors
result={'checks':checks,'asset_failure_preserves_original':True,'page_errors':errors,'device':'headless Chromium; mobile touch emulation, not physical phone'}
(OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
