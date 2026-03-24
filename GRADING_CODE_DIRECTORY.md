# SEO Grader v3 - Complete Grading Code Directory

## Overview
This document provides a comprehensive directory of all grading code components in the SEO Grader v3 application. The system performs asynchronous SEO audits through a 3-stage processing pipeline.

---

## 📁 Directory Structure

```
seo-grader-v3-peach/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── audit/
│   │   │   └── route.ts          # Synchronous audit endpoint
│   │   ├── scrape/
│   │   │   └── route.ts         # HTML scraping endpoint
│   │   └── states/
│   │       └── route.ts         # US States data endpoint
│   ├── page.tsx                  # Home page (URL input)
│   ├── report/
│   │   └── page.tsx             # Results display page
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
│
├── lib/                          # Core Grading Logic
│   ├── scoring.ts                # Scoring algorithms
│   ├── scoring-config.json       # Scoring configuration
│   ├── auditStages.ts            # 3-stage async audit processing
│   ├── auditStagesSync.ts        # Synchronous audit processing
│   ├── auditQueue.ts             # Redis queue management
│   ├── supabase.ts               # Database client
│   └── upstash.ts                # Redis client & utilities
│
├── prisma/                       # Database Schema
│   ├── schema.prisma             # Prisma schema definition
│   └── migrations/               # Database migrations
│
├── supabase/                     # Supabase Migrations
│   └── migrations/
│       └── 001_audit_jobs.sql   # Audit jobs table
│
└── Configuration Files
    ├── package.json              # Dependencies
    ├── tsconfig.json             # TypeScript config
    ├── next.config.js            # Next.js config
    ├── tailwind.config.js        # Tailwind CSS config
    └── vercel.json               # Vercel deployment config
```

---

## 🔍 Core Grading Components

### 1. Scoring Engine (`lib/scoring.ts`)

**Purpose:** Core scoring algorithms for title and media metrics

**Key Functions:**
- `scoreTitle(metrics, config)` - Calculates title SEO score (0-100)
- `scoreMedia(metrics, config)` - Calculates media/alt text score (0-100)

**Scoring Factors:**

**Title Score (100 points):**
- Locality (25 points) - State/location in title
- Service Keywords (25 points) - Strong/weak service keywords
- Semantic Overlap (20 points) - Body keyword overlap with title
- Length (15 points) - Optimal 30-65 characters
- Separators (10 points) - Use of |, -, or –
- Presence (5 points) - Title tag exists

**Media Score (100 points):**
- Alt Coverage (40 points) - % of images with alt text
- Filename Quality (30 points) - Descriptive filenames
- Metadata (20 points) - OG title/description presence
- Image Count (10 points) - Minimum 3 images

**Status Buckets:**
- `good`: ≥80 points
- `warn`: 50-79 points
- `bad`: <50 points

**Type Definitions:**
- `TitleMetrics` - Input metrics for title scoring
- `MediaMetrics` - Input metrics for media scoring
- `TitleScoreBreakdown` - Detailed title score breakdown
- `MediaScoreBreakdown` - Detailed media score breakdown
- `ScoringConfig` - Configuration for scoring weights

---

### 2. Scoring Configuration (`lib/scoring-config.json`)

**Purpose:** Configurable weights and thresholds for scoring

**Configuration Structure:**
```json
{
  "statusBuckets": {
    "goodMin": 80,
    "warnMin": 50
  },
  "title": {
    "weights": { ... },
    "length": { ... },
    "serviceKeywordsStrong": [ ... ],
    "serviceKeywordsWeak": [ ... ],
    "semantic": { ... },
    "structure": { ... }
  },
  "media": {
    "weights": { ... },
    "altCoverageThresholds": { ... },
    "badFilenameYellowMaxRatio": 0.3,
    "imageCount": { ... }
  }
}
```

**Key Settings:**
- Strong service keywords: roofing, roofer, remodeling, contractor, etc.
- Weak service keywords: services, company, solutions, experts, team
- Ideal title length: 30-65 characters
- Alt coverage thresholds: 90% (green), 50% (yellow)

---

### 3. Audit Stages - Async (`lib/auditStages.ts`)

**Purpose:** 3-stage asynchronous audit processing with job persistence

**Stage 1: Fast Pass (10s timeout)**
- Fetches HTML from target URL
- Parses basic metadata:
  - Title tag
  - Meta description
  - H1 tags
  - Word count
  - Favicon
  - Canonical tag
