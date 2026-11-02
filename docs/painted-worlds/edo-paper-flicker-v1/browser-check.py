"""Run against an Edo dev/preview server, e.g. --url http://127.0.0.1:5180/edo/."""
from pathlib import Path
import argparse,json
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:5180/edo/');args=parser.parse_args()
OUT=Path(__file__).resolve().parent/'evidence';OUT.mkdir(exist_ok=True)
errors=[];checks=[]
SAMPLE='''async()=>{
 const el=document.querySelector('.flap'),animation=el.getAnimations()[0];
 animation.pause();const result=[];
 for(let t=0;t<=3600;t+=75){
  animation.currentTime=t;await new Promise(requestAnimationFrame);
  const r=el.getBoundingClientRect(),m=el.getCTM();
  result.push({t,x:r.x,y:r.y,w:r.width,h:r.height,translateX:m.e,translateY:m.f});
 }return result;
}'''
def sample(page,case,scale=1,fully_in_view=True):
 before=page.evaluate('JSON.stringify(localStorage)');frames=page.evaluate(SAMPLE)
 dx=max(f['x'] for f in frames)-min(f['x'] for f in frames);dy=max(f['y'] for f in frames)-min(f['y'] for f in frames)
 # The sheets may flutter a few pixels; they must not cross the painting.
 assert dx<15*scale and dy<15*scale,(case,dx,dy)
 visible=all(f['x']+f['w']>0 and f['x']<page.viewport_size['width'] for f in frames)
 assert visible,(case,dx,dy)
 in_view=all(f['x']>=0 and f['x']+f['w']<=page.viewport_size['width'] for f in frames)
 if fully_in_view:assert in_view,(case,dx,dy)
 assert page.evaluate('JSON.stringify(localStorage)')==before
 if case=='390-session-entered':(OUT/'after-frames.json').write_text(json.dumps(frames[::6],indent=2))
 return {'case':case,'samples':len(frames),'cycles':2,'max_x_delta_px':round(dx,3),'max_y_delta_px':round(dy,3),'visible_every_frame':visible,'fully_in_view':in_view,'storage_unchanged':True}
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for width,height in [(360,844),(390,844),(1280,800)]:
  for session in [False,True]:
   case=f'{width}-'+('session' if session else 'normal');context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<900,has_touch=width<900);p=context.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(args.url+('?session=1' if session else ''),wait_until='networkidle')
   checks.append(sample(p,case+'-title'));p.get_by_role('button',name='絵巻に入る',exact=True).click();checks.append(sample(p,case+'-entered'))
   if width==390 and session:
    for label,t in [('rest',0),('peak',900)]:
     p.evaluate('(t)=>{document.querySelector(".flap").getAnimations()[0].currentTime=t}',t);p.screenshot(path=str(OUT/f'after-{label}.png'))
    # Browser zoom-in still leaves the paper anchored by the clerk.
    p.get_by_role('button',name='近くで見る',exact=True).click();p.wait_for_timeout(350);checks.append(sample(p,case+'-zoomed',2,False));p.get_by_role('button',name='もとに戻す',exact=True).click();p.wait_for_timeout(350)
    # The app setting and a system preference present at load keep it still.
    p.get_by_role('button',name='設定',exact=True).click();p.get_by_role('checkbox',name='動きを減らす',exact=True).check();p.get_by_role('button',name='町に戻る',exact=True).click();assert p.locator('.flap').evaluate('(e)=>e.getAnimations().length')==0
    p.get_by_role('button',name='設定',exact=True).click();p.get_by_role('checkbox',name='動きを減らす',exact=True).uncheck();p.get_by_role('button',name='町に戻る',exact=True).click();p.emulate_media(reduced_motion='reduce');p.reload(wait_until='networkidle');assert p.locator('.flap').evaluate('(e)=>e.getAnimations().length')==0;p.emulate_media(reduced_motion='no-preference');p.reload(wait_until='networkidle');p.get_by_role('button',name='絵巻に入る',exact=True).click()
    # Pressing the papers in the real story still removes the loose sheets.
    p.get_by_role('button',name='近くのこと',exact=True).click();p.locator('.list.compact').get_by_role('button',name='清太',exact=False).click();p.get_by_role('button',name='次へ',exact=True).click();p.get_by_role('button',name='文鎮で押さえる',exact=True).click();expect(p.locator('.flap')).to_have_count(0)
    normal=p.evaluate("localStorage.getItem('ww:qingming-edo:save')");assert normal is None
   context.close()
 browser.close()
assert not errors,errors
result={'checks':checks,'zoomed_anchored':True,'app_reduced_motion':True,'system_reduced_motion_at_load':True,'press_papers_removes_animation':True,'session_does_not_write_ordinary_save':True,'page_errors':errors,'device':'headless Chromium; touch emulation at 360/390, desktop 1280'}
(OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
