// 立ち絵: a painted head-and-shoulders portrait beside what a person says (owner's demo
// feedback 2026-11-04: dialogue like the old RPGs). Painted from each person's street sprite
// (docs/painted-worlds/art/edo/faces-v1). Decorative: the name is already written beside it.

const FACES = import.meta.glob('../assets/faces/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const url = (who: string) => FACES[`../assets/faces/${who}.webp`];
export const faceUrl = url;

export const hasFace = (who: string) => Boolean(url(who));

export function Face({ who }: { who: string }) {
  const src = url(who);
  if (!src) return null;
  return <img key={who} className="face" src={src} alt="" aria-hidden="true" width={320} height={320} decoding="async" />;
}
