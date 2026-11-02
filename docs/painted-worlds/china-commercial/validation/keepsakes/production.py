from pathlib import Path
import json
from playwright.sync_api import sync_playwright,expect
errors=[];results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for base in ['http://127.0.0.1:5176/','http://127.0.0.1:5177/qingming/']:
  for study in ['night-return','souvenirs']:
   c=b.new_context(viewport={'width':390,'height':844});page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:errors.append(str(r.status)+' '+r.url) if r.status>=400 else None)
   page.goto(base+'?study='+study+'&souvenir=qingming-china-keepsake-tea&world=qingming-china&purpose=gift',wait_until='networkidle')
   assert page.locator('dialog[open]').count()==0
   page.get_by_role('button',name='行囊',exact=True).click();assert page.get_by_role('button',name='打开数字纪念小铺',exact=True).count()==0
   page.get_by_role('button',name='返回街上',exact=True).click();page.get_by_role('button',name='画册',exact=True).click()
   assert page.locator('.album-card').count()==14 and page.locator('.night-study').count()==0
   assert not any(title in page.locator('body').inner_text() for title in ['汴河夜归','平安纸签','同行灯笺','茶暖小笺','汴河纪念小铺'])
   state=page.evaluate("JSON.parse(localStorage.getItem('ww:qingming-china:save:v1'))")
   assert state['saveVersion']==3 and state['wallet']==60 and not state['journal'] and not state['claimed']
   results.append({'path':'root' if ':5176' in base else '/qingming/','query':study,'study_hidden':True,'shop_hidden':True,'album_pages':14,'save_version':3})
   c.close()
 b.close()
for path in [Path('apps/qingming-china/dist/assets'),Path('dist/qingming/assets')]:
 code=''.join(p.read_text() for p in path.glob('*.js'))
 assert not any(title in code for title in ['汴河夜归','平安纸签','同行灯笺','茶暖小笺','汴河纪念小铺'])
assert not errors,errors
out={'checks':results,'product_titles_absent_from_production_js':True,'assets_errors':errors}
Path('/workspace/.cloud-setup/keepsakes/production.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps(out,ensure_ascii=False,indent=2))
