/**
 * Shared layout for social preview (Open Graph) images.
 *
 * Rendered by next/og's ImageResponse (Satori), which supports a subset of CSS
 * plus inline SVG. The wheel is drawn as SVG paths so it matches the site's
 * segment style without needing conic gradients (unsupported by Satori).
 */

export const OG_SIZE = { width: 1200, height: 630 };

// Mirrors the "Vibrant" theme in SpinningWheel.tsx
const SEGMENT_COLORS = [
  "#FF6B35", "#E91E63", "#FFD23F", "#06FFA5", "#4ECDC4",
  "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8",
];

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function segmentPath(cx: number, cy: number, r: number, start: number, end: number) {
  const a = polar(cx, cy, r, start);
  const b = polar(cx, cy, r, end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${a.x} ${a.y} A ${r} ${r} 0 ${largeArc} 1 ${b.x} ${b.y} Z`;
}

function WheelGraphic({ segments, size }: { segments: number; size: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;
  const count = Math.max(2, Math.min(segments, 20));
  const slice = (2 * Math.PI) / count;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* outer ring */}
      <circle cx={cx} cy={cy} r={r + 8} fill="rgba(255,255,255,0.18)" />
      {Array.from({ length: count }).map((_, i) => (
        <path
          key={i}
          d={segmentPath(cx, cy, r, i * slice - Math.PI / 2, (i + 1) * slice - Math.PI / 2)}
          fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
          stroke="#ffffff"
          strokeWidth={3}
        />
      ))}
      {/* center cap */}
      <circle cx={cx} cy={cy} r={size * 0.075} fill="#1f1f1f" stroke="#444" strokeWidth={3} />
      {/* pointer on the right, like the app */}
      <path
        d={`M ${cx + r - 6} ${cy} L ${cx + r + 34} ${cy - 18} L ${cx + r + 28} ${cy} L ${cx + r + 34} ${cy + 18} Z`}
        fill="#ff2d2d"
        stroke="#ffffff"
        strokeWidth={3}
      />
    </svg>
  );
}

interface WheelCardProps {
  title: string;
  subtitle: string;
  names?: string[];
}

export function WheelCard({ title, subtitle, names = [] }: WheelCardProps) {
  const shownNames = names.slice(0, 8);
  const hiddenCount = names.length - shownNames.length;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        padding: "56px 64px",
        background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 45%, #6d28d9 100%)",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: 48 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 1,
            opacity: 0.9,
          }}
        >
          iWheeli
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: title.length > 24 ? 56 : 72,
            fontWeight: 800,
            lineHeight: 1.05,
            overflow: "hidden",
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 30, opacity: 0.85 }}>
          {subtitle}
        </div>
        {shownNames.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", marginTop: 28, gap: 10 }}>
            {shownNames.map((n, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.16)",
                  border: "2px solid rgba(255,255,255,0.35)",
                  fontSize: 24,
                  fontWeight: 600,
                }}
              >
                {n}
              </div>
            ))}
            {hiddenCount > 0 && (
              <div
                style={{
                  display: "flex",
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontSize: 24,
                  opacity: 0.8,
                }}
              >
                +{hiddenCount} more
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexShrink: 0 }}>
        <WheelGraphic segments={names.length || 8} size={440} />
      </div>
    </div>
  );
}
