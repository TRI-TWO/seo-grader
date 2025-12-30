# Fix: Jobs Stuck at Stage 0

## ✅ Issue Identified and Fixed

**Problem**: Jobs were stuck at stage 0 because the worker was crashing with a JSDOM/parse5 ESM compatibility error.

**Root Cause**: 
- `jsdom` v27.3.0 depends on `parse5` v7+ which is ESM-only
- Next.js/Vercel serverless functions use CommonJS
- Module load error prevented worker from processing jobs

**Solution**: Downgraded `jsdom` to v24.0.0 (CommonJS-compatible)

## Changes Made

### package.json
- ✅ `jsdom`: `^27.3.0` → `^24.0.0`
- ✅ `@types/jsdom`: `^27.0.0` → `^21.1.6`

### Verification
- ✅ Build succeeds locally
- ✅ No linting errors
- ✅ No code changes required (jsdom API is compatible)

## Deployment Steps

1. **Commit and push changes**:
   ```bash
   git add package.json package-lock.json
   git commit -m "Fix: Downgrade jsdom to v24.0.0 to fix ESM compatibility issue"
   git push origin main
   ```

2. **Wait for Vercel deployment** (automatic on push)

3. **Verify the fix**:
   - Check Vercel function logs - should no longer see:
     ```
     Error [ERR_REQUIRE_ESM]: require() of ES Module ... parse5
     ```
   - Create a test audit job
   - Verify job progresses past stage 0
   - Check that jobs complete successfully

## Expected Behavior After Fix

**Before Fix:**
- Jobs created successfully
- Jobs stuck at `stage: 0`, `status: "pending"`
- Worker logs show ESM error
- No processing occurs

**After Fix:**
- Jobs created successfully
- Jobs progress: `stage: 0` → `stage: 1` → `stage: 2` → `stage: 3`
- Worker processes jobs without errors
- Jobs complete with results

## Testing

After deployment, test with:

1. **Normal site** (should complete):
   ```bash
   curl -X POST https://your-app.vercel.app/api/audit \
     -H "Content-Type: application/json" \
     -d '{"url":"https://example.com"}'
   ```

2. **Check job status**:
   ```bash
   curl https://your-app.vercel.app/api/audit/{jobId}
   ```

3. **Monitor Vercel logs**:
   - Go to Vercel Dashboard → Functions → View Logs
   - Should see successful job processing
   - No ESM errors

## Additional Notes

- The immediate worker trigger (in `/api/audit`) will now work correctly
- Cron job (hourly) will also process jobs as backup
- All production hardening features remain intact:
  - Retry logic with browser headers
  - robots.txt fallback
  - Partial audit handling
  - Timeout protection

---

**Status**: ✅ Ready to deploy
**Risk**: Low (downgrade to stable version)
**Testing**: Build verified locally



