# Troubleshooting: Jobs Stuck at Stage 0

## Current Issue
Jobs are created successfully but remain stuck at `stage: 0`, `status: "pending"`.

## Root Cause Analysis

The worker should be triggered immediately after job creation, but something is preventing it from processing.

## Debugging Checklist

### 1. Check Vercel Function Logs

Go to: **Vercel Dashboard → Your Project → Functions → View Logs**

Look for:
- ✅ `"Worker invoked - checking queue..."` - Worker is being called
- ✅ `"Worker: Processing job {jobId}..."` - Job found in queue
- ✅ `"processAuditJob: Started processing job..."` - Processing started
- ❌ `"Worker request rejected: Invalid or missing secret"` - Worker secret issue
- ❌ `"No jobs in queue"` - Queue is empty (job not enqueued)
- ❌ Any error messages

### 2. Check Immediate Worker Trigger

In the audit route logs, look for:
- ✅ `"Enqueued job {jobId} to queue, result: X"` - Job enqueued successfully
- ❌ `"Immediate worker trigger failed: ..."` - Trigger failed

### 3. Check Environment Variables

Verify in **Vercel Dashboard → Settings → Environment Variables**:

**Required:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**Optional but important:**
- `WORKER_SECRET` - If set, worker requests must include this header
- `NEXT_PUBLIC_BASE_URL` - Should be your Vercel app URL (e.g., `https://seo-grader.vercel.app`)
- `VERCEL_URL` - Auto-set by Vercel, but verify it's correct

### 4. Test Worker Endpoint Manually

```bash
# Replace with your actual URL and secret
curl -X POST https://seo-grader.vercel.app/api/worker/process \
  -H "x-worker-secret: YOUR_WORKER_SECRET" \
  -H "Content-Type: application/json"
```

**Expected responses:**
- `{"success":true,"message":"No jobs in queue","processed":false}` - Queue empty
- `{"success":true,"message":"Job {id} processed successfully","processed":true}` - Job processed
- `{"error":"Unauthorized"}` - Worker secret mismatch

### 5. Check Queue Status

The queue should contain jobs. If queue is always empty:
- Jobs might not be enqueued correctly
- Jobs might be dequeued but not processed
- Queue connection might be failing

### 6. Check Database Status

Query Supabase to see job status:

```sql
SELECT 
  id,
  url,
  status,
  stage,
  created_at,
  updated_at
FROM audit_jobs
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:**
- New jobs: `status = "pending"`, `stage = 0`
- Processing: `status = "running"`, `stage >= 1`
- Done: `status = "done"`, `stage = 3`

**If stuck:**
- `status = "pending"`, `stage = 0` - Worker never started
- `status = "running"`, `stage = 0` - Worker started but stage 1 failed

## Common Issues and Fixes

### Issue 1: Worker Secret Mismatch

**Symptoms:**
- Logs show: `"Worker request rejected: Invalid or missing secret"`
- Worker returns 401

**Fix:**
- Remove `WORKER_SECRET` from Vercel env vars, OR
- Ensure `WORKER_SECRET` matches in both audit route trigger and worker route check

### Issue 2: Base URL Incorrect

**Symptoms:**
- Immediate trigger fails silently
- Logs show: `"Immediate worker trigger failed: ..."`

**Fix:**
- Set `NEXT_PUBLIC_BASE_URL` to your Vercel app URL
- Or verify `VERCEL_URL` is set correctly by Vercel

### Issue 3: Queue Not Working

**Symptoms:**
- Logs show: `"No jobs in queue"` even after creating jobs
- Jobs enqueued but never dequeued

**Fix:**
- Verify Upstash Redis credentials
- Check Upstash dashboard for connection issues
- Test queue operations manually

### Issue 4: Worker Not Being Called

**Symptoms:**
- No worker logs at all
- Jobs created but worker never invoked

**Fix:**
- Check if immediate trigger is working
- Verify cron job is configured (backup)
- Check Vercel function deployment

## Immediate Actions

1. **Check logs immediately after creating a job**
   - Look for worker invocation
   - Check for errors

2. **Test worker endpoint manually**
   - Use curl command above
   - Verify it can process jobs

3. **Check environment variables**
   - Ensure all required vars are set
   - Verify worker secret if configured

4. **Monitor queue**
   - Check if jobs are enqueued
   - Check if jobs are dequeued

## Next Steps

After gathering logs:
1. Share Vercel function logs
2. Share worker endpoint test results
3. Share environment variable status
4. We can then identify the exact issue



