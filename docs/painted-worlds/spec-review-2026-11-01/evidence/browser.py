from pathlib import Path
import json
from playwright.sync_api import sync_playwright,expect
OUT=Path('/workspace/.cloud-setup/spec-audit');OUT.mkdir(parents=True,exist_ok=True)
result={};errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 c=b.new_context(viewport={'width':390,'height':844});pg=c.new_page();pg.set_default_timeout(12000)
 pg.goto('http://127.0.0.1:5180/edo/',wait_until='domcontentloaded');pg.get_by_role('button',name='絵巻に入る',exact=True).click();pg.get_by_role('button',name='設定',exact=True).click()
 before=pg.evaluate("({tag:document.activeElement.tagName,text:document.activeElement.textContent,inside:!!document.activeElement.closest('[role=dialog]')})")
 pg.keyboard.press('Tab');after=pg.evaluate("({tag:document.activeElement.tagName,text:document.activeElement.textContent,inside:!!document.activeElement.closest('[role=dialog]')})")
 pg.keyboard.press('Escape');result['edo_dialog_focus']={'after_open':before,'after_tab':after,'escape_leaves_dialog_open':pg.get_by_role('dialog').count()==1}
 pg.screenshot(path=str(OUT/'edo-dialog-focus.png'))
 # A synthetically malformed same-world save imported via the actual UI.
 malformed=pg.evaluate("async()=>{const {newSave}=await import('/edo/src/engine/state.ts');const s=newSave();s.journal.pages=[{pageId:'unknown-page',compositionId:'unknown-composition',titleStyle:'plain',madeAt:new Date().toISOString()}];return s;}")
 pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.locator('input[type=file]').set_input_files({'name':'synthetic-unknown-page.json','mimeType':'application/json','buffer':json.dumps(malformed).encode()})
 expect(pg.get_by_text('記録を読み込みました。',exact=True)).to_be_visible();pg.get_by_role('button',name='町に戻る',exact=True).click();pg.get_by_role('button',name='絵巻帳',exact=False).click()
 pg.wait_for_timeout(200);result['edo_unknown_page']={'import_accepted':True,'errors':errors,'root_empty':pg.locator('#root').inner_html()==''}
 pg.screenshot(path=str(OUT/'edo-unknown-page.png'));c.close()
 # Backup writes fail but updating an existing key works; no real user data.
 c=b.new_context(viewport={'width':390,'height':844});pg=c.new_page()
 pg.add_init_script("""(()=>{const set=Storage.prototype.setItem;set.call(localStorage,'ww:qingming-edo:save','{synthetic-corrupt');Storage.prototype.setItem=function(k,v){if(k.includes('save-corrupt-'))throw new DOMException('synthetic quota','QuotaExceededError');return set.call(this,k,v);};})()""")
 pg.goto('http://127.0.0.1:5180/edo/',wait_until='domcontentloaded')
 original=pg.evaluate("localStorage.getItem('ww:qingming-edo:save')")
 pg.get_by_role('button',name='設定',exact=True).click();pg.get_by_role('checkbox',name='動きを減らす',exact=True).check()
 after=pg.evaluate("({raw:localStorage.getItem('ww:qingming-edo:save'),keys:Object.keys(localStorage)})")
 result['edo_backup_failure']={'original':original,'original_replaced':after['raw']!=original,'backup_keys':[k for k in after['keys'] if 'save-corrupt-' in k]}
 pg.screenshot(path=str(OUT/'edo-backup-failure.png'));c.close()
 # Narrow-screen settings at150%, both applications, no forced errors.
 result['narrow']={}
 for world,url in [('china','http://127.0.0.1:5175/'),('edo','http://127.0.0.1:5180/edo/')]:
  for width in [360,390]:
   c=b.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True);pg=c.new_page();pg.goto(url,wait_until='domcontentloaded')
   if world=='china':
    pg.get_by_role('button',name='入画',exact=True).click();pg.get_by_role('button',name='设置',exact=True).click();pg.get_by_role('checkbox',name='大字阅读',exact=False).check()
   else:
    pg.get_by_role('button',name='絵巻に入る',exact=True).click();pg.get_by_role('button',name='設定',exact=True).click();pg.get_by_role('button',name='もっと大きく',exact=True).click()
   assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth')
   result['narrow'][world+'-'+str(width)]={'text_percent':150,'no_document_horizontal_overflow':True}
   pg.screenshot(path=str(OUT/(world+'-'+str(width)+'-settings.png')));c.close()
 b.close()
(OUT/'browser.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
