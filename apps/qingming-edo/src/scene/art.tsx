// The page's ink, paper and wash colours, and vertical text for the title slip.
// (The line-drawn street, people and shops that once lived here were replaced
// by Codex's painted roll; see 素材台帳.md.)
//
// Attributes only, no CSS classes: a journal page is serialised to a PNG,
// where stylesheets do not reach.

export const INK = '#33291f';
export const PAPER = '#efe6d2';
export const WASH = {
  indigo: '#4d6282',
  indigoPale: '#9aa9bf',
  persimmon: '#c47a46',
  ochre: '#c9a45c',
  gold: '#d8b96a',
  green: '#7f9165',
  vermilion: '#b4483a',
  tile: '#77746c',
  wood: '#9b7a57',
  woodDark: '#6e5238',
  plaster: '#e9dfc9',
  skin: '#f0d9bb',
  hair: '#2a2420',
  water: '#8fa7ad',
  dim: '#4a3e33',
};

export const MINCHO = "'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP','Noto Serif CJK JP',serif";

/**
 * Vertical text, one character per line. SVG writing-mode is uneven across
 * browsers and in the saved PNG; stacking glyphs is the same everywhere.
 */
/** Glyphs that turn in vertical writing (縦書き). */
const VERTICAL: Record<string, string> = { 'ー': '｜', '（': '︵', '）': '︶', '「': '﹁', '」': '﹂', '、': '︑', '。': '︒' };

export function VText({ x, y, text, size, fill, gap = 1.18 }: { x: number; y: number; text: string; size: number; fill: string; gap?: number }) {
  return (
    <g>
      {[...text].map((ch, i) => (
        <text key={i} x={x} y={y + size + i * size * gap} fontSize={size} fill={fill} textAnchor="middle" fontFamily={MINCHO}>
          {VERTICAL[ch] ?? ch}
        </text>
      ))}
    </g>
  );
}
