import { useEffect, useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient, isSupabaseEnabled } from '../lib/supabase/client';
import { Session, WheelConfiguration, SpinResult } from '../lib/supabase/types';

const SESSION_STORAGE_KEY = 'wheel_session_id';
const SESSION_EXPIRY_DAYS = 30;

interface UseSessionReturn {
  sessionId: string | null;
  isLoading: boolean;
  error: string | null;
  saveConfiguration: (names: string[], teamName?: string, inputMethod?: 'custom' | 'random' | 'numbers') => Promise<string | null>;
  recordSpin: (configId: string, winner: string, isRespin: boolean, spinPower: number) => Promise<string | null>;
  updateSpinAcknowledgment: (spinId: string, method: 'button' | 'backdrop' | 'x') => Promise<void>;
  getSessionHistory: () => Promise<SpinResult[] | null>;
}

export function useSession(): UseSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useRef(getSupabaseClient());

  // Initialize or retrieve session
  useEffect(() => {
    const initSession = async () => {
      // If Supabase is not enabled, just generate a local session ID
      if (!isSupabaseEnabled()) {
        const localSessionId = localStorage.getItem(SESSION_STORAGE_KEY) || uuidv4();
        localStorage.setItem(SESSION_STORAGE_KEY, localSessionId);
        setSessionId(localSessionId);
        setIsLoading(false);
        return;
      }

      try {
        // Check for existing session in localStorage
        const existingSessionId = localStorage.getItem(SESSION_STORAGE_KEY);

        if (existingSessionId && supabase.current) {
          // Verify session exists in database
          const { data, error } = await supabase.current
            .from('sessions')
            .select('*')
            .eq('id', existingSessionId)
            .single();

          if (data && !error) {
            // Check if session is not expired (30 days)
            const createdAt = new Date(data.created_at);
            const now = new Date();
            const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

            if (daysDiff < SESSION_EXPIRY_DAYS) {
              setSessionId(existingSessionId);
              setIsLoading(false);
              return;
            }
          }
        }

        // Create new session
        const newSessionId = uuidv4();
        const deviceType = /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

        if (supabase.current) {
          const { error } = await supabase.current
            .from('sessions')
            .insert({
              id: newSessionId,
              device_type: deviceType,
              user_agent: navigator.userAgent.substring(0, 500), // Limit user agent length
            });

          if (error) {
            console.error('Failed to create session in database:', error);
            setError('Session storage unavailable');
          }
        }

        localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
        setSessionId(newSessionId);
      } catch (err) {
        console.error('Session initialization error:', err);
        setError('Failed to initialize session');
        // Fall back to local session
        const localSessionId = uuidv4();
        localStorage.setItem(SESSION_STORAGE_KEY, localSessionId);
        setSessionId(localSessionId);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, []);

  // Save wheel configuration
  const saveConfiguration = useCallback(async (
    names: string[],
    teamName?: string,
    inputMethod?: 'custom' | 'random' | 'numbers'
  ): Promise<string | null> => {
    if (!sessionId || !supabase.current) return null;

    try {
      const configId = uuidv4();

      // Update session with team name and input method if provided
      if (teamName || inputMethod) {
        await supabase.current
          .from('sessions')
          .update({
            team_name: teamName,
            input_method: inputMethod,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
      }

      // Save wheel configuration
      const { error } = await supabase.current
        .from('wheel_configurations')
        .insert({
          id: configId,
          session_id: sessionId,
          names: names,
          segment_count: names.length,
        });

      if (error) {
        console.error('Failed to save configuration:', error);
        return null;
      }

      return configId;
    } catch (err) {
      console.error('Error saving configuration:', err);
      return null;
    }
  }, [sessionId]);

  // Record spin result
  const recordSpin = useCallback(async (
    configId: string,
    winner: string,
    isRespin: boolean,
    spinPower: number
  ): Promise<string | null> => {
    if (!sessionId || !supabase.current) return null;

    try {
      const spinId = uuidv4();

      const { error } = await supabase.current
        .from('spin_results')
        .insert({
          id: spinId,
          session_id: sessionId,
          configuration_id: configId,
          winner: winner,
          is_respin: isRespin,
          spin_power: spinPower,
          spin_timestamp: new Date().toISOString(),
        });

      if (error) {
        console.error('Failed to record spin:', error);
        return null;
      }

      return spinId;
    } catch (err) {
      console.error('Error recording spin:', err);
      return null;
    }
  }, [sessionId]);

  // Update spin acknowledgment
  const updateSpinAcknowledgment = useCallback(async (
    spinId: string,
    method: 'button' | 'backdrop' | 'x'
  ): Promise<void> => {
    if (!supabase.current || !spinId) return;

    try {
      const { error } = await supabase.current
        .from('spin_results')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledge_method: method,
        })
        .eq('id', spinId);

      if (error) {
        console.error('Failed to update spin acknowledgment:', error);
      }
    } catch (err) {
      console.error('Error updating spin acknowledgment:', err);
    }
  }, []);

  // Get session history
  const getSessionHistory = useCallback(async (): Promise<SpinResult[] | null> => {
    if (!sessionId || !supabase.current) return null;

    try {
      const { data, error } = await supabase.current
        .from('spin_results')
        .select('*')
        .eq('session_id', sessionId)
        .order('spin_timestamp', { ascending: false });

      if (error) {
        console.error('Failed to fetch session history:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error fetching session history:', err);
      return null;
    }
  }, [sessionId]);

  return {
    sessionId,
    isLoading,
    error,
    saveConfiguration,
    recordSpin,
    updateSpinAcknowledgment,
    getSessionHistory,
  };
}