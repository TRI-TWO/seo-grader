# SEO Grader v3 - Complete Architecture Documentation

Complete architecture documentation covering system overview, infrastructure, patterns, deployment, and full Supabase integration.

---

## 🏗️ Architecture Overview

**SEO Grader v3** is a **Next.js 14** application built on a **serverless architecture** hosted on **Vercel**. The system performs comprehensive SEO audits through a **3-stage synchronous processing pipeline**, with infrastructure available for asynchronous job-based processing. The system uses **Supabase** for authentication, database, and multi-tenant organization management.

### Architecture Principles

1. **Serverless-First** - Vercel serverless functions for scalability
2. **Type-Safe** - TypeScript throughout for reliability
3. **Database-Agnostic** - Prisma ORM + Supabase PostgreSQL
4. **Multi-Tenant** - Supabase RLS for tenant isolation
5. **Modular Design** - Separated concerns, reusable components
6. **Performance-Optimized** - Timeout protection, efficient processing

---

## 🎯 Current Architecture (Synchronous)

### Primary Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                           │
│                  (Next.js Frontend)                         │
│                                                              │
│  ┌──────────────┐              ┌──────────────┐            │
│  │  Home Page   │              │ Report Page  │            │
│  │  (page.tsx)  │─────────────▶│(report/page) │            │
│  └──────┬───────┘              └──────────────┘            │
│         │                                                     │
│         │ POST /api/audit                                    │
│         │ { url: "..." }                                    │
│         ▼                                                     │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              VERCEL API ROUTE                                │
│         POST /api/audit (route.ts)                           │
│                                                              │
│  • Validates URL                                            │
│  • Executes 3-stage audit synchronously                     │
│  • Returns complete results                                 │
│  • 25-second timeout                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│          AUDIT PROCESSING ENGINE                            │
│         (lib/auditStagesSync.ts)                            │
│                                                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Stage 1: Fast Pass (10s timeout)                    │  │
│  │ • Fetch HTML from URL                                │  │
│  │ • Parse title, meta, H1, word count                  │  │
│  │ • Fetch robots.txt, sitemap.xml                     │  │
│  └────────────────────────────────────────────────────┘  │
│                        │                                     │
│                        ▼                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Stage 2: Structure + Media                          │  │
│  │ • Extract media metrics                             │  │
│  │ • Calculate title score (lib/scoring.ts)             │  │
│  │ • Calculate media score (lib/scoring.ts)            │  │
│  │ • Calculate technical score                         │  │
│  │ • Calculate overall SEO score                        │  │
│  └────────────────────────────────────────────────────┘  │
│                        │                                     │
│                        ▼                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Stage 3: AI Optimization (8s timeout)              │  │
│  │ • Structured answers readiness                      │  │
│  │ • Entity clarity                                    │  │
│  │ • Extraction readiness                              │  │
│  │ • Context completeness                              │  │
│  │ • Trust signals                                     │  │
│  │ • Machine readability                               │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE DATABASE                               │
│                                                              │
│  • Store audit results (optional)                           │
│  • User authentication                                      │
│  • Multi-tenant organization data                          │
│  • LLM run tracking                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏛️ Infrastructure Components

### 1. Frontend Layer

**Technology:** Next.js 14 App Router, React 18, TypeScript

**Components:**
- **Pages**: Route components (`app/**/page.tsx`)
- **API Routes**: Serverless functions (`app/api/**/route.ts`)
- **Components**: Reusable UI (`app/components/*.tsx`)
- **Layouts**: Shared layouts (`app/layout.tsx`)

**Features:**
- Server-side rendering (SSR)
- Static site generation (SSG)
- Client-side interactivity
- Automatic code splitting

---

### 2. Backend Layer

**Technology:** Vercel Serverless Functions, Node.js

**API Endpoints:**
- `POST /api/audit` - Primary audit endpoint (synchronous)
- `GET /api/scrape` - HTML scraping utility
- `GET /api/states` - US states data
- `POST /api/auth/register` - User registration
- `POST /api/auth/reset-password` - Password reset
- `POST /api/llm/crimson` - Crimson content optimization
- `POST /api/llm/midnight` - Midnight homepage structure
- `POST /api/llm/burnt/score` - Burnt action scoring
- `POST /api/llm/burnt/orchestrate` - Burnt full orchestration

**Function Characteristics:**
- **Timeout**: 25 seconds (synchronous endpoint), 120 seconds (orchestration)
- **Runtime**: Node.js 18+
- **Memory**: Vercel default (1GB)
- **Cold Start**: ~100-500ms

---

