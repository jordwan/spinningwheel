/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSupabaseClient, isSupabaseEnabled } from '../supabase/client';

/**
 * Supabase adapter that handles all database operations with graceful error handling
 * Uses any types to avoid TypeScript build issues - focuses on runtime reliability
 */
export class SupabaseAdapter {
  private client: ReturnType<typeof getSupabaseClient> = null;

  constructor() {
    try {
      if (isSupabaseEnabled()) {
        this.client = getSupabaseClient();
        if (this.client) {
          console.log('📡 Supabase adapter initialized');
        } else {
          console.warn('🚫 Supabase client creation failed - running in local-only mode');
        }
      } else {
        console.log('🚫 Supabase not available - running in local-only mode');
      }
    } catch (error) {
      console.warn('🚨 Supabase adapter construction failed - running in local-only mode:', error);
      this.client = null;
    }
  }

  async insertSession(sessionData: Record<string, unknown>): Promise<void> {
    if (!this.client) {
      console.log('🔇 Supabase not available, skipping session insert');
      return;
    }

    try {
      // TypeScript workaround for Supabase client type complexity
      const client: any = this.client;
      const { error } = await client
        .from('sessions')
        .insert([{
          id: sessionData.id,
          team_name: sessionData.teamName || null,
          input_method: sessionData.inputMethod || null,
          device_type: sessionData.deviceType || null,
          user_agent: typeof navigator !== 'undefined'
            ? navigator.userAgent.substring(0, 500)
            : null,
          ip_address: sessionData.ipAddress || null,
          created_at: sessionData.createdAt,
        }]);

      if (error) {
        console.warn('Failed to insert session (continuing in local mode):', error);
        return; // Don't throw, just log and continue
      }
    } catch (err: unknown) {
      // Log error but don't break the app
      console.warn('Session insert error (continuing in local mode):', err);
      return; // Don't throw, just continue
    }
  }

