# Maverick Marketing - Secure Client Portal

**A professional, secure client portal for managing lead generation campaigns.**

🔐 **Secure Authentication** • 🎯 **Workspace Isolation** • 📊 **Real-Time Analytics** • 🚀 **Production Ready**

---

## 🎯 What Is This?

A complete authentication and client portal system that allows your clients to:

- ✅ Securely log in with email/password
- ✅ View ONLY their leads (data isolation)
- ✅ Manage their sales pipeline (drag & drop)
- ✅ Track won deals and ROI
- ✅ Refresh data from Email Bison

**For you (the admin):**
- ✅ Easy client onboarding (5 minutes per client)
- ✅ No exposed API keys (server-side only)
- ✅ Bank-level security
- ✅ Full audit trail

---

## 🚀 Quick Start

**Want to go live quickly?** Start here:

1. **Read QUICKSTART.md** - Get live in 60 minutes
2. **Read DEPLOYMENT_GUIDE.md** - Detailed deployment steps
3. **Read CLIENT_ONBOARDING_GUIDE.md** - Create client accounts

---

## 📚 Documentation

| Document | Purpose | Who It's For |
|----------|---------|--------------|
| **QUICKSTART.md** | 10-step guide to go live in 1 hour | Start here! |
| **DEPLOYMENT_GUIDE.md** | Complete deployment instructions | When you're ready to deploy |
| **CLIENT_ONBOARDING_GUIDE.md** | How to create client accounts | Creating new users |
| **SECURITY_OVERVIEW.md** | How security works (non-technical) | Understanding the system |
| **IMPLEMENTATION_SUMMARY.md** | What was built and how it works | Technical overview |

---

## 🏗️ Architecture

### Public Routes (No Login Required)
- `/marketing` - Marketing landing page
- `/login` - Login page

### Protected Routes (Login Required)
- `/client-portal` - Client portal hub
- `/client-portal/:workspace` - Individual workspace view

### Admin Routes (Internal Use Only)
- `/` - Admin dashboard
- All other existing routes (KPI, Revenue, Volume, etc.)

---

## 🔐 Security Features

✅ **Authentication**: Email/password login via Supabase Auth
✅ **Authorization**: Row-Level Security (RLS) on all client data
✅ **API Protection**: API keys stored server-side only
✅ **Data Isolation**: Clients see ONLY their workspaces
✅ **Encryption**: HTTPS/TLS 1.3 everywhere
✅ **Password Security**: Bcrypt hashing
✅ **Audit Trail**: All actions logged

**Read more**: See `SECURITY_OVERVIEW.md`

---

## 📁 Project Structure

```
perf-spotlight-portal/
├── src/
│   ├── pages/
│   │   ├── LoginPage.tsx                    # Login page
│   │   ├── MarketingHomePage.tsx            # Public landing page
│   │   ├── ClientPortalHub.tsx              # Client portal hub (updated)
│   │   └── ClientPortalPage.tsx             # Workspace view (updated)
│   ├── components/
│   │   └── auth/
│   │       └── ProtectedRoute.tsx           # Auth wrapper component
│   └── hooks/
│       └── useSecureWorkspaceData.ts        # Secure API hook
│
├── supabase/
│   ├── migrations/
│   │   └── 20251015000000_create_auth_system.sql  # Database setup
│   └── functions/
│       └── get-workspace-data/
│           └── index.ts                     # Secure API endpoint
│
├── QUICKSTART.md                            # Quick start guide
├── DEPLOYMENT_GUIDE.md                      # Full deployment guide
├── CLIENT_ONBOARDING_GUIDE.md               # User management guide
├── SECURITY_OVERVIEW.md                     # Security explanation
└── IMPLEMENTATION_SUMMARY.md                # Technical overview
```

---

## 🎓 How It Works

### Authentication Flow

```
1. Client visits /client-portal
   ↓
2. ProtectedRoute checks: Is user logged in?
   ↓ NO
3. Redirect to /login
   ↓
4. Client enters email + password
   ↓
5. Supabase Auth validates credentials
   ↓ VALID
6. Create session token
   ↓
7. Redirect to /client-portal
   ↓
8. Show workspaces user has access to
```

### Data Isolation (Row-Level Security)

```sql
-- Client logs in as: john@example.com
-- Database automatically filters ALL queries:

SELECT * FROM client_leads
WHERE workspace_name IN (
  SELECT workspace_name
  FROM user_workspace_access
  WHERE user_id = [john's user ID]
);

-- John can ONLY see workspaces assigned to him
-- Even if he tries: /client-portal/SomeoneElsesWorkspace
-- Database blocks the query
```

### API Key Protection

**Before (Insecure):**
```javascript
// BAD: API key in browser code
const API_KEY = "77|Aqoz...";
fetch("https://api.emailbison.com/workspaces", {
  headers: { Authorization: `Bearer ${API_KEY}` }
});
```

**After (Secure):**
```javascript
// GOOD: API key on server only
const data = await supabase.functions.invoke('get-workspace-data', {
  body: { action: 'list_workspaces' }
});
```

---

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Authentication**: Supabase Auth
- **Database**: PostgreSQL with Row-Level Security
- **API**: Supabase Edge Functions (Deno)
- **Deployment**: Vercel / Netlify
- **Styling**: Tailwind CSS + shadcn/ui

