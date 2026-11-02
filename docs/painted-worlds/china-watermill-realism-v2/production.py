from pathlib import Path
import json,math,time
from playwright.sync_api import sync_playwright,expect
OUT=Path(__file__).resolve().parent/'evidence';errors=[];requests=[];checks=[]
URL='http://127.0.0.1:5175/';KEY='ww:qingming-china:save:v1:session'
def visit(p):
 p.get_by_role('button',name='附近',exact=True).click();p.get_by_text('以文字探索街巷',exact=True).click();p.get_by_role('dialog').get_by_role('button',name='看看水磨',exact=True).click();p.wait_for_selector('.watermill[data-ready=true]');p.wait_for_timeout(350)
def settings(p):p.get_by_role('button',name='设置',exact=True).click()

production=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for url in ['http://127.0.0.1:5176/','http://127.0.0.1:5177/qingming/']:
  p=b.new_page(viewport={'width':390,'height':844});bad=[];p.on('pageerror',lambda e:bad.append(str(e)));p.on('response',lambda r:bad.append(str(r.status)+' '+r.url) if r.status>=400 else None);p.goto(url+'?session=1',wait_until='networkidle');p.get_by_role('button',name='入画',exact=True).click();assert p.locator('.watermill').count()==0;visit(p)
  start=p.locator('.mill-rotor').evaluate('(e)=>getComputedStyle(e).transform');p.wait_for_timeout(350);end=p.locator('.mill-rotor').evaluate('(e)=>getComputedStyle(e).transform');assert start!=end
  p.emulate_media(reduced_motion='reduce');p.wait_for_function('document.querySelector(".watermill").getAnimations({subtree:true}).length===0');assert p.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).wallet',KEY)==60;assert not bad,bad
  assert p.locator('.mill-bucket-stage canvas').evaluate('(e)=>e.millFrame')==0
  production.append({'base':url,'loaded_layers':True,'wheel_rotates':True,'system_reduced_motion_stops_all':True,'wallet':60,'errors':bad});p.close()
 # Canvas denied: keep the original complete static tile instead of a partial machine.
 c=b.new_context(viewport={'width':390,'height':844});c.add_init_script("const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return this.width===180&&this.height===284&&kind==='2d'?null:get.call(this,kind,...args)}");p=c.new_page();p.goto('http://127.0.0.1:5177/qingming/?session=1',wait_until='networkidle');p.get_by_role('button',name='入画',exact=True).click();p.get_by_role('button',name='附近',exact=True).click();p.get_by_text('以文字探索街巷',exact=True).click();p.get_by_role('dialog').get_by_role('button',name='看看水磨',exact=True).click();p.wait_for_timeout(750);assert p.locator('.watermill').get_attribute('data-ready')=='false';assert p.locator('.watermill > g').get_attribute('opacity')=='0';production.append({'canvas_denied_static_fallback':True});c.close()
 b.close()
(OUT/'production.json').write_text(json.dumps(production,indent=2));print(json.dumps(production,indent=2))
