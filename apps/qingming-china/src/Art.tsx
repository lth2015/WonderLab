import type { CSSProperties } from 'react';
import type { GameState } from './game';

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    book: <><path d="M12 6C8 3 4 4 3 5v14c3-2 6-1 9 1 3-2 6-3 9-1V5c-3-2-6-1-9 1Z"/><path d="M12 6v14M6 8l3 1m-3 3 3 1m6-4 3-1m-3 5 3-1"/></>,
    bag: <><path d="m8 3 1 4h6l1-4M9 7C7 9 3 12 4 17c1 5 15 5 16 0 1-5-3-8-5-10M7 3h10M8 11h8"/><circle cx="12" cy="15" r="2"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6 6-2Z"/></>,
    sound: <><path d="m11 4-5 4H3v8h3l5 4V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
    mute: <><path d="m11 4-5 4H3v8h3l5 4V4Zm5 5 6 6m0-6-6 6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    arrow: <path d="M4 12h15m-5-5 5 5-5 5"/>,
    leaf: <><path d="M20 3C6 1 1 10 7 17s17-1 13-14ZM5 21 17 7m-7 7-1-6m5 2 5 1"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/></>,
    check: <path d="m5 12 5 5L20 6"/>,
    brush: <><path d="m8 14 9-12 4 3-10 11M8 14c-6-1-1 6-6 7 8 1 10-3 9-5Z"/></>,
    back: <path d="M20 12H5m5-5-5 5 5 5"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.leaf}</svg>;
}

