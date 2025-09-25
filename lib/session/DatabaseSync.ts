import { LocalSession, WheelConfig, SpinRecord } from './LocalSession';

interface SyncOperation {
  id: string;
  type: 'session' | 'configuration' | 'spin' | 'acknowledgment';
  operation: 'insert' | 'update';
  data: Record<string, unknown>;
  timestamp: string;
  retryCount: number;
}

interface DatabaseAdapter {
  insertSession: (data: Record<string, unknown>) => Promise<void>;
  updateSession: (id: string, data: Record<string, unknown>) => Promise<void>;
  insertConfiguration: (data: Record<string, unknown>) => Promise<void>;
  insertSpin: (data: Record<string, unknown>) => Promise<void>;
  updateSpin: (id: string, data: Record<string, unknown>) => Promise<void>;
}

/**
 * Background service that syncs local session data to database
 * Never blocks the UI - operates entirely in the background
 */
export class DatabaseSync {
  private syncQueue: SyncOperation[] = [];
  private isOnline: boolean = true;
  private syncInterval: NodeJS.Timeout | null = null;
  private adapter: DatabaseAdapter | null = null;
  private localSession: LocalSession;
  private lastSyncTime: string | null = null;
  private sessionInsertAttempted: boolean = false;

  private readonly SYNC_INTERVAL = 30000; // 30 seconds - only for retrying failed operations
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_BACKOFF = 2000; // 2 seconds initial backoff

  constructor(localSession: LocalSession) {
    this.localSession = localSession;
    this.setupNetworkListeners();
    this.startSyncLoop();

    // Set up event-based sync callbacks
    this.localSession.setSyncCallbacks({
      onConfigurationSaved: (config) => this.syncConfiguration(config as WheelConfig),
      onSpinRecorded: (spin) => this.syncSpin(spin as SpinRecord),
      onSpinAcknowledged: (spinId, acknowledgedAt, method) =>
        this.syncSpinAcknowledgment(spinId, acknowledgedAt, method),
    });
  }

  /**
   * Set the database adapter (when Supabase is available)
   */
  setAdapter(adapter: DatabaseAdapter): void {
    this.adapter = adapter;
    // Only queue the session insert - no aggressive data dump
    this.queueInitialSessionInsert();
  }

