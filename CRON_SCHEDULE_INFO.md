# Cron Schedule Configuration

## Vercel Plan Limitations

- **Hobby Plan**: Limited to daily cron jobs (can't run more than once per day)
- **Pro Plan**: Unlimited cron jobs

## Current Configuration

The cron job is set to run **hourly** (`0 * * * *`), which means:
- Runs at the top of every hour (12:00, 1:00, 2:00, etc.)
- This is a compromise between frequent processing and Hobby plan limits

## Schedule Options

### Current: Hourly (Hobby Compatible)
```json
"schedule": "0 * * * *"
```
- Runs once per hour
- Good balance for job processing
- Works on Hobby plan

### Alternative: Daily (Most Hobby Compatible)
```json
"schedule": "0 0 * * *"
```
- Runs once per day at midnight
- Safest for Hobby plan
- Jobs may take longer to process

### For Pro Plan: Every Minute
```json
"schedule": "*/1 * * * *"
```
- Runs every minute
- Fastest job processing
- Requires Pro plan upgrade

## Manual Trigger Option

You can also manually trigger the worker:
```bash
curl -X POST https://your-app.vercel.app/api/worker/process
```

Or set up a webhook/API route that calls the worker on-demand.

## Upgrading to Pro

If you need more frequent processing:
1. Upgrade to Vercel Pro plan
2. Change schedule back to `*/1 * * * *` (every minute)
3. Redeploy

## Current Status

✅ Cron schedule updated to hourly (`0 * * * *`)
✅ Compatible with Hobby plan
✅ Jobs will process once per hour

