# 🚀 Deploy Now - Final Checklist

## ✅ Pre-Deployment Checklist

All code is ready! You just need to:

### 1. Push Branches to GitHub

**Option A: Use the script (recommended)**
```bash
./.github/PUSH_BRANCHES.sh
```

**Option B: Push manually**
```bash
git push -u origin feature/tri-two-migration
git push -u origin feature/production-stack
git push -u origin feature/job-based-pipeline
git push -u origin feature/scrape-stages
git push -u origin feature/safety-timeouts
git push -u origin feature/caching-rate-limits
git push -u origin feature/frontend-job-flow
```

**If authentication fails:**
- Set up SSH: `git remote set-url origin git@github.com:TRI-TWO/seo-grader.git`
- Or use Personal Access Token when prompted

### 2. Supabase Setup (5 minutes)

1. **Create Project**
   - Go to: https://supabase.com/dashboard/new/ajkydjfettrllybxccjn?projectName=TRI-TWO%27s%20Project
   - Click "Create new project"
   - Wait ~2 minutes for setup

2. **Run Migration**
   - Go to SQL Editor
   - Copy entire contents of `SUPABASE_MIGRATION.sql`
   - Paste and click "Run"
   - Should see: "audit_jobs table created successfully!"

3. **Get Credentials**
   - Settings > API
   - Copy **Project URL** → This is `SUPABASE_URL`
   - Copy **service_role** key (the secret one) → This is `SUPABASE_SERVICE_ROLE_KEY`

### 3. Upstash Redis Setup (2 minutes)

1. **Access Database**
   - Go to: https://console.upstash.com/redis/8522183e-52da-49e0-b051-5ba484b5b5a1?teamid=0
   - Database is already created!

2. **Get Credentials**
   - Find **UPSTASH_REDIS_REST_URL** (should be visible on the page)
   - Find **UPSTASH_REDIS_REST_TOKEN** (should be visible on the page)

### 4. Vercel Deployment (5 minutes)

1. **Import Project**
   - Go to: https://vercel.com/new?email=mgr%40tri-two.com&teamSlug=tri-twos-projects
   - Click "Import" next to `TRI-TWO/seo-grader`
   - Or search for the repository

2. **Configure Environment Variables**
   In the "Environment Variables" section, add:

   | Variable Name | Value Source |
   |--------------|--------------|
   | `SUPABASE_URL` | From Supabase Settings > API > Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | From Supabase Settings > API > service_role key |
   | `UPSTASH_REDIS_REST_URL` | From Upstash database page |
   | `UPSTASH_REDIS_REST_TOKEN` | From Upstash database page |
   | `AUDIT_VERSION` | `1.0.0` |

   **⚠️ IMPORTANT:** Check all three environments:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

3. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes for build
   - Vercel will automatically set up the cron job from `vercel.json`

4. **Verify Cron Job**
   - Go to Settings > Cron Jobs
   - Should see: `/api/worker/process` scheduled every minute

### 5. Test Deployment

Once deployed, test with:

```bash
# Replace YOUR_APP_URL with your Vercel deployment URL
YOUR_APP_URL="https://your-app.vercel.app"

# Test states endpoint
curl $YOUR_APP_URL/api/states

# Test creating a job
curl -X POST $YOUR_APP_URL/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'

# Visit in browser
open $YOUR_APP_URL
```

## 🎯 Quick Reference

**Files Ready:**
- ✅ `vercel.json` - Cron configuration
- ✅ `SUPABASE_MIGRATION.sql` - Database setup
- ✅ All feature branches committed
- ✅ Environment variables documented

**What Happens After Deployment:**
1. Vercel builds and deploys your app
2. Cron job starts calling `/api/worker/process` every minute
3. Jobs are queued in Upstash Redis
4. Worker processes jobs and stores results in Supabase
5. Frontend polls for job status and displays results

## 🆘 Troubleshooting

**Build fails?**
- Check Vercel build logs
- Verify all dependencies in `package.json`
- Ensure Node.js version is compatible (Next.js 14 requires Node 18+)

**Jobs not processing?**
- Check Vercel Function Logs
- Verify cron job is active (Settings > Cron Jobs)
- Check environment variables are set correctly
- Verify Supabase migration ran successfully

**Database errors?**
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check Supabase project is active
- Run `SELECT * FROM audit_jobs LIMIT 1;` in Supabase SQL Editor to verify table exists

**Redis errors?**
- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are correct
- Check Upstash database is active
- Verify REST API is enabled for your database

## ✅ You're Ready!

All code is committed and ready. Just:
1. Push branches (with authentication)
2. Set up Supabase (run migration)
3. Get Upstash credentials
4. Deploy to Vercel (add env vars)
5. Test!

Good luck! 🚀



