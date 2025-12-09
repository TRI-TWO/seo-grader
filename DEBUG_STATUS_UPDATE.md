# Debug: Job Status Not Updating

## Issue
Worker reports "processed successfully" but job remains at `stage: 0`, `status: "pending"`.

## Possible Causes

1. **Status update not persisting**
   - Supabase update might be failing silently
   - Database connection issue
   - Update query not executing

2. **processStage1 failing before status update**
   - Error occurs before the status update in processStage1
   - Exception is caught but status not updated

3. **processAuditJob completing but status not saved**
   - Function completes but final status not saved
   - Error in status update logic

## Current Status Update Points

1. **processStage1** (line 145-148):
   ```typescript
   await supabase
     .from("audit_jobs")
     .update({ status: "running", stage: 1 })
     .eq("id", jobId);
   ```

2. **processAuditJob** - Should update at start but currently doesn't

## Next Steps

1. Check Vercel function logs for:
   - "processAuditJob: Started processing job..."
   - Any error messages
   - Supabase update errors

2. Verify Supabase connection:
   - Check if updates are actually reaching the database
   - Query the database directly to see job status

3. Add status update at start of processAuditJob:
   - Update status to "running" immediately
   - This ensures status changes even if processStage1 fails

## Manual Check

Query Supabase directly:
```sql
SELECT id, status, stage, updated_at, error_message
FROM audit_jobs
WHERE id = '6fb4ae40-7ac5-4813-a333-6798a98df627';
```

This will show if the status is actually updating in the database.