### 3. Database Layer

**Technology:** Supabase PostgreSQL, Prisma ORM

#### Supabase Connection

**Connection Methods:**
- **Browser Client**: `lib/supabase/client.ts` - Client-side auth and queries
- **Server Client**: `lib/supabase/server.ts` - Server-side auth and queries
- **Middleware Client**: `lib/supabase/middleware.ts` - Middleware auth
- **Service Role**: `lib/supabase.ts` - Admin operations (server-side only)

**Environment Variables:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://... # Prisma connection string
```

#### Supabase Schema Structure

**Multi-Tenant Tables:**
- **`profiles`**: Extended user profiles (extends `auth.users`)
- **`tenants`**: Organization/tenant records
- **`tenant_memberships`**: User-tenant relationships with roles
- **`audits`**: Tenant-scoped audit records
- **`llm_runs`**: LLM execution tracking per tenant

**Prisma Models:**
- **`User`**: Links to Supabase `auth.users` via UUID
- **`AuditResult`**: Historical audit results
- **`AuditJob`**: Job queue for async processing
- **`CalendlyAppointment`**: Appointment tracking
- **`SubscriptionPlan`**: Subscription plans
- **`UserSubscription`**: User subscriptions

**Features:**
- Row Level Security (RLS) on all Supabase tables
- Automatic migrations (Prisma + Supabase SQL)
- Type-safe queries (Prisma + Supabase TypeScript)
- Connection pooling
- Multi-tenant isolation via RLS policies

---

### 4. Authentication Layer

**Technology:** Supabase Auth, @supabase/ssr

**Components:**
- **Browser Client**: `lib/supabase/client.ts` - Client-side auth
- **Server Client**: `lib/supabase/server.ts` - Server-side auth
- **Middleware Client**: `lib/supabase/middleware.ts` - Middleware auth
- **Tenant Utilities**: `lib/supabase/tenants.ts` - Tenant management

**Flow:**
1. User registers/logs in via Supabase Auth
2. Session stored in cookies (httpOnly, secure)
3. Client components access session via `createClient()` from `lib/supabase/client.ts`
4. Server components access session via `createClient()` from `lib/supabase/server.ts`
5. RLS policies enforce data access based on tenant membership
6. Tenant utilities manage multi-tenant relationships

**Authentication Features:**
- Email/password authentication
- Session management via cookies
- JWT tokens for API access
- Password reset flow
- Multi-tenant role-based access (admin/member/viewer)

---

### 5. Multi-Tenant Architecture

**Technology:** Supabase RLS (Row Level Security)

**Tenant Structure:**
```
auth.users (Supabase Auth)
  ↓
profiles (extends auth.users)
  ↓
tenant_memberships (user ↔ tenant relationship)
  ↓
tenants (organization/tenant records)
  ↓
audits, llm_runs (tenant-scoped data)
```

**RLS Policies:**
- **Tenants**: Users can view tenants they are members of
- **Tenant Memberships**: Users can view their own memberships; admins can manage
- **Audits**: Users can view/create/update audits for their tenants; admins can delete
- **LLM Runs**: Users can view/create/update llm_runs for their tenants; admins can delete

**Helper Functions:**
- `current_user_is_member(tenant_id)`: Check if user is member of tenant
- `current_user_role(tenant_id)`: Get user's role in tenant

**Tenant Utilities (`lib/supabase/tenants.ts`):**
- `getUserTenants(userId)`: Get all tenants for a user
- `getActiveTenant(userId)`: Get primary tenant for a user
- `getUserRoleInTenant(userId, tenantId)`: Get user's role in tenant
- `ensureTenantMembership(userId, tenantId, role)`: Create/update membership

---

### 6. Processing Layer

**Technology:** Node.js, jsdom, custom algorithms

**Components:**
- **`lib/auditStagesSync.ts`**: Synchronous 3-stage processing
- **`lib/scoring.ts`**: Scoring algorithms
- **`lib/scoring-config.json`**: Configuration
- **`lib/llms/`**: LLM execution (Crimson, Midnight, Burnt)

**Processing Stages:**
1. **Stage 1**: HTML fetch, basic parsing (10s timeout)
2. **Stage 2**: Scoring calculations (1-3s)
3. **Stage 3**: AI analysis (8s timeout)

**Total Time**: ~15-25 seconds

---

## 🔄 Alternative Architecture (Asynchronous)

### Available Infrastructure

The system includes infrastructure for asynchronous job-based processing:

**Components:**
- **`lib/auditStages.ts`**: Async 3-stage processing with job persistence
- **`lib/auditQueue.ts`**: Redis queue management
- **`lib/upstash.ts`**: Upstash Redis client

**Flow:**
```
User → POST /api/audit → Create Job (Supabase)
  → Enqueue (Redis) → Worker Process
  → Update Job (Supabase) → Frontend Polls
