# Deployment Guide - Maverick Marketing Website + Client Portal

This guide will walk you through deploying your secure Maverick Marketing website with client portal authentication step-by-step. **No developer experience required!**

---

## 📋 Table of Contents

1. [Before You Start](#before-you-start)
2. [Step 1: Set Up Supabase Authentication](#step-1-set-up-supabase-authentication)
3. [Step 2: Deploy Database Migration](#step-2-deploy-database-migration)
4. [Step 3: Deploy Edge Function](#step-3-deploy-edge-function)
5. [Step 4: Test Locally](#step-4-test-locally)
6. [Step 5: Deploy to Production](#step-5-deploy-to-production)
7. [Step 6: Configure Domain](#step-6-configure-domain)
8. [Step 7: Create Your First Client User](#step-7-create-your-first-client-user)
9. [Troubleshooting](#troubleshooting)

---

## Before You Start

### What You'll Need:
- [ ] Supabase account and project (you already have this)
- [ ] GitHub account (for deployment)
- [ ] Vercel or Netlify account (free tier works)
- [ ] Domain name (optional, can set up later)
- [ ] 2-3 hours of time

### Files Created:
- ✅ `/supabase/migrations/20251015000000_create_auth_system.sql` - Database structure
- ✅ `/supabase/functions/get-workspace-data/index.ts` - Secure API function
- ✅ `/src/pages/LoginPage.tsx` - Login page
- ✅ `/src/pages/MarketingHomePage.tsx` - Public landing page
- ✅ `/src/components/auth/ProtectedRoute.tsx` - Authentication wrapper

---

## Step 1: Set Up Supabase Authentication

### 1.1 Enable Email Authentication

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project (gjqbbgrfhijescaouqkx)
3. Click **Authentication** in the left sidebar
4. Click **Providers** tab
5. Find **Email** provider
6. Toggle it **ON** (it should already be enabled)
7. Scroll down and click **Save**

### 1.2 Configure Email Templates (Optional but Recommended)

1. Still in **Authentication** → Click **Email Templates**
2. Customize these templates:
   - **Confirm signup**: Email sent to new users
   - **Reset password**: Email for password resets
   - **Magic Link**: One-click login (optional)

3. Example customization for "Confirm signup":
```html
<h2>Welcome to Maverick Marketing!</h2>
<p>Click the link below to verify your email and access your client portal:</p>
<p><a href="{{ .ConfirmationURL }}">Verify Email</a></p>
```

### 1.3 Update Site URL Settings

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to: `https://yourdomain.com` (or localhost:8080 for testing)
3. Add **Redirect URLs**:
   - `http://localhost:8080/client-portal`
   - `https://yourdomain.com/client-portal`
4. Click **Save**

---

## Step 2: Deploy Database Migration

This creates the necessary tables for user authentication and workspace access.

### 2.1 Using Supabase CLI (Recommended)

Open your terminal in the project folder and run:

```bash
# Make sure you're in the project directory
cd "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal"

# Deploy the migration
npx supabase db push
```

**Expected Output:**
```
✔ Applying migration 20251015000000_create_auth_system.sql
✔ Migration complete
```

### 2.2 Alternative: SQL Editor (Manual Method)

If the CLI doesn't work:

1. Go to Supabase Dashboard → **SQL Editor**
2. Click **+ New query**
3. Copy the entire contents of this file:
   `/supabase/migrations/20251015000000_create_auth_system.sql`
4. Paste into the SQL editor
5. Click **Run** (bottom right)
6. You should see: `Success. No rows returned`

### 2.3 Verify Migration

Check that tables were created:

1. Go to **Table Editor** in Supabase
2. You should now see these new tables:
   - `user_workspace_access`
   - `user_profiles`
3. Check `client_leads` table → Click **⋮** → **View Policies**
   - You should see RLS policies for workspace isolation

---

## Step 3: Deploy Edge Function

This function keeps your API keys secure on the server.

### 3.1 Deploy the Function

```bash
# Deploy the get-workspace-data function
npx supabase functions deploy get-workspace-data --no-verify-jwt

# Set environment variables (Supabase will use its own keys automatically)
```

**Expected Output:**
```
Deploying get-workspace-data (x86_64)...
Deployed function get-workspace-data to project gjqbbgrfhijescaouqkx
```

### 3.2 Test the Function

```bash
# Test if function is working
curl -X POST 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/get-workspace-data' \
  -H 'Content-Type: application/json' \
  -d '{"action":"list_workspaces"}'
```

**Expected:** You'll get an error about missing authorization (this is good! It means auth is required)

---

## Step 4: Test Locally

Before deploying to production, let's make sure everything works on your computer.

### 4.1 Install Dependencies

```bash
# Install all required packages
npm install
```

### 4.2 Start Development Server

```bash
# Start the local server
npm run dev
```

**Expected Output:**
```
  VITE v5.4.19  ready in 523 ms

  ➜  Local:   http://localhost:8080/
```

### 4.3 Test the Website

1. Open browser to: http://localhost:8080/marketing
   - ✅ You should see the marketing landing page
   - ✅ Click "Client Login" button → goes to login page

2. Go to: http://localhost:8080/login
   - ✅ You should see the login form

3. Go to: http://localhost:8080/client-portal
   - ✅ You should be redirected to /login (authentication required!)

4. Go to: http://localhost:8080/ (admin dashboard)
   - ✅ Should still work (no auth required for admin)

### 4.4 Stop the Server

Press `Ctrl+C` in terminal to stop the dev server.

---

## Step 5: Deploy to Production

We'll use Vercel (easiest for beginners). Netlify works similarly.

### 5.1 Push Code to GitHub

1. Open Terminal in your project folder

2. Initialize git (if not already):
```bash
git init
git add .
git commit -m "Add secure client portal authentication"
```

3. Create a new GitHub repository:
   - Go to https://github.com/new
   - Name it: `maverick-marketing-portal`
   - Click **Create repository**

4. Push your code:
```bash
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/maverick-marketing-portal.git
git branch -M main
git push -u origin main
```

### 5.2 Deploy to Vercel

1. Go to https://vercel.com/signup
2. Sign up with your GitHub account
3. Click **Add New** → **Project**
4. Import your `maverick-marketing-portal` repository
5. Configure project:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

6. Click **Deploy**

7. Wait 2-3 minutes for deployment

**Expected:** You'll get a URL like: `https://maverick-marketing-portal-abc123.vercel.app`

### 5.3 Test Production Deployment

1. Visit your Vercel URL + `/marketing`
   - Example: `https://maverick-marketing-portal-abc123.vercel.app/marketing`

2. Click around:
   - ✅ Marketing page loads
   - ✅ Login button works
   - ✅ Client portal requires login

---

## Step 6: Configure Domain

### 6.1 Option A: Use Vercel Subdomain (Free)

Your site is already live at:
```
https://maverick-marketing-portal-abc123.vercel.app
```

Update Supabase redirect URLs:
1. Supabase → **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**: `https://maverick-marketing-portal-abc123.vercel.app/client-portal`

### 6.2 Option B: Use Custom Domain

If you have a domain (e.g., `maverickmarketingllc.com`):

**In Vercel:**
1. Go to your project → **Settings** → **Domains**
2. Click **Add Domain**
3. Enter: `maverickmarketingllc.com`
4. Vercel will show you DNS records to add

**In Your Domain Registrar (GoDaddy, Namecheap, etc.):**
1. Log in to your domain registrar
2. Find **DNS Settings** or **Manage DNS**
3. Add these records (Vercel will tell you the exact values):
   - Type: `A` | Name: `@` | Value: `76.76.21.21`
   - Type: `CNAME` | Name: `www` | Value: `cname.vercel-dns.com`

4. Wait 5-60 minutes for DNS propagation

**Update Supabase:**
1. Supabase → **Authentication** → **URL Configuration**
2. Set **Site URL**: `https://maverickmarketingllc.com`
3. Add **Redirect URLs**:
   - `https://maverickmarketingllc.com/client-portal`
   - `https://www.maverickmarketingllc.com/client-portal`

---

## Step 7: Create Your First Client User

Now let's create a test account to make sure login works!

### 7.1 Create User via Supabase Dashboard

1. Supabase Dashboard → **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Fill in:
   - **Email**: `testclient@example.com` (use real email for testing)
   - **Password**: `TestPassword123!`
   - **Auto Confirm User**: ✅ Check this (skips email verification)
4. Click **Create user**

### 7.2 Assign Workspace Access

Open **SQL Editor** and run this query:

```sql
-- Replace the email and workspace name with your test values
INSERT INTO public.user_workspace_access (user_id, workspace_name, role)
SELECT
  id,
  'David Amiri', -- Change this to match an actual workspace name
  'client'
FROM auth.users
WHERE email = 'testclient@example.com';
```

Click **Run** - you should see: `Success. Inserted 1 row`

### 7.3 Test Client Login

1. Go to your website: `/login`
2. Enter credentials:
   - Email: `testclient@example.com`
   - Password: `TestPassword123!`
3. Click **Sign In**

**Expected Behavior:**
- ✅ You're redirected to `/client-portal`
- ✅ You see ONLY the workspace(s) you assigned
- ✅ You can click into the workspace and see leads

### 7.4 Test Logout

There's no logout button yet! Let's add one quickly:

**Quick Fix - Add Logout to ClientPortalHub:**

1. Open `/src/pages/ClientPortalHub.tsx`
2. Add this import at the top:
```typescript
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
```

3. Find the "Back to Dashboard" button section (around line 164)
4. Add a logout button next to it:
```tsx
<Button
  variant="outline"
  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
  onClick={async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }}
>
  <LogOut className="h-4 w-4 mr-2" />
  Logout
</Button>
```

5. Save, rebuild, and redeploy:
```bash
git add .
git commit -m "Add logout button"
git push
```

Vercel will auto-deploy in ~2 minutes.

---

## Troubleshooting

### Problem: "Invalid login credentials"
**Solution:**
- Make sure you created the user in Supabase → Authentication → Users
- Check that you checked "Auto Confirm User"
- Try resetting the password in Supabase dashboard

### Problem: "You don't have access to any workspaces"
**Solution:**
- Check that you ran the SQL to insert workspace access
- Verify workspace name matches exactly (case-sensitive!)
- Run this query to check:
```sql
SELECT * FROM user_workspace_access WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'testclient@example.com'
);
```

### Problem: "Failed to fetch workspaces"
**Solution:**
- Check that Edge Function deployed successfully
- Verify function URL is correct in error console
- Test function directly:
```bash
curl https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/get-workspace-data
```

### Problem: Deploy fails with "Module not found"
**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Problem: Site shows blank page
**Solution:**
- Check browser console for errors (F12 → Console tab)
- Common fix: Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)

---

## Next Steps

✅ **You're done!** Your secure client portal is now live.

### What to do next:

1. **Create client accounts** - See CLIENT_ONBOARDING_GUIDE.md

2. **Customize branding** - Edit `/src/pages/MarketingHomePage.tsx` to add:
   - Your logo
   - Company description
   - Contact information

3. **Set up email templates** - Make login/reset emails match your brand

4. **Monitor usage** - Check Supabase Dashboard → **Authentication** → **Users**

5. **Optional upgrades**:
   - Add password requirements
   - Enable 2FA (two-factor authentication)
   - Add SSO (Google, Microsoft login)

---

## Support

Having issues? Here's how to get help:

1. **Check logs**:
   - Supabase → **Database** → **Logs**
   - Supabase → **Edge Functions** → **Logs**
   - Vercel → **Deployments** → Click deployment → **Function Logs**

2. **Common error codes**:
   - 401: Authentication failed
   - 403: User authenticated but no workspace access
   - 500: Server error (check Edge Function logs)

3. **Contact support**:
   - Email: support@maverickmarketingllc.com
   - Include: Error message, what you were trying to do, screenshots

---

**Congratulations! 🎉**

Your Maverick Marketing website with secure client portal is now live!
