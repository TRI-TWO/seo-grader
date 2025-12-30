# Fix: JSDOM ESM Compatibility Issue

## Problem

Jobs were stuck at stage 0 because the worker was crashing with:
```
Error [ERR_REQUIRE_ESM]: require() of ES Module /var/task/node_modules/jsdom/node_modules/parse5/dist/index.js
```

This happened because:
- `jsdom` v27.x depends on `parse5` v7+ which is ESM-only
- Next.js/Vercel uses CommonJS for serverless functions
- The module load error prevented the worker from processing any jobs

## Solution

**Downgraded jsdom to v24.0.0** which:
- Uses CommonJS-compatible dependencies
- Works correctly with Next.js serverless functions
- Still provides all required functionality

## Changes Made

1. **package.json**:
   - Changed `"jsdom": "^27.3.0"` → `"jsdom": "^24.0.0"`
   - Changed `"@types/jsdom": "^27.0.0"` → `"@types/jsdom": "^21.1.6"`

2. **No code changes required** - jsdom API is compatible

## Verification

After deployment:
1. Check Vercel function logs - should no longer see ESM errors
2. Create a test audit job
3. Verify job progresses past stage 0
4. Check that jobs complete successfully

## Next Steps

1. Commit and push changes
2. Wait for Vercel deployment
3. Test with a real URL
4. Monitor logs for any remaining issues



