# 🚀 Final Deployment Steps

## ✅ Completed
- ✅ All 7 feature branches pushed to GitHub
- ✅ SSH key configured and working
- ✅ Code ready for deployment

## 📋 Remaining Steps

### 1. Supabase Setup (5 minutes)

**Create Project:**
- Go to: https://supabase.com/dashboard/new/ajkydjfettrllybxccjn?projectName=TRI-TWO%27s%20Project
- Click "Create new project"
- Wait ~2 minutes for setup

**Run Migration:**
1. Go to **SQL Editor** in Supabase dashboard
2. Copy entire contents of `SUPABASE_MIGRATION.sql`
3. Paste into SQL Editor
4. Click **Run**
5. Should see: "audit_jobs table created successfully!"

**Get Credentials:**
- Go to **Settings > API**
- Copy **Project URL** → `SUPABASE_URL`
- Copy **service_role** key (the secret one) → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Upstash Redis (2 minutes)

**Get Credentials:**
- Go to: https://console.upstash.com/redis/8522183e-52da-49e0-b051-5ba484b5b5a1?teamid=0
- Database is already created!
- Copy **UPSTASH_REDIS_REST_URL**
- Copy **UPSTASH_REDIS_REST_TOKEN**

### 3. Vercel Deployment (5 minutes)

**Import Project:**
- Go to: https://vercel.com/new?email=mgr%40tri-two.com&teamSlug=tri-twos-projects
- Click **Import** next to `TRI-TWO/seo-grader`
- Or search for the repository

**Configure:**
- Framework: **Next.js** (auto-detected)
- Root Directory: `./` (default)
- Build Command: `npm run build` (default)
- Output Directory: `.next` (default)

**Add Environment Variables:**
Click "Environment Variables" and add these 5:

| Variable | Value Source |
|----------|-------------|
| `SUPABASE_URL` | From Supabase Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase Settings > API (service_role key) |
| `UPSTASH_REDIS_REST_URL` | From Upstash database page |
| `UPSTASH_REDIS_REST_TOKEN` | From Upstash database page |
| `AUDIT_VERSION` | `1.0.0` |

**⚠️ IMPORTANT:** Add for all environments:
- ✅ Production
- ✅ Preview
- ✅ Development

**Deploy:**
- Click **Deploy**
- Wait 2-3 minutes for build
- Vercel will automatically detect `vercel.json` and set up cron job

**Verify Cron:**
- Go to **Settings > Cron Jobs**
- Should see: `/api/worker/process` scheduled every minute

### 4. Test Deployment

```bash
# Replace with your Vercel URL
YOUR_APP="https://your-app.vercel.app"

# Test states
curl $YOUR_APP/api/states

# Create a job
curl -X POST $YOUR_APP/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'

# Visit in browser
open $YOUR_APP
```

## 🎯 Quick Links

- **Supabase:** https://supabase.com/dashboard
- **Upstash:** https://console.upstash.com/redis/8522183e-52da-49e0-b051-5ba484b5b5a1
- **Vercel:** https://vercel.com/new?email=mgr%40tri-two.com&teamSlug=tri-twos-projects
- **GitHub Repo:** https://github.com/TRI-TWO/seo-grader

## 📝 Files Reference

- `SUPABASE_MIGRATION.sql` - Copy/paste into Supabase SQL Editor
- `vercel.json` - Already configured (cron will auto-setup)
- `DEPLOY_NOW.md` - Detailed deployment guide

## ✅ You're Almost There!

Just complete the 3 steps above and you'll be live! 🚀



