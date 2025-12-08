# Supabase Credentials

## ✅ Service Role Key (Correct)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZW1qZ2NxZWhtZGNsdHp6a2VmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTE5MzAzNywiZXhwIjoyMDgwNzY5MDM3fQ.E9McOBf597NsfdFL_iZe5osGbcl82jg4mBRTxyxf404
```

## ⚠️ Need Correct Project URL

The URL you provided is the settings page. You need the **Project URL** from the API settings.

### How to Get the Correct SUPABASE_URL:

1. Go to: https://supabase.com/dashboard/project/gvemjgcqehmdcltzzkef/settings/api
   (Or: Settings → API in your project)

2. Look for **Project URL** section
   - It should look like: `https://gvemjgcqehmdcltzzkef.supabase.co`
   - This is your `SUPABASE_URL`

3. Copy that URL (not the settings page URL)

## Environment Variables for Vercel

Once you have the correct Project URL:

```
SUPABASE_URL = https://gvemjgcqehmdcltzzkef.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZW1qZ2NxZWhtZGNsdHp6a2VmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTE5MzAzNywiZXhwIjoyMDgwNzY5MDM3fQ.E9McOBf597NsfdFL_iZe5osGbcl82jg4mBRTxyxf404
```

## Next Steps

1. Get the correct Project URL from API settings
2. Run the database migration (if not done yet)
3. Get Upstash credentials
4. Deploy to Vercel with all environment variables

