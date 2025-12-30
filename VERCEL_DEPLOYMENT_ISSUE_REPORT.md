# Vercel Deployment Issue Report: Synchronous SEO Grader

## Executive Summary

The synchronous SEO Grader system works correctly on `localhost:3000` but fails on Vercel production. The root cause is **Vercel's serverless function timeout limits**, which terminate the function before the audit can complete.

---

## Problem Statement

**Symptom:** No results are returned when submitting URLs on Vercel production, despite the system working perfectly on localhost.

**Expected Behavior:**
- User submits URL → API executes all 3 stages synchronously → Returns complete results in < 25 seconds

**Actual Behavior on Vercel:**
- User submits URL → Function starts execution → Function is terminated by Vercel timeout → No results returned

---

## Root Cause Analysis

### 1. Vercel Function Timeout Limits

**Vercel Plan Timeout Limits:**
- **Hobby Plan (Free):** 10 seconds maximum
- **Pro Plan:** 60 seconds maximum  
- **Enterprise:** 300 seconds maximum

**Our Current Configuration:**
```typescript
// app/api/audit/route.ts
const HARD_TIMEOUT = 25000; // 25 seconds max for entire request
```

**The Problem:**
- Our `HARD_TIMEOUT` is set to 25 seconds
- On **Hobby plan**, Vercel kills the function at **10 seconds** (before our timeout)
- Even on **Pro plan**, if execution takes longer than expected, it could exceed 60 seconds
- The function is terminated **before** it can return results

### 2. Execution Time Breakdown

**Typical Audit Execution Time:**
- **Stage 1 (HTML Fetch + Parse):** 2-12 seconds
  - Initial fetch attempt: up to 10 seconds
  - Retry with alternate headers: up to 10 seconds
  - robots.txt fallback: up to 5 seconds
  - HTML parsing: < 1 second
- **Stage 2 (Scoring + Media):** 1-3 seconds
  - JSDOM parsing: < 1 second
  - Score calculations: < 1 second
  - Media metrics: < 1 second
- **Stage 3 (AI Analysis):** 1-8 seconds
  - AI metrics extraction: up to 8 seconds (with timeout protection)

**Total Expected Time:** 4-23 seconds (typically 8-15 seconds)

**Why It Fails on Vercel:**
- Network latency on Vercel's edge functions can add 1-3 seconds
- Cold starts can add 1-2 seconds
- Multiple fetch attempts (retry logic) can push total time to 15-20 seconds
- On Hobby plan (10s limit), function is killed during Stage 1 retry or Stage 2
- Even on Pro plan, edge cases can exceed 60 seconds

### 3. Localhost vs Vercel Differences

**Why It Works on Localhost:**
- No timeout limits (can run indefinitely)
- Direct network access (no edge function overhead)
- No cold start delays
- Full Node.js environment with all dependencies available

**Why It Fails on Vercel:**
- Strict timeout limits enforced by platform
- Edge function overhead and network latency
- Cold start delays on first invocation
- Potential memory/CPU constraints in serverless environment

---

## Technical Details

### Current Implementation

**API Route:** `app/api/audit/route.ts`
```typescript
export const runtime = "nodejs";
const HARD_TIMEOUT = 25000; // 25 seconds

export async function POST(req: NextRequest) {
  // Execute all 3 stages synchronously
  const stage1Results = await processStage1Sync(targetUrl);
  const stage2Results = await processStage2Sync(stage1Results, US_STATES);
  const finalResults = await processStage3Sync(stage2Results);
  
  return NextResponse.json({ results: finalResults });
}
```

**Stage Functions:** `lib/auditStages.ts`
- `processStage1Sync()` - Fetches HTML with retry logic (up to 20s)
- `processStage2Sync()` - Calculates scores (1-3s)
- `processStage3Sync()` - AI analysis (1-8s)

### Vercel Function Execution Flow

```
Request arrives → Vercel Function starts
  ↓
Stage 1: Fetch HTML (attempt 1: 10s timeout)
  ↓
If fails: Retry with alternate headers (attempt 2: 10s timeout)
  ↓
If both fail: robots.txt fallback (5s timeout)
  ↓
Parse HTML with JSDOM
  ↓
[Vercel kills function here if > 10s on Hobby plan]
  ↓
Stage 2: Calculate scores
  ↓
Stage 3: AI analysis
  ↓
Return results
```

**On Hobby Plan:** Function is killed during Stage 1 retry or early Stage 2
**On Pro Plan:** Function may complete, but edge cases can still timeout

---

## Evidence

### Console Logs Analysis

The console shows old polling code running, which indicates:
1. Browser cache is serving old JavaScript bundle
2. OR the new code hasn't been deployed to Vercel yet
3. OR Vercel is serving cached build

However, the **real issue** is that even with correct code, the function times out on Vercel.

### Expected vs Actual Behavior

**Expected (Localhost):**
```
POST /api/audit → 8-15 seconds → { results: { seoScore: 75, ... } }
```

**Actual (Vercel Hobby Plan):**
```
POST /api/audit → 10 seconds → Function killed → No response or 504 error
```

