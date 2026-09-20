import { LocalSession, WheelConfig, SpinRecord } from './LocalSession';
import { debugLog } from '../utils/logger';

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
  private static globalSessionInsertAttempted: Set<string> = new Set();
  private isProcessing: boolean = false;
  private processRequestedWhileBusy: boolean = false;
  private destroyed: boolean = false;
  // Keep stable references so destroy() can actually remove the listeners
  private readonly handleOnline = () => {
    this.isOnline = true;
    debugLog('🌐 Back online - resuming sync');
    this.processSyncQueue();
  };
  private readonly handleOffline = () => {
    this.isOnline = false;
    debugLog('🚫 Offline - sync paused');
  };

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

    // Immediately sync the session to database
    // Non-blocking - if it fails, the 30-second loop will retry
    this.processSyncQueue().catch(err => {
      debugLog('⚠️ Initial session sync failed, will retry in background:', err);
    });
  }

  private setupNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
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
    const sessionId = this.localSession.getSessionId();
    debugLog(`🔍 Session insert check: adapter=${!!this.adapter}, instanceAttempted=${this.sessionInsertAttempted}, globalAttempted=${DatabaseSync.globalSessionInsertAttempted.has(sessionId)}`);

    if (!this.adapter || this.sessionInsertAttempted || DatabaseSync.globalSessionInsertAttempted.has(sessionId)) {
      debugLog('⏭️ Skipping session insert - already attempted globally or no adapter');
      return;
    }

    const data = this.localSession.getDataForSync();
    const now = new Date().toISOString();

    debugLog(`📝 Queueing session insert for session ID: ${data.session.id}`);

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
    DatabaseSync.globalSessionInsertAttempted.add(sessionId);
    debugLog('✅ Session insert queued and flags set (instance + global)');
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
          debugLog(`🔄 Replacing acknowledgment for spin ${newSpinId}`);
          return false;
        }
      }

      return true;
    });

    this.syncQueue.push(operation);

    // Immediate sync happens in the calling methods for critical operations
    // The 30-second background loop handles retries and failures
  }

  private async processSyncQueue(): Promise<void> {
    if (this.destroyed || !this.adapter || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    // Only one pass at a time. Event-based triggers (config saved, spin recorded,
    // retry timers, the 30s loop) can overlap; without this guard the same
    // operation could be sent twice before the first attempt finished.
    if (this.isProcessing) {
      this.processRequestedWhileBusy = true;
      return;
    }
    this.isProcessing = true;

    try {
      await this.processOperations();
    } finally {
      this.isProcessing = false;
      if (this.processRequestedWhileBusy) {
        this.processRequestedWhileBusy = false;
        void this.processSyncQueue();
      }
    }
  }

  private async processOperations(): Promise<void> {
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

    // Immediately sync configuration to database
    // Non-blocking - if it fails, the 30-second loop will retry
    this.processSyncQueue().catch(err => {
      debugLog('⚠️ Configuration sync failed, will retry in background:', err);
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

    // Immediately sync spin result to database
    // Non-blocking - if it fails, the 30-second loop will retry
    this.processSyncQueue().catch(err => {
      debugLog('⚠️ Spin sync failed, will retry in background:', err);
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
    this.destroyed = true;
    this.stopSyncLoop();
    // Dropping the adapter also stops any pending retry timers from doing work
    this.adapter = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }
}