from pathlib import Path
import json
from playwright.sync_api import sync_playwright
out=Path('/workspace/.cloud-setup/spec-audit');errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']);c=b.new_context(viewport={'width':390,'height':844});pg=c.new_page();pg.set_default_timeout(12000)
 pg.add_init_script("""Object.defineProperty(navigator,'share',{value:async()=>window.shareCalled=true});Object.defineProperty(navigator,'canShare',{value:()=>{window.capabilityCalled=true;throw new Error('synthetic canShare failure')}});""")
 pg.goto('http://127.0.0.1:5180/edo/',wait_until='domcontentloaded')
 fixture=pg.evaluate("async()=>{const {newSave}=await import('/edo/src/engine/state.ts');const s=newSave();s.journal.pages=[{pageId:'p01-kaze',compositionId:'kaze-hands-wide',titleStyle:'plain',madeAt:new Date().toISOString()}];return s;}")
 pg.get_by_role('button',name='設定',exact=True).click();pg.locator('input[type=file]').set_input_files({'name':'synthetic-valid-page.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()});pg.get_by_role('button',name='町に戻る',exact=True).click();pg.get_by_role('button',name='絵巻に入る',exact=True).click();pg.get_by_role('button',name='絵巻帳',exact=False).click();pg.locator('.slots button.filled').first.click()
 pg.wait_for_timeout(1200);pg.on('pageerror',lambda e:errors.append(str(e)));pg.get_by_role('button',name='共有する',exact=True).click();pg.wait_for_timeout(150)
 data={'canShare_called':pg.evaluate('window.capabilityCalled===true'),'share_called':pg.evaluate('window.shareCalled===true'),'errors':errors,'failure_fallback_shown':pg.get_by_text('共有できませんでした。画像を保存するか、リンクをコピーしてください。',exact=True).count()>0}
 pg.screenshot(path=str(out/'edo-share-probe.png'));(out/'share.json').write_text(json.dumps(data,ensure_ascii=False,indent=2));print(json.dumps(data,ensure_ascii=False,indent=2));b.close()
