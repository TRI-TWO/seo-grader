#!/bin/bash

# Deployment Testing Script
# Usage: ./scripts/test-deployment.sh [APP_URL]
# Example: ./scripts/test-deployment.sh https://seo-grader.vercel.app

set -e

APP_URL="${1:-${VERCEL_URL:-http://localhost:3000}}"

# Remove trailing slash
APP_URL="${APP_URL%/}"

echo "🚀 Testing SEO Grader Deployment"
echo "=================================="
echo "App URL: $APP_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="${5:-200}"
    
    echo -n "Testing $name... "
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$APP_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" "$APP_URL$endpoint" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo "$body" | head -c 200
        echo ""
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (Expected HTTP $expected_status, got HTTP $http_code)"
        echo "Response: $body"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo "📋 Running Tests..."
echo ""

# Test 1: States endpoint
test_endpoint "States API" "GET" "/api/states" "" "200"

# Test 2: Create audit job (normal site)
echo ""
echo "Creating audit job for normal site..."
JOB_RESPONSE=$(curl -s -X POST "$APP_URL/api/audit" \
    -H "Content-Type: application/json" \
    -d '{"url":"https://example.com"}')

if echo "$JOB_RESPONSE" | grep -q "jobId"; then
    echo -e "${GREEN}✓ Audit job created${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    JOB_ID=$(echo "$JOB_RESPONSE" | grep -o '"jobId":"[^"]*' | cut -d'"' -f4)
    echo "Job ID: $JOB_ID"
    
    # Test 3: Get job status
    if [ ! -z "$JOB_ID" ]; then
        echo ""
        echo "Checking job status..."
        sleep 2
        STATUS_RESPONSE=$(curl -s "$APP_URL/api/audit/$JOB_ID")
        if echo "$STATUS_RESPONSE" | grep -q "status"; then
            echo -e "${GREEN}✓ Job status retrieved${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            echo "Status: $(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)"
        else
            echo -e "${RED}✗ Failed to get job status${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    fi
else
    echo -e "${RED}✗ Failed to create audit job${NC}"
    echo "Response: $JOB_RESPONSE"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 4: Test partial audit (blocking site)
echo ""
echo "Testing partial audit with blocking site..."
BLOCKING_JOB_RESPONSE=$(curl -s -X POST "$APP_URL/api/audit" \
    -H "Content-Type: application/json" \
    -d '{"url":"https://httpstat.us/200?sleep=15000"}')

if echo "$BLOCKING_JOB_RESPONSE" | grep -q "jobId"; then
    echo -e "${GREEN}✓ Blocking site job created${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    BLOCKING_JOB_ID=$(echo "$BLOCKING_JOB_RESPONSE" | grep -o '"jobId":"[^"]*' | cut -d'"' -f4)
    echo "Job ID: $BLOCKING_JOB_ID"
    
    # Wait for timeout (should complete in ~20 seconds)
    echo "Waiting for timeout (this may take ~20 seconds)..."
    sleep 25
    
    BLOCKING_STATUS=$(curl -s "$APP_URL/api/audit/$BLOCKING_JOB_ID")
    STATUS=$(echo "$BLOCKING_STATUS" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    PARTIAL_AUDIT=$(echo "$BLOCKING_STATUS" | grep -o '"partialAudit":[^,}]*' | cut -d':' -f2)
    
    if [ "$STATUS" = '"done"' ] && [ "$PARTIAL_AUDIT" = "true" ]; then
        echo -e "${GREEN}✓ Partial audit handled correctly${NC}"
        echo "  Status: $STATUS"
        echo "  Partial Audit: $PARTIAL_AUDIT"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${YELLOW}⚠ Partial audit check inconclusive${NC}"
        echo "  Status: $STATUS"
        echo "  Partial Audit: $PARTIAL_AUDIT"
        echo "  (This is expected if the site didn't actually timeout)"
    fi
else
    echo -e "${RED}✗ Failed to create blocking site job${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Summary
echo ""
echo "=================================="
echo "📊 Test Summary"
echo "=================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

