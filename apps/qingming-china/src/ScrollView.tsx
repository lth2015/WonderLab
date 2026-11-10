import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { CHARACTERS, ENVIRONMENT, type CharacterId } from './content';
import { Icon } from './Art';
import type { GameState } from './game';
import { PaintedLandscape } from './PaintedArt';
import type { SceneReaction } from './reactions';
import { lyingThings } from './lost';
import { ORIGIN, PERSON_HEIGHT, ROLL_MAX, ROLL_MIN, ROLL_WIDTH, TILE, TILES, WORLD_HEIGHT, personPosition, pickHotspot, regionAt, sceneAt, type HitTarget, type ScrollViewport } from './layout';

export function ScrollView({ game, center, setCenter, onPerson, onEnvironment, feedback, locked, onViewChange, onMap, onLost }: {
  game: GameState; center: number; setCenter: (x: number) => void;
  onPerson: (id: CharacterId) => void; onEnvironment: (id: string) => void; feedback: SceneReaction | null; locked: boolean; onViewChange?: (view:ScrollViewport)=>void; onMap?:()=>void;
  /** 汴河拾遗: a lost thing lying in the painting was picked up. */
  onLost?: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1200, height: 700 });
  const gesture = useRef<{ x: number; center: number; moved: boolean; id: number } | null>(null);
  const suppress = useRef(false);
  const [dragging, setDragging] = useState(false);
  const loadedTiles=useRef(new Set<number>());
  const [backgroundReady,setBackgroundReady]=useState(false),[willowReady,setWillowReady]=useState(false);
  useEffect(()=>{
    if(!backgroundReady)return;
    let frame=0,idle=0,timer:ReturnType<typeof setTimeout>|undefined;
    // The painting already contains its trees. The animated foreground can wait
    // for a complete background and a painted frame without changing any pixels.
    const first=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
      if(typeof window.requestIdleCallback==='function')idle=window.requestIdleCallback(()=>setWillowReady(true),{timeout:800});
      else timer=setTimeout(()=>setWillowReady(true),0);
    });});
    return()=>{cancelAnimationFrame(first);cancelAnimationFrame(frame);if(idle)window.cancelIdleCallback(idle);if(timer)clearTimeout(timer);};
  },[backgroundReady]);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const scale = Math.max(.28, size.height / WORLD_HEIGHT);
  const half = Math.min(ROLL_WIDTH / 2, size.width / scale / 2);
  const bound = (x: number) => Math.min(ROLL_MAX-half, Math.max(ROLL_MIN+half, x));
  const actual = bound(center);
  useEffect(()=>{onViewChange?.({from:actual-half,to:actual+half,center:actual});},[actual,half,onViewChange]);
  const tileReady=(tile:number)=>{
    loadedTiles.current.add(tile);
    const from=Math.max(0,Math.floor((actual-half+ORIGIN)/TILE)),to=Math.min(TILES-1,Math.floor((actual+half+ORIGIN-1)/TILE));
    if(Array.from({length:to-from+1},(_,i)=>from+i).every(k=>loadedTiles.current.has(k)))setBackgroundReady(true);
  };
  const scene = sceneAt(center);
  const move = (x: number) => setCenter(bound(x));
  const strip = useRef<HTMLDivElement>(null);
  /** A pointer tap goes to the nearest overlapping target; a keyboard press to the focused button. */
  const hit = (e: MouseEvent, own: HitTarget) => {
    let t = own;
    const r = strip.current?.getBoundingClientRect();
    if (e.detail > 0 && r) t = pickHotspot((e.clientX - r.left) / scale - ORIGIN, (e.clientY - r.top) / scale, game, scale) ?? own;
    if (t.kind === 'person') onPerson(t.id); else onEnvironment(t.id);
  };
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
      onClickCapture={e=>{ if(suppress.current) { e.stopPropagation(); e.preventDefault(); suppress.current=false; } }}>
      <div ref={strip} className="world-strip" style={{ width: ROLL_WIDTH*scale, height: WORLD_HEIGHT*scale, transform: `translate3d(${size.width/2-(actual+ORIGIN)*scale}px, ${Math.min(0,(size.height-WORLD_HEIGHT*scale)/2)}px, 0)`, '--world-scale': scale } as CSSProperties}>
        <PaintedLandscape state={game} feedback={feedback} center={actual} viewHalf={half} willowReady={willowReady} onTileReady={tileReady}/>
        {game.started && <div className="hotspots">
          {(Object.keys(CHARACTERS) as CharacterId[]).map(id => {
            const c=CHARACTERS[id];
            const {x,y}=personPosition(id,game);
            const featured=(scene==='paper'&&id==='liu')||(scene==='bridge'&&id==='zhou')||(scene==='tea'&&id==='he');
            return <button key={id} className={`person-hotspot ${featured?'featured':''} ${targetPerson===id?'located':''}`} style={{ left:(x+ORIGIN)*scale, top:(y-PERSON_HEIGHT*.48)*scale, width:Math.max(48,PERSON_HEIGHT*.64*scale), height:Math.max(48,PERSON_HEIGHT*scale) }} onClick={e=>hit(e,{kind:'person',id})} aria-label={`与${c.name}交谈，${c.role}`}>
              <span className="person-label"><span className="conversation-mark">···</span>{c.name}</span><span className="person-ring"/>
            </button>;
          })}
          {/* 汴河拾遗: small things lying in the painting, glinting now and then (lost.ts) */}
          {onLost && lyingThings(game).filter(t => Math.abs(t.x - actual) < half + 400).map(t => {
            const heard = game.progress.lost.heard.includes(t.id);
            return <button key={t.id} type="button" className="lost-thing" style={{ left:(t.x+ORIGIN)*scale - Math.max(22, t.w*scale/2), top:(t.y-t.h)*scale - Math.max(0, 22 - t.h*scale/2), width:Math.max(44, t.w*scale), height:Math.max(44, t.h*scale) }}
              onClick={() => onLost(t.id)} aria-label={heard ? `拾起${CHARACTERS[t.owner].name}的${t.name}` : '地上有个小东西，拾起来看看'}>
              <img src={`${import.meta.env.BASE_URL}art/china/lost/${t.id}.webp`} alt="" width={t.w*scale} height={t.h*scale} draggable={false}/>
              <span className="lost-glint" aria-hidden="true"/>
            </button>;
          })}
          {ENVIRONMENT.map(env => <button key={env.id} className={`environment-hotspot ${feedback?.id===env.id?'activated':''}`} style={{left:(env.x+ORIGIN)*scale,top:env.y*scale}} onClick={e=>hit(e,{kind:'environment',id:env.id})} aria-label={env.label}><span className="environment-dot"/><span className="environment-label">{env.label}</span></button>)}
        </div>}
      </div>
    </div>
    <div className="paper-edge top"/><div className="paper-edge bottom"/>
    {game.started && <>
      <button className="pan-button pan-left" aria-label="往左：虹桥与城门" onClick={()=>move(actual-800)} disabled={actual<=ROLL_MIN+half+1}><Icon name="back"/></button>
      <button className="pan-button pan-right" aria-label="往右：纸铺与郊野" onClick={()=>move(actual+800)} disabled={actual>=ROLL_MAX-half-1}><Icon name="arrow"/></button>
      <div className="scene-caption"><span className="scene-seal">汴京</span><div><small>沿河慢行 · 随处可停</small><p>{regionAt(actual).area} · {regionAt(actual).place}</p></div>{onMap&&<button type="button" className="town-map-open" aria-label="打开长卷地图" onClick={onMap}>地图</button>}</div>
      <div className="scroll-guide" aria-hidden="true"><span>←</span> 拖动画卷，寻一段人间烟火 <span>→</span></div>
    </>}
  </div>;
}
