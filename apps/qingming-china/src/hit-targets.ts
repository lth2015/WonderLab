import type { CharacterId } from './content';

export type SceneTarget = { kind: 'person'; id: CharacterId; label: string }
  | { kind: 'environment'; id: string; label: string };
export interface TargetBounds {
  target: SceneTarget;
  left: number; top: number; right: number; bottom: number;
}

// Screen-space bounds include the minimum touch size at the current zoom.
export function targetsAt(x: number, y: number, bounds: TargetBounds[]): SceneTarget[] {
  const distance = (b: TargetBounds) => (x - (b.left + b.right) / 2) ** 2 + (y - (b.top + b.bottom) / 2) ** 2;
  return bounds.filter(b => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom)
    .sort((a, b) => distance(a) - distance(b)).slice(0, 3).map(b => b.target);
}