  private setupNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        console.log('🌐 Back online - resuming sync');
        this.processSyncQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        console.log('🚫 Offline - sync paused');
      });

      this.isOnline = navigator.onLine;
    }
  }

  private startSyncLoop(): void {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      if (this.isOnline && this.adapter) {
        this.processSyncQueue();
      }
    }, this.SYNC_INTERVAL);
  }

  private stopSyncLoop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private queueInitialSessionInsert(): void {
    console.log(`🔍 Session insert check: adapter=${!!this.adapter}, attempted=${this.sessionInsertAttempted}`);

    if (!this.adapter || this.sessionInsertAttempted) {
      console.log('⏭️ Skipping session insert - already attempted or no adapter');
      return;
    }

    const data = this.localSession.getDataForSync();
    const now = new Date().toISOString();

    console.log(`📝 Queueing session insert for session ID: ${data.session.id}`);

    // Queue initial session insert (only happens once when adapter is first set)
    this.queueOperation({
      id: `session_insert_${data.session.id}`,
      type: 'session',
      operation: 'insert',
      data: data.session,
      timestamp: now,
      retryCount: 0,
    });

    this.sessionInsertAttempted = true;
    console.log('✅ Session insert queued and flag set');
  }


  private queueOperation(operation: SyncOperation): void {
    // Enhanced deduplication for rapid successive events
    this.syncQueue = this.syncQueue.filter(op => {
      // Always remove exact ID matches
      if (op.id === operation.id) return false;

      // For acknowledgments, also remove if same spin but different timestamp
      // This handles rapid successive acknowledgment updates
      if (operation.type === 'acknowledgment' && op.type === 'acknowledgment') {
        const existingSpinId = op.id.replace('ack_', '');
        const newSpinId = operation.id.replace('ack_', '');
        if (existingSpinId === newSpinId) {
          console.log(`🔄 Replacing acknowledgment for spin ${newSpinId}`);
          return false;
        }
      }

      return true;
    });

    this.syncQueue.push(operation);

    // No immediate sync - let the 30-second background loop handle it
  }

  private async processSyncQueue(): Promise<void> {
    if (!this.adapter || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    // Removed excessive sync logging to reduce console noise

    const operations = [...this.syncQueue];
    const successfulOps: string[] = [];

    for (const operation of operations) {
      try {
        await this.executeSyncOperation(operation);
        successfulOps.push(operation.id);
        // Removed sync success logging to reduce console noise
      } catch (error) {
        console.warn(`❌ Sync failed for ${operation.id}:`, error);

        // Retry logic
        operation.retryCount++;
        if (operation.retryCount >= this.MAX_RETRIES) {
          console.error(`🚨 Max retries reached for ${operation.id}, dropping operation`);
          successfulOps.push(operation.id); // Remove from queue
        } else {
          // Exponential backoff
          const delay = this.RETRY_BACKOFF * Math.pow(2, operation.retryCount - 1);
          setTimeout(() => {
            if (this.isOnline && this.adapter) {
              this.processSyncQueue();
            }
          }, delay);
        }
      }
    }

    // Remove successful operations from queue
    this.syncQueue = this.syncQueue.filter(op => !successfulOps.includes(op.id));

    if (successfulOps.length > 0) {
      this.lastSyncTime = new Date().toISOString();
      // Removed sync completion logging to reduce console noise
    }
  }

  private async executeSyncOperation(operation: SyncOperation): Promise<void> {
    if (!this.adapter) throw new Error('No database adapter available');

    switch (operation.type) {
      case 'session':
        if (operation.operation === 'update') {
          await this.adapter.updateSession(operation.data.id as string, operation.data);
        } else {
          await this.adapter.insertSession(operation.data);
        }
        break;

      case 'configuration':
        await this.adapter.insertConfiguration(operation.data);
        break;

      case 'spin':
        await this.adapter.insertSpin(operation.data);
        break;

      case 'acknowledgment':
        // Extract spin ID from operation ID (format: "ack_{spinId}")
        const spinId = operation.id.replace('ack_', '');
        await this.adapter.updateSpin(spinId, {
          acknowledged_at: operation.data.acknowledged_at,
          acknowledge_method: operation.data.acknowledge_method,
        });
        break;

      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Get sync status for debugging/UI
   */
  getSyncStatus(): {
    isOnline: boolean;
    queueLength: number;
    lastSyncTime: string | null;
    hasAdapter: boolean;
  } {
    return {
      isOnline: this.isOnline,
      queueLength: this.syncQueue.length,
      lastSyncTime: this.lastSyncTime,
      hasAdapter: this.adapter !== null,
    };
  }

  /**
   * Force immediate sync (for testing)
   */
  async forceSync(): Promise<void> {
    await this.processSyncQueue();
  }

  /**
   * Sync new configuration (event-based)
   */
  async syncConfiguration(config: Record<string, unknown>): Promise<void> {
    this.queueOperation({
      id: `config_${config.id}`,
      type: 'configuration',
      operation: 'insert',
      data: config,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    });
  }

  /**
   * Sync new spin result (event-based)
   */
  async syncSpin(spin: Record<string, unknown>): Promise<void> {
    this.queueOperation({
      id: `spin_${spin.id}`,
      type: 'spin',
      operation: 'insert',
      data: spin,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    });
  }

  /**
   * Sync spin acknowledgment (event-based)
   */
  async syncSpinAcknowledgment(spinId: string, acknowledgedAt: string, acknowledgeMethod: string): Promise<void> {
    this.queueOperation({
      id: `ack_${spinId}`,
      type: 'acknowledgment',
      operation: 'update',
      data: {
        acknowledged_at: acknowledgedAt,
        acknowledge_method: acknowledgeMethod,
      },
      timestamp: new Date().toISOString(),
      retryCount: 0,
    });
  }

  /**
   * Cleanup when component unmounts
   */
  destroy(): void {
    this.stopSyncLoop();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', () => {});
      window.removeEventListener('offline', () => {});
    }
  }
}