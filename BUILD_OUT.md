# SEO Grader v3 - Complete Build & Deployment Guide

Complete guide for building, deploying, and setting up the SEO Grader v3 application with full Supabase integration.

---

## 🏗️ Prerequisites

### Required Tools
- **Node.js** 18+ (LTS recommended)
- **npm** or **yarn** package manager
- **Git** for version control
- **Supabase Account** for database and authentication
- **Vercel Account** for deployment (or local development)

### Required Accounts
- **Supabase**: Database, authentication, and storage
- **Vercel**: Hosting and serverless functions
- **OpenAI** (optional): For LLM features (Crimson, Midnight, Burnt)
- **SendGrid** (optional): For email functionality

---

## 📦 Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd seo-grader-v3-peach
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

This will:
- Install all npm packages
- Run `postinstall` script which generates Prisma client

### 3. Environment Variables Setup

Create a `.env.local` file in the root directory:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (Prisma)
DATABASE_URL=postgresql://user:password@host:port/database?schema=public

# Optional: Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Optional: Redis (Upstash - for async processing)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Optional: Worker Secret (for async processing)
WORKER_SECRET=your-random-secret-key

# Optional: OpenAI (for LLM features)
OPENAI_API_KEY=your-openai-api-key
```

---

## 🗄️ Database Setup

### 1. Supabase Setup

#### Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and API keys

#### Run Supabase Migrations

**Option A: Via Supabase SQL Editor**
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20241230140000_multi_tenant_schema.sql`
3. Paste and run in SQL Editor

**Option B: Via Supabase CLI**
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

#### Verify Tables
After running migrations, verify these tables exist:
- `profiles`
- `tenants`
- `tenant_memberships`
- `audits`
- `llm_runs`

All tables should have RLS enabled.

---

### 2. Prisma Setup

#### Generate Prisma Client

```bash
npx prisma generate
```

This creates the Prisma Client based on `prisma/schema.prisma`.

#### Run Prisma Migrations

**Development:**
```bash
npx prisma migrate dev
```

This will:
- Create migration files
- Apply migrations to database
- Generate Prisma Client

**Production:**
```bash
npx prisma migrate deploy
```

#### Verify Prisma Connection

```bash
npx prisma studio
```

Opens Prisma Studio to view and edit database data.

---

## 🔐 Authentication Setup

### 1. Supabase Auth Configuration

#### Enable Email/Password Auth
1. Go to Supabase Dashboard → Authentication → Providers
2. Enable "Email" provider
3. Configure email templates (optional)

#### Configure Email Settings
1. Go to Authentication → Email Templates
2. Customize templates (optional)
3. Set up SMTP (optional, uses Supabase default)

#### Test Authentication

```bash
# Start development server
npm run dev

# Navigate to /login
# Try registering a new user
```

---

### 2. Create Admin User

**Option A: Via Supabase Dashboard**
1. Go to Authentication → Users
2. Create new user
3. Note the user ID (UUID)

**Option B: Via Prisma**
```bash
npx prisma studio
# Navigate to User table
# Create user with role = ADMIN
```

**Option C: Via SQL**
```sql
-- First, create user in Supabase Auth (via dashboard or API)
-- Then update Prisma User table
UPDATE "User" SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

---

## 🏃 Local Development

### 1. Start Development Server

```bash
npm run dev
```

Server will start at `http://localhost:3000`

### 2. Verify Setup

1. **Home Page**: Navigate to `http://localhost:3000`
2. **Login**: Navigate to `http://localhost:3000/login`
3. **Admin Dashboard**: Navigate to `http://localhost:3000/admin` (requires admin role)

### 3. Test Audit Flow

1. Go to home page
2. Enter a URL (e.g., `https://example.com`)
3. Submit and wait for results (~15-25 seconds)
4. Verify results display on report page

---

## 🚀 Production Deployment

### 1. Vercel Setup

