#!/bin/bash

# Production Deployment Verification Script
# Tests all production hardening features

set -e

# Get app URL from user or use default
APP_URL="${1:-${VERCEL_URL}}"

if [ -z "$APP_URL" ]; then
    echo "❌ Error: Please provide your Vercel app URL"
    echo "Usage: ./scripts/verify-production.sh https://your-app.vercel.app"
    exit 1
fi

# Remove trailing slash
APP_URL="${APP_URL%/}"

echo "🚀 Production Deployment Verification"
echo "===================================="
echo "App URL: $APP_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

test_result() {
    local name="$1"
    local passed="$2"
    local message="$3"
    
    if [ "$passed" = "true" ]; then
        echo -e "${GREEN}✅ $name${NC}"
        if [ ! -z "$message" ]; then
            echo "   $message"
        fi
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ $name${NC}"
        if [ ! -z "$message" ]; then
            echo "   $message"
        fi
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

warn_result() {
    local name="$1"
    local message="$2"
    echo -e "${YELLOW}⚠️  $name${NC}"
    if [ ! -z "$message" ]; then
        echo "   $message"
    fi
    WARNINGS=$((WARNINGS + 1))
}

echo -e "${BLUE}📋 Testing Basic Endpoints...${NC}"
echo ""

# Test 1: States endpoint
echo -n "Testing /api/states... "
STATES_RESPONSE=$(curl -s -w "\n%{http_code}" "$APP_URL/api/states" 2>&1)
HTTP_CODE=$(echo "$STATES_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    test_result "States API" "true" "HTTP $HTTP_CODE"
else
    test_result "States API" "false" "Expected HTTP 200, got HTTP $HTTP_CODE"
fi

# Test 2: Create normal audit job
echo ""
echo -e "${BLUE}📋 Testing Normal Audit Flow...${NC}"
echo ""

NORMAL_JOB=$(curl -s -X POST "$APP_URL/api/audit" \
    -H "Content-Type: application/json" \
    -d '{"url":"https://example.com"}' 2>&1)

if echo "$NORMAL_JOB" | grep -q "jobId"; then
    NORMAL_JOB_ID=$(echo "$NORMAL_JOB" | grep -o '"jobId":"[^"]*' | cut -d'"' -f4)
    test_result "Create Normal Audit Job" "true" "Job ID: $NORMAL_JOB_ID"
    
    # Check job status
    echo "Waiting 3 seconds for job to start..."
    sleep 3
    
    NORMAL_STATUS=$(curl -s "$APP_URL/api/audit/$NORMAL_JOB_ID" 2>&1)
    if echo "$NORMAL_STATUS" | grep -q "status"; then
        STATUS=$(echo "$NORMAL_STATUS" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
        STAGE=$(echo "$NORMAL_STATUS" | grep -o '"stage":[0-9]*' | cut -d':' -f2)
        test_result "Get Job Status" "true" "Status: $STATUS, Stage: $STAGE"
    else
        test_result "Get Job Status" "false" "Could not retrieve status"
    fi
else
    test_result "Create Normal Audit Job" "false" "Response: $NORMAL_JOB"
fi

# Test 3: Test partial audit (blocking site)
echo ""
echo -e "${BLUE}📋 Testing Partial Audit (Blocking Site)...${NC}"
echo ""

echo "Creating audit for site that will timeout..."
BLOCKING_JOB=$(curl -s -X POST "$APP_URL/api/audit" \
    -H "Content-Type: application/json" \
    -d '{"url":"https://httpstat.us/200?sleep=15000"}' 2>&1)

if echo "$BLOCKING_JOB" | grep -q "jobId"; then
    BLOCKING_JOB_ID=$(echo "$BLOCKING_JOB" | grep -o '"jobId":"[^"]*' | cut -d'"' -f4)
    test_result "Create Blocking Site Job" "true" "Job ID: $BLOCKING_JOB_ID"
    
    echo "Waiting 25 seconds for timeout and retry logic..."
    echo "(This tests the 10s timeout + retry + robots.txt fallback)"
    
    for i in {1..25}; do
        echo -ne "\r   Progress: [$i/25] seconds..."
        sleep 1
    done
    echo ""
    
    BLOCKING_STATUS=$(curl -s "$APP_URL/api/audit/$BLOCKING_JOB_ID" 2>&1)
    STATUS=$(echo "$BLOCKING_STATUS" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    PARTIAL_AUDIT=$(echo "$BLOCKING_STATUS" | grep -o '"partialAudit":[^,}]*' | cut -d':' -f2 | tr -d ' ')
    STAGE=$(echo "$BLOCKING_STATUS" | grep -o '"stage":[0-9]*' | cut -d':' -f2)
    ERROR_MSG=$(echo "$BLOCKING_STATUS" | grep -o '"errorMessage":"[^"]*' | cut -d'"' -f4)
    
    if [ "$STATUS" = '"done"' ] && [ "$PARTIAL_AUDIT" = "true" ]; then
        test_result "Partial Audit Handling" "true" "Status: $STATUS, Partial: $PARTIAL_AUDIT, Stage: $STAGE"
        if [ ! -z "$ERROR_MSG" ]; then
            echo "   Error message: $ERROR_MSG"
        fi
    elif [ "$STATUS" = '"done"' ]; then
        warn_result "Partial Audit Status" "Job completed but partial_audit not set (may be normal if site didn't actually timeout)"
    else
        test_result "Partial Audit Handling" "false" "Expected status='done' with partial_audit=true, got status=$STATUS, partial=$PARTIAL_AUDIT"
    fi
else
    test_result "Create Blocking Site Job" "false" "Response: $BLOCKING_JOB"
fi

# Test 4: Verify retry logic (check logs would be ideal, but we can't access them)
echo ""
echo -e "${BLUE}📋 Production Hardening Features...${NC}"
echo ""

# Check if we can see any evidence of retry logic working
# (In production, this would be in Vercel logs)
warn_result "Retry Logic" "Check Vercel function logs for retry attempts with different headers"

# Test 5: Check API response structure
echo ""
echo -e "${BLUE}📋 API Response Structure...${NC}"
echo ""

if [ ! -z "$BLOCKING_JOB_ID" ]; then
    FINAL_STATUS=$(curl -s "$APP_URL/api/audit/$BLOCKING_JOB_ID" 2>&1)
    
    # Check for required fields
    if echo "$FINAL_STATUS" | grep -q "status"; then
        test_result "API Response: status field" "true"
    else
        test_result "API Response: status field" "false"
    fi
    
    if echo "$FINAL_STATUS" | grep -q "stage"; then
        test_result "API Response: stage field" "true"
    else
        test_result "API Response: stage field" "false"
    fi
    
    if echo "$FINAL_STATUS" | grep -q "partialAudit"; then
        test_result "API Response: partialAudit field" "true"
    else
        test_result "API Response: partialAudit field" "false"
    fi
fi

# Summary
echo ""
echo "===================================="
echo -e "${BLUE}📊 Verification Summary${NC}"
echo "===================================="
echo -e "${GREEN}✅ Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Failed: $TESTS_FAILED${NC}"
echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All critical tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Check Vercel function logs for retry attempts"
    echo "2. Test in browser to verify polling behavior"
    echo "3. Verify partial audit banner displays correctly"
    echo "4. Monitor for 24-48 hours"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Please review the output above.${NC}"
    exit 1
fi