- Fetches robots.txt and sitemap.xml
- Updates job status: `running`, stage=1
- Saves partial results to Supabase

**Stage 2: Structure + Media**
- Extracts media metrics:
  - Total images
  - Images with alt text
  - Bad filename count (auto-generated names)
  - OG tags presence
- Calculates title score using `scoreTitle()`
- Calculates media score using `scoreMedia()`
- Calculates technical score:
  - H1 count (25 points for 1, 12 for >1)
  - Word count (20 for ≥400, 10 for ≥200)
  - Canonical tag (15 points)
  - Robots.txt found (15 points)
  - Sitemap.xml found (15 points)
  - Meta description (10 points)
- Calculates overall SEO score:
  - Title: 45%
  - Media: 20%
  - Technical: 35%
- Updates job status: stage=2
- Saves results to Supabase

**Stage 3: AI Optimization (8s timeout)**
- Analyzes AI readiness metrics:
  1. **Structured Answers Readiness (0-25 points)**
     - FAQ patterns, Q&A format, definitions, step-by-step
  2. **Entity Clarity (0-20 points)**
     - Primary entity, supporting entities, consistent naming
  3. **Extraction Readiness (0-20 points)**
     - Lists, tables, headings, modular structure
  4. **Context Completeness (0-15 points)**
     - What, why, how, who, when, pitfalls
  5. **Trust Signals (0-10 points)**
     - Author, citations, dates, contact info, brand
  6. **Machine Readability (0-10 points)**
     - Heading hierarchy, semantic HTML, schema markup
- Calculates AI score (0-100)
- Updates job status: `done`, stage=3
- Saves final results to Supabase

**Key Functions:**
- `processStage1(jobId, url)` - Stage 1 processing
- `processStage2(jobId, stage1Results, states)` - Stage 2 processing
- `processStage3(jobId, stage2Results)` - Stage 3 processing
- `processAuditJob(jobId, url, startFromStage?, existingResults?)` - Full job processor

**Timeouts:**
- Stage 1 fetch: 10 seconds
- Stage 3 AI analysis: 8 seconds
- Total job: 3 minutes (180 seconds)

**Error Handling:**
- Partial audits on timeout
- Graceful degradation
- Error status updates

---

### 4. Audit Stages - Sync (`lib/auditStagesSync.ts`)

**Purpose:** Synchronous version for immediate processing (used by `/api/audit`)

**Key Functions:**
- `processStage1Sync(url)` - Synchronous Stage 1
- `processStage2Sync(stage1Results, states)` - Synchronous Stage 2
- `processStage3Sync(stage2Results)` - Synchronous Stage 3

**Differences from Async:**
- No job persistence (returns results directly)
- No status updates
- Same processing logic, different execution model
- Used for synchronous API endpoint

---

### 5. Queue System (`lib/auditQueue.ts`)

**Purpose:** Redis-based job queue for async processing

**Operations:**
- `enqueue(jobId, url)` - Add job to queue (RPUSH)
- `dequeue()` - Remove and return next job (LPOP - FIFO)
- `getLength()` - Get queue size
- `peek()` - View next job without removing

**Queue Key:** `audit-jobs` (Redis List)

**Queue Item Structure:**
```typescript
{
  jobId: string;
  url: string;
  enqueuedAt: number;
}
```

---

### 6. Database Client (`lib/supabase.ts`)

**Purpose:** Supabase PostgreSQL client for job persistence

**Features:**
- Singleton pattern via Proxy
- Lazy initialization
- Service role key (admin privileges)
- Server-side only

**Table: `audit_jobs`**
- `id` (UUID) - Primary key
- `url` (TEXT) - Target URL
- `status` (TEXT) - pending | running | done | error
- `stage` (INTEGER) - 0, 1, 2, or 3
- `results` (JSONB) - Full audit results
- `error_message` (TEXT) - Error details
- `partial_audit` (BOOLEAN) - Partial audit flag
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

### 7. Redis Client (`lib/upstash.ts`)

**Purpose:** Upstash Redis client for queue, rate limiting, and locking

**Features:**
- Singleton pattern via Proxy
- Lazy initialization
- REST API (no persistent connections)

**Key Functions:**
- `checkRateLimit(ip)` - Rate limiting (10 requests/hour per IP)
- `acquireLock(url)` - Distributed lock (7 min TTL)
- `releaseLock(url)` - Release lock

