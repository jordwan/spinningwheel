import { ImageResponse } from 'next/og';
import { WheelCard, OG_SIZE } from '@/lib/og/WheelCard';

export const alt = 'iWheeli – Random Name Picker Wheel';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <WheelCard
        title="Random Name Picker Wheel"
        subtitle="Spin to choose names, teams and winners. Free, no signup."
      />
    ),
    size
  );
}
