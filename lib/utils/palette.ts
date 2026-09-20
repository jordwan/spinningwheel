/**
 * Colour helpers shared by the canvas wheel, the setup card and the OG image.
 *
 * A user picks ONE accent colour; we turn it into a palette of segment colours
 * that stay clearly "that colour" (analogous hues) while adjacent slices still
 * differ in hue and lightness so the wheel stays readable.
 */

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  if (!m) return { h: 210, s: 75, l: 50 };
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** The hex we store for a hue picked on the ring (fixed, vivid saturation/lightness) */
export function accentHexFromHue(hue: number): string {
  return hslToHex(hue, 78, 52);
}

/**
 * Build `count` segment colours around an accent colour.
 * Hues fan out ±35° around the accent; lightness alternates so neighbours never merge.
 */
export function generatePaletteFromColor(accentHex: string, count: number): string[] {
  const { h, s } = hexToHsl(accentHex);
  const n = Math.max(2, count);
  const spread = Math.min(n, 12); // distinct hues per cycle
  const sat = clamp(s || 75, 60, 85);
  const colors: string[] = [];

  for (let i = 0; i < n; i++) {
    const t = spread === 1 ? 0.5 : (i % spread) / (spread - 1); // 0..1 across the fan
    const hue = h + (t - 0.5) * 70;
    const cycle = Math.floor(i / spread);
    const light = (i % 2 === 0 ? 46 : 60) + (cycle % 2 === 1 ? 8 : 0);
    colors.push(hslToHex(hue, sat, clamp(light, 32, 74)));
  }
  return colors;
}