export function Person({ x = 0, y = 0, color = '#6c827b', scale = 1, pose = 0, flip = false, hat = false }: { x?: number; y?: number; color?: string; scale?: number; pose?: number; flip?: boolean; hat?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`} stroke="#514e40" strokeWidth="1.15" strokeLinejoin="round">
    <ellipse cx="0" cy="1" rx="15" ry="3.5" fill="#6d654b" opacity=".12" stroke="none"/>
    <path d="m-5-9-3 10 5 1 5-11m3-1 2 10 6 1-5-13" fill="#484b41"/>
    <path d="M-6-42Q-11-36-9-23l-5 15Q0-2 14-8L7-25 8-40Z" fill={color}/>
    <path d="M-6-40 0-31 7-42M0-31l-2 19m-7-12 18 2m-18 1 18 2" fill="none"/>
    <path d={pose === 1 ? 'M-7-38-20-29l-2 5 6 1 14-10M8-38l16 0 3 7-19 0' : pose === 2 ? 'M-8-37-18-24l8 9 5-5-5-5 9-9M7-38l10 13-5 10-5-4 3-6-6-8' : 'M-8-38-17-19l7 3 6-17M8-38l10 16-6 5-8-16'} fill={color}/>
    <path d={pose === 1 ? 'm24-36 5 2-2 4-4-1m-45 7 2 4 4-1 1-4' : 'm-11 8 1-5 4 1-1 4m18-4 3-3 4 2-4 4'} fill="#c6ad85"/>
    <path d="M-4-43v-6h8v7" fill="#c4ad86"/><ellipse cx="0" cy="-53" rx="7" ry="9" fill="#cfb992"/>
    <path d="M-7-53Q-9-65 1-63q10 2 6 14L4-59-3-58Z" fill="#454a40"/>
    <path d="M-2-63q-4-10 3-9t3 10Z" fill="#454a40"/>
    {hat && <path d="M-14-59 0-71 15-59 2-56Z" fill="#b7a275"/>}
    <path d="m3-53 1 0m0 5-2 0" strokeWidth=".8"/>
    {pose === 2 && <path d="M-30-35h60M-29-35l-5 25m62-25 7 25m-76 0h15v12h-15Zm69 0h15v12H28Z" fill="#baab80"/>}
  </g>;
}

function House({ x, y, scale = 1, width = 220, sign = '', tone = '#baac85', awning = false }: { x: number; y: number; scale?: number; width?: number; sign?: string; tone?: string; awning?: boolean }) {
  const w = width;
  return <g transform={`translate(${x} ${y}) scale(${scale})`} stroke="#6c6852" strokeWidth="1.3" strokeLinejoin="round">
    <path d={`M0 0 ${w} 0 ${w+50} -32 50 -32Z`} fill="#8e8a6b" opacity=".14" stroke="none"/>
    <path d={`M0-3V-115h${w}V-3Z`} fill="#d5c7a5"/>
    <path d={`M${w}-3V-115l52-35V-37Z`} fill="#bdb18e"/>
    <path d={`M-25-113Q${w/2-2}-163 ${w/2+25}-230l${w/2+70} 77Q${w+24}-128 ${w+25}-113Z`} fill={tone}/>
    <path d={`M${w/2+25}-230 95-259-75-146l50 33Q${w/2}-160 ${w/2+25}-230Z`} fill="#b1ac8c"/>
    <path d={`M95-259q35 20 80 18l${w/2+72} 75-40 13Z`} fill="#95977b"/>
    {Array.from({ length: 18 }, (_, i) => <path key={i} d={`M${-19+i*(w+40)/18}-117q${(w/2-i*(w+40)/18)*.4}-26 ${w/2+22-(-19+i*(w+40)/18)}-109`} fill="none" opacity=".55" strokeWidth=".7"/>)}
    {[0,1,2,3].map(i => <path key={i} d={`M${-10+i*16}-${124+i*22}q${w/2-16-i*12}-20 ${w+20-i*33} 0`} fill="none" opacity=".5" strokeWidth=".7"/>)}
    <path d={`M-25-112H${w+24}v9H-22Zm${w+24} 0 40-35-1-9-39 34`} fill="#7f8066"/>
    {[10, w/2, w-10].map((p,i)=><g key={i}><path d={`M${p}-104V-5m-5-88h10M${p-5}-5h10`} strokeWidth="4"/><path d={`M${p+8}-87h${w/2-29}v56H${p+8}Z`} fill={i===1 ? '#766f55':'#aaa581'}/>{Array.from({length:5},(_,k)=><path key={k} d={`M${p+12+k*(w/2-35)/5}-84v50`} strokeWidth=".8"/>)}</g>)}
    <path d={`M-5 0H${w+5}v8H-5Z`} fill="#b5a783"/>
    {sign && <g><path d={`M${w/2-47}-99h94v29h-94Z`} fill="#d9c8a1"/><text x={w/2} y="-78" textAnchor="middle" fill="#53503f" stroke="none" fontSize="17" fontFamily="serif" letterSpacing="5">{sign}</text></g>}
    {awning && <g><path d={`M-30-74H${w+15}l-20 30H-50Z`} fill="#c2af81"/><path d={`M-50-44H${w-5}v8H-50ZM-45-36V30m${w+30}-66v66`} fill="none" strokeWidth="3"/>{Array.from({length:8},(_,i)=><path key={i} d={`M${-25+i*w/8}-73-20 30`} strokeWidth=".8"/>)}</g>}
  </g>;
}

function Willow({ x, y, scale = 1, active = false }: { x: number; y: number; scale?: number; active?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} className={active ? 'willow active' : 'willow'}>
    <path d="M0 8q22-73 3-163-4-39 9-93L4-183q-19-25-49-37m53 67 51-62M1-157l-15-62" fill="none" stroke="#7c7758" strokeWidth="9"/>
    <path d="M1 8q15-77 0-161 0-35 10-71" fill="none" stroke="#b1a37b" strokeWidth="3"/>
    <g className="willow-crown" fill="none" strokeLinecap="round">
      {Array.from({ length: 24 }, (_, i) => {
        const startX = Math.sin(i*8.7)*72, startY=-210+Math.cos(i*1.7)*26;
        const endX=startX+Math.sin(i*3.9)*75;
        return <g key={i}><path d={`M${startX} ${startY}Q${endX*1.2} -220 ${endX} ${-75+Math.sin(i)*40}`} stroke="#788566" strokeWidth="1.1"/>{Array.from({length:8},(_,j)=><path key={j} d={`M${startX+(endX-startX)*(j/8)} ${startY+(130*j/8)}q-14 1-10 14 10-2 10-14`} fill={j%3===0?'#a4a377':'#929a71'} stroke="none" opacity=".78"/>)}</g>;
      })}
    </g>
    <path d="m-18 12 20-9 20 7m-34 1-17 3" fill="none" stroke="#9a9474"/>
  </g>;
}

export function Boat({ x, y, scale = 1, cargo = false, moored = false }: { x: number; y: number; scale?: number; cargo?: boolean; moored?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><g className={moored ? 'moored-boat' : 'floating-boat'} stroke="#666b59" strokeWidth="1.25" strokeLinejoin="round">
    <path d="M-127 14q139 33 267-18" fill="none" opacity=".3"/>
    <path d="M-115-13Q0 14 133-33l-23 39Q-2 44-102 10Z" fill="#9b8d64"/>
    <path d="M-115-13Q-3 8 133-33M-102 10Q0 36 110 6M-108-5Q0 19 124-24" fill="none"/>
    <path d="m-88-20 172-17 19 24-177 16Z" fill="#b9aa80"/>
    {Array.from({length:12},(_,i)=><path key={i} d={`M${-75+i*14}-21l-7 23`} fill="none" opacity=".6"/>)}
    <path d="M-47-21v-62q45-30 91-9l20 59Z" fill="#a5a07a"/>
    <path d="M-47-83Q-35-117-6-119L28-124q29 0 36 91L44-92Q2-110-47-83Z" fill="#c5b996"/>
    {Array.from({length:9},(_,i)=><path key={i} d={`M${-43+i*10}-${85+i*1.6}q15-15 22-10l16 67`} fill="none" opacity=".6"/>)}
    <path d="M74-25 57-217m-17 7 38-3M54-205q-29 52-23 139L-41-53q32-69 74-144Z" fill="#d2c6a6"/>
    <path d="m34-190 2 120M21-165 7-67M9-135-16-62m-4-21 52-9m-38-28 39-13m-22-27 21-12M57-217 119-34M57-217-88-19" fill="none" opacity=".6"/>
    {cargo && <g fill="#9e9e73"><path d="m-89-38 26-5 8 27-29 4Zm106-1 27-4 8 25-29 4Z"/><path d="m-84-36 7 23m-6-12 26-4m75-7 8 22m-7-11 25-4" fill="none"/></g>}
    <Person x={92} y={-27} scale={.7} color="#6c7a74" pose={1} hat/>
  </g></g>;
}

function Bridge() {
  return <g stroke="#746f54" strokeLinejoin="round">
    <path d="M1190 725Q1550 240 2050 500l42 54Q1540 296 1225 775Z" fill="#8a8060" strokeWidth="2"/>
    <path d="M1190 684Q1550 210 2050 460l42 42Q1550 245 1225 733Z" fill="#bca779" strokeWidth="2"/>
    <path d="M1225 733Q1550 245 2092 502l0 52Q1540 296 1225 775Z" fill="#a4946c"/>
    {Array.from({length:44},(_,i)=>{const t=i/43; const x=1225+867*t;const y=733-1010*t+779*t*t;return <path key={i} d={`M${x-29} ${y-40}l30 40m-23-37 30 40`} fill="none" strokeWidth="1" opacity=".7"/>;})}
    {Array.from({length:20},(_,i)=>{const t=i/19;const x=1225+867*t; const y=733-1010*t+779*t*t;return <g key={i}><path d={`M${x} ${y+36}v-86m-33 74 65-42m-67 13 66 23`} fill="none" strokeWidth="4"/><path d={`M${x-4} ${y-52}h8v-4h-8Z`} fill="#c4b38e"/></g>;})}
    <path d="M1225 684Q1550 200 2090 454M1225 697Q1550 213 2090 467M1190 641Q1550 167 2050 417M1190 654Q1550 180 2050 430" fill="none" strokeWidth="5"/>
    {Array.from({length:18},(_,i)=>{const t=i/17; return <path key={i} d={`M${1190+860*t} ${684-1030*t+806*t*t}v-53`} strokeWidth="3"/>;})}
    <path d="M1280 718 1420 525l68 7m-89 49 170-119m-100 46 189-57m-63 7 161 33m-66-16 160 78m-75-66 186 77" fill="none" strokeWidth="6" opacity=".85"/>
    <path d="M1225 777Q1550 300 2092 556" fill="none" strokeWidth="4"/>
    {Array.from({length:14},(_,i)=>{const t=(i+1)/16;const x=1230+830*t;const y=725-1010*t+779*t*t;return <Person key={i} x={x} y={y-19} scale={.58+(i%3)*.03} color={['#8c7057','#717f75','#aca580','#827a82'][i%4]} flip={i%3===0} pose={i%5===0?2:0} hat={i%4===0}/>;})}
    <g transform="translate(1445 327)"><path d="M0 0v-54h35m-35 11h35m0-14v78" fill="none" strokeWidth="3"/><path d="M30 14q6 8 12 0v12H30Z" fill="#928261"/><path d="M36 25v18"/></g>
  </g>;
}

export function Landscape({ state, feedback }: { state: GameState; feedback: string }) {
  const paperDone = state.progress.quests.paper.step > 0;
  const boatDone = state.progress.quests.boat.step === 3;
  const delivered = state.progress.route === 'deliver';
  return <svg id="world-art" viewBox="0 0 3600 1000" xmlns="http://www.w3.org/2000/svg" className="landscape" aria-hidden="true">
    <defs>
      <linearGradient id="land" x2="0" y2="1"><stop stopColor="#e6dfca"/><stop offset="1" stopColor="#d7cfb3"/></linearGradient>
      <linearGradient id="water" x2=".25" y2="1"><stop stopColor="#a7b7a3"/><stop offset=".5" stopColor="#bec5ab"/><stop offset="1" stopColor="#d0ceb0"/></linearGradient>
      <pattern id="roof" width="9" height="7" patternUnits="userSpaceOnUse"><path d="M0 0v7m1-1h7" stroke="#727662" opacity=".3" fill="none" strokeWidth=".6"/></pattern>
      <pattern id="ripples" width="153" height="57" patternUnits="userSpaceOnUse"><path d="M3 12q14-3 29 0m44 19q20-4 45 0m-98 17 28-1" stroke="#748e7e" strokeWidth=".8" fill="none" opacity=".3"/></pattern>
      <pattern id="grain" width="100" height="90" patternUnits="userSpaceOnUse"><circle cx="5" cy="8" r=".6" fill="#807c60" opacity=".15"/><circle cx="53" cy="63" r=".7" fill="#807c60" opacity=".1"/><path d="m29 33 2-1m58-13 1 2m-74 60 2-1" stroke="#fff" opacity=".2"/></pattern>
    </defs>
    <rect width="3600" height="1000" fill="url(#land)"/>
    <g opacity=".22" fill="#b1b79c" stroke="#9ba48c" strokeWidth="1.5"><path d="M0 220q160-125 330-97 200-157 425-52 290-139 516 18 220-107 399 26 232-195 490-90 188-88 392 63 352-142 548 38 345-100 500 38v141H0Z"/><path d="M0 208q150-83 340-48 272-103 463-56 291-92 500 61 420-135 723-55 280-113 541 37 365-72 570 18 300-63 463 16" fill="none"/></g>
    <g opacity=".3"><House x={50} y={302} scale={.7}/><House x={230} y={257} scale={.58}/><House x={440} y={304} scale={.7}/><House x={648} y={249} scale={.6}/><House x={820} y={320} scale={.9}/><House x={1090} y={264} scale={.67}/><House x={2410} y={247} scale={.65}/><House x={2590} y={275} scale={.7}/><House x={2850} y={270} scale={.8}/><House x={3100} y={265} scale={.7}/><House x={3310} y={310} scale={.85}/></g>
    <g opacity=".4" stroke="#898e73" fill="none"><path d="M1040 258h510v-58h-510Zm-30 11h530m-480-49h460m-460 20h460m-380-21v39m80-39v39m80-39v39m80-39v39m80-39v39M1500 260v-98h95v98m-102-100q57-26 110 0m-111-8 49-65 49 65m-83-20 34-49 33 48m-46-38V61m-6 1h38m-19-10v-9"/></g>
    <path d="M0 557Q400 569 727 578T1330 550q450-75 780-13 233 12 460 109 185 15 438-4 359-10 592 74V1000H0Z" fill="url(#water)"/>
    <path d="M0 557Q400 569 727 578T1330 550q450-75 780-13 233 12 460 109 185 15 438-4 359-10 592 74V1000H0Z" fill="url(#ripples)"/>
    <path d="M0 553Q400 565 727 574T1330 546q450-75 780-13 233 12 460 109 185 15 438-4 359-10 592 74" stroke="#898c6f" strokeWidth="3" fill="none"/>
    <path d="M0 530Q400 545 727 550T1330 522q450-75 780-13 233 12 460 109 185 15 438-4 359-10 592 74" stroke="#a19c7c" strokeWidth="1.3" fill="none"/>
    <g opacity=".6" stroke="#969379" strokeWidth="1" fill="none">{Array.from({length:95},(_,i)=>{const x=(i*137)%3600;const y=365+(i*47)%190;return <path key={i} d={`M${x} ${y}l${7+i%15} -1m3 5h5`}/>;})}</g>
    <g><House x={0} y={430} width={220} tone="#9c9b7d"/><House x={295} y={392} scale={.93} width={220} tone="#9b9d83" sign="香药"/><House x={515} y={450} width={245} tone="#9b9d81" sign="何记茶坊" awning/><House x={835} y={438} scale={.85} width={220} tone="#aaa287" sign="炊饼" awning/><House x={1030} y={365} scale={.85} width={190} tone="#a4a78b"/><House x={2190} y={383} scale={.9} width={215} tone="#a4a384" sign="脚店"/><House x={2440} y={404} scale={.86} width={225} tone="#9a9d81"/><House x={2700} y={482} width={250} sign="柳家纸铺" tone="#9a9b7e" awning/><House x={3260} y={470} width={260} tone="#959c85" sign="客舍"/></g>
    <g stroke="#7c7b60" fill="#bcb08a"><path d="M2650 466v130m-8-132h50l-4 93h-46Z"/><text x="2666" y="485" fontSize="18" writingMode="vertical-rl" fill="#575d48" stroke="none" fontFamily="serif">笺纸</text><path d="M3190 438V327m-93 13q85-72 173 0Zm-17 3h209m-177 0v110m153-110v110" strokeWidth="3"/><path d="M3107 455h158m-154-6h148" fill="none"/></g>
    <Willow x={3000} y={539} scale={1.35} active={feedback==='willow'}/><Willow x={3530} y={610} scale={1.25}/><Willow x={170} y={525} scale={1.3}/>
    <g stroke="#89816a" fill="none" strokeWidth="1.8"><path d="M2100 532 2400 568l-4 45-300-36Zm0 14 297 36m-300-22 298 37M2130 538l-3 43m40-39-3 43m40-39-3 43m40-39-3 43m40-39-3 43m40-39-3 43m40-39-3 43m-268-40v82m256-51v82"/><path d="M2130 607q55 49 95 0m-100-23q50 23 98 7"/></g>
    <Bridge/>
    <Boat x={1650} y={777} scale={1.15}/>
    <Boat x={boatDone?2320:2280} y={boatDone?671:719} scale={.95} cargo={!delivered} moored={state.progress.ropes.length===3}/>
    <Boat x={450} y={821} scale={.72} cargo/>
    <Boat x={3290} y={863} scale={.7}/>
    <g stroke="#817a5e" strokeWidth="1.4"><path d="m2070 478 35-6 26 18-35 6Z" fill="#b6a679"/><circle cx="2098" cy="488" r="23" fill="#bab18a"/><circle cx="2098" cy="488" r="3" fill="#665f48"/>{Array.from({length:8},(_,i)=><path key={i} d={`M2098 488l${Math.cos(i*Math.PI/4)*22} ${Math.sin(i*Math.PI/4)*22}`} fill="none"/>)}<path d="m2070 463 61 5 31-27m-92 22v-42l64 5v42" fill="#b3a47d"/><path d="M2080 421v43m12-42v42m12-41v42m12-41v42m11-40v39"/></g>
    <g stroke="#827959" strokeWidth="1.4"><path d="M2722 534h165v12h-165Zm6 12-3 40m150-40 3 40" fill="#af9973"/><g className={!paperDone?'flutter-paper':''}><path d="m2740 516 106 2 17 18-118-3Z" fill="#e9dfc5"/><path d="m2752 519 38 3m-33 5 56 2m-9-6 22 0" fill="none" strokeWidth=".7"/></g>{paperDone&&<path d="m2750 523 16 0 2 8-18-1Z" fill="#6f7666"/>}<path d="m2732 513-3 25m142-32 3 33" fill="none"/><path d="m2726 510 12 0m126-6h12"/></g>
    <g stroke="#837958" strokeWidth="1.3" fill="#b4a17a"><path d="M570 497h140v10H570Zm10 10v35m118-35v35M780 476h85v8h-85Zm6 8v25m73-25v25"/><path d="M585 489q0-15 16-15t16 15Zm1 0v9h31v-9m-11-18v-6h-8v7" fill="#7e7d60"/><path d="M612 482q17-5 12 9h-8" fill="none"/>{[637,662,687,805,837].map((x,i)=><g key={x}><path d={`M${x} ${i<3?489:470}q7 11 14 0Z`} fill="#d8c9a5"/><path d={`M${x-1} ${i<3?498:479}h17`} fill="none"/></g>)}<g className={feedback==='brazier'?'steam active':'steam'} fill="none" opacity=".5"><path d="M599 471q-9-9 0-20t0-20m8 34q9-11 0-22" stroke="#f8f1db" strokeWidth="3"/></g></g>
    {delivered&&<g stroke="#797b59" fill="#9b9c70"><path d="m729 470 43 4-4 39-42-4Zm-2 17 43 5m-23-20-4 39"/><text x="748" y="500" fontSize="15" stroke="none" fill="#50563d">茶</text></g>}
    <g stroke="#8a8062" fill="#b4a883" strokeWidth="1.2">{[0,1,2].map(i=><g key={i} transform={`translate(${2430+i*42} ${501+i*8})`}><ellipse rx="19" ry="8"/><path d="M-19 0v31q19 14 38 0V0m-32-6v39m8-40v40m8-40v40m8-39v37"/><ellipse cy="31" rx="19" ry="8" fill="none"/></g>)}</g>
    <g className={feedback==='cat'?'cat active':'cat'} transform="translate(451 546)" fill="#9d9273" stroke="#5c604d" strokeWidth="1.2"><path d="M-18-4q7-16 19-5l10-4 6-10 3 11 8 4-1 13q-9 4-13-3-10 9-26 3-13-4-17 2-1 6 10 3"/><path d="m18-11 5-1m-1 6h6"/></g>
    <g fill="#777b60" className={feedback==='sparrow'?'sparrows active':'sparrows'}><path d="M1567 375q-12-17-21-11 5 10 15 11l-14 6 15-2q7 9 14 1l6-2-8-2Z"/><path d="M1602 371q-5-12-13-10 0 8 7 11l-10 6 11-3q8 8 12 0l6-2-8-2Z"/></g>
    {Object.entries({liu:{x:2790,y:561,color:'#7a866f',pose:paperDone?1:0},zhou:{x:2260,y:655,color:'#657f7a',pose:boatDone?1:0},cheng:{x:delivered?905:2120,y:delivered?511:478,color:'#ab805b',pose:boatDone?2:0},he:{x:685,y:492,color:'#a06b54',pose:state.progress.tea?1:0},chen:{x:1050,y:535,color:'#82828b',pose:state.claimed.includes('purse')?1:0},shen:{x:3190,y:498,color:'#78816e',pose:state.progress.favorite?1:0}}).map(([id,p])=><Person key={id} {...p} scale={1.05} hat={id==='zhou'}/>)}
    {Array.from({length:32},(_,i)=>{const x=90+(i*317)%3400;const y=435+(i*29)%116; if((x>1200&&x<2080)||(x>2700&&x<2950))return null;return <g key={i} className={`passer passer-${i%8}`} style={{animationDelay:`-${i*2}s`}}><Person x={x} y={y} color={['#7a8574','#9b7b65','#a5a17e','#758389','#93867d','#b4a182'][i%6]} scale={.65+(i%3)*.07} pose={i%7===0?2:0} flip={i%2===0} hat={i%5===0}/></g>;})}
    {state.progress.tea&&<g><Person x={809} y={521} scale={.65} color="#6f7b72" pose={1}/><Person x={850} y={533} scale={.65} color="#a17c66" pose={1}/></g>}
    <g stroke="#a19875" strokeWidth="1.2" fill="none">{Array.from({length:18},(_,i)=><path key={i} d={`M${40+i*204} ${540+Math.sin(i)*20}q-4-15 2-22m-2 16-8-10m8 4 6-10`}/>)}</g>
    <g opacity=".7" fill="#b3b28d"><path d="M0 924q210-78 360-20 224-34 345 56l156 40H0Z"/><path d="M2910 1000q160-103 290-65 210-32 400-18v83Z"/></g>
    <Willow x={210} y={1001} scale={1.5}/><Willow x={3530} y={1006} scale={1.1}/>
    <g fill="none" stroke="#737e65" opacity=".55">{[75,300,555,3090,3340,3470].map(x=><g key={x}><path d={`M${x} 990q-8-53 5-88m-5 74-18-37m16 29 20-39m-17 46 24-16`}/><path d={`M${x-15} 951q-7-14-14-17m38 5 12-13`}/></g>)}</g>
    <rect width="3600" height="1000" fill="url(#grain)" pointerEvents="none"/>
  </svg>;
}

export function JournalArt({ kind, color = '#7b8069' }: { kind: string; color?: string }) {
  const style: CSSProperties = { color };
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" className="journal-art" style={style} aria-hidden="true">
    <path d="M0 163Q120 126 320 154v46H0Z" fill="currentColor" opacity=".08"/>
    <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round">
      {kind === 'willow' ? <g><path d="M101 183q24-68 9-137m0 57-28-44m30 19 41-28" strokeWidth="5"/>{Array.from({length:15},(_,i)=><path key={i} d={`M${78+i*6} ${52+Math.sin(i)*10}q${40+i*3}-45 ${32+i*6} ${64+i%3*13}`} opacity=".6"/>)}<path d="M170 156q30-6 60 0m-65 11 39 0"/></g> :
      ['boat','landscape'].includes(kind) ? <g><path d="M49 143q100 29 223-12l-20 27q-113 26-193 1Zm91-8-2-109m-7 10q-50 38-56 83l60-9Zm8 2 53 66-50 5Z" fill="currentColor" fillOpacity=".12"/><path d="M48 170q89 20 213-4m-111 18 50-2m-121-61 49-8m-31-12 31-9m-17-10 19-7"/>{kind==='landscape'&&<path d="M12 124Q94 8 173 60t132 19m-290 58Q95 24 171 73t132 20" opacity=".4"/>}</g> :
      kind === 'bridge' || kind === 'bridge-crowd' ? <g><path d="M20 160Q147-10 300 148v15Q144 15 20 174Z" fill="currentColor" fillOpacity=".12"/><path d="M20 142Q147-28 300 130M20 132Q147-38 300 120"/>{Array.from({length:15},(_,i)=><path key={i} d={`M${20+i*20} ${132-138*(i/14)+126*(i/14)**2}v30`}/>)}<path d="M65 176h65m37 4h42m-65-19 47-2"/>{kind==='bridge-crowd'&&[0,1,2,3,4].map(i=><g key={i} transform={`translate(${74+i*38} ${108-Math.sin(i*.75)*36})`}><circle cy="-29" r="4" fill="currentColor" fillOpacity=".25"/><path d="M-3-24-8-6h15L3-24ZM-4-6l-3 10m10-10 3 10m-10-23-6 8m13-8 5 9"/></g>)}</g> :
      kind === 'purse' ? <g><path d="M122 49q-9-39 18-19l20 26q20-49 35-31t-23 34m-54 5q48 9 72-3l22 88q-46 38-103 1Zm11 8q30 7 49-1"/><path d="m132 93 19 29 23-30m-21 29-1 18m-6-32-14-2m29 1 15-3m-18 28 12-7m-19-12-12 5m-7 48-2 24m43-22 4 21"/><path d="M109 150q56 31 103-1" fill="currentColor" fillOpacity=".1"/></g> :
      kind === 'rope' ? <g><path d="M32 65q100 79 137 7t104 30M34 70q100 79 137 7t104 30" strokeWidth="3"/><path d="M140 143c-70-83 99-99 39-7-57 67-121-43-49-34 63 6 55 59 19 51m-3-2-27 29m48-39 22 39"/></g> :
      kind === 'tea' || kind === 'market' ? <g><path d="M51 123q24 65 82 0Zm4 1h76m-87 37h99m32-46q26 76 90 0Zm-3-1h95m-101 50h105m-65-54q32-14 40 9m-81-53q-11-13 0-26t0-22m59 47q-11-13 0-26t0-22M83 104q-11-13 0-26t0-22"/><path d="M126 174q28-40 57 0Z" fill="currentColor" fillOpacity=".15"/>{kind==='market'&&<path d="M40 70V30h239v40M50 30l20-15h199l10 15M68 67v31m193-31v31"/>}</g> :
      kind === 'cargo' ? <g><path d="m62 79 66-28 111 32-66 28Zm0 0v74l111 32 66-28V83M173 111v74m-108-14 64-27 106 29m-139-83v71m32-61v69m74-93v70m-46-45v70" fill="currentColor" fillOpacity=".08"/><path d="m147 53-10-20 25-9 9 27m-33-17 25-8"/></g> :
      kind === 'hands' ? <g><path d="m47 120 180-31 46 56-174 33Z" fill="currentColor" fillOpacity=".07"/><path d="m63 34 17 55 56 15 24 19-6 7-30-13-33-3-32-19-24-54m182-6-19 56-21 16-13 19 7 5 20-17 32-13 21-57m-111 85 23 6m-84 18 28-2m47-17 40-5"/></g> :
      <g><path d="m75 169 139-142 11 11L86 180ZM79 163q-30-4-20 11 4 9-9 15 37 7 36-12m-6-16 9 9" fill="currentColor" fillOpacity=".16"/><path d="m111 66 39-9 62 79-40 10Zm6 4 30-6m-22 16 27-6m-19 16 22-6m-7 21 12-4m-19 10 27-6m-30 14 35-7"/></g>}
    </g>
  </svg>;
}
