# System Architecture Diagram

Visual guide to understand how the secure client portal works.

---

## 🌐 User Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      USER VISITS WEBSITE                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │  Which page did they visit?   │
            └───────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
    ┌─────────┐      ┌────────────┐    ┌──────────────┐
    │/marketing│      │   /login   │    │/client-portal│
    │ PUBLIC  │      │   PUBLIC   │    │  PROTECTED   │
    └─────────┘      └────────────┘    └──────────────┘
          │                 │                 │
          │                 │                 ▼
          │                 │         ┌───────────────┐
          │                 │         │Is user logged │
          │                 │         │     in?       │
          │                 │         └───────────────┘
          │                 │            │        │
          │                 │          YES       NO
          │                 │            │        │
          │                 │            ▼        ▼
          │                 │    ┌─────────┐ ┌────────┐
          │                 │    │Show     │ │Redirect│
          │                 │    │Portal   │ │to /login│
          │                 │    └─────────┘ └────────┘
          │                 │
          ▼                 ▼
    ┌─────────────────────────────────┐
    │  User sees marketing page       │
    │  Clicks "Client Login" button   │
    │  → Goes to /login               │
    └─────────────────────────────────┘
                            │
                            ▼
    ┌─────────────────────────────────┐
    │  User enters email + password   │
    │  Clicks "Sign In"               │
    └─────────────────────────────────┘
                            │
                            ▼
    ┌─────────────────────────────────┐
    │  Supabase Auth validates        │
    │  credentials                    │
    └─────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
             VALID                   INVALID
                │                       │
                ▼                       ▼
    ┌─────────────────┐   ┌──────────────────────┐
    │Create session   │   │Show error:           │
    │token            │   │"Invalid credentials" │
    │Redirect to      │   └──────────────────────┘
    │/client-portal   │
    └─────────────────┘
                │
                ▼
    ┌─────────────────────────────────┐
    │  Fetch user's workspaces        │
    │  (via secure Edge Function)     │
    └─────────────────────────────────┘
                │
                ▼
    ┌─────────────────────────────────┐
    │  Show ONLY workspaces user has  │
    │  access to                      │
    └─────────────────────────────────┘
                │
                ▼
    ┌─────────────────────────────────┐
    │  User clicks a workspace        │
    │  → /client-portal/:workspace    │
    └─────────────────────────────────┘
                │
                ▼
    ┌─────────────────────────────────┐
    │  Database checks:               │
    │  Does user have access to this  │
    │  workspace? (RLS policy)        │
    └─────────────────────────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
  YES                       NO
    │                       │
    ▼                       ▼
┌─────────────┐   ┌──────────────────┐
│Show leads   │   │Show error:       │
│from that    │   │"Access denied"   │
│workspace    │   └──────────────────┘
└─────────────┘
```

---

## 🔐 Authentication Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     CLIENT BROWSER                           │
│                                                              │
│  • No API keys stored                                        │
│  • Session token in localStorage                             │
│  • HTTPS encrypted                                           │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   │ HTTPS/TLS 1.3
                   │ Encrypted
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│                  SUPABASE AUTH                               │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │ Validates email + password                     │         │
│  │ Creates JWT session token                      │         │
│  │ Manages session refresh                        │         │
│  │ Handles password resets                        │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  Session Token Example:                                      │
│  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...                   │
│  ↑                                                           │
│  Contains: user_id, email, expiration                        │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   │ Authenticated
                   │ user_id = abc-123-xyz
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│              ROW-LEVEL SECURITY (RLS)                        │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │ For EVERY database query:                      │         │
│  │                                                 │         │
│  │ SELECT * FROM client_leads                     │         │
│  │ WHERE workspace_name IN (                      │         │
│  │   SELECT workspace_name                        │         │
│  │   FROM user_workspace_access                   │         │
│  │   WHERE user_id = auth.uid()  ← Current user   │         │
│  │ );                                             │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  Result: User ONLY sees workspaces they own                  │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   │ Filtered Results
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│                   CLIENT BROWSER                             │
│                                                              │
│  Receives ONLY data user is authorized to see                │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔑 API Key Protection

### Before (Insecure) ❌

```
┌──────────────────────┐
│   CLIENT BROWSER     │
│                      │
│  const API_KEY =     │
│  "77|Aqoz..."  ← 😱  │
│                      │
│  fetch(url, {        │
│    headers: {        │
│      Authorization:  │
│      `Bearer ${      │
│        API_KEY       │
│      }`              │
│    }                 │
│  })                  │
└──────────────────────┘
         │
         │ API KEY EXPOSED!
         │ Anyone can see it
         │ in DevTools
         │
         ▼
┌──────────────────────┐
│   EMAIL BISON API    │
│                      │
│  Accepts request     │
│  using exposed key   │
└──────────────────────┘

