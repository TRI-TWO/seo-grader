# Vercel Environment Variables Setup

## Required Environment Variables

Your application needs the following Supabase environment variables set in Vercel:

### Client-Side Variables (Required for browser)
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key

### Server-Side Variables (Optional, for admin operations)
- `SUPABASE_URL` - Your Supabase project URL (same as NEXT_PUBLIC_SUPABASE_URL)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (secret, server-only)

### Database
- `DATABASE_URL` - PostgreSQL connection string to Supabase

## How to Get Your Supabase Keys

1. **Go to Supabase Dashboard:**
   - Navigate to: https://supabase.com/dashboard/project/gvemjgcqehmdcltzzkef/settings/api

2. **Copy the Required Values:**
   - **Project URL** → Use for both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL`
     - Should be: `https://gvemjgcqehmdcltzzkef.supabase.co`
   - **anon public** key → Use for `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - This is the public key that's safe to expose in the browser
   - **service_role** key → Use for `SUPABASE_SERVICE_ROLE_KEY` (if needed)
     - ⚠️ **Keep this secret!** Never expose this in client-side code

## Setting Environment Variables in Vercel

### Option 1: Via Vercel Dashboard (Recommended)

1. **Go to your Vercel project:**
   - Navigate to: https://vercel.com/dashboard
   - Select your project: `seo-grader`

2. **Go to Settings → Environment Variables:**
   - Click on your project
   - Go to **Settings** tab
   - Click **Environment Variables** in the sidebar

3. **Add each variable:**
   For each variable, click **Add New** and enter:
   
   **Variable 1:**
   - **Key:** `NEXT_PUBLIC_SUPABASE_URL`
   - **Value:** `https://gvemjgcqehmdcltzzkef.supabase.co`
   - **Environment:** Select all (Production, Preview, Development)
   - Click **Save**

   **Variable 2:**
   - **Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value:** `[Your anon key from Supabase dashboard]`
   - **Environment:** Select all (Production, Preview, Development)
   - Click **Save**

   **Variable 3 (Optional - for server-side admin operations):**
   - **Key:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** `[Your service role key from Supabase dashboard]`
   - **Environment:** Select all (Production, Preview, Development)
   - Click **Save**

   **Variable 4 (Database connection):**
   - **Key:** `DATABASE_URL`
   - **Value:** `postgresql://postgres:WM335atxMD88@db.gvemjgcqehmdcltzzkef.supabase.co:5432/postgres?sslmode=require`
   - **Environment:** Select all (Production, Preview, Development)
   - Click **Save**

4. **Redeploy:**
   - After adding variables, go to **Deployments** tab
   - Click the **⋯** menu on the latest deployment
   - Click **Redeploy**
   - Or push a new commit to trigger a new deployment

### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Link your project (if not already linked)
vercel link

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add DATABASE_URL

# Pull environment variables to verify
vercel env pull .env.local
```

## Important Notes

1. **NEXT_PUBLIC_ prefix:**
   - Variables with `NEXT_PUBLIC_` prefix are exposed to the browser
   - Only use the **anon key** for `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Never** use the service role key with `NEXT_PUBLIC_` prefix

2. **After Adding Variables:**
   - You must **redeploy** your application for changes to take effect
   - Environment variables are only available after a new deployment

3. **Verification:**
   - After redeploying, check the browser console
   - The error should be gone
   - You should be able to use Supabase features

## Troubleshooting

### Error persists after adding variables:
- ✅ Verify variables are set for the correct environment (Production/Preview/Development)
- ✅ Make sure you redeployed after adding variables
- ✅ Check variable names are exact (case-sensitive)
- ✅ Verify the anon key is correct (copy from Supabase dashboard)

### "Invalid API key" error:
- Check that you're using the **anon public** key, not the service role key
- Verify the key hasn't been rotated in Supabase

### Variables not updating:
- Clear Vercel build cache
- Create a new deployment
- Check that variables are set for all environments

## Quick Checklist

- [ ] Got anon key from Supabase dashboard (Settings → API)
- [ ] Added `NEXT_PUBLIC_SUPABASE_URL` in Vercel
- [ ] Added `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel
- [ ] Set variables for all environments (Production, Preview, Development)
- [ ] Redeployed the application
- [ ] Verified error is gone in browser console



