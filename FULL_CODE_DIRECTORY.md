# SEO Grader v3 - Full Code Directory

Complete file listing of the SEO Grader v3 codebase with descriptions.

---

## 📁 Project Structure

```
seo-grader-v3-peach/
├── app/                              # Next.js App Router
├── lib/                              # Core application logic
├── prisma/                           # Database schema & migrations
├── supabase/                         # Supabase migrations
├── scripts/                          # Utility scripts
├── node_modules/                     # Dependencies (excluded from listing)
└── [config files]                    # Configuration files
```

---

## 📂 Application Code

### Frontend (`app/`)

#### `app/page.tsx`
- **Type:** React Component (Client)
- **Purpose:** Home page with URL input form
- **Features:**
  - URL input and validation
  - Form submission to `/api/audit`
  - Loading states and error handling
  - Navigation to report page
  - Results stored in localStorage
- **Lines:** ~464

#### `app/report/page.tsx`
- **Type:** React Component (Client)
- **Purpose:** Display audit results
- **Features:**
  - Reads results from localStorage
  - Displays all scores (SEO, Title, Media, Technical, AI)
  - Shows detailed breakdowns
  - Visual score indicators (good/warn/bad)
  - Recommendations display
- **Lines:** ~1310

#### `app/layout.tsx`
- **Type:** React Component (Server)
- **Purpose:** Root layout wrapper
- **Features:**
  - Metadata configuration
  - Global CSS import
  - HTML structure
- **Lines:** ~20

#### `app/globals.css`
- **Type:** CSS
- **Purpose:** Global styles
- **Features:**
  - Tailwind CSS directives
  - Custom styles
  - Theme configuration

---

### API Routes (`app/api/`)

#### `app/api/audit/route.ts`
- **Type:** Next.js API Route (POST)
- **Purpose:** Synchronous audit execution
- **Features:**
  - Receives URL from request
  - Executes 3-stage audit synchronously
  - Returns complete results
  - 25-second timeout
- **Runtime:** nodejs
- **Dependencies:** `auditStagesSync.ts`
- **Lines:** ~95

#### `app/api/scrape/route.ts`
- **Type:** Next.js API Route (GET)
- **Purpose:** HTML scraping utility
- **Features:**
  - Fetches HTML from target URL
  - Fetches robots.txt
  - Fetches sitemap.xml
  - Returns raw data
- **Runtime:** nodejs
- **Timeout:** 10 seconds (fetch), 3 seconds (robots/sitemap)
- **Lines:** ~148

#### `app/api/states/route.ts`
- **Type:** Next.js API Route (GET)
- **Purpose:** US states data endpoint
- **Features:**
  - Returns array of US states with abbreviations
  - Used for locality detection in scoring
- **Runtime:** nodejs
- **Lines:** ~67

---

### Core Library (`lib/`)

#### `lib/scoring.ts`
- **Type:** TypeScript Module
- **Purpose:** Core scoring algorithms
- **Exports:**
  - `scoreTitle(metrics, config)` - Title score calculation (0-100)
  - `scoreMedia(metrics, config)` - Media score calculation (0-100)
  - Type definitions for metrics and scores
- **Scoring Factors:**
  - Title: Locality, Service Keywords, Semantic, Length, Separators, Presence
  - Media: Alt Coverage, Filename Quality, Metadata, Image Count
- **Lines:** ~257

#### `lib/scoring-config.json`
- **Type:** JSON Configuration
- **Purpose:** Scoring weights and thresholds
- **Configuration:**
  - Status buckets (good/warn/bad thresholds)
  - Title weights and settings
  - Media weights and settings
  - Service keywords (strong/weak)
  - Length constraints
- **Lines:** ~75

#### `lib/auditStages.ts`
- **Type:** TypeScript Module
- **Purpose:** 3-stage asynchronous audit processing
- **Exports:**
  - `processStage1(jobId, url)` - Fast pass (HTML fetch, basic parsing)
  - `processStage2(jobId, stage1Results, states)` - Structure + Media scoring
  - `processStage3(jobId, stage2Results)` - AI optimization analysis
  - `processAuditJob(jobId, url, startFromStage?, existingResults?)` - Full processor
- **Features:**
  - Job persistence to Supabase
  - Status updates per stage
  - Timeout protection
  - Error handling
- **Timeouts:**
  - Stage 1: 10 seconds
  - Stage 3: 8 seconds
  - Total job: 3 minutes
- **Lines:** ~947

#### `lib/auditStagesSync.ts`
- **Type:** TypeScript Module
- **Purpose:** Synchronous version of audit stages
- **Exports:**
  - `processStage1Sync(url)` - Synchronous Stage 1
  - `processStage2Sync(stage1Results, states)` - Synchronous Stage 2
  - `processStage3Sync(stage2Results)` - Synchronous Stage 3
- **Features:**
  - No job persistence (returns results directly)
  - Same processing logic as async version
  - Used by `/api/audit` endpoint
- **Lines:** ~697

