from pathlib import Path
import json
from PIL import Image
from playwright.sync_api import sync_playwright,expect
OUT=Path('/workspace/.cloud-setup/gate');OUT.mkdir(parents=True,exist_ok=True)
KEY='ww:qingming-china:save:v1'
def state(page):return page.evaluate("JSON.parse(localStorage.getItem('"+KEY+"'))")
def nearby(page):page.get_by_role('button',name='附近',exact=True).click()
def gate(page):
 nearby(page);page.get_by_role('button',name='认得归路',exact=False).click()
def keyboard(page,name):
 b=page.get_by_role('button',name=name,exact=True);expect(b).to_be_enabled();b.focus();b.press('Enter')
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for width in [360,390]:
  ctx=browser.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True,accept_downloads=True)
  page=ctx.new_page();page.set_default_timeout(15000);page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:5175/',wait_until='domcontentloaded')
  page.get_by_role('button',name='入画',exact=True).tap()
  page.get_by_role('button',name='设置',exact=True).tap();page.get_by_role('checkbox',name='大字阅读').check();page.get_by_role('button',name='返回街上',exact=True).tap()
  nearby(page);page.get_by_text('长卷导览',exact=True).click();page.get_by_role('navigation',name='长卷导览').get_by_role('button',name='城门',exact=True).tap()
  gate(page);expect(page.get_by_role('heading',name='认得归路',exact=True)).to_be_visible()
  assert page.locator('img[alt*=阿芦]').evaluate('(i)=>i.complete&&i.naturalWidth>0')
  keyboard(page,'陪阿芦读一读路条');page.get_by_role('button',name='跟着驼队一直走',exact=True).tap()
  expect(page.get_by_text('驼队还要远行。阿姊约的是一处铺子，不是移动的人群。',exact=True)).to_be_visible()
  assert state(page)['progress']['quests']['gate']['step']==1
  keyboard(page,'认准城门里的绸缎铺')
  page.reload(wait_until='domcontentloaded');gate(page)
  assert state(page)['progress']['quests']['gate']['step']==2
  page.get_by_role('button',name='不停换地方找人',exact=True).tap();assert state(page)['progress']['quests']['gate']['step']==2
  keyboard(page,'在绸缎铺前檐下等候');keyboard(page,'把这张路条记入画册')
  s=state(page);assert s['wallet']==60 and s['journal']==['gate-meeting'] and s['claimed']==['gate'] and s['saveVersion']==3
  assert page.locator('.sheet-content').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
  page.screenshot(path=str(OUT/f'gate-{width}-large.png'))
  keyboard(page,'翻开《认得归路》')
  with page.expect_download() as d:keyboard(page,'保存清晰留念图')
  dest=OUT/f'gate-{width}.png';d.value.save_as(str(dest));assert Image.open(dest).size==(1440,1800)
  keyboard(page,'回到画册');assert page.locator('.album-card').count()==14
  page.get_by_role('button',name='返回街上',exact=True).tap();gate(page)
  keyboard(page,'重逢 · 再读一回路条')
  for name in ['陪阿芦读一读路条','认准城门里的绸缎铺','在绸缎铺前檐下等候','把这张路条记入画册']:keyboard(page,name)
  s=state(page);assert s['wallet']==60 and s['journal']==['gate-meeting'] and s['claimed']==['gate']
  page.get_by_role('button',name='返回街上',exact=True).tap()
  nearby(page);page.get_by_text('以文字探索街巷',exact=True).click();page.get_by_role('dialog').get_by_role('button',name='城门有约 · 与阿芦读路条',exact=True).tap()
  expect(page.get_by_role('heading',name='认得归路',exact=True)).to_be_visible()
  # Actual v2 save import: preserve original claimed/free page/boat partial progress.
  legacy=page.evaluate("""async()=>{const {initialState,reduceGame}=await import('/src/game.ts');let s=initialState();for(const a of [{type:'PRESS_PAPER'},{type:'SKETCH',view:'hands'},{type:'ROPE',rope:0,target:0}])s=reduceGame(s,a);delete s.progress.quests.gate;s.saveVersion=2;return s;}""")
  page.get_by_role('button',name='返回街上',exact=True).tap();page.get_by_role('button',name='设置',exact=True).tap()
  page.locator('input[type=file]').set_input_files({'name':'legacy-v2.json','mimeType':'application/json','buffer':json.dumps(legacy).encode()})
  expect(page.get_by_text('存档已接续，欢迎回到汴河。',exact=True)).to_be_visible()
  saved=state(page);assert saved['saveVersion']==3 and saved['wallet']==72 and saved['journal']==['paper-hands'] and saved['progress']['ropes']==[0] and saved['progress']['quests']['gate']=={'status':'unseen','step':0}
  ctx.close()
 browser.close()
assert not errors,errors
result={'widths':[360,390],'text_size':'150%','keyboard':True,'guide_and_text_entry':True,'wrong_choices_no_advance':True,'refresh_resume_step':2,'first_and_replay_wallet':60,'album_pages':14,'png_dimensions':[1440,1800],'v2_import_preserves_progress':True,'page_errors':errors}
(OUT/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
