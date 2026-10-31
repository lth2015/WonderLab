import { describe, expect, it } from 'vitest';
import { BRIDGE_WALKERS } from './walkers';

// Independently traced deck boundaries on river-v1.webp (2172×724), not the
// underside of the arch or the front beam. This fixture catches the reported
// placements at (904,420), (1100,510), etc. below the bridge floor.
const deck = [
  [0,294], [100,265], [200,235], [300,207], [400,190], [480,186],
  [560,192], [640,211], [720,239], [800,272], [880,305],
  [880,327], [800,294], [720,261], [640,233], [560,214], [480,208],
  [400,212], [300,229], [200,257], [100,287], [0,316],
];
function onDeck(x: number, y: number) {
  let inside = false;
  for (let i=0,j=deck.length-1;i<deck.length;j=i++) {
    const [ax,ay]=deck[i], [bx,by]=deck[j];
    if ((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
  }
  return inside;
}
describe('painted bridge grounding', () => {
  it.each(BRIDGE_WALKERS)('keeps $id at $x on the visible deck, including both shoes', walker => {
    const ratio=2172/3600;
    for (const shoe of [-walker.height*.2, walker.height*.2]) {
      expect(onDeck((walker.x+shoe)*ratio,walker.y*ratio),
        `${walker.id} feet (${walker.x}, ${walker.y}) must rest on the bridge floor`).toBe(true);
    }
  });
});