#### `lib/auditQueue.ts`
- **Type:** TypeScript Module
- **Purpose:** Redis-based job queue management
- **Exports:**
  - `auditQueue` - Singleton queue instance
  - Methods: `enqueue()`, `dequeue()`, `getLength()`, `peek()`
- **Features:**
  - FIFO queue implementation
  - Uses Upstash Redis
  - Queue key: `audit-jobs`
- **Lines:** ~89

#### `lib/supabase.ts`
- **Type:** TypeScript Module
- **Purpose:** Supabase PostgreSQL client
- **Exports:**
  - `supabase` - Singleton client instance
- **Features:**
  - Lazy initialization
  - Service role key (admin privileges)
  - Server-side only
  - Proxy pattern for singleton
- **Lines:** ~44

#### `lib/upstash.ts`
- **Type:** TypeScript Module
- **Purpose:** Upstash Redis client and utilities
- **Exports:**
  - `redis` - Singleton Redis client
  - `checkRateLimit(ip)` - Rate limiting (10 req/hour)
  - `acquireLock(url)` - Distributed locking
  - `releaseLock(url)` - Lock release
- **Features:**
  - REST API client (no persistent connections)
  - Lazy initialization
  - Proxy pattern for singleton
- **Lines:** ~140

---

## 🗄️ Database

### Prisma (`prisma/`)

#### `prisma/schema.prisma`
- **Type:** Prisma Schema
- **Purpose:** Database schema definition
- **Models:**
  - `AuditJob` - Job state and results
- **Fields:**
  - `id` (UUID, primary key)
  - `url` (String)
  - `status` (String: pending | running | done | error)
  - `stage` (Int: 0-3)
  - `createdAt`, `updatedAt` (DateTime)
  - `errorMessage` (String?)
  - `results` (Json?)
- **Indexes:**
  - `[url, status, createdAt]`
  - `[status]`
- **Lines:** ~29

#### `prisma/migrations/0001_add_audit_job/`
- **Type:** Prisma Migration
- **Purpose:** Initial migration for audit_jobs table
- **Contains:** Migration SQL files

#### `prisma.config.ts`
- **Type:** TypeScript Configuration
- **Purpose:** Prisma configuration
- **Features:**
  - Schema path
  - Migrations path
  - Database URL from environment
- **Lines:** ~15

---

### Supabase (`supabase/`)

#### `supabase/migrations/001_audit_jobs.sql`
- **Type:** SQL Migration
- **Purpose:** Create audit_jobs table in Supabase
- **Features:**
  - Table creation with constraints
  - Indexes for performance
  - Auto-update trigger for `updated_at`
- **Lines:** ~35

---

## ⚙️ Configuration Files

#### `package.json`
- **Type:** JSON
- **Purpose:** NPM package configuration
- **Dependencies:**
  - `next` (^14.0.0)
  - `react` (^18.2.0)
  - `@supabase/supabase-js` (^2.39.0)
  - `@upstash/redis` (^1.25.0)
  - `jsdom` (^24.0.0)
  - `prisma` (^7.1.0)
  - `uuid` (^13.0.0)
  - And more...
- **Scripts:**
  - `dev` - Development server
  - `build` - Production build
  - `start` - Production server
  - `lint` - Linting

#### `package-lock.json`
- **Type:** JSON
- **Purpose:** Locked dependency versions

#### `tsconfig.json`
- **Type:** JSON
- **Purpose:** TypeScript configuration
- **Features:**
  - Target: ES2017
  - Module: esnext
  - Path aliases: `@/*` → `./*`
  - Strict mode enabled
- **Lines:** ~28

#### `next.config.js`
- **Type:** JavaScript
- **Purpose:** Next.js configuration
- **Features:**
  - React strict mode
- **Lines:** ~7

#### `tailwind.config.js`
- **Type:** JavaScript
- **Purpose:** Tailwind CSS configuration
- **Features:**
  - Content paths
  - Theme extensions
- **Lines:** ~13

#### `postcss.config.js`
- **Type:** JavaScript
- **Purpose:** PostCSS configuration
- **Features:**
  - Tailwind CSS plugin
  - Autoprefixer plugin
- **Lines:** ~7

#### `vercel.json`
- **Type:** JSON
- **Purpose:** Vercel deployment configuration
- **Features:**
  - Framework: nextjs
  - Cron job: Hourly worker trigger
- **Lines:** ~10

#### `next-env.d.ts`
- **Type:** TypeScript Declaration
- **Purpose:** Next.js type definitions
- **Auto-generated**

---

## 🔧 Scripts (`scripts/`)

#### `scripts/check-env-vars.sh`
- **Type:** Shell Script
- **Purpose:** Verify environment variables are set
- **Usage:** Check required env vars before deployment

#### `scripts/test-deployment.sh`
- **Type:** Shell Script
- **Purpose:** Test deployment configuration
- **Usage:** Validate deployment setup

