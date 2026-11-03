import { useEffect, useRef, useState } from 'react';
import type { GameState } from './game';
import { downloadFile } from './export';
import { scrollPlan, type ScrollMode } from './scrollPlan';
import type { ScrollPart } from './scrollExport';

type Job={kind:'idle'}|{kind:'making';done:number;total:number}|{kind:'done';parts:ScrollPart[]}|{kind:'failed';mode:ScrollMode;message:string};
export function ScrollExportPanel({ game, onBack, onNotice }: {game:GameState;onBack():void;onNotice(text:string):void}) {
  const [mode,setMode]=useState<ScrollMode>('phone'),[job,setJob]=useState<Job>({kind:'idle'});
  const active=useRef<AbortController|null>(null),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort();};},[]);
  const make=async(selected:ScrollMode)=>{
    if(active.current)return;
    const ctrl=new AbortController();active.current=ctrl;setMode(selected);setJob({kind:'making',done:0,total:20});
    try{
      // Load the renderer only when requested, and surface load failures as job errors.
      const {exportScroll}=await import('./scrollExport');
      const parts=await exportScroll(selected,game,(done,total)=>{if(alive.current&&active.current===ctrl&&!ctrl.signal.aborted)setJob({kind:'making',done,total});},ctrl.signal);
      if(alive.current&&active.current===ctrl&&!ctrl.signal.aborted)setJob({kind:'done',parts});
    }catch(error){
      if(alive.current&&active.current===ctrl){
        if((error as Error)?.name==='AbortError'||ctrl.signal.aborted){setJob({kind:'idle'});onNotice('已停止制作，画册里的风景都还在。');}
        else setJob({kind:'failed',mode:selected,message:error instanceof Error&&/[\u3400-\u9fff]/.test(error.message)?error.message:'画卷还没装裱好。请重试，或改用分张制作。'});
      }
    }finally{if(active.current===ctrl)active.current=null;}
  };
  const cancel=()=>{const ctrl=active.current;active.current=null;ctrl?.abort();setJob({kind:'idle'});onNotice('已停止制作，画册里的风景都还在。');};
  const save=(part:ScrollPart)=>{
    try{downloadFile(part.blob,part.name);onNotice('已请求保存，请在浏览器下载中查看。');}
    catch{onNotice('这次没能保存。图片仍在这里，可以再点一次保存。');}
  };
  const full=scrollPlan('full'),phone=scrollPlan('phone')[0];
  return <section className="scroll-export-panel" aria-label="把长卷带走">
    <div className="scroll-export-body">
      <p>留一卷春色，在你身边。</p>
      {job.kind==='idle'&&<fieldset className="scroll-mode-list"><legend>选一种大小</legend>
        <label><input type="radio" name="scroll-size" checked={mode==='phone'} onChange={()=>setMode('phone')}/><span><b>手机一张</b><small>{phone.width} × {phone.height} 像素，方便保存和发送。</small></span></label>
        <label><input type="radio" name="scroll-size" checked={mode==='full'} onChange={()=>setMode('full')}/><span><b>原素材分四张</b><small>每张高 {full[0].height} 像素，按右起顺序分别保存。</small></span></label>
      </fieldset>}
      {job.kind==='making'&&<div className="scroll-job-status" role="status"><p>正在合卷…… {job.done} / {job.total} 段</p><progress max={job.total} value={job.done}/></div>}
      {job.kind==='failed'&&<div className="scroll-job-status" role="alert"><p>{job.message}</p>{job.mode==='phone'&&<p>分成四张时，每张占用更少，或许能在这台设备上完成。</p>}</div>}
      {job.kind==='done'&&<><p role="status">画卷已装裱好。{job.parts.length>1?'第 1 张从右侧卷首开始。':''}</p><ul className="scroll-result-list">{job.parts.map((part,i)=><li key={part.name}><button className="secondary-button" onClick={()=>save(part)}>{job.parts.length===1?'保存长卷图片':`保存第 ${i+1} 张`}</button><small>{part.width} × {part.height} · {(part.blob.size/1024/1024).toFixed(1)} MB</small></li>)}</ul></>}
      <details className="scroll-export-about"><summary>画卷说明</summary><p>人物与船按当前故事定格，采用原画日景。从右侧卷首读到左侧卷尾，图片不含进度统计。</p></details>
    </div>
    <footer className="scroll-export-actions">
      {job.kind==='idle'&&<button className="primary-button" onClick={()=>void make(mode)}>开始制作</button>}
      {job.kind==='making'&&<button className="secondary-button" onClick={cancel}>取消制作</button>}
      {job.kind==='failed'&&<div className="button-row"><button className="primary-button" onClick={()=>void make(job.mode)}>重新制作</button>{job.mode==='phone'&&<button className="secondary-button" onClick={()=>void make('full')}>改为四张</button>}</div>}
      {job.kind==='done'&&<button className="secondary-button" onClick={()=>setJob({kind:'idle'})}>换一种大小</button>}
      <button className="text-button" onClick={onBack}>回到画册</button>
    </footer>
  </section>;
}
