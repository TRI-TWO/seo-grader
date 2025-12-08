# SEO Grader Architecture Breakdown

## System Overview

This is a **Next.js 14** application that performs asynchronous SEO audits using a job-based queue system. The architecture separates concerns across three main services:

- **Supabase (PostgreSQL)** - Job state and results storage
- **Upstash Redis** - Queue management, rate limiting, distributed locking
- **Vercel** - Serverless hosting, API routes, cron scheduling

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                    (Next.js App Router)                     │
│                                                              │
│  / (Home) → Submit URL → POST /api/audit → Get jobId       │
│                                                              │
│  /report?jobId=xxx → Poll GET /api/audit/[id] every 2-3s   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL API ROUTES                         │
│                                                              │
│  POST /api/audit                                            │
│    ├─ Rate limit check (Upstash)                            │
│    ├─ Acquire lock (Upstash)                                │
│    ├─ Check cache (Supabase)                                │
│    ├─ Create job (Supabase)                                 │
│    ├─ Enqueue job (Upstash Queue)                           │
│    ├─ Trigger worker immediately (fire-and-forget)         │
│    └─ Return jobId                                          │
│                                                              │
│  GET /api/audit/[id]                                        │
│    └─ Query job status (Supabase)                           │
│                                                              │
│  POST /api/worker/process                                    │
│    ├─ Check worker secret                                   │
│    ├─ Dequeue job (Upstash)                                │
│    ├─ Load job (Supabase)                                   │
│    ├─ Process 3 stages (fetch, analyze, AI)                │
│    └─ Update job status (Supabase)                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   SUPABASE   │ │   UPSTASH    │ │   VERCEL     │
│  PostgreSQL  │ │    Redis     │ │   Cron Job   │
│              │ │              │ │              │
│ audit_jobs   │ │ Queue:       │ │ Hourly:      │
│ table        │ │ audit-jobs   │ │ /api/worker/ │
│              │ │              │ │ process      │
│ - id (UUID)  │ │ Rate limits: │ │              │
│ - url        │ │ rate_limit:* │ │              │
│ - status     │ │              │ │              │
│ - stage      │ │ Locks:       │ │              │
│ - results    │ │ lock:url:*   │ │              │
│ - created_at │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## Component Details

### 1. Frontend (`app/page.tsx` & `app/report/page.tsx`)

**Home Page (`app/page.tsx`)**
- User enters URL
- Submits to `POST /api/audit`
- Receives `jobId`
- Redirects to `/report?jobId={jobId}`

**Report Page (`app/report/page.tsx`)**
- Reads `jobId` from URL params
- Polls `GET /api/audit/{jobId}` every 2-3 seconds
- Shows loading state with stage progress
- Displays results when status = "done"

**Polling Logic:**
```typescript
// Polls every 2-3 seconds
useEffect(() => {
  const pollInterval = setInterval(() => {
    fetch(`/api/audit/${jobId}`)
      .then(res => res.json())
      .then(job => {
        setJobStatus(job.status);
        setJobStage(job.stage);
        if (job.status === "done") {
          // Display results
        }
      });
  }, 2500);
}, [jobId]);
```

---

### 2. API Routes

#### `POST /api/audit` - Create Audit Job

**Flow:**
1. Validate and normalize URL
2. Check rate limit (Upstash Redis) - 10 requests/hour per IP
3. Acquire distributed lock (Upstash) - prevents duplicate processing
4. Check for existing pending/running job (Supabase)
5. Check 24-hour cache for completed job (Supabase)
6. Create new job record (Supabase) with status="pending"
7. Enqueue job to Redis queue (Upstash)
8. **Immediately trigger worker** (fire-and-forget fetch to `/api/worker/process`)
9. Release lock (Upstash)
10. Return `{ jobId }` to frontend

**Timeouts:**
- Rate limit check: 10s
- Lock operations: 10s
- Database queries: 5s
- Queue operations: 10s

**Response Time:** < 2 seconds (should be fast)

---

#### `GET /api/audit/[id]` - Poll Job Status

**Flow:**
1. Query job by ID from Supabase
2. Return current status, stage, and results

**Returns:**
```json
{
  "jobId": "uuid",
  "url": "https://example.com",
  "status": "pending" | "running" | "done" | "error",
  "stage": 0 | 1 | 2 | 3,
  "results": { ... } | null,
  "errorMessage": "string" | undefined,
  "partialAudit": boolean
}
```

**Timeout:** 5 seconds for database query

---

#### `POST /api/worker/process` - Process Next Job

**Flow:**
1. **Security Check:** Verify `x-worker-secret` header matches `WORKER_SECRET`
2. Dequeue next job from Redis queue (Upstash)
3. If no job: return "No jobs in queue"
4. Load job details from Supabase
5. Verify job status is "pending"
6. Check if job is too old (>3 minutes) - mark as done with partial audit
7. **Process job through 3 stages:**
   - Stage 1: Fetch HTML, parse basic data (10s timeout)
   - Stage 2: Calculate scores, media metrics
   - Stage 3: AI analysis (8s timeout)
