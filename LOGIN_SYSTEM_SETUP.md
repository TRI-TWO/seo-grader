# Login System Setup Guide - Supabase Auth

## Implementation Complete

The login system has been migrated to Supabase Auth with the following features:

- ✅ Supabase Auth for all authentication
- ✅ Login page at `/login`
- ✅ Password reset flow (handled by Supabase)
- ✅ Login tab added to navigation
- ✅ Paywall bypass for authenticated users
- ✅ Session management via Supabase
- ✅ User registration API endpoint

## Architecture

- **Authentication**: Supabase Auth (fully managed)
- **User Data**: Stored in Supabase `auth.users` table
- **User Roles**: Stored in `user_metadata.role` (ADMIN/VISITOR)
- **Business Data**: Prisma models reference Supabase user IDs

## Environment Variables Required

Add these to your `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: SendGrid for custom emails (Supabase handles password reset emails by default)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=mgr@tri-two.com

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres
```

### Getting Supabase Keys

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role key** (secret) → `SUPABASE_SERVICE_ROLE_KEY`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Database Migration

Run the Prisma migration to update the database schema:

```bash
npx prisma migrate dev --name migrate_to_supabase_auth
```

Or use `prisma db push` for development:

```bash
npx prisma db push --accept-data-loss
```

**Note**: This will remove the old NextAuth tables (`Account`, `Session`, `VerificationToken`) as they're now managed by Supabase.

The migration will:
- Remove `Account`, `Session`, `VerificationToken` tables
- Update `User` model to use Supabase UUIDs as IDs
- Remove `password` and `emailVerified` fields (handled by Supabase)

## Creating Initial Admin Account

To create the initial admin account (mgr@tri-two.com), use the Registration API:

```bash
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mgr@tri-two.com",
    "password": "your-secure-password",
    "role": "ADMIN"
  }'
```

This will:
1. Create the user in Supabase Auth with admin role in metadata
2. Create a corresponding User record in Prisma for business data linking

## Testing the Login System

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to login page:**
   - Go to http://localhost:3002/login
   - Or click "Login" in the navigation

3. **Test login:**
   - Enter email: `mgr@tri-two.com`
   - Enter password
   - Click "Login"
   - You should be redirected to the home page

4. **Test password reset:**
   - Click "Forgot your password?" on login page
   - Enter `mgr@tri-two.com`
   - Check email for reset link (or check server logs in development)
   - Follow the reset link and set a new password

5. **Test session persistence:**
   - Login and refresh the page
   - Session should persist
   - User menu should show your email

## API Endpoints

### Register User
```
POST /api/auth/register
Body: { "email": "user@example.com", "password": "password123", "role": "ADMIN" }
```

### Request Password Reset
```
POST /api/auth/reset-password
Body: { "email": "user@example.com" }
```

### Reset Password (with token)
```
POST /api/auth/reset-password/[token]
Body: { "password": "newpassword123" }
```

## Client-Side Usage

### Get Current User
```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
```

### Sign Out
```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
await supabase.auth.signOut()
```

### Listen to Auth Changes
```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session)
})
```

## Server-Side Usage

### Get Current User in API Routes
```typescript
import { createRouteHandlerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const authResult = await requireAuth()
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { user, role } = authResult
  // Use user and role...
}
```

### Check Admin Role
```typescript
import { requireAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Admin-only logic...
}
```

## User Roles

User roles are stored in Supabase `user_metadata.role`:
- `ADMIN` - Full access
- `VISITOR` - Standard user access

To get a user's role:
```typescript
import { getUserRole } from '@/lib/auth'

const role = getUserRole(user) // Returns 'ADMIN' or 'VISITOR'
```

## Password Reset Flow

Supabase handles password reset automatically:

1. User requests reset via `/api/auth/reset-password`
2. Supabase sends email with reset link
3. User clicks link and is redirected to `/reset-password`
4. User enters new password
5. Password is updated via Supabase Auth

## Troubleshooting

### "Missing Supabase environment variables" error
- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- These are required for client-side authentication

### "Database tables not initialized" error
- Run `npx prisma generate` to generate Prisma client
- Run `npx prisma db push` to sync schema with database

### Login not working
- Check that user exists in Supabase Auth (not just Prisma)
- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
- Check browser console for errors

### Session not persisting
- Ensure cookies are enabled
- Check that `NEXT_PUBLIC_SUPABASE_URL` matches your Supabase project URL

## Migration from NextAuth

If you're migrating from NextAuth:
1. ✅ All NextAuth dependencies removed
2. ✅ NextAuth route handler deleted
3. ✅ All components updated to use Supabase Auth
4. ✅ Prisma schema updated (auth models removed)
5. ⚠️ Run database migration to remove old auth tables
6. ⚠️ Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` to environment variables

## Notes

- Supabase Auth automatically handles email verification, password reset emails, and session management
- User roles are stored in `user_metadata.role` in Supabase
- Business models (AuditResult, CalendlyAppointment, etc.) reference Supabase user IDs
- No need to manage auth tables - Supabase handles everything
