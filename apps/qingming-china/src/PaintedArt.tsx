import type { CSSProperties } from 'react';
import { CHARACTERS, type CharacterId } from './content';
import type { GameState } from './game';
import manifest from './art-manifest.json';
import { ORIGIN, PERSON_HEIGHT, ROLL_WIDTH, TILE, TILES, WORLD_HEIGHT, WORLD_WIDTH, personPosition, personPose } from './layout';
import { WALKERS, walkRoute } from './walkers';
import { ReactionFx } from './ReactionFx';
import type { SceneReaction } from './reactions';
import { MILL, Watermill, WatermillFrame } from './Watermill';

const artUrl = (file: string) => `${import.meta.env.BASE_URL}art/china/${file}`;
const people = Object.keys(CHARACTERS) as CharacterId[];
type Frame = { x: number; y: number; width: number; height: number };
const deckLine = '0,305 100,276 200,246 300,218 400,201 480,197 560,203 640,222 720,250 800,283 880,316';

// Nested SVG viewports crop an atlas without stretching or copying the source bitmap.
function Atlas({ asset, frame, x, y, width, height }: {
  asset: { file: string; width: number; height: number }; frame: Frame;
  x: number; y: number; width: number; height: number;
}) {
  return <svg x={x} y={y} width={width} height={height} viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`} overflow="hidden">
    <image href={artUrl(asset.file)} width={asset.width} height={asset.height}/>
  </svg>;
}

export function PaintedPerson({ id, x = 0, y = 0, height = PERSON_HEIGHT, pose = 0, flip = false, shadow = true, idle = false }: {
  id: CharacterId; x?: number; y?: number; height?: number; pose?: 0 | 1 | 2; flip?: boolean; shadow?: boolean; idle?: boolean;
}) {
  const col = people.indexOf(id);
  const frame = manifest.characters.frames[pose * 6 + col];
  const factor = height / manifest.characters.frames[col].bodyHeight;
  return <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`} data-character={id} data-pose={pose}>
    {shadow && <ellipse rx={height * .16} ry={height * .025} fill="#625b43" opacity=".16"/>}
    <g className={idle?'person-idle':undefined}><Atlas asset={manifest.characters} frame={frame} x={-frame.anchorX * factor} y={-frame.anchorY * factor} width={frame.width * factor} height={frame.height * factor}/></g>
  </g>;
}

const boatFrames = {
  cargo: { x: 0, y: 40, width: 916, height: 425 },
  small: { x: 920, y: 50, width: 616, height: 420 },
  trader: { x: 0, y: 475, width: 940, height: 500 },
  passenger: { x: 940, y: 500, width: 596, height: 475 },
};
function PaintedBoat({ kind, x, y, width, moored = false }: { kind: keyof typeof boatFrames; x: number; y: number; width: number; moored?: boolean }) {
  const frame = boatFrames[kind];
  const height = width * frame.height / frame.width;
  return <g transform={`translate(${x} ${y})`}><g className={moored ? 'moored-boat' : 'floating-boat'}>
    <ellipse cx={0} cy={-8} rx={width * .44} ry={width * .035} fill="#546d62" opacity=".1"/>
    <Atlas asset={manifest.boats} frame={frame} x={-width / 2} y={-height} width={width} height={height}/>
  </g></g>;
}
const propFrames = {
  flutter: { x: 0, y: 0, width: 485, height: 470 },
  paper: { x: 485, y: 0, width: 435, height: 470 },
  kettle: { x: 920, y: 0, width: 410, height: 470 },
  cargo: { x: 1330, y: 0, width: 444, height: 470 },
  catSleep: { x: 0, y: 470, width: 440, height: 417 },
  catStretch: { x: 440, y: 470, width: 390, height: 417 },
  guests: { x: 830, y: 470, width: 490, height: 417 },
  cart: { x: 1320, y: 470, width: 454, height: 417 },
};
function Prop({ kind, x, y, width, className }: { kind: keyof typeof propFrames; x: number; y: number; width: number; className?: string }) {
  const frame = propFrames[kind], height = width * frame.height / frame.width;
  return <g transform={`translate(${x} ${y})`}><g className={className}><Atlas asset={manifest.props} frame={frame} x={-width / 2} y={-height} width={width} height={height}/></g></g>;
}