**Redis Keys:**
- Queue: `audit-jobs` (List)
- Rate limits: `rate_limit:anonymous:{ip}` (String)
- Locks: `lock:url:{normalizedUrl}` (String)

---

## 🌐 API Endpoints

### 1. POST `/api/audit` (`app/api/audit/route.ts`)

**Purpose:** Synchronous audit execution

**Flow:**
1. Receives URL from request body
2. Calls `processStage1Sync(url)`
3. Calls `processStage2Sync(stage1, US_STATES)`
4. Calls `processStage3Sync(stage2)`
5. Returns complete results

**Timeout:** 25 seconds (hard limit)

**Response:**
```json
{
  "results": {
    "url": "...",
    "titleTag": "...",
    "seoScore": 85,
    "titleScoreRaw": 90,
    "mediaScoreRaw": 80,
    "technicalScore": 85,
    "aiScoreRaw": 75,
    ...
  }
}
```

---

### 2. GET `/api/scrape` (`app/api/scrape/route.ts`)

**Purpose:** HTML scraping utility

**Flow:**
1. Fetches HTML from target URL
2. Fetches robots.txt
3. Fetches sitemap.xml
4. Returns raw data

**Response:**
```json
{
  "success": true,
  "url": "...",
  "finalUrl": "...",
  "status": 200,
  "contentType": "text/html",
  "html": "...",
  "robotsTxt": "...",
  "sitemapXml": "..."
}
```

---

### 3. GET `/api/states` (`app/api/states/route.ts`)

**Purpose:** Returns US states data for locality detection

**Response:**
```json
[
  { "name": "Alabama", "abbr": "AL" },
  { "name": "Alaska", "abbr": "AK" },
  ...
]
```

---

## 🎨 Frontend Components

### 1. Home Page (`app/page.tsx`)

**Purpose:** URL input and audit submission

**Features:**
- URL input form
- Loading states
- Error handling
- Navigation to report page
- Results stored in localStorage

**Flow:**
1. User enters URL
2. Submits to `/api/audit` (POST)
3. Receives results
4. Stores in localStorage
5. Navigates to `/report`

---

### 2. Report Page (`app/report/page.tsx`)

**Purpose:** Display audit results

**Features:**
- Reads results from localStorage
- Displays scores:
  - Overall SEO Score
  - Title Score
  - Media Score
  - Technical Score
  - AI Score
- Shows detailed breakdowns
- Displays recommendations
- Visual score indicators (good/warn/bad)

---

## 📊 Data Flow

### Synchronous Flow (Current Implementation)
```
User Input → POST /api/audit
  ↓
processStage1Sync() → Fetch HTML, parse basics
  ↓
processStage2Sync() → Calculate scores
  ↓
processStage3Sync() → AI analysis
  ↓
Return Results → Display on /report
```

### Asynchronous Flow (Available but not primary)
```
User Input → POST /api/audit (with queue)
  ↓
Create Job → Supabase
  ↓
Enqueue → Redis
  ↓
Worker Process → processStage1 → processStage2 → processStage3
  ↓
Update Job → Supabase
  ↓
Frontend Polls → GET /api/audit/{jobId}
  ↓
Display Results
```

---

## 🔧 Configuration

### Environment Variables

**Required:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis token

**Optional:**
- `NEXT_PUBLIC_BASE_URL` - Base URL for API calls
- `WORKER_SECRET` - Worker authentication secret
- `AUDIT_VERSION` - Audit version identifier

---

## 📈 Scoring Breakdown

### Overall SEO Score Calculation
```
SEO Score = (Title Score × 0.45) + (Media Score × 0.20) + (Technical Score × 0.35)
```

### Technical Score Components
- H1 Count: 25 points (1 H1), 12 points (>1 H1)
- Word Count: 20 points (≥400 words), 10 points (≥200 words)
- Canonical Tag: 15 points
- Robots.txt: 15 points
- Sitemap.xml: 15 points
- Meta Description: 10 points
- **Total: 100 points**

### AI Score Components
- Structured Answers: 0-25 points
- Entity Clarity: 0-20 points
- Extraction Readiness: 0-20 points
- Context Completeness: 0-15 points
- Trust Signals: 0-10 points
- Machine Readability: 0-10 points
- **Total: 100 points**

---

## 🎯 Key Metrics Extracted

### Stage 1 Metrics
- URL, final URL, HTTP status
- HTML content, content type
- Title tag, meta description
- H1 count and texts
- Word count
- Favicon presence
- Canonical tag
- Robots.txt presence/content
- Sitemap.xml presence/content

