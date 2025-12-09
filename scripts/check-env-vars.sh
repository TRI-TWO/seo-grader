#!/bin/bash

# Environment Variables Checker
# Verifies required environment variables are documented

echo "🔍 Environment Variables Checklist"
echo "=================================="
echo ""

REQUIRED_VARS=(
    "SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
    "UPSTASH_REDIS_REST_URL"
    "UPSTASH_REDIS_REST_TOKEN"
    "AUDIT_VERSION"
)

OPTIONAL_VARS=(
    "WORKER_SECRET"
    "NEXT_PUBLIC_BASE_URL"
    "VERCEL_URL"
)

echo "Required Variables:"
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "  ❌ $var - NOT SET"
    else
        echo "  ✅ $var - SET"
    fi
done

echo ""
echo "Optional Variables:"
for var in "${OPTIONAL_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "  ⚠️  $var - NOT SET (optional)"
    else
        echo "  ✅ $var - SET"
    fi
done

echo ""
echo "📋 To set in Vercel:"
echo "1. Go to: Vercel Dashboard → Your Project → Settings → Environment Variables"
echo "2. Add each variable for: Production, Preview, Development"
echo "3. Required values:"
echo "   - SUPABASE_URL: From Supabase Dashboard → Settings → API → Project URL"
echo "   - SUPABASE_SERVICE_ROLE_KEY: From Supabase Dashboard → Settings → API → service_role key"
echo "   - UPSTASH_REDIS_REST_URL: From Upstash Dashboard → Your Database → REST API"
echo "   - UPSTASH_REDIS_REST_TOKEN: From Upstash Dashboard → Your Database → REST API"
echo "   - AUDIT_VERSION: Set to '1.0.0'"
echo ""

