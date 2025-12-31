import { getSupabaseClient } from './client';
import { generateSlug } from '../utils/slug';
import { WheelConfiguration } from './types';

export interface ShareableWheelConfig {
  id: string;
  names: string[];
  teamName?: string;
  slug: string;
  inputMethod?: 'custom' | 'random' | 'numbers';
  createdAt: string;
}

/**
 * Creates a shareable wheel configuration in the database
 */
export async function createShareableConfig(
  sessionId: string,
  names: string[],
  teamName?: string,
  inputMethod?: 'custom' | 'random' | 'numbers'
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
    const { data, error } = await supabase
      .from('wheel_configurations')
      .insert({
        session_id: sessionId,
        names,
        segment_count: names.length,
        team_name: teamName,
        slug,
        is_public: true,
        input_method: inputMethod,
      })
      .select()
      .single();

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
    const { data, error } = await supabase
      .from('wheel_configurations')
      .select('id, names, team_name, slug, input_method, created_at')
      .eq('slug', slug)
      .eq('is_public', true)
      .single();

    if (error || !data) {
      console.error('Config not found for slug:', slug, error);
      return null;
    }

    return {
      id: data.id,
      names: data.names,
      teamName: data.team_name || undefined,
      slug: data.slug || slug,
      inputMethod: data.input_method,
      createdAt: data.created_at,
    };
  } catch (err) {
    console.error('Failed to fetch config by slug:', err);
    return null;
  }
}

/**
 * Checks if a slug already exists (for collision detection)
 */
export async function slugExists(slug: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { data, error } = await supabase
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

    const { data, error } = await supabase
      .from('wheel_configurations')
      .update({
        slug,
        is_public: true,
        team_name: teamName,
      })
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
