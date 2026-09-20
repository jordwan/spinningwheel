import { ImageResponse } from 'next/og';
import { WheelCard, OG_SIZE } from '@/lib/og/WheelCard';
import { getConfigBySlug } from '@/lib/supabase/wheel-config';
import { slugToTitle, validateSlug } from '@/lib/utils/slug';

export const alt = 'Shared wheel on iWheeli';
export const size = OG_SIZE;
export const contentType = 'image/png';
// Shared wheels never change once created; cache the card for a day.
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = validateSlug(slug) ? await getConfigBySlug(slug) : null;

  if (!config) {
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

  const title = config.teamName || slugToTitle(slug);
  const count = config.names.length;

  return new ImageResponse(
    (
      <WheelCard
        title={title}
        subtitle={`${count} ${count === 1 ? 'option' : 'options'} on the wheel. Tap to spin!`}
        names={config.names}
        accentColor={config.accentColor ?? null}
      />
    ),
    size
  );
}
