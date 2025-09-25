import { useEffect, useState, useCallback, useRef } from 'react';
import { LocalSession, SpinRecord } from '../lib/session/LocalSession';
import { DatabaseSync } from '../lib/session/DatabaseSync';
import { SupabaseAdapter } from '../lib/session/SupabaseAdapter';

interface UseSessionReturn {
  sessionId: string | null;
  isLoading: boolean;
  error: string | null;
  saveConfiguration: (names: string[], teamName?: string, inputMethod?: 'custom' | 'random' | 'numbers') => Promise<string | null>;
  recordSpin: (configId: string, winner: string, isRespin: boolean, spinPower: number) => Promise<string | null>;
  updateSpinAcknowledgment: (spinId: string, method: 'button' | 'backdrop' | 'x') => Promise<void>;
  getSessionHistory: () => Promise<SpinRecord[] | null>;
  getSyncStatus?: () => any; // Optional debug info
}

export function useSession(): UseSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local-first session management
  const localSessionRef = useRef<LocalSession | null>(null);
  const syncServiceRef = useRef<DatabaseSync | null>(null);

  // Initialize session - happens immediately, never waits for database
  useEffect(() => {
    try {
      // Create local session (instant)
      const localSession = new LocalSession();
      localSessionRef.current = localSession;
      setSessionId(localSession.getSessionId());

      // Set up background sync (non-blocking)
      const syncService = new DatabaseSync(localSession);
      syncServiceRef.current = syncService;

      // Try to initialize Supabase adapter (if available)
      setTimeout(async () => {
        try {
          const adapter = new SupabaseAdapter();
          if (adapter.isReady()) {
            // Verify database schema exists
            const schemaCheck = await adapter.verifySchema();
            const allTablesExist = schemaCheck.sessions && schemaCheck.configurations && schemaCheck.spins;

            if (allTablesExist) {
              syncService.setAdapter(adapter);
              console.log('🚀 Database sync enabled - all tables verified');
            } else {
              console.warn('⚠️ Database tables missing or inaccessible. Please run schema.sql in Supabase.');
              console.log('📱 Continuing in local-only mode');
            }
          } else {
            console.log('📱 Running in local-only mode');
          }
        } catch (err) {
          console.warn('Database adapter initialization failed:', err);
          // Continue in local-only mode
        }
      }, 0);

      setIsLoading(false);
    } catch (err) {
      console.error('Session initialization failed:', err);
      setError('Failed to initialize session');
      setIsLoading(false);
    }

    // Cleanup on unmount
    return () => {
      if (syncServiceRef.current) {
        syncServiceRef.current.destroy();
      }
    };
  }, []);

  // Save wheel configuration - returns immediately
  const saveConfiguration = useCallback(async (
    names: string[],
    teamName?: string,
    inputMethod?: 'custom' | 'random' | 'numbers'
  ): Promise<string | null> => {
    if (!localSessionRef.current) return null;

    // Save immediately to local storage
    const configId = localSessionRef.current.saveConfiguration(names, teamName, inputMethod);

    // Background sync happens automatically via DatabaseSync
    return configId;
  }, []);

  // Record spin result - returns immediately
  const recordSpin = useCallback(async (
    configId: string,
    winner: string,
    isRespin: boolean,
    spinPower: number
  ): Promise<string | null> => {
    if (!localSessionRef.current) return null;

    // Record immediately to local storage
    const spinId = localSessionRef.current.recordSpin(configId, winner, isRespin, spinPower);

    // Background sync happens automatically via DatabaseSync
    return spinId;
  }, []);

  // Update spin acknowledgment - returns immediately
  const updateSpinAcknowledgment = useCallback(async (
    spinId: string,
    method: 'button' | 'backdrop' | 'x'
  ): Promise<void> => {
    if (!localSessionRef.current) return;

    // Update immediately in local storage
    localSessionRef.current.updateSpinAcknowledgment(spinId, method);

    // Background sync happens automatically via DatabaseSync
  }, []);

  // Get session history - returns immediately from local storage
  const getSessionHistory = useCallback(async (): Promise<SpinRecord[] | null> => {
    if (!localSessionRef.current) return null;

    // Get from local storage immediately
    return localSessionRef.current.getSpinHistory();
  }, []);

  // Get sync status for debugging (optional)
  const getSyncStatus = useCallback(() => {
    return syncServiceRef.current?.getSyncStatus() || null;
  }, []);

  return {
    sessionId,
    isLoading,
    error,
    saveConfiguration,
    recordSpin,
    updateSpinAcknowledgment,
    getSessionHistory,
    getSyncStatus,
  };
}