8. Update job status after each stage (Supabase)
9. Mark as "done" when complete

**Timeouts:**
- Queue dequeue: 10s
- Database queries: 5s
- Job processing: 200s (3min + buffer)
- Individual stage timeouts: 10s (Stage 1), 8s (Stage 3)

**Response:** Returns immediately after starting job processing

**Note:** In serverless, we must await job processing (can't use fire-and-forget). Worker will take as long as job takes (up to 3 minutes).

---

### 3. Job Processing Stages (`lib/auditStages.ts`)

**Stage 1: Fast Pass (10s timeout)**
- Fetch HTML from target URL
- Parse title, meta description, H1 tags
- Fetch robots.txt and sitemap.xml
- Count words, check favicon, canonical tag
- Update status to "running", stage=1
- Save partial results to Supabase

**Stage 2: Structure + Media**
- Extract media metrics (images, alt text, OG tags)
- Calculate title scores
- Calculate media scores
- Calculate technical scores
- Update stage=2, save results

**Stage 3: AI Optimization (8s timeout)**
- Analyze structured answers readiness
- Check entity clarity
- Evaluate extraction readiness
- Assess context completeness
- Check trust signals
- Evaluate machine readability
- Update stage=3, mark as "done"

**Total Job Timeout:** 3 minutes (180 seconds)

---

### 4. Supabase Connection (`lib/supabase.ts`)

**Purpose:** PostgreSQL database for job state and results

**Connection:**
- Uses service role key (admin privileges, server-side only)
- Lazy initialization (prevents build-time errors)
- Singleton pattern via Proxy

**Table: `audit_jobs`**
```sql
CREATE TABLE audit_jobs (
  id UUID PRIMARY KEY,
  url TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'running', 'done', 'error')),
  stage INTEGER DEFAULT 0,
  results JSONB,
  error_message TEXT,
  partial_audit BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Operations:**
- Create job: `INSERT` with status='pending'
- Update status: `UPDATE` status and stage as processing
- Save results: `UPDATE` results JSONB field
- Query status: `SELECT * WHERE id = ?`

**Timeouts:** All queries have 5-second timeout

---

### 5. Upstash Redis Connection (`lib/upstash.ts`)

**Purpose:** Queue, rate limiting, distributed locking

**Connection:**
- Uses REST API (no persistent connections)
- Lazy initialization
- Singleton pattern via Proxy

**Redis Keys:**

1. **Queue:** `audit-jobs` (List)
   - Enqueue: `RPUSH audit-jobs {jobId, url, enqueuedAt}`
   - Dequeue: `LPOP audit-jobs` (FIFO - first in, first out)

2. **Rate Limits:** `rate_limit:anonymous:{ip}` (String)
   - Get count: `GET key`
   - Increment: `INCR key`
   - Set TTL: `EXPIRE key 3600` (1 hour)
   - Max: 10 requests per hour

3. **Locks:** `lock:url:{normalizedUrl}` (String)
   - Acquire: `SET key "1" EX 420 NX` (7 minutes TTL)
   - Release: `DEL key`
   - Prevents duplicate job processing

**Timeouts:** All operations have 10-second timeout

---

### 6. Queue System (`lib/auditQueue.ts`)

**Operations:**
- `enqueue(jobId, url)` - Add job to queue (RPUSH)
- `dequeue()` - Remove and return next job (LPOP)
- `getLength()` - Get queue size
- `peek()` - View next job without removing

**FIFO Implementation:**
- Uses `RPUSH` (add to right) + `LPOP` (remove from left)
- Ensures true FIFO under concurrent workers

---

### 7. Vercel Integration

**Hosting:**
- Next.js 14 App Router
- Serverless functions for API routes
- Edge runtime for static pages

**Cron Job (`vercel.json`):**
```json
{
  "crons": [{
    "path": "/api/worker/process",
    "schedule": "0 * * * *"  // Hourly (fallback only)
  }]
}
```

**Note:** Cron is backup only. Jobs process immediately via fire-and-forget trigger on creation.

**Function Timeouts:**
- Hobby plan: 10 seconds (free tier)
- Pro plan: 60 seconds (paid tier)
- Enterprise: 300 seconds

**Important:** Job processing can take up to 3 minutes, which exceeds free tier limits. Consider:
- Upgrading to Pro plan
- Using Vercel Background Functions
- Or splitting job processing into smaller chunks

---

## Data Flow: Complete Job Lifecycle

### Step 1: User Submits URL
```
User → Frontend → POST /api/audit
  ↓
Rate limit check (Upstash)
  ↓
Acquire lock (Upstash)
  ↓
Create job (Supabase) → status="pending"
  ↓
Enqueue job (Upstash Queue)
  ↓
Trigger worker immediately (fire-and-forget)
  ↓
Return jobId to frontend
```

### Step 2: Worker Processes Job
```
POST /api/worker/process (triggered immediately)
  ↓
Dequeue job (Upstash)
  ↓
Load job (Supabase)
  ↓
Update status="running", stage=1 (Supabase)
  ↓
Stage 1: Fetch & parse HTML (10s timeout)
  ↓
Update stage=2, save partial results (Supabase)
  ↓
Stage 2: Calculate scores
  ↓
Update stage=3, save results (Supabase)
  ↓
Stage 3: AI analysis (8s timeout)
  ↓
Update status="done", save final results (Supabase)
```

### Step 3: Frontend Polls for Results
```
Frontend polls GET /api/audit/{jobId} every 2-3s
  ↓
Query job status (Supabase)
  ↓
Return: { status, stage, results }
  ↓
Frontend shows progress:
  - "pending" → "Job queued, starting soon..."
  - "running" → "Processing stage {stage}..."
  - "done" → Display results
  - "error" → Show error message
```

---

## Environment Variables

### Required for Production

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Worker Security (optional but recommended)
WORKER_SECRET=long-random-secret-value

# Optional
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
AUDIT_VERSION=1.0.0
```

### Where to Set
- Vercel Dashboard → Project Settings → Environment Variables
- Apply to: Production, Preview, Development

---

## Current Architecture Status

### ✅ Working
- Job creation and enqueueing
- Immediate worker trigger
- Job status polling
- Rate limiting
- Distributed locking
- Queue FIFO ordering
- Timeout protection on all operations

### ⚠️ Known Limitations
1. **Serverless Function Timeouts:**
   - Free tier: 10 seconds max
   - Job processing: Up to 3 minutes
   - **Solution:** Upgrade to Pro plan or use Background Functions

2. **Worker Processing:**
   - Must await job processing (can't use fire-and-forget in serverless)
   - Worker will run for full job duration (up to 3 minutes)
   - All operations are timeout-protected to prevent hangs

3. **Polling Frequency:**
   - Currently: Every 2-3 seconds
   - At scale: Could hit Supabase rate limits
   - **Future:** Consider exponential backoff or Supabase Realtime

---

## Key Design Decisions

### Why Job-Based Queue?
- **Scalability:** Can process multiple jobs concurrently
- **Reliability:** Jobs persist in database, survive crashes
- **User Experience:** Fast response (jobId returned immediately)
- **Resource Management:** Rate limiting and queuing prevent overload

### Why 3 Stages?
- **Stage 1:** Fast basic data (10s) - shows immediate progress
- **Stage 2:** Deeper analysis - can take longer
- **Stage 3:** AI analysis (8s timeout) - most expensive, can timeout gracefully

### Why Immediate Worker Trigger?
- **User Experience:** Jobs start processing immediately (not waiting for cron)
- **Cron Backup:** Hourly cron ensures no jobs are missed
- **Fire-and-Forget:** Doesn't block job creation response

### Why Timeout Protection?
- **Prevents Hangs:** All operations have timeouts
- **Graceful Degradation:** Partial results if timeouts occur
- **User Experience:** System always responds, never hangs

---

## Troubleshooting Guide

### Jobs Stuck at "pending"
1. Check worker is being called: Vercel Function Logs
2. Verify `WORKER_SECRET` is set and matches
3. Check cron job is running: Vercel Dashboard → Cron Jobs
4. Verify environment variables are set correctly

### Jobs Stuck at "running"
1. Check Vercel function timeout limits
2. Verify Supabase connection
3. Check for errors in function logs
4. Job may be processing (can take up to 3 minutes)

### Rate Limit Errors
1. Check Upstash Redis connection
2. Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
3. Check rate limit keys in Redis

### Database Errors
1. Verify Supabase migration has run
2. Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
3. Ensure Supabase project is active

---

## Performance Characteristics

### Response Times
- **Job Creation:** < 2 seconds
- **Status Polling:** < 1 second
- **Job Processing:** 10 seconds - 3 minutes (depends on website)

### Scalability
- **Current:** Handles hundreds of jobs/day
- **With Pro Plan:** Can handle thousands/day
- **Bottleneck:** Vercel function timeout limits (not architecture)

### Resource Usage
- **Supabase:** ~1 query per status poll (2-3s intervals)
- **Upstash:** Minimal (queue operations, rate limits, locks)
- **Vercel:** Function execution time (up to 3 min per job on Pro plan)

---

## Future Improvements

1. **Background Functions:** Use Vercel Background Functions for long-running jobs
2. **Exponential Backoff:** Reduce polling frequency as job ages
3. **Supabase Realtime:** Push updates instead of polling
4. **Job Prioritization:** Process urgent jobs first
5. **Batch Processing:** Process multiple jobs per worker call

---

## Summary

This is a **production-ready, scalable architecture** that:
- ✅ Separates concerns across services
- ✅ Handles failures gracefully
- ✅ Provides real-time user feedback
- ✅ Prevents infinite hangs with timeouts
- ✅ Scales horizontally (multiple workers)
- ✅ Has proper security (worker secret, rate limiting)

The main constraint is **Vercel's function timeout limits**, which may require upgrading to Pro plan for jobs that take longer than the free tier allows.