PROBLEM: API key is visible in browser!
RISK: Anyone can copy and abuse it
```

### After (Secure) ✅

```
┌──────────────────────────────────────────────┐
│           CLIENT BROWSER                     │
│                                              │
│  // No API keys!                             │
│  const data = await supabase                 │
│    .functions.invoke(                        │
│      'get-workspace-data',                   │
│      {                                       │
│        body: {                               │
│          action: 'list_workspaces'           │
│        }                                     │
│      }                                       │
│    );                                        │
│                                              │
│  ✅ No API key in code                       │
│  ✅ Session token auto-included              │
└──────────────┬───────────────────────────────┘
               │
               │ Authenticated Request
               │ (Session token only)
               │
               ▼
┌──────────────────────────────────────────────┐
│       SUPABASE EDGE FUNCTION                 │
│       (Server-side, secure)                  │
│                                              │
│  const BISON_API_KEY =                       │
│    "77|Aqoz..." ← Stored on server!          │
│                                              │
│  1. Verify user is authenticated             │
│  2. Check user has workspace access          │
│  3. Call Email Bison API with                │
│     server-side API key                      │
│  4. Filter results to user's                 │
│     workspaces only                          │
│  5. Return filtered data                     │
└──────────────┬───────────────────────────────┘
               │
               │ Using server's API key
               │ (never sent to browser)
               │
               ▼
┌──────────────────────────────────────────────┐
│           EMAIL BISON API                    │
│                                              │
│  Receives request with valid API key         │
│  Returns workspace data                      │
└──────────────┬───────────────────────────────┘
               │
               │ Raw data
               │
               ▼
┌──────────────────────────────────────────────┐
│       SUPABASE EDGE FUNCTION                 │
│                                              │
│  Filters data to user's workspaces           │
└──────────────┬───────────────────────────────┘
               │
               │ Filtered data
               │
               ▼
┌──────────────────────────────────────────────┐
│           CLIENT BROWSER                     │
│                                              │
│  Receives ONLY workspaces user has access to │
│  No API key ever visible!                    │
└──────────────────────────────────────────────┘

SOLUTION: API key stays on server!
BENEFIT: Zero risk of key exposure
```

---

## 📊 Database Structure

```
┌─────────────────────────────────────────────────────────┐
│                    auth.users                           │
│  (Managed by Supabase Auth)                             │
│                                                         │
│  ┌────────┬─────────────────────┬─────────────────┐    │
│  │   id   │       email         │  last_sign_in   │    │
│  ├────────┼─────────────────────┼─────────────────┤    │
│  │ abc123 │ john@example.com    │ 2025-10-15      │    │
│  │ def456 │ jane@company.com    │ 2025-10-14      │    │
│  └────────┴─────────────────────┴─────────────────┘    │
└─────────────────────────────────────────────────────────┘
                         │
                         │ One user can have
                         │ access to multiple
                         │ workspaces
                         ▼
┌─────────────────────────────────────────────────────────┐
│              public.user_workspace_access               │
│  (Links users to their allowed workspaces)              │
│                                                         │
│  ┌─────────┬──────────────────┬──────────┐             │
│  │ user_id │  workspace_name  │   role   │             │
│  ├─────────┼──────────────────┼──────────┤             │
│  │ abc123  │ David Amiri      │ client   │             │
│  │ abc123  │ Jason Binyon     │ client   │  ← Multiple │
│  │ def456  │ Tony Schmitz     │ viewer   │             │
│  └─────────┴──────────────────┴──────────┘             │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Workspace name
                         │ matches
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  public.client_leads                    │
│  (All lead data with RLS protection)                    │
│                                                         │
│  ┌───────┬──────────────────┬─────────┬──────────┐     │
│  │  id   │  workspace_name  │  email  │  status  │     │
│  ├───────┼──────────────────┼─────────┼──────────┤     │
│  │  001  │ David Amiri      │ lead1@  │ won      │     │
│  │  002  │ David Amiri      │ lead2@  │ quoting  │     │
│  │  003  │ Jason Binyon     │ lead3@  │ interested│    │
│  │  004  │ Tony Schmitz     │ lead4@  │ won      │     │
│  │  005  │ Kirk Hodgson     │ lead5@  │ lost     │     │
│  └───────┴──────────────────┴─────────┴──────────┘     │
│                                                         │
│  RLS Policy Applied:                                    │
│  SELECT * FROM client_leads                             │
│  WHERE workspace_name IN (                              │
│    SELECT workspace_name FROM user_workspace_access     │
│    WHERE user_id = auth.uid()                           │
│  );                                                     │
│                                                         │
│  Example Results for user abc123:                       │
│  ✅ Shows: David Amiri leads (001, 002)                 │
│  ✅ Shows: Jason Binyon leads (003)                     │
│  ❌ Hides: Tony Schmitz leads (not in their access)     │
│  ❌ Hides: Kirk Hodgson leads (not in their access)     │
└─────────────────────────────────────────────────────────┘
```

---

## 🛡️ Security Layers

```
┌─────────────────────────────────────────────────────────┐
│                    LAYER 1: FRONTEND                    │
│                                                         │
│  • Protected routes check auth status                   │
│  • Redirect to login if not authenticated               │
│  • Hide sensitive UI elements                           │
│                                                         │
│  ⚠️ Not secure alone! Can be bypassed!                  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              LAYER 2: SUPABASE AUTH                     │
│                                                         │
│  • Validates session tokens                             │
│  • Checks token expiration                              │
│  • Manages user sessions                                │
│  • Rejects invalid/expired tokens                       │
│                                                         │
│  🔒 Server-side validation                              │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│          LAYER 3: ROW-LEVEL SECURITY (RLS)              │
│                                                         │
│  • Database-level security policies                     │
│  • Automatic filtering on EVERY query                   │
│  • Impossible to bypass from client                     │
│  • Works even if frontend is hacked                     │
│                                                         │
│  🔒 PostgreSQL native security                          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│         LAYER 4: EDGE FUNCTION VALIDATION               │
│                                                         │
│  • Checks user authentication                           │
│  • Validates workspace access                           │
│  • Keeps API keys server-side                           │
│  • Filters external API results                         │
│                                                         │
│  🔒 Server-side business logic                          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              LAYER 5: HTTPS ENCRYPTION                  │
│                                                         │
│  • All traffic encrypted (TLS 1.3)                      │
│  • Prevents man-in-the-middle attacks                   │
│  • Validates SSL certificates                           │
│                                                         │
│  🔒 Transport layer security                            │
└─────────────────────────────────────────────────────────┘

