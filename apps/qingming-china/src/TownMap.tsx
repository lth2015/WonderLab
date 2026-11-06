import { MAP_WIDTH, MAP_ROW_HEIGHT, MAP_ROWS, mapDestination, mapMarks, mapView, toMap, type LostMapHint } from './townMap';
import type { GameState } from './game';
import type { ScrollViewport } from './layout';

export function TownMap({game,view,onGo,lostHints=[]}:{game:GameState;view:ScrollViewport|null;onGo:(x:number)=>void;lostHints?:readonly LostMapHint[]}) {
  const marks=mapMarks(game,lostHints);
  return <section className="town-map" aria-label="汴河长卷地图">
    <p className="section-note">从卷首野渡到城内静巷，长卷在这里折成四段。点画中一处便可前往；用键盘选中一段，按回车或空格也能走到那里。</p>
    <div className="town-map-rows">{MAP_ROWS.map((row,i)=>{
      const here=mapView(i,view),rowMarks=marks.filter(m=>toMap(m.x,m.y).row===i);
      return <button key={row.start} type="button" className="town-map-row" aria-label={`前往${row.name}`} onClick={e=>{
        const r=e.currentTarget.querySelector('svg')!.getBoundingClientRect();
        onGo(mapDestination(i,e.detail===0?.5:(e.clientX-r.left)/r.width));
      }}>
        <span className="town-map-caption"><b>{row.name}</b>{here&&<span>正在看这一带</span>}</span>
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_ROW_HEIGHT}`} aria-hidden="true">
          <image href={`${import.meta.env.BASE_URL}art/china/map/china-map.webp`} width={MAP_WIDTH} height={MAP_ROW_HEIGHT*MAP_ROWS.length} y={-i*MAP_ROW_HEIGHT}/>
          {here&&<rect className="town-map-here" x={here.x} y={3} width={here.width} height={MAP_ROW_HEIGHT-6}/>}
          {rowMarks.map(m=>{const p=toMap(m.x,m.y);return <g key={m.id} className={`town-map-mark ${m.kind}`} transform={`translate(${Math.min(MAP_WIDTH-24,Math.max(24,p.px))} ${p.py})`}><circle r={22}/><text textAnchor="middle" dominantBaseline="central">{m.kind==='ask'?'待':'？'}</text></g>;})}
        </svg>
      </button>;
    })}</div>
    <p className="town-map-legend"><span><i/>正在看的画卷</span><span><b>待</b>有人在等</span>{marks.some(m=>m.kind==='lost')&&<span><b>？</b>听过的失物线索</span>}</p>
    <details className="town-map-list"><summary>标记所在 · 也可用文字前往</summary>
      {marks.length?<ul>{marks.map(m=><li key={m.id}><button type="button" onClick={()=>onGo(m.x)}>{m.kind==='ask'?'待':'？'} · {m.label}</button></li>)}</ul>:<p>此刻没有待办的相遇，仍可以沿河随处走走。</p>}
    </details>
  </section>;
}
