# Deployment Guide - TRI-TWO SEO Grader

This guide walks you through deploying the SEO grader to production using Vercel, Supabase, and Upstash.

## Prerequisites

- GitHub account (TRI-TWO) with repository access
- Supabase account and project
- Upstash account and Redis database
- Vercel account
- Git configured with authentication

## Step 1: Push Feature Branches to GitHub

First, authenticate with GitHub. You can either:

**Option A: Use SSH (Recommended)**
```bash
# Check if you have SSH keys
ls -la ~/.ssh

# If not, generate one
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to GitHub: Settings > SSH and GPG keys > New SSH key
# Then update remote:
git remote set-url origin git@github.com:TRI-TWO/seo-grader.git
```

**Option B: Use Personal Access Token**
```bash
# GitHub will prompt for username and password/token
# Create token at: https://github.com/settings/tokens
# Scopes needed: repo
```

Then push all branches:
```bash
git push -u origin feature/tri-two-migration
git push -u origin feature/production-stack
git push -u origin feature/job-based-pipeline
git push -u origin feature/scrape-stages
git push -u origin feature/safety-timeouts
git push -u origin feature/caching-rate-limits
git push -u origin feature/frontend-job-flow
```

## Step 2: Set Up Supabase

1. **Create Supabase Project**
   - Go to https://supabase.com/dashboard
   - Create a new project
   - Note your project URL and service role key

2. **Run Database Migration**
   - Go to SQL Editor in Supabase dashboard
   - Copy contents of `supabase/migrations/001_audit_jobs.sql`
   - Paste and run in SQL Editor
   - Verify table was created: `SELECT * FROM audit_jobs LIMIT 1;`

3. **Get Credentials**
   - Project URL: Found in Settings > API > Project URL
   - Service Role Key: Found in Settings > API > service_role key (keep secret!)

## Step 3: Set Up Upstash Redis

1. **Create Redis Database**
   - Go to https://console.upstash.com/
   - Create a new Redis database
   - Choose region closest to your Vercel deployment

2. **Get Credentials**
   - REST URL: Found in database details
   - REST Token: Found in database details (keep secret!)

## Step 4: Deploy to Vercel

1. **Import Project**
   - Go to https://vercel.com/dashboard
   - Click "Add New" > "Project"
   - Import from GitHub: `TRI-TWO/seo-grader`
   - Select the `main` branch (or merge feature branches first)

2. **Configure Environment Variables**
   Add these in Vercel project settings > Environment Variables:

   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url
   UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token
   AUDIT_VERSION=1.0.0
   ```

   **Important:** Add these for all environments (Production, Preview, Development)

3. **Configure Vercel Cron**
   - The `vercel.json` file is already configured
   - Vercel will automatically set up the cron job
   - It will call `/api/worker/process` every minute
   - Verify in Vercel dashboard > Settings > Cron Jobs

4. **Deploy**
   - Vercel will automatically deploy on push to main
   - Or manually trigger deployment from dashboard
   - Wait for build to complete

## Step 5: Verify Deployment

1. **Check API Endpoints**
   - `https://your-app.vercel.app/api/states` - Should return states array
   - `https://your-app.vercel.app/api/worker/process` - Should return JSON (may be empty queue)

2. **Test Job Creation**
   ```bash
   curl -X POST https://your-app.vercel.app/api/audit \
     -H "Content-Type: application/json" \
     -d '{"url":"https://example.com"}'
   ```
   Should return: `{"jobId":"..."}`

3. **Test Job Status**
   ```bash
   curl https://your-app.vercel.app/api/audit/{jobId}
   ```
   Should return job status and results

4. **Test Frontend**
   - Visit `https://your-app.vercel.app`
   - Enter a URL and submit
   - Should redirect to report page with job polling

## Step 6: Monitor and Troubleshoot

1. **Vercel Logs**
   - Check Function Logs in Vercel dashboard
   - Look for errors in `/api/worker/process` calls

2. **Supabase Logs**
   - Check Database logs in Supabase dashboard
   - Verify jobs are being created and updated

3. **Upstash Metrics**
   - Check Redis metrics in Upstash dashboard
   - Verify queue operations are working

## Common Issues

**Issue: Jobs stuck in "pending"**
- Check Vercel cron is running (Settings > Cron Jobs)
- Verify `/api/worker/process` endpoint is accessible
- Check Vercel function logs for errors

**Issue: Rate limiting too aggressive**
- Adjust `RATE_LIMIT_MAX_REQUESTS` in `lib/upstash.ts`
- Or implement user authentication for higher limits

**Issue: Database connection errors**
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check Supabase project is active
- Verify network access (Supabase allows all IPs by default)

**Issue: Redis connection errors**
- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are correct
- Check Upstash database is active
- Verify REST API is enabled for your database

## Next Steps

1. **Merge Feature Branches**
   - Review each feature branch
   - Merge to `main` when ready
   - Vercel will auto-deploy on merge

2. **Set Up Custom Domain** (Optional)
   - Add domain in Vercel project settings
   - Configure DNS records as instructed

3. **Enable Monitoring** (Optional)
   - Set up Vercel Analytics
   - Configure error tracking (Sentry, etc.)
   - Set up uptime monitoring

## Branch Merge Order

When ready to merge to main, follow this order:

1. `feature/tri-two-migration` - Foundation
2. `feature/production-stack` - Dependencies
3. `feature/job-based-pipeline` - Core functionality
4. `feature/scrape-stages` - Stage verification
5. `feature/safety-timeouts` - Safety features
6. `feature/caching-rate-limits` - Performance
7. `feature/frontend-job-flow` - User experience

Or merge all at once if you prefer.

## Support

For issues or questions:
- Check Vercel logs first
- Review Supabase database for job states
- Check Upstash Redis for queue status
- Verify all environment variables are set correctly



