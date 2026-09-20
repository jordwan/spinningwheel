import { MetadataRoute } from 'next';
import { getRecentPublicSlugs } from '@/lib/supabase/wheel-config';

// Rebuild the sitemap at most once an hour so new shared wheels get picked up
// without hitting the database on every crawler request.
export const revalidate = 3600;

const BASE_URL = 'https://iwheeli.com';
const MAX_SHARED_WHEELS = 500;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sharedWheels = await getRecentPublicSlugs(MAX_SHARED_WHEELS);

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    ...sharedWheels.map((wheel) => ({
      url: `${BASE_URL}/${wheel.slug}`,
      lastModified: new Date(wheel.createdAt),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
