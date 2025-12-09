# Deployment Verification Checklist

## ✅ Step 1: Commit and Push - COMPLETED
- [x] Committed changes to main branch
- [x] Pushed to origin/main
- Commit hash: `28bc14a`

## Step 2: Verify Environment Variables in Vercel

**Required Variables:**
- [ ] `SUPABASE_URL` - Check in Vercel Dashboard → Settings → Environment Variables
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Verify it's set
- [ ] `UPSTASH_REDIS_REST_URL` - Verify it's set
- [ ] `UPSTASH_REDIS_REST_TOKEN` - Verify it's set
- [ ] `AUDIT_VERSION` - Should be `1.0.0`

**Optional (for worker security):**
- [ ] `WORKER_SECRET` - Optional, but recommended for production

**Important:** Verify these are set for:
- [ ] Production environment
- [ ] Preview environment
- [ ] Development environment

**Vercel Dashboard:** https://vercel.com/dashboard

## Step 3: Deploy to Vercel

**Automatic Deployment:**
- [ ] Check Vercel Dashboard → Deployments
- [ ] Verify new deployment started after push to main
- [ ] Wait for build to complete (~2-3 minutes)
- [ ] Check build logs for any errors

**Manual Deployment (if needed):**
```bash
vercel --prod
```

**Deployment URL:** Check Vercel dashboard for your production URL

## Step 4: Test Normal Audit Flow

**Test Command:**
```bash
# Replace YOUR_APP_URL with your Vercel deployment URL
curl -X POST https://YOUR_APP_URL/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

**Expected Result:**
- Returns `{"jobId": "..."}`
- Job processes through stages
- Report page shows complete results
- No infinite spinner

**Manual Test:**
1. Visit your Vercel deployment URL
2. Enter a test URL (e.g., `https://example.com`)
3. Should redirect to report page
4. Should show loading states for each stage
5. Should display complete audit results

## Step 5: Test Blocking Site (Partial Audit)

**Test with a site that blocks bots or times out:**
```bash
# Test with a URL that might block or timeout
curl -X POST https://YOUR_APP_URL/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://httpstat.us/200?sleep=15000"}'
```

**Expected Result:**
- Job should complete (not hang)
- Status should be `"done"` (not `"error"`)
- `partial_audit` should be `true`
- Report page should show:
  - Yellow warning banner: "This site blocked automated access. Partial audit displayed."
  - Partial results (if any)
  - No infinite spinner

**Verify in Database:**
```sql
-- Run in Supabase SQL Editor
SELECT id, status, stage, partial_audit, error_message, created_at
FROM audit_jobs
ORDER BY created_at DESC
LIMIT 5;
```

Should see jobs with:
- `status = 'done'`
- `stage = 1`
- `partial_audit = true`
- `error_message = 'Stage 1 timeout / blocked by site'`

## Step 6: Verify Polling Stops Correctly

**Browser Console Test:**
1. Open browser DevTools → Console
2. Navigate to report page with a jobId
3. Watch console logs
4. Should see: `"Job status: done Stage: X"` (not repeating)
5. Should NOT see navigation loops
6. Polling should stop when status is "done" or "error"

**Expected Behavior:**
- Only ONE polling interval running
- Polling stops when job reaches terminal state
- No `router.push` or navigation in polling loop
- No "Navigating to /report?jobId=..." repeating

## Step 7: Check Function Logs for Errors

**Vercel Dashboard:**
1. Go to: Vercel Dashboard → Your Project → Functions
2. Click on function logs
3. Check for:
   - [ ] No timeout errors (should be handled gracefully)
   - [ ] No unhandled promise rejections
   - [ ] Retry attempts logged correctly
   - [ ] Partial audit cases logged

**Key Functions to Check:**
- `/api/audit` - Job creation
- `/api/audit/[id]` - Job status retrieval
- `/api/worker/process` - Job processing
- `/api/worker/process` cron job - Should run hourly

**Look for:**
- ✅ "Stage 1 timeout / blocked by site" messages (expected for blocked sites)
- ✅ Retry attempts with different headers
- ❌ Unhandled errors or crashes
- ❌ Jobs stuck in "running" state

## Step 8: Monitor for Production Issues

**Monitoring Checklist:**
- [ ] Jobs are completing (not stuck in pending/running)
- [ ] No excessive timeout errors
- [ ] Polling is efficient (not creating multiple intervals)
- [ ] Partial audits display correctly
- [ ] Normal audits complete successfully

**Metrics to Watch:**
- Job completion rate
- Average job processing time
- Partial audit rate (should be low for normal sites)
- Error rate (should be minimal)

**Alert Conditions:**
- Jobs stuck in "running" for > 5 minutes
- High error rate (> 10%)
- Function timeouts
- Database connection errors

## Quick Verification Script

Run this to test all endpoints:

```bash
#!/bin/bash
APP_URL="https://YOUR_APP_URL"

echo "Testing API endpoints..."

# Test states endpoint
echo "1. Testing /api/states..."
curl -s "$APP_URL/api/states" | head -c 100
echo ""

# Test audit creation
echo "2. Testing /api/audit..."
JOB_RESPONSE=$(curl -s -X POST "$APP_URL/api/audit" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}')
echo "$JOB_RESPONSE"

JOB_ID=$(echo "$JOB_RESPONSE" | grep -o '"jobId":"[^"]*' | cut -d'"' -f4)
echo "Job ID: $JOB_ID"

# Test job status
if [ ! -z "$JOB_ID" ]; then
  echo "3. Testing /api/audit/$JOB_ID..."
  curl -s "$APP_URL/api/audit/$JOB_ID" | head -c 200
  echo ""
fi

echo "Done!"
```

## Troubleshooting

**If jobs are stuck:**
1. Check Vercel function logs
2. Verify cron job is running
3. Check environment variables
4. Verify Supabase connection

**If partial audits not showing:**
1. Check browser console for errors
2. Verify `partialAudit` is in API response
3. Check report page state management

**If polling loops:**
1. Check browser console
2. Verify `isPollingRef` is working
3. Check useEffect dependencies

## Next Steps After Verification

Once all checks pass:
1. ✅ Monitor for 24-48 hours
2. ✅ Check error rates
3. ✅ Verify user experience
4. ✅ Document any edge cases found

