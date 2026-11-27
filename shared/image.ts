// Where an image is cropped from: a focus point (x, y in percent) and a zoom (1 = fit, 3 = close up).
// Used by the server (to keep it clean) and by the site and admin (to show it).
export interface Focus {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_FOCUS: Focus = { x: 50, y: 50, zoom: 1 };

/** Returns a safe focus, or undefined when it is the default (or missing). */
export function cleanFocus(v: unknown): Focus | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const num = (k: string, lo: number, hi: number, d: number) => {
    const n = Number(o[k]);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const f = { x: Math.round(num('x', 0, 100, 50)), y: Math.round(num('y', 0, 100, 50)), zoom: Math.round(num('zoom', 1, 3, 1) * 100) / 100 };
  return f.x === 50 && f.y === 50 && f.zoom === 1 ? undefined : f;
}

/**
 * Inline style that puts the focus point in the middle of the frame, zoomed by `zoom`, for an <img>
 * that uses object-fit: cover. The image is scaled from its centre, then moved so the focus point
 * lands in the middle, and never moved far enough to show an empty edge.
 */
export function focusStyle(f?: Focus | null): { objectPosition: string; transform?: string; transformOrigin?: string } {
  const g = cleanFocus(f) ?? DEFAULT_FOCUS;
  const objectPosition = `${g.x}% ${g.y}%`;
  if (g.zoom <= 1) return { objectPosition };
  const z = g.zoom;
  const lim = z / 2 - 0.5;                       // the furthest the picture can move before an edge shows
  const shift = (v: number) => Math.round(Math.max(-lim, Math.min(lim, -(v / 100 - 0.5) * z)) * 10000) / 100;
  return { objectPosition, transformOrigin: '50% 50%', transform: `translate(${shift(g.x)}%, ${shift(g.y)}%) scale(${z})` };
}
