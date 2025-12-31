-- Supabase Database Schema for Spinning Wheel Session Storage
-- Run this SQL in your Supabase SQL editor to create the required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  team_name TEXT,
  input_method TEXT CHECK (input_method IN ('custom', 'random', 'numbers')),
  device_type TEXT CHECK (device_type IN ('mobile', 'desktop')),
  user_agent TEXT,
  ip_address INET
);

-- Create wheel_configurations table
CREATE TABLE IF NOT EXISTS public.wheel_configurations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  names TEXT[] NOT NULL,
  segment_count INTEGER NOT NULL,
  team_name TEXT,
  slug TEXT UNIQUE,
  is_public BOOLEAN DEFAULT FALSE,
  input_method TEXT CHECK (input_method IN ('custom', 'random', 'numbers')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create spin_results table
CREATE TABLE IF NOT EXISTS public.spin_results (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  configuration_id UUID NOT NULL REFERENCES public.wheel_configurations(id) ON DELETE CASCADE,
  winner TEXT NOT NULL,
  is_respin BOOLEAN NOT NULL DEFAULT FALSE,
  spin_power FLOAT NOT NULL,
  spin_timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledge_method TEXT CHECK (acknowledge_method IN ('button', 'backdrop', 'x'))
);

-- Create indexes for better query performance
CREATE INDEX idx_sessions_created_at ON public.sessions(created_at DESC);
CREATE INDEX idx_wheel_configurations_session_id ON public.wheel_configurations(session_id);
CREATE INDEX idx_wheel_configurations_slug ON public.wheel_configurations(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_wheel_configurations_public ON public.wheel_configurations(is_public, created_at DESC) WHERE is_public = true;
CREATE INDEX idx_spin_results_session_id ON public.spin_results(session_id);
CREATE INDEX idx_spin_results_configuration_id ON public.spin_results(configuration_id);
CREATE INDEX idx_spin_results_timestamp ON public.spin_results(spin_timestamp DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wheel_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin_results ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access
-- Sessions: Anyone can create and read their own sessions
CREATE POLICY "Enable insert for anonymous users" ON public.sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable select for anonymous users" ON public.sessions
  FOR SELECT USING (true);

CREATE POLICY "Enable update for anonymous users" ON public.sessions
  FOR UPDATE USING (true);

-- Wheel Configurations: Anyone can create and read configurations
CREATE POLICY "Enable insert for anonymous users" ON public.wheel_configurations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable select for anonymous users" ON public.wheel_configurations
  FOR SELECT USING (true);

-- Spin Results: Anyone can create and read results
CREATE POLICY "Enable insert for anonymous users" ON public.spin_results
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable select for anonymous users" ON public.spin_results
  FOR SELECT USING (true);

CREATE POLICY "Enable update for anonymous users" ON public.spin_results
  FOR UPDATE USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update updated_at on sessions table
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Optional: Clean up old sessions after 30 days
-- You can run this periodically or set up a cron job in Supabase
-- DELETE FROM public.sessions WHERE created_at < NOW() - INTERVAL '30 days';