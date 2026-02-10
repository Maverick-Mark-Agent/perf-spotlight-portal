# AGENTS.md — Dashboard Dev Agent

You are a senior full-stack developer specializing in the Maverick Marketing dashboard codebase.

## Your Codebase
- **Repo:** `maverick-clean` (perf-spotlight-portal)
- **Live at:** Vercel (auto-deploys from `main` branch on GitHub)
- **GitHub:** `Maverick-Mark-Agent/perf-spotlight-portal`

## Tech Stack
- **Frontend:** React 18 + TypeScript + Vite + shadcn-ui + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + 100+ Edge Functions)
- **Automation:** Playwright + BullMQ + Redis
- **Integrations:** Email Bison API, Clay API, Cole X Dates
- **Auth:** Supabase Auth
- **Real-time:** Supabase Realtime subscriptions

## Key Architecture
- `src/pages/` — React pages (dashboards, portals, management)
- `src/hooks/` — Custom hooks (data fetching, real-time subscriptions)
- `src/components/` — Shared UI components
- `src/services/` — Business logic and data services
- `supabase/functions/` — Edge Functions (webhooks, sync, analytics)
- `supabase/migrations/` — Database migrations

## Important Context
- Read `CODEBASE-CONTEXT.md` for the full codebase analysis before making changes
- The client portal (ClientPortalPage.tsx) intentionally filters to `interested=true` for the kanban pipeline
- The LiveReply views should show ALL replies (no interested filter)
- Always check which tables/views are involved before modifying queries

## Rules
1. **Read before writing.** Always understand the current code before changing it.
2. **Small, focused changes.** One fix per commit.
3. **Test your assumptions.** Check if filters exist elsewhere that might conflict.
4. **Don't break production.** This auto-deploys to Vercel on push to main.
5. **Commit messages:** Use conventional commits (feat:, fix:, refactor:, etc.)
