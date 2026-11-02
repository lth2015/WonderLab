import { useEffect, useRef, useState } from 'react';
import { PAGES, type PageId } from './content';
import type { GameState } from './game';
import { GIFT_KINDS, type GiftKind } from './content/gift';
import { GiftPaper, GiftScene, giftPaperData } from './GiftPaper';
import { giftToPng, giftWorkLink } from './giftExport';
import { downloadFile } from './export';
import { study } from './study';

type Prepared = { key: string; blob: Blob; url: string };
export function GiftPanel({ pages, initialPage, designs, onBack, onNotice }: {
  pages: readonly PageId[]; initialPage: PageId; designs: GameState['progress']['designs'];
  onBack(page: PageId): void; onNotice(text: string): void;
}) {
  const available=PAGES.filter(page=>pages.includes(page.id));
  const [step,setStep]=useState(1);
  const [pageId,setPage]=useState<PageId>(available.some(page=>page.id===initialPage)?initialPage:available[0]?.id??initialPage);
  const [kind,setKind]=useState<GiftKind['id']>(GIFT_KINDS[0].id);
  const [note,setNote]=useState(GIFT_KINDS[0].lines[0]);
  const [prepared,setPrepared]=useState<Prepared|null>(null);
  const [job,setJob]=useState<{key:string;failed:boolean}>({key:'',failed:false});
  const [attempt,retry]=useState(0),[sharing,setSharing]=useState(false),[manual,setManual]=useState(false);
  const svg=useRef<SVGSVGElement>(null),body=useRef<HTMLDivElement>(null),urls=useRef(new Set<string>());
  const data=giftPaperData(pageId,note,designs[pageId]?.close??false),key=JSON.stringify(data);
  const ready=prepared?.key===key?prepared:null,failed=job.key===key&&job.failed&&!ready;
  const page=PAGES.find(page=>page.id===pageId)!;
  const filename=`汴河拾光-寄给你-${page.title}.png`;
  const link=giftWorkLink(location.origin,import.meta.env.BASE_URL,pageId);
  useEffect(()=>{const frame=requestAnimationFrame(()=>body.current?.querySelector<HTMLElement>('[data-gift-step]:not([hidden]) [data-step-focus]')?.focus());return()=>cancelAnimationFrame(frame);},[step]);
  useEffect(()=>()=>{for(const url of urls.current)URL.revokeObjectURL(url);urls.current.clear();},[]);
  useEffect(()=>()=>{if(prepared){URL.revokeObjectURL(prepared.url);urls.current.delete(prepared.url);}},[prepared]);
  useEffect(()=>{
    let alive=true;setJob({key,failed:false});
    const timer=setTimeout(async()=>{
      if(!svg.current)return;
      try{
        const blob=await giftToPng(svg.current);
        if(alive){const url=URL.createObjectURL(blob);urls.current.add(url);setPrepared({key,blob,url});}
      }catch{
        if(alive){setJob({key,failed:true});study.emit('error',{code:'postcard_export_failed'});}
      }
    },50);
    return()=>{alive=false;clearTimeout(timer);};
  },[key,attempt]);
  const save=()=>{
    if(!ready)return;
    study.emit('journal_export_attempted',{page_id:pageId,export_type:'png'});
    try{downloadFile(ready.blob,filename);study.emit('journal_export_completed',{page_id:pageId,export_type:'png',stage:'download_requested'});onNotice('画纸已保存，可以把这页春色发给朋友了。');}
    catch{study.emit('error',{code:'postcard_export_failed'});onNotice('保存没能完成，请再试一次。画纸仍在这里。');}
  };
  const share=async()=>{
    if(!ready||sharing)return;
    study.emit('share_attempted',{page_id:pageId,method:'system'});
    let file:File|undefined;
    try{const candidate=new File([ready.blob],filename,{type:'image/png'});if(typeof navigator.share==='function'&&navigator.canShare?.({files:[candidate]}))file=candidate;}catch{ /* unavailable probe never prevents saving */ }
    if(!file){study.emit('share_result',{method:'system',result:'unavailable'});onNotice('这台设备不能直接发送图片。请先保存画纸，再用聊天工具发给朋友。');return;}
    setSharing(true);
    try{await navigator.share({files:[file],title:page.title,text:note});study.emit('share_result',{method:'system',result:'invoked'});}
    catch(error){if((error as DOMException)?.name==='AbortError')study.emit('share_result',{method:'system',result:'cancelled'});else{study.emit('share_result',{method:'system',result:'failed'});onNotice('分享没能完成。可以先保存画纸，再发给朋友。');}}
    finally{setSharing(false);}
  };
  const copy=async()=>{
    study.emit('share_attempted',{page_id:pageId,method:'link'});
    try{await navigator.clipboard.writeText(link);study.emit('share_result',{method:'link',result:'copied'});onNotice('作品链接已复制。');}
    catch{setManual(true);study.emit('share_result',{method:'link',result:'unavailable'});onNotice('可以在下面选中作品链接，手动复制。');}
  };
  if(!available.length)return <p>先在画册里留下一页风景，再寄给想起的人。</p>;
  return <section className="gift-panel" aria-label="送给朋友的画纸">
    <ol className="gift-steps" aria-label="画纸制作步骤">{['选景','选句','看画纸'].map((label,i)=><li key={label} aria-current={step===i+1?'step':undefined}>{label}</li>)}</ol>
    <div className="gift-step-body" ref={body}>
      <section data-gift-step="1" hidden={step!==1}>
        <p className="section-note">把记下的风景，寄给想起的人。</p>
        <label className="gift-scene-label">选一处风景<select data-step-focus="" value={pageId} onChange={event=>setPage(event.target.value as PageId)}>{available.map(page=><option key={page.id} value={page.id}>{page.title}</option>)}</select></label>
        <div className="gift-scene-thumb"><svg viewBox="120 220 1200 750" width={1200} height={750} role="img" aria-label={page.title}><GiftScene data={data}/></svg></div>
      </section>
      <section data-gift-step="2" hidden={step!==2}>
        <div className="gift-kinds" aria-label="赠言的心意">{GIFT_KINDS.map((value,i)=><button key={value.id} data-step-focus={i===0?'':undefined} aria-pressed={value.id===kind} onClick={()=>{setKind(value.id);setNote(value.lines[0]);}}>{value.label}</button>)}</div>
        <fieldset className="gift-lines"><legend>选一句想说的话</legend>{GIFT_KINDS.find(value=>value.id===kind)!.lines.map(line=><label key={line} className={line===note?'selected':''}><input type="radio" name="gift-note" value={line} checked={line===note} onChange={()=>setNote(line)}/><span>{line}</span></label>)}</fieldset>
      </section>
      <section data-gift-step="3" hidden={step!==3}>
        <h3 tabIndex={-1} data-step-focus="" className="gift-step-title">看看这张画纸</h3>
        <figure className="gift-preview" aria-label="画纸预览">
          <div style={{display:ready?'none':undefined}}><GiftPaper data={data} artRef={svg}/></div>
          {ready&&<img src={ready.url} width={1440} height={1800} alt={`《${page.title}》：${note}`}/>}
          <figcaption>{note}</figcaption>
        </figure>
        {!ready&&!failed&&<p role="status">正在装裱画纸……</p>}
        {failed&&<div className="gift-error" role="alert"><p>这张画纸还没装裱好。重试不会影响画册里的风景。</p><button className="secondary-button" onClick={()=>retry(value=>value+1)}>重新装裱</button></div>}
        <details className="gift-link-options"><summary>作品链接</summary><button className="text-button" onClick={()=>void copy()}>复制作品链接</button>{manual&&<label className="gift-link">作品链接<input readOnly value={link} onFocus={event=>event.currentTarget.select()}/></label>}</details>
      </section>
    </div>
    <footer className="gift-actions">
      {step===1&&<div className="button-row"><button className="primary-button" onClick={()=>setStep(2)}>选一句话</button><button className="text-button" onClick={()=>onBack(pageId)}>回到画页</button></div>}
      {step===2&&<div className="button-row"><button className="primary-button" onClick={()=>setStep(3)}>看看画纸</button><button className="secondary-button" onClick={()=>setStep(1)}>换一处景</button></div>}
      {step===3&&<><div className="button-row"><button className="primary-button" onClick={save} disabled={!ready}>保存画纸</button><button className="secondary-button" onClick={()=>void share()} disabled={!ready||sharing}>{sharing?'正在打开分享……':'送给朋友'}</button></div><div className="button-row"><button className="text-button" onClick={()=>setStep(2)}>换一句话</button><button className="text-button" onClick={()=>onBack(pageId)}>回到画页</button></div></>}
    </footer>
  </section>;
}