#### `scripts/verify-production.sh`
- **Type:** Shell Script
- **Purpose:** Verify production deployment
- **Usage:** Check production environment

#### `push-branches.sh`
- **Type:** Shell Script
- **Purpose:** Push branches to remote
- **Usage:** Git branch management

---

## 📄 Documentation Files

### Architecture & Design
- `ARCHITECTURE_BREAKDOWN.md` - Detailed architecture breakdown
- `ARCHITECTURE_DOCUMENTATION.md` - Architecture documentation
- `GRADING_CODE_DIRECTORY.md` - Grading code directory

### Deployment
- `DEPLOYMENT.md` - Deployment guide
- `DEPLOY_NOW.md` - Quick deployment
- `DEPLOY_FINAL.md` - Final deployment steps
- `QUICK_DEPLOY.md` - Quick deployment guide
- `FINAL_DEPLOY.md` - Final deployment
- `DEPLOY_FROM_MAIN.md` - Deploy from main branch
- `DEPLOYMENT_STATUS.md` - Deployment status
- `DEPLOYMENT_VERIFICATION.md` - Deployment verification
- `PRODUCTION_VERIFICATION.md` - Production verification

### Vercel
- `VERCEL_DEPLOYMENT_ISSUE_REPORT.md` - Vercel issues
- `VERCEL_BRANCH_FIX.md` - Branch fix
- `VERCEL_BRANCH_SETTINGS.md` - Branch settings
- `VERCEL_BUILD_FIX.md` - Build fix
- `VERCEL_ENV_VARS.md` - Environment variables

### Database
- `SUPABASE_CREDENTIALS.md` - Supabase credentials
- `SUPABASE_MIGRATION.sql` - Migration SQL

### Troubleshooting
- `DEBUG_STATUS_UPDATE.md` - Status update debugging
- `DEBUG_WORKER.md` - Worker debugging
- `FIX_WORKER_TRIGGER.md` - Worker trigger fix
- `FIX_JSDOM_ISSUE.md` - JSDOM issue fix
- `TROUBLESHOOT_STUCK_JOBS.md` - Stuck jobs troubleshooting
- `DEPLOY_FIX_STUCK_JOBS.md` - Fix stuck jobs
- `PERFORMANCE_FIX.md` - Performance fixes

### Other
- `CRON_SCHEDULE_INFO.md` - Cron schedule information
- `NEXT_ACTIONS.md` - Next actions
- `ADD_SSH_KEY.md` - SSH key setup
- `SETUP_SSH.md` - SSH setup
- `PUSH_WITH_TOKEN.md` - Push with token

---

## 📊 File Statistics

### By Type
- **TypeScript/TSX:** 11 files
- **JavaScript:** 4 files
- **JSON:** 5 files
- **SQL:** 2 files
- **CSS:** 1 file
- **Shell Scripts:** 4 files
- **Markdown:** 30+ files
- **Configuration:** 6 files

### By Category
- **Application Code:** 11 files
- **Configuration:** 6 files
- **Database:** 3 files
- **Scripts:** 4 files
- **Documentation:** 30+ files

### Lines of Code (Approximate)
- **Frontend:** ~1,800 lines
- **API Routes:** ~310 lines
- **Core Library:** ~2,200 lines
- **Configuration:** ~100 lines
- **Total Application Code:** ~4,400 lines

---

## 🔍 Key Files Summary

### Most Important Files
1. **`lib/scoring.ts`** - Core scoring algorithms
2. **`lib/auditStagesSync.ts`** - Main audit processing (synchronous)
3. **`lib/auditStages.ts`** - Async audit processing
4. **`app/api/audit/route.ts`** - Main API endpoint
5. **`app/page.tsx`** - Home page
6. **`app/report/page.tsx`** - Results page
7. **`lib/scoring-config.json`** - Scoring configuration
8. **`lib/supabase.ts`** - Database client
9. **`lib/upstash.ts`** - Redis client
10. **`prisma/schema.prisma`** - Database schema

### Entry Points
- **Frontend:** `app/page.tsx` (home), `app/report/page.tsx` (results)
- **API:** `app/api/audit/route.ts` (main endpoint)
- **Processing:** `lib/auditStagesSync.ts` (synchronous), `lib/auditStages.ts` (async)

---

## 📝 Notes

- **Node Modules:** Excluded from listing (managed by npm)
- **Build Files:** `.next/` directory excluded (generated)
- **Environment Files:** `.env*` files excluded (not in repo)
- **Git Files:** `.git/` excluded (version control)

---

## 🔗 File Dependencies

### Core Flow
```
app/page.tsx
  → app/api/audit/route.ts
    → lib/auditStagesSync.ts
      → lib/scoring.ts
      → lib/scoring-config.json
      → lib/supabase.ts (if async)
      → lib/upstash.ts (if async)
```

### Data Flow
```
User Input → page.tsx → /api/audit → auditStagesSync → scoring → Results → report/page.tsx
```

---

This directory provides a complete overview of all files in the SEO Grader v3 codebase.

