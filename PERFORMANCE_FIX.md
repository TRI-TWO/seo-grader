# Performance Fix: Slow Results Loading

## 🚨 Critical Issue Found

The cron job that processes audit jobs is set to run **only once per day**, which is why results are taking so long to load.

## Current Configuration

**File**: `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/worker/process",
      "schedule": "0 0 * * *"  // ⚠️ Runs once per day at midnight!
    }
  ]
}
```

## Impact

- Jobs can wait **up to 24 hours** before processing starts
- Users see "Loading..." screen for hours or days
- Poor user experience

## Solutions

### Option 1: Upgrade to Vercel Pro Plan (Recommended)

**Best user experience** - Jobs process within 1-3 minutes

1. Upgrade your Vercel account to Pro plan
2. Update `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/worker/process",
      "schedule": "*/1 * * * *"  // Every minute
    }
  ]
}
```

3. Commit and push:
```bash
git add vercel.json
git commit -m "Fix: Update cron to run every minute for faster processing"
git push origin main
```

### Option 2: Use Hourly Schedule (Hobby Plan Compatible)

**Better than daily** - Jobs process within 1 hour

Update `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/worker/process",
      "schedule": "0 * * * *"  // Every hour at :00
    }
  ]
}
```

### Option 3: Immediate Processing (Hybrid Approach)

**Process jobs immediately** when created, with cron as backup

Modify `app/api/audit/route.ts` after enqueueing:

```typescript
// After enqueueing job
await auditQueue.enqueue(jobId, targetUrl);

// Immediately trigger processing (non-blocking)
fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/worker/process`, {
  method: 'POST',
}).catch(err => {
  // If immediate processing fails, cron will pick it up
  console.error('Immediate processing failed, will be picked up by cron:', err);
});

// Release lock and return
await releaseLock(targetUrl);
return NextResponse.json({ jobId }, { status: 201 });
```

This processes jobs immediately while keeping cron as a fallback.

## Quick Fix Steps

1. **Check your Vercel plan**:
   - Go to Vercel Dashboard → Settings → Billing
   - If on Hobby plan, consider upgrading to Pro

2. **Update cron schedule**:
   - Edit `vercel.json`
   - Change schedule based on your plan (see options above)
   - Commit and push

3. **Verify cron is running**:
   - Go to Vercel Dashboard → Project → Settings → Cron Jobs
   - Check execution history
   - Verify it's running at the expected frequency

## Testing

After updating, test with a new URL:

1. Submit a URL on the frontend
2. Check Vercel function logs to see when worker runs
3. Monitor job status via polling
4. Results should appear much faster

## Expected Processing Times

- **Every minute (Pro plan)**: 1-3 minutes total
- **Every hour (Hobby plan)**: 1-60 minutes (depending on when submitted)
- **Daily (Current)**: 1-24 hours ⚠️

## Additional Recommendations

1. **Monitor queue length**: Add endpoint to check queue size
2. **Add job priority**: Process urgent jobs first
3. **Batch processing**: Process multiple jobs per cron run
4. **Webhook triggers**: Use external service for immediate processing