/** The long scroll's tiles within reach of the view (and one more each side, so a drag never shows paper). */
function RollTiles({ center, viewHalf, only }: { center: number; viewHalf: number; only?: number }) {
  const from = only ?? Math.floor((center - viewHalf + ORIGIN) / TILE) - 1, to = only ?? Math.floor((center + viewHalf + ORIGIN) / TILE) + 1;
  const tiles = [];
  for (let k = Math.max(0, from); k <= Math.min(TILES - 1, to); k++)
    tiles.push(<image key={k} href={artUrl(`scroll/scroll-${String(k).padStart(2, '0')}.webp`)} x={k * TILE - ORIGIN} y={0} width={TILE + 1} height={WORLD_HEIGHT} preserveAspectRatio="none"/>);
  return <g className="roll-tiles">{tiles}</g>;
}

export function PaintedLandscape({ state, feedback, center, viewHalf, stillTile }: { state: GameState; feedback: SceneReaction | null; center: number; viewHalf: number; stillTile?: number }) {
  const still=stillTile!==undefined;
  const visible=(x:number,half=0)=>!still||x+half>=center-viewHalf&&x-half<=center+viewHalf;
  const active=feedback?.id;
  const boatDone = state.progress.quests.boat.step === 3;
  const delivered = state.progress.route === 'deliver';
  const actors = [
    ...WALKERS.map((p, i) => ({ ...p, key: `passer-${i}`, pose: 0 as const, crowd: true, index:i })),
    ...people.map(id => ({ ...personPosition(id, state), id, key: id, height: PERSON_HEIGHT, flip: false, pose: personPose(id, state), crowd: false, index:people.indexOf(id) })),
  ].sort((a, b) => a.y - b.y);
  return <svg id="world-art" viewBox={`${still?stillTile*TILE-ORIGIN:-ORIGIN} 0 ${still?TILE:ROLL_WIDTH} ${WORLD_HEIGHT}`} xmlns="http://www.w3.org/2000/svg" className="landscape painted-landscape" aria-hidden="true">
    <defs><mask id="bridge-front-rails" maskUnits="userSpaceOnUse" x="0" y="225" width="1470" height="330">
      <g transform={`scale(${WORLD_WIDTH / manifest.river.width})`} fill="none" stroke="white" strokeLinejoin="round">
        <polyline points={deckLine} transform="translate(0 -42)" strokeWidth="4"/>
        <polyline points={deckLine} transform="translate(0 -26)" strokeWidth="3"/>
        <polyline points={deckLine} transform="translate(0 -10)" strokeWidth="5"/>
      </g>
    </mask></defs>
    <RollTiles center={center} viewHalf={viewHalf} only={stillTile}/>
    {(still?visible((MILL.left+MILL.right)/2,(MILL.right-MILL.left)/2):center + viewHalf > MILL.left - TILE && center - viewHalf < MILL.right + TILE) &&
      (still?<WatermillFrame/>:<Watermill running={center + viewHalf > MILL.left && center - viewHalf < MILL.right} reduced={state.settings.reduced}/>)}
    <g className="river-traffic">
      {visible(610,135)&&<PaintedBoat kind="small" x={610} y={784} width={270}/>}
      {visible(470,260)&&<PaintedBoat kind="trader" x={470} y={1100} width={520}/>}
      {visible(boatDone?1530:1460,290)&&<PaintedBoat kind="cargo" x={boatDone ? 1530 : 1460} y={boatDone ? 978 : 1010} width={580} moored={boatDone}/>}
      {visible(3100,235)&&<PaintedBoat kind="passenger" x={3100} y={1140} width={470}/>}
      {visible(2365,158)&&<PaintedBoat kind="small" x={2365} y={1080} width={315} moored/>}
    </g>
    {boatDone && visible(1605,155) && <path d="M1757 913 1670 699m-218 228 84-234" stroke="#76664a" strokeWidth="2" fill="none"/>}
    {visible(1865,79)&&<Prop kind="cart" x={1865} y={697} width={157}/>}
    {visible(2190,38)&&<Prop kind="kettle" x={2190} y={757} width={75} className={active === 'brazier' ? 'warm-kettle' : undefined}/>}
    {visible(2525,43)&&<Prop kind={active === 'cat' ? 'catStretch' : 'catSleep'} x={2525} y={775} width={active === 'cat' ? 85 : 65}/>}
    {delivered && visible(2378,38) && <Prop kind="cargo" x={2378} y={809} width={76}/>}
    {state.progress.tea && visible(2080,95) && <Prop kind="guests" x={2080} y={796} width={190}/>}
    {actors.filter(p=>!still||Math.abs(p.x-center)<viewHalf+p.height).map(p => {
      if(still)return <PaintedPerson key={p.key} id={p.id} x={p.x} y={p.y} height={p.height} pose={p.pose} flip={p.flip}/>;
      const route=walkRoute(p,p.index),sleep=Math.abs(p.x-center)>viewHalf+180;
      return <g key={p.key} transform={`translate(${p.x} ${p.y})`} className={`${p.crowd?'painted-passer':'story-person'}${sleep?' motion-sleep':''}`} data-walker={p.crowd?p.index:undefined}
        style={{'--walk-from-x':`${route.fromX}px`,'--walk-from-y':`${route.fromY}px`,'--walk-to-x':`${route.toX}px`,'--walk-to-y':`${route.toY}px`,'--walk-duration':`${route.seconds}s`,'--walk-delay':`${route.delay}s`,'--idle-delay':`${-p.index*.7}s`} as CSSProperties}>
        {p.crowd?<g className="walk-route"><g className="walk-facing"><g className="walk-gait"><PaintedPerson id={p.id} height={p.height} pose={p.pose} flip={p.flip}/></g></g></g>:<PaintedPerson id={p.id} height={p.height} pose={p.pose} idle/>}
      </g>;
    })}
    {/* the bridge's front rails drawn again over the people on the deck; the same pixels as the roll's tiles 9–10 */}
    {(!still||center-viewHalf<1470&&center+viewHalf>0)&&<g mask="url(#bridge-front-rails)">
      {[9, 10].map(k => <image key={k} href={artUrl(`scroll/scroll-${String(k).padStart(2, '0')}.webp`)} x={k * TILE - ORIGIN} y={0} width={TILE + 1} height={WORLD_HEIGHT} preserveAspectRatio="none"/>)}
    </g>}
    {visible(2928,48)&&<Prop kind={state.progress.quests.paper.step > 0 ? 'paper' : 'flutter'} x={2928} y={790} width={95} className={state.progress.quests.paper.step === 0 ? 'paper-breeze' : undefined}/>}
    {visible(2685,20)&&<g fill="#eee4c9" stroke="#94866b" strokeWidth="1">
      <path d="M2685 482v85m-17-74h35v70h-35Z"/>
      <text x={2686} y={506} fontSize="15" writingMode="vertical-rl" stroke="none" fill="#5d5c48" fontFamily="serif" letterSpacing="5">笺纸</text>
    </g>}
    {visible(1130,30)&&<g className="sparrows" opacity={active==='sparrow'?0:1} stroke="#655e48" strokeWidth="2" fill="#877655">
      <path d="M1112 395q12-13 21 0l-9 6Zm25-4q12-13 21 0l-9 6Z"/>
    </g>}
    {visible(1340,20)&&<g transform="translate(1340 495)" stroke="#867955" fill="#ac9671" strokeWidth="2"><path d="M0 0v28m-8 0q8-20 16 0Zm8 0v8"/></g>}
    {visible(3295,375)&&<g transform="translate(2920 -30)"><g className={active==='willow'?'painted-willow active':'painted-willow'}>
      <image href={artUrl(manifest.willow.file)} x={0} y={0} width={750} height={375}/>
    </g></g>}
    <ReactionFx reaction={feedback}/>
  </svg>;
}

// Static journal compositions reuse the same painted props without mounting the live scroll.
export { Prop as PaintedProp };
