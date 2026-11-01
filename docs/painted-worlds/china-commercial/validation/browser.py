from pathlib import Path
import json
from urllib.parse import urlparse,parse_qs
from PIL import Image
from playwright.sync_api import sync_playwright, expect

OUT=Path('/workspace/.cloud-setup/china-commercial')
OUT.mkdir(parents=True,exist_ok=True)
KEY='ww:qingming-china:save:v1'
def snapshot(page):
 if page.locator('dialog[open]').count():page.get_by_role('button',name='返回街上',exact=True).click()
 page.get_by_role('button',name='设置',exact=True).click()
 page.get_by_text('本次体验记录与隐私',exact=True).click()
 with page.expect_download() as event:page.get_by_role('button',name='导出本次体验记录',exact=True).click()
 dest=OUT/'session-export.json';event.value.save_as(str(dest))
 return json.loads(dest.read_text())
def save_of(page):
 return page.evaluate("JSON.parse(localStorage.getItem('"+KEY+"'))")
def nearby_person(page,name):
 page.get_by_role('button',name='附近',exact=True).click()
 page.locator('summary',has_text='以文字探索街巷').click()
 page.locator('.text-route').get_by_role('button',name=name,exact=False).click()
def album_page(page):
 page.get_by_role('button',name='画册',exact=False).click()
 page.get_by_role('button',name='桥上人间，查看画页',exact=True).click()

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 errors=[];external=[]
 ctx=browser.new_context(viewport={'width':1280,'height':900},accept_downloads=True)
 page=ctx.new_page();page.set_default_timeout(12000)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:external.append(r.url) if urlparse(r.url).hostname not in [None,'127.0.0.1','localhost'] else None)
 page.add_init_script("""Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});
 Object.defineProperty(navigator,'share',{value:async d=>{if(window.cancelShare)throw new DOMException('cancel','AbortError');window.shared={files:d.files.length,size:d.files[0].size,url:d.url};},configurable:true});
 Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied=text;}},configurable:true});""")
 page.goto('http://127.0.0.1:5175/?study=night-return&source=journal&invite=synthetic-test#synthetic-private',wait_until='domcontentloaded')
 page.get_by_role('button',name='入画',exact=True).click()
 nearby_person(page,'小柳')
 page.get_by_role('button',name='替他压住画纸',exact=False).click()
 page.get_by_role('button',name='桥上的人',exact=True).click()
 page.get_by_role('combobox').select_option('河上清风')
 page.get_by_role('button',name='全景 · 切换构图',exact=True).click()
 page.get_by_role('button',name='落笔，记下此景',exact=False).click()
 page.get_by_role('button',name='看看刚留下的画',exact=False).click()
 expect(page.get_by_role('button',name='保存清晰留念图',exact=True)).to_be_enabled()
 with page.expect_download() as dl:
  page.get_by_role('button',name='保存清晰留念图',exact=True).click()
 dl.value.save_as(str(OUT/'postcard-bridge.png'))
 assert Image.open(OUT/'postcard-bridge.png').size==(1440,1800)
 page.get_by_role('button',name='分享画页',exact=True).click()
 assert page.evaluate('window.shared.files')==1
 assert page.evaluate('window.shared.size')>10000
 page.evaluate('window.cancelShare=true')
 original=save_of(page)
 page.get_by_role('button',name='分享画页',exact=True).click()
 expect(page.get_by_text('已取消分享，画页仍在。',exact=True)).to_be_visible()
 assert save_of(page)==original
 page.get_by_role('button',name='复制作品链接',exact=True).click()
 link=page.evaluate('window.copied')
 assert set(parse_qs(urlparse(link).query))=={'world','scene','source'}
 assert not urlparse(link).fragment and 'synthetic' not in link
 page.screenshot(path=str(OUT/'postcard-desktop.png'))
 page.get_by_role('button',name='回到画册',exact=True).click()
 page.locator('.night-study').scroll_into_view_if_needed()
 page.wait_for_timeout(150)
 page.get_by_role('button',name='我想继续逛',exact=True).click()
 page.get_by_role('button',name='本次兴趣已记下',exact=True).click()
 page.get_by_role('button',name='试走一段《桥边留一盏》',exact=True).click()
 page.get_by_role('button',name='问问哪里还需要光',exact=True).click()
 page.get_by_role('button',name='都留在桥面',exact=True).click()
 expect(page.get_by_text('桥面虽亮了，下船的石阶仍看不清。再看看两处暗的地方。',exact=True)).to_be_visible()
 page.get_by_role('button',name='一盏照石阶，一盏照弯道',exact=True).click()
 page.get_by_role('button',name='等船靠稳，再一道收灯',exact=True).click()
 assert save_of(page)==original
 page.locator('.night-scene').screenshot(path=str(OUT/'night-sample-complete.png'))
 page.get_by_role('button',name='再走一遍',exact=True).click()
 page.get_by_role('button',name='问问哪里还需要光',exact=True).click()
 page.get_by_role('button',name='一盏照石阶，一盏照弯道',exact=True).click()
 page.get_by_role('button',name='等船靠稳，再一道收灯',exact=True).click()
 events=snapshot(page)['events']
 assert len([e for e in events if e['type']=='world_entered'])==1
 assert len([e for e in events if e['type']=='first_interaction_completed'])==1
 assert len([e for e in events if e['type']=='interest_registered'])==1
 assert [e['first_completion'] for e in events if e['type']=='story_completed' and e['story_id']=='night-lantern']==[True,False]
 assert any(e['type']=='share_result' and e['result']=='cancelled' for e in events)
 (OUT/'session-events.json').write_text(json.dumps(snapshot(page),ensure_ascii=False,indent=2))
 page.get_by_role('button',name='返回街上',exact=True).click()
 nearby_person(page,'周伯')
 page.get_by_role('button',name='帮周伯理好绳索',exact=False).click()
 page.get_by_role('button',name='选择圆环绳结',exact=True).click()
 page.get_by_role('button',name='系在圆环绳结的系缆点',exact=True).click()
 assert save_of(page)['progress']['ropes']==[0]
 page.get_by_role('button',name='返回街上',exact=True).click()
 surface=page.locator('.scroll-surface'); box=surface.bounding_box()
 before=page.locator('.world-strip').get_attribute('style')
 page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.65)
 page.mouse.down();page.mouse.move(box['x']+box['width']*.5+80,box['y']+box['height']*.65,steps=8);page.mouse.up()
 assert before!=page.locator('.world-strip').get_attribute('style')
 assert page.locator('dialog[open]').count()==0
 persisted=save_of(page)
 page.reload(wait_until='domcontentloaded')
 assert save_of(page)['progress']['ropes']==[0]
 assert len([e for e in snapshot(page)['events'] if e['type']=='story_completed'])==0
 ctx.close()

 # A genuine image-preparation failure, then retry and unsupported-share/manual-copy fallback.
 ctx=browser.new_context(viewport={'width':390,'height':844},accept_downloads=True,is_mobile=True,has_touch=True)
 page=ctx.new_page();page.set_default_timeout(12000)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("""window.realBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(cb){cb(null)};
 Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});
 Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('denied')}},configurable:true});""")
 page.goto('http://127.0.0.1:5175/',wait_until='domcontentloaded')
 page.evaluate("s=>localStorage.setItem('"+KEY+"',JSON.stringify(s))",persisted)
 page.reload(wait_until='domcontentloaded')
 album_page(page)
 expect(page.get_by_role('button',name='重新生成画页',exact=True)).to_be_visible()
 assert 'paper-bridge' in save_of(page)['journal']
 page.screenshot(path=str(OUT/'export-failure-mobile.png'))
 page.evaluate('()=>{HTMLCanvasElement.prototype.toBlob=window.realBlob;}')
 page.get_by_role('button',name='重新生成画页',exact=True).click()
 expect(page.get_by_role('button',name='保存清晰留念图',exact=True)).to_be_enabled()
 page.get_by_role('button',name='分享画页',exact=True).click()
 expect(page.get_by_text('系统分享不可用。可以保存清晰图片，或复制作品链接。',exact=True)).to_be_visible()
 page.get_by_role('button',name='复制作品链接',exact=True).click()
 expect(page.get_by_role('textbox',name='作品链接',exact=True)).to_be_visible()
 page.screenshot(path=str(OUT/'share-fallback-mobile.png'))
 page.get_by_role('button',name='返回街上',exact=True).click()
 page.get_by_role('button',name='设置',exact=True).click()
 page.get_by_role('checkbox',name='大字阅读',exact=False).check()
 page.get_by_role('button',name='返回街上',exact=True).click()
 album_page(page)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 background_before=page.locator('.world-strip').get_attribute('style')
 panel=page.locator('dialog[open]');rect=panel.bounding_box()
 touch=ctx.new_cdp_session(page)
 x=rect['x']+rect['width']*.5;y=rect['y']+rect['height']*.7
 touch.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
 touch.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y-100}]})
 touch.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 assert background_before==page.locator('.world-strip').get_attribute('style')
 page.get_by_role('button',name='返回街上',exact=True).tap()
 surface=page.locator('.scroll-surface');rect=surface.bounding_box()
 x=rect['x']+rect['width']*.5;y=rect['y']+rect['height']*.65
 before_touch=page.locator('.world-strip').get_attribute('style')
 touch.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
 for dx in [20,40,60,80]:
  touch.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx,'y':y}]})
 touch.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 assert before_touch!=page.locator('.world-strip').get_attribute('style')
 assert page.locator('dialog[open]').count()==0
 ctx.close()
 browser.close()
 assert not errors,errors
 assert not external,external
 (OUT/'browser-result.json').write_text(json.dumps({'first_story':True,'second_interaction':True,'drag_separated_from_tap':True,'persisted':True,'postcard':[1440,1800],'share_mock_invoked_cancelled':True,'image_failure_retry':True,'unsupported_share_manual_copy':True,'local_events_only':True,'sample_no_free_save_change':True,'mobile_150_percent':True,'page_errors':errors,'external_requests':external},indent=2))
 print('PASS Chinese commercial study browser flow, postcard, failure recovery and share fallbacks')

