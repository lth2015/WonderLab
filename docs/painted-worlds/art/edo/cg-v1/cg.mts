// 物語の画 (event pictures): one painting behind the words at a story's quiet peak
// (content/types.ts DialogueNode.cg). Portrait, for phones. TokenStars gpt-image-2,
// same INK wording as ../kashi-v1/kashi.mts; the 一服 picture is ../ippuku-v1.
//   tsx cg.mts <outdir> <id> [n]      id: inkyo | ame | kashi | yube
import { writeFile } from 'node:fs/promises';
import { configFromEnv, generateImage } from '/home/user/wonderlab/server/src/tokenstars.ts';

const INK = [
  'Hand-painted Japanese emaki handscroll from about 1805, in the manner of a detailed Edo-period street scroll:',
  'fine sumi ink outlines with delicate pale watercolour washes (light indigo, persimmon, ochre, soft green, grey)',
  'on warm pale paper. Clear readable detail. Strictly no text of any kind: no writing on curtains, signboards, umbrellas or lanterns.',
  'No modern objects. Not anime, not 3D render, not photograph. Vertical composition.',
].join(' ');

const CG: Record<string, string> = {
  // 河岸の朝: behind the barrels, 亀吉 watching the cargo come off the big boat (matches kame-*: brown tucked-up kimono)
  kashi: [
    INK,
    'Morning at an Edo riverside quay: a large flat wooden cargo boat moored against a high stone embankment, porters passing round bamboo baskets and straw-wrapped bales from the boat up to the stone bank, one after another.',
    'In the near foreground, stacked wooden barrels and a coil of rope; crouching behind the barrels, seen FROM BEHIND, a small Edo boy about eight years old,',
    'short hair with a small topknot, a short brown patterned kimono tucked up at the knees, bare legs, peeking eagerly over the barrels at the unloading.',
    'Low tiled quay sheds behind, the river beyond, soft morning light, gulls. The boy small in the lower part of the picture.',
  ].join(' '),
  // 夕暮れの灯: from the tea-house bench, the lamps the player lit, one after another down the street to the bridge
  yube: [
    INK,
    'Dusk on an Edo street seen from a tea-house bench: in the near foreground the edge of a red-felt bench with a plain teacup with a thin wisp of steam.',
    'The street of wooden shops with tiled roofs runs away into the distance towards a wooden arched bridge; along it, standing paper lamps (andon on posts) glow warm orange, one after another, the farthest on the bridge.',
    'A deep warm sunset sky turning to soft indigo, the first star; the lamplight pooling on the street. Plain lamps, no writing. Quiet, tender. No people in the foreground; one or two tiny far-off figures.',
  ].join(' '),
  // ご隠居の散歩: the riverside bench his late wife loved (matches crowd2-elder: sage-green haori, brown striped kimono)
  inkyo: [
    INK,
    'At the quiet edge of an Edo town, a wide calm river under a soft spring sky; a great old willow leans over the water, its long branches touching the surface.',
    'Under the willow, an old weathered wooden bench (engi) on the grassy bank.',
    'Beside the empty bench an elderly retired man in his seventies seen FROM BEHIND, STANDING upright on the grass (not sitting), slightly stooped, white hair in a small topknot,',
    'a muted sage-green haori with a small pale flower pattern over a brown pinstriped kimono, standing with both hands resting on top of a plain wooden walking stick planted in front of him, looking at the river.',
    'He is small in the picture, in the lower middle; much empty space of water and sky. Still, tender, unhurried. A few reeds; distant low roofs across the river.',
  ].join(' '),
  // 雨宿り: from under the tea-house eaves, the people walking off with the lent umbrellas
  ame: [
    INK,
    'Seen from under the deep eaves of an Edo tea house on a rainy spring day: in the near foreground the eave edge with rain dripping in fine lines, a plain wooden bench and a hanging plain noren.',
    'Beyond, the wet street of wooden shops with tiled roofs, puddles reflecting soft grey light, fine slanting rain.',
    'Three small figures walking away into the rain, each HOLDING an open Japanese oiled-paper umbrella (wagasa/bangasa: a round canopy of pale yellow-brown oiled paper on many thin bamboo ribs, held up on a long bamboo handle above the head), bareheaded under it, no straw hats: a samurai, a fishmonger with a basket, a young shop apprentice with a bundle.',
    'Quiet, gentle, cool grey-blue light with warm wood tones. The figures small in the middle distance.',
  ].join(' '),
};

const cfg = configFromEnv();
const [out, id, n = '2'] = process.argv.slice(2);
if (!out || !CG[id]) throw new Error('usage: tsx cg.mts <outdir> <inkyo|ame|kashi|yube> [n]');
await Promise.all(
  Array.from({ length: +n }, async (_, i) => {
    try {
      await writeFile(`${out}/${id}-${i}.png`, await generateImage(cfg, { prompt: CG[id], size: '1024x1536', quality: 'high' }));
      console.log('ok', id, i);
    } catch (e) {
      console.log('FAIL', id, i, (e as Error).message);
    }
  }),
);
