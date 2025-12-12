# Supabase Connection Setup Guide

## Current Status

✅ Supabase client installed and configured  
✅ Environment variables added to .env  
✅ DATABASE_URL updated with Supabase PostgreSQL connection string  
✅ Connection tested successfully - Prisma can connect to Supabase  
✅ Full Prisma schema restored with all models  
✅ Prisma Client generated

## Environment Variables Added

The following have been added to your `.env` file:

```
SUPABASE_URL=https://gvemjgcqehmdcltzzkef.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZW1qZ2NxZWhtZGNsdHp6a2VmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTE5MzAzNywiZXhwIjoyMDgwNzY5MDM3fQ.E9McOBf597NsfdFL_iZe5osGbcl82jg4mBRTxyxf404
```

## Get Supabase PostgreSQL Connection String

To connect Prisma to Supabase, you need the direct PostgreSQL connection string:

### Steps:

1. **Go to Supabase Dashboard:**
   - Navigate to: https://supabase.com/dashboard/project/gvemjgcqehmdcltzzkef/settings/database

2. **Find Connection String:**
   - Scroll to "Connection string" section
   - Look for "URI" or "Connection pooling" tab
   - You'll see connection parameters or a connection string

3. **Connection String Format:**
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
   
   OR for direct connection (better for Prisma):
   ```
   postgresql://postgres:[PASSWORD]@db.gvemjgcqehmdcltzzkef.supabase.co:5432/postgres?sslmode=require
   ```

4. **Get Database Password:**
   - If you don't have the password, you can reset it in Supabase dashboard
   - Go to Settings → Database → Database password
   - Click "Reset database password" if needed

5. **Update DATABASE_URL in .env:**
   - Replace the current DATABASE_URL (Prisma Accelerate format) with the Supabase PostgreSQL connection string
   - Use the direct connection format (port 5432) for Prisma

### Example .env Entry:

```bash
# Connection string has been configured (password updated)
DATABASE_URL="postgresql://postgres:WM335atxMD88@db.gvemjgcqehmdcltzzkef.supabase.co:5432/postgres?sslmode=require"
```

**⚠️ Important:** If you're getting authentication errors, get the **exact connection string** from your Supabase dashboard:

1. Go to: https://supabase.com/dashboard/project/gvemjgcqehmdcltzzkef/settings/database
2. Click the **"Connect"** button at the top
3. Select the appropriate connection method:
   - **Direct connection** (if your environment supports IPv6)
   - **Session pooler** (recommended if IPv6 is not available - supports IPv4)
   - **Transaction pooler** (for serverless/edge functions)
4. Copy the exact connection string provided
5. Update `DATABASE_URL` in `.env` with the copied string

**Note:** Direct connections use IPv6 by default. If your local environment doesn't support IPv6, use the **Session pooler** connection string instead.

## After Updating DATABASE_URL

1. **Run Prisma Migration:**
   ```bash
   npx prisma migrate dev --name connect_to_supabase
   ```
   
   This will create all tables in Supabase:
   - User, Account, Session, VerificationToken (auth)
   - AuditResult, CalendlyAppointment, SubscriptionPlan, UserSubscription (business)
   - AuditJob (job tracking)

2. **Verify Connection:**
   ```bash
   npx prisma db pull
   ```
   
   This will verify Prisma can connect to Supabase.

3. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

## Testing the Connection

Once DATABASE_URL is updated, you can test:

```typescript
// In any API route or server component
import { prisma } from '@/lib/prisma';

// Test query
const users = await prisma.user.findMany();
console.log('Connected to Supabase! Users:', users);
```

## Supabase Client Usage

The Supabase client is available for direct database operations:

```typescript
import { supabase } from '@/lib/supabase';

// Example: Direct query
const { data, error } = await supabase
  .from('audit_jobs')
  .select('*')
  .limit(10);
```

## Notes

- **Prisma** will handle all ORM operations (recommended for most use cases)
- **Supabase Client** is available for direct queries, real-time subscriptions, or storage operations
- Both connect to the same Supabase PostgreSQL database
- Authentication models use Prisma (User, Account, Session, VerificationToken)
- All data is stored in Supabase PostgreSQL

## Troubleshooting

### "Connection refused" error:
- Verify DATABASE_URL is correct
- Check database password is correct
- Ensure Supabase project is active
- Try using connection pooling URL instead of direct connection

### "SSL required" error:
- Add `?sslmode=require` to connection string
- Supabase requires SSL for connections

### Migration fails:
- Verify DATABASE_URL format is correct
- Check you have permissions to create tables
- Ensure database is not in maintenance mode
