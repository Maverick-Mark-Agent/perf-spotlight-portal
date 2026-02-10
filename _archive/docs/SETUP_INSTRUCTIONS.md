# Local Setup Instructions - Next Steps

## Current Status ✅

I've completed the following setup steps for you:

1. ✅ **Installed npm dependencies** - All packages installed
2. ✅ **Created .env.local** - Environment configuration ready
3. ✅ **Supabase CLI verified** - Already installed on your system
4. ✅ **Documentation created** - Complete guides available

## What's Missing: Docker Desktop 🐳

To run Supabase locally, you need Docker Desktop installed. This is the **only remaining requirement**.

---

## Step 1: Install Docker Desktop (Required)

### Option A: Install via Homebrew (Recommended - Fastest)

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Docker Desktop via Homebrew
brew install --cask docker

# Start Docker Desktop (it will appear in your menu bar)
open -a Docker
```

### Option B: Download Manually

1. Go to: https://www.docker.com/products/docker-desktop/
2. Download Docker Desktop for Mac (Apple Silicon or Intel based on your Mac)
3. Open the downloaded .dmg file
4. Drag Docker to Applications folder
5. Open Docker Desktop from Applications
6. Wait for Docker to start (you'll see a whale icon in your menu bar)

---

## Step 2: Verify Docker is Running

After installing Docker Desktop, verify it's working:

```bash
# Check Docker is installed
docker --version

# Check Docker is running (should show empty list or running containers)
docker ps
```

**Expected output:**
```
Docker version 24.x.x, build xxxxx
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```

---

## Step 3: Start Supabase Locally

Once Docker is running:

```bash
# Navigate to your project
cd /Users/mac/Downloads/perf-spotlight-portal

# Start local Supabase (first time takes 2-5 minutes)
supabase start

# ⏳ This will download Docker images and start services
# ☕ Grab a coffee - first run is slower
```

**Expected output:**
```
Started supabase local development setup.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important:** Copy the `anon key` and `service_role key` from the output and update your `.env.local` file if they're different from the defaults.

---

## Step 4: Apply Database Migrations

This creates all tables and functions in your local database:

```bash
# Reset database and apply all migrations
supabase db reset

# This will:
# - Create all tables (client_registry, client_leads, etc.)
# - Apply all 51+ migrations
# - Set up Row Level Security policies
# - Create database functions
```

**Expected output:**
```
Applying migration 20251003000000_create_email_account_metadata.sql...
Applying migration 20251003150000_create_client_leads.sql...
...
✅ All migrations applied successfully
```

---

## Step 5: Start Development Server

```bash
# Start the Vite development server
npm run dev

# Expected output:
#   VITE v5.4.19  ready in 500 ms
#   ➜  Local:   http://localhost:8080/
```

---

## Step 6: Open the Dashboard

Open your browser to:
- **Dashboard:** http://localhost:8080
- **Supabase Studio:** http://localhost:54323 (database UI)

---

## Quick Command Reference

```bash
# Start everything
supabase start          # Start local Supabase
npm run dev             # Start frontend

# Stop everything
supabase stop           # Stop Supabase
Ctrl+C                  # Stop frontend dev server

# Useful commands
supabase status         # Check Supabase status
supabase db reset       # Reset database + apply migrations
npm run build           # Build for production
```

---

## Troubleshooting

### Issue: Docker not found after installation

**Solution:**
```bash
# Restart your terminal
# Make sure Docker Desktop is running (check menu bar for whale icon)

# Try again
docker --version
```

### Issue: Supabase start fails

**Solution:**
```bash
# Make sure Docker is running
docker ps

# Stop and restart Supabase
supabase stop
supabase start
```

### Issue: Port already in use

**Solution:**
```bash
# Check what's using port 54321
lsof -i :54321

# Stop Supabase
supabase stop

# Start again
supabase start
```

---

## What Happens Next?

Once Docker is installed and you complete steps 3-6, you'll have:

✅ **Fully functional local dashboard** running on http://localhost:8080
✅ **Local Supabase database** with all tables and data
✅ **Supabase Studio** (database UI) on http://localhost:54323
✅ **Hot reload** - Changes reflect instantly
✅ **Isolated environment** - Test safely without affecting production

---

## Alternative: Test Against Production (Without Docker)

If you want to test the frontend without setting up local Supabase, you can connect directly to production:

1. Edit `.env.local`:
```env
VITE_SUPABASE_URL=https://gjqbbgrfhijescaouqkx.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
```

2. Start dev server:
```bash
npm run dev
```

**⚠️ Warning:** This connects to production data. Be careful not to modify anything!

---

## Need Help?

- **Docker issues:** See Docker Desktop documentation
- **Supabase issues:** See [LOCAL_DEVELOPMENT_GUIDE.md](./LOCAL_DEVELOPMENT_GUIDE.md)
- **General setup:** See [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

---

## Summary

**You need to:**
1. Install Docker Desktop (10 minutes)
2. Run `supabase start` (5 minutes first time)
3. Run `supabase db reset` (1 minute)
4. Run `npm run dev` (instant)

**Total time:** ~15-20 minutes for complete setup

---

**Everything else is ready! Just install Docker and follow steps 3-6 above. 🚀**
