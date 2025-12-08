# Architecture Documentation: Supabase, Upstash, and Vercel Integration

## Overview

This application uses a **job-based queue system** to process SEO audits asynchronously. The architecture separates concerns across three main services:

1. **Supabase** - PostgreSQL database for job state and results storage
2. **Upstash Redis** - Queue management, rate limiting, and distributed locking
3. **Vercel** - Serverless hosting, API routes, and cron job scheduling

---

## System Architecture Flow

```
┌─────────────┐
│   Frontend  │
│  (Next.js)  │
└──────┬──────┘
       │
       │ 1. POST /api/audit (submit URL)
       ▼
┌─────────────────────────────────────┐
│      Vercel API Route                │
│   POST /api/audit                    │
│                                      │
│  • Rate limit check (Upstash)       │
│  • Acquire lock (Upstash)            │
│  • Check cache (Supabase)            │
│  • Create job (Supabase)             │
│  • Enqueue job (Upstash Queue)       │
└──────┬───────────────────────────────┘
       │
       │ Returns jobId immediately
       ▼
┌─────────────┐
│   Frontend  │
│  /report    │
└──────┬──────┘
       │
       │ 2. Poll GET /api/audit/[id] every 2-3s
       ▼
┌─────────────────────────────────────┐
│      Vercel API Route                │
│   GET /api/audit/[id]                │
│                                      │
│  • Query job status (Supabase)       │
│  • Return status, stage, results    │
└─────────────────────────────────────┘
       │
       │ Meanwhile...
       ▼
┌─────────────────────────────────────┐
│      Vercel Cron Job                 │
│   POST /api/worker/process           │
│   (Runs on schedule from vercel.json)│
│                                      │
│  • Dequeue job (Upstash)            │
│  • Load job (Supabase)              │
│  • Process 3 stages:                │
│    1. Fetch & parse HTML            │
│    2. Calculate scores               │
│    3. AI analysis                   │
│  • Update job status (Supabase)      │
└─────────────────────────────────────┘
```

---

## 1. Supabase Connection

### Purpose
- **Job State Management**: Store audit job records with status, stage, and results
- **Results Storage**: Persist complete audit results as JSONB
- **Caching**: 24-hour cache for recently completed audits

### Configuration

**File**: `lib/supabase.ts`

```typescript
// Lazy initialization pattern (prevents build-time errors)
// Uses service role key for admin access (server-side only)
```

### Environment Variables Required
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Database Schema

**Table**: `audit_jobs`
```sql
- id (UUID, primary key)
- url (TEXT, not null)
- status (TEXT: 'pending', 'running', 'done', 'error')
- stage (INTEGER: 0-3)
- results (JSONB)
- error_message (TEXT, nullable)
- partial_audit (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Key Operations

1. **Create Job** (`POST /api/audit`)
   - Insert new job with status='pending'
   - Returns jobId immediately

2. **Query Job Status** (`GET /api/audit/[id]`)
   - Select job by ID
   - Returns current status, stage, and results

3. **Update Job Progress** (`lib/auditStages.ts`)
   - Update status and stage as processing progresses
   - Save partial results after each stage
   - Final results saved when complete

4. **Cache Check** (`POST /api/audit`)
   - Query for completed jobs in last 24 hours
   - Return existing jobId if found

### Timeout Protection
- All Supabase queries have **5 second timeout**
- Implemented via `withTimeout()` helper function

---

## 2. Upstash Redis Connection

### Purpose
- **Job Queue**: FIFO queue for processing audit jobs
- **Rate Limiting**: Track requests per IP (10/hour)
- **Distributed Locking**: Prevent duplicate processing of same URL

### Configuration

**File**: `lib/upstash.ts`

```typescript
// Lazy initialization pattern
// Uses REST API (no persistent connections needed)
```

### Environment Variables Required
```
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### Redis Keys Used

1. **Queue**: `audit-jobs`
   - Type: List (FIFO)
   - Operations: `LPUSH` (enqueue), `RPOP` (dequeue)

2. **Rate Limiting**: `rate_limit:anonymous:{ip}`
   - Type: String (counter)
   - TTL: 3600 seconds (1 hour)
   - Max: 10 requests per hour

3. **Locks**: `lock:url:{normalizedUrl}`
   - Type: String
   - TTL: 300 seconds (5 minutes)
   - Prevents duplicate processing

### Key Operations

1. **Enqueue Job** (`lib/auditQueue.ts`)
   ```typescript
   await redis.lpush("audit-jobs", JSON.stringify({jobId, url, enqueuedAt}))
   ```

2. **Dequeue Job** (`app/api/worker/process/route.ts`)
   ```typescript
   const item = await redis.rpop<string>("audit-jobs")
   ```

3. **Rate Limiting** (`lib/upstash.ts`)
   ```typescript
   const count = await redis.get<number>(key)
   await redis.incr(key)
   await redis.expire(key, 3600)
   ```

4. **Locking** (`lib/upstash.ts`)
   ```typescript
   await redis.set(key, "1", { ex: 300, nx: true }) // Acquire
   await redis.del(key) // Release
   ```

### Timeout Protection
- All Redis operations have **10 second timeout**
- Implemented via `withTimeout()` helper function

---

## 3. Vercel Integration

### Purpose
- **Hosting**: Next.js application and API routes
- **Serverless Functions**: API endpoints run as serverless functions
- **Cron Jobs**: Scheduled job processing

### API Routes

#### 1. `POST /api/audit`
**Purpose**: Create new audit job

**Flow**:
1. Validate and normalize URL
2. Check rate limit (Upstash)
3. Acquire lock (Upstash)
4. Check for existing job (Supabase)
5. Check 24h cache (Supabase)
6. Create new job (Supabase)
7. Enqueue job (Upstash)
8. Release lock (Upstash)
9. Return jobId

