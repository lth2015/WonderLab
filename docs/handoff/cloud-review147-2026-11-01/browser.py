from pathlib import Path
import json
from playwright.sync_api import sync_playwright,expect
OUT=Path('/workspace/.cloud-setup/review147');KEY='ww:qingming-edo:save';errors=[];result={}
def go(b):
 c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True);p=c.new_page();p.set_default_timeout(10000);p.on('pageerror',lambda e:errors.append(str(e)));return c,p
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 c,p=go(b);p.goto('http://127.0.0.1:5180/edo/',wait_until='domcontentloaded');p.get_by_role('button',name='絵巻に入る',exact=True).click();p.get_by_role('button',name='設定',exact=True).click()
 p.wait_for_function("!!document.activeElement.closest('.panel[role=dialog]')")
 for _ in range(35):
  p.keyboard.press('Tab');assert p.evaluate("!!document.activeElement.closest('.panel[role=dialog]')")
 for _ in range(5):
  p.keyboard.press('Shift+Tab');assert p.evaluate("!!document.activeElement.closest('.panel[role=dialog]')")
 p.keyboard.press('Escape');assert p.get_by_role('dialog').count()==0;assert p.evaluate("document.activeElement.textContent.trim()")=='設定'
 result['F03_settings_focus_trap_escape_restore']=True
 p.get_by_role('button',name='設定',exact=True).click()
 malformed=p.evaluate("async()=>{const {newSave}=await import('/edo/src/engine/state.ts');const s=newSave();s.journal.pages=[{pageId:'unknown-page',compositionId:'unknown-composition',titleStyle:'plain',madeAt:new Date().toISOString()}];return s;}")
 before=p.evaluate("localStorage.getItem('"+KEY+"')")
 p.locator('input[type=file]').set_input_files({'name':'synthetic-unknown-page.json','mimeType':'application/json','buffer':json.dumps(malformed).encode()});expect(p.get_by_text('この作品の記録として読めませんでした。今の記録はそのままです。',exact=True)).to_be_visible()
 assert p.evaluate("localStorage.getItem('"+KEY+"')")==before
 p.get_by_role('button',name='町に戻る',exact=True).click();p.get_by_role('button',name='絵巻帳',exact=True).click();expect(p.get_by_role('heading',name='絵巻帳',exact=True)).to_be_visible();p.screenshot(path=str(OUT/'invalid-import-preserved.png'));result['F01_rejects_unknown_page_preserves_save_no_white_screen']=True;c.close()
 result['F02']={}
 for mode in ['throw','mismatch']:
  c,p=go(b);p.add_init_script("""(()=>{const real=Storage.prototype.setItem;real.call(localStorage,'ww:qingming-edo:save','{synthetic-corrupt');Storage.prototype.setItem=function(k,v){if(k.includes('save-corrupt-')){"""+("throw new DOMException('quota','QuotaExceededError');" if mode=='throw' else "return real.call(this,k,'mismatch');")+"""}return real.call(this,k,v);};})()""")
  p.goto('http://127.0.0.1:5180/edo/',wait_until='domcontentloaded');p.get_by_role('button',name='設定',exact=True).click();p.get_by_role('checkbox',name='動きを減らす',exact=True).check()
  assert p.evaluate("localStorage.getItem('"+KEY+"')")=='{synthetic-corrupt'
  with p.expect_download() as e:p.get_by_role('button',name='読めなかった記録を書き出す',exact=True).click()
  path=OUT/('unbacked-'+mode+'.json');e.value.save_as(str(path));assert path.read_text()=='{synthetic-corrupt'
  p.screenshot(path=str(OUT/('unbacked-'+mode+'.png')))
  p.get_by_role('button',name='上書きして、ここで保存を始める',exact=True).click();assert json.loads(p.evaluate("localStorage.getItem('"+KEY+"')"))['worldId']=='qingming-edo'
  result['F02'][mode]={'original_preserved_before_choice':True,'download_original_exact':True,'explicit_overwrite_works':True};c.close()
 # Genuine failed writes display advice. Blocked storage getter is a separate case.
 for mode in ['write','getter']:
  c,p=go(b)
  script="Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')}" if mode=='write' else "Object.defineProperty(window,'localStorage',{get(){throw new DOMException('denied','SecurityError')}})"
  p.add_init_script(script);p.goto('http://127.0.0.1:5180/edo/',wait_until='domcontentloaded');p.get_by_role('button',name='設定',exact=True).click();p.get_by_role('checkbox',name='動きを減らす',exact=True).check()
  shown=p.get_by_text('この端末に記録を保存できませんでした。続けて遊べますが、閉じると消えます。設定の「記録を書き出す」で残せます。',exact=True).count()>0
  result['V04_'+mode+'_notice']=shown;p.screenshot(path=str(OUT/('storage-'+mode+'.png')));c.close()
 c,p=go(b)
 p.add_init_script("Object.defineProperty(navigator,'share',{value:async d=>{window.shared={url:d.url,files:d.files?.length??0}}});Object.defineProperty(navigator,'canShare',{value:()=>{window.probeCalled=true;throw new Error('synthetic probe')}})")
 p.goto('http://127.0.0.1:5180/edo/',wait_until='domcontentloaded');fixture=p.evaluate("async()=>{const {newSave}=await import('/edo/src/engine/state.ts');const s=newSave();s.journal.pages=[{pageId:'p01-kaze',compositionId:'kaze-hands-wide',titleStyle:'plain',madeAt:new Date().toISOString()}];return s;}")
 p.get_by_role('button',name='設定',exact=True).click();p.locator('input[type=file]').set_input_files({'name':'valid-page.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()});p.get_by_role('button',name='町に戻る',exact=True).click();p.get_by_role('button',name='絵巻に入る',exact=True).click();p.get_by_role('button',name='絵巻帳',exact=False).click();p.locator('.slots button.filled').first.click();p.wait_for_timeout(1200);p.get_by_role('button',name='共有する',exact=True).click()
 assert p.evaluate('window.probeCalled===true');shared=p.evaluate('window.shared');assert shared['files']==0 and shared['url'].endswith('/edo/?scene=nihonbashi');result['F04_probe_error_link_share']=True;c.close();b.close()
assert not errors,errors
result['page_errors']=errors
(OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