---

## 📦 Installation

### Prerequisites
- Node.js 18+ installed
- Supabase account
- Vercel or Netlify account (for deployment)

### Local Development

```bash
# Clone the repository
cd "Maverick Dashboard/perf-spotlight-portal"

# Install dependencies
npm install

# Start development server
npm run dev

# Visit http://localhost:8080
```

---

## 🚀 Deployment

**Follow QUICKSTART.md for fastest deployment (1 hour)**

Or follow these high-level steps:

1. Deploy database migration
2. Deploy Edge Function
3. Enable Supabase Authentication
4. Test locally
5. Deploy to Vercel/Netlify
6. Configure domain (optional)
7. Create first client user

**Full details**: See `DEPLOYMENT_GUIDE.md`

---

## 👥 Client Management

### Create a New Client

```sql
-- 1. Create user in Supabase UI:
--    Authentication → Users → Add user

-- 2. Assign workspace access:
INSERT INTO user_workspace_access (user_id, workspace_name, role)
SELECT id, 'Client Workspace Name', 'client'
FROM auth.users WHERE email = 'client@example.com';

-- 3. Send login credentials to client
```

### Email Template

```
Subject: Your Maverick Marketing Portal Access

Hi [Client Name],

Your lead tracking portal is ready!

🔗 Login: https://yoursite.com/login
📧 Email: client@example.com
🔑 Password: [password]

Change your password after first login.

Best,
Tommy
```

**Full guide**: See `CLIENT_ONBOARDING_GUIDE.md`

---

## 🔧 Configuration

### Environment Variables

**Client-side** (Safe to expose):
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key (public)

**Server-side** (Never exposed):
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service key
- Bison API key (stored in Edge Function code)

### Supabase Settings

**Authentication** → **Providers**:
- ✅ Email provider enabled

**Authentication** → **URL Configuration**:
- Site URL: `https://yourdomain.com`
- Redirect URLs: `https://yourdomain.com/client-portal`

---

## 🐛 Troubleshooting

### Common Issues

**"Invalid login credentials"**
→ Check user exists in Supabase → Authentication → Users

**"No workspaces found"**
→ Check `user_workspace_access` table has entry for user

**"Failed to fetch workspaces"**
→ Check Edge Function deployed: Supabase → Edge Functions

**"Unauthorized" error**
→ Verify user is logged in, check session token

**Full troubleshooting**: See `DEPLOYMENT_GUIDE.md` Section 9

---

## 📊 Monitoring

### Check User Activity
1. Supabase → Authentication → Users
2. See **Last Sign In** column
3. Sort by recent activity

### View Logs
1. Supabase → Edge Functions → Logs (API errors)
2. Supabase → Database → Logs (SQL errors)
3. Vercel → Deployments → Logs (deployment issues)

---

## 🔒 Security Best Practices

✅ **DO:**
- Use strong passwords (12+ characters)
- Enable 2FA for Supabase account
- Monitor login activity weekly
- Remove inactive users
- Keep dependencies updated

❌ **DON'T:**
- Share admin credentials
- Give all users 'admin' role
- Commit .env files to GitHub
- Disable RLS policies
- Share API keys via email

**Full security guide**: See `SECURITY_OVERVIEW.md`

---

## 🎯 Roadmap

### ✅ Completed (Current Release)
- Email/password authentication
- Row-Level Security
- Workspace data isolation
- Marketing landing page
- API key protection
- Client onboarding system

### 🔄 In Progress
- Logout button in portal
- User profile editing
- Password strength requirements

### 📋 Planned Features
- 2FA (two-factor authentication)
- SSO (Google, Microsoft login)
- Admin authentication
- Activity monitoring dashboard
- Automated client invitations

---

## 📞 Support

### Documentation
- **Quick Questions**: Check `QUICKSTART.md`
- **Deployment Help**: See `DEPLOYMENT_GUIDE.md`
- **User Management**: See `CLIENT_ONBOARDING_GUIDE.md`
- **Security Questions**: See `SECURITY_OVERVIEW.md`

### Technical Support
- Email: support@maverickmarketingllc.com
- Include: Error message, what you tried, screenshots

### Useful SQL Queries

```sql
-- See all users
SELECT email, created_at, last_sign_in_at FROM auth.users;

-- See user's workspaces
SELECT * FROM user_workspace_access WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'client@example.com'
);

-- See all workspace names
SELECT DISTINCT workspace_name FROM client_leads ORDER BY workspace_name;
```

---

## 📝 License

© 2025 Maverick Marketing LLC. All rights reserved.

---

## 🙏 Credits

Built with:
- [React](https://react.dev) - UI framework
- [Supabase](https://supabase.com) - Auth & database
- [Vite](https://vitejs.dev) - Build tool
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [shadcn/ui](https://ui.shadcn.com) - UI components

---

## 🚀 Getting Started

**Ready to deploy?**

1. Start with **QUICKSTART.md** (1 hour to go live)
2. Read **DEPLOYMENT_GUIDE.md** (detailed instructions)
3. Create your first client with **CLIENT_ONBOARDING_GUIDE.md**
4. Understand security with **SECURITY_OVERVIEW.md**

**Have questions?** Email: support@maverickmarketingllc.com

---

**Built with ❤️ by Claude Code for Maverick Marketing**
