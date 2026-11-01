from pathlib import Path
import json,hashlib
from urllib.parse import urlparse,parse_qs
from PIL import Image
from playwright.sync_api import sync_playwright,expect
OUT=Path('/workspace/.cloud-setup/keepsakes');OUT.mkdir(parents=True,exist_ok=True)
KEY='ww:qingming-china:save:v1'
def game(page):return page.evaluate("JSON.parse(localStorage.getItem('"+KEY+"'))")
errors=[];external=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 ctx=browser.new_context(viewport={'width':1280,'height':950},accept_downloads=True)
 page=ctx.new_page();page.set_default_timeout(15000)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:external.append(r.url) if urlparse(r.url).hostname not in [None,'127.0.0.1','localhost'] else None)
 page.add_init_script("""Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});
 Object.defineProperty(navigator,'share',{value:async d=>{if(window.cancelShare)throw new DOMException('cancel','AbortError');window.shared={files:d.files?.length??0,url:d.url};},configurable:true});
 Object.defineProperty(navigator,'clipboard',{value:{writeText:async s=>window.copied=s},configurable:true});""")
 page.goto('http://127.0.0.1:5175/?study=souvenirs&invite=synthetic-private#synthetic-private',wait_until='domcontentloaded')
 page.get_by_role('button',name='行囊',exact=True).click()
 page.get_by_role('button',name='打开数字纪念小铺',exact=True).click()
 expect(page.get_by_role('heading',name='汴河纪念小铺',exact=True)).to_be_visible()
 expect(page.locator('.keepsake-catalogue button')).to_have_count(3)
 assert page.locator('.keepsake-catalogue').get_by_text('价格待定，尚未发售',exact=True).count()==3
 original=game(page);hashes={}
 for index,title in enumerate(['平安纸签','同行灯笺','茶暖小笺']):
  page.locator('.keepsake-catalogue').get_by_role('button',name=title,exact=False).click()
  for purpose,label in [('self','留给自己'),('gift','送给朋友')]:
   page.get_by_role('group',name='纪念品用途').get_by_role('button',name=label,exact=True).click()
   expect(page.get_by_role('button',name='下载纪念品样品',exact=True)).to_be_enabled()
   with page.expect_download() as event:
    page.get_by_role('button',name='下载纪念品样品',exact=True).click()
   path=OUT/(str(index)+'-'+purpose+'.png');event.value.save_as(str(path))
   assert Image.open(path).size==(1440,1800)
   hashes[str(index)+'-'+purpose]=hashlib.sha256(path.read_bytes()).hexdigest()
  assert hashes[str(index)+'-self']!=hashes[str(index)+'-gift']
 assert game(page)==original
 page.get_by_role('button',name='分享纪念品样品',exact=True).click()
 assert page.evaluate('window.shared.files')==1
 page.evaluate('window.cancelShare=true')
 page.get_by_role('button',name='分享纪念品样品',exact=True).click()
 expect(page.get_by_text('已取消分享，样品与进度仍在。',exact=True)).to_be_visible()
 assert game(page)==original
 page.get_by_role('button',name='复制样品链接',exact=True).click()
 url=page.evaluate('window.copied')
 assert set(parse_qs(urlparse(url).query))=={'world','study','souvenir','purpose'}
 assert 'synthetic' not in url and not urlparse(url).fragment
 page.get_by_role('button',name='我想要这份纪念品',exact=True).click()
 page.get_by_role('button',name='本次兴趣已记下',exact=True).click()
 page.locator('.keepsake-card').screenshot(path=str(OUT/'gift-card-in-shop.png'))
 page.get_by_role('button',name='返回街上',exact=True).click()
 page.get_by_role('button',name='设置',exact=True).click()
 page.get_by_text('本次体验记录与隐私',exact=True).click()
 with page.expect_download() as exported:
  page.get_by_role('button',name='导出本次体验记录',exact=True).click()
 exported.value.save_as(str(OUT/'events.json'))
 events=json.loads((OUT/'events.json').read_text())
 assert len([e for e in events['events'] if e['type']=='interest_registered'])==1
 assert all(e['type'] not in ['checkout_started','purchase_confirmed','paid_content_started'] for e in events['events'])
 assert not any(word in json.dumps(events) for word in ['synthetic-private','email','recipient_subject','buyer_subject'])
 (OUT/'events.json').write_text(json.dumps(events,ensure_ascii=False,indent=2))
 ctx.close()

 # Recipient opens a separate fresh browser: sees only a sample, no paid claim.
 ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True)
 page=ctx.new_page();page.set_default_timeout(15000);page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("""Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});
 Object.defineProperty(navigator,'share',{value:async d=>{window.shared={files:d.files?.length??0,url:d.url};},configurable:true});
 Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('denied')}},configurable:true});""")
 page.goto(url,wait_until='domcontentloaded')
 expect(page.get_by_role('img',name='茶暖小笺赠友样品',exact=True)).to_be_visible()
 expect(page.get_by_role('button',name='下载纪念品样品',exact=True)).to_be_enabled()
 assert game(page)['wallet']==60 and game(page)['journal']==[]
 page.get_by_role('button',name='分享纪念品样品',exact=True).tap()
 assert page.evaluate('window.shared.files')==0
 expect(page.get_by_text('已交由系统分享样品链接；仍可另存图片。',exact=True)).to_be_visible()
 page.get_by_role('button',name='复制样品链接',exact=True).tap()
 expect(page.get_by_role('textbox',name='纪念品样品链接',exact=True)).to_be_visible()
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path=str(OUT/'recipient-mobile.png'))
 # A real canvas failure can be retried without creating a purchase.
 page.evaluate("()=>{window.realBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(cb){cb(null)}}")
 page.locator('.keepsake-catalogue').get_by_role('button',name='平安纸签',exact=False).tap()
 expect(page.get_by_role('button',name='重新生成纪念品样品',exact=True)).to_be_visible()
 page.evaluate('()=>{HTMLCanvasElement.prototype.toBlob=window.realBlob}')
 page.get_by_role('button',name='重新生成纪念品样品',exact=True).tap()
 expect(page.get_by_role('button',name='下载纪念品样品',exact=True)).to_be_enabled()
 assert game(page)['wallet']==60 and game(page)['journal']==[]
 ctx.close();browser.close()
assert not errors,errors
assert not external,external
result={'designs':3,'purpose_variants':6,'png_dimensions':[1440,1800],'self_and_gift_distinct':True,'friend_fresh_browser_sample_only':True,'file_share':True,'link_only_share':True,'cancel_preserves_save':True,'manual_copy_fallback':True,'canvas_failure_retry':True,'free_save_unchanged':True,'purchase_events':0,'page_errors':errors,'external_requests':external,'sha256':hashes}
(OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in result.items() if k!='sha256'},ensure_ascii=False,indent=2))

