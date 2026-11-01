from pathlib import Path
import json,math,wave,struct
from playwright.sync_api import sync_playwright
out=Path('/workspace/.cloud-setup/edo-polish')
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/lib/chromium/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 page=b.new_page()
 page.goto('http://127.0.0.1:5193/')
 for position in [1000,6000,12505]:
  for version in ['before','after']:
   result=page.evaluate("""async ({position,version})=>{
    const native=window.AudioContext, timer=window.setTimeout, random=Math.random;
    const ctx=new OfflineAudioContext(1,48000*3,48000);
    let seed=1;
    Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
    window.AudioContext=function(){return ctx};
    window.setTimeout=()=>0;
    const {sound}=await import('/sound-'+version+'.mjs?x='+position);
    sound.setLevels({ambient:.6,ui:0,music:0});sound.place(position);sound.unlock();
    window.AudioContext=native;window.setTimeout=timer;Math.random=random;
    const rendered=await ctx.startRendering(), values=rendered.getChannelData(0);
    let peak=0,sum=0,count=0;for(let i=24000;i<values.length;i++){peak=Math.max(peak,Math.abs(values[i]));sum+=values[i]*values[i];count++;}
    return {position,version,rms:Math.sqrt(sum/count),peak,pcm:position===1000?Array.from(values):null};
   }""",{'position':position,'version':version})
   pcm=result.pop('pcm')
   if pcm:
    with wave.open(str(out/('ambient-'+version+'.wav')),'wb') as w:
     w.setnchannels(1);w.setsampwidth(2);w.setframerate(48000)
     w.writeframes(b''.join(struct.pack('<h',int(max(-1,min(1,v))*32767)) for v in pcm))
   results.append(result)
 b.close()
for i in range(0,len(results),2):
 before,after=results[i:i+2]
 reduction=20*math.log10(after['rms']/before['rms'])
 after['change_db']=reduction
 assert reduction < -10,(before,after)
(out/'audio-result.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))

