import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CHARACTERS, ENVIRONMENT, type CharacterId } from './content';
import { Icon } from './Art';
import type { GameState } from './game';
import { PaintedLandscape } from './PaintedArt';
import { PERSON_HEIGHT, WORLD_HEIGHT, WORLD_WIDTH, personPosition, sceneAt } from './layout';
import { targetsAt, type SceneTarget, type TargetBounds } from './hit-targets';

export function ScrollView({ game, center, setCenter, onPerson, onEnvironment, onTargets, feedback, locked }: {
  game: GameState; center: number; setCenter: (x: number) => void;
  onPerson: (id: CharacterId) => void; onEnvironment: (id: string) => void; onTargets: (targets: SceneTarget[]) => void; feedback: string; locked: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1200, height: 700 });
  const gesture = useRef<{ x: number; center: number; moved: boolean; id: number } | null>(null);
  const suppress = useRef(false);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const scale = Math.max(.28, size.height / WORLD_HEIGHT);
  const half = Math.min(WORLD_WIDTH / 2, size.width / scale / 2);
  const bound = (x: number) => Math.min(WORLD_WIDTH-half, Math.max(half, x));
  const actual = bound(center);
  const scene = sceneAt(center);
  const move = (x: number) => setCenter(bound(x));
  return <div ref={ref} className={`scroll-view${dragging?' dragging':''}`} data-scene={scene}>
    <div className="scroll-surface" role="region" aria-label="虹桥两岸可拖动画卷。左右方向键移动；也可通过附近入口选择人物。" tabIndex={0}
      onKeyDown={e => { if (e.target !== e.currentTarget || locked) return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); move(actual + (e.key==='ArrowLeft' ? -250 : 250)); } }}
      onPointerDown={e => {
        if (locked || !game.started || e.button!==0) return;
        gesture.current = { x: e.clientX, center: actual, moved: false, id: e.pointerId };
        suppress.current = false;
      }}
      onPointerMove={e => {
        const g = gesture.current;
        if (!g || g.id!==e.pointerId) return;
        if (Math.abs(e.clientX-g.x)>8) { g.moved=true; suppress.current=true; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); }
        if (g.moved) move(g.center-(e.clientX-g.x)/scale);
      }}
      onPointerUp={() => { gesture.current=null; setDragging(false); }}
      onPointerCancel={() => { gesture.current=null; setDragging(false); }}
      onClickCapture={e=>{
        if(suppress.current) { e.stopPropagation(); e.preventDefault(); suppress.current=false; return; }
        // Keyboard/assistive clicks already identify a specific focused button.
        if(e.detail===0 || locked) return;
        if(!(e.target instanceof Element) || !e.target.closest('button[data-hit-kind]')) return;
        const bounds: TargetBounds[] = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-hit-kind]')).map(button=>{
          const id=button.dataset.hitId!;
          const label=button.getAttribute('aria-label')??id;
          const target:SceneTarget=button.dataset.hitKind==='person'?{kind:'person',id:id as CharacterId,label}:{kind:'environment',id,label};
          const rect=button.getBoundingClientRect();
          return {target,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};
        });
        const targets=targetsAt(e.clientX,e.clientY,bounds);
        if(targets.length>1){e.stopPropagation();e.preventDefault();onTargets(targets);}
      }}>
      <div className="world-strip" style={{ width: WORLD_WIDTH*scale, height: WORLD_HEIGHT*scale, transform: `translate3d(${size.width/2-actual*scale}px, ${Math.min(0,(size.height-WORLD_HEIGHT*scale)/2)}px, 0)`, '--world-scale': scale } as CSSProperties}>
        <PaintedLandscape state={game} feedback={feedback}/>
        {game.started && <div className="hotspots">
          {(Object.keys(CHARACTERS) as CharacterId[]).map(id => {
            const c=CHARACTERS[id];
            const {x,y}=personPosition(id,game);
            const featured=(scene==='paper'&&id==='liu')||(scene==='bridge'&&id==='zhou')||(scene==='tea'&&id==='he');
            return <button key={id} data-hit-kind="person" data-hit-id={id} className={`person-hotspot ${featured?'featured':''}`} style={{ left:x*scale, top:(y-PERSON_HEIGHT*.48)*scale, width:Math.max(48,PERSON_HEIGHT*.64*scale), height:Math.max(48,PERSON_HEIGHT*scale) }} onClick={()=>onPerson(id)} aria-label={`与${c.name}交谈，${c.role}`}>
              <span className="person-label"><span className="conversation-mark">···</span>{c.name}</span><span className="person-ring"/>
            </button>;
          })}
          {ENVIRONMENT.map(env => <button key={env.id} data-hit-kind="environment" data-hit-id={env.id} className={`environment-hotspot ${feedback===env.id?'activated':''}`} style={{left:env.x*scale,top:env.y*scale}} onClick={()=>onEnvironment(env.id)} aria-label={env.label}><span className="environment-dot"/><span className="environment-label">{env.label}</span></button>)}
        </div>}
      </div>
    </div>
    <div className="paper-edge top"/><div className="paper-edge bottom"/>
    {game.started && <>
      <button className="pan-button pan-left" aria-label="往虹桥桥头" onClick={()=>move(actual-500)} disabled={actual<=half+1}><Icon name="back"/></button>
      <button className="pan-button pan-right" aria-label="往河东纸铺" onClick={()=>move(actual+500)} disabled={actual>=WORLD_WIDTH-half-1}><Icon name="arrow"/></button>
      <div className="scene-caption"><span className="scene-seal">汴京</span><div><small>沿河慢行 · 随处可停</small><p>{scene==='paper'?'河东 · 柳家纸铺':scene==='bridge'?'虹桥 · 汴河渡口':'桥畔 · 何记茶坊'}</p></div></div>
      <div className="scroll-guide" aria-hidden="true"><span>←</span> 拖动画卷，寻一段人间烟火 <span>→</span></div>
    </>}
  </div>;
}
