# CocoaTrack V2

Modern cocoa purchase tracking application built with Next.js 15, TypeScript, and Supabase.

## Prerequisites

- Node.js 20+
- pnpm 8+
- Docker Desktop (for Supabase local development)
- Supabase CLI

## Quick Start

### 1. Install Supabase CLI

```bash
# Windows (PowerShell)
scoop install supabase

# macOS
brew install supabase/tap/supabase

# npm (cross-platform)
npm install -g supabase
```

### 2. Start Supabase Local

```bash
cd v2
supabase start
```

This will start:
- PostgreSQL on port 54322
- Supabase Studio on http://localhost:54323
- API on http://localhost:54321
- Inbucket (email testing) on http://localhost:54324

### 3. Apply Migrations and Seed Data

```bash
supabase db reset
```

This will:
- Drop and recreate the database
- Apply all migrations
- Run seed.sql

### 4. Install Frontend Dependencies

```bash
cd frontend
pnpm install
```

### 5. Start Development Server

```bash
pnpm dev
```

Open http://localhost:3000

## Test Users

| Email                  | Password     | Role    | Cooperative              |
|------------------------|--------------|---------|--------------------------|
| admin@cocoatrack.cm    | Admin123!    | admin   | All (NULL)               |
| manager@cocoatrack.cm  | Manager123!  | manager | Coopérative Centrale     |
| agent@cocoatrack.cm    | Agent123!    | agent   | Coopérative Centrale     |
| viewer@cocoatrack.cm   | Viewer123!   | viewer  | Coopérative du Littoral  |

## Project Structure

```
v2/
├── supabase/
│   ├── config.toml          # Supabase configuration
│   ├── seed.sql             # Initial seed data
│   └── migrations/          # Database migrations
├── frontend/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # React components
│   ├── lib/                 # Utilities and API clients
│   └── types/               # TypeScript types
└── README.md
```

## Useful Commands

```bash
# Start Supabase
supabase start

# Stop Supabase
supabase stop

# Reset database (apply migrations + seed)
supabase db reset

# Create new migration
supabase migration new <migration_name>

# Generate TypeScript types
supabase gen types typescript --local > frontend/types/database.gen.ts

# View Supabase status
supabase status
```

## Environment Variables

Create `.env.local` in the frontend directory:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Get the anon key from `supabase status` output.