```

**Benefits:**
- Job persistence
- Concurrent processing
- Rate limiting
- Distributed locking

**Status:** Available but not primary flow

---

## 🌐 Deployment Architecture

### Vercel Deployment

**Platform:** Vercel  
**Framework:** Next.js 14  
**Runtime:** Node.js 18+

**Deployment Process:**
1. **Build**: `prisma generate && next build`
2. **Deploy**: Automatic on git push
3. **Functions**: Serverless functions for API routes
4. **Static**: Static assets via CDN

**Configuration (`vercel.json`):**
```json
{
  "framework": "nextjs",
  "crons": [{
    "path": "/api/worker/process",
    "schedule": "0 * * * *"
  }]
}
```

**Environment Variables:**
- Set in Vercel Dashboard
- Applied to Production, Preview, Development
- Required: `DATABASE_URL`, `SUPABASE_*`, etc.

---

### Database Deployment

**Supabase:**
- Managed PostgreSQL
- Automatic backups
- Connection pooling
- RLS policies

**Prisma:**
- Schema in `prisma/schema.prisma`
- Migrations in `prisma/migrations/`
- Client generated on build

**Migration Process:**
1. Update `schema.prisma`
2. Run `npx prisma migrate dev`
3. Commit migration files
4. Deploy to production
5. Run `npx prisma migrate deploy`

**Supabase SQL Migrations:**
1. Create SQL migration in `supabase/migrations/`
2. Run in Supabase SQL editor
3. Or use Supabase CLI: `supabase db push`

---

## 🔐 Security Architecture

### Authentication & Authorization

**Supabase Auth:**
- Email/password authentication
- Session management via cookies
- JWT tokens for API access
- Password reset flow

**Row Level Security (RLS):**
- All Supabase tables have RLS enabled
- Policies check `tenant_memberships` for access
- Users can only access their tenant's data
- Role-based permissions (admin/member/viewer)

**API Security:**
- Environment variables for secrets
- Server-side only keys (service role)
- Client-safe keys (anon key)
- Input validation and sanitization
- Admin role checks for LLM endpoints

---

### Data Protection

**Encryption:**
- HTTPS for all traffic
- Encrypted database connections
- Secure cookie storage

**Access Control:**
- Role-based access (ADMIN/VISITOR)
- Tenant-based isolation (RLS)
- Organization-based isolation
- RLS policies enforce access

---

## ⚡ Performance Architecture

### Optimization Strategies

**1. Timeout Protection:**
- Stage 1: 10 seconds
- Stage 3: 8 seconds
- Total API: 25 seconds
- Prevents infinite hangs

**2. Retry Logic:**
- HTML fetch: 2 attempts
- Different User-Agent headers
- Graceful fallback

**3. Efficient Processing:**
- Fast Stage 1 (basic data)
- Efficient Stage 2 (scoring)
- Optional Stage 3 (AI, can timeout)

**4. Caching (Available):**
- 24-hour cache for completed audits
- localStorage for frontend
- Redis cache for rate limiting

---

### Scalability Considerations

**Current Limitations:**
- Synchronous processing (25s timeout)
- Single request blocks until complete
- No concurrent processing

**Scalability Options:**
1. **Switch to Async**: Use existing async infrastructure
2. **Background Functions**: Vercel Background Functions
3. **Horizontal Scaling**: Multiple workers, queue-based

---

## 🔄 Data Flow Architecture

### Synchronous Flow (Primary)

```
1. User enters URL on home page
   ↓
2. Frontend submits POST /api/audit
   ↓
3. API route receives request
   ↓
4. processStage1Sync(url) executes:
   - Fetches HTML (10s timeout, 2 retries)
   - Parses basic metadata
   - Fetches robots.txt and sitemap.xml
   ↓
5. processStage2Sync(stage1Results, US_STATES) executes:
   - Extracts media metrics
   - Calculates title score
   - Calculates media score
   - Calculates technical score
   - Calculates overall SEO score
   ↓
6. processStage3Sync(stage2Results) executes:
   - Analyzes AI optimization metrics
   - Calculates AI score
   ↓
7. Complete results returned to API route
   ↓
8. API returns JSON response with results
   ↓
9. Frontend stores results in localStorage
   ↓
10. Frontend navigates to /report page
   ↓
