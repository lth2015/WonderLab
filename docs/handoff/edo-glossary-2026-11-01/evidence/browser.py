from pathlib import Path
import json,re,time
from playwright.sync_api import sync_playwright,expect
OUT=Path('/workspace/.cloud-setup/review153');errors=[];checks=[]
def settings(p):p.get_by_role('button',name='設定',exact=True).click()
def person(p):
 p.get_by_role('button',name='近くのこと',exact=True).click();p.locator('.list.compact').get_by_role('button',name='清太',exact=False).click()
def export(p,path):
 settings(p);p.get_by_text('この回の試遊の記録とプライバシー',exact=True).click()
 with p.expect_download() as e:p.get_by_role('button',name='この回の試遊の記録を書き出す',exact=True).click()
 e.value.save_as(str(path));return json.loads(path.read_text())
AUDIO="""const Native=window.AudioContext;window.contexts=[];window.AudioContext=class extends Native{constructor(...a){super(...a);window.contexts.push(this)}};"""
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for width in [360,390]:
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True,accept_downloads=True);p=c.new_page();p.set_default_timeout(12000);p.add_init_script(AUDIO);p.on('pageerror',lambda e:errors.append(str(e)));p.goto('http://127.0.0.1:5180/edo/',wait_until='domcontentloaded')
  assert p.evaluate('contexts.length')==0;p.get_by_role('button',name='絵巻に入る',exact=True).click();assert p.evaluate('contexts.length')==0
  settings(p);p.get_by_role('button',name='もっと大きく',exact=True).click();p.get_by_role('button',name='町に戻る',exact=True).click();person(p);p.get_by_role('button',name='次へ',exact=True).click();p.get_by_role('button',name='文鎮で押さえる',exact=True).click()
  term=p.get_by_role('button',name='文鎮（ぶんちん）の説明',exact=True);before=p.evaluate("localStorage.getItem('ww:qingming-edo:save')");term.focus();term.press('Enter');expect(p.get_by_role('note')).to_be_visible();assert '紙が風で動かないように、上に置く重し。' in p.get_by_role('note').inner_text();assert p.evaluate("localStorage.getItem('ww:qingming-edo:save')")==before
  assert p.get_by_role('dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth');p.screenshot(path=str(OUT/f'glossary-{width}-large.png'));p.get_by_role('button',name='次へ',exact=True).click();expect(p.get_by_role('note')).to_have_count(0)
  p.get_by_role('button',name='音を出す',exact=True).click();p.wait_for_function("contexts.length===1&&contexts[0].state==='running'");p.get_by_role('button',name='音を止める',exact=True).click();p.wait_for_function("contexts[0].state==='suspended'")
  p.reload(wait_until='domcontentloaded');expect(p.get_by_role('button',name='音を出す',exact=True)).to_have_attribute('aria-pressed','false');assert p.evaluate('contexts.length')==0
  p.get_by_role('button',name='音を出す',exact=True).click();p.reload(wait_until='domcontentloaded');expect(p.get_by_role('button',name='音を止める',exact=True)).to_have_attribute('aria-pressed','true');assert p.evaluate('contexts.length')==0
  p.get_by_role('button',name='絵巻の続きへ',exact=True).click()
  for name in ['桶屋の店先','日本橋']:
   p.get_by_role('button',name='近くのこと',exact=True).click();p.get_by_text('通りの案内',exact=True).click();p.get_by_role('navigation',name='通りの案内').get_by_role('button',name=name,exact=False).click()
  snap=export(p,OUT/f'guide-events-{width}.json');selected=[e['stop_id'] for e in snap['events'] if e['type']=='guide_stop_selected'];assert selected==['cooper','bridge'];assert not any(e['type']=='first_interaction_completed' for e in snap['events'])
  checks.append({'width':width,'text_percent':150,'term_keyboard':True,'note_clear_on_new_line':True,'lookup_does_not_change_save':True,'default_mute_even_after_enter':True,'explicit_audio_running_then_suspended':True,'audio_choice_persists':True,'guide_events':selected,'navigation_not_first_interaction':True});c.close()
 # Real UI: a delayed generated line is cancelled and then falls back at eight seconds.
 c=b.new_context(viewport={'width':390,'height':844});p=c.new_page();p.set_default_timeout(12000);p.on('pageerror',lambda e:errors.append(str(e)));p.add_init_script("const nativeFetch=window.fetch.bind(window);window.fetch=(url,options)=>String(url).includes('/api/edo/talk')?new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true})):nativeFetch(url,options);");p.goto('http://127.0.0.1:5180/edo/',wait_until='domcontentloaded')
 fixture=p.evaluate("""async()=>{const {newSave,apply}=await import('/edo/src/engine/state.ts');const{questById}=await import('/edo/src/content/world.ts');let s=apply(newSave(),questById.get('kaze').completionEffects);s.progress.flags.push('kaze_page','kaze_thanked','met_seita');return s;}""")
 settings(p);p.locator('input[type=file]').set_input_files({'name':'completed-kaze.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()});p.get_by_role('button',name='町に戻る',exact=True).click();p.get_by_role('button',name='絵巻の続きへ',exact=True).click();person(p);p.get_by_role('button',name='少し話す',exact=True).click()
 before=p.evaluate("localStorage.getItem('ww:qingming-edo:save')");p.get_by_role('button',name='仕事のこと',exact=True).click();expect(p.get_by_text('清太は少し考えている……',exact=True)).to_be_visible(timeout=2000);p.get_by_role('button',name='やめる',exact=True).click();expect(p.get_by_role('button',name='仕事のこと',exact=True)).to_be_visible();assert p.locator('.talk .said').count()==0
 started=time.monotonic();p.get_by_role('button',name='仕事のこと',exact=True).click();expected='紙は湿り気が大敵でして。朝いちばんに束をほどいて、風を通してから並べるんです。';expect(p.get_by_text(expected,exact=True)).to_be_visible(timeout=10500);elapsed=time.monotonic()-started;assert 7.5<=elapsed<=10.5,elapsed;assert p.evaluate("localStorage.getItem('ww:qingming-edo:save')")==before
 p.screenshot(path=str(OUT/'timeout-script-fallback.png'));c.close();b.close()
assert not errors,errors
result={'checks':checks,'cancellable_wait_within_2s':True,'cancel_not_a_turn':True,'fallback_after_seconds':round(elapsed,2),'timeout_preserves_save':True,'page_errors':errors}
(OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
