import type { HotspotDef, Rect } from '../contract';

/** Spec §7: a move beyond 8 CSS px is a drag and cancels the tap. */
export const DRAG_THRESHOLD_PX = 8;
/** Spec §7: every target answers on at least 44×44 CSS px. */
export const MIN_TARGET_PX = 44;

export function isDrag(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > DRAG_THRESHOLD_PX;
}

/** The area a hotspot answers on at this scale (CSS px per scene unit). */
export function effectiveArea(r: Rect, scale: number): Rect {
  const min = MIN_TARGET_PX / scale;
  const w = Math.max(r.w, min);
  const h = Math.max(r.h, min);
  return { x: r.x - (w - r.w) / 2, y: r.y - (h - r.h) / 2, w, h };
}

const inside = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/**
 * What a tap at scene (x, y) means: nothing, one hotspot, or — when the
 * highest priorities tie — up to three candidates to choose from. The order
 * is stable (priority, then id), so the same tap always opens the same thing.
 */
export function resolveTap(spots: HotspotDef[], x: number, y: number, scale: number): HotspotDef[] {
  const hits = spots
    .filter((s) => inside(effectiveArea(s.hitArea, scale), x, y))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  if (hits.length === 0) return [];
  const top = hits.filter((h) => h.priority === hits[0].priority);
  return top.length === 1 ? [top[0]] : top.slice(0, 3);
}

export function clampCamera(x: number, viewWidthUnits: number, sceneWidth: number): number {
  return Math.min(Math.max(0, x), Math.max(0, sceneWidth - viewWidthUnits));
}
