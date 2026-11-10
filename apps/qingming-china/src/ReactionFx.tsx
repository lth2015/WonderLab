import type { CSSProperties } from 'react';
import { ENVIRONMENT } from './content';
import { REACTIONS, type ReactionKind, type SceneReaction } from './reactions';

/** Small local ink marks, anchored in world coordinates; CSS only moves inner groups. */
export function ReactionFx({ reaction }: { reaction: SceneReaction | null }) {
  if(!reaction)return null;
  const env=ENVIRONMENT.find(value=>value.id===reaction.id)!;
  const kind:ReactionKind=REACTIONS[reaction.id];
  return <g key={`${reaction.id}-${reaction.serial}`} transform={`translate(${env.x} ${env.y})`} data-reaction-id={env.id} data-reaction-kind={kind} aria-hidden="true" pointerEvents="none">
    <g className="reaction-static" fill="none" stroke="#788565" strokeWidth={3}><ellipse rx={36} ry={14}/><path d="M-30-18q30-16 60 0"/></g>
    <g className={`reaction-particles reaction-${kind}`} fill="none" stroke="#a29b78" strokeWidth={2.5} strokeLinecap="round">
      {(kind==='leaves'||kind==='shavings')&&[0,1,2,3,4].map(i=><g key={i} className="reaction-fall" style={{'--drift':`${(i-2)*17}px`,'--fall':`${45+i*9}px`,'--delay':`${i*-.08}s`} as CSSProperties}><path d={kind==='leaves'?`M${(i-2)*15} -18q-14-12-9-23 19 2 9 23Z`:`M${(i-2)*18} -10q-12-20 4-23q14 1 0 9`} fill={kind==='leaves'?'#7f8d64':'none'} stroke={kind==='leaves'?'#697854':'#b4966b'}/></g>)}
      {kind==='ripples'&&[0,1,2].map(i=><g key={i} className="reaction-ripple" style={{'--delay':`${i*.13}s`} as CSSProperties}><ellipse rx={30+i*20} ry={8+i*5} stroke="#d3d5b9" strokeWidth={3}/></g>)}
      {kind==='breeze'&&<g className="reaction-breeze"><path d="M-58-20q32-22 68-12t35-8M-38 0q28-18 55-9t39-8M-19 18q22-13 46-8" stroke="#b0ae8a"/></g>}
      {kind==='stretch'&&<g className="reaction-lift"><path d="M-48-20q-14-12-7-30M-30-43l-6-18M38-28q16-9 12-28" stroke="#9c8b64"/></g>}
      {kind==='birds'&&[0,1].map(i=><g key={i} transform={`translate(${i*32-18} ${i*8-10})`}><g className="reaction-bird" style={{'--delay':`${i*-.12}s`} as CSSProperties}><path d="M-18 0q9-18 18 0q9-18 18 0" stroke="#6d7257" strokeWidth={4}/></g></g>)}
      {kind==='dust'&&[0,1,2,3,4].map(i=><g key={i} className="reaction-dust" style={{'--drift':`${(i-2)*22}px`,'--delay':`${i*.06}s`} as CSSProperties}><circle cx={(i-2)*9} cy={0} r={4+i%2*2} fill="#b8a67d" stroke="none"/></g>)}
      {kind==='steam'&&[0,1,2].map(i=><g key={i} transform={`translate(${(i-1)*15} -12)`}><g className="reaction-lift" style={{'--delay':`${i*-.13}s`} as CSSProperties}><path d="M0 0q-14-18 0-34t-1-27" stroke="#d4d4b8" strokeWidth={4}/></g></g>)}
      {kind==='chime'&&<g className="reaction-chime"><path d="M-20-14q-16 15-1 30M-33-22q-25 24-1 45M20-14q16 15 1 30M33-22q25 24 1 45" stroke="#a49a70"/></g>}
    </g>
  </g>;
}
