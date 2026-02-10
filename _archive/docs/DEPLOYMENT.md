# Deployment Guide - Maverick Dashboard

## Quick Setup: Deploy to Vercel with Custom Domain

### Step 1: Connect to Vercel (5 minutes)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"**
3. Import: `Maverick-Mark-Agent/perf-spotlight-portal`
4. Click **"Deploy"** (don't configure anything yet)

### Step 2: Add Environment Variables (2 minutes)

In your Vercel project dashboard:
1. Go to **Settings** → **Environment Variables**
2. Add these 3 variables:

```
VITE_SUPABASE_PROJECT_ID = gjqbbgrfhijescaouqkx
VITE_SUPABASE_PUBLISHABLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0
VITE_SUPABASE_URL = https://gjqbbgrfhijescaouqkx.supabase.co
```

3. Select **"Production"**, **"Preview"**, and **"Development"** for all three
4. Click **"Save"**
5. Go to **Deployments** → click the three dots on latest deployment → **"Redeploy"**

### Step 3: Add Your Custom Domain (3 minutes)

1. In Vercel project, go to **Settings** → **Domains**
2. Add your domain (e.g., `dashboard.yourdomain.com`)
3. Vercel will show you DNS records to add:
   - **A Record**: Point to Vercel's IP
   - **CNAME**: Point to `cname.vercel-dns.com`
4. Add these records in your domain provider (GoDaddy, Namecheap, Cloudflare, etc.)
5. Wait 5-10 minutes for DNS propagation
6. SSL certificate is automatically provisioned

### Step 4: Enable Auto-Deploy (Already configured!)

✅ Every time you push to GitHub `main` branch, Vercel automatically deploys
- Changes go live in ~30 seconds
- No manual steps needed

## Making Quick Changes

### Workflow:
```bash
# 1. Make your changes locally
# 2. Test with npm run dev
# 3. Commit and push
git add .
git commit -m "your changes"
git push

# 4. Vercel auto-deploys to your domain in 30 seconds!
```

### View Deployment Status:
- Check Vercel dashboard for deployment progress
- Get email notifications on deployment success/failure

## Subdomain vs Subdirectory

### Option A: Subdomain (Recommended - Easiest)
- URL: `dashboard.yourdomain.com`
- Setup: Just add DNS records in Step 3
- **Best for separate applications**

### Option B: Subdirectory (More Complex)
- URL: `yourdomain.com/dashboard`
- Requires: Main site proxy configuration
- **Only needed if you must have it under main domain path**

## Troubleshooting

### Build fails on Vercel:
- Check Build Logs in Vercel dashboard
- Usually missing environment variables

### Domain not working:
- Check DNS propagation: [whatsmydns.net](https://whatsmydns.net)
- DNS changes can take up to 24 hours

### App loads but data doesn't:
- Check environment variables are set for Production
- Check Supabase URL is correct
- Check browser console for CORS errors

## Vercel CLI (Optional - for power users)

```bash
# Install
npm i -g vercel

# Deploy from terminal
vercel

# Deploy to production
vercel --prod
```

## Cost

- **Vercel**: Free tier includes:
  - Unlimited deployments
  - 100GB bandwidth/month
  - Automatic SSL
  - Custom domains
  - Serverless functions

- **Upgrade needed?**: Only if you exceed 100GB/month (unlikely for dashboard)

## Support

- Vercel Docs: [vercel.com/docs](https://vercel.com/docs)
- Vercel Support: [vercel.com/support](https://vercel.com/support)
