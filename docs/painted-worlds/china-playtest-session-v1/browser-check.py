from pathlib import Path
import json
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
OUT=Path(__file__).resolve().parent / 'evidence';NORMAL='ww:qingming-china:save:v1';GAME=NORMAL+':session';LOG='ww:qingming-china:study:session';errors=[];external=[]
def read(p,k):return p.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',k)
def raw(p,k):return p.evaluate('(key)=>localStorage.getItem(key)',k)
def settings(p):
 if p.locator('dialog[open]').count():p.get_by_role('button',name='返回街上',exact=True).click()
 p.get_by_role('button',name='设置',exact=True).click()
def paper(p):
 p.get_by_role('button',name='附近',exact=True).click();p.locator('.nearby-list').get_by_role('button',name='一纸春风',exact=False).click()
def export(p,label):
 settings(p)
 with p.expect_download() as e:p.get_by_role('button',name='导出本位记录',exact=True).click()
 file=OUT/(label+'.json');e.value.save_as(str(file));data=json.loads(file.read_text());assert data['session_id'][:8] in e.value.suggested_filename;return data
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for width in [360,390]:
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True,accept_downloads=True);p=c.new_page();p.set_default_timeout(12000);p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:external.append(r.url) if not r.url.startswith(('http://127.0.0.1:5175/','data:','blob:')) else None)
  p.goto('http://127.0.0.1:5175/',wait_until='domcontentloaded')
  p.get_by_role('button',name='入画',exact=True).click();paper(p);p.get_by_role('button',name='替他压住画纸',exact=False).click();p.get_by_role('button',name='落笔，记下此景',exact=False).click();p.get_by_role('button',name='返回街上',exact=True).click();ordinary=raw(p,NORMAL)
  p.goto('http://127.0.0.1:5175/?session=1&email=synthetic-private#synthetic-private',wait_until='domcontentloaded');expect(p.get_by_text('试玩会',exact=True)).to_be_visible();assert read(p,GAME)['wallet']==60 and read(p,GAME)['journal']==[] and raw(p,NORMAL)==ordinary
  p.get_by_role('button',name='入画',exact=True).tap();settings(p);p.get_by_role('checkbox',name='大字阅读',exact=False).check();p.get_by_role('button',name='返回街上',exact=True).click();paper(p);p.get_by_role('button',name='替他压住画纸',exact=False).click();p.get_by_role('button',name='落笔，记下此景',exact=False).click()
  first=read(p,LOG);sid=first['session_id'];start=first['started_wall'];assert first['events'][-1]['environment']=='playtest-session';p.reload(wait_until='domcontentloaded')
  after=read(p,LOG);assert after['session_id']==sid and after['started_wall']==start and read(p,GAME)['wallet']==72
  paper(p);p.get_by_role('button',name='再换一个视角',exact=False).click();p.get_by_role('button',name='替他压住画纸',exact=False).click();p.get_by_role('button',name='落笔，记下此景',exact=False).click()
  one=export(p,f'player1-{width}');es=one['events'];assert one['environment']=='playtest-session' and one['session_id']==sid
  assert len([e for e in es if e['type']=='world_entered'])==1 and len([e for e in es if e['type']=='first_interaction_completed'])==1
  assert [e['first_completion'] for e in es if e['type']=='story_completed']==[True,False]
  assert not any(e['type']=='revisit' for e in es);assert es[-1]['elapsed_ms']>=first['events'][-1]['elapsed_ms'];assert 'synthetic-private' not in json.dumps(one)
  assert p.locator('.sheet-content').evaluate('(e)=>e.scrollWidth<=e.clientWidth');assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
  p.screenshot(path=str(OUT/f'facilitator-{width}-large.png'))
  before=raw(p,GAME);p.get_by_role('button',name='下一位',exact=True).click();p.get_by_role('button',name='继续本位试玩',exact=True).click();assert raw(p,GAME)==before and read(p,LOG)['session_id']==sid
  p.get_by_role('button',name='下一位',exact=True).click();p.get_by_role('button',name='确认开始下一位',exact=True).click();p.wait_for_url('**/?session=1');expect(p.get_by_role('button',name='入画',exact=True)).to_be_visible()
  two=read(p,LOG);assert two['session_id']!=sid and len(two['events'])==1 and two['events'][0]['type']=='world_entered';assert read(p,GAME)['wallet']==60 and read(p,GAME)['journal']==[];assert raw(p,NORMAL)==ordinary
  assert parse_qs(urlparse(p.url).query)=={'session':['1']} and not urlparse(p.url).fragment
  two=export(p,f'player2-{width}');assert len(two['events'])==1
  kept_log=raw(p,LOG);kept_game=raw(p,GAME)
  p.goto('http://127.0.0.1:5175/',wait_until='domcontentloaded');assert p.get_by_text('试玩会',exact=True).count()==0;assert read(p,NORMAL)['wallet']==72 and read(p,NORMAL)['journal']==['paper-hands'];settings(p);assert p.get_by_role('button',name='下一位',exact=True).count()==0
  p.get_by_text('本次试玩记录与隐私',exact=True).click()
  with p.expect_download() as d:p.get_by_role('button',name='导出本次试玩记录',exact=True).click()
  normalfile=OUT/f'normal-{width}.json';d.value.save_as(str(normalfile));normal=json.loads(normalfile.read_text());assert normal['environment']=='development' and normal['session_id']!=two['session_id'];assert raw(p,LOG)==kept_log and raw(p,GAME)==kept_game
  assert set(p.evaluate('Object.keys(localStorage)'))=={NORMAL,GAME,LOG}
  p.goto('http://127.0.0.1:5175/?session=0',wait_until='domcontentloaded');assert p.get_by_text('试玩会',exact=True).count()==0 and raw(p,LOG)==kept_log
  # Corrupt only the playtest log; a fresh record is made without touching ordinary progress.
  p.evaluate('([k,v])=>localStorage.setItem(k,v)',[LOG,'{synthetic-corrupt']);p.goto('http://127.0.0.1:5175/?session=1',wait_until='domcontentloaded');assert read(p,LOG)['session_id']!=two['session_id'];assert len(read(p,LOG)['events'])==1 and raw(p,NORMAL)==ordinary
  c.close()
 b.close()
assert not errors,errors
assert not external,external
result={'widths':[360,390],'text_percent':150,'ordinary_progress_unchanged':True,'isolated_game_keys':True,'refresh_same_player_and_wall_start':True,'once_persists':True,'replay_completion':[True,False],'no_revisit_in_session':True,'cancel_next_preserves_player':True,'confirm_next_new_id_fresh_game':True,'filename_has_player_id_prefix':True,'normal_mode_leaves_session_keys_untouched':True,'session_0_normal':True,'corrupt_log_new_player':True,'no_extra_storage_keys':True,'external_requests':external,'page_errors':errors}
(OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
