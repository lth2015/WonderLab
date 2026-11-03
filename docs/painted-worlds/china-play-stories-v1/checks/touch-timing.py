"""C3 browser regressions. Use --url for either production mount; no Vite imports."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import argparse,json
args=argparse.ArgumentParser();args.add_argument('--url',default='http://127.0.0.1:5175/');args.add_argument('--out',default='touch-timing-result.json');opts=args.parse_args()
SK='ww:qingming-china:save:v1:session';ST='ww:qingming-china:study:session';errors=[];results=[]
def btn(p,name):return p.get_by_role('button',name=name,exact=True)
def state(p):return p.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',SK)
def story(p,index):
 btn(p,'附近').click();d=p.locator('.play-story-invitations')
 if not d.evaluate('(e)=>e.open'):d.locator('summary').click()
 d.locator('button').nth(index).click()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);p=c.new_page();p.goto(opts.url+'?session=1',wait_until='networkidle');btn(p,'入画').click();btn(p,'附近').click();p.locator('.nearby-list button').filter(has=p.get_by_role('heading',name='一纸春风',exact=True)).click();btn(p,'替他压住画纸').click();btn(p,'落笔，记下此景').click();p.keyboard.press('Escape');seed=state(p);c.close()
 cases=[(2490,2501,'miss'),(2500,2501,'caught'),(5490,5501,'caught'),(5499,5501,'caught'),(5500,5501,'miss'),(10490,10501,'miss'),(13490,13501,'caught')]
 for rendered,clicked,outcome in cases:
  c=b.new_context(viewport={'width':390,'height':844});p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.add_init_script('window.windTestNow=0;performance.now=()=>window.windTestNow;void 0');p.add_init_script('localStorage.setItem('+json.dumps(SK)+','+json.dumps(json.dumps(seed))+');void 0');p.goto(opts.url+'?session=1',wait_until='networkidle');story(p,1);btn(p,'陪小柳把画晾起来').click();btn(p,'把画的上沿搭在竹竿上').click();p.evaluate('(t)=>{window.windTestNow=t}',rendered)
  light=2500<=rendered%8000<5500;expect(p.locator('.wind-status')).to_have_text('风轻了 · 纸角已平，可以松手' if light else '一阵风过 · 纸角在扬，先扶一扶')
  # Change the clock and click in one JS task: there cannot be a fresh paint in between.
  shown=p.evaluate('(t)=>{const shown=document.querySelector(".wind-status").textContent;window.windTestNow=t;document.querySelector(".play-story-actions .primary-button").click();return shown}',clicked)
  expected_step=4 if outcome=='caught' else 2;p.wait_for_function('(a)=>JSON.parse(localStorage.getItem(a[0])).progress.quests.breeze.step===a[1]',arg=[SK,expected_step]);s=state(p);record=p.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',ST);actual=next(e['outcome'] for e in reversed(record['events']) if e['type']=='play_detail');assert actual==outcome;(results.append({'displayed_ms':rendered,'clicked_ms':clicked,'shown_at_click':shown,'outcome':actual,'step':s['progress']['quests']['breeze']['step']}));assert s['wallet']==72;c.close()
 # Actual touch events through Chromium's input pipeline, including touch cancellation.
 c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.add_init_script('if(!localStorage.getItem('+json.dumps(SK)+'))localStorage.setItem('+json.dumps(SK)+','+json.dumps(json.dumps(seed))+');void 0');p.goto(opts.url+'?session=1',wait_until='networkidle');story(p,0);cdp=c.new_cdp_session(p)
 guides=[[(92,43),(122,48),(148,64),(163,88),(167,114),(163,135)],[(146,73),(127,87),(121,105),(137,95),(146,73)],[(75,158),(108,150),(141,154),(176,148),(209,152),(244,146)]]
 def touch(kind,point=None):
  pts=[] if point is None else [{'x':r['x']+point[0]*r['width']/320,'y':r['y']+point[1]*r['height']/200,'id':1,'radiusX':9,'radiusY':9,'force':1}]
  cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':pts})
 svg=p.locator('.trace-board svg');svg.scroll_into_view_if_needed();r=svg.bounding_box();touch('touchStart',guides[0][0]);touch('touchMove',guides[0][1]);touch('touchCancel');assert state(p)['progress']['quests']['trace']['step']==0
 for i,points in enumerate(guides):
  svg=p.locator('.trace-board svg');svg.scroll_into_view_if_needed();r=svg.bounding_box();touch('touchStart',points[0])
  for point in points[1:]:touch('touchMove',point)
  touch('touchEnd');p.wait_for_function('(a)=>JSON.parse(localStorage.getItem(a[0])).progress.quests.trace.step===a[1]',arg=[SK,i+1])
  if i==0:
   p.keyboard.press('Escape');p.reload(wait_until='networkidle');story(p,0)
 btn(p,'收好《柳下初笔》').click();p.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k)).progress.quests.trace.step===4',arg=SK);s=state(p);assert s['wallet']==72;assert s['journal']==['paper-hands','willow-trace'];records=p.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',ST);assert sum(e.get('outcome')=='traced' for e in records['events'])==3;assert not any('points' in e for e in records['events']);c.close();b.close()
assert not errors,errors
result={'url':opts.url,'wind_cases':results,'touch':{'input':'CDP touchStart/touchMove/touchEnd/touchCancel, 390x844 mobile emulation','cancel_does_not_commit':True,'three_strokes_finish':True,'reload_after_first_stroke_continues':True,'one_page_only':True,'wallet':72,'traced_events':3},'page_errors':errors,'limits':'Headless Chromium touch emulation, not physical phone or Safari.'};Path(opts.out).write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
