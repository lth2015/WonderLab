from pathlib import Path
import json
from playwright.sync_api import sync_playwright
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--label',default='after');args=parser.parse_args()
out=Path(__file__).resolve().parent/'evidence'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 for width,height in [(390,844),(1280,800)]:
  p=b.new_page(viewport={'width':width,'height':height});p.goto('http://127.0.0.1:5180/edo/?session=1',wait_until='networkidle');p.get_by_role('button',name='絵巻に入る',exact=True).click();p.evaluate('document.getAnimations().forEach(a=>{a.pause();a.currentTime=0})');p.screenshot(path=str(out/f'{args.label}-{width}.png'));r=p.locator('.fret').bounding_box();clip={'x':max(0,r['x']-45),'y':max(0,r['y']-10),'width':min(310,width-max(0,r['x']-45)),'height':min(220,height-max(0,r['y']-10))};p.screenshot(path=str(out/f'{args.label}-detail-{width}.png'),clip=clip);p.close()
 b.close()
