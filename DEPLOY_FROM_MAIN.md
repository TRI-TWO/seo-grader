# Deploy from Main Branch in Vercel

## Current Situation
- Vercel is deploying from `feature/tri-two-migration` branch
- `main` branch has all features merged and the `vercel.json` fix
- Need to deploy from `main` instead

## Solution: Create New Deployment from Main

### Step-by-Step:

1. **Cancel the current redeploy dialog** (if open)

2. **Go to Deployments Tab**
   - In your Vercel project dashboard
   - Click on "Deployments" in the top navigation

3. **Create New Deployment**
   - Look for a button: "Create Deployment", "Deploy", or "+" icon
   - Click it

4. **Select Branch**
   - In the deployment dialog, you should see a branch selector
   - Change from `feature/tri-two-migration` to `main`
   - Or type `main` in the branch field

5. **Deploy**
   - Click "Deploy" or "Create Deployment"
   - This will create a new deployment from `main` branch
   - It will automatically become production if it's the first deployment from `main`

## Alternative: Use Vercel CLI

If the UI doesn't show branch options clearly:

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login
vercel login

# Link to project (will ask for project)
vercel link

# Deploy from main branch to production
vercel --prod --branch main
```

## Why Main Branch?

- ✅ Has all 7 feature branches merged
- ✅ Has the `vercel.json` fix for output directory
- ✅ Has all production code ready
- ✅ Will build successfully

## After Deployment

Once deployed from `main`:
1. The build should succeed (vercel.json is configured)
2. Cron job will auto-setup
3. Add environment variables if not already set
4. Test the deployment

## Environment Variables Needed

Make sure these are set in Vercel:
- `SUPABASE_URL` (get from Supabase API settings)
- `SUPABASE_SERVICE_ROLE_KEY` ✅ (you have this)
- `UPSTASH_REDIS_REST_URL` ✅ (you have this)
- `UPSTASH_REDIS_REST_TOKEN` ✅ (you have this)
- `AUDIT_VERSION` = `1.0.0`



