# Quick Deployment Checklist

## ✅ Step 1: Supabase Setup

1. **Create Project** at: https://supabase.com/dashboard/new/ajkydjfettrllybxccjn?projectName=TRI-TWO%27s%20Project
   - Click "Create new project"
   - Wait for project to be ready (~2 minutes)

2. **Run Database Migration**
   - Go to SQL Editor in Supabase dashboard
   - Copy and paste the SQL from `supabase/migrations/001_audit_jobs.sql`
   - Click "Run" to execute
   - Verify: Run `SELECT * FROM audit_jobs LIMIT 1;` (should return empty result, no error)

3. **Get Credentials**
   - Go to Settings > API
   - Copy **Project URL** → `SUPABASE_URL`
   - Copy **service_role** key (secret) → `SUPABASE_SERVICE_ROLE_KEY`

## ✅ Step 2: Upstash Redis Setup

1. **Access Database** at: https://console.upstash.com/redis/8522183e-52da-49e0-b051-5ba484b5b5a1?teamid=0
   - Database is already created!

2. **Get Credentials**
   - Find **UPSTASH_REDIS_REST_URL** (REST API endpoint)
   - Find **UPSTASH_REDIS_REST_TOKEN** (REST API token)
   - Both should be visible on the database page

## ✅ Step 3: Push Branches to GitHub

Run this command (you'll need to authenticate):
```bash
./.github/PUSH_BRANCHES.sh
```

Or push manually:
```bash
git push -u origin feature/tri-two-migration
git push -u origin feature/production-stack
git push -u origin feature/job-based-pipeline
git push -u origin feature/scrape-stages
git push -u origin feature/safety-timeouts
git push -u origin feature/caching-rate-limits
git push -u origin feature/frontend-job-flow
```

## ✅ Step 4: Deploy to Vercel

1. **Import Project** at: https://vercel.com/new?email=mgr%40tri-two.com&teamSlug=tri-twos-projects
   - Click "Import" next to `TRI-TWO/seo-grader`
   - Or search for the repository

2. **Configure Project**
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)

3. **Add Environment Variables**
   Click "Environment Variables" and add:
   
   ```
   SUPABASE_URL = [from Step 1]
   SUPABASE_SERVICE_ROLE_KEY = [from Step 1]
   UPSTASH_REDIS_REST_URL = [from Step 2]
   UPSTASH_REDIS_REST_TOKEN = [from Step 2]
   AUDIT_VERSION = 1.0.0
   ```
   
   **Important:** Add these for all environments:
   - ✅ Production
   - ✅ Preview  
   - ✅ Development

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (~2-3 minutes)
   - Vercel will automatically detect `vercel.json` and set up the cron job

5. **Verify Cron Job**
   - Go to Settings > Cron Jobs
   - Should see: `/api/worker/process` running every minute

## ✅ Step 5: Test Deployment

1. **Test API Endpoints**
   ```bash
   # Test states endpoint
   curl https://your-app.vercel.app/api/states
   
   # Test worker endpoint
   curl -X POST https://your-app.vercel.app/api/worker/process
   
   # Create a job
   curl -X POST https://your-app.vercel.app/api/audit \
     -H "Content-Type: application/json" \
     -d '{"url":"https://example.com"}'
   ```

2. **Test Frontend**
   - Visit your Vercel deployment URL
   - Enter a URL (e.g., `https://example.com`)
   - Should redirect to report page and show progress

## 🔧 Troubleshooting

**Jobs stuck in "pending"?**
- Check Vercel Function Logs for errors
- Verify cron job is running (Settings > Cron Jobs)
- Check environment variables are set correctly

**Database errors?**
- Verify Supabase migration ran successfully
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Ensure Supabase project is active

**Redis errors?**
- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are correct
- Check Upstash database is active
- Ensure REST API is enabled

## 📝 Next Steps After Deployment

1. **Merge Feature Branches to Main** (when ready)
   - Review each branch
   - Merge via GitHub PR or directly
   - Vercel will auto-deploy on merge

2. **Set Up Custom Domain** (optional)
   - Add in Vercel project settings
   - Configure DNS as instructed

3. **Monitor**
   - Check Vercel Analytics
   - Monitor function logs
   - Watch Supabase database for job states

