import json
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('/workspace/.cloud-setup/wonderlab')
results={}
errors=[]
audio_spy="""(() => {
  const Native = window.AudioContext;
  window.__audioAudit = {contexts: [], peaks: []};
  window.AudioContext = class extends Native {
    constructor(...args) {
      super(...args);
      const ctx=this, gains=[];
      window.__audioAudit.contexts.push({ctx,gains,analyser:null});
      const entry=window.__audioAudit.contexts.at(-1);
      const createGain=this.createGain.bind(this);
      this.createGain=()=>{const node=createGain(); gains.push(node); return node;};
      const createComp=this.createDynamicsCompressor.bind(this);
      this.createDynamicsCompressor=()=>{
        const comp=createComp();
        entry.analyser=this.createAnalyser(); entry.analyser.fftSize=2048;
        comp.connect(entry.analyser);
        return comp;
      };
    }
  };
})();"""
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],timeout=15000)
    ctx=browser.new_context(viewport={'width':360,'height':800})
    page=ctx.new_page()
    page.set_default_timeout(10000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:5175/',wait_until='domcontentloaded')
    page.get_by_role('button',name='入画',exact=True).click()
    page.get_by_role('button',name='附近',exact=True).click()
    page.locator('summary',has_text='长卷导览').click()
    guide=page.get_by_role('navigation',name='长卷导览')
    assert guide.get_by_role('button').count()==8
    guide.get_by_role('button',name='货港',exact=True).click()
    page.get_by_role('button',name='附近',exact=True).click()
    page.get_by_role('button',name='半步相让',exact=False).click()
    page.get_by_role('button',name='听杜叔说说',exact=False).click()
    page.get_by_role('button',name='下船的窄木板',exact=True).click()
    assert page.get_by_text('木板还要让船上的人走，先留着这条路。',exact=True).is_visible()
    page.get_by_role('button',name='仓檐下的空地',exact=True).click()
    page.reload(wait_until='domcontentloaded')
    page.get_by_role('button',name='附近',exact=True).click()
    page.get_by_role('button',name='半步相让',exact=False).click()
    page.get_by_role('button',name='把空箩收在墙边',exact=True).click()
    page.get_by_role('button',name='把这次相让记入画册',exact=False).click()
    page.get_by_role('button',name='翻开《半步相让》',exact=False).wait_for()
    save=page.evaluate("JSON.parse(localStorage.getItem('ww:qingming-china:save:v1'))")
    assert save['wallet']==60 and save['journal'].count('harbor-space')==1
    page.screenshot(path=str(OUT/'harbor-mobile-complete.png'))
    page.get_by_role('button',name='重逢 · 再留半步路',exact=False).click()
    page.get_by_role('button',name='听杜叔说说',exact=False).click()
    page.get_by_role('button',name='仓檐下的空地',exact=True).click()
    page.get_by_role('button',name='把空箩收在墙边',exact=True).click()
    page.get_by_role('button',name='把这次相让记入画册',exact=False).click()
    page.get_by_role('button',name='翻开《半步相让》',exact=False).wait_for()
    save=page.evaluate("JSON.parse(localStorage.getItem('ww:qingming-china:save:v1'))")
    assert save['wallet']==60 and len(save['journal'])==1
    page.get_by_role('button',name='返回街上',exact=True).click()
    page.get_by_role('button',name='画册',exact=False).click()
    assert page.locator('.album-card').count()==13
    results['china']={'viewport':'360x800','guide_stops':8,'wrong_choice':True,'reload_resume':True,'replay_idempotent':True,'wallet':save['wallet'],'pages':len(save['journal']),'album_capacity':13}
    ctx.close()
    for muted in [True, False]:
        ctx=browser.new_context(viewport={'width':360,'height':800})
        page=ctx.new_page(); page.set_default_timeout(10000)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script(audio_spy)
        page.goto('http://127.0.0.1:5180/edo/',wait_until='domcontentloaded')
        page.wait_for_selector('button')
        page.evaluate("""async (muted) => {
          const {newSave}=await import('/edo/src/engine/state.ts');
          const {SAVE_KEY}=await import('/edo/src/engine/save.ts');
          const s=newSave(); s.settings.sound=muted?{ambient:0,ui:0,music:0}:{ambient:1,ui:1,music:1};
          localStorage.setItem(SAVE_KEY,JSON.stringify(s));
        }""",muted)
        page.reload(wait_until='domcontentloaded')
        page.wait_for_selector('button')
        assert page.evaluate('window.__audioAudit.contexts.length')==0
        page.mouse.click(10,10)
        page.wait_for_function('window.__audioAudit.contexts.length===1')
        sample=page.evaluate("""async () => {
          const e=window.__audioAudit.contexts[0];
          let peak=0; const data=new Float32Array(e.analyser.fftSize);
          for(let i=0;i<40;i++){
            e.analyser.getFloatTimeDomainData(data);
            for(const v of data)peak=Math.max(peak,Math.abs(v));
            await new Promise(r=>setTimeout(r,10));
          }
          return {peak, gains:e.gains.slice(1,4).map(g=>g.gain.value),state:e.ctx.state,contexts:window.__audioAudit.contexts.length};
        }""")
        assert sample['state']=='running'
        if muted: assert sample['peak']==0 and sample['gains']==[0,0,0]
        else: assert sample['peak']>0
        page.mouse.click(10,10)
        page.keyboard.press('ArrowRight')
        assert page.evaluate('window.__audioAudit.contexts.length')==1
        results['edo_muted' if muted else 'edo_audible_control']=sample
        ctx.close()
    browser.close()
assert not errors,errors
results['page_errors']=errors
(OUT/'browser-takeover.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))