**Response Time**: < 2 seconds (should be fast)

#### 2. `GET /api/audit/[id]`
**Purpose**: Poll job status

**Flow**:
1. Query job by ID (Supabase)
2. Return status, stage, results

**Response Time**: < 1 second

#### 3. `POST /api/worker/process`
**Purpose**: Process next job from queue

**Flow**:
1. Dequeue job (Upstash)
2. Load job details (Supabase)
3. Process 3 stages:
   - **Stage 1**: Fetch HTML, parse basic data (10s timeout)
   - **Stage 2**: Calculate scores, media metrics
   - **Stage 3**: AI analysis (8s timeout)
4. Update job status after each stage (Supabase)
5. Mark as 'done' when complete

**Response Time**: 10-180 seconds (depends on website)

### Cron Job Configuration

**File**: `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/worker/process",
      "schedule": "0 0 * * *"  // ⚠️ CURRENTLY SET TO DAILY!
    }
  ]
}
```

**⚠️ CRITICAL ISSUE**: The cron is set to run **once per day** (`0 0 * * *`), which means:
- Jobs can take up to 24 hours to process
- This is why results are slow!

**Recommended Schedules**:
- **Every minute** (Pro plan): `*/1 * * * *`
- **Every 5 minutes** (Pro plan): `*/5 * * * *`
- **Hourly** (Hobby plan): `0 * * * *`
- **Daily** (Current - too slow): `0 0 * * *`

### Vercel Plan Limitations

- **Hobby Plan**: Cron jobs can only run once per day maximum
- **Pro Plan**: Unlimited cron frequency (can run every minute)

---

## Frontend Flow

### 1. URL Submission (`app/page.tsx`)

```typescript
// User enters URL and clicks submit
POST /api/audit
  → Returns { jobId }
  → Redirect to /report?jobId={jobId}
```

**Timeout**: 15 seconds

### 2. Polling for Results (`app/report/page.tsx`)

```typescript
// Poll every 2-3 seconds
GET /api/audit/{jobId}
  → Returns { status, stage, results }
  
// Status values:
// - "pending": Job in queue, waiting to be processed
// - "running": Job being processed (stage 1-3)
// - "done": Job complete, results available
// - "error": Job failed
```

**Polling Interval**: 2-3 seconds  
**Timeout**: 10 seconds per request  
**Graceful Handling**: Continues polling on timeout (doesn't show error)

---

## Performance Issues & Solutions

### ⚠️ Current Problem: Slow Results

**Root Cause**: Cron job runs only **once per day** (`0 0 * * *` in `vercel.json`)

**Impact**:
- Jobs can wait up to 24 hours before processing starts
- Users see "Loading..." for hours/days
- Poor user experience

**Solutions**:

1. **Upgrade to Vercel Pro Plan** (Recommended)
   - Change cron to `*/1 * * * *` (every minute)
   - Jobs process within 1-3 minutes
   - Best user experience

2. **Use Hourly Schedule** (Hobby Plan Compatible)
   - Change cron to `0 * * * *` (every hour)
   - Jobs process within 1 hour
   - Better than daily, but still slow

3. **Manual Trigger on Job Creation** (Hybrid Approach)
   - After enqueueing job, immediately call `/api/worker/process`
   - Process job right away
   - Fallback to cron for retries

4. **Webhook/Queue-Based Processing** (Advanced)
   - Use external service (e.g., Inngest, Trigger.dev)
   - Process jobs immediately on creation
   - More complex but fastest

### Other Performance Considerations

1. **Database Query Timeouts**: 5 seconds (good)
2. **Redis Operation Timeouts**: 10 seconds (good)
3. **Frontend Request Timeouts**: 10-15 seconds (good)
4. **Stage Processing Timeouts**: 10s (Stage 1), 8s (Stage 3) (good)
5. **Total Job Timeout**: 3 minutes (180s) (reasonable)

### Recommended Immediate Fix

**Change `vercel.json` cron schedule**:

```json
{
  "crons": [
    {
      "path": "/api/worker/process",
      "schedule": "*/5 * * * *"  // Every 5 minutes (requires Pro plan)
    }
  ]
}
```

Or for Hobby plan:
```json
{
  "crons": [
    {
      "path": "/api/worker/process",
      "schedule": "0 * * * *"  // Every hour
    }
  ]
}
```

---

## Environment Variables Checklist

### Required for Production

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Optional
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
AUDIT_VERSION=1.0.0
```

### Where to Set in Vercel

1. Go to Project Settings → Environment Variables
2. Add each variable for:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

---

## Monitoring & Debugging

### Check Job Status

```bash
# Query Supabase directly
SELECT * FROM audit_jobs 
WHERE id = 'your-job-id';

# Check queue length
curl https://your-app.vercel.app/api/worker/process
```

### Check Cron Job Status

1. Vercel Dashboard → Project → Settings → Cron Jobs
2. View execution history
3. Check logs for errors

### Common Issues

1. **Jobs stuck in "pending"**
   - Check cron job is running
   - Verify environment variables
   - Check Vercel function logs

2. **Rate limit errors**
   - Check Upstash Redis connection
   - Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

3. **Database errors**
   - Check Supabase connection
   - Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - Ensure migration has run

4. **Slow processing**
   - Check cron schedule frequency
   - Verify worker is being called
   - Check job timeout settings

---

## Summary

- **Supabase**: Stores job state and results (PostgreSQL)
- **Upstash**: Manages queue, rate limiting, and locks (Redis)
- **Vercel**: Hosts app, API routes, and cron jobs (Serverless)

**Current Issue**: Cron runs daily, causing 24-hour delays  
**Solution**: Upgrade to Pro plan and run cron every minute, or use hourly schedule

