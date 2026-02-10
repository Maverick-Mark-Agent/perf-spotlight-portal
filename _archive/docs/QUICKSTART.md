# Quick Start Guide - Get Your Client Portal Live in 1 Hour

Follow these steps in order. Each step takes 5-10 minutes.

---

## ⏱️ Total Time: ~60 minutes

✅ = Task Complete

---

## Step 1: Deploy Database (10 minutes)

Open Terminal in your project folder:

```bash
cd "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal"
```

Run this command:
```bash
npx supabase db push
```

**Expected**: `✔ Migration complete`

**If error**: Open `DEPLOYMENT_GUIDE.md` → Section 2.2 (manual SQL method)

✅ **Done?** → Move to Step 2

---

## Step 2: Deploy Edge Function (5 minutes)

Still in Terminal, run:

```bash
npx supabase functions deploy get-workspace-data --no-verify-jwt
```

**Expected**: `Deployed function get-workspace-data`

✅ **Done?** → Move to Step 3

---

## Step 3: Enable Authentication (3 minutes)

1. Go to https://app.supabase.com
2. Select your project
3. Click **Authentication** (left sidebar)
4. Click **Providers** tab
5. Find **Email** → Toggle ON
6. Click **Save**

✅ **Done?** → Move to Step 4

---

## Step 4: Test Locally (10 minutes)

In Terminal:

```bash
npm install
npm run dev
```

**Expected**: Server starts at `http://localhost:8080`

Open browser and test:

1. Go to: `http://localhost:8080/marketing`
   - ✅ Marketing page loads

2. Click "Client Login" button
   - ✅ Goes to login page

3. Go to: `http://localhost:8080/client-portal`
   - ✅ Redirects to `/login` (good!)

Press `Ctrl+C` in Terminal to stop server.

✅ **Done?** → Move to Step 5

---

## Step 5: Deploy to Vercel (15 minutes)

### 5.1 Push to GitHub

```bash
git init
git add .
git commit -m "Add secure client portal"
```

Go to https://github.com/new
- Name: `maverick-marketing-portal`
- Click **Create repository**

Copy the commands GitHub shows (replace YOUR_USERNAME):

```bash
git remote add origin https://github.com/YOUR_USERNAME/maverick-marketing-portal.git
git branch -M main
git push -u origin main
```

### 5.2 Deploy to Vercel

1. Go to https://vercel.com/signup
2. Sign up with GitHub
3. Click **Add New** → **Project**
4. Select `maverick-marketing-portal`
5. Click **Deploy**
6. Wait 2-3 minutes

**You'll get a URL like**: `https://maverick-marketing-portal-abc123.vercel.app`

Copy this URL!

✅ **Done?** → Move to Step 6

---

## Step 6: Update Supabase URLs (3 minutes)

1. Go to Supabase Dashboard
2. Click **Authentication** → **URL Configuration**
3. Add to **Redirect URLs**:
   - Paste your Vercel URL + `/client-portal`
   - Example: `https://maverick-marketing-portal-abc123.vercel.app/client-portal`
4. Click **Save**

✅ **Done?** → Move to Step 7

---

## Step 7: Create Test User (5 minutes)

1. Supabase Dashboard → **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Fill in:
   - Email: `test@maverickmarketingllc.com`
   - Password: `TestPassword123!`
   - Auto Confirm User: ✅ CHECK THIS
4. Click **Create user**

Now assign a workspace:

1. Click **SQL Editor** → **New query**
2. Paste this (change workspace name if needed):

```sql
INSERT INTO public.user_workspace_access (user_id, workspace_name, role)
SELECT id, 'David Amiri', 'client'
FROM auth.users WHERE email = 'test@maverickmarketingllc.com';
```

3. Click **Run**
4. See: `Success. Inserted 1 row`

✅ **Done?** → Move to Step 8

---

## Step 8: Test Production Login (5 minutes)

1. Go to your Vercel URL + `/login`
   - Example: `https://maverick-marketing-portal-abc123.vercel.app/login`

2. Enter credentials:
   - Email: `test@maverickmarketingllc.com`
   - Password: `TestPassword123!`

3. Click **Sign In**

**Expected behavior:**
- ✅ Redirects to `/client-portal`
- ✅ Shows the workspace you assigned
- ✅ Click workspace → See leads

✅ **Done?** → Move to Step 9

---

## Step 9: Create First Real Client (5 minutes)

Repeat Step 7, but use real client info:

1. Create user with client's email
2. Assign their workspace
3. Send them login credentials

**Email template**:

```
Hi [Client Name],

Your lead tracking portal is ready!

🔗 Login: [Your Vercel URL]/login
📧 Email: [their email]
🔑 Password: [password you created]

Change your password after first login.

Best,
Tommy
```

✅ **Done?** → Move to Step 10

---

## Step 10: (Optional) Set Up Custom Domain (5-10 minutes)

**Skip this if you don't have a domain yet**

### In Vercel:
1. Project → **Settings** → **Domains**
2. Click **Add Domain**
3. Enter: `maverickmarketingllc.com`
4. Vercel shows DNS records to add

### In Your Domain Registrar (GoDaddy, Namecheap, etc.):
1. Log in to domain account
2. Find **DNS Settings**
3. Add records Vercel provided
4. Wait 10-60 minutes

### Update Supabase:
1. Authentication → URL Configuration
2. Site URL: `https://maverickmarketingllc.com`
3. Add Redirect URL: `https://maverickmarketingllc.com/client-portal`

✅ **Done?** → You're live!

---

## 🎉 Success Checklist

You're done when all these work:

- [ ] Database migration deployed (tables exist)
- [ ] Edge Function deployed (check Supabase → Edge Functions)
- [ ] Authentication enabled (Supabase → Authentication → Providers)
- [ ] Local dev server works (`npm run dev`)
- [ ] Production site deployed (Vercel URL works)
- [ ] Marketing page loads (`/marketing`)
- [ ] Login page works (`/login`)
- [ ] Test user can log in successfully
- [ ] Test user sees only their workspace
- [ ] Real client account created
- [ ] Real client can log in

---

## ❓ Quick Troubleshooting

### "Module not found" error
```bash
rm -rf node_modules package-lock.json
npm install
```

### "Migration failed"
→ See `DEPLOYMENT_GUIDE.md` Section 2.2 (run SQL manually)

### "Invalid login credentials"
→ Check password, verify user in Supabase → Authentication → Users

### "No workspaces found"
→ Run SQL query in Step 7 again, verify workspace name matches exactly

### Edge Function not working
```bash
npx supabase functions deploy get-workspace-data --no-verify-jwt
```

---

## 📚 Next Steps

Now that you're live, check out:

1. **CLIENT_ONBOARDING_GUIDE.md** - Create more client accounts
2. **SECURITY_OVERVIEW.md** - Understand how security works
3. **DEPLOYMENT_GUIDE.md** - Deep dive on deployment
4. **IMPLEMENTATION_SUMMARY.md** - Full overview of what was built

---

## 🚨 Stuck?

1. Check the error message carefully
2. Search for error in relevant guide (Deployment, Onboarding, Security)
3. Check Supabase logs:
   - Database → Logs
   - Edge Functions → Logs
   - Authentication → Logs

4. Still stuck? Email: support@maverickmarketingllc.com

---

**Ready to start? Begin with Step 1 above! ⬆️**

**Time yourself**: You should be done in ~60 minutes.

Good luck! 🚀