#### Connect Repository
1. Go to [vercel.com](https://vercel.com)
2. Import your Git repository
3. Configure project settings

#### Environment Variables
Add all environment variables in Vercel Dashboard:
- Go to Project Settings → Environment Variables
- Add all variables from `.env.local`
- Apply to: Production, Preview, Development

**Required Variables:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
```

**Optional Variables:**
```
SENDGRID_API_KEY
SENDGRID_FROM_EMAIL
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
WORKER_SECRET
OPENAI_API_KEY
```

#### Build Settings
- **Framework Preset**: Next.js
- **Build Command**: `prisma generate && next build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

#### Deploy
1. Push to main branch (auto-deploys)
2. Or manually deploy from Vercel Dashboard

---

### 2. Database Migrations (Production)

#### Prisma Migrations
```bash
# On production server or locally with production DATABASE_URL
npx prisma migrate deploy
```

#### Supabase Migrations
1. Go to Supabase Dashboard → SQL Editor
2. Run migration SQL from `supabase/migrations/`
3. Or use Supabase CLI:
```bash
supabase db push --db-url $DATABASE_URL
```

---

### 3. Verify Deployment

1. **Home Page**: Check `https://your-app.vercel.app`
2. **API Endpoints**: Test `/api/audit` endpoint
3. **Authentication**: Test login/register flow
4. **Admin Dashboard**: Verify admin access

---

## 🔧 Configuration

### 1. Scoring Configuration

Edit `lib/scoring-config.json` to adjust:
- Scoring weights
- Status thresholds
- Service keywords
- Length constraints

No rebuild required for changes (JSON is loaded at runtime).

---

### 2. Vercel Configuration

Edit `vercel.json` for:
- Cron job schedules
- Function timeouts
- Redirects
- Headers

---

### 3. Next.js Configuration

Edit `next.config.js` for:
- Environment variables
- Image domains
- Redirects
- Headers

---

## 🧪 Testing

### 1. Manual Testing

**Audit Flow:**
1. Submit URL on home page
2. Wait for results (~15-25 seconds)
3. Verify scores display correctly
4. Check report page

**Authentication:**
1. Register new user
2. Login with credentials
3. Verify session persists
4. Test password reset

**Admin Features:**
1. Login as admin
2. Access admin dashboard
3. Test Crimson, Midnight, Burnt endpoints
4. Verify chained flows

---

### 2. API Testing

**Test Audit Endpoint:**
```bash
curl -X POST https://your-app.vercel.app/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

**Test Authentication:**
```bash
# Register
curl -X POST https://your-app.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Prisma Client Not Generated
```bash
# Solution: Run generate command
npx prisma generate
```

#### 2. Database Connection Errors
- Verify `DATABASE_URL` is correct
- Check Supabase project is active
- Verify network access

#### 3. Supabase Auth Not Working
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Check Supabase project settings
- Verify email provider is enabled

#### 4. Build Failures
- Check Node.js version (18+)
- Verify all environment variables are set
- Check for TypeScript errors: `npm run lint`

#### 5. RLS Policy Errors
- Verify RLS policies are created
- Check user has tenant membership
- Verify helper functions exist

---

## 📊 Monitoring

### 1. Vercel Logs
- Go to Vercel Dashboard → Project → Logs
- View function execution logs
- Check for errors

### 2. Supabase Logs
- Go to Supabase Dashboard → Logs
- View database queries
- Check authentication logs

### 3. Error Tracking
- Set up Sentry (optional)
- Monitor console errors
- Track API errors

---

## 🔄 Updates & Maintenance

### 1. Update Dependencies
```bash
npm update
# or
yarn upgrade
```

### 2. Database Migrations
```bash
# Create new migration
npx prisma migrate dev --name migration_name

# Apply to production
npx prisma migrate deploy
```

### 3. Supabase Migrations
1. Create SQL file in `supabase/migrations/`
2. Run in Supabase SQL Editor
3. Commit to repository

---

## 📝 Checklist

### Initial Setup
- [ ] Clone repository
- [ ] Install dependencies
- [ ] Set up environment variables
- [ ] Create Supabase project
- [ ] Run Supabase migrations
- [ ] Run Prisma migrations
- [ ] Generate Prisma client
- [ ] Create admin user
- [ ] Test local development

### Production Deployment
- [ ] Connect repository to Vercel
- [ ] Set environment variables in Vercel
- [ ] Configure build settings
- [ ] Deploy to production
- [ ] Run production migrations
- [ ] Verify deployment
- [ ] Test all features
- [ ] Set up monitoring

### Post-Deployment
- [ ] Test audit flow
- [ ] Test authentication
- [ ] Test admin features
- [ ] Verify RLS policies
- [ ] Check error logs
- [ ] Monitor performance

---

## 🎯 Quick Start Commands

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations (development)
npx prisma migrate dev

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Open Prisma Studio
npx prisma studio
```

---

## 📚 Additional Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **Vercel Docs**: https://vercel.com/docs

---

## 📝 Summary

This build guide covers:
- ✅ Complete setup process
- ✅ Database configuration (Supabase + Prisma)
- ✅ Authentication setup
- ✅ Local development
- ✅ Production deployment
- ✅ Troubleshooting
- ✅ Maintenance

Follow this guide step-by-step to get your SEO Grader v3 application up and running with full Supabase integration.

