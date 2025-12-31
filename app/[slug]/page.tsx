import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getConfigBySlug } from '@/lib/supabase/wheel-config';
import { slugToTitle } from '@/lib/utils/slug';
import SharedWheelClient from './SharedWheelClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const config = await getConfigBySlug(slug);

  if (!config) {
    return {
      title: 'Wheel Not Found | iWheeli',
    };
  }

  const title = config.teamName || slugToTitle(slug);
  const description = `Spin the wheel: ${config.names.slice(0, 5).join(', ')}${config.names.length > 5 ? '...' : ''}`;

  return {
    title: `${title} | iWheeli – Random Name Picker Wheel`,
    description,
    openGraph: {
      title: `${title} | iWheeli`,
      description,
      url: `https://iwheeli.com/${slug}`,
      siteName: 'iWheeli',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | iWheeli`,
      description,
    },
    alternates: {
      canonical: `https://iwheeli.com/${slug}`,
    },
  };
}

export default async function SharedWheelPage({ params }: PageProps) {
  const { slug } = await params;
  const config = await getConfigBySlug(slug);

  if (!config) {
    notFound();
  }

  return (
    <SharedWheelClient
      names={config.names}
      teamName={config.teamName}
      inputMethod={config.inputMethod}
    />
  );
}
