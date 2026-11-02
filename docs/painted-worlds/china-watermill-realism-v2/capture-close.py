from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path(__file__).resolve().parent/'evidence'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']);c=b.new_context(viewport={'width':1280,'height':900},device_scale_factor=3);p=c.new_page();p.goto('http://127.0.0.1:5175/?session=1',wait_until='networkidle');p.get_by_role('button',name='入画',exact=True).click();p.get_by_role('button',name='附近',exact=True).click();p.get_by_text('以文字探索街巷',exact=True).click();p.get_by_role('dialog').get_by_role('button',name='看看水磨',exact=True).click();p.wait_for_selector('.watermill[data-ready=true]');p.wait_for_timeout(400)
 clip=p.locator('.watermill').evaluate('(e)=>{const m=e.getScreenCTM();return{x:m.e+445*m.a,y:m.f+450*m.d,width:365*m.a,height:370*m.d}}')
 p.screenshot(path=str(out/'closeup.png'),clip=clip);b.close()
