# Supabase Session Storage Setup

This document explains how to set up Supabase for storing user sessions and spin results.

## Features

- **Anonymous Sessions**: No authentication required
- **Automatic Session Creation**: Sessions are created automatically when users visit
- **Data Tracked**:
  - Wheel configurations (names/numbers used)
  - Team names (if provided)
  - Input methods (custom/random/numbers)
  - All spin results with winners
  - Spin acknowledgment methods
  - Device types and user agents

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [Supabase](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key

### 2. Create Database Tables

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the SQL script from `lib/supabase/schema.sql`

This will create three tables:
- `sessions` - Stores user sessions
- `wheel_configurations` - Stores wheel setups
- `spin_results` - Stores spin outcomes

### 3. Configure Environment Variables

Update `.env.local` with your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Verify Setup

1. Run your development server: `npm run dev`
2. Open browser developer console
3. Check for any Supabase connection errors
4. Spin the wheel and verify data appears in Supabase dashboard

## How It Works

### Session Lifecycle

1. **Session Creation**: When a user visits, a session is created with a unique ID
2. **Local Storage**: Session ID is stored in browser localStorage
3. **Expiry**: Sessions expire after 30 days of inactivity
4. **Data Association**: All wheel configurations and spins are linked to the session

### Data Flow

1. **Wheel Setup**: When users set up a wheel (custom names, random, or numbers), the configuration is saved
2. **Spin Recording**: Each spin is recorded with the winner, power level, and timestamp
3. **Acknowledgment**: When users close the winner modal, the acknowledgment method is recorded

### Privacy & Security

- **No Personal Data**: Only anonymous session IDs are stored
- **Row Level Security**: RLS policies ensure data isolation
- **Optional**: If Supabase isn't configured, the app works normally without persistence

## Querying Data

### View Recent Sessions

```sql
SELECT * FROM sessions
ORDER BY created_at DESC
LIMIT 100;
```

### Get Spin Statistics

```sql
SELECT
  s.team_name,
  s.input_method,
  COUNT(sr.id) as total_spins,
  COUNT(DISTINCT sr.winner) as unique_winners
FROM sessions s
LEFT JOIN spin_results sr ON s.id = sr.session_id
GROUP BY s.id
ORDER BY total_spins DESC;
```

### Most Common Winners

```sql
SELECT
  winner,
  COUNT(*) as win_count
FROM spin_results
WHERE is_respin = false
GROUP BY winner
ORDER BY win_count DESC
LIMIT 20;
```

## Maintenance

### Clean Up Old Sessions

Run periodically to remove sessions older than 30 days:

```sql
DELETE FROM sessions
WHERE created_at < NOW() - INTERVAL '30 days';
```

### Monitor Storage

Check table sizes:

```sql
SELECT
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

## Troubleshooting

### Connection Issues

If Supabase isn't connecting:
1. Verify environment variables are set correctly
2. Check Supabase project is active
3. Ensure RLS policies are enabled
4. Check browser console for errors

### Data Not Appearing

If data isn't being saved:
1. Verify tables exist in Supabase
2. Check RLS policies allow anonymous inserts
3. Monitor Network tab for failed requests
4. Check Supabase logs for errors

## Optional: Disable Session Storage

To run without Supabase:
1. Don't set the environment variables
2. The app will automatically fallback to local-only mode
3. Sessions will still work but won't persist to database