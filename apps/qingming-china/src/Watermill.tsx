import { useId, useState } from 'react';
import { Waterwheel } from './Waterwheel';

const art = (file: string) => `${import.meta.env.BASE_URL}art/china/${file}`;
/** Pixel coordinates in scroll-16; keep the exact tile projection and overlap. */
export const MILL = { tileX: 8400, scaleX: 1201 / 1024, scaleY: 1200 / 1024, left: 8940, right: 9340 };
const frontFramePath='M589 624 L631 630 L632 642 L588 636 Z M532 647 L628 657 L630 670 L532 660 Z M537 658 L550 660 L548 778 L537 776 Z M617 668 L631 670 L631 785 L618 786 Z M548 711 L619 724 L620 738 L548 725 Z M615 746 L649 723 L653 730 L626 751 Z M530 653 L470 699 L474 706 L539 662 Z M648 489 L691 485 L753 507 L752 518 L688 499 L648 501 Z';
const streams = [
  'M719 518 C734 546 749 588 751 618 S750 682 742 718 Q736 756 731 789',
  'M729 517 C744 550 760 597 762 632 S756 701 753 735 L759 794',
  'M739 523 C750 548 768 598 770 636 S762 710 771 761 L777 792',
];

/** A source-composed, fixed frame for pictures: no load state, effects or live canvas. */
export function WatermillFrame() {
  const id='scroll-still-mill';
  return <g transform={`translate(${MILL.tileX} 0) scale(${MILL.scaleX} ${MILL.scaleY})`}>
    <defs>
      <clipPath id={`${id}-front`}><path d={frontFramePath}/><ellipse cx={605} cy={615} rx={8.5} ry={9.5}/></clipPath>
      <linearGradient id={`${id}-waterline`} x1="0" y1="762" x2="0" y2="787" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="white"/><stop offset=".3" stopColor="white"/><stop offset="1" stopColor="black"/></linearGradient>
      <mask id={`${id}-immersed`} maskUnits="userSpaceOnUse" x="440" y="430" width="380" height="390"><rect x="440" y="430" width="380" height="390" fill={`url(#${id}-waterline)`}/></mask>
      <mask id={`${id}-rivulets`} maskUnits="userSpaceOnUse" x="690" y="505" width="110" height="300">{streams.map((d,i)=><path key={d} d={d} fill="none" stroke="white" strokeWidth={18-i*4} opacity={.82-i*.1}/>)}</mask>
      <pattern id={`${id}-waterpaint`} width="18" height="144" patternUnits="userSpaceOnUse"><image href={art('watermill/fall-texture-v2.webp')} width="18" height="144"/></pattern>
    </defs>
    <image href={art('watermill/backplate-v1.webp')} x={464} y={456} width={340} height={356}/>
    <ellipse cx={620} cy={778} rx={73} ry={6} fill="#354037" opacity=".16"/>
    <g mask={`url(#${id}-immersed)`}>
      <g transform="translate(624 610)" opacity={.35}><image href={art('watermill/face-v2.webp')} x={-140.25} y={-165} width={280.5} height={330}/></g>
      <svg x={565} y={440} width={225} height={355} viewBox="0 0 180 284" overflow="hidden"><image href={art('watermill/buckets-v2.webp')} width={1260} height={1704}/></svg>
      <image href={art('watermill/face-v2.webp')} x={605-140.25} y={615-165} width={280.5} height={330} opacity={.93}/>
      <path d="M718 520 A139 163 0 0 1 686 748" fill="none" stroke="#213c32" strokeWidth={11} opacity=".11"/>
    </g>
    <g clipPath={`url(#${id}-front)`}><image href={art('scroll/scroll-16.webp')} width={1024} height={1024}/></g>
    <g mask={`url(#${id}-rivulets)`}><image href={art('scroll/scroll-16.webp')} width={1024} height={1024} opacity=".35"/><rect x={690} y={350} width={110} height={600} fill={`url(#${id}-waterpaint)`} opacity=".8"/></g>
    <path d="M709 800q13-4 24-1m6 2q23-2 43 1m-64 6q22 3 39 0" fill="none" stroke="#ced6c1" strokeWidth=".8"/>
  </g>;
}

