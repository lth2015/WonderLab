// 物語の画 (event pictures): one painting in place of the street at a quiet moment —
// a rest at the tea house (一服), and a few story peaks (content/types.ts DialogueNode.cg).
// Tinted for the time of day and the rain; decorative (the words carry the moment).
// Each is fetched only when it is shown.

const CG = import.meta.glob('../assets/cg/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
export const cgUrl = (id: string): string | undefined => CG[`../assets/cg/${id}.webp`];
/** Where each picture's subject sits (vertical), so it stays above the words. */
const FOCUS: Record<string, string> = { ippuku: '72%', inkyo: '88%', ame: '62%' };

export function Cg({ id, tod, rain }: { id: string; tod: 'morning' | 'noon' | 'evening'; rain: boolean }) {
  const src = cgUrl(id);
  if (!src) return null;
  return (
    <div className={`cg tod-${tod}${rain ? ' rain' : ''}`} aria-hidden="true">
      <img key={id} src={src} alt="" decoding="async" style={{ objectPosition: `center ${FOCUS[id] ?? '50%'}` }} />
    </div>
  );
}