11. Report page displays all scores and breakdowns
```

**Timing:**
- Stage 1: ~5-10 seconds
- Stage 2: ~1-3 seconds
- Stage 3: ~5-8 seconds
- **Total: ~15-25 seconds**

---

## 🧩 Component Architecture

### Layer Separation

**Presentation Layer (`app/`):**
- Pages, components, layouts
- Client-side interactivity
- UI/UX

**Business Logic Layer (`lib/`):**
- Scoring algorithms
- Audit processing
- LLM execution
- Utilities

**Data Access Layer (`lib/prisma.ts`, `lib/supabase/`):**
- Database clients
- Query abstractions
- Connection management
- Tenant utilities

**Infrastructure Layer:**
- Vercel (hosting)
- Supabase (database, auth)
- Upstash (Redis, if used)

---

## 📊 Monitoring & Observability

### Current State

**Logging:**
- Console logs in API routes
- Error messages in responses
- Performance timing (implicit)

**Error Tracking:**
- Try-catch blocks
- Error messages in responses
- Job error status (async)

**Future Enhancements:**
- Structured logging
- Error tracking (Sentry)
- Performance monitoring
- Analytics

---

## 🔧 Configuration Architecture

### Environment-Based Configuration

**Development:**
- Local `.env` file
- Local Supabase project
- Local database

**Production:**
- Vercel environment variables
- Production Supabase project
- Production database

**Configuration Files:**
- `lib/scoring-config.json` - Scoring weights
- `vercel.json` - Deployment config
- `next.config.js` - Next.js config
- `tailwind.config.js` - Styling config

---

## 🚀 Deployment Architecture

### CI/CD Pipeline

**Current:**
- Git push to main branch
- Vercel automatic deployment
- Build: `prisma generate && next build`
- Deploy: Serverless functions + static assets

**Process:**
1. Developer pushes to GitHub
2. Vercel detects push
3. Vercel runs build command
4. Prisma generates client
5. Next.js builds application
6. Vercel deploys to edge
7. Functions available globally

---

### Database Migrations

**Prisma Migrations:**
1. Update `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name migration_name`
3. Commit migration files
4. Deploy to production
5. Run `npx prisma migrate deploy`

**Supabase Migrations:**
- SQL migrations in `supabase/migrations/`
- Applied directly to database via SQL editor
- Or use Supabase CLI: `supabase db push`
- Version controlled in repository

---

## 📈 Scalability Architecture

### Current Capacity

**Throughput:**
- Synchronous: ~1 request at a time per function
- Function timeout: 25 seconds
- Estimated: ~100-200 audits/day (single function)

**Bottlenecks:**
- Function timeout limits
- Synchronous processing
- No concurrent processing

---

### Scaling Strategies

**1. Switch to Async:**
- Use existing async infrastructure
- Job queue for concurrent processing
- Multiple workers

**2. Background Functions:**
- Vercel Background Functions
- Longer timeout limits
- Better for long-running jobs

**3. Horizontal Scaling:**
- Multiple workers
- Queue-based distribution
- Load balancing

**4. Caching:**
- Cache completed audits
- Reduce redundant processing
- Faster response times

---

## 🔍 Error Handling Architecture

### Error Types

**API Errors:**
- Validation errors
- Processing errors
- Timeout errors
- Network errors

**Job Errors (Async):**
- Stage failures
- Timeout errors
- Database errors
- Queue errors

### Error Handling Strategy

**1. Graceful Degradation:**
- Partial audits on timeout
- Fallback values
- Default scores

**2. User-Friendly Messages:**
- Clear error messages
- Actionable guidance
- No technical jargon

**3. Logging:**
- Console logs
- Error tracking (future)
- Performance monitoring

---

## 📝 Summary

This architecture provides:

✅ **Serverless Scalability** - Vercel serverless functions  
✅ **Type Safety** - TypeScript throughout  
✅ **Database Flexibility** - Prisma ORM + Supabase PostgreSQL  
✅ **Multi-Tenant Support** - Supabase RLS for tenant isolation  
✅ **Authentication** - Supabase Auth with RLS  
✅ **Performance** - Timeout protection, efficient processing  
✅ **Extensibility** - Modular design, easy to extend  
✅ **Security** - RLS, environment variables, input validation  

The system supports both **synchronous** (current) and **asynchronous** (available) processing patterns, providing flexibility for different use cases and scale requirements.

**Current State:** Synchronous processing, ~15-25 second response times, suitable for moderate traffic.

**Future State:** Can scale to async processing, concurrent workers, and higher throughput as needed.

