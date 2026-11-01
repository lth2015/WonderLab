import { useId, useState } from 'react';

const art = (file: string) => `${import.meta.env.BASE_URL}art/china/${file}`;
/** Pixel coordinates in scroll-16; keep the exact tile projection and overlap. */
export const MILL = { tileX: 8400, scaleX: 1201 / 1024, scaleY: 1200 / 1024, left: 8940, right: 9340 };

/** Mounted near the mill only. Failed/unfinished layers leave the original painting intact. */
export function Watermill({ running }: { running: boolean }) {
  const id = useId().replace(/:/g, '');
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState(false);
  const ready = loaded === 3 && !failed;
  const load = (bit: number) => setLoaded(value => value | bit);
  return <g className={`watermill ${running && ready ? 'mill-running' : 'mill-paused'}`} data-ready={ready} aria-hidden="true"
    transform={`translate(${MILL.tileX} 0) scale(${MILL.scaleX} ${MILL.scaleY})`} pointerEvents="none">
    <defs>
      <clipPath id={`${id}-front`}>
        {/* Original bearing, posts, trough and near rail sit in front of the rotor. */}
        <path d="M596 602 Q616 595 623 613 L627 627 L612 634 L594 624 Z M589 624 L631 630 L632 642 L588 636 Z M532 647 L628 657 L630 670 L532 660 Z M537 658 L550 660 L548 778 L537 776 Z M617 668 L631 670 L631 785 L618 786 Z M548 711 L619 724 L620 738 L548 725 Z M615 746 L649 723 L653 730 L626 751 Z M530 653 L470 699 L474 706 L539 662 Z M648 489 L691 485 L753 507 L752 518 L688 499 L648 501 Z"/>
      </clipPath>
      <clipPath id={`${id}-fall`}>
        <path d="M697 518 Q720 550 728 590 Q747 658 728 722 L708 789 Q750 806 788 790 Q774 760 777 719 Q796 629 760 552 L739 510 Z"/>
      </clipPath>
      <pattern id={`${id}-water`} width="23" height="44" patternUnits="userSpaceOnUse">
        <path d="M3 -8 Q-1 3 5 13 T4 34 M15 9 Q22 20 16 31 T17 52" fill="none" stroke="#e9e8d6" strokeWidth="1.3" opacity=".48"/>
        <path d="M10 -3 L13 10 M8 28 L9 37 M21 6 L20 17" fill="none" stroke="#8c9b8d" strokeWidth=".8" opacity=".38"/>
      </pattern>
    </defs>
    <g opacity={ready ? 1 : 0}>
      <image href={art('watermill/backplate-v1.webp')} x={464} y={456} width={340} height={356} onLoad={() => load(1)} onError={() => setFailed(true)}/>
      {/* Perspective S · R · S⁻¹: placement never shares the animated transform. */}
      <g transform="translate(605 615)">
        <g transform="scale(.85 1)">
          <g className="mill-rotor">
            <g transform={`scale(${1 / .85} 1)`}>
              <image href={art('watermill/rotor-v1.webp')} x={-136} y={-160} width={272} height={320} onLoad={() => load(2)} onError={() => setFailed(true)}/>
            </g>
          </g>
        </g>
      </g>
      <g clipPath={`url(#${id}-front)`}>
        <image href={art('scroll/scroll-16.webp')} width={1024} height={1024}/>
      </g>
      {/* The painted fall is retained; a masked, downward texture moves over it. */}
      <g clipPath={`url(#${id}-fall)`}>
        <image href={art('scroll/scroll-16.webp')} width={1024} height={1024}/>
        <g className="mill-current"><rect x={685} y={462} width={120} height={400} fill={`url(#${id}-water)`}/></g>
      </g>
      <g className="mill-spray" fill="none" stroke="#dedfcf" strokeWidth="1.2" strokeLinecap="round">
        <path d="M722 791 Q715 780 710 786 M736 792 Q738 779 742 781 M752 790 Q762 781 766 789 M774 794 Q783 786 787 792"/>
      </g>
      <g className="mill-ripple" fill="none" stroke="#d6dac8" strokeWidth="1">
        <ellipse cx={743} cy={804} rx={44} ry={7}/><ellipse cx={726} cy={813} rx={30} ry={4}/>
      </g>
    </g>
  </g>;
}
