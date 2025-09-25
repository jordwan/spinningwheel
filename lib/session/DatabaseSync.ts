import { LocalSession } from './LocalSession';

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

  private readonly SYNC_INTERVAL = 5000; // 5 seconds (for debugging)
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_BACKOFF = 2000; // 2 seconds initial backoff

  constructor(localSession: LocalSession) {
    this.localSession = localSession;
    this.setupNetworkListeners();
    this.startSyncLoop();

    // Listen for local changes and queue them for sync
    localSession.addChangeListener(() => {
      this.queueDataForSync();
    });
  }

  /**
   * Set the database adapter (when Supabase is available)
   */
  setAdapter(adapter: DatabaseAdapter): void {
    this.adapter = adapter;
    // Immediately try to sync existing data
    this.queueInitialSessionInsert();
    this.queueDataForSync();
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
    if (!this.adapter) return;

    const data = this.localSession.getDataForSync();
    const now = new Date().toISOString();

    console.log('🔄 Queueing initial session insert for:', data.session.id);
    // Queue initial session insert (only happens once when adapter is first set)
    this.queueOperation({
      id: `session_insert_${data.session.id}`,
      type: 'session',
      operation: 'insert',
      data: data.session,
      timestamp: now,
      retryCount: 0,
    });
  }

  private queueDataForSync(): void {
    if (!this.adapter) return;

    const data = this.localSession.getDataForSync();
    const now = new Date().toISOString();

    console.log('🔄 Queueing session update for:', data.session.id);
    // Queue session update if it's changed (for subsequent updates)
    this.queueOperation({
      id: `session_update_${data.session.id}`,
      type: 'session',
      operation: 'update',
      data: data.session,
      timestamp: now,
      retryCount: 0,
    });

    // Queue new configurations
    console.log(`🔄 Checking ${data.configurations.length} configurations for sync`);
    data.configurations.forEach(config => {
      if (!this.lastSyncTime || config.createdAt > this.lastSyncTime) {
        console.log('🔄 Queueing configuration insert for:', config.id);
        this.queueOperation({
          id: `config_${config.id}`,
          type: 'configuration',
          operation: 'insert',
          data: config,
          timestamp: now,
          retryCount: 0,
        });
      }
    });

    // Queue new spins
    console.log(`🔄 Checking ${data.spins.length} spins for sync`);
    data.spins.forEach(spin => {
      if (!this.lastSyncTime || spin.timestamp > this.lastSyncTime) {
        console.log('🔄 Queueing spin insert for:', spin.winner);
        this.queueOperation({
          id: `spin_${spin.id}`,
          type: 'spin',
          operation: 'insert',
          data: spin,
          timestamp: now,
          retryCount: 0,
        });
      }

      // Queue acknowledgment updates
      if (spin.acknowledgedAt && (!this.lastSyncTime || spin.acknowledgedAt > this.lastSyncTime)) {
        console.log('🔄 Queueing acknowledgment update for:', spin.id);
        this.queueOperation({
          id: `ack_${spin.id}`,
          type: 'acknowledgment',
          operation: 'update',
          data: {
            id: spin.id,
            acknowledged_at: spin.acknowledgedAt,
            acknowledge_method: spin.acknowledgeMethod,
          },
          timestamp: now,
          retryCount: 0,
        });
      }
    });
  }

  private queueOperation(operation: SyncOperation): void {
    // Remove existing operation with same ID (deduplication)
    this.syncQueue = this.syncQueue.filter(op => op.id !== operation.id);
    this.syncQueue.push(operation);

    // Immediate sync attempt if online and adapter available
    if (this.isOnline && this.adapter) {
      // Use setTimeout to avoid blocking the current execution
      setTimeout(() => this.processSyncQueue(), 0);
    }
  }

  private async processSyncQueue(): Promise<void> {
    if (!this.adapter || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    console.log(`🔄 Syncing ${this.syncQueue.length} operations...`);

    const operations = [...this.syncQueue];
    const successfulOps: string[] = [];

    for (const operation of operations) {
      try {
        await this.executeSyncOperation(operation);
        successfulOps.push(operation.id);
        console.log(`✅ Synced: ${operation.type} ${operation.operation}`);
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
      console.log(`✨ Sync complete - ${successfulOps.length} operations succeeded`);
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
        await this.adapter.updateSpin(operation.data.id as string, {
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
  async forcSync(): Promise<void> {
    this.queueDataForSync();
    await this.processSyncQueue();
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