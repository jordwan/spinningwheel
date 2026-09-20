"use client";

import { useCallback, useRef } from "react";
import { accentHexFromHue } from "../../lib/utils/palette";

interface HuePickerProps {
  /** 0..360 */
  hue: number;
  onChange: (hue: number) => void;
  /** Called on any pointer/keyboard interaction, so the parent can switch from Auto to custom */
  onActivate?: () => void;
  active?: boolean;
  size?: number;
}

/**
 * A small conic-gradient colour ring. Tap or drag around it to pick a hue;
 * arrow keys work too. The centre shows the resulting accent colour.
 */
export default function HuePicker({
  hue,
  onChange,
  onActivate,
  active = true,
  size = 56,
}: HuePickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const hueFromEvent = useCallback((clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    // conic-gradient starts at 12 o'clock and runs clockwise
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    return Math.round((deg + 360) % 360);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragging.current = true;
    ref.current?.setPointerCapture(e.pointerId);
    ref.current?.focus();
    onActivate?.();
    const h = hueFromEvent(e.clientX, e.clientY);
    if (h !== null) onChange(h);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const h = hueFromEvent(e.clientX, e.clientY);
    if (h !== null) onChange(h);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    try {
      ref.current?.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let delta = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") delta = 5;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") delta = -5;
    if (e.key === "PageUp") delta = 30;
    if (e.key === "PageDown") delta = -30;
    if (delta === 0) return;
    e.preventDefault();
    onActivate?.();
    onChange((hue + delta + 360) % 360);
  };

  const ring = Math.max(6, Math.round(size * 0.2));
  const markerR = size / 2 - ring / 2;
  const angle = ((hue - 90) * Math.PI) / 180;
  const markerX = size / 2 + markerR * Math.cos(angle);
  const markerY = size / 2 + markerR * Math.sin(angle);
  const accent = accentHexFromHue(hue);

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Wheel colour"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={hue}
      aria-valuetext={`Hue ${hue} degrees`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className={`relative rounded-full cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-opacity ${
        active ? "opacity-100" : "opacity-60 hover:opacity-100"
      }`}
      style={{
        width: size,
        height: size,
        touchAction: "none",
        background:
          "conic-gradient(from 0deg, hsl(0 85% 55%), hsl(60 85% 55%), hsl(120 85% 50%), hsl(180 85% 50%), hsl(240 85% 58%), hsl(300 85% 58%), hsl(360 85% 55%))",
        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
      }}
      title="Pick a wheel colour"
    >
      {/* centre swatch shows the chosen accent */}
      <div
        className="absolute rounded-full border-2 border-white"
        style={{
          inset: ring,
          background: active ? accent : "#ffffff",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
      {/* marker on the ring */}
      <div
        className="absolute rounded-full border-2 border-white pointer-events-none"
        style={{
          width: ring + 4,
          height: ring + 4,
          left: markerX - (ring + 4) / 2,
          top: markerY - (ring + 4) / 2,
          background: accent,
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          opacity: active ? 1 : 0,
        }}
      />
    </div>
  );
}