### Stage 2 Metrics
- Total images
- Images with alt text
- Bad filename count
- OG title/description
- Body keywords
- Locality detection (state names)
- Service keyword detection
- Semantic overlap (title vs body)

### Stage 3 Metrics
- Structured answer readiness
- Entity clarity
- Extraction readiness
- Context completeness
- Trust signals
- Machine readability

---

## 🔄 Processing Patterns

### Retry Logic
- **HTML Fetch:** 2 attempts with different User-Agent headers
- **Robots.txt Fallback:** If HTML fetch fails, attempt robots.txt only
- **Timeout Protection:** All operations have timeouts

### Error Handling
- Partial audits on timeout
- Graceful degradation
- Error status tracking
- Error messages in job records

### Performance
- Stage 1: ~5-10 seconds
- Stage 2: ~1-3 seconds
- Stage 3: ~5-8 seconds
- **Total: ~15-25 seconds** (synchronous)

---

## 📝 Type Definitions

### AuditResults
```typescript
{
  url?: string;
  finalUrl?: string;
  status?: number;
  html?: string;
  titleTag?: string;
  metaDescription?: string;
  h1Count?: number;
  wordCount?: number;
  titleScoreRaw?: number;
  titleScore10?: number;
  titleStatus?: "good" | "warn" | "bad";
  mediaScoreRaw?: number;
  mediaScore10?: number;
  mediaStatus?: "good" | "warn" | "bad";
  technicalScore?: number;
  technicalScore10?: number;
  aiScoreRaw?: number;
  aiScore10?: number;
  aiStatus?: "good" | "warn" | "bad";
  seoScore?: number;
  partialAudit?: boolean;
  aiOptimizationTimeout?: boolean;
  // ... more fields
}
```

---

## 🚀 Deployment

### Vercel Configuration (`vercel.json`)
- Framework: Next.js
- Cron job: Hourly worker trigger (backup)
- Function timeout: 25 seconds (synchronous endpoint)

### Database
- Supabase PostgreSQL
- Prisma ORM
- Migrations in `prisma/migrations/`

---

## 📚 Dependencies

### Core
- `next` - Next.js framework
- `react` - React library
- `typescript` - TypeScript

### Grading
- `jsdom` - HTML parsing
- `@supabase/supabase-js` - Database client
- `@upstash/redis` - Redis client

### Utilities
- `uuid` - UUID generation
- `bcryptjs` - Password hashing (if needed)

---

## 🔍 File Reference

### Grading Logic Files
1. **`lib/scoring.ts`** - Core scoring algorithms
2. **`lib/scoring-config.json`** - Scoring configuration
3. **`lib/auditStages.ts`** - Async 3-stage processing
4. **`lib/auditStagesSync.ts`** - Sync 3-stage processing

### Infrastructure Files
5. **`lib/auditQueue.ts`** - Queue management
6. **`lib/supabase.ts`** - Database client
7. **`lib/upstash.ts`** - Redis client

### API Files
8. **`app/api/audit/route.ts`** - Synchronous audit endpoint
9. **`app/api/scrape/route.ts`** - HTML scraping endpoint
10. **`app/api/states/route.ts`** - States data endpoint

### Frontend Files
11. **`app/page.tsx`** - Home page
12. **`app/report/page.tsx`** - Results page

### Configuration Files
13. **`prisma/schema.prisma`** - Database schema
14. **`vercel.json`** - Deployment config
15. **`package.json`** - Dependencies

---

## 📌 Summary

This SEO Grader v3 system provides comprehensive SEO auditing through:

1. **3-Stage Processing Pipeline**
   - Stage 1: Fast HTML fetch and basic parsing
   - Stage 2: Scoring calculations (title, media, technical)
   - Stage 3: AI optimization analysis

2. **Comprehensive Scoring**
   - Title score (100 points)
   - Media score (100 points)
   - Technical score (100 points)
   - AI score (100 points)
   - Overall SEO score (weighted combination)

3. **Robust Infrastructure**
   - Supabase for job persistence
   - Upstash Redis for queue and rate limiting
   - Vercel for serverless hosting

4. **Flexible Execution**
   - Synchronous processing (current)
   - Asynchronous processing (available)

All grading logic is contained in the `lib/` directory, with API endpoints in `app/api/` and frontend components in `app/`.




