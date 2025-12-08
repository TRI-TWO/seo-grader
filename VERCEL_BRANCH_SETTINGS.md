# Vercel Branch Settings - Alternative Methods

## Project API ID
`prj_h4hE07Q0yrTsmiLkig6XmwU4lgke`

## Method 1: Vercel Dashboard - Project Settings

The branch settings location may vary. Try these locations:

1. **Project Overview Page**
   - Go to your project dashboard
   - Look for "Production" or "Branch" dropdown near the top
   - May be next to the project name

2. **Settings → General**
   - Go to Settings → General (not Git)
   - Look for "Production Branch" or "Git Branch" setting

3. **Deployments Tab**
   - Go to Deployments
   - Click on a deployment
   - Look for branch settings or "Promote to Production"

## Method 2: Vercel CLI

You can change the branch using Vercel CLI:

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Link to project
vercel link

# Set production branch
vercel --prod
```

## Method 3: Vercel API

Use the Vercel API to update project settings:

```bash
# Update production branch via API
curl -X PATCH \
  'https://api.vercel.com/v9/projects/prj_h4hE07Q0yrTsmiLkig6XmwU4lgke' \
  -H 'Authorization: Bearer YOUR_VERCEL_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "git": {
      "productionBranch": "main"
    }
  }'
```

## Method 4: Redeploy from Main Branch

Instead of changing settings, you can:

1. Go to **Deployments** tab
2. Find a deployment from `main` branch (or trigger new one)
3. Click the three dots (⋯) on that deployment
4. Select **"Promote to Production"**

## Method 5: Create New Deployment

1. Go to **Deployments**
2. Click **"Create Deployment"** or **"Redeploy"**
3. Select branch: `main`
4. Deploy

## Quick Fix: Just Redeploy

Since `main` branch has all the fixes, the easiest solution:

1. Go to Vercel dashboard → Your project
2. Click **"Deployments"** tab
3. Click **"Create Deployment"** or find a `main` branch deployment
4. Select branch: `main`
5. Deploy

The `vercel.json` fix is in `main`, so deploying from `main` will work.

## Current Status

- ✅ `main` branch: Has all features + vercel.json fix
- ✅ `feature/tri-two-migration`: Now has vercel.json fix (but missing other features)
- ⚠️ Current deployment: From `feature/tri-two-migration`

## Recommended: Deploy from Main

The simplest solution is to create a new deployment from the `main` branch, which will automatically become production if it's the first deployment from that branch.

