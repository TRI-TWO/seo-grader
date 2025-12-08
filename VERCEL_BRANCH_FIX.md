# Vercel Branch Configuration Fix

## Issue
Vercel is deploying from `feature/tri-two-migration` branch which doesn't have the `vercel.json` fix.

## Solution

### Option 1: Change Vercel to Deploy from Main (Recommended)

1. Go to your Vercel project settings
2. Navigate to **Settings** → **Git**
3. Change **Production Branch** from `feature/tri-two-migration` to `main`
4. Save changes
5. Vercel will automatically redeploy from `main`

### Option 2: Keep Current Branch (Temporary Fix)

The `vercel.json` fix has been pushed to `feature/tri-two-migration` branch, so the next deployment should work.

However, **main branch has all features merged**, so Option 1 is recommended.

## Current Status

- ✅ `main` branch: Has all features + vercel.json fix
- ✅ `feature/tri-two-migration`: Now has vercel.json fix
- ⚠️ Vercel is currently deploying from `feature/tri-two-migration`

## Recommended Action

**Switch Vercel to deploy from `main` branch** - this ensures you get all the latest features and fixes.

## vercel.json Configuration

The correct `vercel.json` is:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/worker/process",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

This tells Vercel:
- Use Next.js framework
- Output directory is `.next` (not `public`)
- Build command is `npm run build`
- Set up cron job for worker

