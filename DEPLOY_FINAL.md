# 🚀 FINAL DEPLOYMENT - Step by Step

## ✅ Pre-Deployment Checklist

- [x] All 7 feature branches pushed to GitHub
- [x] SSH authentication working
- [x] Code ready for deployment
- [x] Migration SQL ready
- [x] Vercel config ready

## 📋 DEPLOYMENT STEPS

### STEP 1: Supabase Setup (5 minutes)

**1.1 Create Project**
- URL: https://supabase.com/dashboard/new/ajkydjfettrllybxccjn?projectName=TRI-TWO%27s%20Project
- Click "Create new project"
- Wait ~2 minutes for provisioning

**1.2 Run Database Migration**
- Navigate to: **SQL Editor** (left sidebar)
- Click **New query**
- Copy the ENTIRE contents of `SUPABASE_MIGRATION.sql`
- Paste into the SQL Editor
- Click **Run** (or press Cmd/Ctrl + Enter)
- ✅ Expected result: "audit_jobs table created successfully!"

**1.3 Get Credentials**
- Go to: **Settings** → **API**
- Copy these two values:
  - **Project URL** → This is your `SUPABASE_URL`
  - **service_role** key (the secret one, not anon key) → This is your `SUPABASE_SERVICE_ROLE_KEY`
- ⚠️ Keep these secure - you'll need them for Vercel

**1.4 Verify Table**
- Go back to **SQL Editor**
- Run: `SELECT * FROM audit_jobs LIMIT 1;`
- Should return empty result (no error = table exists)

---

### STEP 2: Upstash Redis Setup (2 minutes)

**2.1 Access Database**
- URL: https://console.upstash.com/redis/8522183e-52da-49e0-b051-5ba484b5b5a1?teamid=0
- Database is already created!

**2.2 Get Credentials**
- On the database page, find:
  - **UPSTASH_REDIS_REST_URL** (REST API endpoint)
  - **UPSTASH_REDIS_REST_TOKEN** (REST API token)
- Copy both values
- ⚠️ Keep these secure - you'll need them for Vercel

---

### STEP 3: Vercel Deployment (5 minutes)

**3.1 Import Project**
- URL: https://vercel.com/new?email=mgr%40tri-two.com&teamSlug=tri-twos-projects
- Click **Import** next to `TRI-TWO/seo-grader`
- Or search for "seo-grader" in the repository list

**3.2 Configure Project Settings**
- **Framework Preset:** Next.js (should auto-detect)
- **Root Directory:** `./` (default)
- **Build Command:** `npm run build` (default)
- **Output Directory:** `.next` (default)
- **Install Command:** `npm install` (default)
- Click **Continue**

**3.3 Add Environment Variables**
Click **Environment Variables** section and add these 5:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `SUPABASE_URL` | [From Step 1.3] | ✅ Production, ✅ Preview, ✅ Development |
| `SUPABASE_SERVICE_ROLE_KEY` | [From Step 1.3] | ✅ Production, ✅ Preview, ✅ Development |
| `UPSTASH_REDIS_REST_URL` | [From Step 2.2] | ✅ Production, ✅ Preview, ✅ Development |
| `UPSTASH_REDIS_REST_TOKEN` | [From Step 2.2] | ✅ Production, ✅ Preview, ✅ Development |
| `AUDIT_VERSION` | `1.0.0` | ✅ Production, ✅ Preview, ✅ Development |

**⚠️ CRITICAL:** Make sure to check all three environments for EACH variable!

**3.4 Deploy**
- Click **Deploy**
- Wait 2-3 minutes for build to complete
- Watch the build logs for any errors

**3.5 Verify Cron Job**
- After deployment, go to: **Settings** → **Cron Jobs**
- Should see: `/api/worker/process` scheduled every minute
- If not visible, wait a few minutes and refresh

---

### STEP 4: Test Deployment

**4.1 Test API Endpoints**

Replace `YOUR_APP_URL` with your Vercel deployment URL:

```bash
# Test states endpoint
curl https://YOUR_APP_URL.vercel.app/api/states

# Test worker endpoint (should return JSON)
curl -X POST https://YOUR_APP_URL.vercel.app/api/worker/process

# Create a test job
curl -X POST https://YOUR_APP_URL.vercel.app/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

**4.2 Test Frontend**
- Visit your Vercel deployment URL in browser
- Enter a test URL (e.g., `https://example.com`)
- Should redirect to report page
- Should show loading states and progress
- Should display results when complete

**4.3 Check Logs**
- Go to Vercel dashboard → **Functions** tab
- Check for any errors in `/api/worker/process` calls
- Check Supabase for job records
- Check Upstash for queue activity

---

## 🔧 Troubleshooting

### Build Fails
- Check Vercel build logs
- Verify all dependencies in `package.json`
- Ensure Node.js version is 18+ (Next.js 14 requirement)

### Jobs Stuck in "pending"
- Check Vercel Function Logs for errors
- Verify cron job is active (Settings → Cron Jobs)
- Check environment variables are set correctly
- Verify Supabase migration ran successfully

### Database Errors
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check Supabase project is active
- Run `SELECT * FROM audit_jobs LIMIT 1;` to verify table exists

### Redis Errors
- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are correct
- Check Upstash database is active
- Verify REST API is enabled

### Rate Limiting Issues
- Check Upstash Redis is responding
- Verify rate limit keys in Redis dashboard
- Adjust limits in `lib/upstash.ts` if needed

---

## ✅ Post-Deployment Checklist

- [ ] Supabase project created and migration run
- [ ] Supabase credentials obtained
- [ ] Upstash credentials obtained
- [ ] Vercel project deployed
- [ ] All 5 environment variables set
- [ ] Cron job active
- [ ] API endpoints responding
- [ ] Frontend working
- [ ] Test job completes successfully

---

## 🎯 Quick Links

- **Supabase:** https://supabase.com/dashboard
- **Upstash:** https://console.upstash.com/redis/8522183e-52da-49e0-b051-5ba484b5b5a1
- **Vercel:** https://vercel.com/new?email=mgr%40tri-two.com&teamSlug=tri-twos-projects
- **GitHub Repo:** https://github.com/TRI-TWO/seo-grader

---

## 📝 Environment Variables Summary

Copy this checklist when adding to Vercel:

```
✅ SUPABASE_URL = [from Supabase Settings > API]
✅ SUPABASE_SERVICE_ROLE_KEY = [from Supabase Settings > API > service_role]
✅ UPSTASH_REDIS_REST_URL = [from Upstash database page]
✅ UPSTASH_REDIS_REST_TOKEN = [from Upstash database page]
✅ AUDIT_VERSION = 1.0.0
```

**Remember:** Add each variable for Production, Preview, AND Development!

---

## 🚀 You're Ready!

Follow these steps in order, and you'll be live in ~12 minutes!

Good luck! 🎉




