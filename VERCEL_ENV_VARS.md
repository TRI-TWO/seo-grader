# Vercel Environment Variables - Ready to Deploy

## ✅ Credentials Collected

### Supabase
- **Service Role Key:** ✅ Received
- **Project URL:** ⚠️ Need correct URL (see below)

### Upstash Redis
- **REST URL:** ✅ `https://strong-starling-36587.upstash.io`
- **REST Token:** ✅ `AY7rAAIncDExNWIyNzRmZGE4MDA0YzA1YjNkMzgyZmFlY2E3OTBkY3AxMzY1ODc`

## ⚠️ Action Required: Get Correct Supabase Project URL

The Supabase URL you provided earlier was the settings page. You need the **Project URL** from the API settings.

**Steps:**
1. Go to: https://supabase.com/dashboard/project/gvemjgcqehmdcltzzkef/settings/api
2. Find **"Project URL"** section
3. It should look like: `https://gvemjgcqehmdcltzzkef.supabase.co`
4. Copy that URL

## 📋 Environment Variables for Vercel

Once you have the correct Supabase Project URL, add these 5 variables to Vercel:

### 1. SUPABASE_URL
```
[Get from: Settings → API → Project URL]
Should be: https://gvemjgcqehmdcltzzkef.supabase.co
```

### 2. SUPABASE_SERVICE_ROLE_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZW1qZ2NxZWhtZGNsdHp6a2VmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTE5MzAzNywiZXhwIjoyMDgwNzY5MDM3fQ.E9McOBf597NsfdFL_iZe5osGbcl82jg4mBRTxyxf404
```

### 3. UPSTASH_REDIS_REST_URL
```
https://strong-starling-36587.upstash.io
```

### 4. UPSTASH_REDIS_REST_TOKEN
```
AY7rAAIncDExNWIyNzRmZGE4MDA0YzA1YjNkMzgyZmFlY2E3OTBkY3AxMzY1ODc
```

### 5. AUDIT_VERSION
```
1.0.0
```

## ⚠️ IMPORTANT: Add for ALL Environments

When adding in Vercel, make sure to check:
- ✅ Production
- ✅ Preview
- ✅ Development

## ✅ Pre-Deployment Checklist

- [ ] Got correct Supabase Project URL (not settings page)
- [ ] Ran database migration in Supabase SQL Editor
- [ ] Have all 5 environment variables ready
- [ ] Ready to deploy to Vercel

## 🚀 Next Steps

1. **Get correct Supabase URL** (see above)
2. **Verify migration ran** (check Supabase SQL Editor)
3. **Deploy to Vercel:**
   - Go to: https://vercel.com/new?email=mgr%40tri-two.com&teamSlug=tri-twos-projects
   - Import `TRI-TWO/seo-grader`
   - Add all 5 environment variables (all 3 environments!)
   - Deploy

## 📝 Quick Copy-Paste for Vercel

Once you have the Supabase Project URL, you can copy these directly:

```
SUPABASE_URL=https://gvemjgcqehmdcltzzkef.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZW1qZ2NxZWhtZGNsdHp6a2VmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTE5MzAzNywiZXhwIjoyMDgwNzY5MDM3fQ.E9McOBf597NsfdFL_iZe5osGbcl82jg4mBRTxyxf404
UPSTASH_REDIS_REST_URL=https://strong-starling-36587.upstash.io
UPSTASH_REDIS_REST_TOKEN=AY7rAAIncDExNWIyNzRmZGE4MDA0YzA1YjNkMzgyZmFlY2E3OTBkY3AxMzY1ODc
AUDIT_VERSION=1.0.0
```

(Replace the SUPABASE_URL with the correct Project URL from API settings)



