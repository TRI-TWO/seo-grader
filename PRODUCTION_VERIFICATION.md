# Production Deployment Verification

## ✅ Deployment Status: READY

Your deployment is ready in Vercel! Let's verify everything is working correctly.

## 🚀 Quick Verification

### Step 1: Run Automated Tests

```bash
# Replace with your actual Vercel URL
./scripts/verify-production.sh https://your-app.vercel.app
```

This will test:
- ✅ Basic API endpoints
- ✅ Normal audit flow
- ✅ Partial audit handling (blocking sites)
- ✅ API response structure
- ✅ Production hardening features

### Step 2: Manual Browser Testing

1. **Visit your Vercel URL**
   - Open: `https://your-app.vercel.app`
   - Should see the homepage

2. **Test Normal Audit**
   - Enter URL: `https://example.com`
   - Should redirect to report page
   - Should show loading states for each stage
   - Should display complete results
   - ✅ No infinite spinner

3. **Test Partial Audit (Blocking Site)**
   - Enter a URL that blocks or times out
   - Should see:
     - ✅ Yellow warning banner at top
     - ✅ Message: "This site blocked automated access. Partial audit displayed."
     - ✅ Partial results (if any)
     - ✅ Job status: `done` (not stuck in loading)

4. **Verify Polling Behavior**
   - Open browser DevTools → Console
   - Navigate to report page
   - Watch console logs
   - Should see:
     - ✅ Polling messages stop when job is done
     - ✅ No navigation loops
     - ✅ No repeated "Navigating to..." messages
     - ✅ Only one polling interval

### Step 3: Check Vercel Function Logs

1. Go to: Vercel Dashboard → Your Project → Functions
2. Click "View Logs"
3. Look for:
   - ✅ Successful job processing
   - ✅ Retry attempts (for blocked sites)
   - ✅ "Stage 1 timeout / blocked by site" messages
   - ✅ Partial audit cases handled
   - ❌ No unhandled errors
   - ❌ No function crashes

### Step 4: Verify Database

**In Supabase SQL Editor:**

```sql
-- Check recent jobs
SELECT 
  id,
  url,
  status,
  stage,
  partial_audit,
  error_message,
  created_at
FROM audit_jobs
ORDER BY created_at DESC
LIMIT 10;

-- Check for partial audits
SELECT 
  COUNT(*) as total_jobs,
  COUNT(CASE WHEN partial_audit = true THEN 1 END) as partial_audits,
  COUNT(CASE WHEN status = 'done' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as errors
FROM audit_jobs
WHERE created_at > NOW() - INTERVAL '1 hour';
```

**Expected:**
- Jobs with `partial_audit = true` should have `status = 'done'`
- Jobs should not be stuck in `pending` or `running`
- Error rate should be low

## 📋 Feature Verification Checklist

### Production Hardening Features

- [ ] **Retry Logic**
  - [ ] First attempt with Profile A headers (Chrome Mac)
  - [ ] Retry with Profile B headers (Chrome Windows) if first fails
  - [ ] Both attempts use 10s timeout
  - [ ] Check Vercel logs for retry attempts

- [ ] **robots.txt Fallback**
  - [ ] When HTML fetch fails, attempts robots.txt
  - [ ] Parses sitemap URLs from robots.txt
  - [ ] Stores technical data in results

- [ ] **Partial Audit Handling**
  - [ ] Jobs marked as `done` (not `error`) when Stage 1 fails
  - [ ] `partial_audit = true` set correctly
  - [ ] `error_message = "Stage 1 timeout / blocked by site"`
  - [ ] `stage = 1` when partial audit occurs

- [ ] **UI Banner**
  - [ ] Yellow warning banner displays when `partial_audit = true` and `stage = 1`
  - [ ] Message: "This site blocked automated access. Partial audit displayed."
  - [ ] Banner appears above report content
  - [ ] Partial results still displayed

- [ ] **Polling Fixes**
  - [ ] Only one polling interval at a time
  - [ ] Polling stops when job is `done` or `error`
  - [ ] No navigation in polling loop
  - [ ] No re-navigation loops
  - [ ] `useRef` properly tracks polling state

## 🔍 Detailed Testing

### Test Case 1: Normal Site (Should Complete)

```bash
curl -X POST https://your-app.vercel.app/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

**Expected:**
- Returns `{"jobId": "..."}`
- Job processes through all stages
- Status becomes `done`
- Complete results available

### Test Case 2: Blocking Site (Should Show Partial Audit)

```bash
curl -X POST https://your-app.vercel.app/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://httpstat.us/200?sleep=15000"}'
```

**Expected:**
- Returns `{"jobId": "..."}`
- After ~20 seconds, job status is `done`
- `partial_audit = true`
- `error_message = "Stage 1 timeout / blocked by site"`
- Report page shows warning banner

### Test Case 3: Invalid URL (Should Handle Gracefully)

```bash
curl -X POST https://your-app.vercel.app/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"not-a-valid-url"}'
```

**Expected:**
- Job created but marked as `done` with `partial_audit = true`
- `error_message = "Invalid URL"`
- No crash or error

## 📊 Monitoring

### Key Metrics to Watch

1. **Job Completion Rate**
   - Should be > 95% for normal sites
   - Partial audits should be < 5% for normal sites

2. **Average Processing Time**
   - Normal sites: 30-60 seconds
   - Blocked sites: ~20 seconds (timeout + retry)

3. **Error Rate**
   - Should be < 1% for normal operations
   - Most "errors" should be partial audits, not actual errors

4. **Stuck Jobs**
   - Jobs should not remain in `pending` or `running` > 5 minutes
   - Monitor for jobs stuck in these states

### Alert Conditions

Set up alerts for:
- Jobs stuck in `running` > 5 minutes
- Error rate > 5%
- Function timeout errors
- Database connection errors

## 🐛 Troubleshooting

### Jobs Stuck in "pending"
- Check Vercel cron job is running
- Verify worker endpoint is accessible
- Check function logs for errors

### Jobs Stuck in "running"
- Check function timeout settings
- Verify Supabase connection
- Check for infinite loops in code

### Partial Audits Not Showing
- Verify `partialAudit` field in API response
- Check browser console for errors
- Verify banner rendering logic

### Polling Loops
- Check browser console
- Verify `isPollingRef` is working
- Check useEffect dependencies

## ✅ Success Criteria

Deployment is successful when:

- ✅ All automated tests pass
- ✅ Normal audits complete successfully
- ✅ Partial audits display correctly
- ✅ Polling stops properly
- ✅ No jobs stuck in pending/running
- ✅ Function logs show no critical errors
- ✅ Database shows correct job states

## 📝 Next Steps

After verification:

1. **Monitor for 24-48 hours**
   - Watch job completion rates
   - Monitor error rates
   - Check function performance

2. **Document any edge cases**
   - Note any sites that behave unexpectedly
   - Document partial audit scenarios
   - Track retry success rates

3. **Optimize if needed**
   - Adjust timeouts if needed
   - Fine-tune retry logic
   - Optimize polling intervals

---

**Ready to verify?** Run the automated test script:
```bash
./scripts/verify-production.sh https://your-app.vercel.app
```



