import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { JournalArt } from './Art';
import type { Action, GameState } from './game';
import { TRACE_STROKES, nextTracePoint, tracePath, windIsLight, type Point } from './playStories';
import { study } from './study';

type Props = { game: GameState; act: (a: Action) => void; onPage: () => void; close: () => void };
function TraceBoard({ stroke, complete }: { stroke: number; complete: () => void }) {
  const [next,setNext]=useState(0);
  const gesture=useRef({ pointer: -1, next: 0, done: false });
  const guide=TRACE_STROKES[stroke];
  const point=(e: { clientX: number; clientY: number }, svg: SVGSVGElement): Point => {
    const r=svg.getBoundingClientRect(); return [(e.clientX-r.left)*320/r.width,(e.clientY-r.top)*200/r.height];
  };
  const advance=(e: { clientX: number; clientY: number }, svg: SVGSVGElement)=>{
    const g=gesture.current;
    if(g.done)return;
    g.next=nextTracePoint(guide.points,g.next,point(e,svg));setNext(g.next);
    if(g.next===guide.points.length){g.done=true;complete();}
  };
  const reset=()=>{gesture.current.pointer=-1;if(!gesture.current.done){gesture.current.next=0;setNext(0);}};
  const move=(e:PointerEvent<SVGSVGElement>)=>{
    if(e.pointerId!==gesture.current.pointer)return;
    const samples=e.nativeEvent.getCoalescedEvents?.()??[];
    for(const sample of samples)advance(sample,e.currentTarget);
    advance(e.nativeEvent,e.currentTarget);
  };
  return <div className="trace-board">
    <svg viewBox="0 0 320 200" role="img" aria-label={`第${stroke+1}笔：${guide.name}，沿圆点方向描画。也可使用下面的点选按钮。`}
      onPointerDown={e=>{
        if(e.button!==0 || gesture.current.pointer!==-1 || nextTracePoint(guide.points,0,point(e,e.currentTarget))!==1)return;
        e.preventDefault();gesture.current={pointer:e.pointerId,next:1,done:false};setNext(1);e.currentTarget.setPointerCapture(e.pointerId);
      }} onPointerMove={move} onPointerUp={e=>{if(e.pointerId===gesture.current.pointer){advance(e,e.currentTarget);reset();}}}
      onPointerCancel={reset} onLostPointerCapture={reset}>
      <g fill="none" stroke="#718369" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {TRACE_STROKES.slice(0,stroke).map(s=><path key={s.name} d={tracePath(s.points)}/>)}
        <path d={tracePath(guide.points)} opacity=".25" strokeDasharray="3 7"/>
        {next>1&&<path d={tracePath(guide.points.slice(0,next))}/>}
      </g>
      {guide.points.map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i===next?8:3} fill={i<next?'#718369':'#bca77f'} opacity={i<next?1:.65}/>)}
      <text x="17" y="24" fill="#685c48" fontSize="12">{guide.name} · 从大圆点起笔</text>
    </svg>
  </div>;
}
export function TracePanel({game,act,onPage,close}:Props) {
  const step=game.progress.quests.trace.step;
  const finish=(method:'traced'|'tapped')=>{study.emit('play_detail',{what:'trace',outcome:method});act({type:'TRACE_STROKE',stroke:step});};
  return <>
    <p className="section-note">柳荫下 · 沈砚 · {step<3?`第 ${step+1} 笔，共三笔`:'枝、叶与水都留在纸上了'}</p>
    <blockquote className="play-story-line">{step<3?TRACE_STROKES[step].words:step===3?'沈砚：你看，这一枝有了去处，水也有了回应。第一回的笔，不必改得与谁一样。':'沈砚：这页收好了。下回来，再看同一枝柳，也许又能看见别的。'}</blockquote>
    {step<3?<>
      <p>从大圆点起，按顺序沿浅线描画。没有计时；也可以点选完成这一笔。</p>
      <TraceBoard key={step} stroke={step} complete={()=>finish('traced')}/>
      <div className="play-story-actions"><button className="secondary-button" onClick={()=>finish('tapped')}>点选完成「{TRACE_STROKES[step].name}」这一笔</button></div>
      <p className="fine-print">两种方式留下同一幅画。完整的一笔会保留；未画完的一笔可重来。</p>
    </>:<><JournalArt kind="trace"/><div className="play-story-actions">{step===3?<button className="primary-button" onClick={()=>act({type:'TRACE_KEEP'})}>收好《柳下初笔》</button>:<><button className="primary-button" onClick={onPage}>翻开《柳下初笔》</button><button className="secondary-button" onClick={()=>act({type:'REPLAY',quest:'trace'})}>重逢 · 再描一枝柳</button></>}</div></>}
    <button className="decline-button" onClick={close}>先沿河走走 · 已完成的笔会保留</button>
    <p className="fine-print">原创虚构小事 · 不增减文钱。只记固定笔段，不保存或上传手绘轨迹。</p>
  </>;
}
export function BreezePanel({game,act,onPage,close,reduced}:Props & {reduced:boolean}) {
  const step=game.progress.quests.breeze.step;
  const start=useRef(performance.now());
  const [elapsed,setElapsed]=useState(0),[hint,setHint]=useState('');
  useEffect(()=>{
    if(step!==2 || reduced)return;
    start.current=performance.now();setElapsed(0);
    const timer=setInterval(()=>setElapsed(performance.now()-start.current),150);
    return()=>clearInterval(timer);
  },[step,reduced]);
  const light=windIsLight(elapsed);
  const clip=(corner:0|1)=>{setHint('');study.emit('play_detail',{what:'ugoki',outcome:'tapped'});act({type:'BREEZE_CLIP',corner});};
  const release=()=>{
    const now=performance.now()-start.current;
    const caught=windIsLight(now);study.emit('play_detail',{what:'ugoki',outcome:caught?'caught':'miss'});
    act({type:'BREEZE_RELEASE',elapsed:now});setHint(caught?'':'纸角还在扬，小柳替你扶住了。等它平下来再试，也可直接用竹夹。');
  };
  const lines=[
    '小柳：刚才那幅画，墨还没干。替我把它挂到檐下吧，让风轻轻走过纸面。',
    '小柳：先把画的上沿搭好。我扶着竹竿，你来安顿纸角。',
    '小柳：看右边的纸角。风轻时它会平下来，那时松手就好。若想稳妥些，咱们一边一边夹住。',
    '小柳：左边稳住了。把右边也夹好，便能坐下来歇一会儿。',
    '小柳：成了。墨迹在慢慢变干，风也有了分寸。忙了一天，我这会儿才看清自己照看的春色。',
    '小柳：这页留给你。下回风来，我就记得有人陪我把画挂好过。',
  ];
  return <>
    <p className="section-note">纸铺檐下 · 小柳</p><blockquote className="play-story-line">{lines[step]}</blockquote>
    <div className={`breeze-picture ${step===2&&!reduced&&!light?'gust':''}`} aria-hidden="true"><JournalArt kind="breeze"/></div>
    <div className="play-story-actions">
      {step===0&&<button className="primary-button" onClick={()=>act({type:'BREEZE_TALK'})}>陪小柳把画晾起来</button>}
      {step===1&&<button className="primary-button" onClick={()=>act({type:'BREEZE_HANG'})}>把画的上沿搭在竹竿上</button>}
      {step===2&&<>
        {!reduced&&<><p className={`wind-status ${light?'light':''}`} role="status">{light?'风轻了 · 纸角已平，可以松手':'一阵风过 · 纸角在扬，先扶一扶'}</p><button className="primary-button" onClick={release}>松开纸角</button></>}
        <button className="secondary-button" onClick={()=>clip(0)}>慢慢来 · 先夹住左边纸角</button>
        <p className="fine-print">{reduced?'减少动态已开启，可以用竹夹慢慢晾好。':'风会再轻下来，没有次数限制。'}用竹夹也能留下同一页画。</p>
      </>}
      {step===3&&<><p role="status">左边的竹夹已安好。</p><button className="primary-button" onClick={()=>clip(1)}>再夹住右边纸角</button></>}
      {hint&&step===2&&<p role="status">{hint}</p>}
      {step===4&&<><p role="status">两边纸角都安稳了，新画留在檐下慢慢晾干。</p><button className="primary-button" onClick={()=>act({type:'BREEZE_KEEP'})}>收好《借一阵风》</button></>}
      {step===5&&<><button className="primary-button" onClick={onPage}>翻开《借一阵风》</button><button className="secondary-button" onClick={()=>{setHint('');act({type:'REPLAY',quest:'breeze'});}}>重逢 · 再借一阵风</button></>}
    </div>
    <button className="decline-button" onClick={close}>先沿河走走 · 已挂好和夹好的部分会保留</button>
    <p className="fine-print">原创虚构小事 · 不增减文钱。可随时离开，画纸不会被风吹丢。</p>
  </>;
}
