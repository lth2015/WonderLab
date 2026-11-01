import { useEffect, useRef, useState } from 'react';

type MillCanvas = HTMLCanvasElement & { millFrame?: number };
/** Painted wheel faces and a small, pre-rendered perspective bucket layer. */
export function Waterwheel({ face, buckets, running, reduced, onLoad, onBucketsLoad, onError }: {
  face: string; buckets: string; running: boolean; reduced: boolean; onLoad(): void; onBucketsLoad(): void; onError(): void;
}) {
  const rotor = useRef<SVGGElement>(null), canvas = useRef<MillCanvas>(null), atlas = useRef<HTMLImageElement>();
  const callbacks = useRef({ onBucketsLoad, onError });callbacks.current = { onBucketsLoad, onError };
  const [loaded, setLoaded] = useState(false);
  const [quiet, setQuiet] = useState(() => document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setQuiet(document.hidden || media.matches);
    media.addEventListener('change', change);document.addEventListener('visibilitychange', change);
    return () => { media.removeEventListener('change', change);document.removeEventListener('visibilitychange', change); };
  }, []);
  useEffect(() => {
    let alive = true;
    const image = new Image();image.decoding = 'async';
    image.onload = () => {
      void image.decode().then(() => { if (alive) { atlas.current = image;setLoaded(true);callbacks.current.onBucketsLoad(); } }).catch(() => { if (alive) callbacks.current.onError(); });
    };
    image.onerror = () => { if (alive) callbacks.current.onError(); };
    image.src = buckets;
    return () => { alive = false;image.onload = null;image.onerror = null;atlas.current = undefined; };
  }, [buckets]);
  useEffect(() => {
    const target = canvas.current, image = atlas.current;
    if (!loaded || !target || !image) return;
    const ctx = target.getContext('2d');if (!ctx) { callbacks.current.onError();return; }
    const clock = rotor.current?.getAnimations()[0];
    let animation = 0, previous = -1;
    const draw = () => {
      const time = Number(clock?.currentTime ?? 0);
      const frame = Math.floor((time % 1400) / 1400 * 42);
      if (frame !== previous) {
        ctx.clearRect(0,0,180,284);
        ctx.drawImage(image,(frame%7)*180,Math.floor(frame/7)*284,180,284,0,0,180,284);
        target.millFrame = frame;previous = frame;
      }
      if (running && !reduced && !quiet) animation = requestAnimationFrame(draw);
    };
    draw();return () => cancelAnimationFrame(animation);
  }, [loaded, running, reduced, quiet]);
  return <g className="mill-wheel-body">
    <g transform="translate(624 610) scale(.85 1)" opacity={.35}>
      <g className="mill-rear-rotation"><g transform={`scale(${1/.85} 1)`}>
        <image href={face} x={-140.25} y={-165} width={280.5} height={330}/>
      </g></g>
    </g>
    {/* Twenty repeating buckets share a 1.4s/42-frame cycle. Blit just one small
        frame instead of changing dozens of SVG paths or moving a large atlas. */}
    <foreignObject x={565} y={440} width={225} height={355} className="mill-bucket-stage">
      <canvas ref={canvas} width={180} height={284} style={{width:'100%',height:'100%',display:'block',contain:'strict'}}/>
    </foreignObject>
    <g transform="translate(605 615) scale(.85 1)">
      <g className="mill-rotor" ref={rotor}><g transform={`scale(${1/.85} 1)`}>
        <image href={face} x={-140.25} y={-165} width={280.5} height={330} opacity={.93} onLoad={onLoad} onError={onError}/>
      </g></g>
    </g>
  </g>;
}
