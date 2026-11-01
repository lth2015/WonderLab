from pathlib import Path
import json
from PIL import Image
from playwright.sync_api import sync_playwright,expect
OUT=Path('/workspace/.cloud-setup/china-countryside');KEY='ww:qingming-china:save:v1';errors=[]
def state(p):return p.evaluate("JSON.parse(localStorage.getItem('"+KEY+"'))")
def key(p,name):
 b=p.get_by_role('button',name=name,exact=True);expect(b).to_be_enabled();b.focus();b.press('Enter')
def close(p):p.get_by_role('button',name='返回街上',exact=True).click()
def text(p,name):
 p.get_by_role('button',name='附近',exact=True).click();p.get_by_text('以文字探索街巷',exact=True).click();p.get_by_role('dialog').get_by_role('button',name=name,exact=False).click()
def country(p):text(p,'与乡野渡船人田伯交谈')
def logs(p,name):
 if p.locator('dialog[open]').count():close(p)
 p.get_by_role('button',name='设置',exact=True).click();p.get_by_text('本次试玩记录与隐私',exact=True).click()
 with p.expect_download() as e:p.get_by_role('button',name='导出本次试玩记录',exact=True).click()
 path=OUT/(name+'.json');e.value.save_as(str(path));return json.loads(path.read_text())
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for width in [360,390]:
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True,accept_downloads=True);p=c.new_page();p.set_default_timeout(12000);p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto('http://127.0.0.1:5175/',wait_until='domcontentloaded');p.get_by_role('button',name='入画',exact=True).tap();p.get_by_role('button',name='设置',exact=True).tap();p.get_by_role('checkbox',name='大字阅读',exact=False).check();close(p)
  p.get_by_role('button',name='附近',exact=True).tap();p.get_by_text('长卷导览',exact=True).click();p.get_by_role('navigation',name='长卷导览').get_by_role('button',name='乡野',exact=True).tap()
  # A real touch on the existing boat hotspot, not only a text surrogate.
  p.get_by_label('与乡野渡船人田伯交谈',exact=True).tap();expect(p.get_by_role('heading',name='这一程，不催',exact=True)).to_be_visible();p.wait_for_function("document.querySelector('img[alt*=田伯]').complete")
  p.screenshot(path=str(OUT/f'opening-{width}-large.png'))
  key(p,'听田伯说说这一程');key(p,'催他放下锄头就跑');expect(p.get_by_text('他还要把锄头收妥。一声回应就够了，不必催他跑来。',exact=True)).to_be_visible();assert state(p)['progress']['quests']['countryside']['step']==1
  key(p,'挥手回应，示意慢慢来');p.reload(wait_until='domcontentloaded')
  p.get_by_role('button',name='附近',exact=True).click();p.locator('.nearby-list').get_by_role('button',name='这一程，不催',exact=False).click();assert state(p)['progress']['quests']['countryside']['step']==2
  key(p,'先把船划到河心等');assert state(p)['progress']['quests']['countryside']['step']==2
  key(p,'稳好船，再迎他上船');key(p,'把这一程记入画册')
  s=state(p);assert s['saveVersion']==4 and s['wallet']==60 and s['journal']==['ferry-neighbor'] and s['claimed']==['countryside']
  assert p.locator('.sheet-content').evaluate('(e)=>e.scrollWidth<=e.clientWidth');assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
  key(p,'翻开《这一程，不催》')
  with p.expect_download() as e:key(p,'保存清晰留念图')
  path=OUT/f'postcard-{width}.png';e.value.save_as(str(path));assert Image.open(path).size==(1440,1800)
  key(p,'回到画册');assert p.locator('.album-card').count()==15
  close(p);country(p);key(p,'重逢 · 再向邻居应一声')
  for name in ['听田伯说说这一程','挥手回应，示意慢慢来','稳好船，再迎他上船','把这一程记入画册']:key(p,name)
  assert state(p)['wallet']==60 and state(p)['journal']==['ferry-neighbor']
  snap=logs(p,f'events-{width}');assert [e['first_completion'] for e in snap['events'] if e['type']=='story_completed' and e['story_id']=='countryside']==[True,False]
  close(p);text(p,'沈砚');key(p,'这一程，不催');key(p,'说说今日的见闻');expect(p.get_by_text('你向田边的邻居应了一声，陪田伯等人、稳船，也听他说起邻里曾经的照应。',exact=True)).to_be_visible();assert state(p)['wallet']==60
  close(p);text(p,'看看田里的农人');expect(p.get_by_text('两位农人弯腰锄地，麦苗刚刚没过脚背。',exact=True)).to_be_visible()
  # File import, not direct storage replacement: preserve v3 progress and selected time.
  legacy=p.evaluate("""async()=>{const{initialState,reduceGame}=await import('/src/game.ts');let s=initialState();for(const a of [{type:'PRESS_PAPER'},{type:'SKETCH',view:'hands'},{type:'GATE_TALK'},{type:'GATE_LANDMARK',landmark:'silk'},{type:'GATE_WAIT',place:'eaves'},{type:'GATE_SKETCH'},{type:'HARBOR_TALK'},{type:'HARBOR_PLACE',place:'eaves'},{type:'HARBOR_CLEAR',move:'basket'},{type:'HARBOR_SKETCH'},{type:'ROPE',rope:0,target:0},{type:'SETTINGS',settings:{timeChoice:'morning',largeText:true}}])s=reduceGame(s,a);s.saveVersion=3;delete s.progress.quests.countryside;return s;}""")
  p.get_by_role('button',name='设置',exact=True).click();p.locator('input[type=file]').set_input_files({'name':'legacy-v3.json','mimeType':'application/json','buffer':json.dumps(legacy).encode()});expect(p.get_by_text('存档已接续，欢迎回到汴河。',exact=True)).to_be_visible()
  s=state(p);assert s['saveVersion']==4 and s['progress']['quests'].pop('countryside')=={'status':'unseen','step':0};s['saveVersion']=3;assert s==legacy
  after=logs(p,f'after-import-{width}');assert not any(e['type']=='story_completed' and e.get('story_id') in ['paper','gate','harbor'] for e in after['events'])
  c.close()
 b.close()
assert not errors,errors
result={'widths':[360,390],'text_percent':150,'actual_boat_touch':True,'keyboard':True,'guide_nearby_text_routes':True,'refresh_resume_step':2,'wrong_choices_no_advance':True,'wallet_first_replay':60,'new_page_once':True,'album_pages':15,'png_size':[1440,1800],'master_and_summary':True,'farmer_observation_preserved':True,'v3_import_exact_progress_and_time':True,'no_import_completion_events':True,'page_errors':errors}
(OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
