import { v4 as uuidv4 } from 'uuid';
import { getIPAddressWithTimeout } from '../utils/geolocation';

export interface SessionData {
  id: string;
  createdAt: string;
  teamName?: string;
  inputMethod?: 'custom' | 'random' | 'numbers';
  deviceType?: 'mobile' | 'desktop';
  ipAddress?: string;
  [key: string]: unknown; // Allow additional properties for database compatibility
}

export interface WheelConfig {
  id: string;
  sessionId: string;
  names: string[];
  segmentCount: number;
  createdAt: string;
  [key: string]: unknown; // Allow additional properties for database compatibility
}

export interface SpinRecord {
  id: string;
  sessionId: string;
  configId: string;
  winner: string;
  isRespin: boolean;
  spinPower: number;
  timestamp: string;
  acknowledgedAt?: string;
  acknowledgeMethod?: 'button' | 'backdrop' | 'x';
  [key: string]: unknown; // Allow additional properties for database compatibility
}

const SESSION_STORAGE_KEY = 'wheel_session_data';
const SESSION_EXPIRY_DAYS = 30;

/**
 * Local-first session management that works instantly without database dependencies
 */
export class LocalSession {
  private sessionData: SessionData;
  private configurations: WheelConfig[] = [];
  private spins: SpinRecord[] = [];
  private changeListeners: (() => void)[] = [];

  constructor() {
    this.sessionData = this.loadOrCreateSession();
    this.loadStoredData();

    // Auto-save on changes
    this.addChangeListener(() => this.saveToStorage());

    // Fetch location data in the background (non-blocking)
    this.initializeLocationData();
  }

  private loadOrCreateSession(): SessionData {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.sessionData && this.isSessionValid(data.sessionData)) {
          return data.sessionData;
        }
      }
    } catch (error) {
      console.warn('Failed to load session from localStorage:', error);
    }

    // Create new session
    return {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      deviceType: this.detectDeviceType(),
    };
  }

  private loadStoredData(): void {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.configurations = data.configurations || [];
        this.spins = data.spins || [];
      }
    } catch (error) {
      console.warn('Failed to load stored data:', error);
      this.configurations = [];
      this.spins = [];
    }
  }

  private isSessionValid(session: SessionData): boolean {
    if (!session.id || !session.createdAt) return false;

    // Check if session is expired (30 days)
    const createdAt = new Date(session.createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    return daysDiff < SESSION_EXPIRY_DAYS;
  }

  private detectDeviceType(): 'mobile' | 'desktop' {
    if (typeof navigator !== 'undefined') {
      return /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
    }
    return 'desktop';
  }

  private saveToStorage(): void {
    try {
      const data = {
        sessionData: this.sessionData,
        configurations: this.configurations,
        spins: this.spins,
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  private notifyChange(): void {
    this.changeListeners.forEach(listener => listener());
  }

  /**
   * Initialize IP address in the background (non-blocking)
   */
  private async initializeLocationData(): Promise<void> {
    try {
      // Only fetch if we don't already have IP address
      if (!this.sessionData.ipAddress) {
        const ipAddress = await getIPAddressWithTimeout(3000);

        if (ipAddress) {
          // Update session with IP address
          this.sessionData.ipAddress = ipAddress;

          // Notify listeners (will trigger save and sync)
          this.notifyChange();
        }
      }
    } catch (error) {
      console.warn('Failed to get IP address:', error);
      // Continue without IP address - this is not critical for app functionality
    }
  }

  // Public API

  getSessionId(): string {
    return this.sessionData.id;
  }

  getSessionData(): SessionData {
    return { ...this.sessionData };
  }

  /**
   * Save a wheel configuration - returns immediately with ID
   */
  saveConfiguration(names: string[], teamName?: string, inputMethod?: 'custom' | 'random' | 'numbers'): string {
    const configId = uuidv4();

    // Update session data if provided
    if (teamName !== undefined) {
      this.sessionData.teamName = teamName;
    }
    if (inputMethod !== undefined) {
      this.sessionData.inputMethod = inputMethod;
    }

    // Create configuration
    const config: WheelConfig = {
      id: configId,
      sessionId: this.sessionData.id,
      names: [...names],
      segmentCount: names.length,
      createdAt: new Date().toISOString(),
    };

    this.configurations.push(config);
    this.notifyChange();

    return configId;
  }

  /**
   * Record a spin result - returns immediately with ID
   */
  recordSpin(configId: string, winner: string, isRespin: boolean, spinPower: number): string {
    const spinId = uuidv4();

    const spin: SpinRecord = {
      id: spinId,
      sessionId: this.sessionData.id,
      configId,
      winner,
      isRespin,
      spinPower,
      timestamp: new Date().toISOString(),
    };

    this.spins.push(spin);
    this.notifyChange();

    return spinId;
  }

  /**
   * Update spin acknowledgment - returns immediately
   */
  updateSpinAcknowledgment(spinId: string, method: 'button' | 'backdrop' | 'x'): void {
    const spin = this.spins.find(s => s.id === spinId);
    if (spin) {
      spin.acknowledgedAt = new Date().toISOString();
      spin.acknowledgeMethod = method;
      this.notifyChange();
    }
  }

  /**
   * Get spin history for current session
   */
  getSpinHistory(): SpinRecord[] {
    return [...this.spins].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get current wheel configuration
   */
  getCurrentConfiguration(): WheelConfig | null {
    if (this.configurations.length === 0) return null;
    return this.configurations[this.configurations.length - 1];
  }

  /**
   * Get all configurations for this session
   */
  getConfigurations(): WheelConfig[] {
    return [...this.configurations];
  }

  /**
   * Clear all data (for reset)
   */
  clear(): void {
    this.configurations = [];
    this.spins = [];
    this.notifyChange();
  }

  /**
   * Add listener for data changes (for sync service)
   */
  addChangeListener(listener: () => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get all data for syncing to database
   */
  getDataForSync(): {
    session: SessionData;
    configurations: WheelConfig[];
    spins: SpinRecord[];
  } {
    return {
      session: { ...this.sessionData },
      configurations: [...this.configurations],
      spins: [...this.spins],
    };
  }
}