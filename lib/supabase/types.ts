// Database type definitions for Supabase

export interface Session {
  id: string;
  created_at: string;
  updated_at: string;
  team_name?: string;
  input_method?: 'custom' | 'random' | 'numbers';
  device_type?: 'mobile' | 'desktop';
  user_agent?: string;
  ip_address?: string;
}

export interface WheelConfiguration {
  id: string;
  session_id: string;
  names: string[];
  segment_count: number;
  created_at: string;
}

export interface SpinResult {
  id: string;
  session_id: string;
  configuration_id: string;
  winner: string;
  is_respin: boolean;
  spin_power: number;
  spin_timestamp: string;
  acknowledged_at?: string;
  acknowledge_method?: 'button' | 'backdrop' | 'x';
}

// Database schema type
export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: Session;
        Insert: {
          id?: string;
          team_name?: string;
          input_method?: 'custom' | 'random' | 'numbers';
          device_type?: 'mobile' | 'desktop';
          user_agent?: string;
          ip_address?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Session, 'id'>>;
      };
      wheel_configurations: {
        Row: WheelConfiguration;
        Insert: {
          id?: string;
          session_id: string;
          names: string[];
          segment_count: number;
          created_at?: string;
        };
        Update: Partial<Omit<WheelConfiguration, 'id'>>;
      };
      spin_results: {
        Row: SpinResult;
        Insert: {
          id?: string;
          session_id: string;
          configuration_id: string;
          winner: string;
          is_respin: boolean;
          spin_power: number;
          spin_timestamp?: string;
          acknowledged_at?: string;
          acknowledge_method?: 'button' | 'backdrop' | 'x';
        };
        Update: Partial<Omit<SpinResult, 'id'>>;
      };
    };
  };
}