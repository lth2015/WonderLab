import { describe, expect, it } from 'vitest';
import { serene } from './palette';
import { Stroke } from './stroke';

const pt = (x: number, y: number, t: number) => ({ x, y, t, pressure: 0.5 });

describe('Stroke predicted points (docs/03 §6.1)', () => {
  it('draws the prediction but keeps only real points', () => {
    const s = new Stroke(serene, 800, false);
    s.add(pt(0, 0, 0));
    s.add(pt(10, 0, 16));
    const drawn = () => s.mesh.geometry.drawRange.count;
    const before = drawn();
    s.setPreview([pt(20, 0, 32), pt(30, 0, 48)]);
    expect(drawn()).toBeGreaterThan(before);
    expect(s.points).toHaveLength(2);
    expect(s.length).toBe(10);
  });

  it('drops the prediction when the stroke ends', () => {
    const s = new Stroke(serene, 800, false);
    s.add(pt(0, 0, 0));
    s.add(pt(10, 0, 16));
    s.setPreview([pt(20, 0, 32)]);
    s.finish();
    expect(s.mesh.geometry.drawRange.count).toBe(6);
    s.setPreview([pt(40, 0, 64)]);
    expect(s.mesh.geometry.drawRange.count).toBe(6);
  });
});
