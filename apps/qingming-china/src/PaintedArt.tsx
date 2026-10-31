import { CHARACTERS, type CharacterId } from './content';
import type { GameState } from './game';
import manifest from './art-manifest.json';
import { PERSON_HEIGHT, WORLD_HEIGHT, WORLD_WIDTH, personPosition, personPose } from './layout';

const artUrl = (file: string) => `${import.meta.env.BASE_URL}art/china/${file}`;
const people = Object.keys(CHARACTERS) as CharacterId[];
type Frame = { x: number; y: number; width: number; height: number };

// Nested SVG viewports crop an atlas without stretching or copying the source bitmap.
function Atlas({ asset, frame, x, y, width, height }: {
  asset: { file: string; width: number; height: number }; frame: Frame;
  x: number; y: number; width: number; height: number;
}) {
  return <svg x={x} y={y} width={width} height={height} viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`} overflow="hidden">
    <image href={artUrl(asset.file)} width={asset.width} height={asset.height}/>
  </svg>;
}

export function PaintedPerson({ id, x = 0, y = 0, height = PERSON_HEIGHT, pose = 0, flip = false, shadow = true }: {
  id: CharacterId; x?: number; y?: number; height?: number; pose?: 0 | 1 | 2; flip?: boolean; shadow?: boolean;
}) {
  const col = people.indexOf(id);
  const frame = manifest.characters.frames[pose * 6 + col];
  const factor = height / manifest.characters.frames[col].bodyHeight;
  return <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`} data-character={id} data-pose={pose}>
    {shadow && <ellipse rx={height * .16} ry={height * .025} fill="#625b43" opacity=".16"/>}
    <Atlas asset={manifest.characters} frame={frame} x={-frame.anchorX * factor} y={-frame.anchorY * factor} width={frame.width * factor} height={frame.height * factor}/>
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
  return <g className={className} transform={`translate(${x} ${y})`}><Atlas asset={manifest.props} frame={frame} x={-width / 2} y={-height} width={width} height={height}/></g>;
}

// Feet follow the bridge deck and the stone quays, rather than a rectangular grid.
const passers: { id: CharacterId; x: number; y: number; height: number; flip?: boolean }[] = [
  { id: 'cheng', x: 135, y: 470, height: 106 }, { id: 'chen', x: 340, y: 391, height: 104, flip: true },
  { id: 'he', x: 510, y: 347, height: 101 }, { id: 'zhou', x: 710, y: 358, height: 99 },
  { id: 'shen', x: 904, y: 420, height: 106, flip: true }, { id: 'liu', x: 1100, y: 510, height: 107 },
  { id: 'chen', x: 1310, y: 566, height: 105 }, { id: 'he', x: 1715, y: 570, height: 100 },
  { id: 'shen', x: 1980, y: 642, height: 106, flip: true }, { id: 'cheng', x: 2110, y: 628, height: 101 },
  { id: 'liu', x: 2460, y: 655, height: 102 }, { id: 'zhou', x: 2650, y: 745, height: 113, flip: true },
  { id: 'he', x: 3090, y: 852, height: 112 }, { id: 'cheng', x: 3500, y: 901, height: 112 },
];

export function PaintedLandscape({ state, feedback }: { state: GameState; feedback: string }) {
  const boatDone = state.progress.quests.boat.step === 3;
  const delivered = state.progress.route === 'deliver';
  const actors = [
    ...passers.map((p, i) => ({ ...p, key: `passer-${i}`, pose: 0 as const, crowd: true })),
    ...people.map(id => ({ ...personPosition(id, state), id, key: id, height: PERSON_HEIGHT, flip: false, pose: personPose(id, state), crowd: false })),
  ].sort((a, b) => a.y - b.y);
  return <svg id="world-art" viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} xmlns="http://www.w3.org/2000/svg" className="landscape painted-landscape" aria-hidden="true">
    <image href={artUrl(manifest.river.file)} width={WORLD_WIDTH} height={WORLD_HEIGHT}/>
    <g className="river-traffic">
      <PaintedBoat kind="small" x={610} y={784} width={270}/>
      <PaintedBoat kind="trader" x={470} y={1100} width={520}/>
      <PaintedBoat kind="cargo" x={boatDone ? 1530 : 1460} y={boatDone ? 978 : 1010} width={580} moored={boatDone}/>
      <PaintedBoat kind="passenger" x={3100} y={1140} width={470}/>
      <PaintedBoat kind="small" x={2365} y={1080} width={315} moored/>
    </g>
    {boatDone && <path d="M1757 913 1670 699m-218 228 84-234" stroke="#76664a" strokeWidth="2" fill="none"/>}
    <Prop kind="cart" x={1865} y={697} width={157}/>
    <Prop kind="kettle" x={2190} y={757} width={75} className={feedback === 'brazier' ? 'warm-kettle' : undefined}/>
    <Prop kind={feedback === 'cat' ? 'catStretch' : 'catSleep'} x={2525} y={775} width={feedback === 'cat' ? 85 : 65}/>
    {delivered && <Prop kind="cargo" x={2378} y={809} width={76}/>}
    {state.progress.tea && <Prop kind="guests" x={2080} y={796} width={190}/>}
    {actors.map(p => <g key={p.key} className={p.crowd ? `painted-passer passer-${passers.findIndex(a => a.x === p.x) % 8}` : 'story-person'}>
      <PaintedPerson id={p.id} x={p.x} y={p.y} height={p.height} pose={p.pose} flip={p.flip}/>
    </g>)}
    <Prop kind={state.progress.quests.paper.step > 0 ? 'paper' : 'flutter'} x={2928} y={790} width={95} className={state.progress.quests.paper.step === 0 ? 'paper-breeze' : undefined}/>
    <g fill="#eee4c9" stroke="#94866b" strokeWidth="1">
      <path d="M2685 482v85m-17-74h35v70h-35Z"/>
      <text x={2686} y={506} fontSize="15" writingMode="vertical-rl" stroke="none" fill="#5d5c48" fontFamily="serif" letterSpacing="5">笺纸</text>
    </g>
    <g className={feedback === 'sparrow' ? 'sparrows active' : 'sparrows'} stroke="#655e48" strokeWidth="2" fill="#877655">
      <path d="M1112 395q12-13 21 0l-9 6Zm25-4q12-13 21 0l-9 6Z"/>
    </g>
    <g transform="translate(1340 495)" stroke="#867955" fill="#ac9671" strokeWidth="2"><path d="M0 0v28m-8 0q8-20 16 0Zm8 0v8"/></g>
    {feedback === 'water' && <g className="water-rings" fill="none" stroke="#f4eed8" strokeWidth="2"><ellipse cx="1900" cy="1010" rx="44" ry="10"/><ellipse cx="1900" cy="1010" rx="76" ry="18"/></g>}
    <g className={feedback === 'willow' ? 'painted-willow active' : 'painted-willow'}>
      <image href={artUrl(manifest.willow.file)} x={2920} y={-30} width={750} height={375}/>
    </g>
  </svg>;
}