  async updateSession(sessionId: string, sessionData: Record<string, unknown>): Promise<void> {
    if (!this.client) {
      console.log('🔇 Supabase not available, skipping session update');
      return;
    }

    try {
      const client: any = this.client;
      const { error } = await client
        .from('sessions')
        .update({
          team_name: sessionData.teamName || null,
          input_method: sessionData.inputMethod || null,
          ip_address: sessionData.ipAddress || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) {
        console.warn('Failed to update session (continuing in local mode):', error);
        return; // Don't throw, just log and continue
      }
    } catch (err: unknown) {
      console.warn('Session update error (continuing in local mode):', err);
      return; // Don't throw, just continue
    }
  }

  async insertConfiguration(configData: Record<string, unknown>): Promise<void> {
    if (!this.client) {
      console.log('🔇 Supabase not available, skipping configuration insert');
      return;
    }

    try {
      const client: any = this.client;
      const { error } = await client
        .from('wheel_configurations')
        .insert([{
          id: configData.id,
          session_id: configData.sessionId,
          names: configData.names,
          segment_count: configData.segmentCount,
          created_at: configData.createdAt,
        }]);

      if (error) {
        // Only log actual errors, not constraint violations (which are expected)
        if (error.code !== '23505' && error.code !== '23514') {
          console.warn('Failed to insert configuration (continuing in local mode):', error);
        }
        return; // Don't throw, just log and continue
      }
    } catch (err: unknown) {
      console.warn('Configuration insert error (continuing in local mode):', err);
      return; // Don't throw, just continue
    }
  }

  async insertSpin(spinData: Record<string, unknown>): Promise<void> {
    if (!this.client) {
      console.log('🔇 Supabase not available, skipping spin insert');
      return;
    }

    try {
      const client: any = this.client;
      const { error } = await client
        .from('spin_results')
        .insert([{
          id: spinData.id,
          session_id: spinData.sessionId,
          configuration_id: spinData.configId,
          winner: spinData.winner,
          is_respin: spinData.isRespin,
          spin_power: spinData.spinPower,
          spin_timestamp: spinData.timestamp,
          acknowledged_at: spinData.acknowledgedAt || null,
          acknowledge_method: spinData.acknowledgeMethod === 'remove' ? 'button' : (spinData.acknowledgeMethod || null),
        }]);

      if (error) {
        // Only log actual errors, not constraint violations (which are expected)
        if (error.code !== '23505' && error.code !== '23514') {
          console.warn('Failed to insert spin (continuing in local mode):', error);
        }
        return; // Don't throw, just log and continue
      }
    } catch (err: unknown) {
      console.warn('Spin insert error (continuing in local mode):', err);
      return; // Don't throw, just continue
    }
  }

  async updateSpin(spinId: string, updateData: Record<string, unknown>): Promise<void> {
    if (!this.client) {
      console.log('🔇 Supabase not available, skipping spin update');
      return;
    }

    try {
      const client: any = this.client;

      // Map 'remove' to 'button' for database compatibility
      const dbUpdateData = { ...updateData };
      if (dbUpdateData.acknowledgeMethod === 'remove') {
        dbUpdateData.acknowledgeMethod = 'button';
      }

      const { error } = await client
        .from('spin_results')
        .update(dbUpdateData)
        .eq('id', spinId);

      if (error) {
        // Only log actual errors, not constraint violations (which are expected)
        if (error.code !== '23505' && error.code !== '23514') {
          console.warn('Failed to update spin (continuing in local mode):', error);
        }
        return; // Don't throw, just log and continue
      }
    } catch (err: unknown) {
      console.warn('Spin update error (continuing in local mode):', err);
      return; // Don't throw, just continue
    }
  }

  /**
   * Check if the adapter is ready to sync
   */
  isReady(): boolean {
    return this.client !== null;
  }

  /**
   * Test the database connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.client) return false;

    try {
      // Simple query to test connection
      const client: any = this.client;
      const { error } = await client
        .from('sessions')
        .select('id')
        .limit(1);

      if (error) {
        console.error('❌ Database connection test failed:', error);
        return false;
      }

      console.log('✅ Database connection successful');
      return true;
    } catch (err) {
      console.error('❌ Connection test failed:', err);
      return false;
    }
  }

  /**
   * Check if database tables exist and are accessible
   */
  async verifySchema(): Promise<{ sessions: boolean; configurations: boolean; spins: boolean }> {
    if (!this.client) {
      return { sessions: false, configurations: false, spins: false };
    }

    const client: any = this.client;
    const results = { sessions: false, configurations: false, spins: false };

    try {
      // Test sessions table
      const { error: sessionsError } = await client
        .from('sessions')
        .select('id')
        .limit(1);
      results.sessions = !sessionsError;
      if (sessionsError) console.log('❌ Sessions table issue:', sessionsError.message);

      // Test wheel_configurations table
      const { error: configError } = await client
        .from('wheel_configurations')
        .select('id')
        .limit(1);
      results.configurations = !configError;
      if (configError) console.log('❌ Configurations table issue:', configError.message);

      // Test spin_results table
      const { error: spinsError } = await client
        .from('spin_results')
        .select('id')
        .limit(1);
      results.spins = !spinsError;
      if (spinsError) console.log('❌ Spin results table issue:', spinsError.message);

    } catch (err) {
      console.error('❌ Schema verification failed:', err);
    }

    console.log('📊 Schema verification results:', results);
    return results;
  }

  /**
   * Get some basic stats (optional - for debugging)
   */
  async getStats(): Promise<{ sessions: number; configurations: number; spins: number } | null> {
    if (!this.client) return null;

    try {
      const client: any = this.client;
      const [sessionsResult, configsResult, spinsResult] = await Promise.all([
        client.from('sessions').select('id', { count: 'exact', head: true }),
        client.from('wheel_configurations').select('id', { count: 'exact', head: true }),
        client.from('spin_results').select('id', { count: 'exact', head: true }),
      ]);

      return {
        sessions: sessionsResult.count || 0,
        configurations: configsResult.count || 0,
        spins: spinsResult.count || 0,
      };
    } catch (err) {
      console.error('Stats query failed:', err);
      return null;
    }
  }
}