/** Mounted near the mill only. Failed/unfinished layers leave the original painting intact. */
export function Watermill({ running, reduced }: { running: boolean; reduced: boolean }) {
  const id = useId().replace(/:/g, '');
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState(false);
  const ready = loaded === 15 && !failed;
  const load = (bit: number) => setLoaded(value => value | bit);
  return <g className={`watermill ${running && ready ? 'mill-running' : 'mill-paused'}`} data-ready={ready} aria-hidden="true"
    transform={`translate(${MILL.tileX} 0) scale(${MILL.scaleX} ${MILL.scaleY})`} pointerEvents="none">
    <defs>
      <clipPath id={`${id}-front`}>
        {/* Bearing blocks and posts keep their original pixels; the blurred old hub is excluded. */}
        <path d={frontFramePath}/>
        <ellipse cx={605} cy={615} rx={8.5} ry={9.5}/>
      </clipPath>
      <linearGradient id={`${id}-waterline`} x1="0" y1="762" x2="0" y2="787" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="white"/><stop offset=".3" stopColor="white"/><stop offset="1" stopColor="black"/>
      </linearGradient>
      <mask id={`${id}-immersed`} maskUnits="userSpaceOnUse" x="440" y="430" width="380" height="390">
        <rect x="440" y="430" width="380" height="390" fill={`url(#${id}-waterline)`}/>
      </mask>
      <mask id={`${id}-rivulets`} maskUnits="userSpaceOnUse" x="690" y="505" width="110" height="300">
        {streams.map((d,i) => <path key={d} d={d} fill="none" stroke="white" strokeWidth={18-i*4} opacity={.82-i*.1}/>)}
      </mask>
      <pattern id={`${id}-waterpaint`} width="18" height="144" patternUnits="userSpaceOnUse">
        <image href={art('watermill/fall-texture-v2.webp')} width="18" height="144" onLoad={() => load(4)} onError={() => setFailed(true)}/>
      </pattern>
    </defs>
    <g opacity={ready ? 1 : 0}>
      <image href={art('watermill/backplate-v1.webp')} x={464} y={456} width={340} height={356} onLoad={() => load(1)} onError={() => setFailed(true)}/>
      <ellipse cx={620} cy={778} rx={73} ry={6} fill="#354037" opacity=".16"/>
      <g mask={`url(#${id}-immersed)`}>
        <ellipse cx={624} cy={615} rx={132} ry={158} fill="none" stroke="#343526" strokeWidth={5} opacity=".15"/>
        <Waterwheel face={art('watermill/face-v2.webp')} buckets={art('watermill/buckets-v2.webp')} running={running && ready} reduced={reduced} onLoad={() => load(2)} onBucketsLoad={() => load(8)} onError={() => setFailed(true)}/>
        {/* Wet timber stays on the receiving side instead of rotating a painted highlight. */}
        <path d="M718 520 A139 163 0 0 1 686 748" fill="none" stroke="#213c32" strokeWidth={11} opacity=".11"/>
      </g>
      <g clipPath={`url(#${id}-front)`} data-layer="fixed-frame">
        <image href={art('scroll/scroll-16.webp')} width={1024} height={1024}/>
      </g>
      {/* Painted water fibers move inside fixed, irregular rivulets; no uniform dashed stripes. */}
      <g mask={`url(#${id}-rivulets)`}>
        <image href={art('scroll/scroll-16.webp')} width={1024} height={1024} opacity=".35"/>
        <g className="mill-current" opacity=".78"><rect x={690} y={350} width={110} height={600} fill={`url(#${id}-waterpaint)`}/></g>
        <g className="mill-current mill-current-fine" opacity=".35"><rect x={690} y={350} width={110} height={600} fill={`url(#${id}-waterpaint)`}/></g>
      </g>
      <g className="mill-spray" fill="none" stroke="#d8dfca" strokeWidth=".9" strokeLinecap="round">
        <path d="M725 791q-4-6-7-3m14 8q-1-8 3-9m10 8q5-8 8-4m11 5q5-7 10-2 M593 777q-4-6-7-2m22 6q5-7 9-3m12 0q4-4 7-1"/>
      </g>
      <g fill="#d8e0cb" opacity=".32">
        <ellipse cx={733} cy={796} rx={2.8} ry={.8}/><ellipse cx={744} cy={794} rx={1.5} ry={.65}/><ellipse cx={756} cy={799} rx={3} ry={.7}/><ellipse cx={769} cy={797} rx={1.7} ry={.8}/><ellipse cx={780} cy={800} rx={2} ry={.65}/>
      </g>
      <g fill="none" stroke="#ced6c1" strokeWidth=".8">
        <path className="mill-ripple" d="M709 800q13-4 24-1m6 2q23-2 43 1m-64 6q22 3 39 0"/>
        <path className="mill-ripple mill-ripple-late" d="M699 808q12-3 20 0m8 4q23 3 50-1"/>
        <path className="mill-ripple mill-ripple-wheel" d="M571 783q16-4 29-1m6 3q18 4 42-1m-56 5q17 3 32 0"/>
      </g>
    </g>
  </g>;
}
