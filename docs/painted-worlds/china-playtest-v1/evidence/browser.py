from pathlib import Path
import json
from playwright.sync_api import sync_playwright,expect
OUT=Path('/workspace/.cloud-setup/china-playtest-time');KEY='ww:qingming-china:save:v1'
def state(p):return p.evaluate("JSON.parse(localStorage.getItem('"+KEY+"'))")
def close(p):p.get_by_role('button',name='返回街上',exact=True).click()
def settings(p):
 if p.locator('dialog[open]').count():close(p)
 p.get_by_role('button',name='设置',exact=True).click()
def events(p,name):
 settings(p);p.get_by_text('本次试玩记录与隐私',exact=True).click()
 with p.expect_download() as d:p.get_by_role('button',name='导出本次试玩记录',exact=True).click()
 path=OUT/(name+'.json');d.value.save_as(str(path));return json.loads(path.read_text())
def liu(p):
 p.get_by_role('button',name='附近',exact=True).click();p.locator('.nearby-list').get_by_role('button',name='一纸春风',exact=False).click()
errors=[];external=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True);p=c.new_page();p.set_default_timeout(12000)
 p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:external.append(r.url) if not r.url.startswith(('http://127.0.0.1:5175/','data:','blob:')) else None)
 p.goto('http://127.0.0.1:5175/?source=journal&email=synthetic-private#synthetic-private',wait_until='domcontentloaded')
 p.get_by_role('button',name='回看时段，当前晨光',exact=True).click();expect(p.get_by_role('button',name='暮色 · 尚未到达',exact=True)).to_be_disabled();close(p)
 p.get_by_role('button',name='入画',exact=True).click();liu(p);p.get_by_role('button',name='替他压住画纸',exact=False).click();p.get_by_role('button',name='落笔，记下此景',exact=False).click();p.get_by_role('button',name='看看刚留下的画',exact=False).click()
 with p.expect_download() as d:p.get_by_role('button',name='保存清晰留念图',exact=True).click()
 d.value.save_as(str(OUT/'paper.png'))
 # Actual export failure retains the page and emits a fixed error code.
 p.evaluate("()=>{window.realBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(cb){cb(null)}}")
 p.get_by_role('button',name='保存清晰留念图',exact=True).click();expect(p.get_by_text('保存图片失败，请重试。',exact=True)).to_be_visible();p.evaluate('()=>{HTMLCanvasElement.prototype.toBlob=window.realBlob}')
 close(p);liu(p);p.get_by_role('button',name='再换一个视角',exact=False).click();p.get_by_role('button',name='替他压住画纸',exact=False).click();p.get_by_role('button',name='落笔，记下此景',exact=False).click();close(p)
 p.locator('.main-nav').get_by_role('button',name='画册',exact=False).click();close(p);p.locator('.main-nav').get_by_role('button',name='画册',exact=False).click()
 snap=events(p,'first-session');es=snap['events']
 assert len([e for e in es if e['type']=='world_entered'])==1
 assert len([e for e in es if e['type']=='first_interaction_completed'])==1
 assert len([e for e in es if e['type']=='story_started'])==2
 assert [e['first_completion'] for e in es if e['type']=='story_completed']==[True,False]
 assert len([e for e in es if e['type']=='journal_opened'])==2
 assert any(e['type']=='journal_export_completed' and e['stage']=='download_requested' for e in es)
 assert any(e['type']=='error' and e['code']=='postcard_export_failed' for e in es)
 assert 'synthetic-private' not in json.dumps(snap)
 assert p.evaluate('Object.keys(localStorage)')==[KEY]
 old_id=snap['session_id'];p.reload(wait_until='domcontentloaded');snap=events(p,'revisit-session');assert snap['session_id']!=old_id
 assert len([e for e in snap['events'] if e['type']=='revisit'])==1
 assert not any(e['type'] in ['story_started','story_completed'] for e in snap['events'])
 # Import completed progress: no synthetic starts/completions, old setting defaults to auto.
 legacy=p.evaluate("""async()=>{const{initialState,reduceGame}=await import('/src/game.ts');let s=initialState();for(const a of [{type:'PRESS_PAPER'},{type:'SKETCH',view:'hands'},{type:'GATE_TALK'},{type:'GATE_LANDMARK',landmark:'silk'},{type:'GATE_WAIT',place:'eaves'},{type:'GATE_SKETCH'},{type:'HARBOR_TALK'},{type:'HARBOR_PLACE',place:'eaves'},{type:'HARBOR_CLEAR',move:'basket'},{type:'HARBOR_SKETCH'}])s=reduceGame(s,a);delete s.settings.timeChoice;s.started=true;return s;}""")
 p.locator('input[type=file]').set_input_files({'name':'old-v3.json','mimeType':'application/json','buffer':json.dumps(legacy).encode()});expect(p.get_by_text('存档已接续，欢迎回到汴河。',exact=True)).to_be_visible()
 snap=events(p,'after-import');assert not any(e['type'] in ['story_started','story_completed'] for e in snap['events'])
 close(p);p.get_by_role('button',name='回看时段，当前暮色',exact=True).click();p.get_by_role('button',name='晨光',exact=True).focus();p.keyboard.press('Enter');close(p)
 assert state(p)['wallet']==72 and state(p)['settings']['timeChoice']=='morning'
 p.reload(wait_until='domcontentloaded');expect(p.get_by_role('button',name='回看时段，当前晨光',exact=True)).to_be_visible()
 p.get_by_role('button',name='回看时段，当前晨光',exact=True).click();p.get_by_role('button',name='随故事流转',exact=True).click();close(p);expect(p.get_by_role('button',name='回看时段，当前暮色',exact=True)).to_be_visible()
 settings(p);p.locator('input[type=file]').set_input_files({'name':'broken.json','mimeType':'application/json','buffer':b'{synthetic-private'})
 snap=events(p,'after-invalid-import');assert any(e['type']=='error' and e['code']=='save_import_failed' for e in snap['events']);assert state(p)['wallet']==72
 c.close()
 for width in [360,390]:
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True);p=c.new_page();p.goto('http://127.0.0.1:5175/',wait_until='domcontentloaded');settings(p);p.get_by_role('checkbox',name='大字阅读',exact=False).check();close(p)
  p.get_by_role('button',name='回看时段，当前晨光',exact=True).click()
  assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert p.locator('.sheet-content').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
  p.screenshot(path=str(OUT/f'time-{width}-large.png'));c.close()
 # Storage writes fail without exposing the raw exception in exported records.
 c=b.new_context(accept_downloads=True);p=c.new_page();p.add_init_script("Storage.prototype.setItem=function(){throw new Error('synthetic-private')}");p.goto('http://127.0.0.1:5175/',wait_until='domcontentloaded')
 snap=events(p,'write-failure');assert any(e['type']=='error' and e['code']=='save_write_failed' for e in snap['events']);assert 'synthetic-private' not in json.dumps(snap);c.close();b.close()
assert not errors,errors
assert not external,external
result={'first_session_once':True,'replay_first_completion':[True,False],'real_export_success_and_failure':True,'journal_each_open':True,'revisit_new_session_id':True,'import_does_not_backfill':True,'time_selection_persists':True,'future_times_disabled':True,'wallet_preserved':True,'widths':[360,390],'text_percent':150,'fixed_errors_only':True,'no_new_storage_keys':True,'external_requests':external,'page_errors':errors}
(OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