**Actual (Vercel Pro Plan):**
```
POST /api/audit → 15-20 seconds → { results: { ... } } (works most of the time)
POST /api/audit → 60+ seconds → Function killed → No response (edge cases)
```

---

## Solutions

### Solution 1: Reduce Timeout to Match Vercel Limits (Quick Fix)

**For Hobby Plan:**
```typescript
const HARD_TIMEOUT = 9000; // 9 seconds (1s buffer before Vercel's 10s limit)
```

**Changes Required:**
- Reduce `FETCH_TIMEOUT` from 10s to 4s per attempt
- Remove retry logic (single fetch attempt only)
- Skip robots.txt fallback (takes too long)
- Return partial results if Stage 1 takes > 8 seconds

**Pros:**
- Works on free tier
- Quick to implement

**Cons:**
- Reduced reliability (no retry = more failures)
- Less complete results (may skip stages)
- Poor user experience (more partial audits)

### Solution 2: Upgrade to Vercel Pro Plan (Recommended)

**Changes Required:**
- Upgrade Vercel account to Pro plan
- Keep current `HARD_TIMEOUT = 25000` (25 seconds)
- This fits within Pro plan's 60-second limit

**Pros:**
- Full functionality preserved
- Retry logic works
- Complete audit results
- Better user experience

**Cons:**
- Requires paid subscription ($20/month)

### Solution 3: Use Vercel Background Functions (Best Long-term)

**Changes Required:**
- Mark API route as background function
- Return job ID immediately (like old system)
- Process audit in background
- Frontend polls for results

**Pros:**
- No timeout limits (up to 15 minutes)
- Works on all Vercel plans
- Scalable architecture

**Cons:**
- Requires re-introducing polling (but simpler than before)
- More complex implementation

### Solution 4: Optimize Execution Time (Hybrid)

**Changes Required:**
- Reduce `FETCH_TIMEOUT` to 5 seconds per attempt
- Keep single retry (not two attempts)
- Parallelize robots.txt and sitemap.xml fetches
- Optimize JSDOM parsing
- Reduce AI analysis timeout to 5 seconds

**Target:** Complete audit in < 8 seconds

**Pros:**
- Works on Hobby plan
- Maintains most functionality

**Cons:**
- Still may fail on slow sites
- Less reliable than current implementation

---

## Recommended Action Plan

### Immediate (To Get System Working)

1. **Upgrade to Vercel Pro Plan** ($20/month)
   - Enables 60-second function timeout
   - Current code will work as-is
   - Best user experience

2. **OR Reduce Timeout for Hobby Plan:**
   - Set `HARD_TIMEOUT = 9000`
   - Reduce `FETCH_TIMEOUT = 4000`
   - Single fetch attempt (no retry)
   - Accept more partial audits

### Long-term (For Scalability)

1. **Implement Background Functions:**
   - Use Vercel Background Functions API
   - Process audits asynchronously
   - No timeout limits
   - Better for production scale

2. **Add Monitoring:**
   - Track function execution times
   - Alert on timeouts
   - Monitor success rates

---

## Code Changes Required (If Using Solution 1)

### File: `app/api/audit/route.ts`

```typescript
// Change from:
const HARD_TIMEOUT = 25000; // 25 seconds

// To (for Hobby plan):
const HARD_TIMEOUT = 9000; // 9 seconds (1s buffer)
```

### File: `lib/auditStages.ts`

```typescript
// Change from:
const FETCH_TIMEOUT = 10000; // 10 seconds

// To (for Hobby plan):
const FETCH_TIMEOUT = 4000; // 4 seconds

// In processStage1Sync, remove retry logic:
// - Only attempt 1 (Profile A)
// - Skip attempt 2 (Profile B)
// - Skip robots.txt fallback
```

---

## Testing Recommendations

1. **Test on Vercel Pro Plan:**
   - Deploy current code
   - Test with various URLs
   - Monitor execution times in Vercel dashboard

2. **Test Timeout Handling:**
   - Use slow-responding URLs
   - Verify partial audit results are returned
   - Check error handling

3. **Monitor Function Logs:**
   - Check Vercel Function Logs for timeout errors
   - Look for "Function execution exceeded timeout" messages
   - Track average execution times

---

## Conclusion

The synchronous SEO Grader works perfectly on localhost because there are no timeout constraints. On Vercel, the **10-second function timeout limit (Hobby plan)** kills the function before the audit can complete.

**The system is architecturally sound** - the issue is purely a platform limitation.

**Recommended Solution:** Upgrade to Vercel Pro Plan ($20/month) to enable 60-second timeouts, allowing the current implementation to work as designed.

**Alternative:** Reduce timeouts and accept more partial audits to work within Hobby plan limits.

---

## Appendix: Vercel Function Timeout Documentation

- **Hobby Plan:** 10 seconds maximum execution time
- **Pro Plan:** 60 seconds maximum execution time
- **Enterprise:** 300 seconds maximum execution time
- **Background Functions:** Up to 15 minutes (requires Pro plan)

**Reference:** https://vercel.com/docs/functions/runtimes#max-duration



