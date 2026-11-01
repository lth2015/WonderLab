import type { CSSProperties } from 'react';

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