ALL 5 LAYERS WORK TOGETHER
= Bank-level security
```

---

## 🔄 Data Flow Example

**Example: John logs in and views his leads**

```
Step 1: LOGIN
─────────────
John visits: https://yoursite.com/login
Enters: john@example.com / password123

Browser → Supabase Auth
        POST /auth/v1/token
        Body: { email, password }

Supabase Auth → Database
        Check password hash
        ✅ Match!

Supabase Auth → Browser
        Return session token:
        { access_token: "eyJh...", user: { id: "abc123" }}

Browser stores token in localStorage


Step 2: VIEW WORKSPACES
───────────────────────
Browser → Edge Function
        POST /functions/v1/get-workspace-data
        Headers: { Authorization: "Bearer eyJh..." }
        Body: { action: "list_workspaces" }

Edge Function validates:
        1. Is token valid? ✅ Yes
        2. Extract user_id from token: abc123

Edge Function → Database
        SELECT workspace_name FROM user_workspace_access
        WHERE user_id = 'abc123'

Database → Edge Function
        Returns: ["David Amiri", "Jason Binyon"]

Edge Function → Email Bison API
        GET /workspaces
        Headers: { Authorization: "Bearer [SERVER API KEY]" }

Email Bison API → Edge Function
        Returns: All 23 workspaces

Edge Function filters:
        Keep only: David Amiri, Jason Binyon
        Remove: All others (not in John's access)

Edge Function → Browser
        Returns: 2 workspaces
        [ { name: "David Amiri" }, { name: "Jason Binyon" } ]

Browser displays:
        ✅ David Amiri
        ✅ Jason Binyon
        ❌ Tony Schmitz (hidden)
        ❌ All others (hidden)


Step 3: VIEW LEADS
──────────────────
John clicks: "David Amiri"
Browser navigates: /client-portal/David%20Amiri

Browser → Database
        SELECT * FROM client_leads
        WHERE workspace_name = 'David Amiri'

Database applies RLS:
        WHERE workspace_name IN (
          SELECT workspace_name FROM user_workspace_access
          WHERE user_id = 'abc123'
        )
        AND workspace_name = 'David Amiri'

Database checks:
        Does John have access to "David Amiri"? ✅ Yes!

Database → Browser
        Returns: All David Amiri leads

Browser displays:
        Lead pipeline with David's leads only


Step 4: WHAT IF JOHN TRIES TO HACK?
────────────────────────────────────
John manually types: /client-portal/Tony%20Schmitz

Browser → Database
        SELECT * FROM client_leads
        WHERE workspace_name = 'Tony Schmitz'

Database applies RLS:
        WHERE workspace_name IN (
          SELECT workspace_name FROM user_workspace_access
          WHERE user_id = 'abc123'
        )
        AND workspace_name = 'Tony Schmitz'

Database checks:
        Does John have access to "Tony Schmitz"?
        ❌ NO! Not in user_workspace_access!

Database → Browser
        Returns: [] (empty array)

Browser displays:
        "No leads found" (Tony's data protected!)
```

---

## 📱 Mobile vs Desktop Flow

Both work identically! The system is responsive.

```
MOBILE                           DESKTOP
──────                           ───────

Login page                       Login page
↓                                ↓
Small form                       Larger form
↓                                ↓
Portal hub                       Portal hub
  - Stacked cards                  - Grid layout (2-4 columns)
↓                                ↓
Workspace view                   Workspace view
  - Narrow columns                 - Wide kanban board
  - Scroll horizontally            - All visible
```

---

**Need help understanding any part?**

See the detailed documentation:
- `SECURITY_OVERVIEW.md` - Security explained
- `DEPLOYMENT_GUIDE.md` - How to deploy
- `IMPLEMENTATION_SUMMARY.md` - What was built

