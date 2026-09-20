/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSupabaseClient } from './client';
import { generateSlug, validateSlug } from '../utils/slug';
import { isValidHexColor } from '../utils/palette';

export interface ShareableWheelConfig {
  id: string;
  names: string[];
  teamName?: string;
  slug: string;
  inputMethod?: 'custom' | 'random' | 'numbers';
  accentColor?: string | null;
  createdAt: string;
}

// accent_color migration not applied yet: Postgres says 42703 for a SELECT of an unknown
// column, PostgREST says PGRST204 for an unknown column in an INSERT body.
const isMissingColumnError = (error: { code?: string } | null | undefined): boolean =>
  !!error && (error.code === '42703' || error.code === 'PGRST204');

/**
 * Creates a shareable wheel configuration in the database
 */
export async function createShareableConfig(
  sessionId: string,
  names: string[],
  teamName?: string,
  inputMethod?: 'custom' | 'random' | 'numbers',
  accentColor?: string | null
): Promise<ShareableWheelConfig | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not available');
    return null;
  }

  try {
    // Generate unique slug
    const slug = generateSlug(teamName);

    // Insert configuration with slug
    const payload: Record<string, unknown> = {
      session_id: sessionId,
      names,
      segment_count: names.length,
      team_name: teamName,
      slug,
      is_public: true,
      input_method: inputMethod,
    };
    if (isValidHexColor(accentColor)) payload.accent_color = accentColor;

    // Cast to any to bypass TypeScript strict type checking
    // Runtime safety preserved via null check above
    const client: any = supabase;
    let { data, error } = await client
      .from('wheel_configurations')
      .insert(payload)
      .select()
      .single();

    // Migration not applied yet: share the wheel without its colour rather than fail
    if (isMissingColumnError(error) && 'accent_color' in payload) {
      delete payload.accent_color;
      ({ data, error } = await client
        .from('wheel_configurations')
        .insert(payload)
        .select()
        .single());
    }

    if (error) {
      console.error('Error creating shareable config:', error);
      return null;
    }

    if (!data) {
      console.error('No data returned from insert');
      return null;
    }

    return {
      id: data.id,
      names: data.names,
      teamName: data.team_name,
      slug: data.slug,
      inputMethod: data.input_method,
      accentColor: isValidHexColor(data.accent_color) ? data.accent_color : null,
      createdAt: data.created_at,
    };
  } catch (err) {
    console.error('Failed to create shareable config:', err);
    return null;
  }
}

/**
 * Retrieves a wheel configuration by its slug
 */
export async function getConfigBySlug(
  slug: string
): Promise<ShareableWheelConfig | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not available');
    return null;
  }

  try {
    // Cast to any to bypass TypeScript strict type checking
    // Runtime safety preserved via null check above
    const client: any = supabase;
    const baseColumns = 'id, names, team_name, slug, input_method, created_at';
    let { data, error } = await client
      .from('wheel_configurations')
      .select(`${baseColumns}, accent_color`)
      .eq('slug', slug)
      .eq('is_public', true)
      .single();

    // Migration not applied yet: read the wheel without its colour
    if (isMissingColumnError(error)) {
      ({ data, error } = await client
        .from('wheel_configurations')
        .select(baseColumns)
        .eq('slug', slug)
        .eq('is_public', true)
        .single());
    }

    if (error || !data) {
      // PGRST116 = no rows matched. That's an ordinary 404, not an error worth logging.
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching config for slug:', slug, error);
      }
      return null;
    }

    return {
      id: data.id,
      names: data.names,
      teamName: data.team_name || undefined,
      slug: data.slug || slug,
      inputMethod: data.input_method,
      accentColor: isValidHexColor(data.accent_color) ? data.accent_color : null,
      createdAt: data.created_at,
    };
  } catch (err) {
    console.error('Failed to fetch config by slug:', err);
    return null;
  }
}

/**
 * Lists the most recently created public wheels (for the sitemap)
 */
export async function getRecentPublicSlugs(
  limit: number = 500
): Promise<{ slug: string; createdAt: string }[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const client: any = supabase;
    const { data, error } = await client
      .from('wheel_configurations')
      .select('slug, created_at')
      .eq('is_public', true)
      .not('slug', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      if (error) console.error('Error listing public wheels:', error);
      return [];
    }

    return (data as { slug: string; created_at: string }[])
      .filter((row) => validateSlug(row.slug))
      .map((row) => ({ slug: row.slug, createdAt: row.created_at }));
  } catch (err) {
    console.error('Failed to list public wheels:', err);
    return [];
  }
}

/**
 * Checks if a slug already exists (for collision detection)
 */
export async function slugExists(slug: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    // Cast to any to bypass TypeScript strict type checking
    // Runtime safety preserved via null check above
    const client: any = supabase;
    const { data, error } = await client
      .from('wheel_configurations')
      .select('slug')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('Error checking slug existence:', error);
      return false;
    }

    return data !== null;
  } catch (err) {
    console.error('Failed to check slug:', err);
    return false;
  }
}

/**
 * Updates an existing configuration to make it shareable
 */
export async function makeConfigShareable(
  configId: string,
  teamName?: string
): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const slug = generateSlug(teamName);

    const payload = {
      slug,
      is_public: true,
      team_name: teamName,
    };

    // Cast to any to bypass TypeScript strict type checking
    // Runtime safety preserved via null check above
    const client: any = supabase;
    const { data, error } = await client
      .from('wheel_configurations')
      .update(payload)
      .eq('id', configId)
      .select('slug')
      .single();

    if (error) {
      console.error('Error making config shareable:', error);
      return null;
    }

    if (!data) {
      console.error('No data returned from update');
      return null;
    }

    return data.slug || slug;
  } catch (err) {
    console.error('Failed to make config shareable:', err);
    return null;
  }
}
