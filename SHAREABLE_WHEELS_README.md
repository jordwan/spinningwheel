# Shareable Wheels Feature

This feature allows users to create shareable wheel configurations with unique URLs.

## Overview

Users can now share their wheel configurations via URL slugs like:
- `iwheeli.com/team-winners-a1b2`
- `iwheeli.com/classroom-names-x7y9`

## Database Setup

### For New Databases
Run the updated schema:
```sql
-- In Supabase SQL Editor
-- Run: lib/supabase/schema.sql
```

### For Existing Databases
Run the migration script:
```sql
-- In Supabase SQL Editor
-- Run: lib/supabase/migration-add-shareable-wheels.sql
```

This adds:
- `team_name` column to wheel_configurations
- `slug` column (unique) for URL routing
- `is_public` boolean for privacy control
- `input_method` column to track how the wheel was created
- Indexes for performance

## How It Works

### 1. User Flow
1. User creates a wheel with names/numbers
2. User can optionally add a "team name"
3. Click "Share Wheel" button that appears after wheel is configured
4. System generates a unique slug from the team name + 4 random characters
5. Share modal appears with the URL
6. User copies URL to clipboard and shares it

### 2. Slug Generation
- Team name "Team Winners" becomes "team-winners-a1b2"
- If no team name: defaults to "wheel-a1b2"
- Random 4-character suffix prevents collisions
- URL-safe: lowercase, hyphens only, no special characters

### 3. Visiting Shared Wheels
- Anyone with the URL can view and spin the wheel
- Configuration is pre-loaded from the database
- Visitors get their own session for tracking spins
- Original configuration is read-only (visitors can't edit it)

## New Files Created

1. **`lib/utils/slug.ts`** - Slug generation and validation utilities
2. **`lib/supabase/wheel-config.ts`** - Database operations for shareable configs
3. **`app/[slug]/page.tsx`** - Dynamic route for shared wheels (Server Component)
4. **`app/[slug]/SharedWheelClient.tsx`** - Client component for shared wheels
5. **`lib/supabase/migration-add-shareable-wheels.sql`** - Migration for existing DBs

## Modified Files

1. **`lib/supabase/schema.sql`** - Added new columns and indexes
2. **`lib/supabase/types.ts`** - Updated TypeScript types
3. **`hooks/useSession.ts`** - Added `createShareableWheel()` function
4. **`app/page.tsx`** - Added Share button and modal
5. **`next.config.ts`** - Already configured for dynamic routes

## Features

### SEO Benefits
- Each shared wheel = unique indexed page
- Team name in URL (good for keywords)
- Dynamic metadata per wheel with OpenGraph tags
- More pages = more Google Search Console data

### Privacy & Control
- `is_public` flag controls visibility
- Only public wheels are accessible via slug
- Private wheels return 404
- Slug collision prevention with random suffix

### User Experience
- One-click sharing with copy-to-clipboard
- Visual feedback when URL is copied
- Works on all devices (mobile/desktop)
- Fallback for older browsers

## Testing

### Local Testing
```bash
npm run dev
```

1. Create a wheel with custom names
2. Add a team name (optional)
3. Click "Share Wheel" button
4. Copy the URL
5. Open URL in new tab/incognito to verify

### Production Deployment
1. Deploy the code
2. Run the migration SQL in Supabase
3. Ensure environment variables are set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Technical Notes

- Uses Next.js 15 App Router with Server Components
- Dynamic `[slug]` route for SEO-friendly URLs
- Database lookups happen on the server (fast, secure)
- Client-side hydration for interactive spinning
- TypeScript with proper type safety
- Error handling for missing/invalid slugs (returns 404)

## Future Enhancements

Potential improvements:
- Edit/delete options for wheel creators
- Analytics dashboard for shared wheels
- Social media preview images
- QR code generation for easy sharing
- Expiration dates for temporary wheels
- Password protection for sensitive wheels
